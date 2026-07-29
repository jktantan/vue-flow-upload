import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'vue-flow-upload': fileURLToPath(
        new URL('../packages/vue-flow-upload/src/index.ts', import.meta.url),
      ),
    },
  },
})
