import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Upload, Eye, EyeOff, CheckCircle, AlertCircle, Wifi, WifiOff, Server, Database } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [serverHealth, setServerHealth] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const checkServerHealth = useCallback(async () => {
    try {
      console.log('🏥 Sunucu durumu kontrol ediliyor...');
      const response = await fetch('http://localhost:3001/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const health = await response.json();
      setServerHealth(health);
      console.log('🏥 Sunucu durumu alındı:', health);
    } catch (error) {
      console.error('❌ Sunucu durumu alınamadı:', error);
      setServerHealth(null);
    }
  }, []);

  useEffect(() => {
    console.log('🔌 Admin Panel socket bağlantısı kuruluyor...');
    
    // Optimize edilmiş socket konfigürasyonu
    const socketConnection = io({
      transports: ['websocket', 'polling'], // WebSocket öncelikli, polling fallback
      upgrade: true, // WebSocket'e upgrade et
      timeout: 30000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      autoConnect: true
    });
    
    setSocket(socketConnection);

    socketConnection.on('connect', () => {
      console.log('✅ Admin socket bağlantısı kuruldu:', socketConnection.id);
      console.log('🔌 Socket bağlantı detayları:', {
        id: socketConnection.id,
        connected: socketConnection.connected,
        transport: socketConnection.io.engine.transport.name
      });
      setConnectionStatus('connected');
      // checkServerHealth'ı useEffect dışında çağırmak yerine
      // socket bağlantısı kurulduktan sonra çağır
      setTimeout(() => checkServerHealth(), 100);
    });

    socketConnection.on('disconnect', (reason) => {
      console.log('❌ Admin socket bağlantısı kesildi:', reason);
      setConnectionStatus('disconnected');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('❌ Admin bağlantı hatası:', error);
      setConnectionStatus('disconnected');
      
      // Polling ile yeniden dene
      setTimeout(() => {
        if (!socketConnection.connected) {
          console.log('🔄 Polling ile yeniden bağlanmaya çalışılıyor...');
          socketConnection.connect();
        }
      }, 3000);
    });

    socketConnection.on('connectionTest', (data) => {
      console.log('🏓 Admin bağlantı testi başarılı:', data);
    });

    // Ping-pong mekanizması - daha az sıklıkta
    const pingInterval = setInterval(() => {
      if (socketConnection.connected) {
        socketConnection.emit('ping', { timestamp: Date.now(), source: 'admin' });
      }
    }, 60000); // 60 saniyede bir

    socketConnection.on('pong', (data) => {
      console.log('🏓 Admin pong alındı:', data);
    });

    return () => {
      clearInterval(pingInterval);
      socketConnection.disconnect();
    };
  }, [checkServerHealth]);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    // State güncellemesini güvenli şekilde yap
    setMessage({ type, text });
    
    // Önceki mesajı temizle
    setTimeout(() => {
      setMessage(prev => prev?.text === text ? null : prev);
    }, 5000);
  }, []);

  const handleLogin = () => {
    if (username === 'OSMAN' && password === '80841217') {
      setIsLoggedIn(true);
      showMessage('success', 'Başarıyla giriş yapıldı!');
      checkServerHealth();
    } else {
      showMessage('error', 'Hatalı kullanıcı adı veya şifre.');
    }
  };

  const handleAddQuestion = useCallback(async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      showMessage('error', 'Lütfen soru ve cevabı girin.');
      return;
    }

    console.log('🔍 Socket durumu kontrol ediliyor:', {
      socket: !!socket,
      connected: socket?.connected,
      id: socket?.id
    });

    if (!socket || !socket.connected) {
      showMessage('error', 'Sunucu bağlantısı yok. Lütfen sayfayı yenileyin.');
      return;
    }

    // Loading state'ini güvenli şekilde set et
    try {
      setIsLoading(true);
      
      console.log('📤 Soru ekleme isteği gönderiliyor:', {
        question: newQuestion.trim().substring(0, 50),
        answer: newAnswer.trim()
      });
      
      // Promise-based approach for better error handling
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: Soru ekleme işlemi zaman aşımına uğradı.'));
        }, 10000);

        socket.emit('addQuestion', { 
          question: newQuestion.trim(), 
          answer: newAnswer.trim() 
        }, (response: any) => {
          clearTimeout(timeout);
          console.log('📥 Soru ekleme yanıtı alındı:', response);
          
          if (response && response.success) {
            showMessage('success', `Soru başarıyla eklendi! Toplam: ${response.totalQuestions} soru`);
            setNewQuestion('');
            setNewAnswer('');
            checkServerHealth(); // Soru sayısını güncelle
            resolve();
          } else {
            const errorMsg = response?.message || 'Soru eklenirken bir hata oluştu.';
            showMessage('error', errorMsg);
            reject(new Error(errorMsg));
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Soru ekleme hatası:', error);
      showMessage('error', error instanceof Error ? error.message : 'Bilinmeyen hata oluştu.');
    } finally {
      // Loading state'ini her durumda temizle
      setIsLoading(false);
    }
  }, [socket, newQuestion, newAnswer, showMessage, checkServerHealth]);

  const handleFileUpload = async () => {
    if (!selectedFile) {
      showMessage('error', 'Lütfen bir dosya seçin.');
      return;
    }

    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      showMessage('error', 'Lütfen sadece Excel dosyası (.xlsx veya .xls) seçin.');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setMessage(null); // Önceki mesajları temizle
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      console.log('📤 Dosya yükleniyor:', {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      });
      
      // Progress simulation - DOM güvenli şekilde
      let progressValue = 0;
      const progressInterval = setInterval(() => {
        progressValue += 10;
        if (progressValue <= 90) {
          setUploadProgress(progressValue);
        }
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      // Progress'i temizle
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Kısa bir gecikme ile progress'i sıfırla
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);

      console.log('📥 Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Upload result:', result);
      
      if (result.success) {
        showMessage('success', result.message);
        // Dosya seçimini güvenli şekilde sıfırla
        setTimeout(() => {
          setSelectedFile(null);
          setUploadProgress(0);
        }, 100);
        checkServerHealth(); // Soru sayısını güncelle
      } else {
        showMessage('error', result.error || 'Yükleme başarısız.');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      showMessage('error', `Yükleme sırasında bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setIsLoading(false);
      // Progress'i güvenli şekilde sıfırla
      setTimeout(() => {
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    }
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
      ) : (
        <WifiOff className="w-4 h-4" />
      )}
      <span>
        {connectionStatus === 'connected' && 'Sunucu Bağlı'}
        {connectionStatus === 'connecting' && 'Bağlanıyor...'}
        {connectionStatus === 'disconnected' && 'Sunucu Bağlantısı Yok'}
      </span>
    </div>
  );

  if (!isLoggedIn) {
  return (
    <div translate="no" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Geri Dön
            </button>
            <ConnectionIndicator />
          </div>

          <div className="text-center mb-6">
            <Server className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800">Admin Girişi</h2>
            <p className="text-gray-600 mt-2">Sistem yönetimi için giriş yapın</p>
          </div>
          
          {message && (
            <div className={`mb-4 p-3 rounded-lg flex items-center ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2" />
              )}
              {message.text}
            </div>
          )}
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleLogin)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Kullanıcı adınızı girin"
                disabled={connectionStatus !== 'connected'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Şifre
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleLogin)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                  placeholder="Şifrenizi girin"
                  disabled={connectionStatus !== 'connected'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={isLoading || connectionStatus !== 'connected' || !username.trim() || !password.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Giriş yapılıyor...
                </>
              ) : (
                'Giriş Yap'
              )}
            </button>

            {connectionStatus !== 'connected' && (
              <div className="text-center text-sm text-red-600">
                ⚠️ Sunucu bağlantısı gerekli
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div translate="no" className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center text-white hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Menü
          </button>
          
          <div className="flex items-center space-x-4">
            <ConnectionIndicator />
            <button
              onClick={() => {
                setIsLoggedIn(false);
                setUsername('');
                setPassword('');
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </div>

        <div className="text-center mb-8">
          <Database className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Admin Paneli</h1>
          <p className="text-blue-200">Soru yönetimi ve sistem kontrolü</p>
        </div>

        {/* Sunucu Durumu */}
        {serverHealth && (
          <div className="mb-8 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Server className="w-6 h-6 mr-2 text-green-400" />
              📊 Sunucu Durumu
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-300">{serverHealth.questions}</div>
                <div className="text-sm text-gray-300">Soru</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-300">{serverHealth.players}</div>
                <div className="text-sm text-gray-300">Oyuncu</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-300">{serverHealth.port}</div>
                <div className="text-sm text-gray-300">Port</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-300">{Math.round(serverHealth.uptime)}s</div>
                <div className="text-sm text-gray-300">Uptime</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className={`text-2xl font-bold ${serverHealth.gameActive ? 'text-red-300' : 'text-gray-300'}`}>
                  {serverHealth.gameActive ? 'AKTİF' : 'BEKLEMEDE'}
                </div>
                <div className="text-sm text-gray-300">Oyun</div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-center">
              <button
                onClick={checkServerHealth}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-gray-500"
              >
                🔄 Yenile
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center max-w-4xl mx-auto ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Yeni Soru Ekleme */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center mb-6">
              <Plus className="w-6 h-6 text-blue-400 mr-2" />
              <h2 className="text-xl font-semibold text-white">Yeni Soru Ekle</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  Soru
                </label>
                <textarea
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  rows={3}
                  placeholder="Soruyu buraya yazın..."
                  disabled={connectionStatus !== 'connected'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  Doğru Cevap
                </label>
                <input
                  type="text"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, handleAddQuestion)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Doğru cevabı girin"
                  disabled={connectionStatus !== 'connected'}
                />
              </div>

              <button
                onClick={handleAddQuestion}
                disabled={isLoading || !newQuestion.trim() || !newAnswer.trim() || connectionStatus !== 'connected'}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Ekleniyor...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Soru Ekle
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Excel Yükleme */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex items-center mb-6">
              <Upload className="w-6 h-6 text-green-400 mr-2" />
              <h2 className="text-xl font-semibold text-white">Excel Dosyasından Yükle</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-green-200 mb-2">
                  Excel Dosyası Seçin (.xlsx, .xls)
                </label>
                <div className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                    }}
                    className="hidden"
                    id="file-upload"
                    disabled={connectionStatus !== 'connected'}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-white">
                      {selectedFile ? selectedFile.name : 'Dosya seçmek için tıklayın'}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      Sadece .xlsx ve .xls dosyaları
                    </span>
                  </label>
                </div>
              </div>

              {uploadProgress > 0 && (
                <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(Math.max(uploadProgress, 0), 100)}%` }}
                  ></div>
                  <div className="text-xs text-green-300 mt-1 text-center">
                    {uploadProgress}% yüklendi
                  </div>
                </div>
              )}

              <div className="text-sm text-blue-200 bg-white/10 p-3 rounded-lg">
                <strong>📋 Excel Formatı:</strong>
                <br />
                • <code className="bg-white/20 px-1 rounded">question</code> veya <code className="bg-white/20 px-1 rounded">soru</code>: Soru metni
                <br />
                • <code className="bg-white/20 px-1 rounded">answer</code> veya <code className="bg-white/20 px-1 rounded">cevap</code>: Doğru cevap
                <br />
                <em className="text-xs">Sistem farklı sütun isimlerini otomatik algılar</em>
              </div>

              <button
                onClick={handleFileUpload}
                disabled={!selectedFile || isLoading || connectionStatus !== 'connected'}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Yükleniyor... {uploadProgress > 0 && `${uploadProgress}%`}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Dosyayı Yükle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;