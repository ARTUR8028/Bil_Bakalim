import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import xlsx from 'xlsx';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import QRCode from 'qrcode';
import { initializeDatabase, getAllQuestions, addQuestion, addQuestionsInBulk, getQuestionCount, deleteAllQuestions } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://bil-bakalim.onrender.com", "https://www.bil-bakalim.onrender.com"] 
      : ["http://localhost:5173", "http://127.0.0.1:5173", "http://0.0.0.0:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  // İyileştirilmiş bağlantı ayarları
  maxHttpBufferSize: 1e6,
  compression: true,
  serveClient: false,
  // Bağlantı stabilitesi için
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 dakika
    skipMiddlewares: true,
  }
});

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('\n🚀 ================================');
console.log(`🎮 Quiz Sunucusu Başlatılıyor... (${NODE_ENV === 'production' ? 'Production' : 'Nodemon ile'})`);
console.log('📊 Sorular yükleniyor...');
console.log('🚀 ================================');

// CORS middleware - Daha kapsamlı
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Otomatik çeviriyi engelle
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('Content-Language', 'tr');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Production'da build edilmiş dosyaları serve et
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
} else {
  app.use(express.static('public'));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Klasörleri oluştur
async function createDirectories() {
  try {
    await fs.mkdir('uploads', { recursive: true });
    await fs.mkdir('data', { recursive: true });
    console.log('✅ Gerekli klasörler oluşturuldu');
  } catch (err) {
    console.error('❌ Klasör oluşturma hatası:', err);
  }
}

// Multer konfigürasyonu - Geliştirilmiş
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (daha küçük, daha hızlı)
    files: 1, // Tek dosya
    fieldSize: 1024 * 1024 // 1MB field size
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 Dosya yükleme isteği:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Dosya boyutu kontrolü
    if (file.size > 5 * 1024 * 1024) {
      console.log('❌ Dosya çok büyük:', file.size);
      cb(new Error('Dosya çok büyük. Maksimum 5MB olmalı.'));
      return;
    }
    
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      console.log('❌ Geçersiz dosya tipi:', file.mimetype);
      cb(new Error('Sadece Excel dosyaları (.xlsx, .xls) kabul edilir'));
    }
  }
});

// Oyun durumu
let questions = [];

// Room-based sistem
const rooms = new Map(); // roomId -> room state

// Room state yapısı:
// {
//   players: {},
//   answers: {},
//   globalScores: {},
//   currentTimerInterval: null,
//   gameState: { isActive, currentQuestion, questionStartTime, totalQuestions, currentQuestionIndex },
//   hostSocketId: string,
//   createdAt: timestamp
// }

// Yardımcı fonksiyonlar
function generateRoomId() {
  // 6 haneli benzersiz room ID oluştur
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom(roomId, hostSocketId) {
  const room = {
    players: {},
    answers: {},
    globalScores: {},
    currentAnswer: null,
    currentTimerInterval: null,
    gameState: {
      isActive: false,
      currentQuestion: null,
      questionStartTime: null,
      totalQuestions: questions.length,
      currentQuestionIndex: 0
    },
    hostSocketId: hostSocketId,
    createdAt: Date.now()
  };
  rooms.set(roomId, room);
  console.log(`🏠 Yeni room oluşturuldu: ${roomId}, Host: ${hostSocketId}`);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room && room.currentTimerInterval) {
    clearInterval(room.currentTimerInterval);
  }
  rooms.delete(roomId);
  console.log(`🗑️ Room silindi: ${roomId}`);
}

// Geriye dönük uyumluluk için global state (eski sistemle çalışması için)
let players = {};
let currentAnswer = null;
let answers = {};
let globalScores = {}; // Global puan sistemi - oyuncular çıksa bile puanları korunur
let currentTimerInterval = null; // Timer interval'ı global olarak sakla
let gameState = {
  isActive: false,
  currentQuestion: null,
  questionStartTime: null,
  totalQuestions: 0,
  currentQuestionIndex: 0
};

// Başlangıç işlemleri
async function initializeServer() {
  await createDirectories();
  
  // Server başladığında tüm oyuncuları temizle
  players = {};
  answers = {};
  currentAnswer = null;
  gameState = {
    isActive: false,
    currentQuestion: null,
    questionStartTime: null,
    totalQuestions: 0,
    currentQuestionIndex: 0
  };
  console.log('🧹 Server başladı, tüm oyuncular ve oyun durumu temizlendi');
  
  // Veritabanını başlat ve soruları yükle
  try {
    // Önce veritabanını başlat
    await initializeDatabase();
    
    // Soruları veritabanından yükle
    questions = await getAllQuestions();
    gameState.totalQuestions = questions.length;
    console.log(`✅ ${questions.length} soru veritabanından yüklendi`);
  } catch (err) {
    console.error('❌ Veritabanı hatası:', err);
    console.log('⚠️ Fallback: JSON dosyasından yüklenmeye çalışılıyor...');
    
    // Fallback: JSON dosyasından yükle
    try {
      const questionsPath = path.join(__dirname, '../data/questions.json');
      if (fsSync.existsSync(questionsPath)) {
        const raw = await fs.readFile(questionsPath, 'utf-8');
        questions = JSON.parse(raw);
        gameState.totalQuestions = questions.length;
        console.log(`✅ ${questions.length} soru JSON dosyasından yüklendi (fallback)`);
      } else {
        questions = [];
        gameState.totalQuestions = 0;
      }
    } catch (fileErr) {
      console.error('❌ JSON dosyası da yüklenemedi:', fileErr);
      questions = [];
      gameState.totalQuestions = 0;
    }
  }
}

// API Routes
app.get('/', (req, res) => {
  const uptime = Math.floor(process.uptime());
  res.send(`
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; border-radius: 10px;">
      <h1 style="color: #2d3748; text-align: center;">🎮 Quiz Sunucusu Çalışıyor!</h1>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0;">
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #4299e1; margin: 0;">📊 Port</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #2d3748;">${PORT}</p>
        </div>
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #48bb78; margin: 0;">📋 Sorular</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #2d3748;">${questions.length}</p>
        </div>
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #ed8936; margin: 0;">👥 Oyuncular</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #2d3748;">${Object.keys(players).length}</p>
        </div>
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #9f7aea; margin: 0;">⏱️ Uptime</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #2d3748;">${uptime}s</p>
        </div>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="/health" style="background: #4299e1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 10px;">Sistem Durumu</a>
        <a href="/questions" style="background: #48bb78; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 10px;">Sorular</a>
        <a href="/test" style="background: #ed8936; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 10px;">Test</a>
      </div>
      <div style="text-align: center; color: #718096; font-size: 14px;">
        <p>🌐 Frontend: <a href="http://129.154.248.238:5173" target="_blank">http://129.154.248.238:5173</a></p>
        <p>📱 Yarışmacı: <a href="http://129.154.248.238:5173/#player" target="_blank">http://129.154.248.238:5173/#player</a></p>
      </div>
    </div>
  `);
});

app.get('/api/questions', (req, res) => {
  try {
    console.log(`📋 Sorular istendi: ${questions.length} soru`);
    res.json(questions);
  } catch (error) {
    console.error('❌ Questions endpoint error:', error);
    res.status(500).json({ 
      error: 'Sorular yüklenemedi', 
      details: error.message,
      success: false
    });
  }
});

app.get('/api/health', (req, res) => {
  const health = {
    status: 'OK', 
    server: 'Running',
    port: PORT,
    players: Object.keys(players).length,
    questions: questions.length,
    gameActive: gameState.isActive,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    version: process.version,
    gameState: {
      currentQuestion: gameState.currentQuestionIndex + 1,
      totalQuestions: gameState.totalQuestions,
      isActive: gameState.isActive
    }
  };
  console.log('🏥 Health check:', {
    players: health.players,
    questions: health.questions,
    uptime: health.uptime
  });
  res.json(health);
});

