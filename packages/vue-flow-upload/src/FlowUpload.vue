<script setup lang="ts">
/* eslint-disable vue/require-default-prop -- omitted values are semantically distinct in the public API */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChunkScheduler } from './chunk-scheduler'
import { hashFile } from './hash-service'
import { resolveMessages, resolveTheme } from './themes'
import { createHttpUploadTransport } from './http-transport'
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
    locale?: string
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

const input = ref<HTMLInputElement>()
const dragActive = ref(false)
const internalFiles = ref<UploadFileItem[]>(
  normalizeFileList(props.modelValue ?? props.defaultFileList),
)
const controllers = new Map<string, Set<AbortController>>()
const objectUrls = new Map<string, string>()
const selected = ref(new Set<string>())
const previewing = ref<UploadFileItem>()
const archiveControllers = new Map<string, AbortController>()
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
const acceptValue = computed(() =>
  Array.isArray(props.accept) ? props.accept.join(',') : props.accept,
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
const selectableFiles = computed(() => files.value.filter((file) => file.fileId))
const allSelectableFilesSelected = computed(
  () =>
    selectableFiles.value.length > 0 &&
    selectableFiles.value.every((file) => selected.value.has(file.uid)),
)
const resolvedTheme = computed(() => resolveTheme(props.theme))
const text = computed(() => resolveMessages(props.locale, props.messages))
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

function browse() {
  if (canSelect.value) input.value?.click()
}

function onSelect(event: Event) {
  void addFiles(Array.from((event.target as HTMLInputElement).files ?? []))
  if (input.value) input.value.value = ''
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragActive.value = false
  if (!canSelect.value) return
  void addFiles(Array.from(event.dataTransfer?.files ?? []))
}

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
    return makeError('FILE_TOO_LARGE', `“${file.name}”超过允许的文件大小`, false)
  }
  if (!matchesAccept(file, props.accept)) {
    return makeError('FILE_TYPE_NOT_ALLOWED', `“${file.name}”不是允许的文件类型`, false)
  }
  if (props.beforeUpload && !(await props.beforeUpload(file))) {
    return makeError('BEFORE_UPLOAD_REJECTED', `“${file.name}”被上传前校验拒绝`, false)
  }
}

async function upload(uid: string) {
  if (!canUpload.value) return
  const target = files.value.find((file) => file.uid === uid)
  if (!target?.file || target.status === 'uploading') return

  const uploading = updateFile(uid, { status: 'queued', percent: 0, error: undefined })
  if (!uploading) return

  try {
    const transport = requireTransport()
    const data = await resolveData()
    const isMultipart = target.file.size > props.normalUploadThreshold
    const needsHash =
      (props.instantUpload && !!transport.checkFile) || (isMultipart && props.resume)
    let sha256: string | undefined
    if (needsHash) {
      const controller = trackController(uid)
      updateFile(uid, { status: 'hashing' })
      try {
        sha256 = await hashFile(target.file, {
          signal: controller.signal,
          onProgress: (loaded, total) => updateProgress(uid, loaded, total),
        })
      } finally {
        untrackController(uid, controller)
      }
      updateFile(uid, { sha256, percent: 0 })
    }
    if (sha256 && props.instantUpload && transport.checkFile) {
      updateFile(uid, { status: 'checking' })
      const check = await transport.checkFile(
        fileMeta(target.file, sha256),
        requestMeta(data, await resolveHeaders()),
      )
      if (check.exists) {
        if (!check.file) throw makeError('INVALID_RESPONSE', '秒传响应缺少文件信息', false)
        finishSuccess(uid, check.file)
        return
      }
    }
    ensureTaskActive(uid)
    const response = !isMultipart
      ? await uploadNormal(uid, target.file, data)
      : await uploadMultipart(uid, target.file, data, sha256)
    finishSuccess(uid, response)
  } catch (cause) {
    if (isAbort(cause)) return
    const error = normalizeError(cause)
    const failed = updateFile(uid, { status: 'failed', error })
    if (failed) emit('error', failed, error)
  } finally {
    controllers.delete(uid)
  }
}

