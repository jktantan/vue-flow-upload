<script setup lang="ts">
/* eslint-disable vue/require-default-prop -- omitted values are semantically distinct in the public API */
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n-lite'
import { ChunkScheduler } from './core/chunk-scheduler'
import { createFlowUploadI18n, getUploadMessages, type FlowUploadI18nOptions } from './i18n'
import { resolveTheme } from './themes'
import { createHttpUploadTransport } from './core/http-transport'
import UploadPreviewDialog from './components/UploadPreviewDialog.vue'
import UploadFileList from './components/UploadFileList.vue'
import UploadToolbars from './components/UploadToolbars.vue'
import UploadTrigger from './components/UploadTrigger.vue'
import { useDownloadManager } from './composables/useDownloadManager'
import { useFilePreview } from './composables/useFilePreview'
import { useFileSelectionState } from './composables/useFileSelectionState'
import { useUploadQueue } from './composables/useUploadQueue'
import { createUid, matchesAccept, normalizeFileList, toCssSize } from './utils/file'
import { makeUploadError } from './utils/error'
import type {
  UploadData,
  DownloadScope,
  DownloadTransport,
  UploadError,
  UploadFileItem,
  UploadHeaders,
  UploadPermissions,
  UploadSuccessResult,
  UploadMessages,
  UploadTheme,
  UploadTransport,
  UploadUserFile,
} from './types'

const props = withDefaults(
  defineProps<{
    modelValue?: UploadUserFile[]
    defaultFileList?: UploadUserFile[]
    /** Custom transport. Omit it and provide `action` for a standard XHR upload. */
    transport?: UploadTransport
    action?: string
    method?: 'POST' | 'PUT'
    withCredentials?: boolean
    downloadTransport?: DownloadTransport
    data?: UploadData
    headers?: UploadHeaders
    fileFieldName?: string
    dataFieldName?: string
    accept?: string | string[]
    maxSize?: number
    maxCount?: number
    multiple?: boolean
    autoUpload?: boolean
    normalUploadThreshold?: number
    chunkSize?: number
    concurrency?: number
    maxConcurrentFiles?: number
    maxConcurrentRequests?: number
    retryCount?: number
    retryBaseDelay?: number
    resume?: boolean
    instantUpload?: boolean
    showFileList?: boolean
    drag?: boolean
    directory?: boolean
    listType?: 'list' | 'picture' | 'picture-card'
    preview?: boolean
    selectable?: boolean
    /** CSS width. Numbers are treated as pixels. */
    width?: string | number
    /** CSS height. Use `auto` to fill a parent with an explicit height. */
    height?: string | number
    archivePollingInterval?: number
    archivePollingTimeout?: number
    allDownloadScope?: DownloadScope
    onPreview?: (file: UploadFileItem) => void | Promise<void>
    theme?: UploadTheme
    /** Preferred i18n configuration. Messages use the `VueFlowUpload` namespace. */
    i18n?: FlowUploadI18nOptions
    /** @deprecated Use `i18n.locale` instead. */
    locale?: string
    /** @deprecated Use `i18n.messages[locale].VueFlowUpload` instead. */
    messages?: Partial<UploadMessages>
    disabled?: boolean
    permissions?: UploadPermissions
    beforeUpload?: (file: File) => boolean | Promise<boolean>
    beforeRemove?: (file: UploadFileItem, files: UploadFileItem[]) => boolean | Promise<boolean>
  }>(),
  {
    defaultFileList: () => [],
    fileFieldName: 'file',
    dataFieldName: 'data',
    maxCount: Number.POSITIVE_INFINITY,
    multiple: true,
    method: 'POST',
    withCredentials: false,
    autoUpload: true,
    normalUploadThreshold: 10 * 1024 * 1024,
    chunkSize: 5 * 1024 * 1024,
    concurrency: 3,
    maxConcurrentFiles: 2,
    maxConcurrentRequests: 6,
    retryCount: 3,
    retryBaseDelay: 500,
    resume: true,
    instantUpload: true,
    listType: 'list',
    showFileList: true,
    drag: false,
    directory: false,
    preview: true,
    selectable: false,
    width: 'auto',
    height: '300px',
    archivePollingInterval: 2_000,
    archivePollingTimeout: 10 * 60_000,
    theme: 'default',
    locale: 'zh-CN',
    disabled: false,
    permissions: () => ({}),
  },
)

