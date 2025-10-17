import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Send, Wifi, WifiOff, Trophy } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface PlayerViewProps {
  onBack: () => void;
}

interface GameResult {
  correct: number;
  closest: string;
  winners: string[];
  allAnswers: Array<{
    playerName: string;
    answer: number;
    difference: number;
    isCorrect: boolean;
    hasAnswered: boolean;
  }>;
  totalAnswers: number;
  totalPlayers: number;
}

const PlayerView: React.FC<PlayerViewProps> = ({ onBack }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  // Türkçe karakterleri koruyarak büyük harfe çeviren fonksiyon
  const toTurkishUpperCase = (str: string) => {
    return str
      .replace(/ı/g, 'I')
      .replace(/i/g, 'İ')
      .replace(/ğ/g, 'Ğ')
      .replace(/ü/g, 'Ü')
      .replace(/ş/g, 'Ş')
      .replace(/ö/g, 'Ö')
      .replace(/ç/g, 'Ç')
      .toUpperCase();
  };
  
  // Oyuncu ekranını sıfırla
  const resetPlayerView = () => {
    // Server'dan oyuncuyu çıkar
    if (socket && isJoined && playerName) {
      console.log('👋 Oyuncu server\'dan çıkarılıyor:', playerName);
      socket.emit('leave', playerName);
    }
    
    setPlayerName('');
    setIsJoined(false);
    setCurrentQuestion('');
    setAnswer('');
    setHasAnswered(false);
    
    // Ana menüye dön
    onBack();
    setGameEnded(false);
    setFinalScores({});
    setJoinError('');
    setAnswerError('');
    setAllAnswers([]);
    setGameResult(null);
    
    // URL hash'ini #player olarak ayarla
    window.location.hash = '#player';
  };
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [finalScores, setFinalScores] = useState<Record<string, number>>({});
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [joinError, setJoinError] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [allAnswers, setAllAnswers] = useState<Array<{
    playerName: string;
    answer: number;
    difference: number;
    isCorrect: boolean;
    hasAnswered: boolean;
  }>>([]);
  const [showFullResults, setShowFullResults] = useState(false);
  const [answeredPlayers, setAnsweredPlayers] = useState<Array<{
    playerName: string;
    timestamp: number;
    answerTime: number; // Cevap verme süresi (saniye)
  }>>([]);
  const [winnerInfo, setWinnerInfo] = useState<{
    playerName: string;
    answer: number;
    isCorrect: boolean;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [lastPlayedSecond, setLastPlayedSecond] = useState<number | null>(null); // Son çalınan saniye

  // Geri sayım ses efekti (QuizHost ile aynı)
  const playCountdownSound = (_second: number) => {
    try {
      // Web Audio API ile ses oluştur (QuizHost ile aynı)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // QuizHost ile aynı frekans ve tip
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      // QuizHost ile aynı ses seviyesi
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('🔊 Ses çalınamadı:', error);
    }
  };

  useEffect(() => {
    console.log('🔌 Player Socket bağlantısı kuruluyor...');
    
    // Sayfa yüklendiğinde oyuncu durumunu sıfırla
    setPlayerName('');
    setIsJoined(false);
    setCurrentQuestion('');
    setAnswer('');
    setHasAnswered(false);
    setGameEnded(false);
    setFinalScores({});
    setAllAnswers([]);
    setShowFullResults(false);
    setAnsweredPlayers([]);
    setWinnerInfo(null);
    setTimeLeft(0);
    setGameResult(null);
    
    // Optimize edilmiş socket konfigürasyonu
    const socketConnection = io({
      transports: ['websocket', 'polling'], // WebSocket öncelikli, polling fallback
      upgrade: true, // WebSocket'e upgrade et
      timeout: 10000, // Daha kısa timeout
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10, // Daha fazla deneme
      reconnectionDelay: 1000, // Daha hızlı yeniden bağlanma
      reconnectionDelayMax: 5000, // Daha kısa maksimum gecikme
      autoConnect: true
    });
    
    setSocket(socketConnection);

    // Bağlantı durumu takibi
    socketConnection.on('connect', () => {
      console.log('✅ Player Socket bağlantısı kuruldu:', socketConnection.id);
      setConnectionStatus('connected');
      setJoinError('');
      
      // Bağlantı kurulduğunda oyuncu durumunu sıfırla
      setPlayerName('');
      setIsJoined(false);
      setCurrentQuestion('');
      setAnswer('');
      setHasAnswered(false);
      setGameEnded(false);
      setFinalScores({});
      setAllAnswers([]);
      setShowFullResults(false);
      setAnsweredPlayers([]);
      setWinnerInfo(null);
      setTimeLeft(0);
      setGameResult(null);
      
      // Bağlantı kurulduğunda hemen ping gönder
      socketConnection.emit('ping', { timestamp: Date.now(), source: 'player' });
    });

    socketConnection.on('disconnect', (reason) => {
      console.log('❌ Player Socket bağlantısı kesildi:', reason);
      setConnectionStatus('disconnected');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('❌ Player Bağlantı hatası:', error);
      setConnectionStatus('disconnected');
      setJoinError('Sunucuya bağlanılamıyor. Lütfen tekrar deneyin.');
      
      // Polling ile yeniden dene
      setTimeout(() => {
        if (!socketConnection.connected) {
          console.log('🔄 Player Polling ile yeniden bağlanmaya çalışılıyor...');
          socketConnection.connect();
        }
      }, 3000);
    });

    // Test bağlantısı
    socketConnection.on('connectionTest', (data) => {
      console.log('🏓 Player Bağlantı testi başarılı:', data);
    });

    // Oyun eventleri
    socketConnection.on('joinConfirmed', (data) => {
      console.log('✅ Katılım onaylandı:', data);
      // Server'dan gelen ismi kullan (büyük harfe çevrilmiş)
      setPlayerName(data.name);
      setIsJoined(true);
      setJoinError('');
      
      // Host'a katılım bildirimi gönder
      setTimeout(() => {
        socketConnection.emit('playerJoined', data.name);
      }, 500); // Kısa bir gecikme ile gönder
    });

    socketConnection.on('joinError', (error) => {
      console.log('❌ Katılım hatası:', error);
      setJoinError(error.message);
    });

    socketConnection.on('newQuestion', (question: string) => {
      console.log('📝 Yeni soru alındı:', question);
      setCurrentQuestion(question);
      setAnswer('');
      setHasAnswered(false);
      setAnswerError('');
      setAllAnswers([]); // Önceki sorunun cevaplarını temizle
      setShowFullResults(false); // Yeni soru için tam sonuçları gizle
      setAnsweredPlayers([]); // Cevap veren oyuncuları temizle
      setWinnerInfo(null); // Kazanan bilgilerini temizle
      setTimeLeft(30); // Yeni soru için süre sayacını sıfırla
      setGameResult(null); // Önceki sonuçları temizle
      setLastPlayedSecond(null); // Ses efekti sayaçını sıfırla
    });

    socketConnection.on('timerUpdate', (data: { timeLeft: number }) => {
      console.log('⏰ Süre güncellendi:', data.timeLeft);
      setTimeLeft(data.timeLeft);
      
      // Sadece oyuncu oyuna katılmışsa ses efekti çal
      if (playerName && playerName.trim() !== '') {
        // Son 5 saniyede ses efekti çal (QuizHost ile aynı)
        if (data.timeLeft <= 5 && data.timeLeft > 0 && lastPlayedSecond !== data.timeLeft) {
          playCountdownSound(data.timeLeft);
          setLastPlayedSecond(data.timeLeft);
        }
      }
    });

    socketConnection.on('answerConfirmed', (data) => {
      console.log('✅ Cevap onaylandı:', data);
      console.log('🔄 hasAnswered state güncelleniyor: true');
      setHasAnswered(true);
      setAnswerError('');
      
      // Cevap verme süresini hesapla (30 - mevcut süre)
      const answerTime = 30 - timeLeft;
      
      // Kendi cevabımızı da listeye ekle
      setAnsweredPlayers(prev => {
        const newList = [...prev, {
          playerName: playerName,
          timestamp: Date.now(),
          answerTime: answerTime
        }];
        // Zaman sırasına göre sırala (en hızlı cevap veren üstte)
        return newList.sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    socketConnection.on('answerError', (error) => {
      console.log('❌ Cevap hatası:', error);
      setAnswerError(error.message);
      setHasAnswered(false);
    });

    socketConnection.on('playerAnswered', (data) => {
      console.log('👤 Oyuncu cevap verdi:', data);
      setAnsweredPlayers(prev => {
        const newList = [...prev, {
          playerName: data.playerName,
          timestamp: data.timestamp,
          answerTime: data.answerTime || 0
        }];
        // Zaman sırasına göre sırala (en hızlı cevap veren üstte)
        return newList.sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    socketConnection.on('showResult', (result) => {
      console.log('📊 Sonuç alındı:', result);
      setGameResult(result); // GameResult state'ini güncelle
      
      if (result.allAnswers) {
        setAllAnswers(result.allAnswers);
        setShowFullResults(true); // Süre bittiğinde tam sonuçları göster
        
        // Oyuncunun cevap verip vermediğini kontrol et
        const playerAnswered = result.allAnswers.some((answer: any) => 
          answer.playerName === playerName && answer.hasAnswered
        );
        console.log('🔍 Oyuncu cevap verdi mi?', playerAnswered);
        if (playerAnswered) {
          setHasAnswered(true);
        }
        
        // Kazanan kontrolü
        const isWinner = result.winners && result.winners.includes(playerName);
        const isInClosest = result.closest && result.closest.includes(playerName);
        
        if (isWinner || isInClosest) {
          console.log('🎉 Bu oyuncu kazandı:', playerName);
          
          // Kazanan oyuncu bilgilerini ayarla
          const winnerAnswer = result.allAnswers.find((answer: any) => answer.playerName === playerName);
          if (winnerAnswer) {
            setWinnerInfo({
              playerName: playerName,
              answer: winnerAnswer.answer,
              isCorrect: winnerAnswer.isCorrect
            });
          }
        } else {
          // Kazanamadıysa winnerInfo'yu temizle
          console.log('😔 Bu oyuncu kazanamadı:', playerName);
          setWinnerInfo(null);
        }
      }
    });

    socketConnection.on('gameEnded', (scores: Record<string, number>) => {
      console.log('🏁 Oyun bitti:', scores);
      setFinalScores(scores);
      setGameEnded(true);
    });

    // Ping-pong test - daha az sıklıkta
    const pingInterval = setInterval(() => {
      if (socketConnection.connected) {
        socketConnection.emit('ping', { timestamp: Date.now(), source: 'player' });
      }
    }, 60000); // 60 saniyede bir

    socketConnection.on('pong', (data) => {
      console.log('🏓 Player Pong alındı:', data);
    });

    return () => {
      clearInterval(pingInterval);
      socketConnection.disconnect();
    };
  }, []);

  // Geri sayım mantığı - Server'dan gelen timer güncellemelerini kullan
  useEffect(() => {
    // Server'dan gelen timer güncellemeleri kullanıldığı için
    // client-side countdown interval'ı kaldırıyoruz
    // Bu server-client senkronizasyon sorununu çözer
  }, [currentQuestion, timeLeft, showFullResults]);

  const joinGame = () => {
    if (!playerName.trim()) {
      setJoinError('Lütfen adınızı girin.');
      return;
    }

    if (!socket || !socket.connected) {
      setJoinError('Sunucu bağlantısı yok. Lütfen sayfayı yenileyin.');
      return;
    }

    console.log('👤 Oyuna katılım isteği gönderiliyor:', playerName);
    setJoinError('');
    socket.emit('join', playerName.trim());
  };

  const sendAnswer = () => {
    if (!answer.trim()) {
      setAnswerError('Lütfen bir cevap girin.');
      return;
    }

    if (!socket || !socket.connected) {
      setAnswerError('Sunucu bağlantısı yok.');
      return;
    }

    console.log('📝 Cevap gönderiliyor:', answer);
    setAnswerError('');
    setHasAnswered(true); // Cevap gönderildi olarak işaretle
    
    // Cevap verme süresini hesapla
    const answerTime = 30 - timeLeft;
    
    // Kendi cevabımızı da listeye ekle
    setAnsweredPlayers(prev => {
      const newList = [...prev, {
        playerName: playerName,
        timestamp: Date.now(),
        answerTime: answerTime
      }];
      // Zaman sırasına göre sırala (en hızlı cevap veren üstte)
      return newList.sort((a, b) => a.timestamp - b.timestamp);
    });
    
    socket.emit('answer', parseFloat(answer) || answer);
  };

  const resetGame = () => {
    setIsJoined(false);
    setPlayerName('');
    setCurrentQuestion('');
    setAnswer('');
    setHasAnswered(false);
    setGameEnded(false);
    setFinalScores({});
    setJoinError('');
    setAnswerError('');
  };

  // Bağlantı durumu göstergesi
  const ConnectionIndicator = () => (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
      connectionStatus === 'connected' 
        ? 'bg-green-100 text-green-800' 
        : connectionStatus === 'connecting'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800'
    }`}>
      {connectionStatus === 'connected' ? (
        <Wifi className="w-4 h-4" />
      ) : connectionStatus === 'connecting' ? (
        <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <WifiOff className="w-4 h-4" />
      )}
      <span>
        {connectionStatus === 'connected' && 'Bağlı'}
        {connectionStatus === 'connecting' && 'Bağlanıyor...'}
        {connectionStatus === 'disconnected' && 'Bağlantı Yok'}
      </span>
    </div>
  );

  if (gameEnded) {
    const sortedScores = Object.entries(finalScores).sort(([,a], [,b]) => b - a);
    const playerRank = sortedScores.findIndex(([name]) => name === playerName) + 1;
    const isWinner = playerRank === 1;

    return (
      <div translate="no" className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 mobile-safe-top mobile-safe-bottom">
        <div className="max-w-4xl w-full text-center mobile-container">
          <div className="flex justify-between items-center mb-6 md:mb-8 mobile-flex-row mobile-justify-between mobile-items-center">
            <button
              onClick={resetPlayerView}
              className="flex items-center text-white hover:text-purple-300 transition-colors mobile-btn mobile-touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 mr-2" />
              <span className="mobile-text-sm">Ana Menü</span>
            </button>
            <div className="flex items-center space-x-2 md:space-x-4 mobile-flex-row mobile-items-center">
              <div className="bg-white/10 backdrop-blur-lg rounded-lg px-3 md:px-4 py-2 flex items-center mobile-flex-row mobile-items-center">
                <User className="w-4 h-4 md:w-5 md:h-5 text-purple-300 mr-2" />
                <span className="text-white mobile-text-sm">{toTurkishUpperCase(playerName)}</span>
              </div>
              <ConnectionIndicator />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h1 className="text-4xl font-bold text-white mb-6">🏆 Oyun Bitti! 🏆</h1>
            
            {/* Kazanan animasyonu */}
            {isWinner && (
              <div className="mb-8 relative">
                <div className="bg-gradient-to-r from-yellow-400/20 to-orange-500/20 rounded-xl p-6 border border-yellow-400/30">
                  <h3 className="text-2xl font-semibold text-yellow-300 mb-4">🎉 TEBRİKLER! KAZANDINIZ! 🎉</h3>
                  <div className="relative">
                    <p className="text-white text-5xl font-bold animate-pulse text-center" style={{
                      animation: 'heartbeat 1.5s ease-in-out infinite, glow 2s ease-in-out infinite alternate'
                    }}>
                      {toTurkishUpperCase(playerName)}
                    </p>
                    <p className="text-yellow-300 text-2xl font-semibold mt-2 text-center">
                      {finalScores[playerName] || 0} Puan
                    </p>
                    
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-purple-300 mb-4">Sıralamanız</h2>
              <div className={`text-6xl font-bold mb-2 ${isWinner ? 'text-yellow-400 animate-pulse' : 'text-white'}`}>
                {playerRank}
              </div>
              <div className="text-xl text-blue-300">
                {finalScores[playerName] || 0} puan
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">Final Sıralaması</h3>
              <div className="space-y-2">
                {sortedScores.map(([name, score], index) => (
                  <div
                    key={name}
                    className={`flex justify-between items-center p-3 rounded-lg transition-all duration-300 ${
                      name === playerName ? 'bg-purple-600/30' : 'bg-white/10'
                    } ${index === 0 ? 'animate-pulse bg-yellow-600/20' : ''}`}
                  >
                    <span className="text-white flex items-center">
                      {index === 0 && <Trophy className="w-5 h-5 text-yellow-400 mr-2" />}
                      {index + 1} - {name}
                      {index === 0 && <span className="ml-2 text-yellow-400 font-bold">👑</span>}
                    </span>
                    <span className="text-blue-300 font-semibold">{score} puan</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={resetGame}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Yeni Oyun
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div translate="no" className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 mobile-safe-top mobile-safe-bottom">
        <div className="max-w-md w-full mobile-container">
          <div className="flex justify-between items-center mb-6 md:mb-8 mobile-flex-row mobile-justify-between mobile-items-center">
            <button
              onClick={resetPlayerView}
              className="flex items-center text-white hover:text-purple-300 transition-colors mobile-btn mobile-touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 mr-2" />
              <span className="mobile-text-sm">Ana Menü</span>
            </button>
            <ConnectionIndicator />
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="text-center mb-8">
              <User className="w-16 h-16 text-purple-300 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">Yarışmaya Katıl</h1>
              <p className="text-purple-200">Adınızı girin ve oyuna başlayın</p>
            </div>

            {joinError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg text-red-800 text-sm">
                {joinError}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Adınız
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && joinGame()}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Adınızı girin"
                  disabled={connectionStatus !== 'connected'}
                />
              </div>

              <button
                onClick={joinGame}
                disabled={connectionStatus !== 'connected' || !playerName.trim()}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                <User className="w-5 h-5 mr-2" />
                {connectionStatus === 'connected' ? 'Oyuna Katıl' : 'Bağlantı Bekleniyor...'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div translate="no" className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="max-w-2xl w-full">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={resetPlayerView}
            className="flex items-center text-white hover:text-purple-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Menü
          </button>
          <div className="flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 flex items-center">
              <User className="w-5 h-5 text-purple-300 mr-2" />
              <span className="text-white">{toTurkishUpperCase(playerName)}</span>
            </div>
            <ConnectionIndicator />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Hoş geldin, {toTurkishUpperCase(playerName)}! 👋</h1>
            <p className="text-purple-200">Soru geldiğinde cevabını ver</p>
          </div>

          {currentQuestion && timeLeft > 0 && !showFullResults && !hasAnswered ? (
            <div className="space-y-6">
              {/* Süre Sayacı */}
              {timeLeft > 0 && (
                <div className="flex justify-center mb-4">
                  <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${
                    timeLeft <= 5 ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse' :
                    timeLeft <= 10 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                    'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {timeLeft}
                  </div>
                </div>
              )}
              
              <div className="bg-white/10 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">📝 Soru:</h2>
                <p className="text-lg text-purple-200">{currentQuestion}</p>
              </div>

              {answerError && (
                <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm animate-pulse">
                  <div className="flex items-center">
                    <div className="w-4 h-4 mr-2">⚠️</div>
                    <span className="font-medium">{answerError}</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Cevabınız
                  </label>
                  <input
                    type="number"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendAnswer()}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="Cevabınızı girin"
                    disabled={connectionStatus !== 'connected'}
                  />
                </div>

                <button
                  onClick={sendAnswer}
                  disabled={connectionStatus !== 'connected' || !answer.trim()}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Cevabı Gönder
                </button>
              </div>
            </div>
          ) : (hasAnswered || showFullResults) ? (
            <div className="text-center py-12">
              {!showFullResults && hasAnswered ? (
                // Süre devam ederken - Cevabınız Gönderildi!
                <div className="space-y-6">
                  {/* Geri Sayım Timer */}
                  {timeLeft > 0 && (
                    <div className="flex justify-center mb-6">
                      <div className={`text-4xl font-bold px-6 py-4 rounded-lg ${
                        timeLeft <= 5 ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse' :
                        timeLeft <= 10 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                        'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {timeLeft}
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-8 border border-green-500/30">
                    <div className="flex items-center justify-center mb-6">
                      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white text-2xl">✓</span>
                      </div>
                      <h2 className="text-3xl font-bold text-white">Cevabınız Gönderildi!</h2>
                    </div>
                    <p className="text-lg text-green-200">Süre bitene kadar bekleyin...</p>
                  </div>
                </div>
              ) : winnerInfo ? (
                // Süre bitti ve bu oyuncu kazandı
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-6 border border-yellow-500/30">
                    <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-yellow-300 mb-2">🏆 Doğru veya En Yakın Cevap Veren</h3>
                    <p className="text-4xl font-bold text-white mb-2" style={{
                      animation: 'heartbeat 1.5s ease-in-out infinite, glow 2s ease-in-out infinite alternate'
                    }}>
                      {winnerInfo.playerName}
                    </p>
                    <p className="text-xl text-yellow-200">Cevap: {winnerInfo.answer}</p>
                  </div>
                </div>
              ) : showFullResults ? (
                // Süre bitti - Sonuçlar göster
                <div className="space-y-6">
                  {/* Doğru Cevap Bölümü */}
                  <div className="bg-gradient-to-r from-teal-500/20 to-green-500/20 rounded-lg p-6 border border-teal-500/30">
                    <div className="flex items-center mb-4">
                      <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center mr-3">
                        <span className="text-white text-sm">✓</span>
                      </div>
                      <h3 className="text-white font-semibold">Doğru Cevap</h3>
                    </div>
                    <div className="text-4xl font-bold text-white text-center">
                      {gameResult?.correct || 'Bilinmiyor'}
                    </div>
                  </div>

                  {/* Doğru veya En Yakın Cevap Veren Bölümü */}
                  <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-6 border border-blue-500/30">
                    <div className="flex items-center mb-4">
                      <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center mr-3">
                        <span className="text-white text-sm">🎯</span>
                      </div>
                      <h3 className="text-white font-semibold">Doğru veya En Yakın Cevap Veren</h3>
                    </div>
                    <div className="text-center">
                      <p className="text-white text-2xl font-bold text-center animate-pulse" style={{
                        animation: 'heartbeat 1.5s ease-in-out infinite, glow 2s ease-in-out infinite alternate'
                      }}>
                        🏆 {gameResult?.closest || 'Kimse'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Süre devam ediyor ama oyuncu cevap vermedi
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-8 border border-blue-500/30">
                    <div className="flex items-center justify-center mb-6">
                      <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white text-2xl">⏳</span>
                      </div>
                      <h2 className="text-3xl font-bold text-white">Süre Devam Ediyor</h2>
                    </div>
                    <p className="text-lg text-blue-200">Cevabınızı vermek için yukarıdaki formu kullanın</p>
                  </div>
                </div>
              )}
              
              {/* Cevap Veren Oyuncular (Süre Devam Ederken) */}
              {answeredPlayers.length > 0 && !showFullResults && (
                <div className="mt-6 bg-white/5 rounded-lg p-4 max-w-md mx-auto">
                  <h5 className="text-green-300 font-semibold mb-3 text-center">⚡ Cevap Verenler</h5>
                  <div className="space-y-2">
                    {answeredPlayers.map((player, index) => (
                      <div key={`${player.playerName}-${player.timestamp}`} className="flex items-center p-2 rounded-lg text-sm bg-green-600/20 border border-green-500/30">
                        <span className="text-green-300 text-xs font-bold mr-2">
                          {index + 1}.
                        </span>
                        <span className="text-white font-medium">{player.playerName}</span>
                        <div className="ml-auto flex items-center space-x-2">
                          <span className="text-green-300 text-xs">{player.answerTime}s</span>
                          <span className="text-green-300 text-xs">⚡</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cevap Listesi (Süre Bittiğinde) */}
              {allAnswers.length > 0 && showFullResults && (
                <div className="mt-6 bg-white/5 rounded-lg p-4 max-w-md mx-auto">
                  <h5 className="text-purple-300 font-semibold mb-3 text-center">📋 Tüm Cevaplar</h5>
                  <div className="space-y-2">
                    {allAnswers.map((answer, index) => (
                      <div key={index} className={`flex justify-between items-center p-2 rounded-lg text-sm ${
                        !answer.hasAnswered ? 'bg-red-600/20 border border-red-500/30' :
                        answer.isCorrect ? 'bg-green-600/20 border border-green-500/30' : 
                        answer.difference <= 5 ? 'bg-yellow-600/20 border border-yellow-500/30' :
                        'bg-gray-600/20 border border-gray-500/30'
                      }`}>
                        <div className="flex items-center">
                          <span className={`text-xs font-bold mr-2 ${
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
                              {!answer.isCorrect && answer.difference === Math.min(...allAnswers.filter(a => a.hasAnswered).map(a => a.difference)) && <span className="text-yellow-300 text-xs">🎯</span>}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="animate-pulse">
                <div className="w-16 h-16 bg-purple-600 rounded-full mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold text-white mb-2">⏳ Soru Bekleniyor</h3>
                <p className="text-purple-200">Oyun başladığında sorular gelecek</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerView;