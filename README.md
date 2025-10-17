# 📺 TV Quiz Uygulaması - Tam Özellikli Sürüm

Bu uygulama TV'lerde çalışmak üzere tasarlanmış profesyonel bir interaktif quiz oyunudur. Oyun sunucusu TV'de çalışırken, yarışmacılar telefonlarından QR kod okutarak veya link ile katılabilirler.

## 🚀 Hızlı Başlangıç

### 1. Kurulum
```bash
# Projeyi klonlayın
git clone [proje-url]
cd tv-quiz-app

# Bağımlılıkları yükleyin
npm install
```

### 2. Çalıştırma
```bash
# Uygulamayı başlatın (hem sunucu hem frontend)
npm run dev
```

### 3. Erişim
- **TV/Ana Bilgisayar**: http://localhost:5173
- **Yarışmacı Telefonları**: http://localhost:5173/#player
- **Sunucu API**: http://localhost:3001

## 🎮 Nasıl Kullanılır

### TV'de (Oyun Sunucusu):
1. **Ana Menüden "Oyun Sunucusu"** seçin
2. **Mod Seçimi**: "Sıralı" veya "Rastgele" seçin
3. **QR Kod Paylaşımı**: Ekranda görünen QR kodu yarışmacılara gösterin
4. **Oyuncu Beklemesi**: Yeterli oyuncu katılana kadar bekleyin
5. **Oyunu Başlatma**: "Oyunu Başlat" butonuna tıklayın
6. **Soru Yönetimi**: Her soru için "Soruyu Başlat" butonuna basın
7. **Sonuç Takibi**: Cevaplar geldiğinde sonuçları görün

### Telefonda (Yarışmacı):
1. **QR Kod Okutma** veya katılım linkine tıklama
2. **İsim Girişi**: Adınızı girin ve "Oyuna Katıl"
3. **Soru Cevaplama**: Gelen sorulara sayısal cevap verin
4. **Puan Takibi**: Oyun boyunca puanınızı takip edin

### Admin Paneli:
1. **Giriş Bilgileri**:
   - Kullanıcı Adı: `OSMAN`
   - Şifre: `80841217`
2. **Soru Ekleme**: Tek tek soru ekleyin
3. **Excel Yükleme**: Toplu soru yüklemesi yapın

## 🔧 Özellikler

### ✅ Temel Özellikler
- **QR Kod ile Katılım**: Kolay oyuncu katılımı
- **Gerçek Zamanlı Oyun**: Anlık soru-cevap sistemi
- **Puan Sistemi**: En yakın cevap verene puan
- **Responsive Tasarım**: TV ve mobil uyumlu
- **Çoklu Oyuncu Desteği**: Sınırsız oyuncu katılımı

### 🚀 Gelişmiş Özellikler
- **Bağlantı Durumu Takibi**: Gerçek zamanlı bağlantı kontrolü
- **Ping-Pong Mekanizması**: Stabil bağlantı sağlama
- **Detaylı Loglama**: Kapsamlı hata takibi
- **Sunucu Durumu Göstergesi**: Sistem sağlığı monitörü
- **Excel Dosya Desteği**: Esnek sütun formatları
- **Otomatik Yeniden Bağlanma**: Bağlantı kopması durumunda

### 📊 Admin Özellikleri
- **Sistem Durumu**: Gerçek zamanlı sunucu istatistikleri
- **Soru Yönetimi**: Kolay soru ekleme ve düzenleme
- **Dosya Yükleme**: Excel'den toplu soru aktarımı
- **Oyuncu Takibi**: Aktif oyuncu sayısı ve durumu
- **Test Araçları**: Sistem sağlığı kontrol araçları

## 📁 Proje Yapısı

```
tv-quiz-app/
├── src/                    # React Frontend
│   ├── components/         # React Bileşenleri
│   │   ├── AdminPanel.tsx  # Admin Yönetim Paneli
│   │   ├── QuizHost.tsx    # TV Oyun Sunucusu
│   │   └── PlayerView.tsx  # Yarışmacı Arayüzü
│   ├── App.tsx            # Ana Uygulama
│   └── main.tsx           # Giriş Noktası
├── server/                # Backend Sunucu
│   └── server.js          # Express + Socket.IO Sunucu
├── data/                  # Veri Dosyaları
│   └── questions.json     # Soru Veritabanı
├── public/                # Statik Dosyalar
└── package.json           # Proje Bağımlılıkları
```