const emit = defineEmits<{
  'update:modelValue': [files: UploadFileItem[]]
  change: [file: UploadFileItem, files: UploadFileItem[]]
  progress: [file: UploadFileItem, percent: number]
  success: [file: UploadFileItem, response: UploadSuccessResult]
  error: [file: UploadFileItem, error: UploadError]
  remove: [file: UploadFileItem]
  exceed: [files: File[]]
  'download-start': [file: UploadFileItem]
  'download-success': [file: UploadFileItem]
  'download-error': [file: UploadFileItem, error: UploadError]
  'archive-start': [taskId: string, fileIds: string[]]
  'archive-progress': [taskId: string, percent?: number]
  'archive-success': [taskId: string]
  'archive-error': [taskId: string, error: UploadError]
}>()

const internalFiles = ref<UploadFileItem[]>(
  normalizeFileList(props.modelValue ?? props.defaultFileList),
)
const scheduler = new ChunkScheduler({
  concurrency: props.concurrency,
  maxConcurrentFiles: props.maxConcurrentFiles,
  maxConcurrentRequests: props.maxConcurrentRequests,
})

watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined) internalFiles.value = normalizeFileList(value)
  },
)

const files = computed(() => internalFiles.value)
const canSelect = computed(() => !props.disabled && props.permissions.select !== false)
const canUpload = computed(() => !props.disabled && props.permissions.upload !== false)
const canRemove = computed(() => !props.disabled && props.permissions.remove !== false)
const canRetry = computed(() => !props.disabled && props.permissions.retry !== false)
const canPreview = computed(
  () => !props.disabled && props.preview && props.permissions.preview !== false,
)
const canDownload = computed(
  () => !props.disabled && !!props.downloadTransport && props.permissions.download !== false,
)
const canDownloadAll = computed(() => canDownload.value && props.permissions.downloadAll !== false)
const resolvedTheme = computed(() => resolveTheme(props.theme))
const inheritedI18n = useI18n()
const declaredProps = getCurrentInstance()?.vnode.props
const hasLegacyI18nOptions =
  !!declaredProps && ('locale' in declaredProps || 'messages' in declaredProps)
const localI18n = computed(() =>
  createFlowUploadI18n(
    { locale: props.i18n?.locale ?? props.locale, messages: props.i18n?.messages },
    props.messages,
  ),
)
const i18n = computed(() =>
  props.i18n || hasLegacyI18nOptions ? localI18n.value : (inheritedI18n ?? localI18n.value),
)
const text = computed(() => getUploadMessages(i18n.value))
const t = (key: string, values?: Record<string, string | number>) =>
  i18n.value.t(`VueFlowUpload.${key}`, values)
const themeStyle = computed(() => resolvedTheme.value.variables ?? {})
const layoutStyle = computed(() => ({
  width: toCssSize(props.width),
  // CSS `auto` sizes to content. For this component, it intentionally means
  // "use the containing component's height" instead.
  height: props.height === 'auto' ? '100%' : toCssSize(props.height),
}))
const uploadTransport = computed(
  () =>
    props.transport ??
    (props.action
      ? createHttpUploadTransport({
          url: props.action,
          method: props.method,
          credentials: props.withCredentials ? 'include' : 'same-origin',
        })
      : undefined),
)
function updateFiles(next: UploadFileItem[], changed?: UploadFileItem) {
  internalFiles.value = next
  emit('update:modelValue', next)
  if (changed) emit('change', changed, next)
}

function updateFile(uid: string, patch: Partial<UploadFileItem>) {
  const next = files.value.map((file) => (file.uid === uid ? { ...file, ...patch } : file))
  const changed = next.find((file) => file.uid === uid)
  if (changed) updateFiles(next, changed)
  return changed
}

