# System Patterns - Bil_Bakalim TV Quiz Application

## System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin Panel   │    │   Game Host     │    │  Player Views   │
│   (React UI)    │    │   (React UI)    │    │  (React UI)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │              ┌───────┴───────────────────────┴───────┐
          │              │        Socket.IO Server              │
          │              │      (Real-time Communication)       │
          └──────────────┼───────────────────────────────────────┤
                         │         Express.js Server            │
                         │       (REST API + Static Files)      │
                         └───────────────────────────────────────┘
                                          │
                                   ┌──────┴──────┐
                                   │   Data      │
                                   │ (JSON Files)│
                                   └─────────────┘
```

### Component Relationships
```
App.tsx (Main Router)
├── AdminPanel.tsx
│   ├── Socket.IO Client
│   ├── File Upload Handler
│   └── Question Management
├── QuizHost.tsx
│   ├── Socket.IO Client
│   ├── QR Code Generator
│   └── Game State Manager
└── PlayerView.tsx
    ├── Socket.IO Client
    ├── Answer Interface
    └── Score Display
```

## Key Technical Decisions

### 1. Real-time Communication Architecture
**Pattern**: Event-Driven Architecture with WebSocket
**Implementation**: Socket.IO for bidirectional communication
**Rationale**: 
- Enables instant updates across all clients
- Handles connection failures gracefully
- **Recent Fix**: Added 1-second delay in disconnect event to prevent premature player removal
- Supports multiple transport protocols

```javascript
// Client Configuration
const socket = io({
  transports: ['websocket', 'polling'],
  upgrade: true,
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

// Server Configuration
io.engine.on('connection_error', (err) => {
  console.log('Connection error:', err.req, err.code, err.message, err.context);
});
```

### 2. State Management Pattern
**Pattern**: Component-Level State with Socket Events
**Implementation**: React hooks (useState, useEffect) + Socket.IO events
**Rationale**:
- Simpler than global state management for this use case
- Real-time updates handled by socket events
- Each component manages its own relevant state

```typescript
// Example: Game State Management
const [gameState, setGameState] = useState({
  isActive: false,
  currentQuestion: null,
  players: [],
  scores: {}
});

useEffect(() => {
  socket.on('gameStateUpdate', (newState) => {
    setGameState(newState);
  });
}, []);
```

### 3. File Processing Architecture
**Pattern**: Stream-Based Processing with Validation
**Implementation**: Multer middleware + XLSX library
**Rationale**:
- Handles large files efficiently
- Provides progress tracking
- Validates data before processing

```javascript
// File Upload Configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowedTypes.includes(ext));
  }
});
```

### 4. Error Handling Strategy
**Pattern**: Graceful Degradation with User Feedback
**Implementation**: Try-catch blocks + User notifications
**Rationale**:
- Maintains application stability
- Provides clear user feedback
- Enables recovery from failures

```typescript
// Error Handling Pattern
const handleSocketError = (error: Error) => {
  console.error('Socket error:', error);
  setConnectionStatus('error');
  showNotification('Connection lost. Attempting to reconnect...', 'warning');
  
  // Automatic reconnection handled by Socket.IO
  setTimeout(() => {
    if (socket.disconnected) {
      socket.connect();
    }
  }, 2000);
};
```

## Design Patterns in Use

### 1. Observer Pattern
**Usage**: Socket.IO event system
**Implementation**: Event listeners for real-time updates
**Benefits**: Decoupled components, real-time synchronization

### 2. Factory Pattern
**Usage**: Question creation and validation
**Implementation**: Question factory functions
**Benefits**: Consistent object creation, validation logic

### 3. Strategy Pattern
**Usage**: Different game modes (sequential vs random)
**Implementation**: Game mode strategies
**Benefits**: Easy to extend with new game modes

### 4. Singleton Pattern
**Usage**: Socket.IO connection management
**Implementation**: Single socket instance per component
**Benefits**: Consistent connection state, resource efficiency

## Component Architecture Patterns

### 1. Container-Presenter Pattern
**Usage**: Separation of logic and presentation
**Implementation**: 
- Container components handle state and logic
- Presenter components handle UI rendering
**Benefits**: Better testability, reusability

### 2. Compound Component Pattern
**Usage**: Complex UI components (AdminPanel, QuizHost)
**Implementation**: Multiple related components working together
**Benefits**: Modularity, easier maintenance

### 3. Render Props Pattern
**Usage**: Shared functionality across components
**Implementation**: Components that accept render functions
**Benefits**: Code reuse, flexibility

## Recent Critical Fixes

### 1. Complete Answer Submission System
**Problem**: "Cevabınız Gönderildi!" screen not showing, no audio feedback, poor UX
**Solution**: Complete answer submission flow with immediate feedback and audio
**Implementation**:
```javascript
// PlayerView.tsx - Complete answer submission flow
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
  setHasAnswered(true); // Immediate UI feedback
  
  // Calculate answer time and add to answered players
  const answerTime = 30 - timeLeft;
  setAnsweredPlayers(prev => {
    const newList = [...prev, {
      playerName: playerName,
      timestamp: Date.now(),
      answerTime: answerTime
    }];
    return newList.sort((a, b) => a.timestamp - b.timestamp);
  });
  
  socket.emit('answer', parseFloat(answer) || answer);
};

