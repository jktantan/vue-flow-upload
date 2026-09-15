<script setup lang="ts">
import type { UploadFileItem, UploadMessages } from '../../types'
import UploadActionButton from '../base/UploadActionButton.vue'
import UploadIcon from '../base/UploadIcon.vue'

/** 单个上传文件可用操作及其父级回调。 Available actions for one upload file and parent-owned callbacks. */
interface UploadFileActionsProps {
  /** 当前文件与其上传状态。 Current file and its upload state. */
  file: UploadFileItem
  /** 是否显示预览操作。 Whether to show the preview action. */
  canPreviewFile: boolean
  /** 是否显示下载操作。 Whether to show the download action. */
  canDownloadFile: boolean
  /** 是否显示重试操作。 Whether to show the retry action. */
  canRetryFile: boolean
  /** 是否显示删除操作。 Whether to show the removal action. */
  canRemove: boolean
  /** 当前语言的操作文案。 Current-locale action copy. */
  text: UploadMessages
  /** 父组件持有的业务操作。 Parent-owned business operations. */
  preview: (file: UploadFileItem) => void | Promise<void>
  download: (uid: string) => void | Promise<void>
  retry: (uid: string) => void | Promise<void>
  remove: (uid: string) => void | Promise<boolean>
}
/** 经过 TypeScript 约束的文件操作输入。 TypeScript-constrained file action input. */
defineProps<UploadFileActionsProps>()
</script>

<template>
  <UploadActionButton
    v-if="canPreviewFile"
    :aria-label="text.preview"
    :data-tooltip="text.preview"
    @click="preview(file)"
  >
    <UploadIcon name="preview" />
  </UploadActionButton>
  <UploadActionButton
    v-if="canDownloadFile"
    :aria-label="text.download"
    :data-tooltip="text.download"
    @click="download(file.uid)"
  >
    <UploadIcon name="download" />
  </UploadActionButton>
  <UploadActionButton
    v-if="canRetryFile"
    :aria-label="text.retry"
    :data-tooltip="text.retry"
    @click="retry(file.uid)"
  >
    <UploadIcon name="retry" />
  </UploadActionButton>
  <UploadActionButton
    v-if="canRemove"
    variant="danger"
    :aria-label="text.remove"
    :data-tooltip="text.remove"
    @click="remove(file.uid)"
  >
    <UploadIcon name="remove" />
  </UploadActionButton>
</template>
