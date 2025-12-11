import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // specific replacement for the API key to ensure it is available in the client bundle
    // uses the provided key as a fallback to ensure immediate deployment stability
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "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"),
  },
  build: {
    outDir: 'dist',
  },
});