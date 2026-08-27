import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process.env.BACKEND_ORIGIN || process.env.VITE_API_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  build: {
    // Splitting targets:
    //  - react stack becomes a long-lived vendor chunk (cacheable across deploys)
    //  - every route page is its own chunk (React.lazy in App.tsx)
    //  - jsPDF/html2canvas stay in the dynamic pdf-utils chunk only
    chunkSizeWarningLimit: 500,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          // Framework runtime — long-lived and cacheable across deploys.
          if (/react-router|history/.test(id)) return 'vendor-router';
          if (/\/(react|react-dom|scheduler|use-sync-external-store)\//.test(id)) return 'vendor-react';
          // Everything else (lucide, pdf stack…) is split per import-graph:
          // jspdf/html2canvas only ever live in the lazy pdf-utils chunk.
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/a': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/s': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/verify': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/a': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/s': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/verify': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});

