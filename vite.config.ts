import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },

  build: {
    // Raise the warning threshold (pre-existing large deps like firebase/framer-motion)
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        // Split vendor chunks to enable better long-term caching
        manualChunks: {
          // Firebase SDK (~400KB) — changes rarely
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // Google Generative AI (~80KB)
          genai: ['@google/genai'],
          // Animation library (~130KB)
          motion: ['motion/react'],
          // Markdown renderer (~120KB)
          markdown: ['react-markdown'],
          // UI icon set (~200KB)
          lucide: ['lucide-react'],
          // React core
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});