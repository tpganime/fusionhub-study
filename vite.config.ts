import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Correctly expose specific environment variables
    'process.env': {
      API_KEY: process.env.API_KEY,
      NODE_ENV: process.env.NODE_ENV
    }
  },
  build: {
    outDir: 'dist',
  },
});