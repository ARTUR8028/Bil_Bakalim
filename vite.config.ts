import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'https://bil-bakalim.onrender.com',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'https://bil-bakalim.onrender.com',
        changeOrigin: true,
        ws: true
      }
    }
  }
});