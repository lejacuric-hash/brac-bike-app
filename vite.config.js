import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// maplibre-gl loads its worker at runtime by resolving
// `./maplibre-gl-worker.mjs` relative to its own bundled `import.meta.url`.
// Vite can't detect that reference statically (the filename is built from a
// template literal inside maplibre-gl), so the worker file never gets
// emitted into the build on its own — this copies it into the same
// assets directory as the final bundle so that lookup resolves correctly.
// The worker file is copied verbatim (unprocessed by Rollup), and it in turn
// imports a sibling `./maplibre-gl-shared.mjs` (maplibre-gl's shared core
// code) via a relative import, so that file has to be copied alongside it
// too or the worker fails to load with a 404 on maplibre-gl-shared.mjs.
const MAPLIBRE_GL_WORKER_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

function copyMaplibreGlWorkerPlugin() {
  let outDir = 'dist'
  let assetsDir = 'assets'
  return {
    name: 'copy-maplibre-gl-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      assetsDir = config.build.assetsDir
    },
    closeBundle() {
      const destDir = path.join(rootDir, outDir, assetsDir)
      fs.mkdirSync(destDir, { recursive: true })
      for (const filename of MAPLIBRE_GL_WORKER_FILES) {
        const src = path.join(rootDir, 'node_modules/maplibre-gl/dist', filename)
        if (!fs.existsSync(src)) {
          this.warn(`maplibre-gl file not found at ${src}; the map's worker will fail to load in production.`)
          continue
        }
        fs.copyFileSync(src, path.join(destDir, filename))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyMaplibreGlWorkerPlugin()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  build: {
    rollupOptions: {
      external: [],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
  },
})