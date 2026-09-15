<script setup lang="ts">
import type { UploadFileItem, UploadListType, UploadMessages } from '../../types'
import { fileIconUrl, formatSize, isImage } from '../../utils/file'
import UploadActionMask from '../base/UploadActionMask.vue'
import UploadFileActions from './UploadFileActions.vue'

/** 将细化队列状态映射为较小的视觉图标状态集合。 Maps detailed queue states to the smaller set of visual state-icon variants. */
function statusKind(status: UploadFileItem['status']) {
  if (status === 'success') return 'success'
  if (status === 'failed' || status === 'rejected') return 'error'
  if (['uploading', 'merging'].includes(status)) return 'uploading'
  if (status === 'processing') return 'processing'
  return 'pending'
}

/**
 * FlowUpload 提供的纯渲染契约；操作回调接收 uid，组件绝不自行修改上传状态。
 * Render-only contract supplied by FlowUpload. Action callbacks receive a uid so this component never mutates upload state itself.
 */
interface UploadFileListProps {
  files: UploadFileItem[]
  show: boolean
  listType?: UploadListType
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
/** 经过 TypeScript 约束的文件列表输入。 TypeScript-constrained file-list input. */
defineProps<UploadFileListProps>()
</script>

<template>
  <!-- 图标来自 Lucide Icons v1.40.0（ISC）。 Icons are from Lucide Icons v1.40.0 (ISC). -->
  <ul
    v-if="show && files.length"
    class="vfu-list"
    :class="{ 'is-picture-wall': listType === 'picture' }"
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
        <label v-if="selectable && listType === 'list'" class="vfu-select" @click.stop>
          <input
            :checked="file.status === 'success' && selected.has(file.uid)"
            :disabled="file.status !== 'success' || !file.fileId"
            type="checkbox"
            @change="toggleSelected(file.uid)"
          />
        </label>
        <div class="vfu-file__visual">
          <span
            v-if="listType !== 'list'"
            class="vfu-file__state"
            :class="`is-${statusKind(file.status)}`"
            :aria-label="statusText(file.status)"
            :title="statusText(file.status)"
          >
            <svg
              v-if="statusKind(file.status) === 'success'"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m6.5 12 3.5 3.5 7.5-7.5" />
            </svg>
            <svg
              v-else-if="statusKind(file.status) === 'uploading'"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
            </svg>
            <svg
              v-else-if="statusKind(file.status) === 'error'"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m9 9 6 6m0-6-6 6" />
            </svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <path d="M12 8v4l2.5 1.5" />
            </svg>
          </span>
          <label v-if="selectable && listType !== 'list'" class="vfu-select" @click.stop>
            <input
              :checked="file.status === 'success' && selected.has(file.uid)"
              :disabled="file.status !== 'success' || !file.fileId"
              type="checkbox"
              @change="toggleSelected(file.uid)"
            />
          </label>
          <button
            v-if="file.status !== 'processing' && isImage(file) && imageUrl(file)"
            class="vfu-thumbnail"
            type="button"
            :disabled="!canPreview"
            @click="preview(file)"
          >
            <img :src="imageUrl(file)" :alt="file.name" />
          </button>
          <img v-else class="vfu-file__glyph vfu-file__icon" :src="fileIconUrl(file)" alt="" />
          <UploadActionMask v-if="listType !== 'list'" class="vfu-file__actions">
            <UploadFileActions
              :file="file"
              :can-preview-file="
                file.status !== 'processing' && isImage(file) && !!imageUrl(file) && canPreview
              "
              :can-download-file="file.status === 'success' && !!file.fileId && canDownload"
              :can-retry-file="file.status === 'failed' && canRetry"
              :can-remove="canRemove"
              :text="text"
              :preview="preview"
              :download="download"
              :retry="retry"
              :remove="remove"
            />
          </UploadActionMask>
        </div>
        <div
          class="vfu-file__body"
          :title="listType !== 'list' ? `${file.name} (${formatSize(file.size)})` : undefined"
        >
          <div class="vfu-file__headline">
            <strong>{{ file.name }}</strong
            ><span>{{ formatSize(file.size) }}</span>
          </div>
          <div
            v-if="['uploading', 'queued', 'merging', 'processing'].includes(file.status)"
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
            <small
              :class="{ 'is-error': file.status === 'failed' || file.status === 'rejected' }"
              >{{ file.error?.message ?? statusText(file.status) }}</small
            >
            <span
              v-if="['uploading', 'queued', 'merging', 'processing'].includes(file.status)"
              class="vfu-file__percent"
              >{{ file.percent }}%</span
            >
          </div>
        </div>
        <div v-if="listType === 'list'" class="vfu-file__actions">
          <UploadFileActions
            :file="file"
            :can-preview-file="
              file.status !== 'processing' && isImage(file) && !!imageUrl(file) && canPreview
            "
            :can-download-file="file.status === 'success' && !!file.fileId && canDownload"
            :can-retry-file="file.status === 'failed' && canRetry"
            :can-remove="canRemove"
            :text="text"
            :preview="preview"
            :download="download"
            :retry="retry"
            :remove="remove"
          />
          <template v-if="false">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2 2V6" />
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </template>
        </div>
      </slot>
    </li>
  </ul>
</template>
