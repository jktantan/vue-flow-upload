<script setup lang="ts">
import { computed } from 'vue'
import type { UploadFileItem, UploadMessages } from '../types'
import { formatSize } from '../utils/file'

const props = defineProps<{
  files: UploadFileItem[]
  selectable: boolean
  selected: Set<string>
  selectableCount: number
  allSelected: boolean
  canSelect: boolean
  canRemove: boolean
  canDownloadAll: boolean
  drag: boolean
  accept?: string | string[]
  maxSize?: number
  text: UploadMessages
}>()

const selectFileTooltip = computed(() => {
  // 将选择限制组合为可访问的按钮提示文案。 Combine selection limits into an accessible button tooltip.
  const accept = Array.isArray(props.accept) ? props.accept.join(', ') : props.accept
  const maxSize =
    props.maxSize && Number.isFinite(props.maxSize)
      ? formatSize(props.maxSize)
      : props.text.unlimited
  return props.text.uploadLimits
    .replace('{accept}', accept || props.text.allFileTypes)
    .replace('{maxSize}', maxSize)
})

const emit = defineEmits<{
  select: []
  toggleAll: []
  downloadSelected: [uids: string[]]
  downloadAll: []
  removeSelected: []
}>()
</script>

<template>
  <div class="vfu-toolbar">
    <span class="vfu-toolbar__left">
      <label v-if="selectable && selectableCount" class="vfu-select vfu-select--all">
        <input
          :checked="allSelected"
          :aria-label="text.selectAll"
          type="checkbox"
          @change="emit('toggleAll')"
        />
      </label>
      <button
        v-if="selectable && canDownloadAll"
        class="vfu-button is-primary"
        type="button"
        :disabled="!selected.size"
        @click="emit('downloadSelected', [...selected])"
      >
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15V3" />
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
        </svg>
        {{ text.downloadSelected }}
      </button>
      <button
        v-if="canDownloadAll"
        class="vfu-button is-info"
        type="button"
        @click="emit('downloadAll')"
      >
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15V3" />
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
        </svg>
        {{ text.downloadAll }}
      </button>
      <button
        v-if="selectable && canRemove"
        class="vfu-button is-danger"
        type="button"
        :disabled="!selected.size"
        @click="emit('removeSelected')"
      >
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        {{ text.removeSelected }}
      </button>
    </span>
    <span v-if="drag" class="vfu-toolbar__center">
      <span class="vfu-toolbar__drag">{{ text.dragUpload }}</span>
    </span>
    <span class="vfu-toolbar__right">
      <button
        class="vfu-button is-success vfu-button--tooltip"
        type="button"
        :disabled="!canSelect"
        :data-tooltip="selectFileTooltip"
        :title="selectFileTooltip"
        @click="emit('select')"
      >
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
        </svg>
        {{ text.chooseFile }}
      </button>
    </span>
  </div>
</template>
