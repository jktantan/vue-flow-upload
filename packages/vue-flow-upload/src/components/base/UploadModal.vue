<script setup lang="ts">
import { onBeforeUnmount, onMounted, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

/** 内部模态框输入；内容、焦点首选项与业务关闭条件均由调用方提供。 Internal modal input; callers provide content, focus preference, and business close conditions. */
interface UploadModalProps {
  /** 是否将模态框渲染到 body。 Whether the modal is rendered into body. */
  visible: boolean
  /** 是否允许点击遮罩关闭。 Whether backdrop clicks may close the modal. */
  closeOnBackdrop?: boolean
  /** 是否允许 Escape 关闭。 Whether Escape may close the modal. */
  closeOnEscape?: boolean
}
/** 经过 TypeScript 约束且有保守默认值的模态框输入。 TypeScript-constrained modal input with conservative defaults. */
const props = withDefaults(defineProps<UploadModalProps>(), {
  closeOnBackdrop: true,
  closeOnEscape: true,
})
/** 模态框请求关闭时发送的事件。 Event sent when the modal requests closure. */
interface UploadModalEmits {
  /** 用户通过遮罩或 Escape 请求关闭时发送。 Sent when a user requests closing through backdrop or Escape. */
  (event: 'close'): void
}
/** 经过 TypeScript 约束的模态框事件发送器。 TypeScript-constrained modal event emitter. */
const emit = defineEmits<UploadModalEmits>()
/** Teleport 不会成为真实 DOM 根节点，因此将父级 class、style 和 ARIA 属性显式绑定到遮罩节点。 Teleport is not a real DOM root, so parent class, style, and ARIA attributes are explicitly bound to the overlay node. */
const attrs = useAttrs()
/** 对齐遮罩与 Escape 的关闭权限，避免两种入口出现不同结果。 Aligns backdrop and Escape permissions so both entry points behave consistently. */
function requestClose() {
  if (props.visible) emit('close')
}
/** 在可见且允许时将 Escape 转为关闭请求。 Converts Escape into a close request only while visible and allowed. */
function handleKeydown(event: globalThis.KeyboardEvent) {
  if (event.key === 'Escape' && props.closeOnEscape) requestClose()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      v-bind="attrs"
      class="vfu-modal"
      @click.self="closeOnBackdrop && requestClose()"
    >
      <div class="vfu-modal__backdrop" aria-hidden="true" />
      <slot />
    </div>
  </Teleport>
</template>
