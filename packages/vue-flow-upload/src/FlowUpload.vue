<script setup lang="ts">
/* eslint-disable vue/require-default-prop -- omitted values are semantically distinct in the public API */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type {
  UploadData,
  UploadError,
  UploadFileItem,
  UploadHeaders,
  UploadPermissions,
  UploadSuccessResult,
  UploadTransport,
} from './types'

const props = withDefaults(
  defineProps<{
    modelValue?: UploadFileItem[]
    defaultFileList?: UploadFileItem[]
    transport: UploadTransport
    data?: UploadData
    headers?: UploadHeaders
    fileFieldName?: string
    dataFieldName?: string
    accept?: string | string[]
    maxSize?: number
    maxCount?: number
    multiple?: boolean
    autoUpload?: boolean
    disabled?: boolean
    permissions?: UploadPermissions
    beforeUpload?: (file: File) => boolean | Promise<boolean>
  }>(),
  {
    defaultFileList: () => [],
    fileFieldName: 'file',
    dataFieldName: 'data',
    maxCount: Number.POSITIVE_INFINITY,
    multiple: true,
    autoUpload: true,
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
}>()

const input = ref<HTMLInputElement>()
const dragActive = ref(false)
const internalFiles = ref<UploadFileItem[]>([...(props.modelValue ?? props.defaultFileList)])
const controllers = new Map<string, AbortController>()

watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined) internalFiles.value = [...value]
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

  const controller = new AbortController()
  controllers.set(uid, controller)
  const uploading = updateFile(uid, { status: 'uploading', percent: 0, error: undefined })
  if (!uploading) return

  try {
    const [data, headers] = await Promise.all([resolveData(), resolveHeaders()])
    if (controller.signal.aborted) return
    const response = await props.transport.uploadFile(
      { file: target.file, data },
      {
        data,
        headers,
        fileFieldName: props.fileFieldName,
        dataFieldName: props.dataFieldName,
        signal: controller.signal,
        onProgress: (loaded, total) => {
          const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0
          const current = updateFile(uid, { percent })
          if (current) emit('progress', current, percent)
        },
      },
    )
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
  } catch (cause) {
    const error = normalizeError(cause)
    const failed = updateFile(uid, { status: 'failed', error })
    if (failed) emit('error', failed, error)
  } finally {
    controllers.delete(uid)
  }
}

async function submit() {
  await Promise.all(
    files.value.filter((file) => file.status === 'idle').map((file) => upload(file.uid)),
  )
}

function retry(uid: string) {
  return upload(uid)
}

function remove(uid: string) {
  const target = files.value.find((file) => file.uid === uid)
  if (!target || !canRemove.value) return
  controllers.get(uid)?.abort()
  updateFiles(
    files.value.filter((file) => file.uid !== uid),
    target,
  )
  emit('remove', target)
}

function clear() {
  for (const controller of controllers.values()) controller.abort()
  controllers.clear()
  updateFiles([])
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

function statusText(status: UploadFileItem['status']) {
  return {
    idle: '等待上传',
    validating: '正在校验',
    uploading: '正在上传',
    success: '已完成',
    failed: '上传失败',
    rejected: '已拒绝',
  }[status]
}

onBeforeUnmount(clear)

defineExpose({ submit, retry, remove, clear })
</script>

<template>
  <section class="vfu-upload" aria-label="文件上传">
    <div
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
        @change="onSelect"
      />
      <span class="vfu-dropzone__mark">↥</span>
      <strong>选择文件或拖拽到这里</strong>
      <span>支持普通上传；可配置文件类型、大小和业务参数。</span>
    </div>

    <div v-if="!autoUpload && files.some((file) => file.status === 'idle')" class="vfu-toolbar">
      <span>{{ files.filter((file) => file.status === 'idle').length }} 个文件等待上传</span>
      <button class="vfu-button" type="button" :disabled="!canUpload" @click="submit">
        开始上传
      </button>
    </div>

    <ul v-if="files.length" class="vfu-list" aria-live="polite">
      <li v-for="file in files" :key="file.uid" class="vfu-file" :class="`is-${file.status}`">
        <span class="vfu-file__glyph">{{ file.type.startsWith('image/') ? '▧' : '▤' }}</span>
        <div class="vfu-file__body">
          <div class="vfu-file__headline">
            <strong>{{ file.name }}</strong
            ><span>{{ formatSize(file.size) }}</span>
          </div>
          <div v-if="file.status === 'uploading'" class="vfu-progress" aria-label="上传进度">
            <i :style="{ width: `${file.percent}%` }" />
          </div>
          <small :class="{ 'is-error': file.status === 'failed' || file.status === 'rejected' }">{{
            file.error?.message ?? statusText(file.status)
          }}</small>
        </div>
        <span v-if="file.status === 'uploading'" class="vfu-file__percent"
          >{{ file.percent }}%</span
        >
        <button
          v-if="file.status === 'failed' && canRetry"
          class="vfu-action"
          type="button"
          @click="retry(file.uid)"
        >
          重试
        </button>
        <button
          v-if="canRemove"
          class="vfu-action is-danger"
          type="button"
          @click="remove(file.uid)"
        >
          移除
        </button>
      </li>
    </ul>
  </section>
</template>

<style lang="scss">
.vfu-upload {
  --vfu-ink: #172033;
  --vfu-muted: #687389;
  --vfu-line: #dce2ee;
  --vfu-signal: #4f46e5;
  --vfu-danger: #c53b4c;
  color: var(--vfu-ink);
  font:
    14px/1.45 Inter,
    ui-sans-serif,
    system-ui,
    sans-serif;
}
.vfu-dropzone {
  display: grid;
  place-items: center;
  gap: 5px;
  min-height: 178px;
  padding: 24px;
  border: 1px dashed #a5b0c6;
  border-radius: 14px;
  background: linear-gradient(135deg, #fbfcff, #f5f7ff);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.2s,
    background 0.2s,
    transform 0.2s;
}
.vfu-dropzone:hover,
.vfu-dropzone.is-active {
  border-color: var(--vfu-signal);
  background: #f0f2ff;
  transform: translateY(-1px);
}
.vfu-dropzone.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.vfu-dropzone input {
  display: none;
}
.vfu-dropzone strong {
  font-size: 15px;
  letter-spacing: -0.01em;
}
.vfu-dropzone > span:last-child {
  color: var(--vfu-muted);
  font-size: 12px;
}
.vfu-dropzone__mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 11px;
  background: var(--vfu-signal);
  color: white;
  font-size: 24px;
  line-height: 1;
}
.vfu-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 0;
  color: var(--vfu-muted);
  font-size: 12px;
}
.vfu-button {
  border: 0;
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--vfu-signal);
  color: white;
  cursor: pointer;
  font: inherit;
  font-weight: 650;
}
.vfu-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.vfu-list {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.vfu-file {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 66px;
  padding: 10px 12px;
  border: 1px solid var(--vfu-line);
  border-radius: 10px;
  background: white;
}
.vfu-file.is-success {
  border-color: #bfe2d1;
}
.vfu-file.is-failed,
.vfu-file.is-rejected {
  border-color: #f1c5cb;
}
.vfu-file__glyph {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border-radius: 8px;
  background: #eef1ff;
  color: var(--vfu-signal);
  font-size: 17px;
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
  background: #e8ebf4;
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
  padding: 4px;
  background: transparent;
  color: var(--vfu-signal);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.vfu-action.is-danger {
  color: var(--vfu-danger);
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
</style>
