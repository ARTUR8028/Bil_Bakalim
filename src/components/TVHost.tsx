import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface TVHostProps {
  onBack: () => void;
}

const TVHost: React.FC<TVHostProps> = ({ onBack }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [participants, setParticipants] = useState<any[]>([]);
  const [gameActive, setGameActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gameResult, setGameResult] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gameMode, setGameMode] = useState<'sequential' | 'random' | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [showFinalRankings, setShowFinalRankings] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [playerCount, setPlayerCount] = useState({ total: 0, answered: 0 });
  const [participantNames, setParticipantNames] = useState<string[]>([]);
  const [timer, setTimer] = useState(30);
  const [showResult, setShowResult] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [toasts, setToasts] = useState<Array<{id: string, message: string, type: 'success' | 'info' | 'warning'}>>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      setConnected(true);
      
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
      console.log('❌ TV Host Socket bağlantısı kesildi:', reason);
      setConnectionStatus('disconnected');
      setConnected(false);
    });

    socketConnection.on('connect_error', (error) => {
      console.error('❌ TV Host Bağlantı hatası:', error);
      setConnectionStatus('disconnected');
      setConnected(false);
      
      // Polling ile yeniden dene
      setTimeout(() => {
        if (!socketConnection.connected) {
          console.log('🔄 TV Host Polling ile yeniden bağlanmaya çalışılıyor...');
          socketConnection.connect();
        }
      }, 3000);
    });

    // Test bağlantısı
    socketConnection.on('connectionTest', (data) => {
      console.log('🏓 TV Host Bağlantı testi başarılı:', data);
    });

    // Oyun eventleri
    socketConnection.on('gameStarted', () => {
      console.log('🎮 TV Oyun başladı');
      setGameActive(true);
      setWaitingForPlayers(false);
    });

    socketConnection.on('gameEnded', (finalScores) => {
      console.log('🏁 TV Oyun bitti');
      setGameActive(false);
      setShowFinalRankings(true);
      setScores(finalScores || {});
    });

    socketConnection.on('newQuestion', (question) => {
      console.log('📺 TV Yeni soru:', question);
      setCurrentQuestion(question);
      setShowResults(false);
      setGameResult(null);
      setShowResult(false);
      setTimer(30);
    });

    socketConnection.on('timerUpdate', (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
      setTimer(data.timeLeft);
    });

    socketConnection.on('allParticipants', (participants) => {
      console.log('👥 TV Katılımcılar güncellendi:', participants);
      setParticipants(participants);
      setParticipantNames(participants.map((p: any) => p.name));
      setPlayerCount({ total: participants.length, answered: 0 });
    });

    socketConnection.on('results', (results) => {
      console.log('📊 TV Sonuçlar:', results);
      setGameResult(results);
      setShowResults(true);
      setShowResult(true);
    });

    // QR kod oluştur
    const generateQRCode = async () => {
      try {
        const qrCodeDataURL = await import('qrcode').then(QRCode => 
          QRCode.toDataURL(joinLink, {
            width: 300,
            margin: 2,
            color: {
              dark: '#1A1A2E',
              light: '#FFFFFF'
            }
          })
        );
        setQrCodeUrl(qrCodeDataURL);
      } catch (error) {
        console.error('❌ QR kod oluşturma hatası:', error);
      }
    };

    generateQRCode();

    return () => {
      socketConnection.close();
    };
  }, [joinLink]);

  const startGame = (mode: 'sequential' | 'random') => {
    console.log('🎮 TV Oyun modu seçildi:', mode);
    setGameMode(mode);
    setWaitingForPlayers(true);
    if (mode === 'random') {
      setQuestions(prev => [...prev].sort(() => Math.random() - 0.5));
      console.log('🔀 Sorular karıştırıldı');
    }
  };

  const startQuizGame = () => {
    console.log('🚀 TV Quiz oyunu başlatılıyor...');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-6 bg-black/20 backdrop-blur-lg">
        <button
          onClick={onBack}
          className="flex items-center text-white hover:text-yellow-300 transition-colors text-lg"
        >
          ← Ana Menü
        </button>
        <div className="flex items-center space-x-4">
          <div className={`px-4 py-2 rounded-lg ${connected ? 'bg-green-600' : 'bg-red-600'} text-white`}>
            {connected ? '📺 TV Bağlı' : '📺 TV Bağlantısı Yok'}
          </div>
          <div className="text-white text-lg">
            👥 {participants.length} Oyuncu
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {!gameActive && !waitingForPlayers ? (
          /* Game Mode Selection Screen */
          <div className="text-center">
            <h1 className="text-6xl font-bold text-white mb-8 animate-pulse">
              📺 BİL BAKALIM TV
            </h1>
            <p className="text-2xl text-gray-300 mb-8">
              Google TV için Interaktif Quiz
            </p>
            
            {/* Game Mode Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <button
                onClick={() => startGame('sequential')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xl px-8 py-6 rounded-2xl transition-colors tv-focusable"
              >
                📋 Sıralı Oyun
              </button>
              <button
                onClick={() => startGame('random')}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xl px-8 py-6 rounded-2xl transition-colors tv-focusable"
              >
                🔀 Rastgele Oyun
              </button>
            </div>
            
            <p className="text-blue-300 text-xl">
              ✅ Oyun modunu seçin
            </p>
          </div>
        ) : waitingForPlayers ? (
          /* Waiting for Players Screen */
          <div className="text-center">
            <h1 className="text-6xl font-bold text-white mb-8 animate-pulse">
              📺 BİL BAKALIM TV
            </h1>
            <p className="text-2xl text-gray-300 mb-8">
              Oyuncular bekleniyor...
            </p>
            
            {/* QR Code and Link */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-4">📱 QR Kod</h3>
                  {qrCodeUrl && (
                    <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-4" />
                  )}
                  <p className="text-blue-200 text-sm">
                    Oyuncular bu QR kodu okutarak katılabilir
                  </p>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-4">🔗 Katılım Linki</h3>
                  <div className="bg-white/10 rounded-lg p-4 mb-4">
                    <p className="text-blue-200 font-mono text-sm break-all">{joinLink}</p>
                  </div>
                  <button
                    onClick={copyLink}
                    className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center mx-auto"
                  >
                    {linkCopied ? '✅ Kopyalandı!' : '📋 Linki Kopyala'}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Player Count */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
              <h3 className="text-2xl font-bold text-white mb-4">👥 Oyuncular</h3>
              <div className="text-4xl font-bold text-green-400 mb-2">
                {playerCount.total}
              </div>
              <p className="text-blue-200">
                {playerCount.total > 0 ? 'Oyuncular hazır!' : 'Oyuncu bekleniyor...'}
              </p>
            </div>
            
            {/* Start Game Button */}
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
        ) : (
          /* Game Active Screen */
          <div className="w-full max-w-6xl">
            {currentQuestion && !showResults ? (
              /* Question Display */
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20">
                <div className="text-center mb-8">
                  <div className="text-4xl font-bold text-white mb-4">
                    ⏰ {timeLeft} SANİYE
                  </div>
                  <div className="text-2xl text-gray-300">
                    Soru {currentQuestion.index + 1}
                  </div>
                </div>
                
                <div className="text-center">
                  <h2 className="text-5xl font-bold text-white mb-8 leading-relaxed">
                    {currentQuestion.question}
                  </h2>
                </div>

                <div className="text-center mt-8">
                  <div className="text-2xl text-gray-300">
                    👥 {participants.length} Oyuncu Aktif
                  </div>
                </div>
              </div>
            ) : showResults && gameResult ? (
              /* Results Display */
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20">
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-bold text-white mb-4">
                    🏆 SONUÇLAR
                  </h2>
                </div>

                <div className="text-center mb-8">
                  <div className="text-3xl font-bold text-green-400 mb-2">
                    Doğru Cevap: {gameResult.correctAnswer}
                  </div>
                  <div className="text-2xl text-yellow-400">
                    {gameResult.winnerDisplay}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-2xl font-bold text-white mb-4">📊 Tüm Cevaplar</h3>
                    <div className="space-y-2">
                      {gameResult.allAnswers.map((answer: any, index: number) => (
                        <div key={index} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                          <span className="text-white">{answer.playerName}</span>
                          <span className="text-yellow-300">{answer.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-white/10 rounded-2xl p-6">
                    <h3 className="text-2xl font-bold text-white mb-4">👥 Aktif Oyuncular</h3>
                    <div className="space-y-2">
                      {participants.map((participant, index) => (
                        <div key={index} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                          <span className="text-white">{participant.name}</span>
                          <span className="text-green-300">{participant.score} puan</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
              /* Waiting Screen */
              <div className="text-center">
                <h2 className="text-4xl font-bold text-white mb-8">
                  ⏳ Soru Yükleniyor...
                </h2>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TVHost;
