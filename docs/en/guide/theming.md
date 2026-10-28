# Theming and styles

Component styles load through `vue-flow-upload/style.css`. The default palette follows [Element Plus](https://element-plus.org/) light colors and switches to its dark palette in dark mode. When the host project already installs Element Plus, the component reads `--el-*` variables first, so brand colors and light/dark mode follow the project automatically.

## Dark mode

Add `dark` / `vfu-dark` to `html`, any ancestor, or a wrapper around the component:

```html
<!-- Follow the Element Plus / VitePress convention: dark for the whole page -->
<html class="dark">
  <body>
    <!-- Or scope dark tokens to one region -->
    <div class="vfu-dark">
      <FlowUpload v-model="files" belong-id="order-1" />
    </div>
  </body>
</html>
```

The component does not react to `prefers-color-scheme` on its own, so it never turns dark before the host surface is ready. Map the system preference yourself when needed:

```ts
// Map the system preference to the dark class so the uploader switches with it.
const media = window.matchMedia('(prefers-color-scheme: dark)')
const syncDarkMode = () => document.documentElement.classList.toggle('dark', media.matches)
media.addEventListener('change', syncDarkMode)
syncDarkMode()
```

## Override design tokens

Every customizable value is a `--vfu-*` CSS custom property declared on a zero-specificity `:where(:root)`. Hosts can override on `:root`, a business container, or the component root without raising selector specificity:

```css
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

If the host installs Element Plus and configures its theme variables, overriding `--el-color-primary` once is enough: buttons, progress bars, and selected states follow it.

### Colors

| Token                             | Purpose                                                |
| --------------------------------- | ------------------------------------------------------ |
| `--vfu-color-primary`             | Primary action, progress, selected state, focus ring   |
| `--vfu-color-primary-light-3`     | Primary hover state                                    |
| `--vfu-color-primary-light-7`     | Light borders and hints                                |
| `--vfu-color-primary-light-9`     | Light hover surface                                    |
| `--vfu-color-success`             | Upload succeeded                                       |
| `--vfu-color-warning`             | Processing state and drag hint                         |
| `--vfu-color-danger`              | Failed/rejected state and destructive actions          |
| `--vfu-color-text-primary`        | Headings and primary text                              |
| `--vfu-color-text-regular`        | Regular text                                           |
| `--vfu-color-text-secondary`      | Secondary text and status copy                         |
| `--vfu-color-text-disabled`       | Disabled text                                          |
| `--vfu-color-border`              | Container and card borders                             |
| `--vfu-color-border-lighter`      | Row dividers                                           |
| `--vfu-color-fill-light`          | Row hover and thumbnail placeholder                    |
| `--vfu-bg-color`                  | List, toolbar, and footer background                   |
| `--vfu-bg-color-overlay`          | Dialogs, cropper, and floating action surfaces         |
| `--vfu-mask-color`                | Loading mask                                           |
| `--vfu-mask-color-strong`         | Avatar and picture-wall action overlay                 |
| `--vfu-tooltip-bg` / `color`      | Action tooltips                                        |
| `--vfu-shadow-sm` / `md` / `lg`   | Panel, editor, and confirm-dialog shadows              |

`primary`, `success`, `warning`, `danger`, and `info` also expose `-light-3`, `-light-5`, `-light-7`, `-light-8`, and `-light-9` variants named after Element Plus.

### Radii, typography, and sizes

| Token                                | Default  |
| ------------------------------------ | -------- |
| `--vfu-radius-small`                 | `4px`    |
| `--vfu-radius-base`                  | `6px`    |
| `--vfu-radius-large`                 | `8px`    |
| `--vfu-radius-round`                 | `99px`   |
| `--vfu-font-family`                  | `Inter, ui-sans-serif, system-ui, sans-serif` |
| `--vfu-font-size-tiny` / `small`     | `11px` / `12px` |
| `--vfu-font-size-medium` / `base`    | `13px` / `14px` |
| `--vfu-font-size-large`              | `16px`   |
| `--vfu-file-row-height`              | `52px`   |
| `--vfu-file-thumbnail-size`          | `41px`   |
| `--vfu-file-actions-width`           | `104px`  |
| `--vfu-toolbar-height`               | `50px`   |
| `--vfu-footer-height`                | `46px`   |
| `--vfu-action-size`                  | `28px`   |
| `--vfu-picture-wall-size`            | `192px`  |
| `--vfu-picture-wall-caption-height`  | `44px`   |

Stacking tokens (`--vfu-z-index-mask`, `-overlay`, `-tooltip`, `-toast`, `-dialog`, `-confirm`) let the component fit into an existing z-index scale.

## Theme presets

`theme` ships three presets:

```vue
<FlowUpload theme="element-plus" />
<FlowUpload theme="ant-design-vue" />
```

- `default`: Element Plus light/dark palette.
- `element-plus`: also applies the 4px radius and button weight; colors read `--el-*`.
- `ant-design-vue`: reads `--ant-color-primary` (falling back to `#1677ff` when `cssVar` is off) and uses a 6px radius.

For finer control, pass a `ThemeAdapter`:

```ts
import type { ThemeAdapter } from 'vue-flow-upload'

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

Legacy v0.2 variable names (`--vfu-signal`, `--vfu-ink`, `--vfu-muted`, `--vfu-line`, `--vfu-danger`, `--vfu-radius`) still work: `resolveTheme` maps them to semantic tokens, and explicit new variables win.

## Skipping the default stylesheet

To take over visuals completely, skip `vue-flow-upload/style.css` and copy the token definitions from `packages/vue-flow-upload/src/styles/_tokens.scss` into your own selectors. The DOM structure is stable and every class name is prefixed with `vfu-`.
