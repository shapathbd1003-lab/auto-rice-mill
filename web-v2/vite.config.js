import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '.'),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui':     ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'vendor-mui-x':   ['@mui/x-date-pickers'],
          'vendor-redux':   ['@reduxjs/toolkit', 'react-redux'],
          'vendor-charts':  ['recharts'],
          'vendor-i18n':    ['i18next', 'react-i18next'],
          'vendor-misc':    ['axios', 'dayjs'],
        },
      },
    },
  },
});
