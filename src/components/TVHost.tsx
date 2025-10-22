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
  const [roomId, setRoomId] = useState<string>('');
  const [gameMode, setGameMode] = useState<'sequential' | 'random' | null>(null);
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
      
      // Room oluştur
      socketConnection.emit('createRoom', (response: { roomId: string, success: boolean }) => {
        if (response.success) {
          setRoomId(response.roomId);
          console.log('🏠 TV Room oluşturuldu:', response.roomId);
        }
      });
    });

    // Room oluşturuldu event'i
    socketConnection.on('roomCreated', (data: { roomId: string }) => {
      setRoomId(data.roomId);
      console.log('🏠 TV Room ID alındı:', data.roomId);
    });

    socketConnection.on('reconnect', (attemptNumber) => {
      console.log('🔄 TV Host yeniden bağlanıldı, deneme sayısı:', attemptNumber);
      // Oyun durumunu geri yükle
      if (socketConnection && socketConnection.connected) {
        socketConnection.emit('getParticipants');
      }
    });

    socketConnection.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 TV Host yeniden bağlanma denemesi:', attemptNumber);
    });

    socketConnection.on('disconnect', (reason) => {
      console.log('❌ TV Host socket bağlantısı kesildi:', reason);
      console.log('⚠️ Sunucu bağlantısı kesildi! Yeniden bağlanılıyor...');
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
      console.log('🔄 TV QR kod oluşturuluyor, Room ID:', roomId, 'Link:', joinLink);
      QRCode.toDataURL(joinLink, { width: 300, margin: 2 })
        .then(url => {
          console.log('✅ TV QR kod oluşturuldu');
          setQrCodeUrl(url);
        })
        .catch(err => console.error('❌ TV QR kod oluşturulamadı:', err));
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
        // Soru questions[currentQuestionIndex] ile gösteriliyor
        
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
    console.log('➡️ TV Sonraki soruya geçiliyor...');
    setCurrentQuestionIndex(prev => prev + 1);
    setShowResult(false);
    setGameResult(null);
    setAnsweredPlayers([]); // Cevap verenler listesini temizle
    
    // Sonraki soruyu otomatik başlat
    setTimeout(() => {
      if (currentQuestionIndex + 1 < questions.length && socket) {
        const question = questions[currentQuestionIndex + 1];
        console.log('📝 TV Sonraki soru otomatik başlatılıyor:', question);
        
        // Soru questions[currentQuestionIndex + 1] ile gösteriliyor
        setTimer(30);
        
        socket.emit('startQuestion', question);
        socket.emit('startTimer', { duration: 30 });
      }
    }, 500);
  };

  const endGame = () => {
    if (socket) {
      socket.emit('endGame');
    }
  };

  const restartGame = () => {
    console.log('🔄 TV Oyun yeniden başlatılıyor...');
    setCurrentQuestionIndex(0);
    setShowResult(false);
    setGameResult(null);
    setTimer(30);
    setScores({});
    setShowFinalRankings(false);
    
    if (socket) {
      socket.emit('restartGame');
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
    setCurrentQuestionIndex(0); // Soru index'ini sıfırla
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
      <div translate="no" className="h-screen overflow-hidden bg-gradient-to-br from-green-900 via-blue-900 to-purple-900 p-4 flex flex-col">
        <div className="max-w-6xl mx-auto flex-1 flex flex-col overflow-hidden">
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

          <div className="flex-1 overflow-auto flex flex-col">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 flex-1 flex flex-col">
              <h1 className="text-3xl font-bold text-white mb-4 text-center">🏆 Oyun Bitti! 🏆</h1>
              <p className="text-lg text-gray-300 mb-6 text-center">Final Sıralaması</p>
              
              <div className="space-y-3 overflow-auto flex-1">
                {sortedScores.map(([playerName, score], index) => (
                  <div key={playerName} className="flex justify-between items-center bg-white/5 rounded-lg p-4">
        <div className="flex items-center space-x-4">
                      <span className="text-2xl font-bold text-yellow-400">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </span>
                      <span className="text-xl text-white flex items-center">
                        {index === 0 && <Trophy className="w-6 h-6 text-yellow-400 mr-3" />}
                        {playerName}
                        {index === 0 && <span className="ml-3 text-yellow-400 font-bold text-xl">👑</span>}
                      </span>
          </div>
                    <span className="text-2xl font-bold text-green-400">{score} puan</span>
          </div>
                ))}
              </div>
          </div>

            <div className="flex justify-center space-x-4 mt-4">
              <button
                onClick={restartGame}
                className="bg-green-600 hover:bg-green-700 text-white text-lg px-6 py-3 rounded-xl transition-colors flex items-center"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                🔄 Yeniden Başlat
              </button>
              <button
                onClick={goBackToModeSelection}
                className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-6 py-3 rounded-xl transition-colors"
              >
                🏠 Ana Menü
              </button>
          </div>
        </div>
      </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div translate="no" className="h-screen overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 flex flex-col">
      <div className="max-w-8xl mx-auto flex-1 flex flex-col overflow-hidden">
        {/* Header - Kompakt */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center text-white hover:text-yellow-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Menü
          </button>
          
          {/* Sonraki Soru Butonu - Orta (sadece soru ekranında) */}
          {gameMode && !waitingForPlayers && !showFinalRankings && currentQuestionIndex < questions.length && (
            <div className="flex justify-center items-center gap-3">
            <button
                onClick={nextQuestion}
                disabled={currentQuestionIndex >= questions.length - 1}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-500 disabled:cursor-not-allowed text-lg"
              >
                Sonraki Soru
            </button>
          </div>
          )}
          
          {/* Room ID, Bağlantı Durumu - Sağ */}
          <div className="flex items-center gap-3">
            {roomId && (
              <div className="bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 flex items-center">
                <span className="text-white font-medium text-lg">📍 Room: {roomId}</span>
                  </div>
            )}
            <ConnectionIndicator />
                  </div>
                </div>
                
        {/* Main Content - Kompakt */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
          {/* Sol Panel - Oyun Kontrolü */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
            {!gameMode ? (
              /* Oyun Modu Seçimi - Kompakt */
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h1 className="text-3xl font-bold text-white mb-4 text-center">📺 BİL BAKALIM TV</h1>
                <p className="text-lg text-gray-300 mb-6 text-center">Google TV için Interaktif Quiz</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => startGame('sequential')}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-6 py-4 rounded-xl transition-colors flex items-center justify-center space-x-3"
                  >
                    <Play className="w-5 h-5" />
                    <span>📋 Sıralı Oyun</span>
                  </button>
                  
                  <button
                    onClick={() => startGame('random')}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-lg px-6 py-4 rounded-xl transition-colors flex items-center justify-center space-x-3"
                  >
                    <Shuffle className="w-5 h-5" />
                    <span>🔀 Rastgele Oyun</span>
                  </button>
                  </div>
                </div>
            ) : waitingForPlayers ? (
              /* Oyuncu Bekleme Ekranı - Kompakt */
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-4 text-center">👥 Oyuncular Bekleniyor</h2>
                
                {/* Room ID - Kompakt */}
                {roomId && (
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-center mb-1">
                      <h3 className="text-xl font-bold text-white">🎮 Oyun Kodu</h3>
                    </div>
                    <div className="bg-white/20 rounded-lg p-3">
                      <p className="text-3xl font-bold text-white text-center tracking-wider">{roomId}</p>
                    </div>
                    <p className="text-white/80 text-center mt-2 text-sm">Oyunculara bu kodu verin</p>
                  </div>
                )}

                {/* QR Kod ve Link - Kompakt */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <QrCode className="w-6 h-6 text-blue-300 mr-2" />
                      <h3 className="text-lg font-bold text-white">📱 QR Kod</h3>
                    </div>
                    {qrCodeUrl && (
                      <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-2 rounded-lg shadow-lg max-w-[200px]" />
                    )}
                    <p className="text-gray-300 text-xs">QR kodu okutarak katılın</p>
                </div>

                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-3">🔗 Katılım Linki</h3>
                    <div className="bg-white/10 rounded-lg p-3 mb-3">
                      <p className="text-blue-200 font-mono text-xs break-all">{joinLink}</p>
                    </div>
                    <button
                      onClick={copyLink}
                      className="bg-green-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center mx-auto"
                    >
                      {linkCopied ? <CheckCircle className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      {linkCopied ? 'Kopyalandı!' : 'Linki Kopyala'}
                    </button>
                  </div>
                </div>

                {/* Oyuncu Sayısı - Kompakt */}
                <div className="text-center mb-6">
                  <div className="bg-white/10 rounded-xl p-4">
                    <h3 className="text-xl font-bold text-white mb-1">👥 Oyuncular</h3>
                    <div className="text-3xl font-bold text-green-400 mb-1">{playerCount.total}</div>
                    <p className="text-gray-300 text-sm">
                      {playerCount.total > 0 ? 'Oyuncular hazır!' : 'Oyuncu bekleniyor...'}
                    </p>
              </div>
                </div>

                {/* Oyunu Başlat Butonu - Kompakt */}
                <div className="text-center">
                  <button
                    onClick={startQuizGame}
                    disabled={playerCount.total === 0}
                    className={`text-xl px-8 py-4 rounded-xl transition-colors ${
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
              /* Oyun Aktif Ekranı - Kompakt */
              <div className="space-y-4">
                {/* Geri Sayım Timer - Kompakt */}
                {currentQuestionIndex < questions.length && !showResult && timer > 0 && (
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      {/* Dış çember - progress bar - Kompakt */}
                      <div className="w-40 h-40 rounded-full border-6 border-purple-600 relative overflow-hidden bg-gradient-to-br from-purple-900 to-blue-900">
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
                      
                      {/* İç sayı - Kompakt */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`text-6xl font-black transition-all duration-500 transform ${
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

                {/* Soru - Kompakt */}
                {currentQuestionIndex < questions.length && (
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
                    <div className="flex justify-center items-center mb-4">
                      <span className="text-green-300 font-semibold text-lg">
                        📝 Soru {currentQuestionIndex + 1} / {questions.length}
                      </span>
                    </div>
                    
                    <h3 className="text-3xl font-bold text-white mb-6 px-4 break-words text-center leading-relaxed">
                      {questions[currentQuestionIndex]?.question}
                    </h3>

                    {/* Cevap Verenler Listesi - Kompakt */}
                    {!showResult && (
                      <div className="bg-white/5 rounded-lg p-4 mb-4">
                        <h4 className="text-blue-300 font-semibold mb-3 text-center text-lg">📝 Cevap Verenler</h4>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-400 mb-3">
                            {playerCount.answered} / {playerCount.total}
                          </div>
                          <p className="text-gray-300 mb-4 text-base">
                            {playerCount.answered === playerCount.total 
                              ? '🎉 Tüm oyuncular cevap verdi!' 
                              : `${playerCount.total - playerCount.answered} oyuncu daha cevap bekleniyor...`}
                          </p>
                          
                          {/* Cevap Veren Oyuncular Listesi - Kompakt */}
                          {answeredPlayers.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-blue-300 font-semibold mb-2 text-base">⚡ Cevap Verenler</h5>
                    <div className="space-y-2">
                                {answeredPlayers.map((player, index) => (
                                  <div key={player.name} className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                                    <span className="text-white font-medium text-base">
                                      {index + 1}. {player.name}
                                    </span>
                                    <span className="text-yellow-400 font-bold text-base">
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
                
                    {showResult && gameResult && (
                      <div className="space-y-4">
                        {/* Doğru Cevap - Kompakt */}
                        <div className="bg-green-600/20 rounded-lg p-4">
                          <h4 className="text-green-300 font-semibold mb-2 text-lg">✅ Doğru Cevap</h4>
                          <p className="text-white text-4xl font-bold">{gameResult.correct}</p>
                  </div>
                  
                        {/* Kazanan Gösterimi - Kompakt */}
                        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg p-4 relative overflow-hidden">
                          <h4 className="text-blue-300 font-semibold mb-3 text-lg">🎯 Doğru veya En Yakın Cevap Veren</h4>
                          <div className="relative">
                            {gameResult.winners && gameResult.winners.length > 0 ? (
                              <div className="space-y-3">
                                {gameResult.winners.length === 1 ? (
                                  <p className="text-white text-3xl font-bold text-center animate-pulse" style={{
                                    animation: 'heartbeat 1.5s ease-in-out infinite, glow 2s ease-in-out infinite alternate'
                                  }}>{gameResult.winners[0]}</p>
                                ) : (
                    <div className="space-y-2">
                                    <p className="text-blue-300 text-lg mb-2">Aynı cevabı veren kazananlar:</p>
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
                                <p className="text-blue-300 text-lg mt-4">
                                  Cevap: {gameResult.closest.includes('(') ? gameResult.closest.split('(')[1].replace(')', '') : gameResult.correct}
                                </p>
                              </div>
                            ) : (
                              <p className="text-white text-2xl font-bold text-center">
                                Kimse doğru bilmedi
                              </p>
                            )}
                    </div>
                  </div>
                  
                        {/* Tüm Cevaplar Listesi - Kompakt */}
                        {gameResult.allAnswers && gameResult.allAnswers.length > 0 && (
                          <div className="mt-4 bg-white/5 rounded-lg p-4">
                            <h5 className="text-blue-300 font-semibold mb-3 text-center text-lg">📋 Tüm Cevaplar</h5>
                    <div className="space-y-2">
                              {gameResult.allAnswers.map((answer, index) => (
                                <div key={index} className={`flex justify-between items-center p-3 rounded-lg text-base ${
                                  !answer.hasAnswered ? 'bg-red-600/20 border border-red-500/30' :
                                  answer.isCorrect ? 'bg-green-600/20 border border-green-500/30' : 
                                  answer.difference <= 5 ? 'bg-yellow-600/20 border border-yellow-500/30' :
                                  'bg-gray-600/20 border border-gray-500/30'
                                }`}>
                                  <div className="flex items-center">
                                    <span className={`text-base font-bold mr-2 ${
                                      !answer.hasAnswered ? 'text-red-300' :
                                      answer.isCorrect ? 'text-green-300' : 
                                      answer.difference <= 5 ? 'text-yellow-300' : 'text-gray-300'
                                    }`}>
                                      {index + 1}.
                                    </span>
                                    <span className="text-white font-medium text-base">{answer.playerName}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {!answer.hasAnswered ? (
                                      <span className="text-red-300 font-bold text-base">Cevap yok</span>
                                    ) : (
                                      <>
                                        <span className="text-white font-bold text-base">{answer.answer}</span>
                                        {answer.isCorrect && <span className="text-green-300 text-lg">✓</span>}
                                        {!answer.isCorrect && gameResult.allAnswers && answer.difference === Math.min(...gameResult.allAnswers.filter(a => a.hasAnswered).map(a => a.difference)) && <span className="text-yellow-300 text-lg">🎯</span>}
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

                {/* Oyunu Bitir Butonu - Kompakt */}
                <div className="flex justify-center mt-6">
                  <button
                    onClick={endGame}
                    className="bg-red-600 text-white px-8 py-4 rounded-xl hover:bg-red-700 transition-colors font-medium text-xl"
                  >
                    🏁 Oyunu Bitir
                  </button>
                </div>
          </div>
        )}
      </div>
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
      </div>
      
      <ToastContainer />
    </div>
  );
};

export default TVHost;
