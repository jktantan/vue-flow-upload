<script setup lang="ts">
import { computed } from 'vue'
import { useFileSelection } from '../composables/useFileSelection'

/** 原生选择器的输入契约；校验与入队仍由父组件负责。 Native picker input contract; validation and queueing remain the parent's responsibility. */
interface UploadTriggerProps {
  directory: boolean
  multiple: boolean
  accept?: string | string[]
  canSelect: boolean
}
/** 经过 TypeScript 约束的触发器输入。 TypeScript-constrained trigger input. */
const props = defineProps<UploadTriggerProps>()

/** 原生选择结果事件；父组件负责校验和入队。 Native selection event; the parent validates and queues files. */
interface UploadTriggerEmits {
  /** 原生 input 选择后发送完整文件数组。 Sends the complete file array after native-input selection. */
  (event: 'files', files: File[]): void
}
/** 经过 TypeScript 约束的触发器事件发送器。 TypeScript-constrained trigger event emitter. */
const emit = defineEmits<UploadTriggerEmits>()
/** DOM input reference, normalized accept string, and selection handlers from the shared composable. */
const { input, acceptValue, browse, onSelect } = useFileSelection({
  accept: computed(() => props.accept),
  canSelect: computed(() => props.canSelect),
  addFiles: (files) => emit('files', files),
})
// input 仅在模板中使用；显式读取可避免静态分析将其视为未使用。 The template owns input; read it to satisfy static analysis.
void input

// 向父组件暴露打开原生文件选择器的最小 API。 Expose the minimal API for opening the native file picker.
defineExpose({ browse })
</script>

<template>
  <input
    ref="input"
    class="vfu-file-input"
    type="file"
    :accept="acceptValue"
    :multiple="multiple"
    :disabled="!canSelect"
    :webkitdirectory="directory || undefined"
    :directory="directory || undefined"
    @change="onSelect"
  />
</template>
