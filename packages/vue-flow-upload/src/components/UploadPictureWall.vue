<script setup lang="ts">
import type { UploadFileItem, UploadMessages } from '../types'
import UploadFileList from './UploadFileList.vue'

/** 图片墙展示输入；仅作为 UploadFileList 的无状态表现层包装。 Picture-wall input; only a stateless presentation wrapper around UploadFileList. */
interface UploadPictureWallProps {
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
}
/** 经过 TypeScript 约束的图片墙输入。 TypeScript-constrained picture-wall input. */
defineProps<UploadPictureWallProps>()
</script>

<template>
  <UploadFileList v-bind="$props">
    <template v-if="$slots.file" #file="slotProps">
      <slot name="file" v-bind="slotProps" />
    </template>
  </UploadFileList>
</template>
