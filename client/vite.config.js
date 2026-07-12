import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Output React build into TicketGo/public/ so Express serves it directly
    outDir: '../public',
    emptyOutDir: true, // clean the output folder before each build
  },
  server: {
    port: 3000,
    proxy: {
      // Forward all /api/* requests to Express backend during development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Note: Socket.IO connects directly to port 5000 (see BookingPage.jsx)
      // to avoid conflicts with Vite's own HMR WebSocket.
    },
  },
});



