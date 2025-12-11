import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // specific replacement for the API key to ensure it is available in the client bundle
    // uses the provided key as a fallback to ensure immediate deployment stability
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "178a64ff-cabe-43b9-9855-7cdc17dfe2ca"),
  },
  build: {
    outDir: 'dist',
  },
});