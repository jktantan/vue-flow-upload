<script setup lang="ts">
import type { UploadFileItem } from '../types'

defineProps<{
  file?: UploadFileItem
  closeLabel: string
  imageUrl: (file: UploadFileItem) => string | undefined
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    v-if="file"
    class="vfu-preview"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    @keydown.esc="emit('close')"
    @click.self="emit('close')"
  >
    <button
      class="vfu-preview__close"
      type="button"
      :aria-label="closeLabel"
      @click="emit('close')"
    >
      ×
    </button>
    <img :src="imageUrl(file)" :alt="file.name" />
  </div>
</template>

<style scoped>
.vfu-preview {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 32px;
  background: rgb(9 14 27 / 80%);
}
.vfu-preview img {
  max-width: min(100%, 1080px);
  max-height: calc(100vh - 64px);
  border-radius: 8px;
  object-fit: contain;
}
.vfu-preview__close {
  position: absolute;
  top: 18px;
  right: 22px;
  border: 0;
  background: transparent;
  color: white;
  cursor: pointer;
  font-size: 32px;
}
.vfu-preview__close:focus-visible {
  outline: 2px solid currentcolor;
  outline-offset: 3px;
}
</style>
