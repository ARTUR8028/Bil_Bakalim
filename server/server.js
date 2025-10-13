import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import xlsx from 'xlsx';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://0.0.0.0:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 120000, // 2 dakika
  pingInterval: 25000,  // 25 saniye
  // İyileştirilmiş bağlantı ayarları
  maxHttpBufferSize: 1e6,
  compression: true,
  serveClient: false,
  // Bağlantı stabilitesi için
  connectionStateRecovery: {
    maxDisconnectionDuration: 5 * 60 * 1000, // 5 dakika
    skipMiddlewares: true,
  },
  // Ek stabilite ayarları
  allowUpgrades: true,
  upgradeTimeout: 10000,
  maxDisconnectionDuration: 5 * 60 * 1000
});

const PORT = process.env.PORT || 3001;

console.log('\n🚀 ================================');
console.log('🎮 Quiz Sunucusu Başlatılıyor...');
console.log('🚀 ================================');

// CORS middleware - Daha kapsamlı
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.static('public'));
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
  
  // Soruları yükle
  try {
    const raw = await fs.readFile('data/questions.json', 'utf-8');
    questions = JSON.parse(raw);
    gameState.totalQuestions = questions.length;
    console.log(`✅ ${questions.length} soru yüklendi`);
  } catch (err) {
    console.log('⚠️ Soru dosyası bulunamadı, yeni dosya oluşturuluyor...');
    questions = [];
    try {
      await fs.writeFile('data/questions.json', JSON.stringify([], null, 2), 'utf-8');
      console.log('✅ Boş soru dosyası oluşturuldu');
    } catch (createErr) {
      console.error('❌ Soru dosyası oluşturulamadı:', createErr);
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
              const isDuplicate = existing.some(q => 
                q.question.toLowerCase() === questionStr.toLowerCase()
              );
              
              if (!isDuplicate) {
                merged.push({
                  question: questionStr,
                  answer: answerStr
                });
                addedCount++;
                console.log(`✅ Soru eklendi: ${questionStr.substring(0, 50)}...`);
              } else {
                skippedCount++;
                console.log(`⚠️ Soru atlandı (duplicate): ${questionStr.substring(0, 30)}...`);
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
    
    if (name && name.trim()) {
      const playerName = name.trim();
      
      // Aynı isimde oyuncu var mı kontrol et
      const existingPlayer = Object.values(players).find(p => p.name === playerName);
      if (existingPlayer) {
        console.log('❌ Aynı isimde oyuncu mevcut:', playerName);
        socket.emit('joinError', { message: 'Bu isimde bir oyuncu zaten var!' });
        return;
      }
      
      players[socket.id] = { 
        name: playerName, 
        score: 0,
        joinTime: Date.now(),
        socketId: socket.id,
        lastActivity: Date.now()
      };
      
      console.log(`✅ ${playerName} oyuna katıldı (${socket.id})`);
      console.log('👥 Aktif oyuncular:', Object.keys(players).length);
      
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
      io.emit('allParticipants', Object.values(players).map(p => p.name));
      
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
      
      console.log(`✅ ${players[socket.id].name} cevap verdi: ${numericValue}`);
      console.log('📊 Toplam cevap:', Object.keys(answers).length);
      
      // Cevap doğruluğunu kontrol et
      if (!isNaN(numericValue)) {
        const diff = Math.abs(numericValue - currentAnswer);
        console.log(`🔍 Cevap doğrulama: ${numericValue} vs ${currentAnswer} (fark: ${diff})`);
        
        // Eğer cevap doğruysa anında puan ver
        if (diff < 0.001) { // Küçük bir epsilon değeri ile karşılaştırma
          players[socket.id].score += 10;
          console.log(`🏆 ${players[socket.id].name} anında 10 puan kazandı! (Toplam: ${players[socket.id].score})`);
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
        value: numericValue,
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

      // 30 saniye sonra sonuçları göster
      setTimeout(() => {
        console.log('⏰ Süre doldu, sonuçlar hesaplanıyor...');
        const result = calculateResults();
        io.emit('showResult', result);
        console.log('📊 Sonuçlar gönderildi:', result);
        gameState.isActive = false;
      }, 30000);
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
    
      if (players[socket.id]) {
        const playerName = players[socket.id].name;
        console.log(`👋 ${playerName} ayrıldı`);
        delete players[socket.id];
        
        // Tüm host'lara oyuncunun ayrıldığını bildir
        socket.broadcast.emit('playerLeft', playerName);
        
        // Mevcut tüm katılımcıları host'a gönder
        io.emit('allParticipants', Object.values(players).map(p => p.name));
      }
      delete answers[socket.id];
    updatePlayerCount();
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
    io.emit('updateScores', scores);
  });

  socket.on('endGame', () => {
    const finalScores = {};
    for (const id in players) {
      finalScores[players[id].name] = players[id].score;
    }
    console.log('🏁 Oyun bitti. Final skorları:', finalScores);
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

  // Hata yakalama
  socket.on('error', (error) => {
    console.error('❌ Socket hatası:', error);
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
    winners = allWinnersByAnswer[closest] ? allWinnersByAnswer[closest].players : [];
    console.log('🏆 Kazananlar listesi:', winners);
  }

  // Puanları güncelle (en yakın cevabı veren TÜM oyunculara puan ver)
  if (closest !== null && winners.length > 0) {
    for (const [id, answerObj] of Object.entries(answers)) {
      const num = parseFloat(answerObj.value);
      // En yakın cevabı veren tüm oyunculara puan ver
      if (num === closest && players[id]) {
        players[id].score += 10;
        console.log(`🏆 ${players[id].name} 10 puan kazandı! (Cevap: ${num}, Toplam: ${players[id].score})`);
      }
    }
  }

  // Kazanan isimlerini birleştir
  const winnerNames = winners.length > 0 ? winners.join(', ') : 'Kimse';
  const winnerDisplay = winners.length > 1 ? 
    `${winnerNames} (${closest !== null ? closest : 'Cevap yok'})` :
    `${winnerNames} (${closest !== null ? closest : 'Cevap yok'})`;

  // Tüm cevapları sırala (en yakından en uzağa)
  const allAnswers = Object.values(answers).map(answerObj => ({
    playerName: answerObj.playerName,
    answer: parseFloat(answerObj.value),
    difference: Math.abs(parseFloat(answerObj.value) - currentAnswer),
    isCorrect: Math.abs(parseFloat(answerObj.value) - currentAnswer) === 0
  })).sort((a, b) => a.difference - b.difference);

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
    error: 'Sunucu hatası: ' + error.message,
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

// Sunucuyu başlat
initializeServer().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 ================================');
    console.log('🎮 Quiz Sunucusu Başlatıldı!');
    console.log('🚀 ================================');
    console.log(`🌐 Ana Sunucu: http://localhost:${PORT}`);
    console.log(`📱 Yarışmacı: http://localhost:5173/#player`);
    console.log(`🖥️  TV Ana Sayfa: http://localhost:5173`);
    console.log(`📊 Sistem Durumu: http://localhost:${PORT}/api/health`);
    console.log(`📁 Soru Sayısı: ${questions.length}`);
    console.log('🚀 ================================\n');
  });
}).catch(err => {
  console.error('❌ Sunucu başlatılamadı:', err);
  process.exit(1);
});