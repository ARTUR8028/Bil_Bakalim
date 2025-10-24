# 🚀 Render.com PostgreSQL Kurulum Kılavuzu

## ⚠️ ÖNEMLİ: Sorular Artık Veritabanında!

**Sorun:** Render.com'da dosya sistemi geçici (ephemeral). Her deploy/restart'ta siliniyor!
**Çözüm:** PostgreSQL veritabanı kullanıyoruz. Sorular artık **kalıcı** olacak!

---

## 📋 ADIM 1: PostgreSQL Database Oluştur

1. **Render.com Dashboard**'a git: https://dashboard.render.com/
2. **"New +"** → **"PostgreSQL"** seç
3. **Database Ayarları:**
   - **Name:** `bil-bakalim-db`
   - **Database:** `bil_bakalim`
   - **User:** (otomatik)
   - **Region:** `Frankfurt` (en yakın)
   - **Plan:** **FREE** ✅
4. **"Create Database"** butonuna tıkla
5. ⏳ **3-5 dakika bekle** (database hazırlanıyor)

---

## 📋 ADIM 2: Connection String'i Kopyala

1. Database sayfasında **"Info"** sekmesine git
2. **"Internal Database URL"** kısmını bul
3. 📋 **Kopyala** (örnek):
   ```
   postgres://bil_bakalim_user:aBcD1234xyz@dpg-xxxxx.frankfurt-postgres.render.com/bil_bakalim
   ```

---

## 📋 ADIM 3: Web Service'e Environment Variable Ekle

1. **Render.com Dashboard** → **"bil-bakalim"** web service'ine git
2. **"Environment"** sekmesine tıkla
3. **"Add Environment Variable"** butonuna tıkla
4. **Yeni variable ekle:**
   - **Key:** `DATABASE_URL`
   - **Value:** *(ADIM 2'de kopyaladığınız connection string)*
5. **"Save Changes"** → **Otomatik redeploy başlayacak**

---

## ✅ ADIM 4: Deploy Sonucunu Kontrol Et

### Deploy Tamamlandıktan Sonra (3-5 dakika):

1. **Logs** sekmesine git
2. Şu mesajları görmelisiniz:
   ```
   ✅ Veritabanı tabloları hazır!
   📥 questions.json'dan sorular yükleniyor...
   ✅ 893 soru veritabanına yüklendi!
   ✅ 893 soru veritabanından yüklendi
   ```

---

## 🎉 TAMAMLANDI!

Artık:
- ✅ **Admin'den eklediğiniz sorular kalıcı** olarak saklanıyor
- ✅ **Restart/redeploy sonrası silinmiyor**
- ✅ **Excel upload çalışıyor**
- ✅ **Türkçe karakterler düzgün** (UTF-8 veritabanı)

---

## 🧪 TEST ET:

1. **Admin Paneli**: https://bil-bakalim.onrender.com/#admin
   - Kullanıcı: `OSMAN`
   - Şifre: `80841217`
2. **Yeni soru ekle** (örnek):
   - **Soru:** Test sorusu veritabanı?
   - **Cevap:** 100
3. **"Soru Ekle"** butonuna tıkla
4. ✅ "Soru başarıyla eklendi!" mesajını görmelisiniz
5. **Sayfayı yenile** → Soru hala orada! 🎉

---

## ❓ SORUN GİDERME:

### Database bağlanamıyor:
- `DATABASE_URL` environment variable'ı doğru mu?
- Database **Running** durumda mı?

### Sorular yüklenmiyor:
- Logs'da `✅ ... soru veritabanına yüklendi` mesajı var mı?
- Database connection string'de `?ssl=true` veya port var mı?

### Eski sorular gözüküyor:
```sql
-- Database'i sıfırlamak için (Render Dashboard SQL Console):
DROP TABLE questions;
-- Sonra redeploy yapın, tablolar yeniden oluşacak
```

---

## 📞 DESTEK:

Sorun devam ederse:
1. Render.com **Logs** sekmesindeki hataları kontrol edin
2. Database **Metrics** sekmesinde bağlantı sayısını kontrol edin

---

**Artık sorularınız güvende!** 🚀🎉