function finishSuccess(uid: string, response: UploadSuccessResult) {
  const success = updateFile(uid, {
    status: 'success',
    percent: 100,
    fileId: response.fileId,
    url: response.url,
    thumbnailUrl: response.thumbnailUrl,
    response,
  })
  if (success) {
    emit('progress', success, 100)
    emit('success', success, response)
  }
}

async function uploadNormal(uid: string, file: File, data: Record<string, unknown>) {
  return scheduler.schedule(uid, async () => {
    const controller = trackController(uid)
    const current = updateFile(uid, { status: 'uploading' })
    if (current) emit('progress', current, 0)
    try {
      return await requireTransport().uploadFile(
        { file, data },
        requestContext(data, await resolveHeaders(), controller, (loaded, total) =>
          updateProgress(uid, loaded, total),
        ),
      )
    } finally {
      untrackController(uid, controller)
    }
  })
}

async function uploadMultipart(
  uid: string,
  file: File,
  data: Record<string, unknown>,
  sha256?: string,
) {
  const { initMultipart, uploadChunk, completeMultipart } = requireTransport()
  if (!initMultipart || !uploadChunk || !completeMultipart) {
    throw makeError('MULTIPART_NOT_SUPPORTED', '当前传输适配器不支持分片上传', false)
  }
  const chunkSize = Math.max(1, props.chunkSize)
  const totalChunks = Math.ceil(file.size / chunkSize)
  updateFile(uid, { status: 'preparing' })
  const session = await initMultipart(
    { ...fileMeta(file, sha256), chunkSize, totalChunks, data },
    requestMeta(data, await resolveHeaders()),
  )
  ensureTaskActive(uid)
  updateFile(uid, { uploadId: session.uploadId, status: 'queued' })
  const completed = new Set(session.uploadedChunks ?? [])
  const progress = Array.from({ length: totalChunks }, (_, index) =>
    completed.has(index) ? Math.min(chunkSize, file.size - index * chunkSize) : 0,
  )
  const missing = Array.from({ length: totalChunks }, (_, index) => index).filter(
    (index) => !completed.has(index),
  )
  await Promise.all(
    missing.map((index) =>
      scheduler.schedule(uid, async () => {
        const controller = trackController(uid)
        updateFile(uid, { status: 'uploading' })
        const start = index * chunkSize
        const chunk = file.slice(start, Math.min(start + chunkSize, file.size))
        try {
          await retryOperation(async () => {
            const dynamicHeaders = await resolveHeaders()
            return uploadChunk(
              {
                uploadId: session.uploadId,
                chunkIndex: index,
                totalChunks,
                chunk,
                chunkSize,
                file: fileMeta(file, sha256),
              },
              requestContext(data, dynamicHeaders, controller, (loaded) => {
                progress[index] = Math.min(chunk.size, loaded)
                updateProgress(
                  uid,
                  progress.reduce((sum, value) => sum + value, 0),
                  file.size,
                )
              }),
            )
          })
          progress[index] = chunk.size
          updateProgress(
            uid,
            progress.reduce((sum, value) => sum + value, 0),
            file.size,
          )
        } finally {
          untrackController(uid, controller)
        }
      }),
    ),
  )
  updateFile(uid, { status: 'merging', percent: 99 })
  return completeMultipart(
    session.uploadId,
    { sha256, data },
    requestMeta(data, await resolveHeaders()),
  )
}

function requestContext(
  data: Record<string, unknown>,
  headers: Record<string, string>,
  controller: AbortController,
  onProgress: (loaded: number, total: number) => void,
) {
  return {
    data,
    headers,
    fileFieldName: props.fileFieldName,
    dataFieldName: props.dataFieldName,
    signal: controller.signal,
    onProgress,
  }
}

function updateProgress(uid: string, loaded: number, total: number) {
  const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0
  const current = updateFile(uid, { percent })
  if (current) emit('progress', current, percent)
}

function trackController(uid: string) {
  const controller = new AbortController()
  const current = controllers.get(uid) ?? new Set<AbortController>()
  current.add(controller)
  controllers.set(uid, current)
  return controller
}

function untrackController(uid: string, controller: AbortController) {
  const current = controllers.get(uid)
  current?.delete(controller)
  if (!current?.size) controllers.delete(uid)
}

