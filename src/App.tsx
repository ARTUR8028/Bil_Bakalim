import { useState, useEffect } from 'react';  
import { Settings, Play, Trophy } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import QuizHost from './components/QuizHost';
import PlayerView from './components/PlayerView';
import ErrorBoundary from './components/ErrorBoundary';

type ViewMode = 'home' | 'admin' | 'host' | 'player';

function App() {
  // İlk yüklemede hash'i kontrol et
  const getInitialView = (): ViewMode => {
    const hash = window.location.hash.slice(1);
    if (hash === 'player') {
      return 'player';
    }
    return 'home';
  };

  const [currentView, setCurrentView] = useState<ViewMode>(getInitialView);

  // URL hash'e göre view'ı ayarla
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // # işaretini kaldır
      if (hash === 'player') {  
        setCurrentView('player');
      } else if (hash === 'admin') {
        setCurrentView('admin');
      } else if (hash === 'host') {
        setCurrentView('host');
      } else {
        setCurrentView('home');
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8 mobile-grid-1">
                <div 
                  onClick={() => setCurrentView('admin')}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 hover:bg-white/20 border border-white/20 mobile-btn mobile-touch-manipulation"
                >
                  <Settings className="w-10 h-10 md:w-12 md:h-12 text-blue-300 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2 mobile-text-lg">Admin Paneli</h3>
                  <p className="text-blue-200 text-sm mobile-text-sm">Soru ekleyin ve oyunu yönetin</p>
                </div>

                <div 
                  onClick={() => setCurrentView('host')}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 md:p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 hover:bg-white/20 border border-white/20 mobile-btn mobile-touch-manipulation"
                >
                  <Play className="w-10 h-10 md:w-12 md:h-12 text-green-300 mx-auto mb-3 md:mb-4" />
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2 mobile-text-lg">Oyun Sunucusu</h3>
                  <p className="text-blue-200 text-sm mobile-text-sm">Quiz oyununu başlatın ve yönetin</p>
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