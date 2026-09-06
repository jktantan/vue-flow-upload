<script setup lang="ts">
import type { UploadFileItem, UploadMessages } from '../types'
import UploadFileList from './UploadFileList.vue'

defineProps<{
  files: UploadFileItem[]
  show: boolean
  listType: 'picture' | 'picture-card'
  selectable: boolean
  selected: Set<string>
  canUpload: boolean
  canRetry: boolean
  canPreview: boolean
  canDownload: boolean
  canRemove: boolean
  text: UploadMessages
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
  <UploadFileList v-bind="$props">
    <template v-if="$slots.file" #file="slotProps">
      <slot name="file" v-bind="slotProps" />
    </template>
  </UploadFileList>
</template>
