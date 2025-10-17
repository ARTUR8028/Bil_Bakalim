# 🔧 TEKNİK DETAYLAR - BİL BAKALIM QUIZ UYGULAMASI

## 🏗️ MİMARİ YAPISI

### BACKEND (Node.js + Express)
```
server/
├── server.js          # Ana server dosyası
├── package.json        # Dependencies
└── uploads/            # Excel yükleme klasörü
```

### FRONTEND (React + TypeScript)
```
src/
├── components/
│   ├── AdminPanel.tsx      # Admin yönetim paneli
│   ├── QuizHost.tsx        # Host quiz ekranı
│   ├── PlayerView.tsx       # Oyuncu ekranı
│   ├── TVHost.tsx          # TV host ekranı
│   ├── APKDownload.tsx     # APK indirme ekranı
│   └── ErrorBoundary.tsx   # Hata yakalama
├── App.tsx              # Ana uygulama
├── main.tsx             # Entry point
└── index.css            # Global stiller
```

### DEPLOYMENT
```
public/
├── apps/
│   └── BilBakalimTV.apk    # Android TV APK
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
└── sounds/                  # Ses dosyaları
```

## 🔌 API ENDPOINTS

### ANA ENDPOINTS
- **GET** `/api/health` - Server durumu
- **POST** `/api/upload` - Excel soru yükleme
- **POST** `/api/change-password` - Şifre değiştirme
- **DELETE** `/api/delete-all-questions` - Tüm soruları sil
- **GET** `/api/download/apk` - APK indirme
- **GET** `/api/qr/apk` - QR kod oluşturma

### SOCKET.IO EVENTS
- **join** - Oyuncu katılımı
- **leave** - Oyuncu ayrılışı
- **answer** - Cevap gönderme
- **startQuestion** - Soru başlatma
- **calculateResults** - Sonuç hesaplama
- **endGame** - Oyun bitirme
- **timerUpdate** - Timer güncelleme

## 🎮 QUIZ SİSTEMİ

### SORU YÖNETİMİ
```javascript
// Soru yapısı
{
  "id": 1,
  "question": "Soru metni",
  "answer": "Cevap",
  "type": "numeric" // veya "text"
}
```

### CEVAP MANTIĞI
```javascript
// En yakın cevap hesaplama
function calculateResults(answers, correctAnswer) {
  const differences = Object.entries(answers).map(([player, answer]) => ({
    player,
    answer,
    difference: Math.abs(answer - correctAnswer)
  }));
  
  const minDifference = Math.min(...differences.map(d => d.difference));
  return differences.filter(d => d.difference === minDifference);
}
```

### TIMER SİSTEMİ
```javascript
// Timer senkronizasyonu
setInterval(() => {
  const timeLeft = Math.max(0, questionTime - (Date.now() - startTime));
  io.emit('timerUpdate', { timeLeft });
  
  if (timeLeft <= 0) {
    calculateResults();
  }
}, 1000);
```

## 🎨 GÖRSEL SİSTEM

### RESPONSIVE TASARIM
```css
/* Mobil optimizasyon */
@media (max-width: 768px) {
  .mobile-container {
    padding: 1rem;
    margin: 0.5rem;
  }
  
  .mobile-btn {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }
}
```

### ANİMASYONLAR
```css
/* Kalp atışı efekti */
@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.heartbeat {
  animation: heartbeat 1.5s ease-in-out infinite;
}

/* Glow efekti */
@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px #fff; }
  50% { box-shadow: 0 0 20px #fff, 0 0 30px #fff; }
}

.glow {
  animation: glow 2s ease-in-out infinite alternate;
}
```

## 📱 ANDROID TV SİSTEMİ

### APK YAPISI
```
BilBakalimTV.apk
├── AndroidManifest.xml    # Uygulama manifesti
├── MainActivity.java      # Ana aktivite
├── resources/            # Kaynak dosyalar
└── classes.dex          # Derlenmiş kod
```

