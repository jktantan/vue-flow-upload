<script setup lang="ts">
import { computed } from 'vue'
import { useFileSelection } from '../composables/useFileSelection'

const props = defineProps<{
  directory: boolean
  multiple: boolean
  accept?: string | string[]
  canSelect: boolean
}>()

const emit = defineEmits<{ files: [files: File[]] }>()
const { input, acceptValue, browse, onSelect } = useFileSelection({
  accept: computed(() => props.accept),
  canSelect: computed(() => props.canSelect),
  addFiles: (files) => emit('files', files),
})
void input

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
