import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { createFlowUploadI18n, vueFlowUpload } from 'vue-flow-upload'
import '../../../packages/vue-flow-upload/src/styles/flow-upload.scss'
// 显式引入 Viewer.js 样式，避免 VitePress 外部化组件库时丢失查看器布局规则。
// Import Viewer.js styles explicitly so VitePress externalization cannot drop the viewer layout rules.
import 'viewerjs/dist/viewer.css'
import './style.css'

/**
 * 文档主题在默认 VitePress 外观上注册上传组件的全局请求配置。
 * The documentation theme registers the uploader's shared request configuration on top of the default VitePress theme.
 */
const theme: Theme = {
  extends: DefaultTheme,
  /**
   * 为交互示例安装组件插件；示例各自提供 mock transport，因此不发送真实网络请求。
   * Installs the component plugin for interactive examples; each demo supplies a mock transport and makes no real network requests.
   */
  enhanceApp({ app }) {
    // 提供宿主 i18n 实例，使未显式传入 locale 的组件也有可用文案，并避免缺少注入的运行时警告。
    // Provides a host i18n instance so components without an explicit locale always have copy and no missing-injection warning is raised.
    app.use(createFlowUploadI18n())
    app.use(vueFlowUpload)
  },
}

export default theme
