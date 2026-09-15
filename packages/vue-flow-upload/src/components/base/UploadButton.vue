<script setup lang="ts">
import { computed } from 'vue'

/** 上传组件内部共用按钮的视觉变体。 Visual variants shared by internal upload-component buttons. */
type UploadButtonVariant = 'primary' | 'info' | 'success' | 'danger'

/** 共用按钮输入；通过 `$attrs` 保留原生 ARIA、title 和 data-tooltip 属性。 Shared button input; native ARIA, title, and data-tooltip attributes are preserved through `$attrs`. */
interface UploadButtonProps {
  /** 按钮颜色语义；默认主操作样式。 Button color semantics; defaults to the primary-action style. */
  variant?: UploadButtonVariant
  /** 是否禁用原生按钮交互。 Whether native button interaction is disabled. */
  disabled?: boolean
  /** 原生 button 类型，避免在表单中意外提交。 Native button type, preventing accidental form submission. */
  nativeType?: 'button' | 'submit' | 'reset'
}
/** 经过 TypeScript 约束且有安全默认值的共用按钮输入。 TypeScript-constrained shared button input with safe defaults. */
const props = withDefaults(defineProps<UploadButtonProps>(), {
  variant: 'primary',
  disabled: false,
  nativeType: 'button',
})
/** 共用按钮发出的用户交互事件。 User-interaction events emitted by the shared button. */
interface UploadButtonEmits {
  /** 用户激活未禁用按钮时发送原生鼠标事件。 Sends the native mouse event when a user activates an enabled button. */
  (event: 'click', mouseEvent: globalThis.MouseEvent): void
}
/** 经过 TypeScript 约束的共用按钮事件发送器。 TypeScript-constrained shared button event emitter. */
const emit = defineEmits<UploadButtonEmits>()
/** 由变体生成的统一 BEM 修饰类。 Unified BEM modifier class generated from the selected variant. */
const variantClass = computed(() => `is-${props.variant}`)
</script>

<template>
  <button
    v-bind="$attrs"
    class="vfu-button"
    :class="variantClass"
    :type="nativeType"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