const uploadQueue = useUploadQueue({
  files,
  canUpload,
  transport: uploadTransport,
  scheduler,
  normalUploadThreshold: props.normalUploadThreshold,
  chunkSize: props.chunkSize,
  retryCount: props.retryCount,
  retryBaseDelay: props.retryBaseDelay,
  resume: props.resume,
  instantUpload: props.instantUpload,
  fileFieldName: props.fileFieldName,
  dataFieldName: props.dataFieldName,
  resolveData,
  resolveHeaders,
  updateFile,
  onProgress: (file, percent) => emit('progress', file, percent),
  onSuccess: (file, response) => emit('success', file, response),
  onError: (file, error) => emit('error', file, error),
})
const {
  upload,
  submit,
  retry,
  pause,
  resume: resumeUpload,
  abort,
  clear: clearUploads,
  requestMeta,
} = uploadQueue
const {
  download,
  downloadSelected,
  downloadAll,
  cancelArchive,
  clear: clearDownloads,
} = useDownloadManager({
  files,
  transport: computed(() => props.downloadTransport),
  canDownload,
  canDownloadAll,
  allDownloadScope: props.allDownloadScope,
  archivePollingInterval: props.archivePollingInterval,
  archivePollingTimeout: props.archivePollingTimeout,
  requestMeta: async () => requestMeta(await resolveData(), await resolveHeaders()),
  onDownloadStart: (file) => emit('download-start', file),
  onDownloadSuccess: (file) => emit('download-success', file),
  onDownloadError: (file, error) => {
    emit('download-error', file, error)
    emit('error', file, error)
  },
  onArchiveStart: (taskId, fileIds) => emit('archive-start', taskId, fileIds),
  onArchiveProgress: (taskId, percent) => emit('archive-progress', taskId, percent),
  onArchiveSuccess: (taskId) => emit('archive-success', taskId),
  onArchiveError: (taskId, error) => emit('archive-error', taskId, error),
})
const {
  previewing,
  imageUrl,
  previewFile,
  revoke: revokePreviewUrl,
  clear: clearPreviews,
} = useFilePreview({ canPreview, onPreview: props.onPreview })
const {
  selected,
  selectableFiles,
  allSelected: allSelectableFilesSelected,
  toggle: toggleSelected,
  toggleAll: toggleAllSelected,
  remove: removeSelection,
  clear: clearSelection,
} = useFileSelectionState(files)

