<script setup lang="ts">
import type { UploadFileItem, UploadMessages } from '../types'

const props = defineProps<{
  files: UploadFileItem[]
  selectable: boolean
  selected: Set<string>
  selectableCount: number
  allSelected: boolean
  canSelect: boolean
  canRemove: boolean
  canDownloadAll: boolean
  text: UploadMessages
}>()

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
        {{ text.downloadSelected }}
      </button>
      <button
        v-if="canDownloadAll"
        class="vfu-button is-info"
        type="button"
        @click="emit('downloadAll')"
      >
        {{ text.downloadAll }}
      </button>
      <button
        v-if="selectable && canRemove"
        class="vfu-button is-danger"
        type="button"
        :disabled="!selected.size"
        @click="emit('removeSelected')"
      >
        {{ text.removeSelected }}
      </button>
    </span>
    <span class="vfu-toolbar__center">
      <span class="vfu-toolbar__drag">{{ text.dragUpload }}</span>
    </span>
    <span class="vfu-toolbar__right">
      <button
        class="vfu-button is-success"
        type="button"
        :disabled="!canSelect"
        @click="emit('select')"
      >
        {{ text.chooseFile }}
      </button>
    </span>
  </div>
</template>
