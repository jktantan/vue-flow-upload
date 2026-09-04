import type { ThemeAdapter, UploadTheme } from './types'

export function resolveTheme(theme: UploadTheme): ThemeAdapter {
  /** 将主题名称解析为 CSS 类和变量；自定义主题对象直接透传。 Resolves a theme name to CSS metadata and passes custom adapters through. */
  if (typeof theme === 'object') return theme
  if (theme === 'element-plus') {
    return {
      name: theme,
      className: 'vfu-theme-element-plus',
      variables: { '--vfu-signal': '#409eff', '--vfu-radius': '4px' },
    }
  }
  if (theme === 'ant-design-vue') {
    return {
      name: theme,
      className: 'vfu-theme-ant-design-vue',
      variables: { '--vfu-signal': '#1677ff', '--vfu-radius': '6px' },
    }
  }
  return { name: 'default', className: 'vfu-theme-default' }
}
