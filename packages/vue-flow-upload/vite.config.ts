import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 由宿主应用安装并打包的大型运行时依赖，避免在组件库产物中重复复制。
 * Large runtime dependencies installed and bundled by the host application, avoiding copies in the component library artifact.
 */
const RUNTIME_EXTERNALS = ['hash-wasm', 'v-viewer', 'vue-picture-cropper']

export default defineConfig({
  plugins: [vue()],
  define: {
    __VFU_ENABLE_HASH_WORKER__: 'true',
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      cssFileName: 'style',
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['vue', 'vue-i18n-lite', '@nuxt/kit', ...RUNTIME_EXTERNALS],
      output: { globals: { vue: 'Vue', 'vue-i18n-lite': 'VueI18nLite' } },
    },
  },
})