## 🌐 API Endpoints

### Sunucu Endpoints (Port 3001)
- `GET /` - Ana sayfa ve sistem durumu
- `GET /health` - Detaylı sistem sağlığı
- `GET /test` - Test endpoint'i
- `GET /questions` - Tüm soruları getir
- `POST /upload` - Excel dosya yükleme

### Socket.IO Events
- `join` - Oyuncı katılımı
- `answer` - Cevap gönderimi
- `startQuestion` - Soru başlatma
- `addQuestion` - Yeni soru ekleme
- `showScores` - Puan durumu
- `endGame` - Oyun sonlandırma

## 📋 Excel Dosya Formatı

Excel dosyanızda şu sütunlar bulunmalı:

| Sütun A | Sütun B |
|---------|---------|
| question/soru | answer/cevap |
| Türkiye'nin başkenti? | Ankara |
| 1+1 kaç eder? | 2 |

**Desteklenen Sütun İsimleri:**
- **Soru**: question, Question, QUESTION, soru, Soru, SORU, q, Q
- **Cevap**: answer, Answer, ANSWER, cevap, Cevap, CEVAP, ans, Ans

## 🔧 Sistem Gereksinimleri

### Sunucu İçin:
- **Node.js**: 16.0 veya üzeri
- **RAM**: Minimum 512MB
- **Disk**: 100MB boş alan
- **Ağ**: WiFi/Ethernet bağlantısı

### TV İçin:
- **Smart TV**: Android TV, webOS, Tizen
- **Tarayıcı**: Modern web tarayıcısı
- **RAM**: Minimum 2GB (önerilen)
- **Ağ**: Aynı WiFi ağında olma

### Yarışmacı Telefonları İçin:
- **Tarayıcı**: Modern mobil tarayıcı
- **Ağ**: Aynı WiFi ağında olma
- **QR Okuyucu**: Kamera erişimi (opsiyonel)

## 🛠️ Sorun Giderme

### Yaygın Sorunlar ve Çözümleri

#### 1. Sunucu Başlamıyor
```bash
# Port kontrolü
netstat -an | grep 3001
# Alternatif port kullanımı
PORT=3002 npm run dev
```

#### 2. Bağlantı Sorunu
```bash
# Firewall kontrolü
sudo ufw allow 3001
sudo ufw allow 5173
# Windows Firewall'da portları açın
```

#### 3. Excel Yükleme Hatası
- Dosya formatını kontrol edin (.xlsx, .xls)
- Sütun isimlerini doğrulayın
- Dosya boyutunu kontrol edin (max 10MB)

#### 4. Oyuncu Katılamıyor
- Aynı WiFi ağında olduğunuzu kontrol edin
- IP adresini manuel olarak girin
- QR kod yerine linki manuel paylaşın

### Detaylı Hata Takibi

#### Sunucu Logları
```bash
# Sunucu durumu
curl http://localhost:3001/health

# Test endpoint
curl http://localhost:3001/test
```

#### Tarayıcı Konsolu
- F12 ile geliştirici araçlarını açın
- Console sekmesinde hataları kontrol edin
- Network sekmesinde bağlantı durumunu izleyin

## 📞 Destek ve İletişim

### Hızlı Çözümler
1. **Uygulamayı yeniden başlatın**: `Ctrl+C` sonra `npm run dev`
2. **Tarayıcı önbelleğini temizleyin**: `Ctrl+F5`
3. **Router'ı yeniden başlatın**: Ağ bağlantısı sorunları için
4. **Firewall ayarlarını kontrol edin**: Port erişimi için

### Sistem Durumu Kontrolü
- **Sunucu**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Frontend**: http://localhost:5173

## 🎯 Gelecek Özellikler

- [ ] Çoklu oda desteği
- [ ] Ses efektleri
- [ ] Tema seçenekleri
- [ ] İstatistik raporları
- [ ] Oyuncu profilleri
- [ ] Turnuva modu

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

---

**🎮 İyi Oyunlar! 🏆**

*TV Quiz Uygulaması - Profesyonel İnteraktif Quiz Deneyimi*