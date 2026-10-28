/**
 * Playground 主色预设与 token 派生；与文档示例保持相同的验证方式。
 * Playground primary-color presets and token derivation, matching how the documentation demos validate colors.
 */

/** 主色预设的可选方案。 A selectable primary-color preset. */
export interface ThemeColorPreset {
  /** 稳定的预设标识。 Stable preset identifier. */
  id: string
  /** 展示名称。 Display name. */
  name: string
  /** 主色值。 Primary color value. */
  primary: string
}

/** Playground 可切换的主色预设。 Primary presets switchable in the playground. */
export const THEME_COLOR_PRESETS: readonly ThemeColorPreset[] = [
  { id: 'element-plus', name: 'Element Plus', primary: '#409eff' },
  { id: 'teal', name: 'Teal', primary: '#126f67' },
  { id: 'violet', name: 'Violet', primary: '#7c4dff' },
  { id: 'amber', name: 'Amber', primary: '#d97706' },
  { id: 'rose', name: 'Rose', primary: '#e11d48' },
]

/** Playground 初始主色。 Initial primary color in the playground. */
export const DEFAULT_THEME_COLOR = THEME_COLOR_PRESETS[0]!.primary

/**
 * 由主色生成组件 token 覆盖；深浅模式决定浅色变体的混合目标。
 * Builds component token overrides from a primary color; the color scheme decides the light-variant mix target.
 */
export function createThemeStyle(primaryColor: string, isDark: boolean): Record<string, string> {
  // 深色模式向深色背景混合，避免悬浮态在暗色面板上过亮。
  // Dark mode mixes toward the dark background so hover surfaces do not glare on dark panels.
  const mixTarget = isDark ? '#141414' : '#ffffff'
  return {
    '--vfu-color-primary': primaryColor,
    '--vfu-color-primary-light-3': `color-mix(in srgb, ${primaryColor} 70%, ${mixTarget})`,
    '--vfu-color-primary-light-7': `color-mix(in srgb, ${primaryColor} 30%, ${mixTarget})`,
    '--vfu-color-primary-light-9': `color-mix(in srgb, ${primaryColor} 10%, ${mixTarget})`,
  }
}