// Audio feedback system (matching QuizHost)
const playCountdownSound = (_second: number) => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
  } catch (error) {
    console.log('🔊 Ses çalınamadı:', error);
  }
};

// Synchronized timer with audio feedback
socketConnection.on('timerUpdate', (data: { timeLeft: number }) => {
  console.log('⏰ Süre güncellendi:', data.timeLeft);
  setTimeLeft(data.timeLeft);
  
  // Play sound for last 5 seconds (matching QuizHost timing)
  if (data.timeLeft <= 5 && data.timeLeft > 0 && lastPlayedSecond !== data.timeLeft) {
    playCountdownSound(data.timeLeft);
    setLastPlayedSecond(data.timeLeft);
  }
});
```

### 2. Server-Side Answer Processing Enhancement
**Problem**: Text answers not processed correctly, NaN errors
**Solution**: Enhanced answer processing for both text and numeric answers
**Implementation**:
```javascript
// server/server.js - Enhanced answer processing
socket.on('answer', (value) => {
  // ... validation logic ...
  
  // Store answer (numeric or text)
  const numericValue = parseFloat(value);
  const answerValue = isNaN(numericValue) ? value : numericValue;
  
  answers[socket.id] = {
    value: answerValue,
    timestamp: currentTime,
    playerName: players[socket.id].name,
    playerId: socket.id
  };
  
  // Send confirmation to player
  socket.emit('answerConfirmed', {
    value: answerValue,
    timestamp: currentTime,
    message: 'Cevabınız alındı!',
    timeRemaining: Math.round(timeRemaining / 1000),
    totalAnswers: Object.keys(answers).length,
    totalPlayers: Object.keys(players).length
  });
  
  // Broadcast to other players
  socket.broadcast.emit('playerAnswered', {
    playerName: players[socket.id].name,
    timestamp: currentTime,
    answerTime: answerTime
  });
});

// Enhanced result calculation
function calculateResults() {
  // Handle both numeric and text answers
  for (const [id, answerObj] of Object.entries(answers)) {
    const answerValue = answerObj.value;
    
    if (typeof currentAnswer === 'number' && typeof answerValue === 'number') {
      // Numeric answer processing
      const diff = Math.abs(answerValue - currentAnswer);
      // ... winner calculation logic
    } else if (typeof currentAnswer === 'string' && typeof answerValue === 'string') {
      // Text answer processing (case-insensitive)
      const isExactMatch = answerValue.toLowerCase() === currentAnswer.toLowerCase();
      if (isExactMatch) {
        // ... winner calculation logic
      }
    }
  }
}
```

### 2. Player Join/Leave Issues Resolution
**Problem**: Players were not appearing on host screen after joining
**Root Cause**: Disconnect event was firing immediately after join, removing players
**Solution**: Added 1-second delay in disconnect event handler
**Implementation**:
```javascript
// Before: Immediate removal
if (players[socket.id]) {
  delete players[socket.id];
  // ... notifications
}

