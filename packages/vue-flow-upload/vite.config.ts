import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        nuxt: fileURLToPath(new URL('./src/nuxt.ts', import.meta.url)),
      },
      formats: ['es', 'cjs'],
      cssFileName: 'style',
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['vue', 'vue-i18n-lite', '@nuxt/kit'],
      output: { globals: { vue: 'Vue', 'vue-i18n-lite': 'VueI18nLite' } },
    },
  },
})
