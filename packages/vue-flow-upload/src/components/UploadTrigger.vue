<script setup lang="ts">
import { computed } from 'vue'
import { useFileSelection } from '../composables/useFileSelection'

/** Native input capabilities forwarded from FlowUpload. */
const props = defineProps<{
  directory: boolean
  multiple: boolean
  accept?: string | string[]
  canSelect: boolean
}>()

/** Emits browser-selected files; validation and queueing happen in the parent. */
const emit = defineEmits<{ files: [files: File[]] }>()
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
