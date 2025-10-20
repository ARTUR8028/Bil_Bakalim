import { useState, useEffect } from 'react';  
import { Settings, Play, Trophy, Tv, Download } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import QuizHost from './components/QuizHost';
import PlayerView from './components/PlayerView';
import TVHost from './components/TVHost';
import APKDownload from './components/APKDownload';
import ErrorBoundary from './components/ErrorBoundary';
import { detectDeviceType, getOptimalView, canAccessPlayerView, canAccessTVHost, getDeviceInfo } from './utils/deviceDetection';

type ViewMode = 'home' | 'admin' | 'host' | 'player' | 'tv' | 'apk';

function App() {
  // İlk yüklemede hash'i kontrol et ve cihaz tipine göre yönlendir
  const getInitialView = (): ViewMode => {
    const hash = window.location.hash.slice(1);
    const deviceType = detectDeviceType();
    
    // Hash varsa ve erişim izni varsa hash'i kullan
    if (hash === 'player' && canAccessPlayerView(deviceType)) {
      return 'player';
    } else if (hash === 'tv' && canAccessTVHost(deviceType)) {
      return 'tv';
    } else if (hash === 'host') {
      return 'host';
    } else if (hash === 'admin') {
      return 'admin';
    } else if (hash === 'apk') {
      return 'apk';
    }
    
    // Hash yoksa cihaz tipine göre otomatik yönlendir
    const optimalView = getOptimalView(deviceType) as ViewMode;
    return optimalView;
  };

  const [currentView, setCurrentView] = useState<ViewMode>(getInitialView);
  const deviceInfo = getDeviceInfo();

  // URL hash'e göre view'ı ayarla
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // # işaretini kaldır
      const deviceType = detectDeviceType();
      
      // Erişim izni kontrolü ile hash değişikliklerini işle
      if (hash === 'player' && canAccessPlayerView(deviceType)) {  
        setCurrentView('player');
      } else if (hash === 'admin') {
        setCurrentView('admin');
      } else if (hash === 'host') {
        setCurrentView('host');
      } else if (hash === 'tv' && canAccessTVHost(deviceType)) {
        setCurrentView('tv');
      } else if (hash === 'apk') {
        setCurrentView('apk');
      } else {
        // Hash geçersizse veya erişim izni yoksa optimal view'a yönlendir
        const optimalView = getOptimalView(deviceType) as ViewMode;
        setCurrentView(optimalView);
      }
    };                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      

    // Sayfa yüklendiğinde hash'i kontrol et
    handleHashChange();                                                                                                                                                                                                                                                                                                                                        

    // Hash değişikliklerini dinle
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'admin':
        return <AdminPanel onBack={() => setCurrentView('home')} />;
      case 'host':
        return <QuizHost onBack={() => setCurrentView('home')} />;
      case 'player':
        return <PlayerView onBack={() => {
          setCurrentView('home');
          window.location.hash = '';
        }} />;
      case 'tv':
        return <TVHost onBack={() => setCurrentView('home')} />;
      case 'apk':
        return <APKDownload onBack={() => setCurrentView('home')} />;
      default:
        return (
          <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4 mobile-safe-top mobile-safe-bottom">
            <div className="max-w-4xl w-full text-center mobile-container">
              <div className="mb-8 md:mb-12">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight mobile-text-4xl">
                  MODERN QUIZ
                </h1>
                <p className="text-lg md:text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed mobile-text-lg">
                  Interaktif quiz deneyimi ile bilginizi test edin. Arkadaşlarınızla yarışın ve eğlenceli vakit geçirin.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 mobile-grid-1">
                <div 
                  onClick={() => setCurrentView('admin')}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 hover:bg-white/20 border border-white/20 mobile-btn mobile-touch-manipulation tv-focusable"
                >
                  <Settings className="w-10 h-10 md:w-12 md:h-12 text-blue-300 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2 mobile-text-lg">Admin Paneli</h3>
                  <p className="text-blue-200 text-sm mobile-text-sm">Soru ekleyin ve oyunu yönetin</p>
                </div>

                <div 
                  onClick={() => setCurrentView('host')}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 hover:bg-white/20 border border-white/20 mobile-btn mobile-touch-manipulation tv-focusable"
                >
                  <Play className="w-10 h-10 md:w-12 md:h-12 text-green-300 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2 mobile-text-lg">Oyun Sunucusu</h3>
                  <p className="text-blue-200 text-sm mobile-text-sm">Quiz oyununu başlatın ve yönetin</p>
                </div>

                {/* TV butonu sadece TV cihazında görünür */}
                {canAccessTVHost(deviceInfo.type) && (
                  <div 
                    onClick={() => setCurrentView('tv')}
                    className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 hover:bg-white/20 border border-white/20 mobile-btn mobile-touch-manipulation tv-focusable"
                  >
                    <Tv className="w-10 h-10 md:w-12 md:h-12 text-purple-300 mx-auto mb-3 md:mb-4" />
                    <h3 className="text-lg md:text-xl font-semibold text-white mb-2 mobile-text-lg">📺 Google TV</h3>
                    <p className="text-blue-200 text-sm mobile-text-sm">TV ekranında soruları yayınlayın</p>
                  </div>
                )}

                {/* Player butonu ana ekranda görünmez - sadece /#player linki ile erişilebilir */}

                <div 
                  onClick={() => setCurrentView('apk')}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 hover:bg-white/20 border border-white/20 mobile-btn mobile-touch-manipulation tv-focusable"
                >
                  <Download className="w-10 h-10 md:w-12 md:h-12 text-orange-300 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2 mobile-text-lg">Android APP</h3>
                  <p className="text-blue-200 text-sm mobile-text-sm">APK dosyasını indirin</p>
                </div>

              </div>

              <div className="flex items-center justify-center space-x-2 text-blue-300 mobile-flex-row mobile-items-center mobile-justify-center">
                <Trophy className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm mobile-text-sm">MODERN QUIZ</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div translate="no">
      <ErrorBoundary>
        {renderView()}
      </ErrorBoundary>
    </div>
  );
}

export default App;