// APK Download endpoint
app.get('/api/download/apk', (req, res) => {
  console.log('📱 APK indirme isteği alındı');
  
  const apkPath = path.join(__dirname, '../public/apps/BilBakalimTV.apk');
  
  // APK dosyası var mı kontrol et
  if (!fsSync.existsSync(apkPath)) {
    console.log('❌ APK dosyası bulunamadı:', apkPath);
    return res.status(404).json({ 
      error: 'APK dosyası bulunamadı',
      message: 'Android uygulaması henüz hazır değil'
    });
  }
  
  // APK dosyasını gönder
  res.download(apkPath, 'BilBakalimTV.apk', (err) => {
    if (err) {
      console.error('❌ APK indirme hatası:', err);
      res.status(500).json({ error: 'APK indirilemedi' });
    } else {
      console.log('✅ APK başarıyla indirildi');
    }
  });
});

// QR Code for APK Download
app.get('/api/qr/apk', async (req, res) => {
  console.log('📱 APK QR kodu isteği alındı');
  
  const apkUrl = `${req.protocol}://${req.get('host')}/api/download/apk`;
  
  try {
    // QR kod oluştur
    const qrCodeDataURL = await QRCode.toDataURL(apkUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1A1A2E',
        light: '#FFFFFF'
      }
    });
    
    console.log('✅ APK QR kodu oluşturuldu');
    res.json({
      qrCode: qrCodeDataURL,
      downloadUrl: apkUrl,
      message: 'Android TV uygulamasını indirmek için QR kodu tarayın'
    });
  } catch (err) {
    console.error('❌ QR kod oluşturma hatası:', err);
    res.status(500).json({ error: 'QR kod oluşturulamadı' });
  }
});

app.get('/api/test', (req, res) => {
  const testData = {
    message: '✅ Sunucu çalışıyor!',
    timestamp: new Date().toISOString(),
    questions: questions.length,
    players: Object.keys(players).length,
    gameActive: gameState.isActive,
    endpoints: {
      health: '/health',
      questions: '/questions',
      upload: '/upload (POST)'
    },
    sampleQuestion: questions.length > 0 ? questions[0] : null
  };
  
  console.log('🧪 Test endpoint çağrıldı:', testData);
  res.json(testData);
});

// Şifre değiştirme endpoint
app.post('/api/change-password', (req, res) => {
  console.log('🔐 Şifre değiştirme isteği alındı');
  
  const { currentPassword, newPassword, username } = req.body;
  
  // Basit doğrulama
  if (!currentPassword || !newPassword || !username) {
    return res.status(400).json({ 
      success: false, 
      message: 'Tüm alanlar gerekli.' 
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'Yeni şifre en az 6 karakter olmalıdır.' 
    });
  }
  
  // Bu örnekte basit bir doğrulama yapıyoruz
  // Gerçek uygulamada veritabanından mevcut şifreyi kontrol etmelisiniz
  const validCredentials = {
    'admin': 'admin123',  // Varsayılan admin şifresi
    'osman': 'osman123'   // Örnek kullanıcı
  };
  
  if (validCredentials[username] !== currentPassword) {
    return res.status(401).json({ 
      success: false, 
      message: 'Mevcut şifre yanlış.' 
    });
  }
  
  // Şifre değiştirme işlemi
  // Gerçek uygulamada veritabanında güncelleme yapmalısınız
  console.log(`🔐 ${username} kullanıcısının şifresi değiştirildi`);
  
  res.json({ 
    success: true, 
    message: 'Şifre başarıyla değiştirildi!' 
  });
});

// Tüm soruları silme endpoint
app.delete('/api/delete-all-questions', async (req, res) => {
  console.log('🗑️ Tüm soruları silme isteği alındı');
  
  const { username } = req.body;
  
  // Basit doğrulama
  if (!username) {
    return res.status(400).json({ 
      success: false, 
      message: 'Kullanıcı adı gerekli.' 
    });
  }
  
  const deletedCount = questions.length;
  
  // Veritabanından temizle
  try {
    await deleteAllQuestions();
    console.log('✅ Veritabanından tüm sorular silindi');
  } catch (dbError) {
    console.error('❌ Veritabanı silme hatası:', dbError);
    return res.status(500).json({ 
      success: false, 
      message: 'Veritabanından sorular silinemedi: ' + dbError.message
    });
  }
  
  // Memory'deki listeyi temizle
  questions = [];
  
  // questions.json dosyasını da temizle
  try {
    const questionsPath = path.join(__dirname, '../data/questions.json');
    await fs.writeFile(questionsPath, JSON.stringify([], null, 2), 'utf-8');
    console.log('💾 questions.json dosyası temizlendi');
  } catch (error) {
    console.error('⚠️ Dosya yazma hatası:', error);
    // Devam et, çünkü veritabanı ve memory temizlendi
  }
  
  // Oyun durumunu sıfırla
  gameState = {
    isActive: false,
    currentQuestion: null,
    questionStartTime: null,
    totalQuestions: 0,
    currentQuestionIndex: 0
  };
  
  // Cevapları temizle
  answers = {};
  
  console.log(`🗑️ ${username} kullanıcısı tüm soruları sildi (${deletedCount} soru)`);
  
  res.json({ 
    success: true, 
    message: 'Tüm sorular başarıyla silindi!',
    deletedCount: deletedCount
  });
});

