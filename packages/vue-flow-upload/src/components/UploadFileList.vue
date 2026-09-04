<script setup lang="ts">
import type { UploadFileItem, UploadMessages } from '../types'
import { fileIconUrl, formatSize, isImage } from '../utils/file'

defineProps<{
  files: UploadFileItem[]
  show: boolean
  listType: 'list' | 'picture' | 'picture-card'
  selectable: boolean
  selected: Set<string>
  canUpload: boolean
  canRetry: boolean
  canPreview: boolean
  canDownload: boolean
  canRemove: boolean
  text: UploadMessages
  t: (key: string, values?: Record<string, string | number>) => string
  statusText: (status: UploadFileItem['status']) => string
  imageUrl: (file: UploadFileItem) => string | undefined
  toggleSelected: (uid: string) => void
  remove: (uid: string) => void | Promise<boolean>
  preview: (file: UploadFileItem) => void | Promise<void>
  download: (uid: string) => void | Promise<void>
  pause: (uid: string) => void
  resume: (uid: string) => void | Promise<void>
  retry: (uid: string) => void | Promise<void>
}>()
</script>

<template>
  <!-- Lucide Icons v1.40.0, ISC License. Copyright Lucide Icons and Contributors. -->
  <ul
    v-if="show && files.length"
    class="vfu-list"
    :class="{ 'is-picture-card': listType === 'picture-card' }"
    aria-live="polite"
  >
    <li
      v-for="file in files"
      :key="file.uid"
      class="vfu-file"
      :class="[`is-${file.status}`, { 'has-select': selectable }]"
    >
      <slot
        name="file"
        :file="file"
        :remove="remove"
        :preview="preview"
        :download="download"
        :pause="pause"
        :resume="resume"
        :retry="retry"
      >
        <label v-if="selectable" class="vfu-select" @click.stop>
          <input
            :checked="file.status === 'success' && selected.has(file.uid)"
            :disabled="file.status !== 'success' || !file.fileId"
            type="checkbox"
            @change="toggleSelected(file.uid)"
          />
        </label>
        <div class="vfu-file__visual">
          <button
            v-if="isImage(file) && imageUrl(file)"
            class="vfu-thumbnail"
            type="button"
            :disabled="!canPreview"
            @click="preview(file)"
          >
            <img :src="imageUrl(file)" :alt="file.name" />
          </button>
          <img v-else class="vfu-file__glyph vfu-file__icon" :src="fileIconUrl(file)" alt="" />
        </div>
        <div class="vfu-file__body">
          <div class="vfu-file__headline">
            <strong>{{ file.name }}</strong
            ><span>{{ formatSize(file.size) }}</span>
          </div>
          <div
            v-if="['uploading', 'queued', 'merging'].includes(file.status)"
            class="vfu-progress"
            role="progressbar"
            :aria-label="`${file.name} ${file.percent}%`"
            :aria-valuenow="file.percent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <i :style="{ width: `${file.percent}%` }" />
          </div>
          <div class="vfu-file__status">
            <small :class="{ 'is-error': file.status === 'failed' || file.status === 'rejected' }">{{
              file.error?.message ?? statusText(file.status)
            }}</small>
            <span
              v-if="['uploading', 'queued', 'merging'].includes(file.status)"
              class="vfu-file__percent"
              >{{ file.percent }}%</span
            >
          </div>
        </div>
        <div class="vfu-file__actions">
          <button
            v-if="isImage(file) && imageUrl(file) && canPreview"
            class="vfu-action"
            type="button"
            :aria-label="text.preview"
            :data-tooltip="text.preview"
            @click="preview(file)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            v-if="file.status === 'success' && file.fileId && canDownload"
            class="vfu-action"
            type="button"
            :aria-label="text.download"
            :data-tooltip="text.download"
            @click="download(file.uid)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15V3" />
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m7 10 5 5 5-5" />
            </svg>
          </button>
          <button
            v-if="file.status === 'failed' && canRetry"
            class="vfu-action"
            type="button"
            :aria-label="text.retry"
            :data-tooltip="text.retry"
            @click="retry(file.uid)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </button>
          <button
            v-if="canRemove"
            class="vfu-action is-danger"
            type="button"
            :aria-label="text.remove"
            :data-tooltip="text.remove"
            @click="remove(file.uid)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </slot>
    </li>
  </ul>
  <footer v-if="show && files.length && listType === 'list'" class="vfu-list-footer">
    {{ t('fileCount', { count: files.length }) }}
  </footer>
</template>
