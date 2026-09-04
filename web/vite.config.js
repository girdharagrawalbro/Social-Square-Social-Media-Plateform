import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Social Square',
        short_name: 'SocialSquare',
        description: 'An AI-powered social media platform with real-time features and content generation.',
        theme_color: '#6366f1',
        icons: [
          {
            src: 'https://i.ibb.co/7kr0KHK/logo.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'https://i.ibb.co/7kr0KHK/logo.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000 // 5MB
      }
    })
  ],
  // Keep using REACT_APP_ prefix for env vars to avoid huge refactoring
  envPrefix: 'REACT_APP_',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'build'
  }
});
