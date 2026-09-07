import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  define: {
    __VFU_ENABLE_HASH_WORKER__: 'false',
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['cjs'],
      cssFileName: 'style',
      fileName: () => 'index.cjs',
    },
    rollupOptions: {
      external: ['vue', 'vue-i18n-lite'],
      output: { globals: { vue: 'Vue', 'vue-i18n-lite': 'VueI18nLite' } },
    },
  },
})
