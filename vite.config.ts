/// <reference types="vitest/config" />
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Base path: '/' for local dev and root hosts; '/RepLog/' on GitHub Pages
// (the deploy workflow sets VITE_BASE). Router + PWA manifest derive from this.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Icons are produced by `pwa-assets-generator` (pwa-assets.config.ts).
      // Listing them here lets the plugin inject the <link>/manifest entries
      // and precache them.
      pwaAssets: { config: true },
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'RepLog',
        short_name: 'RepLog',
        description: 'Turn messy workout notes into a coach — on-device.',
        theme_color: '#0c0d0f',
        background_color: '#0c0d0f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app is fully local — precache the whole shell so it works
        // offline. Tesseract's worker/wasm/traineddata are fetched on demand
        // (Import route only) and are large, so they're left out of precache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Don't precache the OCR engine assets (multi-MB, lazy on Import).
        globIgnores: ['**/tesseract*/**'],
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the shared shell libs into stable, cacheable chunks. Route
        // pages are React.lazy'd in App.tsx; recharts is deliberately NOT
        // force-chunked so Rollup keeps it inside the async chunk graph of the
        // charted routes (Dashboard + Exercise) — pinning it to a named chunk
        // here would hoist it into the entry's eager modulepreload. Tesseract
        // stays lazy via its dynamic import in ocr.ts (Import route only).
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          motion: ['motion'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'mobile/**'],
  },
});
