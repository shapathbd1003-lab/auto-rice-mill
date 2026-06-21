import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: `${__dirname}/dist`,
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: `${__dirname}/index.html`,
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui':   ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-misc':  ['axios', 'dayjs', 'i18next', 'react-i18next'],
        },
      },
    },
  },
});
