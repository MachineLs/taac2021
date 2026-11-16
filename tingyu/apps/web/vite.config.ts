import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API requests are proxied to the backend. Each agent may run its own backend on a different port:
//   VITE_API_PORT=4103 npx vite --port 5173
const apiPort = process.env.VITE_API_PORT || '4100';
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
  preview: { proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
});