### WEBVIEW KONFİGÜRASYONU
```java
WebSettings webSettings = webView.getSettings();
webSettings.setJavaScriptEnabled(true);
webSettings.setDomStorageEnabled(true);
webSettings.setLoadWithOverviewMode(true);
webSettings.setUseWideViewPort(true);
webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
webSettings.setAppCacheEnabled(true);
webSettings.setDatabaseEnabled(true);
```

### PWA ENTEGRASYONU
```javascript
// Service Worker
const CACHE_NAME = 'bilbakalim-tv-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];
```

## 🔧 DEPLOYMENT SİSTEMİ

### RENDER.COM KONFİGÜRASYONU
```json
{
  "name": "bil-bakalim",
  "runtime": "node",
  "buildCommand": "npm run build",
  "startCommand": "npm run start:prod",
  "envVars": {
    "NODE_ENV": "production"
  }
}
```

### ENVIRONMENT VARIABLES
```bash
# Production
NODE_ENV=production
PORT=3001
VITE_SERVER_URL=https://bil-bakalim.onrender.com

# Development
NODE_ENV=development
PORT=3001
VITE_SERVER_URL=http://localhost:3001
```

### GITHUB ENTEGRASYONU
```yaml
# Otomatik deployment
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Render
        run: echo "Deploying to Render..."
```

## 🎵 SES SİSTEMİ

### GERİ SAYIM SESİ
```javascript
function playCountdownSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}
```

### SES DOSYALARI
```
public/sounds/
├── countdown.mp3    # Geri sayım sesi
├── correct.mp3      # Doğru cevap sesi
├── wrong.mp3        # Yanlış cevap sesi
└── win.mp3          # Kazanma sesi
```

## 🔒 GÜVENLİK SİSTEMİ

### ŞİFRE YÖNETİMİ
```javascript
// Şifre değiştirme
app.post('/api/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (currentPassword !== ADMIN_PASSWORD) {
    return res.status(400).json({ error: 'Mevcut şifre yanlış' });
  }
  
  ADMIN_PASSWORD = newPassword;
  res.json({ success: true, message: 'Şifre başarıyla değiştirildi' });
});
```

### HATA YAKALAMA
```javascript
// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
}
```

## 📊 MONİTORİNG SİSTEMİ

### HEALTH CHECK
```javascript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    players: Object.keys(players).length,
    questions: questions.length,
    uptime: process.uptime(),
    gameActive: gameState.isActive,
    port: PORT
  });
});
```

### RENDER MONİTOR
```javascript
// render-monitor.js
class RenderMonitor {
  constructor() {
    this.apiKey = process.env.RENDER_API_KEY;
    this.serviceId = process.env.RENDER_SERVICE_ID;
    this.checkInterval = 60000; // 1 dakika
  }
  
  async checkServiceHealth() {
    // Service durumu kontrolü
  }
  
  async manualRestart() {
    // Manuel restart
  }
}
```

## 🎯 PERFORMANS OPTİMİZASYONU

### CACHE STRATEJİSİ
```javascript
// Service Worker cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
```

### LAZY LOADING
```javascript
// Component lazy loading
const TVHost = React.lazy(() => import('./components/TVHost'));
const APKDownload = React.lazy(() => import('./components/APKDownload'));
```

### MEMORY MANAGEMENT
```javascript
// Socket.IO connection cleanup
socket.on('disconnect', () => {
  if (players[socket.id]) {
    delete players[socket.id];
    io.emit('allParticipants', Object.values(players));
  }
});
```

## 📝 DOKÜMANTASYON

### API DOKÜMANTASYONU
```javascript
/**
 * @api {post} /api/upload Excel soru yükleme
 * @apiName UploadQuestions
 * @apiGroup Questions
 * @apiParam {File} file Excel dosyası
 * @apiSuccess {Number} count Yüklenen soru sayısı
 */
```

### COMPONENT DOKÜMANTASYONU
```typescript
/**
 * QuizHost Component
 * @description Host ekranı için quiz yönetimi
 * @props onBack: () => void - Geri dönüş fonksiyonu
 */
interface QuizHostProps {
  onBack: () => void;
}
```

---
**Son Güncelleme:** 17 Ekim 2025  
**Teknik Durum:** ✅ Gelişmiş ve Optimize  
**Sonraki Adım:** Performance monitoring
