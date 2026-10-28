import type { ThemeAdapter, UploadTheme } from './types'

/**
 * 旧版主题变量名到语义化 token 的映射，保证 v0.2 的自定义主题适配器继续生效。
 * Maps legacy theme variable names to semantic tokens so v0.2 custom theme adapters keep working.
 */
const LEGACY_THEME_VARIABLES: Readonly<Record<string, string>> = {
  '--vfu-signal': '--vfu-color-primary',
  '--vfu-primary': '--vfu-color-primary',
  '--vfu-ink': '--vfu-color-text-primary',
  '--vfu-muted': '--vfu-color-text-secondary',
  '--vfu-line': '--vfu-color-border',
  '--vfu-danger': '--vfu-color-danger',
  '--vfu-radius': '--vfu-radius-base',
}

/**
 * 为自定义主题补齐旧变量的语义化别名；显式提供的新变量始终优先。
 * Adds semantic aliases for legacy custom-theme variables; explicitly provided new variables always win.
 */
function normalizeThemeVariables(variables: Record<string, string>): Record<string, string> {
  // 复制后可安全追加别名，不修改调用方传入的对象。
  // Copy first so aliases can be appended without mutating the caller's object.
  const normalizedVariables = { ...variables }
  for (const [legacyVariable, semanticVariable] of Object.entries(LEGACY_THEME_VARIABLES)) {
    if (legacyVariable in variables && !(semanticVariable in variables)) {
      normalizedVariables[semanticVariable] = variables[legacyVariable] as string
    }
  }
  return normalizedVariables
}

/**
 * 将主题预设名或调用方主题适配器解析为类名与 CSS 变量。
 * Resolves a theme preset name or caller-supplied theme adapter to a class name and CSS variables.
 */
export function resolveTheme(theme: UploadTheme): ThemeAdapter {
  if (typeof theme === 'object') {
    return { ...theme, variables: normalizeThemeVariables(theme.variables ?? {}) }
  }
  if (theme === 'element-plus') {
    return {
      name: theme,
      className: 'vfu-theme-element-plus',
      // 主色与状态色默认 token 已直接读取 --el-*，此处只补充 Element Plus 的圆角规范。
      // Primary and status colors already read --el-* through default tokens; only the Element Plus radius is added here.
      variables: { '--vfu-radius-base': '4px' },
    }
  }
  if (theme === 'ant-design-vue') {
    return {
      name: theme,
      className: 'vfu-theme-ant-design-vue',
      // Ant Design Vue v4 开启 cssVar 后提供 --ant-color-primary；未启用时使用官方品牌蓝作为回退。
      // Ant Design Vue v4 exposes --ant-color-primary when cssVar is enabled; otherwise official brand blue is used.
      variables: {
        '--vfu-color-primary': 'var(--ant-color-primary, #1677ff)',
        '--vfu-radius-base': '6px',
      },
    }
  }
  return { name: 'default', className: 'vfu-theme-default' }
}
