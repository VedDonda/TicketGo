import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Forward all /api/* requests to Express backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Note: Socket.IO connects directly to port 5000 (see BookingModal.jsx)
      // to avoid conflicts with Vite's own HMR WebSocket.
    },
  },
});


