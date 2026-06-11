import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Desktop renderer re-uses the web source tree.
// In dev: Vite serves at port 5174 (Electron loads this URL).
// In prod: builds to desktop/dist — Electron loads dist/index.html.
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, '../web'),
  base: './',             // relative paths so Electron file:// protocol works
  server: {
    port: 5174,
    // No /api proxy — desktop calls SQLite via window.electronAPI
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
  define: {
    // Feature flag so shared code can detect desktop mode
    __IS_DESKTOP__: JSON.stringify(true),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../web/src'),
    },
  },
});