// Excel upload endpoint - Geliştirilmiş
app.post('/api/upload', (req, res) => {
  console.log('📤 Upload isteği alındı');
  
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({ 
        error: err.message || 'Dosya yükleme hatası',
        success: false
      });
    }

    if (!req.file) {
      console.log('❌ Dosya yüklenmedi');
      return res.status(400).json({ 
        error: 'Dosya yüklenmedi',
        success: false
      });
    }

    const filePath = req.file.path;
    console.log('📁 Dosya yüklendi:', {
      path: filePath,
      originalName: req.file.originalname,
      size: req.file.size
    });

    try {
      // Excel dosyasını oku - İyileştirilmiş güvenlik kontrolü ile
      if (req.file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('Dosya çok büyük. Maksimum 5MB olmalı.');
      }
      
      console.log('📊 Excel dosyası işleniyor...', {
        size: req.file.size,
        path: filePath
      });
      
      const workbook = xlsx.readFile(filePath, { 
        cellDates: false,
        cellNF: false,
        cellStyles: false,
        sheetStubs: false,
        bookProps: false,
        bookSheets: false,
        bookVBA: false,
        password: '',
        WTF: false,
        // Performans optimizasyonu
        dense: false,
        raw: false
      });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excel dosyasında sayfa bulunamadı.');
      }
      
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      if (!sheet) {
        throw new Error('Excel sayfası okunamadı.');
      }
      
      const data = xlsx.utils.sheet_to_json(sheet, { 
        raw: false,
        defval: '',
        blankrows: false,
        header: 1
      });

      console.log('📊 Excel verisi okundu:', {
        sheetCount: workbook.SheetNames.length,
        rowCount: data.length,
        firstSheet: sheetName
      });

      if (data.length > 0) {
        console.log('📊 İlk satır örneği:', data[0]);
        console.log('📊 Sütun isimleri:', Object.keys(data[0]));
      }

      // Mevcut soruları yükle (her zaman ekleme modunda)
      let existing = [];
      try {
        const raw = await fs.readFile('data/questions.json', 'utf-8');
        existing = JSON.parse(raw);
        console.log(`📚 Mevcut ${existing.length} soru yüklendi (yeni sorular üstüne eklenecek)`);
      } catch (err) {
        console.log('📝 Yeni soru dosyası oluşturuluyor...');
        existing = [];
      }

      const merged = [...existing];
      let addedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      
      // Array formatında gelen veriyi işle
      data.forEach((row, index) => {
        try {
          // İlk satırı (başlık) atla
          if (index === 0) {
            const firstCol = row[0]?.toString().toLowerCase();
            if (firstCol && (firstCol.includes('soru') || firstCol.includes('question'))) {
              console.log(`📋 Başlık satırı atlandı: ${row.join(', ')}`);
              skippedCount++;
              return;
            }
          }
          
          // Array formatında gelen veriyi kontrol et
          if (!Array.isArray(row) || row.length < 2) {
            skippedCount++;
            console.log(`⚠️ Satır ${index + 1} atlandı: yetersiz veri`);
            return;
          }

          // İlk iki sütunu soru ve cevap olarak al
          const questionText = row[0];
          const answerText = row[1];

          console.log(`📝 Satır ${index + 1}:`, { 
            questionText: questionText?.toString().substring(0, 50),
            answerText: answerText?.toString().substring(0, 20)
          });

          if (questionText && answerText) {
            const questionStr = questionText.toString().trim();
            const answerStr = answerText.toString().trim();
            
            if (questionStr && answerStr) {
              // Duplicate kontrolü yap
              const isDuplicate = merged.some(q => 
                q.question.toLowerCase() === questionStr.toLowerCase()
              );
              
              if (isDuplicate) {
                duplicateCount++;
                console.log(`⚠️ Satır ${index + 1} atlandı: mükerrer soru - ${questionStr.substring(0, 50)}...`);
              } else {
                merged.push({
                  question: questionStr,
                  answer: answerStr
                });
                addedCount++;
                console.log(`✅ Soru eklendi: ${questionStr.substring(0, 50)}...`);
              }
            } else {
              skippedCount++;
              console.log(`⚠️ Satır ${index + 1} atlandı: boş veri`);
            }
          } else {
            skippedCount++;
            console.log(`⚠️ Satır ${index + 1} atlandı: eksik veri`, {
              availableKeys: Object.keys(row),
              rowData: row
            });
          }
        } catch (rowError) {
          errorCount++;
          console.error(`❌ Satır ${index + 1} işlenirken hata:`, rowError);
        }
      });

      // Veritabanına kaydet
      const { added: dbAdded, duplicates: dbDuplicates } = await addQuestionsInBulk(merged);
      
      // Memory'deki listeyi güncelle
      questions = await getAllQuestions();
      gameState.totalQuestions = questions.length;

      console.log(`✅ İşlem tamamlandı: ${dbAdded} veritabanına eklendi, ${dbDuplicates} mükerrer, ${skippedCount} atlandı, ${errorCount} hata`);

      // questions.json dosyasına da yaz (backup/fallback için)
      try {
        const questionsPath = path.join(__dirname, '../data/questions.json');
        await fs.writeFile(questionsPath, JSON.stringify(questions, null, 2), 'utf-8');
        console.log('💾 questions.json dosyası güncellendi');
      } catch (fileError) {
        console.error('⚠️ questions.json yazma hatası:', fileError);
        // Dosya yazma hatası olsa bile devam et, çünkü veritabanına eklendi
      }

      // Geçici dosyayı sil
      try {
        await fs.unlink(filePath);
        console.log('🗑️ Geçici dosya silindi');
      } catch (unlinkErr) {
        console.error('⚠️ Geçici dosya silinemedi:', unlinkErr);
      }

      const message = `✅ Dosya başarıyla işlendi! ${addedCount} yeni soru eklendi${duplicateCount > 0 ? `, ${duplicateCount} mükerrer soru atlandı` : ''}${skippedCount > 0 ? `, ${skippedCount} geçersiz satır` : ''}${errorCount > 0 ? `, ${errorCount} hata` : ''}. Toplam: ${merged.length} soru.`;

      res.json({ 
        message,
        added: addedCount,
        duplicates: duplicateCount,
        skipped: skippedCount,
        errors: errorCount,
        total: merged.length,
        success: true,
        details: {
          originalRows: data.length,
          processedSuccessfully: addedCount + duplicateCount + skippedCount,
          finalQuestionCount: merged.length
        }
      });

    } catch (error) {
      console.error('❌ Excel işleme hatası:', error);
      
      try {
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        console.error('⚠️ Geçici dosya silinemedi:', unlinkErr);
      }
      
      res.status(500).json({ 
        error: 'Dosya işlenirken bir hata oluştu: ' + error.message,
        success: false,
        details: error.stack
      });
    }
  });
});

