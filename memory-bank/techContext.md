# Technical Context - Bil_Bakalim TV Quiz Application

## Technology Stack

### Frontend Technologies
```typescript
// Core Framework
React 18.3.1           // Modern UI framework with hooks and concurrent features
TypeScript 5.5.3       // Type-safe JavaScript with enhanced developer experience
Vite 5.4.2             // Fast build tool with HMR and optimized bundling

// Styling & UI
Tailwind CSS 3.4.1     // Utility-first CSS framework for rapid styling
Lucide React 0.344.0   // Modern icon library with tree-shaking support

// Real-time Communication
Socket.IO Client 4.7.4 // WebSocket library with fallback to polling
```

### Backend Technologies
```javascript
// Server Framework
Node.js                // JavaScript runtime environment
Express.js 4.18.2      // Minimal web framework for Node.js

// Real-time Communication
Socket.IO 4.7.4        // Real-time bidirectional event-based communication

// File Processing
Multer 1.4.5           // Middleware for handling multipart/form-data
XLSX 0.18.5            // Excel file parsing and generation library

// QR Code Generation
QRCode 1.5.3           // QR code generation library

// Development Tools
Concurrently 8.2.2     // Run multiple commands concurrently
```

### Development Tools
```json
{
  "build": "Vite 5.4.2",
  "linting": "ESLint 9.9.1 + TypeScript ESLint 8.3.0",
  "styling": "Tailwind CSS 3.4.1 + PostCSS 8.4.35",
  "types": "TypeScript 5.5.3 + @types packages",
  "bundling": "Vite + React Plugin 4.3.1",
  "server": "Nodemon 3.1.10 for auto-restart",
  "audio": "Web Audio API for countdown sounds"
}
```

### Audio System
```javascript
// Web Audio API Implementation
const playCountdownSound = (_second: number) => {
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
};
```

## Development Setup

### Prerequisites
- **Node.js**: 16.0+ (recommended: 18.x LTS)
- **npm**: 8.0+ or **yarn**: 1.22+
- **Git**: Latest version for version control

### Installation Process
```bash
# Clone repository
git clone [repository-url]
cd Bil_Bakalim

# Install dependencies
npm install

# Development mode (both frontend and backend)
npm run dev

# Production build
npm run build
npm start
```

### Port Configuration
```javascript
// Development Ports
Frontend: 5173 (Vite dev server)
Backend: 3001 (Express server)

// Production Ports
Frontend: 5173 (Vite preview)
Backend: 3001 (Express server)
```

## Technical Constraints

### Performance Constraints
- **Bundle Size**: Target < 2MB for initial load
- **Response Time**: < 100ms for API endpoints
- **Connection Limit**: Support 100+ concurrent users
- **Memory Usage**: < 200MB server memory footprint

### Browser Compatibility
```javascript
// Supported Browsers
Chrome: 90+
Firefox: 88+
Safari: 14+
Edge: 90+

// Mobile Browsers
iOS Safari: 14+
Chrome Mobile: 90+
Samsung Internet: 14+
```

### Network Constraints
- **WebSocket Support**: Required for real-time features
- **Fallback**: HTTP polling for limited environments
- **Bandwidth**: Optimized for low-bandwidth connections
- **Latency**: Designed for < 500ms round-trip time

### Audio Constraints
- **Web Audio API**: Required for countdown sounds
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+
- **Audio Context**: Automatic audio context creation
- **Timing**: Synchronized with server countdown
- **Performance**: Lightweight oscillator-based sounds

## Dependencies Management

### Core Dependencies
```json
{
  "react": "^18.3.1",              // UI Framework
  "react-dom": "^18.3.1",          // DOM rendering
  "socket.io-client": "^4.7.4",    // Real-time communication
  "express": "^4.18.2",            // Server framework
  "socket.io": "^4.7.4",           // Server real-time
  "multer": "^1.4.5-lts.1",        // File upload handling
  "xlsx": "^0.18.5",               // Excel processing
  "qrcode": "^1.5.3",              // QR code generation
  "lucide-react": "^0.344.0",      // Icon library
  "concurrently": "^8.2.2"         // Development tool
}
```

### Development Dependencies
```json
{
  "@types/react": "^18.3.5",       // React type definitions
  "@types/react-dom": "^18.3.0",   // React DOM types
  "@types/qrcode": "^1.5.5",       // QRCode types
  "typescript": "^5.5.3",          // TypeScript compiler
  "vite": "^5.4.2",                // Build tool
  "@vitejs/plugin-react": "^4.3.1", // React plugin for Vite
  "tailwindcss": "^3.4.1",         // CSS framework
  "eslint": "^9.9.1",              // Linting
  "typescript-eslint": "^8.3.0"    // TypeScript ESLint
}
```

## Configuration Files

### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Vite Configuration (vite.config.ts)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          socket: ['socket.io-client']
        }
      }
    }
  }
})
```

### Tailwind Configuration (tailwind.config.js)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfdf5',
          500: '#10b981',
          900: '#064e3b'
        },
        secondary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite'
      }
    },
  },
  plugins: [],
}
```

## Tool Usage Patterns

### Development Workflow
```bash
# Start development environment
npm run dev                    # Starts both frontend and backend

# Individual services
npm run frontend              # Vite dev server only
npm run server               # Express server only

# Production deployment
npm run build                # Build frontend
npm run start               # Start production server
```

### Code Quality Tools
```bash
# Linting
npm run lint                 # ESLint with TypeScript support

# Type checking
npx tsc --noEmit            # TypeScript compilation check

# Build verification
npm run build               # Production build test
```

### Testing Strategy
```bash
# Manual testing approach
1. Start development server
2. Test admin panel functionality
3. Test game host interface
4. Test player participation
5. Test real-time communication
6. Test file upload features
```

## Environment Configuration

### Development Environment
```javascript
// Environment Variables
NODE_ENV=development
PORT=3001
FRONTEND_PORT=5173
CORS_ORIGIN=http://localhost:5173
```

### Production Environment
```javascript
// Environment Variables
NODE_ENV=production
PORT=3001
FRONTEND_PORT=5173
CORS_ORIGIN=https://yourdomain.com
```

## Build and Deployment

### Build Process
```bash
# Frontend build
vite build                    # Creates optimized production build

# Backend preparation
npm install --production     # Install production dependencies only

# Combined deployment
npm run start               # Serves built frontend + backend
```

### Deployment Considerations
- **Static Files**: Served by Express.js
- **API Routes**: RESTful endpoints for data operations
- **WebSocket**: Socket.IO for real-time features
- **File Uploads**: Multer middleware for Excel processing
- **CORS**: Configured for cross-origin requests

## Performance Optimization

### Frontend Optimizations
- **Code Splitting**: Dynamic imports for route-based splitting
- **Bundle Analysis**: Webpack Bundle Analyzer integration
- **Tree Shaking**: Automatic dead code elimination
- **Image Optimization**: WebP format support

### Backend Optimizations
- **Connection Pooling**: Socket.IO connection management
- **Memory Management**: Efficient garbage collection
- **File Processing**: Stream-based Excel parsing
- **Caching**: In-memory caching for frequently accessed data

## Security Considerations

### Input Validation
```javascript
// File upload validation
const allowedTypes = ['.xlsx', '.xls'];
const maxFileSize = 10 * 1024 * 1024; // 10MB

// Socket.IO validation
socket.use((socket, next) => {
  // Validate socket connection
  next();
});
```

### CORS Configuration
```javascript
// Express CORS setup
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));
```

This technical context provides the foundation for all development decisions and system architecture choices.
