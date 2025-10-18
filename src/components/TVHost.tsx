import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Users, Trophy, RotateCcw, Shuffle, QrCode, Copy, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import QRCode from 'qrcode';

interface TVHostProps {
  onBack: () => void;
}

interface Question {
  question: string;
  answer: string;
}

interface PlayerCount {
  total: number;
  answered: number;
}

interface GameResult {
  correct: number;
  closest: string;
  winners?: string[];
  allAnswers?: Array<{
    playerName: string;
    answer: number;
    difference: number;
    isCorrect: boolean;
    hasAnswered: boolean;
  }>;
}

const TVHost: React.FC<TVHostProps> = ({ onBack }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameMode, setGameMode] = useState<'sequential' | 'random' | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState<PlayerCount>({ total: 0, answered: 0 });
  const [participantNames, setParticipantNames] = useState<string[]>([]);
  const [timer, setTimer] = useState(30);
  const [showResult, setShowResult] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [showFinalRankings, setShowFinalRankings] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [toasts, setToasts] = useState<Array<{id: string, message: string, type: 'success' | 'info' | 'warning'}>>([]);

  const joinLink = `${window.location.origin}/#player`;

  // Toast notification sistemi
  const addToast = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // 4 saniye sonra toast'ı kaldır
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  };

  useEffect(() => {
    console.log('🔌 TV Host socket bağlantısı kuruluyor...');
    
    // Optimize edilmiş socket konfigürasyonu
    const socketConnection = io(import.meta.env.VITE_SERVER_URL || 'https://bil-bakalim.onrender.com', {
      transports: ['polling', 'websocket'], // Polling öncelikli
      upgrade: true, // WebSocket'e upgrade et
      timeout: 30000, // Daha uzun timeout
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 20, // Daha fazla deneme
      reconnectionDelay: 2000, // Daha uzun gecikme
      reconnectionDelayMax: 10000, // Daha uzun maksimum gecikme
      autoConnect: true
    });
    
    setSocket(socketConnection);

    // Bağlantı durumu takibi
    socketConnection.on('connect', () => {
      console.log('✅ TV Host socket bağlantısı kuruldu:', socketConnection.id);
      setConnectionStatus('connected');
      
      // Bağlantı kurulduğunda hemen ping gönder
      socketConnection.emit('ping', { timestamp: Date.now(), source: 'tvhost' });
      
      // Mevcut katılımcıları iste
      console.log('📋 Mevcut katılımcıları istiyorum...');
      setTimeout(() => {
        if (socketConnection && socketConnection.connected) {
          socketConnection.emit('getParticipants');
          console.log('📤 getParticipants event gönderildi');
        } else {
          console.error('❌ Socket bağlantısı yok, getParticipants gönderilemedi');
        }
      }, 100);
    });

    socketConnection.on('disconnect', (reason) => {
      console.log('❌ TV Host socket bağlantısı kesildi:', reason);
      setConnectionStatus('disconnected');
      // Bağlantı kesildiğinde oyuncu listesini temizle
      setParticipantNames([]);
      console.log('🧹 Bağlantı kesildi, oyuncu listesi temizlendi');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('❌ TV Host bağlantı hatası:', error);
      setConnectionStatus('disconnected');
      
      // Polling ile yeniden dene
      setTimeout(() => {
        if (!socketConnection.connected) {
          console.log('🔄 TV Host Polling ile yeniden bağlanmaya çalışılıyor...');
          socketConnection.connect();
        }
      }, 3000);
    });

    // Soruları yükle
    const loadQuestions = async () => {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('📋 Sunucu durumu alındı:', data);
        
        // Sunucudan soru sayısını al, soru listesini de yükle
        if (data.questions > 0) {
          const questionsResponse = await fetch('/api/questions');
          if (questionsResponse.ok) {
            const questionsData = await questionsResponse.json();
            console.log('📋 Sorular yüklendi:', questionsData.length);
            setQuestions(questionsData);
          }
        }
      } catch (err) {
        console.error('❌ Sorular yüklenemedi:', err);
        setQuestions([]);
      }
    };

    loadQuestions();

    // QR kod oluştur
    QRCode.toDataURL(joinLink, { width: 300, margin: 2 })
      .then(url => {
        console.log('📱 QR kod oluşturuldu');
        setQrCodeUrl(url);
      })
      .catch(err => console.error('❌ QR kod oluşturulamadı:', err));

    // Socket eventleri
    socketConnection.on('playerCount', (count: PlayerCount) => {
      console.log('👥 Oyuncu sayısı güncellendi:', count);
      setPlayerCount(count);
    });

    socketConnection.on('playerJoined', (playerName: string) => {
      console.log('👤 Oyuncu katıldı:', playerName);
      addToast(`🎉 ${playerName} oyuna katıldı!`, 'success');
    });

    socketConnection.on('playerLeft', (playerName: string) => {
      console.log('👋 Oyuncu ayrıldı:', playerName);
      addToast(`👋 ${playerName} oyundan ayrıldı!`, 'info');
    });

    // Tüm katılımcıları al
    socketConnection.on('allParticipants', (participants: string[]) => {
      console.log('👥 Tüm katılımcılar alındı:', participants);
      console.log('👥 Katılımcı sayısı:', participants.length);
      console.log('👥 Socket bağlantı durumu:', socketConnection.connected);
      
      if (Array.isArray(participants)) {
        // Katılımcıları ters sırada göster (son katılan üstte)
        const reversedParticipants = [...participants].reverse();
        setParticipantNames(reversedParticipants);
        console.log('✅ Katılımcılar güncellendi:', reversedParticipants);
      } else {
        console.error('❌ Geçersiz katılımcı verisi:', participants);
        setParticipantNames([]);
      }
    });

    socketConnection.on('timerUpdate', (data: { timeLeft: number }) => {
      console.log('⏰ Host süre güncellendi:', data.timeLeft);
      setTimer(data.timeLeft);
      
      // Son 5 saniyede ses efekti çal
      if (data.timeLeft <= 5 && data.timeLeft > 0) {
        playSound('tick');
      } else if (data.timeLeft === 0) {
        playSound('final');
      }
    });

    socketConnection.on('showResult', (result: GameResult) => {
      console.log('📊 Sonuç alındı:', result);
      setGameResult(result);
      setShowResult(true);
      setTimer(0);
    });

    socketConnection.on('updateScores', (newScores: Record<string, number>) => {
      console.log('🏆 Skorlar güncellendi:', newScores);
      setScores(newScores);
    });

    socketConnection.on('gameEnded', (finalScores: Record<string, number>) => {
      console.log('🏁 Oyun bitti, final skorları:', finalScores);
      setScores(finalScores);
      setShowFinalRankings(true);
    });

    return () => {
      socketConnection.disconnect();
    };
  }, [joinLink]);

  // Ses çalma fonksiyonu
  const playSound = (type: 'tick' | 'final') => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (type === 'tick') {
      // Basit tick sesi - Web Audio API ile oluşturulmuş
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === 'final') {
      // Final sesi
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.5);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  };

  // Client-side timer kaldırıldı - sadece server'dan gelen timer kullanılıyor

  const startGame = (mode: 'sequential' | 'random') => {
    console.log('🎮 Oyun modu seçildi:', mode);
    setGameMode(mode);
    setWaitingForPlayers(true);
    if (mode === 'random') {
      setQuestions(prev => [...prev].sort(() => Math.random() - 0.5));
      console.log('🔀 Sorular karıştırıldı');
    }
  };

  const startQuizGame = () => {
    console.log('🚀 Quiz oyunu başlatılıyor...');
    console.log('📊 Mevcut durum:', { 
      questionsLength: questions.length, 
      currentQuestionIndex, 
      socketConnected: socket?.connected,
      playerCount: playerCount.total 
    });
    
    setWaitingForPlayers(false);
    
    // Sorular yüklenmemişse yükle
    if (questions.length === 0) {
      console.log('📝 Sorular yükleniyor...');
      if (socket) {
        socket.emit('getQuestions');
      }
      return;
    }
    
    // Socket bağlantısı yoksa uyar
    if (!socket) {
      console.log('❌ Socket bağlantısı yok');
      return;
    }
    
    // Oyun başladığında ilk soruyu otomatik başlat
    setTimeout(() => {
      if (currentQuestionIndex < questions.length && socket) {
        const question = questions[currentQuestionIndex];
        console.log('📝 İlk soru otomatik başlatılıyor:', question);
        
        setTimer(30);
        setShowResult(false);
        setGameResult(null);
        
        socket.emit('startQuestion', question);
        // Süre sayacını oyunculara gönder
        socket.emit('startTimer', { duration: 30 });
      }
    }, 1000);
    
    if (socket) {
      console.log('📤 startGame event gönderiliyor...');
      socket.emit('startGame');
    } else {
      console.error('❌ Socket bağlantısı yok!');
    }
  };

  const nextQuestion = () => {
    if (socket) {
      socket.emit('nextQuestion');
    }
  };

  const endGame = () => {
    if (socket) {
      socket.emit('endGame');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      setLinkCopied(true);
      addToast('🔗 Link kopyalandı!', 'success');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('❌ Link kopyalanamadı:', err);
      addToast('❌ Link kopyalanamadı', 'warning');
    }
  };

  const goBackToModeSelection = () => {
    setGameMode(null);
    setWaitingForPlayers(false);
    setShowFinalRankings(false);
    setParticipantNames([]);
    setPlayerCount({ total: 0, answered: 0 });
  };

  // Oyuncu listesi componenti
  const PlayerList = () => {
    if (participantNames.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-green-600/20 rounded-full mx-auto mb-4"></div>
            <p className="text-green-200">Oyuncular bekleniyor...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {participantNames.map((name, index) => (
          <div
            key={`${name}-${index}`}
            className="text-white text-lg py-2 px-3 hover:bg-white/10 rounded transition-colors duration-200"
            style={{
              animation: `slideInFromRight 0.6s ease-out forwards`,
              animationDelay: `${index * 0.15}s`,
              transform: 'translateX(100%)',
              opacity: 0
            }}
          >
            <span className="font-medium">{name}</span>
          </div>
        ))}
      </div>
    );
  };

  // Toast Component
  const ToastContainer = () => (
    <div className="fixed top-4 right-2 md:right-4 z-50 space-y-2 mobile-safe-top">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 md:px-6 py-2 md:py-3 rounded-lg shadow-lg backdrop-blur-lg border animate-slideInRight mobile-btn ${
            toast.type === 'success' 
              ? 'bg-green-600/90 text-white border-green-500/30' 
              : toast.type === 'warning'
              ? 'bg-yellow-600/90 text-white border-yellow-500/30'
              : 'bg-blue-600/90 text-white border-blue-500/30'
          }`}
          style={{
            animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-in 3.7s forwards'
          }}
        >
          <div className="flex items-center mobile-flex-row mobile-items-center">
            {toast.type === 'success' && '🎉'}
            {toast.type === 'warning' && '⚠️'}
            {toast.type === 'info' && 'ℹ️'}
            <span className="ml-2 font-medium mobile-text-sm">{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // Bağlantı durumu göstergesi
  const ConnectionIndicator = () => (
    <div className={`flex items-center space-x-2 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm mobile-text-xs ${
      connectionStatus === 'connected' 
        ? 'bg-green-100 text-green-800' 
        : connectionStatus === 'connecting'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800'
    }`}>
      {connectionStatus === 'connected' ? (
        <Wifi className="w-3 h-3 md:w-4 md:h-4" />
      ) : connectionStatus === 'connecting' ? (
        <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <WifiOff className="w-3 h-3 md:w-4 md:h-4" />
      )}
      <span className="mobile-text-xs">
        {connectionStatus === 'connected' && 'Sunucu Bağlı'}
        {connectionStatus === 'connecting' && 'Bağlanıyor...'}
        {connectionStatus === 'disconnected' && 'Sunucu Bağlantısı Yok'}
      </span>
    </div>
  );

  if (showFinalRankings) {
    const sortedScores = Object.entries(scores).sort(([,a], [,b]) => b - a);
    
    return (
      <div translate="no" className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={goBackToModeSelection}
              className="flex items-center text-white hover:text-green-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Ana Menü
            </button>
            <ConnectionIndicator />
          </div>

          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 relative overflow-hidden">
              <h1 className="text-4xl font-bold text-white mb-6">🏆 Oyun Bitti! 🏆</h1>
              <p className="text-xl text-gray-300 mb-8">Final Sıralaması</p>
              
              <div className="space-y-4">
                {sortedScores.map(([playerName, score], index) => (
                  <div key={playerName} className="flex justify-between items-center bg-white/5 rounded-lg p-4">
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl font-bold text-yellow-400">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </span>
                      <span className="text-xl text-white">{playerName}</span>
                    </div>
                    <span className="text-2xl font-bold text-green-400">{score} puan</span>
                  </div>
                ))}
              </div>
            </div>
            
            <button
              onClick={goBackToModeSelection}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xl px-8 py-4 rounded-xl transition-colors"
            >
              🔄 Yeni Oyun
            </button>
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div translate="no" className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={onBack}
            className="flex items-center text-white hover:text-yellow-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Menü
          </button>
          <ConnectionIndicator />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Panel - Oyun Kontrolü */}
          <div className="lg:col-span-2 space-y-6">
            {!gameMode ? (
              /* Oyun Modu Seçimi */
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <h1 className="text-4xl font-bold text-white mb-6 text-center">📺 BİL BAKALIM TV</h1>
                <p className="text-xl text-gray-300 mb-8 text-center">Google TV için Interaktif Quiz</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => startGame('sequential')}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xl px-8 py-6 rounded-2xl transition-colors flex items-center justify-center space-x-3"
                  >
                    <Play className="w-6 h-6" />
                    <span>📋 Sıralı Oyun</span>
                  </button>
                  
                  <button
                    onClick={() => startGame('random')}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xl px-8 py-6 rounded-2xl transition-colors flex items-center justify-center space-x-3"
                  >
                    <Shuffle className="w-6 h-6" />
                    <span>🔀 Rastgele Oyun</span>
                  </button>
                </div>
              </div>
            ) : waitingForPlayers ? (
              /* Oyuncu Bekleme Ekranı */
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <h2 className="text-3xl font-bold text-white mb-6 text-center">👥 Oyuncular Bekleniyor</h2>
                
                {/* QR Kod ve Link */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-4">📱 QR Kod</h3>
                    {qrCodeUrl && (
                      <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-4 rounded-lg shadow-lg" />
                    )}
                    <p className="text-gray-300 text-sm">Oyuncular bu QR kodu okutarak katılabilir</p>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-4">🔗 Katılım Linki</h3>
                    <div className="bg-white/10 rounded-lg p-4 mb-4">
                      <p className="text-blue-200 font-mono text-sm break-all">{joinLink}</p>
                    </div>
                    <button
                      onClick={copyLink}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center mx-auto"
                    >
                      {linkCopied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      {linkCopied ? 'Kopyalandı!' : 'Linki Kopyala'}
                    </button>
                  </div>
                </div>
                
                {/* Oyuncu Sayısı */}
                <div className="text-center mb-8">
                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-2xl font-bold text-white mb-2">👥 Oyuncular</h3>
                    <div className="text-4xl font-bold text-green-400 mb-2">{playerCount.total}</div>
                    <p className="text-gray-300">
                      {playerCount.total > 0 ? 'Oyuncular hazır!' : 'Oyuncu bekleniyor...'}
                    </p>
                  </div>
                </div>
                
                {/* Oyunu Başlat Butonu */}
                <div className="text-center">
                  <button
                    onClick={startQuizGame}
                    disabled={playerCount.total === 0}
                    className={`text-2xl px-12 py-6 rounded-2xl transition-colors ${
                      playerCount.total > 0
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {playerCount.total > 0 ? '🎮 Oyunu Başlat' : '⏳ Oyuncu Bekleniyor...'}
                  </button>
                </div>
              </div>
            ) : (
              /* Oyun Aktif Ekranı */
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-4">🎮 Oyun Aktif</h2>
                  <div className="text-6xl font-bold text-yellow-400 mb-4">⏰ {timer}</div>
                  <p className="text-xl text-gray-300">Soru {currentQuestionIndex + 1} / {questions.length}</p>
                </div>
                
                {showResult && gameResult ? (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">🏆 Sonuçlar</h3>
                    <div className="text-3xl font-bold text-green-400 mb-4">
                      Doğru Cevap: {gameResult.correct}
                    </div>
                    <div className="text-xl text-yellow-400 mb-6">
                      {gameResult.winners && gameResult.winners.length > 0 
                        ? `🏆 Kazanan: ${gameResult.winners.join(', ')}`
                        : `🎯 En Yakın: ${gameResult.closest}`
                      }
                    </div>
                    
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={nextQuestion}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xl px-8 py-4 rounded-xl transition-colors"
                      >
                        ➡️ Sonraki Soru
                      </button>
                      <button
                        onClick={endGame}
                        className="bg-red-600 hover:bg-red-700 text-white text-xl px-8 py-4 rounded-xl transition-colors"
                      >
                        🏁 Oyunu Bitir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-2xl text-white mb-4">Soru yanıtlanıyor...</div>
                    <div className="text-lg text-gray-300">
                      {playerCount.answered} / {playerCount.total} oyuncu cevapladı
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sağ Panel - Oyuncu Listesi */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Oyuncular
                </h3>
                <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                  {participantNames.length}
                </div>
              </div>
              <PlayerList />
            </div>
          </div>
        </div>
      </div>
      
      <ToastContainer />
    </div>
  );
};

export default TVHost;