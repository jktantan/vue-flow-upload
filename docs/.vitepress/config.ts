import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'

/** 中文站顶部导航。 Chinese-site top navigation. */
const zhNav = [
  { text: '开始使用', link: '/guide/getting-started' },
  { text: '配置与 API', link: '/api/flow-upload' },
  { text: 'DEMO', link: '/demos/basic-upload' },
]
/** 英文站顶部导航。 English-site top navigation. */
const enNav = [
  { text: 'Get started', link: '/en/guide/getting-started' },
  { text: 'Configuration & API', link: '/en/api/flow-upload' },
  { text: 'Demos', link: '/en/demos/basic-upload' },
]
/** 中文站按学习顺序组织的侧边栏。 Chinese-site sidebar organized in learning order. */
const zhSidebar = [
  {
    text: '开始使用',
    items: [
      { text: '快速开始', link: '/guide/getting-started' },
      { text: '全局配置与 Nuxt', link: '/guide/global-config' },
      { text: '常用场景', link: '/guide/common-usage' },
      { text: '后端接口协议', link: '/guide/backend-api-contract' },
    ],
  },
  {
    text: '配置与 API',
    items: [
      { text: 'FlowUpload', link: '/api/flow-upload' },
      { text: 'AvatarUpload', link: '/api/avatar-upload' },
      { text: '上传传输适配器', link: '/api/transport' },
      { text: '下载传输适配器', link: '/api/download-transport' },
      { text: '文件查询传输适配器', link: '/api/query-transport' },
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
]
/** 英文站按学习顺序组织的侧边栏。 English-site sidebar organized in learning order. */
const enSidebar = [
  {
    text: 'Get started',
    items: [
      { text: 'Quick start', link: '/en/guide/getting-started' },
      { text: 'Global configuration & Nuxt', link: '/en/guide/global-config' },
      { text: 'Common usage', link: '/en/guide/common-usage' },
    ],
  },
  {
    text: 'Configuration & API',
    items: [
      { text: 'FlowUpload', link: '/en/api/flow-upload' },
      { text: 'AvatarUpload', link: '/en/api/avatar-upload' },
      { text: 'Upload transport', link: '/en/api/transport' },
      { text: 'Download transport', link: '/en/api/download-transport' },
      { text: 'File query transport', link: '/en/api/query-transport' },
    ],
  },
  {
    text: 'Demos',
    items: [
      { text: 'Basic upload', link: '/en/demos/basic-upload' },
      { text: 'Manual upload', link: '/en/demos/manual-upload' },
      { text: 'Avatar upload', link: '/en/demos/avatar-upload' },
    ],
  },
]

/**
 * 使用者文档站的导航与构建配置；只收录接入说明、API 和可操作示例。
 * Navigation and build configuration for the consumer docs; it contains only onboarding, API, and runnable examples.
 */
export default defineConfig({
  /** 文档站标题，显示在浏览器标题和导航栏中。 Site title shown in the browser title and navigation bar. */
  title: 'Vue Flow Upload',
  /** 文档站简短说明，用于搜索结果和首页辅助文案。 Short site description for search results and homepage supporting copy. */
  description: 'Vue 3 上传组件的使用说明、配置参考与在线示例。',
  /** 文档根路径为中文，/en/ 路径提供完整英文内容。 The documentation root is Chinese, while /en/ provides complete English content. */
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        outline: { level: [2, 3], label: '本页内容' },
        langMenuLabel: '切换语言',
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        outline: { level: [2, 3], label: 'On this page' },
        langMenuLabel: 'Change language',
      },
    },
  },
  /** Markdown 页面使用的 Vite 配置，用源码别名确保示例始终验证当前组件实现。 Vite settings for Markdown pages; the source alias ensures demos always validate the current component implementation. */
  vite: {
    /**
     * 文档中的 SCSS 使用 Dart Sass 现代编译接口，避免 Vite 5 默认旧接口在 Sass 2.0 移除前持续发出弃用警告。
     * Documentation SCSS uses Dart Sass's modern compiler API, preventing Vite 5's legacy default from emitting deprecation warnings before Sass 2.0 removes it.
     */
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    resolve: {
      alias: {
        'vue-flow-upload': fileURLToPath(
          new URL('../../packages/vue-flow-upload/src/index.ts', import.meta.url),
        ),
        // Viewer.js 属于组件库依赖，文档构建需指向 workspace 包内已安装的副本。
        // Viewer.js is a component-library dependency; point docs at the workspace package copy.
        viewerjs: fileURLToPath(
          new URL('../../packages/vue-flow-upload/node_modules/viewerjs', import.meta.url),
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
    nav: zhNav,
    /** 侧边栏按学习顺序组织，而非按内部实现组织。 Sidebar follows a learning sequence instead of internal implementation details. */
    sidebar: zhSidebar,
    /** 页面内目录帮助使用者在较长 API 页快速定位。 In-page outlines help consumers navigate longer API pages. */
    outline: { level: [2, 3], label: '本页内容' },
    /** 本地搜索按语言路径显示匹配的按钮、弹窗和键盘辅助文案。 Local search shows matching button, modal, and keyboard-help copy for each locale path. */
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                displayDetails: '显示详细列表',
                resetButtonTitle: '清除搜索条件',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有找到相关结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '回车',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc',
                },
              },
            },
          },
          en: {
            translations: {
              button: { buttonText: 'Search docs', buttonAriaLabel: 'Search docs' },
              modal: {
                displayDetails: 'Display detailed list',
                resetButtonTitle: 'Clear search',
                backButtonTitle: 'Close search',
                noResultsText: 'No results found',
                footer: {
                  selectText: 'Select',
                  selectKeyAriaLabel: 'Enter',
                  navigateText: 'Navigate',
                  navigateUpKeyAriaLabel: 'Up arrow',
                  navigateDownKeyAriaLabel: 'Down arrow',
                  closeText: 'Close',
                  closeKeyAriaLabel: 'Esc',
                },
              },
            },
          },
        },
      },
    },
  },
})
