import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Socket.IO bağlantısı
    const newSocket = io('https://bil-bakalim.onrender.com', {
      transports: ['polling', 'websocket'], // Polling öncelikli
      upgrade: true,
      timeout: 30000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('📺 TV Host bağlandı');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('📺 TV Host bağlantısı kesildi');
      setConnected(false);
    });

    newSocket.on('newQuestion', (question) => {
      console.log('📺 Yeni soru:', question);
      setCurrentQuestion(question);
      setShowResults(false);
      setGameResult(null);
    });

    newSocket.on('timerUpdate', (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
    });

    newSocket.on('allParticipants', (participants) => {
      setParticipants(participants);
    });

    newSocket.on('gameStarted', () => {
      setGameActive(true);
    });

    newSocket.on('gameEnded', () => {
      setGameActive(false);
    });

    newSocket.on('results', (results) => {
      setGameResult(results);
      setShowResults(true);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const startGame = () => {
    if (socket) {
      socket.emit('startGame');
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
        {!gameActive ? (
          /* Game Start Screen */
          <div className="text-center">
            <h1 className="text-6xl font-bold text-white mb-8 animate-pulse">
              📺 BİL BAKALIM TV
            </h1>
            <p className="text-2xl text-gray-300 mb-8">
              Google TV için Interaktif Quiz
            </p>
            <button
              onClick={startGame}
              disabled={false}
              className="bg-green-600 hover:bg-green-700 text-white text-2xl px-12 py-6 rounded-2xl transition-colors"
            >
              🎮 Oyunu Başlat
            </button>
            <p className="text-blue-300 text-xl mt-4">
              ✅ Oyunu başlatmak için butona tıklayın
            </p>
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
