# 🚀 Render Monitor - Otomatik Hata Çözme Sistemi

Bu sistem, Render deployment'larınızı otomatik olarak izler ve hataları tespit edip çözer.

## 📋 Özellikler

- ✅ **Otomatik Service Monitoring** - Service durumunu sürekli kontrol eder
- 🔄 **Otomatik Restart** - Hata tespit edildiğinde service'i yeniden başlatır
- 📊 **Deployment Log Kontrolü** - Build hatalarını tespit eder
- 🔔 **Discord Bildirimleri** - Hatalar ve çözümler hakkında bildirim gönderir
- ⚡ **Manuel Kontroller** - İstediğiniz zaman manuel restart yapabilirsiniz

## 🛠️ Kurulum

### 1. Environment Variables Ayarlayın

```bash
# Render API anahtarınızı alın
# https://dashboard.render.com/account/settings

# .env dosyası oluşturun
cp env.example .env

# .env dosyasını düzenleyin
RENDER_API_KEY=your_api_key_here
RENDER_SERVICE_ID=your_service_id_here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_here
```

### 2. Render API Key Alma

1. [Render Dashboard](https://dashboard.render.com/) → Account Settings
2. **API Keys** bölümüne gidin
3. **New API Key** oluşturun
4. API key'i kopyalayın

### 3. Service ID Alma

1. Render Dashboard → Services
2. Projenizi seçin
3. URL'den Service ID'yi kopyalayın:
   ```
   https://dashboard.render.com/services/srv-xxxxxxxxxxxxx
   ```
   Service ID: `srv-xxxxxxxxxxxxx`

## 🚀 Kullanım

### Otomatik Monitoring Başlatma

```bash
# Monitoring'i başlat (sürekli çalışır)
npm run monitor
```

### Manuel Kontroller

```bash
# Service durumunu kontrol et
npm run monitor:health

# Deployment loglarını kontrol et
npm run monitor:logs

# Service'i manuel yeniden başlat
npm run monitor:restart
```

## 📊 Monitoring Özellikleri

### Otomatik Hata Tespiti

- **Build Hataları**: Deployment başarısız olduğunda tespit eder
- **Service Çökmeleri**: Service erişilemez olduğunda tespit eder
- **Sürekli Hatalar**: Aynı hata 3 kez tekrarlanırsa otomatik restart

### Otomatik Çözüm

- **Service Restart**: Hata tespit edildiğinde otomatik restart
- **Cache Temizleme**: Restart sırasında cache temizlenir
- **Bildirim Gönderme**: Discord'a hata ve çözüm bildirimleri

## 🔔 Discord Bildirimleri (Opsiyonel)

Discord webhook URL'i ayarlarsanız:

- ✅ **Başarılı Restart**: Service başarıyla yeniden başlatıldığında
- 🚨 **Hata Bildirimi**: Kritik hatalar için
- 📊 **Durum Raporları**: Düzenli durum güncellemeleri

### Discord Webhook Kurulumu

1. Discord Server → Server Settings → Integrations
2. **Webhooks** → **Create Webhook**
3. Webhook URL'i kopyalayın
4. `.env` dosyasına ekleyin

## 📈 Monitoring Logları

```bash
🕐 2024-01-15 14:30:00 - Monitoring başlıyor...
🔍 Service durumu kontrol ediliyor...
✅ Service: bil-bakalim
📊 Durum: running
🌐 URL: https://bil-bakalim.onrender.com
📋 Deployment logları kontrol ediliyor...
✅ Her şey normal çalışıyor!
```

## ⚙️ Yapılandırma

### Monitoring Ayarları

```javascript
// render-monitor.js içinde
this.checkInterval = 60000;    // Kontrol aralığı (ms)
this.maxRetries = 3;          // Maksimum deneme sayısı
this.retryDelay = 30000;      // Deneme aralığı (ms)
```

### Environment Variables

```bash
RENDER_API_KEY=your_api_key          # Gerekli
RENDER_SERVICE_ID=your_service_id    # Gerekli
DISCORD_WEBHOOK_URL=your_webhook     # Opsiyonel
```

## 🚨 Sorun Giderme

### API Key Hatası

```bash
❌ RENDER_API_KEY environment variable gerekli!
```

**Çözüm**: `.env` dosyasında API key'i kontrol edin.

### Service ID Hatası

```bash
❌ RENDER_SERVICE_ID environment variable gerekli!
```

**Çözüm**: Render dashboard'dan doğru Service ID'yi alın.

### Permission Hatası

```bash
❌ Service yeniden başlatılamadı: 403 Forbidden
```

**Çözüm**: API key'inizin yeterli yetkileri olduğundan emin olun.

## 📝 Örnek Kullanım Senaryoları

### 1. Sürekli Monitoring

```bash
# Terminal'de monitoring başlat
npm run monitor

# Arka planda çalıştır (Linux/Mac)
nohup npm run monitor > monitor.log 2>&1 &

# Windows'ta arka planda çalıştır
start /B npm run monitor
```

### 2. Manuel Kontrol

```bash
# Service durumunu kontrol et
npm run monitor:health

# Son deployment'ı kontrol et
npm run monitor:logs

# Acil restart
npm run monitor:restart
```

### 3. Production Deployment

```bash
# Production'da monitoring başlat
NODE_ENV=production npm run monitor
```

## 🎯 Avantajlar

- **⏰ 7/24 Monitoring**: Sürekli hizmet kontrolü
- **🔄 Otomatik Çözüm**: Manuel müdahale gerektirmez
- **📊 Detaylı Loglar**: Tüm işlemler kaydedilir
- **🔔 Anlık Bildirimler**: Hatalar anında bildirilir
- **⚡ Hızlı Müdahale**: Hata tespit edildiğinde hemen çözüm

## 📞 Destek

Sorun yaşarsanız:

1. **Logları kontrol edin**: `monitor.log` dosyasını inceleyin
2. **Environment variables**: `.env` dosyasını kontrol edin
3. **API permissions**: Render dashboard'dan yetkileri kontrol edin
4. **Service status**: Render dashboard'dan service durumunu kontrol edin

---

**🎉 Artık deployment'larınız otomatik olarak izleniyor ve hatalar otomatik çözülüyor!**
