<script setup lang="ts">
import { computed } from 'vue'
import type { UploadFileItem, UploadMessages } from '../types'

const props = defineProps<{
  files: UploadFileItem[]
  autoUpload: boolean
  selectable: boolean
  selected: Set<string>
  selectableCount: number
  allSelected: boolean
  canUpload: boolean
  canRemove: boolean
  canDownloadAll: boolean
  text: UploadMessages
  t: (key: string, values?: Record<string, string | number>) => string
}>()

const emit = defineEmits<{
  submit: []
  toggleAll: []
  downloadSelected: [uids: string[]]
  downloadAll: []
  removeSelected: []
}>()

const pendingCount = computed(() => props.files.filter((file) => file.status === 'idle').length)
const hasDownloadableFile = computed(() => props.files.some((file) => file.fileId))
</script>

<template>
  <div v-if="!autoUpload && pendingCount" class="vfu-toolbar">
    <span>{{ t('pendingFiles', { count: pendingCount }) }}</span>
    <button class="vfu-button" type="button" :disabled="!canUpload" @click="emit('submit')">
      {{ text.startUpload }}
    </button>
  </div>
  <div v-if="selectable || (canDownloadAll && hasDownloadableFile)" class="vfu-toolbar">
    <span class="vfu-toolbar__selection">
      <label v-if="selectable && selectableCount" class="vfu-select vfu-select--all">
        <input :checked="allSelected" type="checkbox" @change="emit('toggleAll')" />
        <span>{{ text.selectAll }}</span>
      </label>
      <span v-else>{{ text.fileActions }}</span>
      <span v-if="selectable && selected.size" class="vfu-toolbar__count">{{
        t('selectedFiles', { count: selected.size })
      }}</span>
    </span>
    <span class="vfu-toolbar__actions">
      <button
        v-if="selectable && canDownloadAll && selected.size"
        class="vfu-button"
        type="button"
        @click="emit('downloadSelected', [...selected])"
      >
        {{ text.downloadSelected }}
      </button>
      <button v-if="canDownloadAll" class="vfu-button" type="button" @click="emit('downloadAll')">
        {{ text.downloadAll }}
      </button>
      <button
        v-if="selectable && selected.size && canRemove"
        class="vfu-button is-danger"
        type="button"
        @click="emit('removeSelected')"
      >
        {{ text.removeSelected }}
      </button>
    </span>
  </div>
</template>