async function retryOperation<T>(operation: () => Promise<T>) {
  let attempt = 0
  while (true) {
    try {
      return await operation()
    } catch (cause) {
      const error = normalizeError(cause)
      if (!error.retriable || attempt >= props.retryCount || isAbort(cause)) throw cause
      await new Promise((resolve) =>
        window.setTimeout(resolve, props.retryBaseDelay * 2 ** attempt),
      )
      attempt += 1
    }
  }
}

function requestMeta(data: Record<string, unknown>, headers: Record<string, string>) {
  return { data, headers, fileFieldName: props.fileFieldName, dataFieldName: props.dataFieldName }
}

function ensureTaskActive(uid: string) {
  const status = files.value.find((file) => file.uid === uid)?.status
  if (!status || status === 'paused') throw makeError('ABORTED', '上传已取消', false)
}

function fileMeta(file: File, sha256?: string) {
  return {
    name: file.name,
    size: file.size,
    mimeType: file.type,
    lastModified: file.lastModified,
    sha256,
  }
}

function isAbort(cause: unknown) {
  const error = cause as { code?: string; name?: string }
  return error?.name === 'AbortError' || error?.code === 'ABORTED'
}

async function submit() {
  await Promise.all(
    files.value.filter((file) => file.status === 'idle').map((file) => upload(file.uid)),
  )
}

function retry(uid: string) {
  return upload(uid)
}

function pause(uid: string) {
  const target = files.value.find((file) => file.uid === uid)
  if (
    !target ||
    !['hashing', 'checking', 'queued', 'uploading', 'preparing'].includes(target.status)
  )
    return
  scheduler.cancel(uid)
  controllers.get(uid)?.forEach((controller) => controller.abort())
  updateFile(uid, { status: 'paused' })
}

function resumeUpload(uid: string) {
  const target = files.value.find((file) => file.uid === uid)
  if (target?.status === 'paused') return upload(uid)
}

function toggleSelected(uid: string) {
  const next = new Set(selected.value)
  if (next.has(uid)) next.delete(uid)
  else next.add(uid)
  selected.value = next
}

function toggleAllSelected() {
  selected.value = allSelectableFilesSelected.value
    ? new Set()
    : new Set(selectableFiles.value.map((file) => file.uid))
}

async function removeSelected() {
  await Promise.all([...selected.value].map((uid) => remove(uid)))
}

async function previewFile(file: UploadFileItem) {
  if (!canPreview.value) return
  if (!isImage(file)) {
    await props.onPreview?.(file)
    return
  }
  if (props.onPreview) await props.onPreview(file)
  else previewing.value = file
}

async function download(uid: string) {
  const file = files.value.find((item) => item.uid === uid)
  if (!file?.fileId || !props.downloadTransport || !canDownload.value) return
  emit('download-start', file)
  try {
    const resource = await props.downloadTransport.downloadFile(
      { fileId: file.fileId, fileName: file.name },
      requestMeta(await resolveData(), await resolveHeaders()),
    )
    triggerDownload(resource.url, resource.blob, resource.fileName ?? file.name)
    emit('download-success', file)
  } catch (cause) {
    const error = normalizeError(cause)
    emit('download-error', file, error)
    emit('error', file, error)
  }
}

async function downloadSelected(uids: string[]) {
  const fileIds = successfulFileIds(uids)
  if (fileIds.length) await createArchive({ fileIds })
}

async function downloadAll(scope = props.allDownloadScope) {
  if (!canDownloadAll.value) return
  if (scope?.type === 'server-query') await createArchive({ scope })
  else
    await createArchive({
      fileIds: scope?.fileIds ?? successfulFileIds(files.value.map((file) => file.uid)),
    })
}

async function createArchive(input: { fileIds?: string[]; scope?: DownloadScope }) {
  if (!props.downloadTransport || !canDownloadAll.value) return
  try {
    const task = await props.downloadTransport.createArchive(
      input,
      requestMeta(await resolveData(), await resolveHeaders()),
    )
    const ids = input.fileIds ?? (input.scope?.type === 'file-ids' ? input.scope.fileIds : [])
    emit('archive-start', task.taskId, ids)
    await followArchive(task)
  } catch (cause) {
    const error = normalizeError(cause)
    emit('archive-error', '', error)
  }
}