// Socket.IO Events - Geliştirilmiş
io.on('connection', (socket) => {
  console.log('🔌 Yeni bağlantı:', {
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    totalConnections: io.engine.clientsCount,
    transport: socket.conn.transport.name
  });

  // Bağlantı durumunu test et - iyileştirilmiş
  socket.emit('connectionTest', { 
    message: 'Bağlantı başarılı', 
    timestamp: Date.now(),
    serverId: socket.id,
    serverStatus: 'OK',
    serverUptime: Math.floor(process.uptime()),
    totalPlayers: Object.keys(players).length
  });

  // Bağlantı kalitesi takibi
  socket.on('ping', (data) => {
    console.log('🏓 Ping alındı:', data);
    socket.emit('pong', { 
      ...data, 
      serverTime: Date.now(),
      serverStatus: 'OK',
      latency: Date.now() - data.timestamp
    });
  });

  // Host room oluşturma
  socket.on('createRoom', (callback) => {
    const roomId = generateRoomId();
    const room = createRoom(roomId, socket.id);
    socket.join(roomId);
    socket.roomId = roomId; // Socket'e room ID'yi ekle
    console.log(`🏠 Host ${socket.id} room ${roomId} oluşturdu ve katıldı`);
    
    if (callback && typeof callback === 'function') {
      callback({ roomId, success: true });
    } else {
      socket.emit('roomCreated', { roomId });
    }
  });

  // Oyuncu room'a katılma (roomId ile)
  socket.on('join', (data) => {
    let name, roomId;
    
    // Geriye dönük uyumluluk: string ise eski sistem, object ise yeni sistem
    if (typeof data === 'string') {
      name = data;
      roomId = null; // Eski sistem - global room
    } else {
      name = data.name;
      roomId = data.roomId;
    }
    
    console.log('👤 Katılım isteği:', { 
      name, 
      roomId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    // Room ID varsa, room'a katıl
    if (roomId) {
      const room = getRoom(roomId);
      if (!room) {
        socket.emit('joinError', { message: 'Geçersiz oyun kodu! Lütfen doğru kodu girin.' });
        return;
      }
      socket.join(roomId);
      socket.roomId = roomId;
      console.log(`🏠 Oyuncu ${socket.id} room ${roomId}'ye katıldı`);
    }
    
    if (name && typeof name === 'string' && name.trim()) {
      // Room ID'ye göre player objesi seç
      const room = roomId ? getRoom(roomId) : null;
      const playersObj = room ? room.players : players;
      const globalScoresObj = room ? room.globalScores : globalScores;
      
      // Türkçe karakterleri koruyarak büyük harfe çevir
      const playerName = name.trim()
        .replace(/ı/g, 'I')
        .replace(/i/g, 'İ')
        .replace(/ğ/g, 'Ğ')
        .replace(/ü/g, 'Ü')
        .replace(/ş/g, 'Ş')
        .replace(/ö/g, 'Ö')
        .replace(/ç/g, 'Ç')
        .toUpperCase();
      
      // KESIN ÇÖZÜM: Büyük küçük harf duyarsız kontrol
      const existingPlayer = Object.values(playersObj).find(p => 
        p.name.toLowerCase() === playerName.toLowerCase()
      );
      
      if (existingPlayer) {
        console.log('❌ Aynı isimde oyuncu mevcut (büyük küçük harf duyarsız):', playerName, 'Mevcut:', existingPlayer.name);
        socket.emit('joinError', { 
          message: `"${existingPlayer.name}" isimli bir oyuncu zaten var! Lütfen farklı bir isim seçin.` 
        });
        return;
      }
      
      // Global puan kontrolü - oyuncu daha önce oynamış mı?
      const existingGlobalScore = globalScoresObj[playerName] || 0;
      console.log(`🔍 ${playerName} global puanı: ${existingGlobalScore}${roomId ? ` (Room: ${roomId})` : ''}`);
      
      // Socket ID kontrolü - eğer aynı socket ID'ye sahip oyuncu varsa, güncelle
      if (playersObj[socket.id]) {
        console.log('🔄 Mevcut oyuncu güncelleniyor:', socket.id, playersObj[socket.id].name);
        // Mevcut oyuncuyu güncelle
        playersObj[socket.id].name = playerName;
        playersObj[socket.id].score = existingGlobalScore; // Global puandan devam et
        playersObj[socket.id].lastActivity = Date.now();
        playersObj[socket.id].isDisconnected = false;
        playersObj[socket.id].disconnectedAt = undefined;
        console.log(`✅ ${playerName} oyuncu bilgileri güncellendi (${socket.id}) - Puan: ${existingGlobalScore}`);
      } else {
        // Yeni oyuncu ekle
        playersObj[socket.id] = { 
          name: playerName, 
          score: existingGlobalScore, // Global puandan devam et
          joinTime: Date.now(),
          socketId: socket.id,
          lastActivity: Date.now(),
          isDisconnected: false
        };
        console.log(`✅ ${playerName} yeni oyuncu olarak eklendi (${socket.id}) - Puan: ${existingGlobalScore}`);
      }
      
      console.log(`✅ ${playerName} oyuna katıldı (${socket.id})${roomId ? ` Room: ${roomId}` : ''}`);
      console.log('👥 Aktif oyuncular:', Object.keys(playersObj).length);
      console.log('👥 Oyuncu detayları:', playersObj[socket.id]);
      
      // Katılım onayı gönder
      const gameStateObj = room ? room.gameState : gameState;
      socket.emit('joinConfirmed', { 
        name: playerName, 
        playerId: socket.id,
        totalPlayers: Object.keys(playersObj).length,
        message: 'Başarıyla katıldınız!',
        gameState: {
          isActive: gameStateObj.isActive,
          totalQuestions: gameStateObj.totalQuestions
        }
      });
      
      // Tüm host'lara oyuncu katıldığını bildir (room'a özel)
      if (roomId) {
        io.to(roomId).emit('playerJoined', playerName);
      } else {
        socket.broadcast.emit('playerJoined', playerName);
      }
      
      // Mevcut tüm katılımcıları host'a gönder (room'a özel)
      const participantNames = Object.values(playersObj).map(p => p.name);
      console.log('📤 allParticipants gönderiliyor:', participantNames);
      if (roomId) {
        io.to(roomId).emit('allParticipants', participantNames);
      } else {
        io.emit('allParticipants', participantNames);
      }
      
      // Player count güncelleme (room'a özel)
      if (roomId) {
        updatePlayerCountForRoom(roomId);
      } else {
        updatePlayerCount();
      }
    } else {
      console.log('❌ Geçersiz isim:', name);
      socket.emit('joinError', { message: 'Geçerli bir isim girin' });
    }
  });

  socket.on('answer', (value) => {
    // Room ID'yi al
    const roomId = socket.roomId;
    const room = roomId ? getRoom(roomId) : null;
    const playersObj = room ? room.players : players;
    const answersObj = room ? room.answers : answers;
    const gameStateObj = room ? room.gameState : gameState;
    
    console.log('📝 Cevap alındı:', { 
      player: playersObj[socket.id]?.name || 'Bilinmeyen',
      value, 
      socketId: socket.id,
      roomId: roomId || 'global',
      timestamp: new Date().toISOString()
    });
    
    // Cevap değeri kontrolü
    if (value === null || value === undefined || value === '') {
      console.log('❌ Geçersiz cevap değeri:', value);
      socket.emit('answerError', { message: 'Geçerli bir cevap girin' });
      return;
    }
    
    // Oyuncu yoksa hata ver
    if (!playersObj[socket.id]) {
      console.log('❌ Geçersiz cevap veya oyuncu bulunamadı');
      socket.emit('answerError', { 
        message: 'Oyuncu bulunamadı! Lütfen oyuna tekrar katılın.' 
      });
      return;
    }
    
    // Aynı oyuncu daha önce cevap vermiş mi kontrol et
    if (answersObj[socket.id]) {
      console.log('⚠️ Oyuncu zaten cevap vermiş:', playersObj[socket.id].name);
      socket.emit('answerError', { 
        message: 'Zaten cevap verdiniz! Tekrar cevap veremezsiniz.' 
      });
      return;
    }
    
    // Zamanlayıcı doğrulaması - KRİTİK DÜZELTME
    const currentTime = Date.now();
    const questionDuration = 30000; // 30 saniye
    
    if (!gameStateObj.isActive) {
      console.log('❌ Aktif soru yok, cevap reddediliyor');
      socket.emit('answerError', { 
        message: 'Şu anda aktif bir soru yok. Lütfen soru başladıktan sonra cevap verin.' 
      });
      return;
    }
    
    if (gameStateObj.questionStartTime && (currentTime - gameStateObj.questionStartTime > questionDuration)) {
      console.log('❌ Süre doldu, geç cevap reddediliyor');
      socket.emit('answerError', { 
        message: 'Süre doldu! Geç cevap kabul edilmez. Lütfen bir sonraki soruyu bekleyin.' 
      });
      return;
    }
    
    if (playersObj[socket.id] && value !== null && value !== undefined) {
      // Oyuncu aktivitesini güncelle
      playersObj[socket.id].lastActivity = Date.now();
      
      // Cevabı float olarak sakla
      const numericValue = parseFloat(value);
      answersObj[socket.id] = {
        value: numericValue,
        timestamp: currentTime,
        playerName: playersObj[socket.id].name,
        playerId: socket.id
      };
      
      // Cevap verme süresini hesapla (saniye cinsinden)
      const answerTime = gameStateObj.questionStartTime ? 
        Math.round((currentTime - gameStateObj.questionStartTime) / 1000) : 0;
      
      
      // Tüm oyunculara (cevap veren dahil) bu oyuncunun cevap verdiğini bildir (room'a özel)
      if (roomId) {
        io.to(roomId).emit('playerAnswered', {
          playerName: playersObj[socket.id].name,
          timestamp: currentTime,
          answerTime: answerTime
        });
      } else {
        io.emit('playerAnswered', {
          playerName: playersObj[socket.id].name,
          timestamp: currentTime,
          answerTime: answerTime
        });
      }
      
      console.log(`✅ ${playersObj[socket.id].name} cevap verdi: ${numericValue}${roomId ? ` (Room: ${roomId})` : ''}`);
      console.log('📊 Toplam cevap:', Object.keys(answersObj).length);

      // Cevap veren/Toplam oyuncu sayısını anlık güncelle (room'a özel)
      if (roomId) {
        updatePlayerCountForRoom(roomId);
      } else {
        updatePlayerCount();
      }
      
      // Tüm oyuncular cevap verdi mi kontrol et
      const totalPlayers = Object.keys(playersObj).length;
      const totalAnswers = Object.keys(answersObj).length;
      console.log(`📊 Cevap durumu: ${totalAnswers}/${totalPlayers}`);
      
      if (totalAnswers === totalPlayers && totalPlayers > 0) {
        console.log('🎉 Tüm oyuncular cevap verdi! Sonuç ekranına geçiliyor...');
        
        // KRİTİK KONTROL: Doğru cevap set edilmiş mi?
        const currentAnswerCheck = room ? room.currentAnswer : currentAnswer;
        if (currentAnswerCheck === null || currentAnswerCheck === undefined) {
          console.error('❌ HATA: Tüm oyuncular cevap verdi ama doğru cevap henüz set edilmemiş!');
          console.error('❌ roomId:', roomId);
          console.error('❌ room:', room ? 'var' : 'yok');
          console.error('❌ room.currentAnswer:', room?.currentAnswer);
          console.error('❌ global currentAnswer:', currentAnswer);
          return; // Sonuçları gösterme, timer dolsun
        }
        
        // Kısa bir gecikme ile sonuçları göster
        setTimeout(() => {
          // Timer'ı durdur (room-aware)
          const timerToStop = room ? room.currentTimerInterval : currentTimerInterval;
          if (timerToStop) {
            clearInterval(timerToStop);
            if (room) {
              room.currentTimerInterval = null;
            } else {
              currentTimerInterval = null;
            }
          }
          
          // Sonuçları hesapla ve gönder
          console.log(`📊 Tüm oyuncular cevap verdi, sonuçlar hesaplanıyor...${roomId ? ` (Room: ${roomId})` : ''}`);
          const result = calculateResults(roomId);
          
          if (roomId) {
            io.to(roomId).emit('showResult', result);
          } else {
            io.emit('showResult', result);
          }
          console.log('📊 Sonuçlar gönderildi:', result);
          
          if (room) {
            room.gameState.isActive = false;
          } else {
            gameState.isActive = false;
          }
        }, 1000); // 1 saniye bekle
      }
      
      // Cevap doğruluğunu kontrol et (room-aware)
      const currentAnswerToCheck = room ? room.currentAnswer : currentAnswer;
      const globalScoresObj = room ? room.globalScores : globalScores;
      
      if (typeof numericValue === 'number' && typeof currentAnswerToCheck === 'number') {
        const diff = Math.abs(numericValue - currentAnswerToCheck);
        console.log(`🔍 Cevap doğrulama: ${numericValue} vs ${currentAnswerToCheck} (fark: ${diff})${roomId ? ` (Room: ${roomId})` : ''}`);
        
        // Eğer cevap doğruysa anında puan ver
        if (diff < 0.001) { // Küçük bir epsilon değeri ile karşılaştırma
          playersObj[socket.id].score += 10;
          globalScoresObj[playersObj[socket.id].name] = (globalScoresObj[playersObj[socket.id].name] || 0) + 10;
          console.log(`🏆 ${playersObj[socket.id].name} anında 10 puan kazandı! (Toplam: ${playersObj[socket.id].score}, Global: ${globalScoresObj[playersObj[socket.id].name]})`);
          
          if (roomId) {
            io.to(roomId).emit('correctAnswer', {
              playerName: playersObj[socket.id].name,
              score: playersObj[socket.id].score,
              message: 'Doğru cevap verildi!'
            });
          } else {
            io.emit('correctAnswer', {
              playerName: playersObj[socket.id].name,
              score: playersObj[socket.id].score,
              message: 'Doğru cevap verildi!'
            });
          }
        }
      }
      
      // Cevap onayı gönder - kalan süre bilgisi ile
      const timeRemaining = gameState.questionStartTime ? 
        Math.max(0, questionDuration - (currentTime - gameState.questionStartTime)) : 0;
      
      socket.emit('answerConfirmed', {
        value: answerValue,
        timestamp: currentTime,
        message: 'Cevabınız alındı!',
        timeRemaining: Math.round(timeRemaining / 1000), // saniye cinsinden
        totalAnswers: Object.keys(answers).length,
        totalPlayers: Object.keys(players).length
      });
      
      updatePlayerCount();
    } else {
      console.log('❌ Geçersiz cevap veya oyuncu bulunamadı');
      socket.emit('answerError', { message: 'Cevap gönderilemedi' });
    }
  });

  socket.on('startQuestion', (questionObj) => {
    // Room ID'yi al
    const roomId = socket.roomId;
    const room = roomId ? getRoom(roomId) : null;
    
    console.log('🎯 Soru başlatıldı:', {
      question: questionObj?.question?.substring(0, 50),
      answer: questionObj?.answer,
      roomId: roomId || 'global',
      socketId: socket.id,
      roomFound: !!room,
      timestamp: new Date().toISOString()
    });
    
    // KRİTİK DEBUG
    if (roomId && !room) {
      console.error('❌ HATA: Room ID var ama room bulunamadı!', { roomId, socketId: socket.id });
      console.error('❌ Mevcut rooms:', Array.from(rooms.keys()));
      return;
    }
    
    if (questionObj && questionObj.answer) {
      // Room'a göre state seç
      if (room) {
        room.currentAnswer = parseFloat(questionObj.answer);
        room.answers = {};
        room.gameState.isActive = true;
        room.gameState.currentQuestion = questionObj;
        room.gameState.questionStartTime = Date.now();
        
        console.log(`✅ [${roomId}] Room currentAnswer SET EDİLDİ:`, room.currentAnswer);
        console.log(`✅ [${roomId}] Room gameState.isActive:`, room.gameState.isActive);
      } else {
        currentAnswer = parseFloat(questionObj.answer);
        answers = {};
        gameState.isActive = true;
        gameState.currentQuestion = questionObj;
        gameState.questionStartTime = Date.now();
        
        console.log('✅ [GLOBAL] currentAnswer SET EDİLDİ:', currentAnswer);
      }
      
      console.log(`📢 Yeni soru yayınlanıyor: ${questionObj.question}${roomId ? ` (Room: ${roomId})` : ''}`);
      console.log(`🎯 Doğru cevap: ${room ? room.currentAnswer : currentAnswer}`);
      
      // Soruyu room'a veya global'e yayınla
      if (roomId) {
        io.to(roomId).emit('newQuestion', questionObj);
        updatePlayerCountForRoom(roomId);
      } else {
        io.emit('newQuestion', questionObj);
        updatePlayerCount();
      }

      // Önceki timer varsa temizle
      const timerToUse = room ? room.currentTimerInterval : currentTimerInterval;
      if (timerToUse) {
        clearInterval(timerToUse);
        if (room) {
          room.currentTimerInterval = null;
        } else {
          currentTimerInterval = null;
        }
      }

      // Gerçek zamanlı süre güncellemeleri gönder - daha sık güncelleme
      let timeLeft = 30;
      const timerInterval = setInterval(() => {
        timeLeft--;
        
        if (roomId) {
          io.to(roomId).emit('timerUpdate', { timeLeft });
        } else {
          io.emit('timerUpdate', { timeLeft });
        }
        
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          if (room) {
            room.currentTimerInterval = null;
          } else {
            currentTimerInterval = null;
          }
          console.log(`⏰ Süre doldu, sonuçlar hesaplanıyor...${roomId ? ` (Room: ${roomId})` : ''}`);
          const result = calculateResults(roomId);
          
          if (roomId) {
            io.to(roomId).emit('showResult', result);
          } else {
            io.emit('showResult', result);
          }
          console.log('📊 Sonuçlar gönderildi:', result);
          
          if (room) {
            room.gameState.isActive = false;
          } else {
            gameState.isActive = false;
          }
        }
      }, 1000); // 1 saniye aralıklarla güncelle
      
      // Timer'ı kaydet
      if (room) {
        room.currentTimerInterval = timerInterval;
      } else {
        currentTimerInterval = timerInterval;
      }
    } else {
      console.log('❌ Geçersiz soru objesi:', questionObj);
    }
  });

  // Timer başlatma event'i
  socket.on('startTimer', (data) => {
    console.log('⏰ Timer başlatılıyor:', data);
    if (data.duration) {
      gameState.questionStartTime = Date.now();
    }
  });

  socket.on('disconnect', (reason) => {
    const roomId = socket.roomId;
    const room = roomId ? getRoom(roomId) : null;
    
    // Room-aware player management
    const playersObj = room ? room.players : players;
    const answersObj = room ? room.answers : answers;
    const globalScoresObj = room ? room.globalScores : globalScores;
    
    console.log('🔌 Bağlantı kesildi:', { 
      socketId: socket.id, 
      reason,
      roomId: roomId || 'global',
      player: playersObj[socket.id]?.name || 'Bilinmeyen',
      timestamp: new Date().toISOString()
    });
    
    // Oyuncu varsa puanını kaydet ve oyuncuyu sil
    if (playersObj[socket.id]) {
      const player = playersObj[socket.id];
      const playerName = player.name;
      const currentScore = player.score || 0;
      
      // Oyuncunun mevcut puanını globalScores'a kaydet
      globalScoresObj[playerName] = currentScore;
      console.log(`👋 [${roomId || 'GLOBAL'}] ${playerName} bağlantısı koptu - Puan kaydedildi: ${currentScore}, Oyuncu siliniyor`);
      
      // Oyuncuyu ve cevabını sil
      delete playersObj[socket.id];
      delete answersObj[socket.id];
      
      if (roomId) {
        // Room'a özgü bildirimler
        io.to(roomId).emit('playerLeft', playerName);
        io.to(roomId).emit('allParticipants', Object.values(playersObj).map(p => p.name));
        updatePlayerCountForRoom(roomId);
      } else {
        // Global bildirimler
        io.emit('playerLeft', playerName);
        io.emit('allParticipants', getActivePlayers().map(p => p.name));
        updatePlayerCount();
      }
    } else {
      // Oyuncu kaydı yoksa sadece cevabını sil
      delete answersObj[socket.id];
    }
  });

  // Manuel oyuncu çıkışı (Ana Menü ile çıkış)
  socket.on('leave', (playerName) => {
    const roomId = socket.roomId;
    const room = roomId ? getRoom(roomId) : null;
    
    console.log('👋 Manuel oyuncu çıkışı:', { 
      playerName,
      socketId: socket.id,
      roomId: roomId || 'global',
      timestamp: new Date().toISOString()
    });
    
    // Room-aware player management
    const playersObj = room ? room.players : players;
    const globalScoresObj = room ? room.globalScores : globalScores;
    
    if (playersObj[socket.id]) {
      const actualPlayerName = playersObj[socket.id].name;
      const currentScore = playersObj[socket.id].score || 0;
      
      // Oyuncunun mevcut puanını globalScores'a kaydet
      globalScoresObj[actualPlayerName] = currentScore;
      console.log(`👋 [${roomId || 'GLOBAL'}] ${actualPlayerName} manuel olarak ayrıldı - Puan kaydedildi: ${currentScore}`);
      
      delete playersObj[socket.id];
      
      if (roomId) {
        // Room'a özgü bildirimler
        io.to(roomId).emit('playerLeft', actualPlayerName);
        io.to(roomId).emit('allParticipants', Object.values(playersObj).map(p => p.name));
        updatePlayerCountForRoom(roomId);
      } else {
        // Global bildirimler
        socket.broadcast.emit('playerLeft', actualPlayerName);
        io.emit('allParticipants', Object.values(playersObj).map(p => p.name));
        updatePlayerCount();
      }
    }
  });

  socket.on('addQuestion', async ({ question, answer }, callback) => {
    console.log('➕ Yeni soru ekleme isteği:', { 
      question: question?.substring(0, 50), 
      answer,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!question || !answer) {
        return callback({ success: false, message: 'Soru ve cevap gerekli!' });
      }

      const questionText = question.trim();
      const answerText = answer.trim();

      if (!questionText || !answerText) {
        return callback({ success: false, message: 'Soru ve cevap boş olamaz!' });
      }

      // Veritabanına ekle
      const newQ = await addQuestion(questionText, answerText);
      
      // Memory'deki listeyi de güncelle
      questions = await getAllQuestions();
      gameState.totalQuestions = questions.length;
      
      console.log('✅ Yeni soru veritabanına eklendi:', {
        question: newQ.question.substring(0, 50),
        totalQuestions: questions.length
      });
      
      // questions.json dosyasına da yaz (backup/fallback için)
      try {
        const questionsPath = path.join(__dirname, '../data/questions.json');
        await fs.writeFile(questionsPath, JSON.stringify(questions, null, 2), 'utf-8');
        console.log('💾 questions.json dosyası güncellendi');
      } catch (fileError) {
        console.error('⚠️ questions.json yazma hatası:', fileError);
        // Dosya yazma hatası olsa bile devam et, çünkü veritabanına eklendi
      }
      
      const response = { 
        success: true, 
        message: 'Soru başarıyla eklendi!',
        totalQuestions: questions.length
      };
      console.log('📤 Callback gönderiliyor:', response);
      callback(response);
    } catch (error) {
      console.error('❌ Soru ekleme hatası:', error);
      callback({ 
        success: false, 
        message: error.message || 'Soru eklenirken bir hata oluştu!'
      });
    }
  });

  socket.on('showScores', () => {
    const scores = {};
    for (const id in players) {
      scores[players[id].name] = players[id].score;
    }
    console.log('🏆 Skorlar istendi:', scores);
    console.log('🌍 Global skorlar:', globalScores);
    io.emit('updateScores', scores);
  });

  socket.on('endGame', () => {
    // Room ID'yi al
    const roomId = socket.roomId;
    const room = roomId ? getRoom(roomId) : null;
    
    // Room'a göre state seç
    const playersObj = room ? room.players : players;
    const globalScoresObj = room ? room.globalScores : globalScores;
    const gameStateObj = room ? room.gameState : gameState;
    
    console.log(`🏁 Oyun bitirildi${roomId ? ` (Room: ${roomId})` : ' (Global)'}`);
    console.log(`📊 Aktif oyuncu sayısı: ${Object.keys(playersObj).length}`);
    console.log(`📊 Global skorlar:`, globalScoresObj);
    
    // Global puanları kullan ve aktif olan tüm oyuncuları da dahil et
    const finalScores = { ...globalScoresObj };
    
    // Aktif oyuncuları da ekle (eğer henüz skor almamışlarsa 0 puan ile)
    Object.values(playersObj).forEach(player => {
      const playerName = player.name;
      if (!(playerName in finalScores)) {
        finalScores[playerName] = 0;
        console.log(`➕ Aktif oyuncu ${playerName} final sıralamasına 0 puan ile eklendi`);
      }
    });
    
    console.log('🏁 Final skorları (Global + Aktif oyuncular):', finalScores);
    
    // Room'a veya global'e emit et
    if (roomId) {
      io.to(roomId).emit('gameEnded', finalScores);
    } else {
      io.emit('gameEnded', finalScores);
    }
    
    // Oyun verilerini sıfırla (room-aware)
    if (room) {
      room.answers = {};
      room.currentAnswer = null;
      room.gameState.isActive = false;
      room.gameState.currentQuestion = null;
      room.gameState.questionStartTime = null;
      room.gameState.currentQuestionIndex = 0;
    } else {
      players = {};
      answers = {};
      currentAnswer = null;
      gameState = {
        isActive: false,
        currentQuestion: null,
        questionStartTime: null,
        totalQuestions: questions.length,
        currentQuestionIndex: 0
      };
    }
  });

  socket.on('startNewGame', () => {
    // Room ID'yi al
    const roomId = socket.roomId;
    const room = roomId ? getRoom(roomId) : null;
    
    console.log(`🆕 Yeni oyun başlatılıyor${roomId ? ` (Room: ${roomId})` : ' (Global)'} - tüm veriler temizleniyor...`);
    
    // Room'a veya global'e gameReset gönder
    if (roomId) {
      io.to(roomId).emit('gameReset', { message: 'Yeni oyun başlatıldı, lütfen tekrar katılın' });
    } else {
      io.emit('gameReset', { message: 'Yeni oyun başlatıldı, lütfen tekrar katılın' });
    }
    
    // Room-aware temizlik
    if (room) {
      room.players = {};
      room.globalScores = {};
      room.answers = {};
      room.currentAnswer = null;
      room.gameState = {
        isActive: false,
        currentQuestion: null,
        questionStartTime: null,
        totalQuestions: questions.length,
        currentQuestionIndex: 0
      };
      
      // Room'a boş oyuncu listesi gönder
      io.to(roomId).emit('allParticipants', []);
      io.to(roomId).emit('playerCount', { total: 0, answered: 0 });
    } else {
      // Global temizlik
      players = {};
      globalScores = {};
      answers = {};
      currentAnswer = null;
      gameState = {
        isActive: false,
        currentQuestion: null,
        questionStartTime: null,
        totalQuestions: questions.length,
        currentQuestionIndex: 0
      };
      
      // Tüm client'lara boş oyuncu listesi gönder
      io.emit('allParticipants', []);
      io.emit('playerCount', { total: 0, answered: 0 });
    }
    
    console.log('✅ Yeni oyun için tüm veriler temizlendi');
  });

  socket.on('restartGame', () => {
    // Room ID'yi al
    const roomId = socket.roomId;
    const room = roomId ? getRoom(roomId) : null;
    
    console.log(`🔄 Oyun yeniden başlatılıyor${roomId ? ` (Room: ${roomId})` : ' (Global)'} - puanlar sıfırlanıyor...`);
    
    // Room'a veya global'e gameReset gönder
    if (roomId) {
      io.to(roomId).emit('gameReset', { message: 'Oyun yeniden başlatıldı, lütfen tekrar katılın' });
    } else {
      io.emit('gameReset', { message: 'Oyun yeniden başlatıldı, lütfen tekrar katılın' });
    }
    
    // Room-aware temizlik
    if (room) {
      room.players = {};
      room.globalScores = {};
      room.answers = {};
      room.currentAnswer = null;
      room.gameState = {
        isActive: false,
        currentQuestion: null,
        questionStartTime: null,
        totalQuestions: questions.length,
        currentQuestionIndex: 0
      };
      
      // Room'a boş oyuncu listesi gönder
      io.to(roomId).emit('allParticipants', []);
      io.to(roomId).emit('playerCount', { total: 0, answered: 0 });
    } else {
      // Global temizlik
      players = {};
      globalScores = {};
      answers = {};
      currentAnswer = null;
      gameState = {
        isActive: false,
        currentQuestion: null,
        questionStartTime: null,
        totalQuestions: questions.length,
        currentQuestionIndex: 0
      };
      
      // Tüm client'lara boş oyuncu listesi gönder
      io.emit('allParticipants', []);
      io.emit('playerCount', { total: 0, answered: 0 });
    }
    
    console.log('✅ Oyun yeniden başlatıldı, tüm puanlar temizlendi');
  });

  // TV Host için startGame event'i
  socket.on('startGame', () => {
    console.log('📺 TV Host oyunu başlattı');
    
    // Oyun durumunu aktif yap
    gameState.isActive = true;
    gameState.totalQuestions = questions.length;
    gameState.currentQuestionIndex = 0;
    
    // Cevapları temizle
    answers = {};
    
    // Tüm oyunculara oyun başladığını bildir
    io.emit('gameStarted');
    
    console.log('✅ TV Oyun başlatıldı');
  });

  // Ping-pong mekanizması
  socket.on('ping', (data) => {
    console.log('🏓 Ping alındı:', data);
    socket.emit('pong', { 
      ...data, 
      serverTime: Date.now(),
      serverStatus: 'OK',
      playersCount: Object.keys(players).length
    });
  });

  // Mevcut katılımcıları iste (sadece host'lar için)
  socket.on('getParticipants', () => {
    console.log('📋 Mevcut katılımcılar istendi:', getActivePlayers().length);
    console.log('👥 Aktif oyuncular:', getActivePlayers().map(p => p.name));
    const participantNames = getActivePlayers().map(p => p.name);
    console.log('📤 allParticipants gönderiliyor:', participantNames);
    socket.emit('allParticipants', participantNames);
    
    // Oyuncu sayısını da gönder
    const totalPlayers = Object.keys(players).length;
    const answeredPlayers = Object.keys(answers).length;
    socket.emit('playerCount', { total: totalPlayers, answered: answeredPlayers });
    console.log('📤 playerCount gönderiliyor:', { total: totalPlayers, answered: answeredPlayers });
  });

  // Hata yakalama
  socket.on('error', (error) => {
    console.error('❌ Socket hatası:', {
      error: error.message || error,
      socketId: socket.id,
      player: players[socket.id]?.name || 'Bilinmeyen',
      timestamp: new Date().toISOString()
    });
  });
});

function getActivePlayers() {
  return Object.values(players); // Tüm oyuncuları döndür, isDisconnected kontrolü yok
}

function updatePlayerCount() {
  const count = {
    total: getActivePlayers().length,
    answered: Object.keys(answers).length,
    timestamp: Date.now()
  };
  console.log('📊 Oyuncu durumu güncellendi:', count);
  io.emit('playerCount', count);
}

function updatePlayerCountForRoom(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  
  const activePlayersInRoom = Object.values(room.players).filter(p => !p.isDisconnected);
  const count = {
    total: activePlayersInRoom.length,
    answered: Object.keys(room.answers).length,
    timestamp: Date.now()
  };
  console.log(`📊 Room ${roomId} oyuncu durumu güncellendi:`, count);
  io.to(roomId).emit('playerCount', count);
}

function calculateResults(roomId) {
  // Room'dan state'i al (null ise global state kullan)
  const room = roomId ? getRoom(roomId) : null;
  
  // Room varsa room state, yoksa global state kullan
  const answersObj = room ? (room.answers || {}) : answers;
  const correctAnswerValue = room ? room.currentAnswer : currentAnswer;
  const playersObjForCalc = room ? (room.players || {}) : players;
  const globalScoresObjForCalc = room ? (room.globalScores || {}) : globalScores;
  
  if (room) {
    console.log(`🧮 [${roomId}] Room-based sonuçlar hesaplanıyor...`);
  } else {
    console.log('🧮 [GLOBAL] Global sonuçlar hesaplanıyor...');
  }
  
  // KRİTİK KONTROL: Doğru cevap var mı?
  if (correctAnswerValue === null || correctAnswerValue === undefined) {
    console.error('❌ HATA: Doğru cevap bulunamadı!', { roomId, room: !!room, correctAnswerValue });
    console.error('❌ Room currentAnswer:', room?.currentAnswer);
    console.error('❌ Global currentAnswer:', currentAnswer);
    return { 
      correct: 0, 
      closest: 'Hata: Doğru cevap yok', 
      winners: [], 
      allAnswers: [],
      totalAnswers: 0,
      totalPlayers: 0
    };
  }
  
  console.log('✅ Doğru cevap bulundu:', correctAnswerValue);

  let closest = null;
  let minDiff = Infinity;
  let winners = [];
  let allWinnersByAnswer = {}; // Aynı cevabı veren tüm oyuncular

  console.log(`🎯 Doğru cevap:`, correctAnswerValue);
  console.log(`📝 Gelen cevaplar:`, Object.keys(answersObj).length);

  // Tüm cevapları grupla (aynı cevabı veren oyuncuları birleştir)
  for (const [id, answerObj] of Object.entries(answersObj)) {
    const num = parseFloat(answerObj.value);
    if (!isNaN(num)) {
      const diff = Math.abs(num - correctAnswerValue);
      console.log(`🔍 ${answerObj.playerName}: ${num} (fark: ${diff})`);
      
      // Aynı cevabı veren oyuncuları grupla
      if (!allWinnersByAnswer[num]) {
        allWinnersByAnswer[num] = {
          players: [],
          diff: diff
        };
      }
      allWinnersByAnswer[num].players.push(answerObj.playerName);
      
      // En yakın cevabı bul
      if (diff < minDiff) {
        minDiff = diff;
        closest = num;
      }
    }
  }

  // En yakın cevabı veren tüm oyuncuları bul
  if (closest !== null) {
    // Sadece en yakın cevabı değil, aynı mesafedeki TÜM cevapları bul
    winners = [];
    for (const [answer, data] of Object.entries(allWinnersByAnswer)) {
      if (data.diff === minDiff) {
        winners = winners.concat(data.players);
        console.log(`🏆 Eşit mesafedeki cevap: ${answer} (mesafe: ${data.diff}), oyuncular:`, data.players);
      }
    }
    console.log('🏆 Tüm kazananlar listesi:', winners);
    console.log('🏆 En yakın mesafe:', minDiff);
  }

  // Puanları güncelle (en yakın cevabı veren TÜM oyunculara puan ver)
  if (winners.length > 0) {
    for (const [id, answerObj] of Object.entries(answersObj)) {
      const num = parseFloat(answerObj.value);
      const diff = Math.abs(num - correctAnswerValue);
      // En yakın mesafedeki tüm oyunculara puan ver
      if (diff === minDiff) {
        // Mevcut oyuncuya puan ver
        if (playersObjForCalc[id]) {
          playersObjForCalc[id].score += 10;
          console.log(`🏆 ${playersObjForCalc[id].name} 10 puan kazandı! (Cevap: ${num}, Mesafe: ${diff}, Toplam: ${playersObjForCalc[id].score})`);
        }
        
        // Global puanı her zaman güncelle (oyuncu çıksa bile)
        globalScoresObjForCalc[answerObj.playerName] = (globalScoresObjForCalc[answerObj.playerName] || 0) + 10;
        console.log(`🌍 ${answerObj.playerName} global puanı güncellendi: ${globalScoresObjForCalc[answerObj.playerName]}`);
      }
    }
  }

  // Kazanan isimlerini birleştir
  const winnerNames = winners.length > 0 ? winners.join(', ') : 'Kimse';
  
  // Doğru cevap veren varsa "Doğru", yoksa "En yakın" yaz
  let winnerDisplay;
  if (winners.length > 0) {
    if (minDiff === 0) {
      // Doğru cevap veren var
      winnerDisplay = winners.length > 1 ? 
        `${winnerNames} (Doğru)` :
        `${winnerNames} (Doğru)`;
    } else {
      // En yakın cevap veren var
      winnerDisplay = winners.length > 1 ? 
        `${winnerNames} (En yakın mesafe: ${minDiff})` :
        `${winnerNames} (En yakın)`;
    }
  } else {
    winnerDisplay = 'Kimse (Cevap yok)';
  }

  // Tüm cevapları sırala (en yakından en uzağa) + cevap vermeyen oyuncular
  const allAnswers = Object.values(answersObj).map(answerObj => ({
    playerName: answerObj.playerName,
    answer: parseFloat(answerObj.value),
    difference: Math.abs(parseFloat(answerObj.value) - correctAnswerValue),
    isCorrect: Math.abs(parseFloat(answerObj.value) - correctAnswerValue) === 0,
    hasAnswered: true
  })).sort((a, b) => a.difference - b.difference);

  // Cevap vermeyen oyuncuları ekle
  const answeredPlayerNames = Object.values(answersObj).map(a => a.playerName);
  const allPlayerNames = Object.values(playersObjForCalc).map(p => p.name);
  const noAnswerPlayers = allPlayerNames.filter(name => !answeredPlayerNames.includes(name));
  
  // Cevap vermeyen oyuncuları listeye ekle (en altta)
  noAnswerPlayers.forEach(playerName => {
    allAnswers.push({
      playerName: playerName,
      answer: null,
      difference: Infinity, // En altta görünmesi için
      isCorrect: false,
      hasAnswered: false
    });
  });

  const result = {
    correct: correctAnswerValue,
    closest: winnerDisplay,
    winners: winners, // Tüm kazananları ayrı olarak gönder
    allAnswers: allAnswers, // Tüm cevapları sıralı olarak gönder
    totalAnswers: Object.keys(answersObj).length,
    totalPlayers: Object.keys(playersObjForCalc).length
  };

  console.log('📊 Final sonuç:', result);
  console.log('🏆 Kazananlar:', winners);
  console.log('🏆 Winners array length:', winners.length);
  console.log('🏆 All answers:', allAnswers);
  console.log('🏆 Result winners field:', result.winners);
  return result;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Express error:', error);
  res.status(500).json({ 
    error: 'Sunucu hatası: ' + (error.message || 'Bilinmeyen hata'),
    timestamp: new Date().toISOString(),
    success: false
  });
});

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Sayfa bulunamadı:', req.url);
  res.status(404).json({ 
    error: 'Sayfa bulunamadı',
    url: req.url,
    timestamp: new Date().toISOString(),
    availableEndpoints: ['/', '/health', '/test', '/questions', '/upload']
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Sunucu kapatılıyor...');
  server.close(() => {
    console.log('✅ Sunucu kapatıldı');
  });
});

process.on('uncaughtException', (error) => {
  console.error('💥 Yakalanmamış hata:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚫 İşlenmemiş promise reddi:', reason);
});

// Production için SPA fallback route
if (NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Sunucuyu başlat
initializeServer().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 ================================');
    console.log('🎮 Quiz Sunucusu Başlatıldı!');
    console.log('🚀 ================================');
    console.log(`🌐 Ana Sunucu: http://localhost:${PORT}`);
    if (NODE_ENV === 'development') {
      console.log(`📱 Yarışmacı: http://localhost:5173/#player`);
      console.log(`🖥️  TV Ana Sayfa: http://localhost:5173`);
    }
    console.log(`📊 Sistem Durumu: http://localhost:${PORT}/api/health`);
    console.log(`📁 Soru Sayısı: ${questions.length}`);
    console.log('🚀 ================================\n');
    
    // Server başladığında tüm client'lara oyuncu listesinin temizlendiğini bildir
    io.emit('allParticipants', []);
    console.log('📤 Server başladı, tüm client\'lara boş oyuncu listesi gönderildi');
  });
}).catch(err => {
  console.error('❌ Sunucu başlatılamadı:', err);
  process.exit(1);
});