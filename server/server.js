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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://your-domain.com", "https://www.your-domain.com"] 
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
let players = {};
let currentAnswer = null;
let answers = {};
let globalScores = {}; // Global puan sistemi - oyuncular çıksa bile puanları korunur
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
  
  // Soruları yükle
  try {
    const questionsPath = path.join(__dirname, '../data/questions.json');
    console.log('📁 Soru dosyası yolu:', questionsPath);
    
    if (fsSync.existsSync(questionsPath)) {
      const raw = await fs.readFile(questionsPath, 'utf-8');
      questions = JSON.parse(raw);
      gameState.totalQuestions = questions.length;
      console.log(`✅ ${questions.length} soru yüklendi`);
    } else {
      console.log('⚠️ Soru dosyası bulunamadı:', questionsPath);
      questions = [];
      gameState.totalQuestions = 0;
    }
  } catch (err) {
    console.error('❌ Soru yükleme hatası:', err);
    questions = [];
    gameState.totalQuestions = 0;
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
app.delete('/api/delete-all-questions', (req, res) => {
  console.log('🗑️ Tüm soruları silme isteği alındı');
  
  const { username } = req.body;
  
  // Basit doğrulama
  if (!username) {
    return res.status(400).json({ 
      success: false, 
      message: 'Kullanıcı adı gerekli.' 
    });
  }
  
  // Soruları temizle
  questions = [];
  
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
  
  console.log(`🗑️ ${username} kullanıcısı tüm soruları sildi`);
  
  res.json({ 
    success: true, 
    message: 'Tüm sorular başarıyla silindi!',
    deletedCount: questions.length
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

      // Mevcut soruları yükle
      let existing = [];
      try {
        const raw = await fs.readFile('data/questions.json', 'utf-8');
        existing = JSON.parse(raw);
      } catch (err) {
        console.log('📝 Yeni soru dosyası oluşturuluyor...');
        existing = [];
      }

      const merged = [...existing];
      let addedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      // Array formatında gelen veriyi işle
      data.forEach((row, index) => {
        try {
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
              // Duplicate kontrolünü kaldır - tüm soruları ekle
              merged.push({
                question: questionStr,
                answer: answerStr
              });
              addedCount++;
              console.log(`✅ Soru eklendi: ${questionStr.substring(0, 50)}...`);
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

      // Dosyayı kaydet
      await fs.writeFile('data/questions.json', JSON.stringify(merged, null, 2), 'utf-8');
      questions = merged;
      gameState.totalQuestions = questions.length;

      console.log(`✅ İşlem tamamlandı: ${addedCount} eklendi, ${skippedCount} atlandı, ${errorCount} hata`);

      // Geçici dosyayı sil
      try {
        await fs.unlink(filePath);
        console.log('🗑️ Geçici dosya silindi');
      } catch (unlinkErr) {
        console.error('⚠️ Geçici dosya silinemedi:', unlinkErr);
      }

      const message = `Dosya başarıyla işlendi! ${addedCount} yeni soru eklendi${skippedCount > 0 ? `, ${skippedCount} soru atlandı` : ''}${errorCount > 0 ? `, ${errorCount} hata` : ''}. Toplam: ${merged.length} soru.`;

      res.json({ 
        message,
        added: addedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: merged.length,
        success: true,
        details: {
          originalRows: data.length,
          processedSuccessfully: addedCount + skippedCount,
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

  socket.on('join', (name) => {
    console.log('👤 Katılım isteği:', { 
      name, 
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    if (name && typeof name === 'string' && name.trim()) {
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
      const existingPlayer = Object.values(players).find(p => 
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
      const existingGlobalScore = globalScores[playerName] || 0;
      console.log(`🔍 ${playerName} global puanı: ${existingGlobalScore}`);
      
      // Socket ID kontrolü - eğer aynı socket ID'ye sahip oyuncu varsa, güncelle
      if (players[socket.id]) {
        console.log('🔄 Mevcut oyuncu güncelleniyor:', socket.id, players[socket.id].name);
        // Mevcut oyuncuyu güncelle
        players[socket.id].name = playerName;
        players[socket.id].score = existingGlobalScore; // Global puandan devam et
        players[socket.id].lastActivity = Date.now();
        console.log(`✅ ${playerName} oyuncu bilgileri güncellendi (${socket.id}) - Puan: ${existingGlobalScore}`);
      } else {
        // Yeni oyuncu ekle
        players[socket.id] = { 
          name: playerName, 
          score: existingGlobalScore, // Global puandan devam et
          joinTime: Date.now(),
          socketId: socket.id,
          lastActivity: Date.now()
        };
        console.log(`✅ ${playerName} yeni oyuncu olarak eklendi (${socket.id}) - Puan: ${existingGlobalScore}`);
      }
      
      console.log(`✅ ${playerName} oyuna katıldı (${socket.id})`);
      console.log('👥 Aktif oyuncular:', Object.keys(players).length);
      console.log('👥 Oyuncu detayları:', players[socket.id]);
      
      // Katılım onayı gönder
      socket.emit('joinConfirmed', { 
        name: playerName, 
        playerId: socket.id,
        totalPlayers: Object.keys(players).length,
        message: 'Başarıyla katıldınız!',
        gameState: {
          isActive: gameState.isActive,
          totalQuestions: gameState.totalQuestions
        }
      });
      
      // Tüm host'lara oyuncu katıldığını bildir
      socket.broadcast.emit('playerJoined', playerName);
      
      // Mevcut tüm katılımcıları host'a gönder
      const participantNames = Object.values(players).map(p => p.name);
      console.log('📤 allParticipants gönderiliyor:', participantNames);
      io.emit('allParticipants', participantNames);
      
      updatePlayerCount();
    } else {
      console.log('❌ Geçersiz isim:', name);
      socket.emit('joinError', { message: 'Geçerli bir isim girin' });
    }
  });

  socket.on('answer', (value) => {
    console.log('📝 Cevap alındı:', { 
      player: players[socket.id]?.name || 'Bilinmeyen',
      value, 
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    // Cevap değeri kontrolü
    if (value === null || value === undefined || value === '') {
      console.log('❌ Geçersiz cevap değeri:', value);
      socket.emit('answerError', { message: 'Geçerli bir cevap girin' });
      return;
    }
    
    // Oyuncu yoksa hata ver
    if (!players[socket.id]) {
      console.log('❌ Geçersiz cevap veya oyuncu bulunamadı');
      socket.emit('answerError', { 
        message: 'Oyuncu bulunamadı! Lütfen oyuna tekrar katılın.' 
      });
      return;
    }
    
    // Zamanlayıcı doğrulaması - KRİTİK DÜZELTME
    const currentTime = Date.now();
    const questionDuration = 30000; // 30 saniye
    
    if (!gameState.isActive) {
      console.log('❌ Aktif soru yok, cevap reddediliyor');
      socket.emit('answerError', { 
        message: 'Şu anda aktif bir soru yok. Lütfen soru başladıktan sonra cevap verin.' 
      });
      return;
    }
    
    if (gameState.questionStartTime && (currentTime - gameState.questionStartTime > questionDuration)) {
      console.log('❌ Süre doldu, geç cevap reddediliyor');
      socket.emit('answerError', { 
        message: 'Süre doldu! Geç cevap kabul edilmez. Lütfen bir sonraki soruyu bekleyin.' 
      });
      return;
    }
    
    if (players[socket.id] && value !== null && value !== undefined) {
      // Oyuncu aktivitesini güncelle
      players[socket.id].lastActivity = Date.now();
      
      // Cevabı float olarak sakla
      const numericValue = parseFloat(value);
      answers[socket.id] = {
        value: numericValue,
        timestamp: currentTime,
        playerName: players[socket.id].name,
        playerId: socket.id
      };
      
      // Cevap verme süresini hesapla (saniye cinsinden)
      const answerTime = gameState.questionStartTime ? 
        Math.round((currentTime - gameState.questionStartTime) / 1000) : 0;
      
      // Diğer oyunculara bu oyuncunun cevap verdiğini bildir
      socket.broadcast.emit('playerAnswered', {
        playerName: players[socket.id].name,
        timestamp: currentTime,
        answerTime: answerTime
      });
      
      console.log(`✅ ${players[socket.id].name} cevap verdi: ${answerValue}`);
      console.log('📊 Toplam cevap:', Object.keys(answers).length);
      
      // Cevap doğruluğunu kontrol et
      if (typeof answerValue === 'number' && typeof currentAnswer === 'number') {
        const diff = Math.abs(answerValue - currentAnswer);
        console.log(`🔍 Cevap doğrulama: ${answerValue} vs ${currentAnswer} (fark: ${diff})`);
        
        // Eğer cevap doğruysa anında puan ver
        if (diff < 0.001) { // Küçük bir epsilon değeri ile karşılaştırma
          players[socket.id].score += 10;
          globalScores[players[socket.id].name] = (globalScores[players[socket.id].name] || 0) + 10; // Global puanı güncelle
          console.log(`🏆 ${players[socket.id].name} anında 10 puan kazandı! (Toplam: ${players[socket.id].score}, Global: ${globalScores[players[socket.id].name]})`);
          io.emit('correctAnswer', {
            playerName: players[socket.id].name,
            score: players[socket.id].score,
            message: 'Doğru cevap verildi!'
          });
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
    console.log('🎯 Soru başlatıldı:', {
      question: questionObj?.question?.substring(0, 50),
      answer: questionObj?.answer,
      timestamp: new Date().toISOString()
    });
    
    if (questionObj && questionObj.answer) {
      currentAnswer = parseFloat(questionObj.answer);
      answers = {};
      gameState.isActive = true;
      gameState.currentQuestion = questionObj;
      gameState.questionStartTime = Date.now();
      
      console.log(`📢 Yeni soru yayınlanıyor: ${questionObj.question}`);
      console.log(`🎯 Doğru cevap: ${currentAnswer}`);
      
      io.emit('newQuestion', questionObj.question);
      updatePlayerCount();

      // Gerçek zamanlı süre güncellemeleri gönder - daha sık güncelleme
      let timeLeft = 30;
      const timerInterval = setInterval(() => {
        timeLeft--;
        io.emit('timerUpdate', { timeLeft });
        
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          console.log('⏰ Süre doldu, sonuçlar hesaplanıyor...');
          const result = calculateResults();
          io.emit('showResult', result);
          console.log('📊 Sonuçlar gönderildi:', result);
          gameState.isActive = false;
        }
      }, 1000); // 1 saniye aralıklarla güncelle
    } else {
      console.log('❌ Geçersiz soru objesi:', questionObj);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Bağlantı kesildi:', { 
      socketId: socket.id, 
      reason,
      player: players[socket.id]?.name || 'Bilinmeyen',
      timestamp: new Date().toISOString()
    });
    
    // Oyuncu varsa sil - ama hemen değil, daha uzun bir gecikme ile
    if (players[socket.id]) {
      const playerName = players[socket.id].name;
      console.log(`👋 ${playerName} ayrıldı - 5 saniye bekleniyor...`);
      
      // Daha uzun bir gecikme ile oyuncuyu sil (yeniden bağlanma ihtimali için)
      setTimeout(() => {
        if (players[socket.id]) {
          console.log(`🗑️ ${playerName} kalıcı olarak siliniyor`);
          delete players[socket.id];
          
          // Tüm host'lara oyuncunun ayrıldığını bildir
          socket.broadcast.emit('playerLeft', playerName);
          
          // Mevcut tüm katılımcıları host'a gönder
          io.emit('allParticipants', Object.values(players).map(p => p.name));
          
          updatePlayerCount();
        } else {
          console.log(`✅ ${playerName} yeniden bağlandı, silinmedi`);
        }
      }, 5000); // 5 saniye gecikme - yeniden bağlanma için daha fazla zaman
    }
    
    // Cevabı sil
    delete answers[socket.id];
  });

  // Manuel oyuncu çıkışı (Ana Menü ile çıkış)
  socket.on('leave', (playerName) => {
    console.log('👋 Manuel oyuncu çıkışı:', { 
      playerName,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    if (players[socket.id]) {
      const actualPlayerName = players[socket.id].name;
      console.log(`👋 ${actualPlayerName} manuel olarak ayrıldı`);
      
      delete players[socket.id];
      
      // Tüm host'lara oyuncunun ayrıldığını bildir
      socket.broadcast.emit('playerLeft', actualPlayerName);
      
      // Mevcut tüm katılımcıları host'a gönder
      io.emit('allParticipants', Object.values(players).map(p => p.name));
      
      updatePlayerCount();
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

      const exists = questions.some(q => 
        q.question.toLowerCase() === questionText.toLowerCase()
      );
      
      if (exists) {
        return callback({ success: false, message: 'Bu soru zaten mevcut!' });
      }

      const newQ = { question: questionText, answer: answerText };
      questions.push(newQ);
      gameState.totalQuestions = questions.length;
      
      await fs.writeFile('data/questions.json', JSON.stringify(questions, null, 2), 'utf-8');
      console.log('✅ Yeni soru eklendi:', {
        question: newQ.question.substring(0, 50),
        totalQuestions: questions.length
      });
      
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
        message: 'Soru eklenirken bir hata oluştu: ' + error.message 
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
    // Global puanları kullan - oyuncular çıksa bile puanları korunur
    const finalScores = { ...globalScores };
    console.log('🏁 Oyun bitti. Final skorları (Global):', finalScores);
    io.emit('gameEnded', finalScores);
    
    // Oyun verilerini sıfırla
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
  });

  socket.on('startNewGame', () => {
    console.log('🆕 Yeni oyun başlatılıyor - tüm veriler temizleniyor...');
    
    // Tüm oyuncuları ve global puanları temizle
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
    console.log('✅ Yeni oyun için tüm veriler temizlendi');
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
    console.log('📋 Mevcut katılımcılar istendi:', Object.keys(players).length);
    console.log('👥 Aktif oyuncular:', Object.values(players).map(p => p.name));
    const participantNames = Object.values(players).map(p => p.name);
    console.log('📤 allParticipants gönderiliyor:', participantNames);
    socket.emit('allParticipants', participantNames);
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

function updatePlayerCount() {
  const count = {
    total: Object.keys(players).length,
    answered: Object.keys(answers).length,
    timestamp: Date.now()
  };
  
  console.log('📊 Oyuncu durumu güncellendi:', count);
  io.emit('playerCount', count);
}

function calculateResults() {
  let closest = null;
  let minDiff = Infinity;
  let winners = [];
  let allWinnersByAnswer = {}; // Aynı cevabı veren tüm oyuncular

  console.log('🧮 Sonuçlar hesaplanıyor...');
  console.log('🎯 Doğru cevap:', currentAnswer);
  console.log('📝 Gelen cevaplar:', Object.keys(answers).length);

  // Tüm cevapları grupla (aynı cevabı veren oyuncuları birleştir)
  for (const [id, answerObj] of Object.entries(answers)) {
    const num = parseFloat(answerObj.value);
    if (!isNaN(num)) {
      const diff = Math.abs(num - currentAnswer);
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
    for (const [id, answerObj] of Object.entries(answers)) {
      const num = parseFloat(answerObj.value);
      const diff = Math.abs(num - currentAnswer);
      // En yakın mesafedeki tüm oyunculara puan ver
      if (diff === minDiff) {
        // Mevcut oyuncuya puan ver
        if (players[id]) {
          players[id].score += 10;
          console.log(`🏆 ${players[id].name} 10 puan kazandı! (Cevap: ${num}, Mesafe: ${diff}, Toplam: ${players[id].score})`);
        }
        
        // Global puanı her zaman güncelle (oyuncu çıksa bile)
        globalScores[answerObj.playerName] = (globalScores[answerObj.playerName] || 0) + 10;
        console.log(`🌍 ${answerObj.playerName} global puanı güncellendi: ${globalScores[answerObj.playerName]}`);
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
  const allAnswers = Object.values(answers).map(answerObj => ({
    playerName: answerObj.playerName,
    answer: parseFloat(answerObj.value),
    difference: Math.abs(parseFloat(answerObj.value) - currentAnswer),
    isCorrect: Math.abs(parseFloat(answerObj.value) - currentAnswer) === 0,
    hasAnswered: true
  })).sort((a, b) => a.difference - b.difference);

  // Cevap vermeyen oyuncuları ekle
  const answeredPlayerNames = Object.values(answers).map(a => a.playerName);
  const allPlayerNames = Object.values(players).map(p => p.name);
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
    correct: currentAnswer,
    closest: winnerDisplay,
    winners: winners, // Tüm kazananları ayrı olarak gönder
    allAnswers: allAnswers, // Tüm cevapları sıralı olarak gönder
    totalAnswers: Object.keys(answers).length,
    totalPlayers: Object.keys(players).length
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