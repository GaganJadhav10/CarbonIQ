import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Note: there is deliberately no dev-server proxy for /api.
//
// The frontend is deployed to Vercel and the API to Render, so in production
// every request is cross-origin. Pointing the dev server straight at the API
// via VITE_API_BASE_URL keeps development on that same code path, which means
// a CORS misconfiguration fails on localhost instead of after a deploy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
