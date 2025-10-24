import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Users, Trophy, RotateCcw, Shuffle, QrCode, Copy, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import QRCode from 'qrcode';
import { getDeviceInfo } from '../utils/deviceDetection';

interface QuizHostProps {
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

const QuizHost: React.FC<QuizHostProps> = ({ onBack }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [gameMode, setGameMode] = useState<'sequential' | 'random' | null>(null);
  const deviceInfo = getDeviceInfo();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState<PlayerCount>({ total: 0, answered: 0 });
  const [participantNames, setParticipantNames] = useState<string[]>([]);
  const [answeredPlayers, setAnsweredPlayers] = useState<Array<{name: string, answerTime: number}>>([]);
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

  const joinLink = roomId ? `${window.location.origin}/#player?room=${roomId}` : `${window.location.origin}/#player`;

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
    console.log('🔌 Quiz Host socket bağlantısı kuruluyor...');
    
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
      console.log('✅ Quiz Host socket bağlantısı kuruldu:', socketConnection.id);
      setConnectionStatus('connected');
      
      // Bağlantı kurulduğunda hemen ping gönder
      socketConnection.emit('ping', { timestamp: Date.now(), source: 'host' });
      
      // Room oluştur
      socketConnection.emit('createRoom', (response: { roomId: string, success: boolean }) => {
        if (response.success) {
          setRoomId(response.roomId);
          console.log('🏠 Room oluşturuldu:', response.roomId);
          addToast(`🏠 Oyun odası oluşturuldu: ${response.roomId}`, 'success');
        }
      });
    });

    // Room oluşturuldu event'i
    socketConnection.on('roomCreated', (data: { roomId: string }) => {
      setRoomId(data.roomId);
      console.log('🏠 Room ID alındı:', data.roomId);
    });

    socketConnection.on('disconnect', (reason) => {
      console.log('❌ Quiz Host socket bağlantısı kesildi:', reason);
      setConnectionStatus('disconnected');
      // Bağlantı kesildiğinde oyuncu listesini temizle
      setParticipantNames([]);
      console.log('🧹 Bağlantı kesildi, oyuncu listesi temizlendi');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('❌ Quiz Host bağlantı hatası:', error);
      setConnectionStatus('disconnected');
      
      // Polling ile yeniden dene
      setTimeout(() => {
        if (!socketConnection.connected) {
          console.log('🔄 Quiz Host Polling ile yeniden bağlanmaya çalışılıyor...');
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

    // Socket eventleri
    socketConnection.on('playerCount', (count: PlayerCount) => {
      console.log('👥 QuizHost Oyuncu sayısı güncellendi:', count);
      console.log('👥 QuizHost Total:', count.total, 'Answered:', count.answered);
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

    socketConnection.on('playerAnswered', (data: {playerName: string, answerTime: number}) => {
      console.log('📝 Oyuncu cevap verdi:', data);
      setAnsweredPlayers(prev => {
        const existing = prev.find(p => p.name === data.playerName);
        if (existing) {
          return prev.map(p => p.name === data.playerName ? {...p, answerTime: data.answerTime} : p);
        } else {
          return [...prev, {name: data.playerName, answerTime: data.answerTime}];
        }
      });
    });

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  // QR kod oluşturma - roomId her değiştiğinde yeniden oluştur
  useEffect(() => {
    if (joinLink && roomId) {
      console.log('🔄 QR kod oluşturuluyor, Room ID:', roomId, 'Link:', joinLink);
      QRCode.toDataURL(joinLink, { width: 300, margin: 2 })
        .then(url => {
          console.log('✅ QR kod oluşturuldu');
          setQrCodeUrl(url);
        })
        .catch(err => console.error('❌ QR kod oluşturulamadı:', err));
    }
  }, [joinLink, roomId]);

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
        socket.emit('timerUpdate', { timeLeft: 30 });
      } else {
        console.log('❌ Soru başlatılamadı:', { 
          currentQuestionIndex, 
          questionsLength: questions.length,
          socketConnected: socket?.connected 
        });
      }
    }, 1000); // 1 saniye bekle, sonra soruyu başlat
  };

  const nextQuestion = () => {
    console.log('➡️ Sonraki soruya geçiliyor...');
    setCurrentQuestionIndex(prev => prev + 1);
    setShowResult(false);
    setGameResult(null);
    setAnsweredPlayers([]); // Cevap verenler listesini temizle
    
    // Sonraki soruyu otomatik başlat
    setTimeout(() => {
      if (currentQuestionIndex + 1 < questions.length && socket) {
        const question = questions[currentQuestionIndex + 1];
        console.log('📝 Sonraki soru otomatik başlatılıyor:', question);
        
        setTimer(30);
        setShowResult(false);
        setGameResult(null);
        
        socket.emit('startQuestion', question);
        // Süre sayacını oyunculara gönder
        socket.emit('timerUpdate', { timeLeft: 30 });
      }
    }, 1000); // 1 saniye bekle, sonra soruyu başlat
  };

  const endGame = () => {
    console.log('🏁 Oyun sonlandırılıyor...');
    if (socket) {
      socket.emit('endGame');
    }
    setShowFinalRankings(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      console.log('📋 Link kopyalandı');
    } catch (err) {
      console.error('❌ Link kopyalanamadı:', err);
    }
  };

  const goBackToModeSelection = () => {
    console.log('🔙 Mod seçimine dönülüyor...');
    
    // Server'a yeni oyun başlatma sinyali gönder
    if (socket) {
      socket.emit('startNewGame');
    }
    
    setGameMode(null);
    setWaitingForPlayers(false);
    setCurrentQuestionIndex(0);
    setShowResult(false);
    setScores({});
    setShowFinalRankings(false);
    setParticipantNames([]);
  };

  // Katılımcı Listesi Komponenti
  const ParticipantList = () => {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
        <div className="flex items-center justify-center mb-4">
          <h3 className="text-xl font-semibold text-white">🎉 Katılımcılar</h3>
        </div>
        
        {participantNames.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-green-600/20 rounded-full mx-auto mb-4"></div>
              <p className="text-green-200">Oyuncular bekleniyor...</p>
            </div>
          </div>
        ) : (
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
        )}
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
        <div className={`mx-auto ${deviceInfo.isMobile || deviceInfo.isTablet ? 'max-w-4xl' : 'max-w-full'}`}>
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
              
              {/* Kazanan animasyonu */}
              {sortedScores.length > 0 && (
                <div className="mb-8 relative">
                  {/* Havai Fişek Animasyonu */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-yellow-400 rounded-full animate-fireworks" style={{ animationDelay: '0s', animationDuration: '2s' }}></div>
                    <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-orange-400 rounded-full animate-fireworks" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }}></div>
                    <div className="absolute top-1/2 left-1/3 w-5 h-5 bg-red-400 rounded-full animate-fireworks" style={{ animationDelay: '1s', animationDuration: '2.2s' }}></div>
                    <div className="absolute top-2/3 right-1/3 w-3 h-3 bg-pink-400 rounded-full animate-fireworks" style={{ animationDelay: '1.5s', animationDuration: '2.8s' }}></div>
                    <div className="absolute top-3/4 left-1/2 w-4 h-4 bg-purple-400 rounded-full animate-fireworks" style={{ animationDelay: '2s', animationDuration: '2.3s' }}></div>
                    
                    {/* Sparkle Effects */}
                    <div className="absolute top-1/4 left-1/2 w-2 h-2 bg-white rounded-full animate-sparkle" style={{ animationDelay: '0.3s', animationDuration: '1.5s' }}></div>
                    <div className="absolute top-1/2 right-1/2 w-2 h-2 bg-yellow-300 rounded-full animate-sparkle" style={{ animationDelay: '0.8s', animationDuration: '1.8s' }}></div>
                    <div className="absolute top-3/4 left-1/4 w-2 h-2 bg-orange-300 rounded-full animate-sparkle" style={{ animationDelay: '1.3s', animationDuration: '1.6s' }}></div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-yellow-400/20 to-orange-500/20 rounded-xl p-6 border border-yellow-400/30 relative z-10">
                    <h3 className="text-2xl font-semibold text-yellow-300 mb-4">🏆 TEBRİKLER KAZANAN</h3>
                    <div className="relative">
                      <p className="text-white text-6xl font-bold animate-pulse" style={{
                        animation: 'heartbeat 1.5s ease-in-out infinite, glow 2s ease-in-out infinite alternate'
                      }}>
                        {sortedScores[0][0]}
                      </p>
                      <p className="text-yellow-300 text-2xl font-semibold mt-2">
                        {sortedScores[0][1]} Puan
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-green-300 mb-4">Final Sıralaması</h2>
                <div className="space-y-2">
                  {sortedScores.map(([name, score], index) => (
                    <div
                      key={name}
                      className={`flex justify-between items-center p-4 rounded-lg transition-all duration-300 ${
                        index === 0 ? 'animate-pulse bg-yellow-600/20' : 'bg-white/10'
                      }`}
                    >
                      <span className="text-white flex items-center text-lg">
                        {index === 0 && <Trophy className="w-6 h-6 text-yellow-400 mr-3" />}
                        {index + 1} - {name}
                        {index === 0 && <span className="ml-3 text-yellow-400 font-bold text-xl">👑</span>}
                      </span>
                      <span className="text-blue-300 font-semibold text-lg">{score} puan</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={goBackToModeSelection}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Yeni Oyun
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameMode) {
  return (
    <div translate="no" className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 flex items-center justify-center p-4 mobile-safe-top mobile-safe-bottom">
      <div className="max-w-2xl w-full text-center mobile-container">
          <div className="flex justify-between items-center mb-6 md:mb-8 mobile-flex-row mobile-justify-between mobile-items-center">
            <button
              onClick={onBack}
              className="flex items-center text-white hover:text-green-300 transition-colors mobile-btn mobile-touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 mr-2" />
              <span className="mobile-text-sm">Ana Menü</span>
            </button>
            <ConnectionIndicator />
          </div>

          <h1 className={`font-bold text-white mb-6 md:mb-8 ${
            deviceInfo.isMobile ? 'text-2xl mobile-text-2xl' : 
            deviceInfo.isTablet ? 'text-3xl mobile-text-3xl' : 
            'text-3xl md:text-5xl mobile-text-3xl'
          }`}>🎮 MODERN QUIZ</h1>
          <p className={`text-green-200 mb-8 md:mb-12 ${
            deviceInfo.isMobile ? 'text-base mobile-text-base' : 
            deviceInfo.isTablet ? 'text-lg mobile-text-lg' : 
            'text-lg md:text-xl mobile-text-lg'
          }`}>Oyun modunu seçin ve başlayın</p>

          {questions.length === 0 && (
            <div className="mb-6 md:mb-8 p-3 md:p-4 bg-yellow-100 border border-yellow-200 rounded-lg text-yellow-800 mobile-text-sm">
              ⚠️ Henüz soru eklenmemiş. Admin panelinden soru ekleyin.
            </div>
          )}

          <div className={`grid gap-4 md:gap-6 ${
            deviceInfo.isMobile ? 'grid-cols-1 mobile-grid-1' : 
            deviceInfo.isTablet ? 'grid-cols-1 mobile-grid-1' : 
            'grid-cols-1 md:grid-cols-2 mobile-grid-1'
          }`}>
            <button
              onClick={() => startGame('sequential')}
              disabled={questions.length === 0 || connectionStatus !== 'connected'}
              className={`bg-white/10 backdrop-blur-lg rounded-2xl hover:bg-white/20 transition-all duration-300 border border-white/20 group disabled:opacity-50 disabled:cursor-not-allowed mobile-btn mobile-touch-manipulation ${
                deviceInfo.isMobile ? 'p-4' : 
                deviceInfo.isTablet ? 'p-6' : 
                'p-6 md:p-8'
              }`}
            >
              <RotateCcw className={`text-blue-300 mx-auto mb-3 md:mb-4 group-hover:scale-110 transition-transform ${
                deviceInfo.isMobile ? 'w-8 h-8' : 
                deviceInfo.isTablet ? 'w-10 h-10' : 
                'w-10 h-10 md:w-12 md:h-12'
              }`} />
              <h3 className={`font-semibold text-white mb-2 ${
                deviceInfo.isMobile ? 'text-lg mobile-text-lg' : 
                deviceInfo.isTablet ? 'text-xl mobile-text-xl' : 
                'text-xl md:text-2xl mobile-text-xl'
              }`}>Sıralı Mod</h3>
              <p className="text-green-200 mobile-text-sm">Sorular sırasıyla gelir</p>
            </button>

            <button
              onClick={() => startGame('random')}
              disabled={questions.length === 0 || connectionStatus !== 'connected'}
              className={`bg-white/10 backdrop-blur-lg rounded-2xl hover:bg-white/20 transition-all duration-300 border border-white/20 group disabled:opacity-50 disabled:cursor-not-allowed mobile-btn mobile-touch-manipulation ${
                deviceInfo.isMobile ? 'p-4' : 
                deviceInfo.isTablet ? 'p-6' : 
                'p-6 md:p-8'
              }`}
            >
              <Shuffle className={`text-purple-300 mx-auto mb-3 md:mb-4 group-hover:scale-110 transition-transform ${
                deviceInfo.isMobile ? 'w-8 h-8' : 
                deviceInfo.isTablet ? 'w-10 h-10' : 
                'w-10 h-10 md:w-12 md:h-12'
              }`} />
              <h3 className={`font-semibold text-white mb-2 ${
                deviceInfo.isMobile ? 'text-lg mobile-text-lg' : 
                deviceInfo.isTablet ? 'text-xl mobile-text-xl' : 
                'text-xl md:text-2xl mobile-text-xl'
              }`}>Rastgele Mod</h3>
              <p className="text-green-200 mobile-text-sm">Sorular karışık gelir</p>
            </button>
          </div>

          <div className="mt-8 text-center text-green-200">
            📋 Toplam {questions.length} soru yüklü
          </div>
        </div>
        
        {/* Toast Container */}
        <ToastContainer />
      </div>
    );
  }

  if (waitingForPlayers) {
    return (
      <div translate="no" className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 p-4">
        <div className={`mx-auto ${deviceInfo.isMobile || deviceInfo.isTablet ? 'max-w-4xl' : 'max-w-full'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={goBackToModeSelection}
              className="flex items-center text-white hover:text-green-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Mod Seçimi
            </button>
            
            <div className="flex items-center space-x-4">
              <ConnectionIndicator />
              <div className="bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 flex items-center">
                <Users className="w-5 h-5 text-blue-300 mr-2" />
                <span className="text-white">{playerCount.total} Oyuncu</span>
              </div>
            </div>
          </div>

          {/* Oyuncu Bekleme Ekranı */}
          <div className="text-center">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
              <h2 className="text-3xl font-bold text-white mb-6">👥 Oyuncular Katılıyor</h2>
              
              {/* Room ID */}
              {roomId && (
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center mb-2">
                    <h3 className="text-lg font-bold text-white">🎮 Oyun Kodu</h3>
                  </div>
                  <div className="bg-white/20 rounded-lg p-3">
                    <p className="text-3xl font-bold text-white text-center tracking-wider">{roomId}</p>
                  </div>
                  <p className="text-white/80 text-center mt-2 text-xs">Oyunculara bu kodu verin</p>
                </div>
              )}

              {/* QR Kod, Link ve Katılımcı Listesi - 3 Sütun Layout */}
              <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6 mb-8">
                {/* QR Kod */}
                <div className="bg-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-center mb-4">
                    <h3 className="text-xl font-semibold text-white">📱 QR Kod ile Katıl</h3>
                  </div>
                  {qrCodeUrl ? (
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <img src={qrCodeUrl} alt="QR Kod" className="w-48 h-48 mx-auto" />
                    </div>
                  ) : (
                    <div className="bg-white/10 rounded-lg p-12">
                      <div className="animate-pulse">QR Kod Yükleniyor...</div>
                    </div>
                  )}
                </div>

                {/* Link */}
                <div className="bg-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-center mb-4">
                    <h3 className="text-xl font-semibold text-white">🔗 Katılım Linki</h3>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 mb-4">
                    <p className="text-blue-200 font-mono text-sm break-all">{joinLink}</p>
                  </div>
                  <button
                    onClick={copyLink}
                    className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center mx-auto"
                  >
                    {linkCopied ? (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Kopyalandı!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5 mr-2" />
                        Linki Kopyala
                      </>
                    )}
                  </button>
                </div>

                {/* Katılımcı Listesi */}
                <div className="lg:col-span-1 md:col-span-2">
                  <ParticipantList />
                </div>
              </div>

              {/* Oyuncu Sayısı */}
              <div className="flex flex-col items-center mb-6">
                <div className="text-5xl font-bold text-blue-300">{playerCount.total}</div>
                <p className="text-lg text-white">Katılan Oyuncu</p>
              </div>

              {/* Başlat Butonu ve Uyarı */}
              <div className="flex flex-col items-center">
                <button
                  onClick={startQuizGame}
                  disabled={false}
                  className="bg-green-600 text-white px-12 py-4 rounded-xl hover:bg-green-700 transition-colors font-semibold text-xl flex items-center"
                >
                  <Play className="w-6 h-6 mr-3" />
                  Oyunu Başlat
                </button>
                
                <p className="text-blue-300 mt-3 text-base">Oyunu başlatmak için butona tıklayın</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Toast Container */}
        <ToastContainer />
      </div>
    );
  }

  return (
    <div translate="no" className="min-h-screen bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 p-4">
      <div className={`mx-auto ${deviceInfo.isMobile || deviceInfo.isTablet ? 'max-w-6xl' : 'max-w-full px-4'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center text-white hover:text-green-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Menü
          </button>
          
          {/* Sonraki Soru Butonu - Orta */}
          <div className="flex justify-center items-center gap-3">
            <button
              onClick={nextQuestion}
              disabled={currentQuestionIndex >= questions.length - 1}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              Sonraki Soru
            </button>
          </div>
          
          {/* Room ID, Bağlantı Durumu ve Oyuncu Sayısı - Sağ */}
          <div className="flex items-center gap-3">
            {roomId && (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 flex items-center">
                <span className="text-white font-medium">📍 Room: {roomId}</span>
              </div>
            )}
            <ConnectionIndicator />
            <div className="bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 flex items-center">
              <Users className="w-5 h-5 text-blue-300 mr-2" />
              <span className="text-white">{playerCount.total} Oyuncu</span>
            </div>
          </div>
        </div>

        {/* Ana İçerik */}
        <div className="text-center">
          <div className="space-y-8">
            {/* Gelişmiş Geri Sayım */}
            {currentQuestionIndex < questions.length && !showResult && timer > 0 && (
              <div className="flex justify-center mb-6 md:mb-8">
                <div className="relative">
                  {/* Dış çember - progress bar */}
                  <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full border-4 sm:border-6 md:border-8 border-purple-600 relative overflow-hidden bg-gradient-to-br from-purple-900 to-blue-900">
                    <div 
                      className={`absolute inset-0 rounded-full transition-all duration-1000 ${
                        timer <= 5 ? 'bg-gradient-to-br from-red-500 to-red-600' : 
                        timer <= 10 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 
                        'bg-gradient-to-br from-blue-400 to-blue-500'
                      }`}
                      style={{
                        clipPath: `polygon(0 0, ${(30 - timer) * 100 / 30}% 0, ${(30 - timer) * 100 / 30}% 100%, 0% 100%)`,
                        animation: timer <= 5 ? 'pulse 1s infinite' : 'none'
                      }}
                    ></div>
                    
                    {/* Dalga efekti - son 5 saniye */}
                    {timer <= 5 && (
                      <div className="absolute inset-0 rounded-full animate-ping bg-red-400/30"></div>
                    )}
                  </div>
                  
                  {/* İç sayı */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`text-4xl sm:text-5xl md:text-7xl font-black transition-all duration-500 transform ${
                      timer <= 5 ? 'animate-bounce text-white scale-110' : 
                      timer <= 10 ? 'animate-pulse text-white scale-105' : 
                      'text-white'
                    } ${timer <= 3 ? 'drop-shadow-2xl' : 'drop-shadow-lg'}`}
                    style={{
                      textShadow: timer <= 5 ? '0 0 30px rgba(239, 68, 68, 1), 0 0 60px rgba(239, 68, 68, 0.5), 2px 2px 4px rgba(0,0,0,0.8)' : 
                                 timer <= 10 ? '0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(251, 191, 36, 0.4), 2px 2px 4px rgba(0,0,0,0.8)' : 
                                 '0 0 15px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.3), 2px 2px 4px rgba(0,0,0,0.8)',
                      filter: timer <= 5 ? 'brightness(1.2)' : timer <= 10 ? 'brightness(1.1)' : 'brightness(1)',
                      color: timer <= 5 ? '#ef4444' : timer <= 10 ? '#fbbf24' : '#3b82f6'
                    }}>
                      {timer}
                    </div>
                  </div>
                  
                  {/* Parlama efekti */}
                  {timer <= 5 && (
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-ping"></div>
                  )}
                </div>
              </div>
            )}

            {/* Soru */}
            {currentQuestionIndex < questions.length && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
                <div className="flex justify-center items-center mb-6">
                  <span className="text-green-300 font-semibold">
                    📝 Soru {currentQuestionIndex + 1} / {questions.length}
                  </span>
                </div>
                
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8 px-4 break-words">
                  {questions[currentQuestionIndex]?.question}
                </h3>

                {/* Cevap Verenler Listesi */}
                {!showResult && (
                  <div className="bg-white/5 rounded-lg p-6 mb-8">
                    <h4 className="text-blue-300 font-semibold mb-4 text-center">📝 Cevap Verenler</h4>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400 mb-2">
                        {playerCount.answered} / {playerCount.total}
                      </div>
                      <p className="text-gray-300 mb-4">
                        {playerCount.answered === playerCount.total 
                          ? '🎉 Tüm oyuncular cevap verdi!' 
                          : `${playerCount.total - playerCount.answered} oyuncu daha cevap bekleniyor...`
                        }
                      </p>
                      
                      {/* Cevap Veren Oyuncular Listesi */}
                      {answeredPlayers.length > 0 && (
                        <div className="mt-4">
                          <h5 className="text-blue-300 font-semibold mb-3">⚡ Cevap Verenler</h5>
                          <div className="space-y-2">
                            {answeredPlayers.map((player, index) => (
                              <div key={player.name} className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                                <span className="text-white font-medium">
                                  {index + 1}. {player.name}
                                </span>
                                <span className="text-yellow-400 font-bold">
                                  {player.answerTime}s ⚡
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                    </div>
                  </div>
                )}

                {showResult && (
                  <div className="space-y-4">
                    <div className="bg-green-600/20 rounded-lg p-4">
                      <h4 className="text-green-300 font-semibold mb-2">✅ Doğru Cevap</h4>
                      <p className="text-white text-3xl sm:text-4xl md:text-6xl font-bold">{gameResult?.correct}</p>
                    </div>
                    
                    <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg p-6 relative overflow-hidden">
                      <h4 className="text-blue-300 font-semibold mb-4">🎯 Doğru veya En Yakın Cevap Veren</h4>
                      <div className="relative">
                        {/* Kazanan isimlerini göster */}
                        {gameResult?.winners && gameResult.winners.length > 0 ? (
                          <div className="space-y-3">
                            {/* Tek kazanan varsa büyük göster */}
                            {gameResult.winners.length === 1 ? (
                              <p className="text-white text-2xl sm:text-3xl md:text-5xl font-bold text-center animate-pulse" style={{
                                animation: 'heartbeat 1.5s ease-in-out infinite, glow 2s ease-in-out infinite alternate'
                              }}>{gameResult.winners[0]}</p>
                            ) : (
                              /* Birden fazla kazanan varsa liste halinde göster */
                              <div className="space-y-2">
                                <p className="text-blue-300 text-lg mb-3">Aynı cevabı veren kazananlar:</p>
                                {gameResult.winners.map((winner, index) => (
                                  <div key={winner} className="bg-white/10 rounded-lg p-3 animate-slideInRight" style={{
                                    animationDelay: `${index * 0.2}s`
                                  }}>
                                    <p className="text-white text-2xl font-bold text-center animate-pulse">
                                      🏆 {winner}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Cevap bilgisi */}
                            <p className="text-blue-300 text-lg mt-4">
                              Cevap: {gameResult.closest.includes('(') ? gameResult.closest.split('(')[1].replace(')', '') : gameResult.correct}
                            </p>
                          </div>
                        ) : (
                          <p className="text-white text-3xl font-bold text-center">
                            Kimse doğru bilmedi
                          </p>
                        )}
                        
                        {/* Konfeti efekti */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                          <div className="absolute top-0 left-3/4 w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
                          <div className="absolute top-0 left-1/2 w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
                          <div className="absolute bottom-0 left-1/3 w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '1.5s' }}></div>
                          <div className="absolute bottom-0 left-2/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '2s' }}></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Cevap Listesi */}
                    {gameResult?.allAnswers && gameResult.allAnswers.length > 0 && (
                      <div className="mt-6 bg-white/5 rounded-lg p-4">
                        <h5 className="text-blue-300 font-semibold mb-3 text-center">📋 Tüm Cevaplar</h5>
                        <div className="space-y-2">
                          {gameResult.allAnswers.map((answer, index) => (
                            <div key={index} className={`flex justify-between items-center p-2 rounded-lg ${
                              !answer.hasAnswered ? 'bg-red-600/20 border border-red-500/30' :
                              answer.isCorrect ? 'bg-green-600/20 border border-green-500/30' : 
                              answer.difference <= 5 ? 'bg-yellow-600/20 border border-yellow-500/30' :
                              'bg-gray-600/20 border border-gray-500/30'
                            }`}>
                              <div className="flex items-center">
                                <span className={`text-sm font-bold mr-2 ${
                                  !answer.hasAnswered ? 'text-red-300' :
                                  answer.isCorrect ? 'text-green-300' : 
                                  answer.difference <= 5 ? 'text-yellow-300' : 'text-gray-300'
                                }`}>
                                  {index + 1}.
                                </span>
                                <span className="text-white font-medium">{answer.playerName}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                {!answer.hasAnswered ? (
                                  <span className="text-red-300 font-bold">Cevap yok</span>
                                ) : (
                                  <>
                                    <span className="text-white font-bold">{answer.answer}</span>
                                    {answer.isCorrect && <span className="text-green-300 text-xs">✓</span>}
                                    {!answer.isCorrect && gameResult.allAnswers && answer.difference === Math.min(...gameResult.allAnswers.filter(a => a.hasAnswered).map(a => a.difference)) && <span className="text-yellow-300 text-xs">🎯</span>}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* Oyunu Bitir Butonu */}
            <div className="flex justify-center">
              <button
                onClick={endGame}
                className="bg-red-600 text-white px-8 py-4 rounded-lg hover:bg-red-700 transition-colors font-medium text-lg"
              >
                🏁 Oyunu Bitir
              </button>
            </div>
          </div>
        </div>

        {/* Skorlar */}
        {Object.keys(scores).length > 0 && (
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-white mb-4 text-center">🏆 Puan Durumu</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {Object.entries(scores)
                .sort(([,a], [,b]) => b - a)
                .map(([name, score], index) => (
                  <div key={name} className="bg-white/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white">#{index + 1}</div>
                    <div className="text-lg text-green-300">{name}</div>
                    <div className="text-xl font-semibold text-blue-300">{score} puan</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
};

export default QuizHost;