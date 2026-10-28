# 主题与样式

组件样式通过 `vue-flow-upload/style.css` 加载。默认配色直接采用 [Element Plus](https://element-plus.org/) 的浅色色板，并在深色模式下切换到其深色色板；如果宿主项目已经安装 Element Plus，组件会优先读取 `--el-*` 变量，自动跟随项目的品牌色与深浅模式。

## 深色模式

在 `html`、任意祖先元素或组件外层容器上添加 `dark` / `vfu-dark` 类即可切换：

```html
<!-- 跟随 Element Plus / VitePress 等生态惯例：整页深色 -->
<html class="dark">
  <body>
    <!-- 或者只让某个区域使用深色 token -->
    <div class="vfu-dark">
      <FlowUpload v-model="files" belong-id="order-1" />
    </div>
  </body>
</html>
```

组件不会自动响应 `prefers-color-scheme`，避免在宿主尚未准备好深色背景时单独变暗。需要跟随系统时，由宿主决定何时添加 `dark` 类：

```ts
// 将系统偏好映射为 dark 类，组件会随之一并切换。
// Map the system preference to the dark class so the uploader switches with it.
const media = window.matchMedia('(prefers-color-scheme: dark)')
const syncDarkMode = () => document.documentElement.classList.toggle('dark', media.matches)
media.addEventListener('change', syncDarkMode)
syncDarkMode()
```

## 覆盖设计 token

所有可定制值都是 `--vfu-*` CSS 自定义属性，默认声明在零特异性的 `:where(:root)` 上。宿主在 `:root` 或任意祖先覆盖即可，无需提高选择器权重。需要注意：头像裁剪器、删除确认框通过 Teleport 挂到 `body`，只能继承 `:root` / `html` 上的覆盖；如果项目只在某个业务容器内切换主色，请把同一组变量也写到 `:root`，弹窗和查看器才会同步。

```css
/* 在宿主项目中统一品牌色、圆角与文件行高。 */
/* Align brand color, radius, and file row height with the host project. */
:root {
  --vfu-color-primary: #126f67;
  --vfu-color-primary-light-3: #4a958e;
  --vfu-color-primary-light-7: #b7d8d4;
  --vfu-color-primary-light-9: #e7f2f0;
  --vfu-radius-base: 10px;
  --vfu-file-row-height: 60px;
}
```

若宿主已安装 Element Plus 并启用了它自己的主题变量，也可以只覆盖一次 `--el-color-primary`，组件的按钮、进度条、选中态会同步变化。

### 颜色

| Token                           | 用途                                 |
| ------------------------------- | ------------------------------------ |
| `--vfu-color-primary`           | 主色：主按钮、进度条、选中态、焦点环 |
| `--vfu-color-primary-light-3`   | 主色悬浮态                           |
| `--vfu-color-primary-light-7`   | 浅色边框、占位提示                   |
| `--vfu-color-primary-light-9`   | 浅色悬浮背景                         |
| `--vfu-color-success`           | 上传成功状态                         |
| `--vfu-color-warning`           | 处理中状态、拖拽提示                 |
| `--vfu-color-danger`            | 失败/拒绝状态、删除操作              |
| `--vfu-color-text-primary`      | 标题与主要文本                       |
| `--vfu-color-text-regular`      | 常规文本                             |
| `--vfu-color-text-secondary`    | 次要文本、状态说明                   |
| `--vfu-color-text-disabled`     | 禁用文本                             |
| `--vfu-color-border`            | 容器与卡片边框                       |
| `--vfu-color-border-lighter`    | 行分割线                             |
| `--vfu-color-fill-light`        | 行悬浮背景、缩略图占位               |
| `--vfu-bg-color`                | 列表、工具栏、底栏背景               |
| `--vfu-bg-color-overlay`        | 弹窗、裁剪器、悬浮按钮背景           |
| `--vfu-mask-color`              | 加载遮罩                             |
| `--vfu-mask-color-strong`       | 头像与图片墙的悬浮操作遮罩           |
| `--vfu-tooltip-bg` / `color`    | 操作提示气泡                         |
| `--vfu-shadow-sm` / `md` / `lg` | 面板、编辑器、确认框阴影             |

`primary`、`success`、`warning`、`danger`、`info` 另有 `-light-3`、`-light-5`、`-light-7`、`-light-8`、`-light-9` 变体，与 Element Plus 的命名一致。

### 圆角、排版与尺寸

| Token                               | 默认值                                        |
| ----------------------------------- | --------------------------------------------- |
| `--vfu-radius-small`                | `4px`                                         |
| `--vfu-radius-base`                 | `6px`                                         |
| `--vfu-radius-large`                | `8px`                                         |
| `--vfu-radius-round`                | `99px`                                        |
| `--vfu-font-family`                 | `Inter, ui-sans-serif, system-ui, sans-serif` |
| `--vfu-font-size-tiny` / `small`    | `11px` / `12px`                               |
| `--vfu-font-size-medium` / `base`   | `13px` / `14px`                               |
| `--vfu-font-size-large`             | `16px`                                        |
| `--vfu-file-row-height`             | `52px`                                        |
| `--vfu-file-thumbnail-size`         | `41px`                                        |
| `--vfu-file-actions-width`          | `104px`                                       |
| `--vfu-toolbar-height`              | `50px`                                        |
| `--vfu-footer-height`               | `46px`                                        |
| `--vfu-action-size`                 | `28px`                                        |
| `--vfu-picture-wall-size`           | `192px`                                       |
| `--vfu-picture-wall-caption-height` | `44px`                                        |

层级 token 包括 `--vfu-z-index-mask`、`--vfu-z-index-overlay`、`--vfu-z-index-tooltip`、`--vfu-z-index-toast`、`--vfu-z-index-dialog`、`--vfu-z-index-confirm`，用于把组件浮层嵌入宿主现有的层级体系。

### 第三方预览与裁剪

组件内置的 cropperjs 与 Viewer.js 也已接入同一套 token：

| Token                                            | 用途                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `--vfu-viewer-backdrop`                          | 查看器遮罩：浅色主题沿用 Viewer.js 默认的半透明黑；深色主题为 14% 浅色 |
| `--vfu-viewer-backdrop-filter`                   | 遮罩滤镜：浅色为 `none`，深色为 `blur(16px)` 毛玻璃                    |
| `--vfu-viewer-surface`                           | 工具栏、缩略图栏与关闭按钮背景；深色主题改用 12% 白色                  |
| `--vfu-viewer-surface-hover`                     | 控件悬浮/聚焦背景                                                      |
| `--vfu-viewer-title-color`                       | 图片标题文字                                                           |
| `--vfu-viewer-focus-ring`                        | 控件聚焦描边                                                           |
| `--vfu-viewer-icon-filter`                       | 图标滤镜：两种主题默认都保留白色图标，可按需覆盖为 `invert(1)`         |
| `--vfu-viewer-spinner-track` / `-active`         | 查看器加载指示器                                                       |
| `--vfu-cropper-mask`                             | 裁剪遮罩                                                               |
| `--vfu-cropper-guide`                            | 裁剪网格与中心辅助线                                                   |
| `--vfu-cropper-canvas-bg` / `-grid`              | 透明图片的棋盘格底色与格线                                             |
| `--vfu-cropper-outline` / `--vfu-cropper-handle` | 裁剪框边线与拖拽手柄；未设置时跟随 `--vfu-color-primary`               |

裁剪器样式只作用于 `.vfu-avatar-cropper`，查看器样式只作用于组件创建的 `.vfu-viewer` 容器，因此覆盖不会影响宿主项目中其他 cropperjs / Viewer.js 实例。修改 `--vfu-color-primary` 时，裁剪框、手柄和查看器控件会一起更新。

## 主题预设

`theme` 属性提供三个内置预设：

```vue
<FlowUpload theme="element-plus" />
<FlowUpload theme="ant-design-vue" />
```

- `default`：Element Plus 浅色/深色色板。
- `element-plus`：额外设置 Element Plus 的 4px 圆角与按钮字重，主色与状态色读取 `--el-*`。
- `ant-design-vue`：主色读取 `--ant-color-primary`（未启用 `cssVar` 时回退到 `#1677ff`），圆角为 6px。

需要更细的控制时传入 `ThemeAdapter`：

```ts
import type { ThemeAdapter } from 'vue-flow-upload'

// 自定义主题只负责类名与变量；组件不会自动安装第三方 UI 库。
// A custom theme only supplies a class name and variables; the component never installs a third-party UI library.
const brandTheme: ThemeAdapter = {
  name: 'brand',
  className: 'vfu-theme-brand',
  variables: {
    '--vfu-color-primary': '#126f67',
    '--vfu-radius-base': '10px',
  },
}
```

v0.2 的旧变量名（`--vfu-signal`、`--vfu-ink`、`--vfu-muted`、`--vfu-line`、`--vfu-danger`、`--vfu-radius`）仍可直接使用，`resolveTheme` 会把它们映射到新的语义化 token；同时提供新旧变量时，新变量优先。

## 不引入默认样式

如果项目需要完全接管视觉，可以不引入 `vue-flow-upload/style.css`，改为按需复制 `packages/vue-flow-upload/src/styles/_tokens.scss` 中的 token 定义并使用自己的选择器。组件的 DOM 结构保持稳定，所有类名以 `vfu-` 为前缀。
