/**
 * 文档示例共享的主色预设与派生变量。
 * Shared primary-color presets and derived variables for the documentation demos.
 */
import { computed, onBeforeUnmount, watch, type Ref } from 'vue'

/** 主色预设的可选方案。 A selectable primary-color preset. */
export interface ThemeColorPreset {
  /** 稳定的预设标识。 Stable preset identifier. */
  id: string
  /** 展示名称。 Display name. */
  name: string
  /** 主色值。 Primary color value. */
  primary: string
}

/** 完整上传与头像示例共用的主色预设；首项与组件默认色一致。 Primary presets shared by the full-upload and avatar demos; the first entry matches the component default. */
export const THEME_COLOR_PRESETS: readonly ThemeColorPreset[] = [
  { id: 'element-plus', name: 'Element Plus', primary: '#409eff' },
  { id: 'teal', name: 'Teal', primary: '#126f67' },
  { id: 'violet', name: 'Violet', primary: '#7c4dff' },
  { id: 'amber', name: 'Amber', primary: '#d97706' },
  { id: 'rose', name: 'Rose', primary: '#e11d48' },
]

/** 示例初始主色。 Initial primary color for the demos. */
export const DEFAULT_THEME_COLOR = THEME_COLOR_PRESETS[0]!.primary

/**
 * 由主色生成组件 token 覆盖；派生色随深浅模式选择白色或深色混合目标。
 * Builds component token overrides from a primary color; light variants mix toward white in light mode and dark in dark mode.
 */
export function createThemeStyle(primaryColor: string, isDark: boolean): Record<string, string> {
  // 深色模式下与背景色混合，避免浅色悬浮态在暗色面板上过亮。
  // Dark mode mixes toward the background so light hover surfaces do not glare on dark panels.
  const mixTarget = isDark ? '#141414' : '#ffffff'
  return {
    '--vfu-color-primary': primaryColor,
    '--vfu-color-primary-light-3': `color-mix(in srgb, ${primaryColor} 70%, ${mixTarget})`,
    '--vfu-color-primary-light-7': `color-mix(in srgb, ${primaryColor} 30%, ${mixTarget})`,
    '--vfu-color-primary-light-9': `color-mix(in srgb, ${primaryColor} 10%, ${mixTarget})`,
  }
}

/**
 * 把示例主题变量写入文档根节点，使 Teleport 到 body 的裁剪器、确认框与查看器也能继承。
 * Writes demo theme variables to the document root so croppers, confirm dialogs, and viewers teleported to body inherit them too.
 */
export function useDemoTheme(primaryColor: Ref<string>, isDark: Ref<boolean>) {
  // 示例主题完全由主色与深浅模式推导，避免每个示例重复维护四组色值。
  // Demo theme is fully derived from the primary color and color scheme, avoiding four duplicated palettes per demo.
  const themeStyle = computed(() => createThemeStyle(primaryColor.value, isDark.value))
  watch(
    themeStyle,
    (variables) => {
      // 构建期没有 document；变量只在浏览器水合后写入。
      // There is no document during the build; variables are written only after hydration in the browser.
      if (typeof document === 'undefined') return
      for (const [name, value] of Object.entries(variables)) {
        document.documentElement.style.setProperty(name, value)
      }
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    for (const name of Object.keys(createThemeStyle(primaryColor.value, isDark.value))) {
      document.documentElement.style.removeProperty(name)
    }
  })
  return themeStyle
}
