import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { entries: ['index.html'] },
  clearScreen: false,
  server: { host: '127.0.0.1', hmr: { host: '127.0.0.1', port: 1420 }, port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**', '**/docs/**'] } },
  build: {
    target: 'es2022',
    rollupOptions: { output: { onlyExplicitManualChunks: true, manualChunks(id) {
      if (id.includes('/api/mock/')) return 'mock';
      if (id.includes('node_modules') && /react-dom|\/react\//.test(id)) return 'react-vendor';
    } } },
  },
});