// After: Delayed removal with reconnection support
if (players[socket.id]) {
  setTimeout(() => {
    if (players[socket.id]) {
      delete players[socket.id];
      // ... notifications
    }
  }, 1000);
}
```

### 3. Turkish Character Handling
**Problem**: Turkish characters not properly converted to uppercase
**Solution**: Custom replacement chain before toUpperCase()
**Implementation**:
```javascript
const playerName = name.trim()
  .replace(/ı/g, 'I')
  .replace(/i/g, 'İ')
  .replace(/ğ/g, 'Ğ')
  .replace(/ü/g, 'Ü')
  .replace(/ş/g, 'Ş')
  .replace(/ö/g, 'Ö')
  .replace(/ç/g, 'Ç')
  .toUpperCase();
```

### 4. Duplicate Notification Fix
**Problem**: Player join/leave notifications appearing twice
**Solution**: Removed duplicate list updates, kept only toast notifications
**Implementation**:
```javascript
// playerJoined event: Only toast notification
socketConnection.on('playerJoined', (playerName) => {
  addToast(`🎉 ${playerName} oyuna katıldı!`, 'success');
  // List update handled by allParticipants event
});

// allParticipants event: Only list update
socketConnection.on('allParticipants', (participants) => {
  setParticipantNames(participants.reverse());
  // No duplicate notifications
});
```

## Critical Implementation Paths

### 1. Socket Connection Flow
```
Client Start → Socket Creation → Connection Attempt → 
Authentication (if needed) → Event Registration → 
Ready State → Game Participation
```

### 2. Question Processing Flow
```
Excel Upload → File Validation → Data Parsing → 
Question Creation → Database Storage → 
Broadcast to Clients → Display to Users
```

### 3. Game Session Flow
```
Host Start → QR Code Generation → Player Join → 
Question Presentation → Answer Collection → 
Score Calculation → Result Display → Next Question
```

### 4. Error Recovery Flow
```
Error Detection → User Notification → 
Automatic Retry → Fallback Mechanism → 
State Recovery → Continue Operation
```

## Performance Optimization Patterns

### 1. Connection Pooling
**Implementation**: Socket.IO connection management
**Benefits**: Efficient resource usage, better scalability

### 2. Lazy Loading
**Implementation**: Dynamic imports for components
**Benefits**: Reduced initial bundle size, faster loading

### 3. Debouncing
**Implementation**: Input validation and API calls
**Benefits**: Reduced server load, better user experience

### 4. Memoization
**Implementation**: React.memo and useMemo
**Benefits**: Prevents unnecessary re-renders, better performance

## Security Patterns

### 1. Input Validation
**Implementation**: Client and server-side validation
**Benefits**: Prevents malicious input, data integrity

### 2. CORS Configuration
**Implementation**: Restricted origin access
**Benefits**: Prevents unauthorized access, security

### 3. File Upload Security
**Implementation**: File type and size validation
**Benefits**: Prevents malicious file uploads

### 4. Error Sanitization
**Implementation**: Safe error message display
**Benefits**: Prevents information leakage

## Scalability Considerations

### 1. Horizontal Scaling
**Implementation**: Stateless server design
**Benefits**: Easy to scale with multiple instances

### 2. Database Abstraction
**Implementation**: JSON file system (ready for database migration)
**Benefits**: Easy to switch to database storage

### 3. Caching Strategy
**Implementation**: Client-side caching for static data
**Benefits**: Reduced server load, faster responses

### 4. Load Balancing
**Implementation**: Socket.IO adapter for multiple servers
**Benefits**: Distributed real-time communication

These patterns ensure the system is maintainable, scalable, and follows best practices for real-time web applications.
