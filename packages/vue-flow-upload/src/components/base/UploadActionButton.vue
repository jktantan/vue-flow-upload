<script setup lang="ts">
import { computed } from 'vue'

/** 文件操作按钮的视觉变体。 Visual variants for file action buttons. */
type UploadActionButtonVariant = 'default' | 'danger'

/** 文件操作按钮输入；无障碍名称与提示通过 `$attrs` 透传。 File action-button input; accessible labels and tooltips pass through `$attrs`. */
interface UploadActionButtonProps {
  /** 操作语义；危险操作使用删除色。 Action semantics; destructive actions use the danger color. */
  variant?: UploadActionButtonVariant
  /** 是否禁用当前操作。 Whether the current action is disabled. */
  disabled?: boolean
}
/** 经过 TypeScript 约束且有默认值的文件操作按钮输入。 TypeScript-constrained file action-button input with defaults. */
const props = withDefaults(defineProps<UploadActionButtonProps>(), {
  variant: 'default',
  disabled: false,
})
/** 文件操作按钮向父组件报告的激活事件。 Activation event reported by the file action button to its parent. */
interface UploadActionButtonEmits {
  /** 用户激活未禁用操作时发送原生鼠标事件。 Sends the native mouse event when a user activates an enabled action. */
  (event: 'click', mouseEvent: globalThis.MouseEvent): void
}
/** 经过 TypeScript 约束的文件操作按钮事件发送器。 TypeScript-constrained file action-button event emitter. */
const emit = defineEmits<UploadActionButtonEmits>()
/** 危险操作的统一 BEM 修饰类；默认操作不添加额外类。 Unified BEM modifier for destructive actions; default actions need no extra class. */
const variantClass = computed(() => (props.variant === 'danger' ? 'is-danger' : undefined))
</script>

<template>
  <button
    v-bind="$attrs"
    class="vfu-action"
    :class="variantClass"
    type="button"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
