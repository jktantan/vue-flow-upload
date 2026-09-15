<script setup lang="ts">
import { computed } from 'vue'
import type { UploadFileItem, UploadMessages } from '../../types'
import { formatSize } from '../../utils/file'
import UploadButton from '../base/UploadButton.vue'
import UploadIcon from '../base/UploadIcon.vue'

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
      <UploadButton
        v-if="selectable && canDownloadAll"
        :disabled="!selected.size"
        @click="emit('downloadSelected', [...selected])"
      >
        <UploadIcon class="vfu-button__icon" name="download" />
        {{ text.downloadSelected }}
      </UploadButton>
      <UploadButton v-if="canDownloadAll" variant="info" @click="emit('downloadAll')">
        <UploadIcon class="vfu-button__icon" name="download" />
        {{ text.downloadAll }}
      </UploadButton>
      <UploadButton
        v-if="selectable && canRemove"
        variant="danger"
        :disabled="!selected.size"
        @click="emit('removeSelected')"
      >
        <UploadIcon class="vfu-button__icon" name="remove" />
        {{ text.removeSelected }}
      </UploadButton>
    </span>
    <span v-if="drag" class="vfu-toolbar__center">
      <span class="vfu-toolbar__drag">{{ text.dragUpload }}</span>
    </span>
    <span class="vfu-toolbar__right">
      <UploadButton
        v-if="!autoUpload"
        class="vfu-button--tooltip"
        :disabled="!canSelect"
        :data-tooltip="selectFileTooltip"
        :title="selectFileTooltip"
        @click="emit('select')"
      >
        <UploadIcon class="vfu-button__icon" name="upload" />
        {{ text.chooseFile }}
      </UploadButton>
      <UploadButton
        variant="success"
        :disabled="autoUpload ? !canSelect : !canUpload"
        @click="autoUpload ? emit('select') : emit('upload')"
      >
        <UploadIcon class="vfu-button__icon" name="upload" />
        {{ autoUpload ? text.uploadFile : text.startUpload }}
      </UploadButton>
    </span>
  </div>
</template>
