import React from 'react';
import { Download, Smartphone, ArrowLeft } from 'lucide-react';

interface APKDownloadProps {
  onBack: () => void;
}

const APKDownload: React.FC<APKDownloadProps> = ({ onBack }) => {
  const apkUrl = '/apps/BilBakalimTV.apk';
  const apkSize = '15.2 MB'; // APK boyutunu buraya yazın
  const version = '1.0.0'; // Versiyon numarasını buraya yazın

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = apkUrl;
    link.download = 'BilBakalimTV.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-6 bg-black/20 backdrop-blur-lg">
        <button
          onClick={onBack}
          className="flex items-center text-white hover:text-yellow-300 transition-colors text-lg"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Ana Menü
        </button>
        <div className="text-white text-lg">
          📱 Android APP
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-4xl w-full text-center">
          {/* App Icon */}
          <div className="mb-8">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl">
              <Smartphone className="w-16 h-16 text-white" />
            </div>
          </div>

          {/* App Info */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white mb-4">
              📱 BİL BAKALIM TV
            </h1>
            <p className="text-xl text-gray-300 mb-6">
              Google TV için Interaktif Quiz Uygulaması
            </p>
            <div className="flex justify-center space-x-8 text-gray-300">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">v{version}</div>
                <div className="text-sm">Versiyon</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{apkSize}</div>
                <div className="text-sm">Boyut</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">Android</div>
                <div className="text-sm">Platform</div>
              </div>
            </div>
          </div>

          {/* Download Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 mb-8">
            <h2 className="text-3xl font-bold text-white mb-6">📥 İndirme</h2>
            <p className="text-lg text-gray-300 mb-8">
              Google TV cihazınızda quiz oyununu oynayın. APK dosyasını indirip yükleyin.
            </p>
            
            <button
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700 text-white text-2xl px-12 py-6 rounded-2xl transition-colors flex items-center mx-auto shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Download className="w-8 h-8 mr-3" />
              APK İndir
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="text-4xl mb-4">📺</div>
              <h3 className="text-xl font-bold text-white mb-2">TV Optimized</h3>
              <p className="text-gray-300">Google TV için özel tasarım</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-xl font-bold text-white mb-2">Interactive Quiz</h3>
              <p className="text-gray-300">Interaktif quiz deneyimi</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold text-white mb-2">Multiplayer</h3>
              <p className="text-gray-300">Çoklu oyuncu desteği</p>
            </div>
          </div>

          {/* Installation Instructions */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6">📋 Kurulum Talimatları</h3>
            <div className="text-left space-y-4 text-gray-300">
              <div className="flex items-start space-x-3">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</span>
                <p>APK dosyasını Google TV cihazınıza aktarın</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</span>
                <p>Bilinmeyen kaynaklardan yükleme iznini verin</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</span>
                <p>APK dosyasını açın ve yükleyin</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">4</span>
                <p>Uygulamayı başlatın ve quiz oyununu oynayın!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APKDownload;
