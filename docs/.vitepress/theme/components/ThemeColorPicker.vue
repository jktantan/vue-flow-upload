<script setup lang="ts">
import { THEME_COLOR_PRESETS } from '../theme-colors'

/** 主色色板控件的输入契约。 Input contract of the primary-color swatch control. */
interface ThemeColorPickerProps {
  /** 当前选中的主色。 Currently selected primary color. */
  modelValue: string
  /** 控件组的可访问名称。 Accessible name of the control group. */
  label: string
}

/** 主色色板控件的父组件输入。 Parent-provided inputs of the primary-color swatch control. */
defineProps<ThemeColorPickerProps>()

/** 主色变更事件。 Primary-color change event. */
const emit = defineEmits<{
  /** 用户选择某个色块后回传主色。 Carries the primary color after the user picks a swatch. */
  (event: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="demo-theme-picker" role="group" :aria-label="label">
    <button
      v-for="preset in THEME_COLOR_PRESETS"
      :key="preset.id"
      type="button"
      class="demo-theme-picker__swatch"
      :style="{ backgroundColor: preset.primary }"
      :aria-label="preset.name"
      :aria-pressed="modelValue === preset.primary"
      :title="preset.name"
      @click="emit('update:modelValue', preset.primary)"
    />
  </div>
</template>
