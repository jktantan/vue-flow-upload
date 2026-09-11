<script setup lang="ts">
import { computed } from 'vue'
import type { UploadFileItem, UploadMessages } from '../types'
import { formatSize } from '../utils/file'

/** 工具栏输入；自身不保存上传状态，只渲染能力并向上发送意图。 Toolbar input; it owns no upload state and only renders capabilities and emits intents. */
interface UploadToolbarsProps {
  files: UploadFileItem[]
  selectable: boolean
  selected: Set<string>
  selectableCount: number
  allSelected: boolean
  canSelect: boolean
  canRemove: boolean
  canDownloadAll: boolean
  drag: boolean
  accept?: string | string[]
  maxSize?: number
  text: UploadMessages
  autoUpload: boolean
  canUpload: boolean
}
/** 经过 TypeScript 约束的工具栏输入。 TypeScript-constrained toolbar input. */
const props = defineProps<UploadToolbarsProps>()

/** Accessible tooltip describing the active accept and size constraints. */
const selectFileTooltip = computed(() => {
  // 将选择限制组合为可访问的按钮提示文案。 Combine selection limits into an accessible button tooltip.
  const accept = Array.isArray(props.accept) ? props.accept.join(', ') : props.accept
  const maxSize =
    props.maxSize && Number.isFinite(props.maxSize)
      ? formatSize(props.maxSize)
      : props.text.unlimited
  return props.text.uploadLimits
    .replace('{accept}', accept || props.text.allFileTypes)
    .replace('{maxSize}', maxSize)
})

/** FlowUpload 消费的工具栏用户意图。 Toolbar user intents consumed by FlowUpload. */
interface UploadToolbarsEmits {
  /** 请求打开文件选择器。 Requests opening the file picker. */
  (event: 'select'): void
  /** 请求提交待上传文件。 Requests submitting pending files. */
  (event: 'upload'): void
  /** 请求切换全部可选文件。 Requests toggling all selectable files. */
  (event: 'toggleAll'): void
  /** 请求归档下载指定 uid。 Requests an archive download for selected uids. */
  (event: 'downloadSelected', uids: string[]): void
  /** 请求归档下载全部文件。 Requests an archive download for all files. */
  (event: 'downloadAll'): void
  /** 请求删除当前选中项。 Requests removal of current selected items. */
  (event: 'removeSelected'): void
}
/** 经过 TypeScript 约束的工具栏事件发送器。 TypeScript-constrained toolbar event emitter. */
const emit = defineEmits<UploadToolbarsEmits>()
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
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15V3" />
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
        </svg>
        {{ text.downloadSelected }}
      </button>
      <button
        v-if="canDownloadAll"
        class="vfu-button is-info"
        type="button"
        @click="emit('downloadAll')"
      >
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15V3" />
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
        </svg>
        {{ text.downloadAll }}
      </button>
      <button
        v-if="selectable && canRemove"
        class="vfu-button is-danger"
        type="button"
        :disabled="!selected.size"
        @click="emit('removeSelected')"
      >
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        {{ text.removeSelected }}
      </button>
    </span>
    <span v-if="drag" class="vfu-toolbar__center">
      <span class="vfu-toolbar__drag">{{ text.dragUpload }}</span>
    </span>
    <span class="vfu-toolbar__right">
      <button
        v-if="!autoUpload"
        class="vfu-button is-primary vfu-button--tooltip"
        type="button"
        :disabled="!canSelect"
        :data-tooltip="selectFileTooltip"
        :title="selectFileTooltip"
        @click="emit('select')"
      >
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
        </svg>
        {{ text.chooseFile }}
      </button>
      <button
        class="vfu-button is-success"
        type="button"
        :disabled="autoUpload ? !canSelect : !canUpload"
        @click="autoUpload ? emit('select') : emit('upload')"
      >
        <svg class="vfu-button__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
        </svg>
        {{ autoUpload ? text.uploadFile : text.startUpload }}
      </button>
    </span>
  </div>
</template>
