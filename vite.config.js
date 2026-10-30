import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En GitHub Pages la app vive en /<repo>/; en local, en la raíz.
const base = process.env.GITHUB_PAGES ? `/${process.env.REPO_NAME ?? 'piano_app'}/` : '/'

export default defineConfig({
  base,
  plugins: [react()],
})
