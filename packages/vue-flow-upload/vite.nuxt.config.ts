import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/nuxt.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'nuxt.js',
    },
    rollupOptions: {
      external: ['@nuxt/kit'],
    },
  },
})
