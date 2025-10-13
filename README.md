<<<<<<< HEAD
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
=======
# tv-quiz-app



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.com/bil_bakalim-group/tv-quiz-app.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.com/bil_bakalim-group/tv-quiz-app/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
>>>>>>> cbc2e3204890ed92736261d3d831431b50244c70
