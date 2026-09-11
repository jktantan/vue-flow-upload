import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'

/**
 * 使用者文档站的导航与构建配置；只收录接入说明、API 和可操作示例。
 * Navigation and build configuration for the consumer docs; it contains only onboarding, API, and runnable examples.
 */
export default defineConfig({
  /** 文档站标题，显示在浏览器标题和导航栏中。 Site title shown in the browser title and navigation bar. */
  title: 'Vue Flow Upload',
  /** 文档站简短说明，用于搜索结果和首页辅助文案。 Short site description for search results and homepage supporting copy. */
  description: 'Vue 3 上传组件的使用说明、配置参考与在线示例。',
  /** Markdown 页面使用的 Vite 配置，用源码别名确保示例始终验证当前组件实现。 Vite settings for Markdown pages; the source alias ensures demos always validate the current component implementation. */
  vite: {
    resolve: {
      alias: {
        'vue-flow-upload': fileURLToPath(
          new URL('../../packages/vue-flow-upload/src/index.ts', import.meta.url),
        ),
      },
    },
    define: {
      /** 文档 DEMO 也启用哈希 Worker，以覆盖与真实应用一致的大文件能力。 Documentation demos also enable the hash worker to match real application behavior. */
      __VFU_ENABLE_HASH_WORKER__: 'true',
    },
  },
  themeConfig: {
    /** 顶部导航仅提供使用者需要的入口。 Top navigation exposes only the entry points needed by consumers. */
    nav: [
      { text: '开始使用', link: '/guide/getting-started' },
      { text: '配置与 API', link: '/api/flow-upload' },
      { text: 'DEMO', link: '/demos/basic-upload' },
    ],
    /** 侧边栏按学习顺序组织，而非按内部实现组织。 Sidebar follows a learning sequence instead of internal implementation details. */
    sidebar: [
      {
        text: '开始使用',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '常用场景', link: '/guide/common-usage' },
        ],
      },
      {
        text: '配置与 API',
        items: [
          { text: 'FlowUpload', link: '/api/flow-upload' },
          { text: 'AvatarUpload', link: '/api/avatar-upload' },
          { text: '上传传输适配器', link: '/api/transport' },
        ],
      },
      {
        text: 'DEMO',
        items: [
          { text: '基础上传', link: '/demos/basic-upload' },
          { text: '手动上传', link: '/demos/manual-upload' },
          { text: '头像上传', link: '/demos/avatar-upload' },
        ],
      },
    ],
    /** 页面内目录帮助使用者在较长 API 页快速定位。 In-page outlines help consumers navigate longer API pages. */
    outline: { level: [2, 3], label: '本页内容' },
    search: { provider: 'local' },
  },
})
