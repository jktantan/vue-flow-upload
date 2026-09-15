<script setup lang="ts">
import { computed } from 'vue'
import type { UploadFileItem } from '../../types'
import UploadModal from '../base/UploadModal.vue'
import UploadButton from '../base/UploadButton.vue'

/** 删除确认弹窗输入；删除副作用始终由 FlowUpload 持有。 Delete-confirmation dialog input; deletion side effects always remain owned by FlowUpload. */
interface UploadRemoveDialogProps {
  files: UploadFileItem[]
  busy: boolean
  error?: string
  title: string
  /** 单文件删除时显示文件名的确认文案，使用 {name} 插值。 Single-file confirmation copy that displays the filename using {name} interpolation. */
  singleFileMessage: string
  /** 批量删除时仅显示数量的确认文案，使用 {count} 插值。 Batch-removal confirmation copy that displays only the count using {count} interpolation. */
  multipleFilesMessage: string
  cancelText: string
  confirmText: string
  processingText: string
}
/** 经过 TypeScript 约束的弹窗输入。 TypeScript-constrained dialog input. */
const props = defineProps<UploadRemoveDialogProps>()
/** 删除确认弹窗的用户决策事件。 User-decision events from the delete confirmation dialog. */
interface UploadRemoveDialogEmits {
  /** 用户取消删除时发送。 Sent when the user cancels deletion. */
  (event: 'cancel'): void
  /** 用户确认删除时发送。 Sent when the user confirms deletion. */
  (event: 'confirm'): void
}
/** 经过 TypeScript 约束的弹窗事件发送器。 TypeScript-constrained dialog event emitter. */
const emit = defineEmits<UploadRemoveDialogEmits>()

// 按待删文件数量选择确认文案：单文件显示名称，批量删除只显示数量。
// Selects confirmation copy by pending file count: one file displays its name, while a batch displays only its count.
const confirmationMessage = computed(() =>
  props.files.length === 1
    ? props.singleFileMessage.replace('{name}', props.files[0]?.name ?? '')
    : props.multipleFilesMessage.replace('{count}', String(props.files.length)),
)
</script>

<template>
  <UploadModal
    :visible="files.length > 0"
    class="vfu-confirm"
    :close-on-backdrop="!busy"
    :close-on-escape="!busy"
    @close="emit('cancel')"
  >
    <section class="vfu-confirm__dialog" role="alertdialog" aria-modal="true" :aria-label="title">
      <div class="vfu-confirm__icon" aria-hidden="true">!</div>
      <div class="vfu-confirm__content">
        <h3>{{ title }}</h3>
        <p>{{ confirmationMessage }}</p>
        <p v-if="error" class="vfu-confirm__error">{{ error }}</p>
      </div>
      <footer>
        <UploadButton variant="info" :disabled="busy" @click="emit('cancel')">
          {{ cancelText }}
        </UploadButton>
        <UploadButton variant="danger" :disabled="busy" @click="emit('confirm')">
          {{ busy ? processingText : confirmText }}
        </UploadButton>
      </footer>
    </section>
  </UploadModal>
</template>
