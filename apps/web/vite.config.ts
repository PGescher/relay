import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Relay',
        short_name: 'Relay',
        theme_color: '#ffffff',
        icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }]
      }
    })
  ],
  server: {
    host: true, // Listen on all network interfaces
    port: 5173,
    allowedHosts: true, 
    proxy: {
      '/api': {
        target: 'http://api:3000',
        changeOrigin: true,
      },
    },
  },
});