async function addFiles(selected: File[]) {
  if (!selected.length || !canSelect.value) return
  const available = Math.max(0, props.maxCount - files.value.length)
  const accepted = selected.slice(0, available)
  const exceeded = selected.slice(available)
  if (exceeded.length) emit('exceed', exceeded)

  for (const file of accepted) {
    const item: UploadFileItem = {
      uid: createUid(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'validating',
      percent: 0,
      file,
    }
    updateFiles([...files.value, item], item)
    const error = await validate(file)
    if (error) {
      const rejected = updateFile(item.uid, { status: 'rejected', error })
      if (rejected) emit('error', rejected, error)
      continue
    }
    const idle = updateFile(item.uid, { status: 'idle' })
    if (idle && props.autoUpload) void upload(idle.uid)
  }
}

async function validate(file: File): Promise<UploadError | undefined> {
  if (props.maxSize !== undefined && file.size > props.maxSize) {
    return makeUploadError('FILE_TOO_LARGE', t('fileTooLarge', { name: file.name }), false)
  }
  if (!matchesAccept(file, props.accept)) {
    return makeUploadError(
      'FILE_TYPE_NOT_ALLOWED',
      t('fileTypeNotAllowed', { name: file.name }),
      false,
    )
  }
  if (props.beforeUpload && !(await props.beforeUpload(file))) {
    return makeUploadError(
      'BEFORE_UPLOAD_REJECTED',
      t('beforeUploadRejected', { name: file.name }),
      false,
    )
  }
}

async function removeSelected() {
  await Promise.all([...selected.value].map((uid) => remove(uid)))
}

async function remove(uid: string) {
  const target = files.value.find((file) => file.uid === uid)
  if (!target || !canRemove.value) return false
  try {
    if (props.beforeRemove && !(await props.beforeRemove(target, files.value))) return false
  } catch {
    return false
  }
  revokePreviewUrl(uid)
  removeSelection(uid)
  uploadQueue.abort(uid)
  const transport = uploadTransport.value
  if (target.uploadId && transport?.cancelMultipart) {
    void Promise.all([resolveData(), resolveHeaders()]).then(([data, headers]) =>
      transport.cancelMultipart?.(target.uploadId!, {
        data,
        headers,
        fileFieldName: props.fileFieldName,
        dataFieldName: props.dataFieldName,
      }),
    )
  }
  updateFiles(
    files.value.filter((file) => file.uid !== uid),
    target,
  )
  emit('remove', target)
  return true
}

function handleStart(file: File) {
  return addFiles([file])
}

function handleRemove(file: string | UploadFileItem) {
  return remove(typeof file === 'string' ? file : file.uid)
}

function clear() {
  clearUploads()
  clearPreviews()
  clearSelection()
  clearDownloads()
  updateFiles([])
}

async function resolveData() {
  return typeof props.data === 'function' ? await props.data() : (props.data ?? {})
}

async function resolveHeaders() {
  return typeof props.headers === 'function' ? await props.headers() : (props.headers ?? {})
}

function statusText(status: UploadFileItem['status']) {
  return {
    idle: text.value.waiting,
    validating: text.value.validating,
    hashing: text.value.hashing,
    checking: text.value.checking,
    uploading: text.value.uploading,
    preparing: text.value.waiting,
    queued: text.value.waiting,
    paused: text.value.paused,
    merging: text.value.uploading,
    success: text.value.completed,
    failed: text.value.uploadFailed,
    canceled: text.value.canceled,
    rejected: text.value.rejected,
  }[status]
}

onBeforeUnmount(clear)

defineExpose({
  submit,
  abort,
  pause,
  resume: resumeUpload,
  retry,
  remove,
  clear,
  clearFiles: clear,
  handleStart,
  handleRemove,
  download,
  downloadSelected,
  downloadAll,
  cancelArchive,
})
</script>

<template>
  <section
    class="vfu-upload"
    :class="resolvedTheme.className"
    :style="[themeStyle, layoutStyle]"
    :aria-label="text.selectFile"
  >
    <UploadTrigger
      :drag="drag"
      :directory="directory"
      :multiple="multiple"
      :accept="accept"
      :can-select="canSelect"
      :text="text"
      :t="t"
      @files="addFiles"
    >
      <template v-if="$slots.default" #default><slot /></template>
      <template v-if="$slots.trigger" #trigger><slot name="trigger" /></template>
    </UploadTrigger>
    <slot name="tip" />

    <UploadToolbars
      :files="files"
      :auto-upload="autoUpload"
      :selectable="selectable"
      :selected="selected"
      :selectable-count="selectableFiles.length"
      :all-selected="allSelectableFilesSelected"
      :can-upload="canUpload"
      :can-remove="canRemove"
      :can-download-all="canDownloadAll"
      :text="text"
      :t="t"
      @submit="submit"
      @toggle-all="toggleAllSelected"
      @download-selected="downloadSelected"
      @download-all="downloadAll"
      @remove-selected="removeSelected"
    />

    <UploadFileList
      :files="files"
      :show="showFileList"
      :list-type="listType"
      :selectable="selectable"
      :selected="selected"
      :can-upload="canUpload"
      :can-retry="canRetry"
      :can-preview="canPreview"
      :can-download="canDownload"
      :can-remove="canRemove"
      :text="text"
      :t="t"
      :status-text="statusText"
      :image-url="imageUrl"
      :toggle-selected="toggleSelected"
      :remove="remove"
      :preview="previewFile"
      :download="download"
      :pause="pause"
      :resume="resumeUpload"
      :retry="retry"
    >
      <template v-if="$slots.file" #file="slotProps">
        <slot name="file" v-bind="slotProps" />
      </template>
    </UploadFileList>
    <UploadPreviewDialog
      :file="previewing"
      :close-label="text.closePreview"
      :image-url="imageUrl"
      @close="previewing = undefined"
    />
  </section>
</template>

<style lang="scss">
@use './styles/flow-upload.scss';
</style>
