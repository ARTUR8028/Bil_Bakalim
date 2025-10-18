import React, { useState, useEffect } from 'react';
import { Download, QrCode } from 'lucide-react';

interface APKDownloadProps {
  onBack: () => void;
}

const APKDownload: React.FC<APKDownloadProps> = ({ onBack }) => {
  const [qrCode, setQrCode] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchQRCode();
  }, []);

  const fetchQRCode = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/qr/apk');
      const data = await response.json();
      
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setDownloadUrl(data.downloadUrl);
      } else {
        setError(data.error || 'QR kod oluşturulamadı');
      }
    } catch (err) {
      setError('QR kod yüklenirken hata oluştu');
      console.error('QR kod hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-6 bg-black/20 backdrop-blur-lg">
        <button
          onClick={onBack}
          className="flex items-center text-white hover:text-yellow-300 transition-colors text-lg tv-focusable"
          data-tv-back
        >
          ← Ana Menü
        </button>
        <div className="text-white text-xl font-bold">
          📱 Android TV Uygulaması
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold text-white mb-4">
                📺 Bil Bakalım TV
              </h1>
              <p className="text-2xl text-gray-300 mb-8">
                Google TV için Android Uygulaması
              </p>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* QR Code Section */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
              <div className="text-center">
                <QrCode className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-4">
                  📱 APK İndir
                </h3>
                <p className="text-gray-300 mb-6">
                  Android TV cihazınız için APK dosyasını indirin
                </p>
                
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <h4 className="text-lg font-semibold text-blue-300 mb-3">📋 APK Kurulum Adımları:</h4>
                  <ol className="text-sm text-blue-200 space-y-2 text-left">
                    <li>1. QR kodu tarayın veya direkt indirin</li>
                    <li>2. APK dosyasını Android TV'ye aktarın</li>
                    <li>3. "Bilinmeyen kaynaklardan kurulum" izni verin</li>
                    <li>4. APK dosyasını yükleyin</li>
                    <li>5. Uygulamayı başlatın!</li>
                  </ol>
                  
                  <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <p className="text-green-200 text-sm">
                      ✅ <strong>Avantajlar:</strong> Tam Android uygulaması, hızlı çalışma, 
                      Google TV uyumlu!
                    </p>
                  </div>
                </div>
                
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div>
                  </div>
                ) : error ? (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-300">{error}</p>
                  </div>
                ) : qrCode ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={qrCode} 
                      alt="APK Download QR Code" 
                      className="w-64 h-64 rounded-lg border-4 border-white/20"
                    />
                    <p className="text-sm text-gray-400 mt-4">
                      QR kodu tarayın ve APK dosyasını indirin
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Download Section */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
              <div className="text-center">
                <Download className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-4">
                  Direkt İndir
                </h3>
                <p className="text-gray-300 mb-6">
                  Android TV cihazınızda tarayıcıdan direkt indirin
                </p>
                
                <button
                  onClick={handleDownload}
                  disabled={!downloadUrl || loading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white text-xl px-8 py-4 rounded-2xl transition-colors tv-focusable w-full"
                >
                  {loading ? 'Yükleniyor...' : '📱 APK İndir'}
                </button>
                
                
                {downloadUrl && (
                  <div className="mt-4 p-4 bg-white/5 rounded-lg">
                    <p className="text-sm text-gray-400 mb-2">İndirme Linki:</p>
                    <p className="text-xs text-blue-300 break-all">{downloadUrl}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              📋 Kurulum Talimatları
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                  <div>
                    <h4 className="text-lg font-semibold text-white">QR Kod Tarayın</h4>
                    <p className="text-gray-300 text-sm">Telefonunuzla QR kodu tarayın</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                  <div>
                    <h4 className="text-lg font-semibold text-white">APK İndirin</h4>
                    <p className="text-gray-300 text-sm">APK dosyasını cihazınıza indirin</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
                  <div>
                    <h4 className="text-lg font-semibold text-white">Kurulum Yapın</h4>
                    <p className="text-gray-300 text-sm">Bilinmeyen kaynaklardan kuruluma izin verin</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">4</div>
                  <div>
                    <h4 className="text-lg font-semibold text-white">Uygulamayı Açın</h4>
                    <p className="text-gray-300 text-sm">Bil Bakalım TV uygulamasını başlatın</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APKDownload;