async function followArchive(initialTask: import('./types').ArchiveTask) {
  if (!props.downloadTransport) return
  const controller = new AbortController()
  archiveControllers.set(initialTask.taskId, controller)
  const deadline = Date.now() + props.archivePollingTimeout
  let task = initialTask
  try {
    while (task.status === 'pending' || task.status === 'processing') {
      emit('archive-progress', task.taskId, task.progress)
      if (Date.now() >= deadline) throw makeError('ARCHIVE_TIMEOUT', '打包下载任务超时', true)
      await delay(props.archivePollingInterval, controller.signal)
      task = await props.downloadTransport.getArchiveTask(
        task.taskId,
        requestMeta(await resolveData(), await resolveHeaders()),
      )
    }
    if (task.status === 'success' && task.downloadUrl) {
      triggerDownload(task.downloadUrl, undefined, task.fileName ?? 'download.zip')
      emit('archive-success', task.taskId)
    } else if (task.status !== 'canceled') {
      throw makeError('ARCHIVE_FAILED', task.errorMessage ?? '打包下载失败', false)
    }
  } catch (cause) {
    if (!isAbort(cause)) emit('archive-error', initialTask.taskId, normalizeError(cause))
  } finally {
    archiveControllers.delete(initialTask.taskId)
  }
}

async function cancelArchive(taskId: string) {
  archiveControllers.get(taskId)?.abort()
  if (props.downloadTransport?.cancelArchive) {
    await props.downloadTransport.cancelArchive(
      taskId,
      requestMeta(await resolveData(), await resolveHeaders()),
    )
  }
}

function successfulFileIds(uids: string[]) {
  return files.value
    .filter((file) => uids.includes(file.uid) && file.status === 'success' && file.fileId)
    .map((file) => file.fileId!)
}

function imageUrl(file: UploadFileItem) {
  if (file.thumbnailUrl || file.url) return file.thumbnailUrl ?? file.url
  if (!file.file || !isImage(file)) return undefined
  const existing = objectUrls.get(file.uid)
  if (existing) return existing
  const url = window.URL.createObjectURL(file.file)
  objectUrls.set(file.uid, url)
  return url
}

function isImage(file: UploadFileItem) {
  return file.type.startsWith('image/')
}

function triggerDownload(url?: string, blob?: globalThis.Blob, fileName = 'download') {
  const objectUrl = blob ? window.URL.createObjectURL(blob) : url
  if (!objectUrl) throw makeError('INVALID_DOWNLOAD', '下载资源为空', false)
  const anchor = window.document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.style.display = 'none'
  window.document.body.append(anchor)
  anchor.click()
  anchor.remove()
  if (blob) window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0)
}

function delay(milliseconds: number, signal: globalThis.AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(makeError('ABORTED', '下载任务已取消', false))
      },
      { once: true },
    )
  })
}

async function remove(uid: string) {
  const target = files.value.find((file) => file.uid === uid)
  if (!target || !canRemove.value) return false
  try {
    if (props.beforeRemove && !(await props.beforeRemove(target, files.value))) return false
  } catch {
    return false
  }
  const objectUrl = objectUrls.get(uid)
  if (objectUrl) window.URL.revokeObjectURL(objectUrl)
  objectUrls.delete(uid)
  selected.value.delete(uid)
  scheduler.cancel(uid)
  controllers.get(uid)?.forEach((controller) => controller.abort())
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

function abort(file?: string | UploadFileItem) {
  if (file) {
    const uid = typeof file === 'string' ? file : file.uid
    pause(uid)
    return
  }
  for (const file of files.value) pause(file.uid)
}

function handleStart(file: File) {
  return addFiles([file])
}

function handleRemove(file: string | UploadFileItem) {
  return remove(typeof file === 'string' ? file : file.uid)
}

function clear() {
  for (const [uid, group] of controllers) {
    scheduler.cancel(uid)
    group.forEach((controller) => controller.abort())
  }
  controllers.clear()
  for (const url of objectUrls.values()) window.URL.revokeObjectURL(url)
  objectUrls.clear()
  selected.value = new Set()
  for (const controller of archiveControllers.values()) controller.abort()
  archiveControllers.clear()
  updateFiles([])
}

function requireTransport() {
  const transport = uploadTransport.value
  if (!transport) throw makeError('TRANSPORT_REQUIRED', '请提供 transport 或 action', false)
  return transport
}

function normalizeFileList(fileList: UploadUserFile[]): UploadFileItem[] {
  return fileList.map((file) => {
    const status = file.status ?? (file.file ? 'idle' : 'success')
    return {
      ...file,
      uid: file.uid ?? createUid(),
      name: file.name,
      size: file.size ?? file.file?.size ?? 0,
      type: file.type ?? file.file?.type ?? '',
      status,
      percent: file.percent ?? (status === 'success' ? 100 : 0),
    }
  })
}

async function resolveData() {
  return typeof props.data === 'function' ? await props.data() : (props.data ?? {})
}

async function resolveHeaders() {
  return typeof props.headers === 'function' ? await props.headers() : (props.headers ?? {})
}

function matchesAccept(file: File, accept?: string | string[]) {
  if (!accept) return true
  const tokens = (Array.isArray(accept) ? accept : accept.split(',')).map((token) =>
    token.trim().toLowerCase(),
  )
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token)
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
    return type === token
  })
}

