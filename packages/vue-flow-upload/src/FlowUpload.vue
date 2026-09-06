<script setup lang="ts">
/* eslint-disable vue/require-default-prop -- omitted values are semantically distinct in the public API */
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n-lite'
import { ChunkScheduler } from './core/chunk-scheduler'
import { createFlowUploadI18n, getUploadMessages, type FlowUploadI18nOptions } from './i18n'
import { resolveTheme } from './themes'
import { createHttpUploadTransport } from './core/http-transport'
import 'viewerjs/dist/viewer.css'
import UploadFileList from './components/UploadFileList.vue'
import UploadPictureWall from './components/UploadPictureWall.vue'
import UploadFooter from './components/UploadFooter.vue'
import UploadRemoveDialog from './components/UploadRemoveDialog.vue'
import UploadToolbars from './components/UploadToolbars.vue'
import UploadTrigger from './components/UploadTrigger.vue'
import loadingSvg from './assets/loading.svg'
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
  UploadPagination,
} from './types'

const props = withDefaults(
  defineProps<{
    modelValue?: UploadUserFile[]
    defaultFileList?: UploadUserFile[]
    /** Custom transport. Omit it and provide `action` for a standard XHR upload. */
    transport?: UploadTransport
    action?: string
    /** Optional endpoint that pre-creates a server file record and returns its fileId. */
    createAction?: string
    /** Endpoint that idempotently deletes a file and all of its upload sessions by fileId. */
    deleteAction?: string
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
    showOperation?: boolean
    showFooter?: boolean
    pagination?: UploadPagination
    drag?: boolean
    directory?: boolean
    listType?: 'list' | 'picture' | 'picture-card'
    preview?: boolean
    selectable?: boolean
    /** Shows a loading mask over the list/picture display area. */
    loading?: boolean
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
    showOperation: true,
    showFooter: true,
    drag: true,
    directory: false,
    preview: true,
    selectable: false,
    loading: false,
    width: 'auto',
    height: '600px',
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
// Exposes the hidden native input's file picker to toolbar buttons and consumers.
const uploadTrigger = ref<{ browse: () => void }>()
// Shares request slots between files so file and chunk concurrency limits both apply.
const scheduler = new ChunkScheduler({
  concurrency: props.concurrency,
  maxConcurrentFiles: props.maxConcurrentFiles,
  maxConcurrentRequests: props.maxConcurrentRequests,
})

watch(
  () => props.modelValue,
  (value) => {
    // 受控模式由外部模型覆盖本地状态，先补全可选字段。 A controlled model replaces local state; normalize optional fields first.
    if (value !== undefined) internalFiles.value = normalizeFileList(value)
  },
)

const files = computed(() => internalFiles.value)
/**
 * 已完成文件保持服务端顺序，本地上传任务优先显示；同组保留原始顺序。
 * Completed files retain server order; local work appears first; order stays stable within a group.
 */
const displayedFiles = computed(() =>
  files.value
    .map((file, index) => ({ file, index }))
    .sort((left, right) => {
      const priority = (file: UploadFileItem) => {
        if (file.status === 'uploading' || file.status === 'merging') return 0
        if (['failed', 'rejected', 'canceled'].includes(file.status)) return 2
        if (file.status === 'success') return 3
        return 1
      }
      return priority(left.file) - priority(right.file) || left.index - right.index
    })
    .map(({ file }) => file),
)
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
const dragActive = ref(false)
function handleSelectedFiles(selected: File[]) {
  void addFiles(selected)
}
const toastMessage = ref('')
let toastTimer: number | undefined
const pendingRemoval = ref<UploadFileItem[]>([])
const removalBusy = ref(false)
const removalError = ref('')
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
          createUrl: props.createAction,
          deleteUrl: props.deleteAction,
          method: props.method,
          credentials: props.withCredentials ? 'include' : 'same-origin',
        })
      : undefined),
)
function updateFiles(next: UploadFileItem[], changed?: UploadFileItem) {
  // 同步内部列表与 v-model，再上报引发变更的文件。 Keep internal list and v-model in sync, then report the changed file.
  internalFiles.value = next
  emit('update:modelValue', next)
  if (changed) emit('change', changed, next)
}

function updateFile(uid: string, patch: Partial<UploadFileItem>) {
  // 使用不可变替换，确保 Vue 更新依赖此列表的所有组合逻辑和行。 Use immutable replacement so Vue updates all dependent composables and rows.
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
  imageUrl,
  previewFile,
  revoke: revokePreviewUrl,
  clear: clearPreviews,
} = useFilePreview({ files, canPreview, onPreview: props.onPreview })
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
  // 逐个处理文件，异步校验完成后才可自动上传。 Process one file at a time so validation finishes before auto-upload.
  if (!selected.length || !canSelect.value) return
  const available = Math.max(0, props.maxCount - files.value.length)
  const accepted = selected.slice(0, available)
  const exceeded = selected.slice(available)
  if (exceeded.length) emit('exceed', exceeded)

  for (const file of accepted) {
    const item: UploadFileItem = {
      uid: createUid(),
      fileId: createUid(),
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

function showToast(message: string) {
  toastMessage.value = message
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
    toastTimer = undefined
  }, 1800)
}

