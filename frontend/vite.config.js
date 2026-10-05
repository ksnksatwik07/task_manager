import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Only used by `npm run dev`: forwards /api to a locally running backend.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
