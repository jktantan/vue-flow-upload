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
  <ul
    v-if="show && files.length"
    class="vfu-list"
    :class="{ 'is-picture-card': listType === 'picture-card' }"
    aria-live="polite"
  >
    <li v-for="file in files" :key="file.uid" class="vfu-file" :class="`is-${file.status}`">
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
        <label v-if="selectable && file.fileId" class="vfu-select" @click.stop>
          <input
            :checked="selected.has(file.uid)"
            type="checkbox"
            @change="toggleSelected(file.uid)"
          />
        </label>
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
          <small :class="{ 'is-error': file.status === 'failed' || file.status === 'rejected' }">{{
            file.error?.message ?? statusText(file.status)
          }}</small>
        </div>
        <span
          v-if="['uploading', 'queued', 'merging'].includes(file.status)"
          class="vfu-file__percent"
          >{{ file.percent }}%</span
        >
        <button
          v-if="
            ['hashing', 'checking', 'queued', 'uploading', 'preparing'].includes(file.status) &&
            canUpload
          "
          class="vfu-action"
          type="button"
          @click="pause(file.uid)"
        >
          {{ text.pause }}
        </button>
        <button
          v-if="file.status === 'paused' && canUpload"
          class="vfu-action"
          type="button"
          @click="resume(file.uid)"
        >
          {{ text.resume }}
        </button>
        <button
          v-if="file.status === 'failed' && canRetry"
          class="vfu-action"
          type="button"
          @click="retry(file.uid)"
        >
          {{ text.retry }}
        </button>
        <button
          v-if="file.status === 'success' && canPreview"
          class="vfu-action"
          type="button"
          @click="preview(file)"
        >
          {{ text.preview }}
        </button>
        <button
          v-if="file.status === 'success' && file.fileId && canDownload"
          class="vfu-action"
          type="button"
          @click="download(file.uid)"
        >
          {{ text.download }}
        </button>
        <button
          v-if="canRemove"
          class="vfu-action is-danger"
          type="button"
          @click="remove(file.uid)"
        >
          {{ text.remove }}
        </button>
      </slot>
    </li>
  </ul>
  <footer v-if="show && files.length && listType === 'list'" class="vfu-list-footer">
    {{ t('fileCount', { count: files.length }) }}
  </footer>
</template>