async function handleUpload() {
  const active = files.value.some((file) =>
    ['uploading', 'hashing', 'checking', 'preparing', 'queued', 'merging'].includes(file.status),
  )
  if (active) {
    showToast(text.value.uploadingToast)
    return
  }
  const pending = files.value.some((file) => file.status === 'idle')
  if (!pending) {
    showToast(text.value.noUploadFilesToast)
    return
  }
  await submit()
}

async function validate(file: File): Promise<UploadError | undefined> {
  // 校验失败保留为 rejected 行，用户可以看到失败原因。 Keep validation failures as rejected rows so users can see why.
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
  // 根据当前列表解析选中 id，弹窗期间文件可能已变化。 Resolve selected ids against the current list because files may change while dialog is open.
  const targets = files.value.filter((file) => selected.value.has(file.uid))
  if (!targets.length) {
    showToast(text.value.noRemoveFilesToast)
    return
  }
  const direct = targets.filter((file) => !requiresRemovalConfirmation(file))
  for (const file of direct) await removeImmediately(file)
  const confirmed = targets.filter(requiresRemovalConfirmation)
  if (confirmed.length) openRemovalConfirmation(confirmed)
}

function handleDownloadSelected(uids: string[]) {
  if (!uids.length) {
    showToast(text.value.noDownloadFilesToast)
    return
  }
  void downloadSelected(uids)
}

async function remove(uid: string) {
  // 已完成远端文件需要确认；本地或未完成文件可立即移除。 Completed remote files need confirmation; local/incomplete files remove immediately.
  const target = files.value.find((file) => file.uid === uid)
  if (!target || !canRemove.value) return false
  if (requiresRemovalConfirmation(target)) {
    openRemovalConfirmation([target])
    return false
  }
  return removeImmediately(target)
}

function requiresRemovalConfirmation(file: UploadFileItem) {
  // 仅已持久化的成功文件可能需要确认服务端清理。 Only persisted successful files may need server cleanup confirmation.
  return !['idle', 'validating', 'rejected'].includes(file.status)
}

function openRemovalConfirmation(targets: UploadFileItem[]) {
  // 保存删除目标快照，使弹窗内容保持稳定。 Store a target snapshot so dialog content stays stable.
  pendingRemoval.value = targets
  removalError.value = ''
}

function closeRemovalConfirmation() {
  // 关闭不修改文件，只丢弃待确认状态。 Closing never mutates files; it only discards pending confirmation.
  if (removalBusy.value) return
  pendingRemoval.value = []
  removalError.value = ''
}

async function confirmRemoval() {
  // 串行处理目标，使远端清理和报错顺序可预测。 Process targets serially for deterministic cleanup and errors.
  removalBusy.value = true
  removalError.value = ''
  try {
    for (const file of pendingRemoval.value) await removeImmediately(file)
    pendingRemoval.value = []
  } catch {
    removalError.value = text.value.removeCleanupFailed
  } finally {
    removalBusy.value = false
  }
}

async function removeImmediately(target: UploadFileItem) {
  // 本地删除前先取消进行中的任务；存在时 deleteFile 清理服务端记录。 Cancel in-flight work first; deleteFile clears the server record when present.
  try {
    if (props.beforeRemove && !(await props.beforeRemove(target, files.value))) return false
  } catch {
    return false
  }
  const cleanupRequired = requiresRemovalConfirmation(target)
  if (cleanupRequired) {
    if (!target.fileId || !uploadTransport.value?.deleteFile)
      throw new Error('DELETE_FILE_NOT_CONFIGURED')
    uploadQueue.abort(target.uid)
    await uploadTransport.value.deleteFile(
      target.fileId,
      requestMeta(await resolveData(), await resolveHeaders()),
    )
  }
  revokePreviewUrl(target.uid)
  removeSelection(target.uid)
  updateFiles(
    files.value.filter((file) => file.uid !== target.uid),
    target,
  )
  emit('remove', target)
  return true
}

function handleStart(file: File) {
  // The trigger emits one file at a time, while the central add path accepts batches.
  return addFiles([file])
}

function handleRemove(file: string | UploadFileItem) {
  // Support both the exposed uid API and slot callbacks that pass the full item.
  return remove(typeof file === 'string' ? file : file.uid)
}

function clear() {
  // Abort background work and release selection/preview resources before emptying the model.
  clearUploads()
  clearPreviews()
  clearSelection()
  clearDownloads()
  updateFiles([])
}

