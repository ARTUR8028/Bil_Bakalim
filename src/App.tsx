import { useState, useEffect } from 'react';  
import { Settings, Play, Trophy } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import QuizHost from './components/QuizHost';
import PlayerView from './components/PlayerView';
import ErrorBoundary from './components/ErrorBoundary';

type ViewMode = 'home' | 'admin' | 'host' | 'player';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('home');

  // URL hash'e göre view'ı ayarla
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // # işaretini kaldır
      if (hash === 'player') {  
        setCurrentView('player');
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
          <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full text-center">
              <div className="mb-12">
                <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">
                  MODERN QUIZ
                </h1>
                <p className="text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed">
                  Interaktif quiz deneyimi ile bilginizi test edin. Arkadaşlarınızla yarışın ve eğlenceli vakit geçirin.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div 
                  onClick={() => setCurrentView('admin')}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 hover:bg-white/20 border border-white/20"
                >
                  <Settings className="w-12 h-12 text-blue-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Admin Paneli</h3>
                  <p className="text-blue-200 text-sm">Soru ekleyin ve oyunu yönetin</p>
                </div>

                <div 
                  onClick={() => setCurrentView('host')}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 cursor-pointer transform hover:scale-105 transition-all duration-300 hover:bg-white/20 border border-white/20"
                >
                  <Play className="w-12 h-12 text-green-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Oyun Sunucusu</h3>
                  <p className="text-blue-200 text-sm">Quiz oyununu başlatın ve yönetin</p>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-2 text-blue-300">
                <Trophy className="w-5 h-5" />
                <span className="text-sm">MODERN QUIZ</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
      {renderView()}
    </ErrorBoundary>
  );
}

export default App;