function createUid() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function makeError(code: string, message: string, retriable: boolean): UploadError {
  return { code, message, retriable }
}

function normalizeError(cause: unknown): UploadError {
  if (typeof cause === 'object' && cause && 'code' in cause && 'message' in cause) {
    const error = cause as UploadError
    return { ...error, retriable: error.retriable ?? false }
  }
  return makeError('UPLOAD_FAILED', cause instanceof Error ? cause.message : '上传失败', false)
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function fileTypeLabel(file: UploadFileItem) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'PDF'
  if (file.type.startsWith('image/')) return file.type.slice(6, 9).toUpperCase()
  const extension = file.name.split('.').pop()
  return extension ? extension.slice(0, 3).toUpperCase() : 'FILE'
}

function toCssSize(value: string | number) {
  return typeof value === 'number' ? `${value}px` : value
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
    canceled: '已取消',
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
    <div
      v-if="drag"
      class="vfu-dropzone"
      :class="{ 'is-active': dragActive, 'is-disabled': !canSelect }"
      role="button"
      tabindex="0"
      @click="browse"
      @keydown.enter.prevent="browse"
      @keydown.space.prevent="browse"
      @dragenter.prevent="dragActive = true"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop="onDrop"
    >
      <input
        ref="input"
        type="file"
        :accept="acceptValue"
        :multiple="multiple"
        :disabled="!canSelect"
        :webkitdirectory="directory || undefined"
        :directory="directory || undefined"
        @change="onSelect"
      />
      <slot>
        <span class="vfu-dropzone__mark" aria-hidden="true">⌃</span>
        <strong>{{ text.selectFile }}</strong>
        <span>{{ text.dragHint }}</span>
      </slot>
    </div>

    <div
      v-else
      class="vfu-trigger"
      role="button"
      tabindex="0"
      @click="browse"
      @keydown.enter.prevent="browse"
      @keydown.space.prevent="browse"
    >
      <input
        ref="input"
        type="file"
        :accept="acceptValue"
        :multiple="multiple"
        :disabled="!canSelect"
        :webkitdirectory="directory || undefined"
        :directory="directory || undefined"
        @change="onSelect"
      />
      <slot name="trigger">
        <slot>
          <button class="vfu-button" type="button" :disabled="!canSelect">
            {{ text.selectFile }}
          </button>
        </slot>
      </slot>
    </div>
    <slot name="tip" />

    <div v-if="!autoUpload && files.some((file) => file.status === 'idle')" class="vfu-toolbar">
      <span>{{ files.filter((file) => file.status === 'idle').length }} 个文件等待上传</span>
      <button class="vfu-button" type="button" :disabled="!canUpload" @click="submit">
        {{ text.startUpload }}
      </button>
    </div>

    <div
      v-if="selectable || (canDownloadAll && files.some((file) => file.fileId))"
      class="vfu-toolbar"
    >
      <span class="vfu-toolbar__selection">
        <label v-if="selectable && selectableFiles.length" class="vfu-select vfu-select--all">
          <input
            :checked="allSelectableFilesSelected"
            type="checkbox"
            @change="toggleAllSelected"
          />
          <span>全选</span>
        </label>
        <span v-else>文件操作</span>
        <span v-if="selectable && selected.size" class="vfu-toolbar__count"
          >已选 {{ selected.size }} 项</span
        >
      </span>
      <span class="vfu-toolbar__actions">
        <button
          v-if="selectable && canDownloadAll && selected.size"
          class="vfu-button"
          type="button"
          @click="downloadSelected([...selected])"
        >
          {{ text.downloadSelected }}
        </button>
        <button v-if="canDownloadAll" class="vfu-button" type="button" @click="downloadAll()">
          {{ text.downloadAll }}
        </button>
        <button
          v-if="selectable && selected.size && canRemove"
          class="vfu-button is-danger"
          type="button"
          @click="removeSelected"
        >
          删除
        </button>
      </span>
    </div>

    <ul
      v-if="showFileList && files.length"
      class="vfu-list"
      :class="{ 'is-picture-card': listType === 'picture-card' }"
      aria-live="polite"
    >
      <li v-for="file in files" :key="file.uid" class="vfu-file" :class="`is-${file.status}`">
        <slot
          name="file"
          :file="file"
          :remove="remove"
          :preview="previewFile"
          :download="download"
          :pause="pause"
          :resume="resumeUpload"
          :retry="retry"
        >
          <label v-if="selectable && file.fileId" class="vfu-select" @click.stop>
            <input
              :checked="selected.has(file.uid)"
              type="checkbox"
              @change="toggleSelected(file.uid)"
            />
          </label>
          <button
            v-if="listType !== 'list' && isImage(file)"
            class="vfu-thumbnail"
            type="button"
            :disabled="!canPreview"
            @click="previewFile(file)"
          >
            <img :src="imageUrl(file)" :alt="file.name" />
          </button>
          <span class="vfu-file__glyph">{{ fileTypeLabel(file) }}</span>
          <div class="vfu-file__body">
            <div class="vfu-file__headline">
              <strong>{{ file.name }}</strong
              ><span>{{ formatSize(file.size) }}</span>
            </div>
            <div
              v-if="['uploading', 'queued', 'merging'].includes(file.status)"
              class="vfu-progress"
              role="progressbar"
              :aria-label="`${file.name} ${file.percent}%`"
              :aria-valuenow="file.percent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <i :style="{ width: `${file.percent}%` }" />
            </div>
            <small
              :class="{ 'is-error': file.status === 'failed' || file.status === 'rejected' }"
              >{{ file.error?.message ?? statusText(file.status) }}</small
            >
          </div>
          <span
            v-if="['uploading', 'queued', 'merging'].includes(file.status)"
            class="vfu-file__percent"
            >{{ file.percent }}%</span
          >
          <button
            v-if="
              ['hashing', 'checking', 'queued', 'uploading', 'preparing'].includes(file.status) &&
              canUpload
            "
            class="vfu-action"
            type="button"
            @click="pause(file.uid)"
          >
            {{ text.pause }}
          </button>
          <button
            v-if="file.status === 'paused' && canUpload"
            class="vfu-action"
            type="button"
            @click="resumeUpload(file.uid)"
          >
            {{ text.resume }}
          </button>
          <button
            v-if="file.status === 'failed' && canRetry"
            class="vfu-action"
            type="button"
            @click="retry(file.uid)"
          >
            {{ text.retry }}
          </button>
          <button
            v-if="file.status === 'success' && canPreview"
            class="vfu-action"
            type="button"
            @click="previewFile(file)"
          >
            {{ text.preview }}
          </button>
          <button
            v-if="file.status === 'success' && file.fileId && canDownload"
            class="vfu-action"
            type="button"
            @click="download(file.uid)"
          >
            {{ text.download }}
          </button>
          <button
            v-if="canRemove"
            class="vfu-action is-danger"
            type="button"
            @click="remove(file.uid)"
          >
            {{ text.remove }}
          </button>
        </slot>
      </li>
    </ul>
    <footer v-if="showFileList && files.length && listType === 'list'" class="vfu-list-footer">
      共 {{ files.length }} 个文件
    </footer>
    <div
      v-if="previewing"
      class="vfu-preview"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      @keydown.esc="previewing = undefined"
      @click.self="previewing = undefined"
    >
      <button
        class="vfu-preview__close"
        type="button"
        :aria-label="text.closePreview"
        @click="previewing = undefined"
      >
        ×
      </button>
      <img :src="imageUrl(previewing)" :alt="previewing.name" />
    </div>
  </section>
</template>

<style lang="scss">
.vfu-upload {
  --vfu-ink: #202938;
  --vfu-muted: #748094;
  --vfu-line: #d9dee7;
  --vfu-signal: #2f6bff;
  --vfu-danger: #e85757;
  --vfu-radius: 6px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  color: var(--vfu-ink);
  text-align: left;
  font:
    14px/1.45 Inter,
    ui-sans-serif,
    system-ui,
    sans-serif;
}
.vfu-dropzone {
  display: grid;
  flex: 1 1 auto;
  place-items: center;
  gap: 5px;
  min-height: 0;
  padding: 24px;
  border: 1px dashed #d9ecff;
  border-radius: var(--vfu-radius);
  background: #fbfdff;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.2s,
    background 0.2s;
}
.vfu-dropzone:hover,
.vfu-dropzone.is-active {
  border-color: var(--vfu-signal);
  background: #f0f9ff;
}
.vfu-dropzone.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.vfu-dropzone input {
  display: none;
}
.vfu-trigger {
  display: inline-flex;
  align-items: center;
  margin-bottom: 12px;
}
.vfu-trigger input {
  display: none;
}
.vfu-trigger:focus-visible,
.vfu-dropzone:focus-visible {
  outline: 2px solid var(--vfu-signal);
  outline-offset: 3px;
}
.vfu-dropzone strong {
  font-size: 15px;
  font-weight: 400;
}
.vfu-dropzone > span:last-child {
  color: var(--vfu-muted);
  font-size: 12px;
}
.vfu-dropzone__mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: #c0c4cc;
  font-size: 42px;
  font-weight: 200;
  line-height: 1;
}
.vfu-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 50px;
  margin: 0;
  padding: 0 16px;
  border: 1px solid var(--vfu-line);
  border-bottom: 0;
  background: #fff;
  color: var(--vfu-muted);
  font-size: 12px;
}
.vfu-toolbar + .vfu-toolbar {
  border-top: 1px solid var(--vfu-line);
}
.vfu-toolbar__selection {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.vfu-toolbar__count {
  color: var(--vfu-muted);
}
.vfu-toolbar__actions {
  display: inline-flex;
  gap: 8px;
}
.vfu-button {
  border: 1px solid var(--vfu-signal);
  border-radius: var(--vfu-radius);
  padding: 8px 11px;
  background: var(--vfu-signal);
  color: white;
  cursor: pointer;
  font: inherit;
  font-weight: 400;
  line-height: 1;
  transition: background-color 0.2s;
}
.vfu-button:hover:not(:disabled) {
  border-color: #5e8cff;
  background: #5e8cff;
}
.vfu-button.is-danger {
  border-color: #fff2f2;
  background: #fff2f2;
  color: var(--vfu-danger);
}
.vfu-button.is-danger:hover:not(:disabled) {
  border-color: #ffdada;
  background: #ffe6e6;
}
.vfu-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.vfu-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  border: 1px solid var(--vfu-line);
  list-style: none;
}
.vfu-file {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 52px;
  padding: 8px 16px;
  border: 0;
  border-bottom: 1px solid #edf0f4;
  border-radius: 0;
  background: white;
  transition: background-color 0.2s;
}
.vfu-file:hover {
  background: #f8faff;
}
.vfu-file:last-child {
  border-bottom: 0;
}
.vfu-list.is-picture-card {
  grid-template-columns: repeat(auto-fill, minmax(164px, 1fr));
}
.vfu-list.is-picture-card .vfu-file {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 7px;
  min-height: 152px;
  border-color: var(--vfu-line);
}
.vfu-list.is-picture-card .vfu-file__glyph {
  display: none;
}
.vfu-list.is-picture-card .vfu-file__headline {
  display: block;
}
.vfu-list.is-picture-card .vfu-file__headline span {
  display: block;
}
.vfu-select {
  z-index: 1;
  align-self: start;
}
.vfu-select--all {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  align-self: center;
  color: var(--vfu-ink);
  cursor: pointer;
}
.vfu-select input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--vfu-signal);
}
.vfu-list.is-picture-card .vfu-select {
  position: absolute;
  top: 9px;
  left: 9px;
}
.vfu-thumbnail {
  width: 100%;
  height: 104px;
  overflow: hidden;
  border: 0;
  border-radius: 2px;
  padding: 0;
  background: #f5f7fa;
  cursor: zoom-in;
}
.vfu-thumbnail:disabled {
  cursor: default;
}
.vfu-thumbnail:focus-visible,
.vfu-preview__close:focus-visible {
  outline: 2px solid currentcolor;
  outline-offset: 3px;
}
.vfu-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.vfu-file.is-success {
  border-color: transparent;
}
.vfu-file.is-failed,
.vfu-file.is-rejected {
  border-color: #fbc4c4;
}
.vfu-file__glyph {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 4px;
  background: #eef3ff;
  color: #2f6bff;
  font-size: 8px;
  font-weight: 700;
}
.vfu-file__body {
  min-width: 0;
  flex: 1;
}
.vfu-file__headline {
  display: flex;
  gap: 9px;
  align-items: baseline;
}
.vfu-file__headline strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vfu-file__headline span,
.vfu-file__body small {
  color: var(--vfu-muted);
  font-size: 12px;
}
.vfu-file__body small.is-error {
  color: var(--vfu-danger);
}
.vfu-progress {
  height: 4px;
  overflow: hidden;
  margin: 6px 0 3px;
  border-radius: 99px;
  background: #ebeef5;
}
.vfu-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--vfu-signal);
  transition: width 0.22s ease;
}
.vfu-file__percent {
  color: var(--vfu-signal);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.vfu-action {
  border: 0;
  padding: 4px 5px;
  background: transparent;
  color: var(--vfu-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.vfu-action.is-danger {
  color: var(--vfu-muted);
}
.vfu-action:hover:not(:disabled) {
  color: var(--vfu-signal);
}
.vfu-action.is-danger:hover:not(:disabled) {
  color: var(--vfu-danger);
}
.vfu-list-footer {
  display: flex;
  align-items: center;
  min-height: 46px;
  padding: 0 16px;
  border: 1px solid var(--vfu-line);
  border-top: 0;
  background: #fff;
  color: var(--vfu-muted);
  font-size: 11px;
}
.vfu-preview {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 32px;
  background: rgb(9 14 27 / 80%);
}
.vfu-preview img {
  max-width: min(100%, 1080px);
  max-height: calc(100vh - 64px);
  border-radius: 8px;
  object-fit: contain;
}
.vfu-preview__close {
  position: absolute;
  top: 18px;
  right: 22px;
  border: 0;
  background: transparent;
  color: white;
  cursor: pointer;
  font-size: 32px;
}
.vfu-theme-element-plus .vfu-button {
  border-radius: var(--vfu-radius);
  font-weight: 500;
}
.vfu-theme-ant-design-vue .vfu-button {
  border-radius: var(--vfu-radius);
  font-weight: 400;
}
.vfu-dropzone:focus-visible,
.vfu-button:focus-visible,
.vfu-action:focus-visible {
  outline: 2px solid var(--vfu-signal);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .vfu-dropzone,
  .vfu-progress i {
    transition: none;
  }
}
@media (max-width: 560px) {
  .vfu-toolbar {
    min-height: 0;
    flex-wrap: wrap;
    padding: 10px 12px;
  }
  .vfu-toolbar__actions {
    width: 100%;
    justify-content: flex-end;
  }
  .vfu-file {
    gap: 8px;
    padding: 8px 12px;
  }
  .vfu-file__headline {
    align-items: flex-start;
    flex-direction: column;
    gap: 0;
  }
  .vfu-file__body small {
    display: none;
  }
  .vfu-action {
    padding: 4px 2px;
    font-size: 11px;
  }
}
</style>