async function resolveData() {
  // Data may be static or async so callers can attach fresh credentials/metadata per request.
  return typeof props.data === 'function' ? await props.data() : (props.data ?? {})
}

async function resolveHeaders() {
  // Resolve lazily for the same reason as request data, without exposing mutable caller objects.
  return typeof props.headers === 'function' ? await props.headers() : (props.headers ?? {})
}

function statusText(status: UploadFileItem['status']) {
  // Centralize status-to-copy mapping so list rows and custom slots use identical language.
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

function isFileDrag(event: DragEvent) {
  // Ignore text/URL drags; only file payloads should activate the upload drop zone.
  const transfer = event.dataTransfer
  return !!transfer && (transfer.files.length > 0 || Array.from(transfer.types).includes('Files'))
}

function onDragEnter(event: DragEvent) {
  // Prevent browser navigation and show the active drop affordance for file drags.
  if (!props.drag || !canSelect.value || !isFileDrag(event)) return
  event.preventDefault()
  dragActive.value = true
}

function onDragOver(event: DragEvent) {
  // Repeating preventDefault is required for browsers to permit a subsequent drop.
  if (!props.drag || !canSelect.value || !isFileDrag(event)) return
  event.preventDefault()
}

function onDragLeave(event: DragEvent) {
  // Reset only when leaving the component, not when moving between its children.
  if (!props.drag || !dragActive.value) return
  const container = event.currentTarget as HTMLElement | null
  const nextTarget = event.relatedTarget as Node | null
  if (!nextTarget || !container?.contains(nextTarget)) dragActive.value = false
}

function onDrop(event: DragEvent) {
  // Read dropped files once, clear visual state, and route them through normal validation.
  if (!props.drag || !canSelect.value || !isFileDrag(event)) return
  event.preventDefault()
  dragActive.value = false
  const dropped = Array.from(event.dataTransfer?.files ?? [])
  void addFiles(dropped)
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
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <UploadTrigger
      ref="uploadTrigger"
      :directory="directory"
      :multiple="multiple"
      :accept="accept"
      :can-select="canSelect"
      @files="handleSelectedFiles"
    />
    <slot name="tip" />

    <div v-if="showOperation" class="vfu-upload__operation">
      <UploadToolbars
        :files="files"
        :selectable="selectable"
        :selected="selected"
        :selectable-count="selectableFiles.length"
        :all-selected="allSelectableFilesSelected"
        :can-select="canSelect"
        :can-remove="canRemove"
        :can-download-all="canDownloadAll"
        :drag="drag"
        :accept="accept"
        :max-size="maxSize"
        :text="text"
        :auto-upload="autoUpload"
        :can-upload="canUpload"
        @select="uploadTrigger?.browse()"
        @upload="handleUpload"
        @toggle-all="toggleAllSelected"
        @download-selected="handleDownloadSelected"
        @download-all="downloadAll"
        @remove-selected="removeSelected"
      />
    </div>

    <div class="vfu-upload__display" :aria-busy="loading || undefined">
      <UploadPictureWall
        v-if="listType === 'picture' || listType === 'picture-card'"
        :files="displayedFiles"
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
      </UploadPictureWall>
      <UploadFileList
        v-else
        :files="displayedFiles"
        :show="showFileList"
        list-type="list"
        :selectable="selectable"
        :selected="selected"
        :can-upload="canUpload"
        :can-retry="canRetry"
        :can-preview="canPreview"
        :can-download="canDownload"
        :can-remove="canRemove"
        :text="text"
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
      <div v-if="loading" class="vfu-upload__loading-mask" role="status" aria-live="polite">
        <img :src="loadingSvg" alt="" aria-hidden="true" />
      </div>
    </div>
    <UploadFooter
      :visible="showFileList && displayedFiles.length > 0 && (showFooter || !!pagination)"
      :count="displayedFiles.length"
      :t="t"
      :pagination="pagination"
    />

    <UploadRemoveDialog
      :files="pendingRemoval"
      :busy="removalBusy"
      :error="removalError"
      :title="text.removeConfirmTitle"
      :message="text.removeConfirmMessage"
      :cancel-text="text.cancel"
      :confirm-text="text.remove"
      :processing-text="text.removeConfirmProcessing"
      @cancel="closeRemovalConfirmation"
      @confirm="confirmRemoval"
    />

    <div v-if="drag && dragActive" class="vfu-upload__drop-mask" aria-live="polite">
      <span class="vfu-upload__drop-message">{{ text.dropToUpload }}</span>
    </div>
    <div v-if="toastMessage" class="vfu-upload__toast" role="status" aria-live="polite">
      {{ toastMessage }}
    </div>
  </section>
</template>

<style lang="scss">
@use './styles/flow-upload.scss';
</style>
