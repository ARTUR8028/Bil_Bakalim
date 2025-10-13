import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Send, CheckCircle, Wifi, WifiOff, Trophy } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface PlayerViewProps {
  onBack: () => void;
}

const PlayerView: React.FC<PlayerViewProps> = ({ onBack }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
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
  }>>([]);

  useEffect(() => {
    console.log('🔌 Player Socket bağlantısı kuruluyor...');
    
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
      setIsJoined(true);
      setJoinError('');
      
      // Host'a katılım bildirimi gönder
      setTimeout(() => {
        socketConnection.emit('playerJoined', playerName);
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
    });

    socketConnection.on('answerConfirmed', (data) => {
      console.log('✅ Cevap onaylandı:', data);
      setHasAnswered(true);
      setAnswerError('');
    });

    socketConnection.on('answerError', (error) => {
      console.log('❌ Cevap hatası:', error);
      setAnswerError(error.message);
      setHasAnswered(false);
    });

    socketConnection.on('showResult', (result) => {
      console.log('📊 Sonuç alındı:', result);
      if (result.allAnswers) {
        setAllAnswers(result.allAnswers);
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full text-center">
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={onBack}
              className="flex items-center text-white hover:text-purple-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Ana Menü
            </button>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 flex items-center">
                <User className="w-5 h-5 text-purple-300 mr-2" />
                <span className="text-white">{playerName}</span>
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
                      {playerName}
                    </p>
                    <p className="text-yellow-300 text-2xl font-semibold mt-2 text-center">
                      {finalScores[playerName] || 0} Puan
                    </p>
                    
                    {/* Konfeti ve havai fişek efekti */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Konfeti */}
                      {[...Array(25)].map((_, i) => (
                        <div
                          key={i}
                          className={`absolute w-3 h-3 rounded-full animate-bounce ${
                            ['bg-yellow-400', 'bg-pink-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-red-400'][i % 6]
                          }`}
                          style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${2 + Math.random() * 2}s`
                          }}
                        ></div>
                      ))}
                      
                      {/* Havai fişek */}
                      <div className="absolute top-0 left-1/4 w-4 h-4 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0s' }}></div>
                      <div className="absolute top-0 right-1/4 w-4 h-4 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                      <div className="absolute top-0 left-1/2 w-4 h-4 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '2s' }}></div>
                      <div className="absolute bottom-0 left-1/3 w-4 h-4 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '1.5s' }}></div>
                      <div className="absolute bottom-0 right-1/3 w-4 h-4 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '2.5s' }}></div>
                    </div>
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={onBack}
              className="flex items-center text-white hover:text-purple-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Ana Menü
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={onBack}
            className="flex items-center text-white hover:text-purple-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Menü
          </button>
          <div className="flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 flex items-center">
              <User className="w-5 h-5 text-purple-300 mr-2" />
              <span className="text-white">{playerName}</span>
            </div>
            <ConnectionIndicator />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Hoş geldin, {playerName}! 👋</h1>
            <p className="text-purple-200">Soru geldiğinde cevabını ver</p>
          </div>

          {currentQuestion && !hasAnswered ? (
            <div className="space-y-6">
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
          ) : hasAnswered ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">✅ Cevabınız Gönderildi!</h3>
              <p className="text-purple-200 mb-6">Sıradaki soru bekleniyor...</p>
              
              {/* Cevap Listesi */}
              {allAnswers.length > 0 && (
                <div className="mt-6 bg-white/5 rounded-lg p-4 max-w-md mx-auto">
                  <h5 className="text-purple-300 font-semibold mb-3 text-center">📋 Tüm Cevaplar</h5>
                  <div className="space-y-2">
                    {allAnswers.map((answer, index) => (
                      <div key={index} className={`flex justify-between items-center p-2 rounded-lg text-sm ${
                        answer.isCorrect ? 'bg-green-600/20 border border-green-500/30' : 
                        answer.difference <= 5 ? 'bg-yellow-600/20 border border-yellow-500/30' :
                        'bg-gray-600/20 border border-gray-500/30'
                      }`}>
                        <div className="flex items-center">
                          <span className={`text-xs font-bold mr-2 ${
                            answer.isCorrect ? 'text-green-300' : 
                            answer.difference <= 5 ? 'text-yellow-300' : 'text-gray-300'
                          }`}>
                            {index + 1}.
                          </span>
                          <span className="text-white font-medium">{answer.playerName}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-bold">{answer.answer}</span>
                          {answer.isCorrect && <span className="text-green-300 text-xs">✅</span>}
                          {!answer.isCorrect && answer.difference <= 5 && <span className="text-yellow-300 text-xs">🎯</span>}
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