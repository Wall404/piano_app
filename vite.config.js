import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

// En GitHub Pages la app vive en /<repo>/; en local, en la raíz.
const base = process.env.GITHUB_PAGES ? `/${process.env.REPO_NAME ?? 'practica-piano'}/` : '/'

/**
 * Solo en `npm run dev`: la pantalla «Convertir un PDF» manda el PDF a la PC, que corre scripts/pdf.mjs
 * (Audiveris) y devuelve los .mxl y el .coleccion.json para guardarlos en la biblioteca.
 */
const pdfHelper = () => ({
  name: 'pdf-helper',
  configureServer(server) {
    server.middlewares.use('/api/pdf', async (req, res) => {
      const send = (status, body) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      }
      if (req.method !== 'POST') return send(405, { error: 'Usá POST.' })
      const url = new URL(req.url, 'http://pc')
      const name = basename(url.searchParams.get('name') ?? 'partitura.pdf').replace(/[^\w.\- ]/g, '_').replace(/(\.pdf)?$/i, '.pdf')
      const paginas = url.searchParams.get('paginas')
      // Dentro de la app (no en /tmp): el Audiveris de Flathub solo ve ~/Documentos.
      await mkdir('scores', { recursive: true })
      const dir = await mkdtemp(resolve('scores/.convertir-'))
      try {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        await writeFile(join(dir, name), Buffer.concat(chunks))
        const args = [resolve('scripts/pdf.mjs'), name, ...(paginas ? ['--paginas', paginas] : ['--coleccion'])]
        let log = ''
        const code = await new Promise((done) => {
          const child = spawn(process.execPath, args, { cwd: dir })
          child.stdout.on('data', (d) => void (log += d))
          child.stderr.on('data', (d) => void (log += d))
          child.on('close', done)
        })
        if (code) {
          const missing = log.includes('No se encontró Audiveris')
          return send(500, {
            error: missing
              ? 'Falta instalar Audiveris en la PC.'
              : `Audiveris no pudo leer el PDF: ${log.trim().split('\n').slice(-3).join(' ')}`,
          })
        }
        const out = join(dir, 'scores')
        const names = (await readdir(out)).filter((f) => /\.(mxl|json)$/.test(f))
        send(200, { files: await Promise.all(names.map(async (f) => ({ name: f, data: (await readFile(join(out, f))).toString('base64') }))) })
      } catch (err) {
        send(500, { error: `La PC no pudo convertir el PDF: ${err.message}` })
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    })
  },
})

export default defineConfig({
  base,
  plugins: [
    react(),
    pdfHelper(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Práctica Piano',
        short_name: 'Práctica Piano',
        description: 'Practicá piano con tus partituras en un teclado animado.',
        theme_color: '#0b0f1e',
        background_color: '#0b0f1e',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,musicxml,mp3}'],
        maximumFileSizeToCacheInBytes: 6_000_000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fuentes', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
})
