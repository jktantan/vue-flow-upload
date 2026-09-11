<script setup lang="ts">
import { computed } from 'vue'
import type { UploadFileItem } from '../types'

/** 删除确认弹窗输入；删除副作用始终由 FlowUpload 持有。 Delete-confirmation dialog input; deletion side effects always remain owned by FlowUpload. */
interface UploadRemoveDialogProps {
  files: UploadFileItem[]
  busy: boolean
  error?: string
  title: string
  message: string
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

// 将待删除文件名汇总到确认文案，供单个和批量删除共用。 Summarize pending names for both single and batch removal copy.
const names = computed(() => props.files.map((file) => file.name).join('、'))
</script>

<template>
  <Teleport to="body">
    <div v-if="files.length" class="vfu-confirm" role="presentation">
      <div class="vfu-confirm__backdrop" />
      <section class="vfu-confirm__dialog" role="alertdialog" aria-modal="true" :aria-label="title">
        <div class="vfu-confirm__icon" aria-hidden="true">!</div>
        <div class="vfu-confirm__content">
          <h3>{{ title }}</h3>
          <p>{{ message.replace('{names}', names).replace('{count}', String(files.length)) }}</p>
          <p v-if="error" class="vfu-confirm__error">{{ error }}</p>
        </div>
        <footer>
          <button type="button" :disabled="busy" @click="emit('cancel')">{{ cancelText }}</button>
          <button class="is-danger" type="button" :disabled="busy" @click="emit('confirm')">
            {{ busy ? processingText : confirmText }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
