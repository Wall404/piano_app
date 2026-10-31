import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages la app vive en /<repo>/; en local, en la raíz.
const base = process.env.GITHUB_PAGES ? `/${process.env.REPO_NAME ?? 'piano_app'}/` : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Piano App',
        short_name: 'Piano',
        description: 'Practicá piano con tus partituras en un teclado animado.',
        theme_color: '#0b0f1e',
        background_color: '#0b0f1e',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,musicxml}'],
        maximumFileSizeToCacheInBytes: 6_000_000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(tonejs\.github\.io\/audio|fonts\.(googleapis|gstatic)\.com)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'audio-y-fuentes', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
})
