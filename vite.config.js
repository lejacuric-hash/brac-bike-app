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
      const src = path.join(rootDir, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs')
      if (!fs.existsSync(src)) {
        this.warn(`maplibre-gl worker file not found at ${src}; the map's worker will fail to load in production.`)
        return
      }
      const destDir = path.join(rootDir, outDir, assetsDir)
      fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(src, path.join(destDir, 'maplibre-gl-worker.mjs'))
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