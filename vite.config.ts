import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The preview environment proxies this app under a *.e2b.app host, so we
// bind to 0.0.0.0, allow any host, and proxy /api to the backend.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
});
