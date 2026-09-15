<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AvatarShape } from '../../types'
import UploadButton from '../base/UploadButton.vue'
import UploadModal from '../base/UploadModal.vue'
import UploadProgressIndicator from '../base/UploadProgressIndicator.vue'

/** 头像裁剪弹窗的输入状态；上传和裁剪副作用仍由 AvatarUpload 持有。 Avatar-crop dialog input state; AvatarUpload retains upload and crop side effects. */
interface AvatarCropDialogProps {
  /** 是否显示模态裁剪会话。 Whether the modal crop session is visible. */
  visible: boolean
  /** 裁剪框展示轮廓；不会改变实际输出图片。 Crop-box display shape; it does not change the output image. */
  shape: AvatarShape
  /** 裁剪器是否已有可编辑的图片源。 Whether the cropper has an editable image source. */
  hasSource: boolean
  /** 请求或裁剪文件生成是否正在执行。 Whether request submission or cropped-file generation is running. */
  isUploading: boolean
  /** 传输层已知的上传百分比；未提供表示使用不定进度。 Upload percentage known by the transport; absent means indeterminate progress. */
  uploadProgressPercent?: number
  /** 可恢复失败的当前错误；保留在弹窗内供用户重试。 Current recoverable failure retained in the dialog for retry. */
  error: string
  /** 对话框标题和可访问名称。 Dialog title and accessible name. */
  title: string
  /** 空裁剪区与底部帮助文案。 Empty crop-area and footer helper copy. */
  dragHint: string
  /** 拖放覆盖层的操作提示。 Action copy for the drag-and-drop overlay. */
  dropHint: string
  /** 重新选择图片按钮文案。 Copy for the image-selection button. */
  chooseText: string
  /** 首次上传按钮文案。 Copy for the initial upload button. */
  uploadText: string
  /** 失败后重试按钮文案。 Copy for the retry button after a failure. */
  retryText: string
  /** 上传执行中的按钮文案。 Copy for the button while uploading. */
  processingText: string
  /** 关闭按钮文案。 Copy for the close button. */
  closeText: string
}
/** 经过 TypeScript 约束的裁剪弹窗输入。 TypeScript-constrained crop-dialog input. */
const props = defineProps<AvatarCropDialogProps>()
/** 裁剪弹窗对外报告的用户操作。 User actions reported by the crop dialog. */
interface AvatarCropDialogEmits {
  /** 用户请求关闭会话时发送；上传中不会发出。 Sent when the user requests session closure; never emitted while uploading. */
  (event: 'close'): void
  /** 用户请求重新选择原图时发送。 Sent when the user requests another source image. */
  (event: 'choose'): void
  /** 用户确认上传当前裁剪结果时发送。 Sent when the user confirms uploading the current crop. */
  (event: 'upload'): void
  /** 用户放下文件时发送首个文件。 Sent with the first file dropped by the user. */
  (event: 'drop', file?: File): void
}
/** 经过 TypeScript 约束的裁剪弹窗事件发送器。 TypeScript-constrained crop-dialog event emitter. */
const emit = defineEmits<AvatarCropDialogEmits>()
/** 裁剪区域的拖放悬停状态，仅由弹窗视觉层使用。 Drag-over state for the crop area, used only by the dialog visual layer. */
const isDragging = ref(false)
/** 上传遮罩与按钮使用的文案；仅在传输层提供进度时追加真实百分比。 Copy used by the upload mask and button; appends a real percentage only when the transport provides one. */
const uploadingLabel = computed(() =>
  props.uploadProgressPercent === undefined
    ? props.processingText
    : `${props.processingText} ${props.uploadProgressPercent}%`,
)

/** 供父组件插入已配置裁剪器的具名插槽。 Named slot through which the parent supplies its configured cropper. */
defineSlots<{ cropper(): unknown }>()

/** 关闭时重置拖放状态，避免下次打开保留过期遮罩。 Resets drag state on close so a later opening cannot retain a stale overlay. */
function requestClose() {
  // 上传过程禁止关闭，避免用户误以为后台请求已被撤销。
  // Closing is blocked while uploading so users are not led to believe the request was cancelled.
  if (props.isUploading) return
  isDragging.value = false
  emit('close')
}
/** 开启浏览器拖放许可并显示文件投放反馈。 Enables browser dropping and displays file-drop feedback. */
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}
/** 仅在指针真正离开裁剪区域时关闭拖放反馈。 Clears drag feedback only when the pointer truly leaves the crop area. */
function handleDragLeave(event: DragEvent) {
  const target = event.currentTarget as HTMLElement | null
  if (!target?.contains(event.relatedTarget as Node)) isDragging.value = false
}
/** 将首个拖入文件交由父组件的统一校验与编辑入口处理。 Sends the first dropped file to the parent's shared validation and editor entry point. */
function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  emit('drop', event.dataTransfer?.files?.[0])
}
</script>

<template>
  <UploadModal
    :visible="visible"
    class="vfu-avatar-dialog"
    :close-on-backdrop="!isUploading"
    :close-on-escape="!isUploading"
    @close="requestClose"
  >
    <section
      class="vfu-avatar-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vfu-avatar-editor-title"
    >
      <header class="vfu-avatar-editor__header">
        <h2 id="vfu-avatar-editor-title">{{ title }}</h2>
        <button
          class="vfu-avatar-editor__close"
          type="button"
          :disabled="isUploading"
          :aria-label="closeText"
          @click="requestClose"
        >
          ×
        </button>
      </header>
      <div
        class="vfu-avatar-cropper"
        :class="{ 'is-circle': shape === 'circle', 'is-dragging': isDragging }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <slot v-if="hasSource" name="cropper" />
        <button
          v-else
          type="button"
          class="vfu-avatar-empty"
          :disabled="isUploading"
          @click="emit('choose')"
        >
          {{ dragHint }}
        </button>
        <div v-if="isDragging" class="vfu-avatar-drop-mask">{{ dropHint }}</div>
        <div v-if="isUploading" class="vfu-avatar-upload-mask" role="status" aria-live="polite">
          <UploadProgressIndicator
            :label="uploadingLabel"
            :progress-percent="uploadProgressPercent"
          />
        </div>
      </div>
      <footer class="vfu-avatar-editor__footer">
        <div class="vfu-avatar-editor__feedback">
          <span>{{ dragHint }}</span>
          <p v-if="error" role="alert">{{ error }}</p>
        </div>
        <div>
          <UploadButton :disabled="isUploading" @click="emit('choose')">
            {{ chooseText }}
          </UploadButton>
          <UploadButton
            variant="success"
            :disabled="!hasSource || isUploading"
            @click="emit('upload')"
          >
            {{ isUploading ? uploadingLabel : error ? retryText : uploadText }}
          </UploadButton>
        </div>
      </footer>
    </section>
  </UploadModal>
</template>
