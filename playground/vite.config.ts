import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { localUploadApi } from './local-api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), localUploadApi()],
  define: {
    __VFU_ENABLE_HASH_WORKER__: 'true',
  },
  resolve: {
    alias: {
      'vue-flow-upload': fileURLToPath(
        new URL('../packages/vue-flow-upload/src/index.ts', import.meta.url),
      ),
    },
  },
})
