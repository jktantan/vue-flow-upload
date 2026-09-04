<script setup lang="ts">
import { computed } from 'vue'
import { useFileSelection } from '../composables/useFileSelection'
import type { UploadMessages } from '../types'

const props = defineProps<{
  drag: boolean
  directory: boolean
  multiple: boolean
  accept?: string | string[]
  canSelect: boolean
  text: UploadMessages
}>()

const emit = defineEmits<{ files: [files: File[]] }>()
const { input, dragActive, acceptValue, browse, onSelect, onDrop } = useFileSelection({
  accept: computed(() => props.accept),
  canSelect: computed(() => props.canSelect),
  addFiles: (files) => emit('files', files),
})
void input

defineExpose({ browse })
</script>

<template>
  <div
    v-if="drag"
    class="vfu-dropzone"
    :class="{ 'is-active': dragActive, 'is-disabled': !canSelect }"
    role="button"
    tabindex="0"
    @click="browse"
    @keydown.enter.prevent="browse"
    @keydown.space.prevent="browse"
    @dragenter.prevent="dragActive = true"
    @dragover.prevent="dragActive = true"
    @dragleave.prevent="dragActive = false"
    @drop="onDrop"
  >
    <input
      ref="input"
      type="file"
      :accept="acceptValue"
      :multiple="multiple"
      :disabled="!canSelect"
      :webkitdirectory="directory || undefined"
      :directory="directory || undefined"
      @change="onSelect"
    />
    <slot>
      <span class="vfu-dropzone__mark" aria-hidden="true">⌃</span>
      <strong>{{ text.selectFile }}</strong>
      <span>{{ text.dragHint }}</span>
    </slot>
  </div>
  <div
    v-else
    class="vfu-trigger"
    role="button"
    tabindex="0"
    @click="browse"
    @keydown.enter.prevent="browse"
    @keydown.space.prevent="browse"
  >
    <input
      ref="input"
      type="file"
      :accept="acceptValue"
      :multiple="multiple"
      :disabled="!canSelect"
      :webkitdirectory="directory || undefined"
      :directory="directory || undefined"
      @change="onSelect"
    />
    <slot name="trigger">
      <slot
        ><button class="vfu-button" type="button" :disabled="!canSelect">
          {{ text.selectFile }}
        </button></slot
      >
    </slot>
  </div>
</template>
