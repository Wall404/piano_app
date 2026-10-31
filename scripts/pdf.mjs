// Convierte un PDF a MusicXML con Audiveris: npm run pdf -- pieza.pdf
import { spawnSync } from 'node:child_process'

const pdf = process.argv[2]
if (!pdf) {
  console.error('Uso: npm run pdf -- pieza.pdf')
  process.exit(1)
}
const run = spawnSync('audiveris', ['-batch', '-transcribe', '-export', '-output', 'scores/', pdf], { stdio: 'inherit' })
if (run.error) console.error('No se encontró Audiveris: https://github.com/audiveris/audiveris')
process.exit(run.status ?? 1)
