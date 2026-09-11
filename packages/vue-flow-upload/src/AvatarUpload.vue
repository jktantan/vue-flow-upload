<script setup lang="ts">
/* eslint-disable vue/require-default-prop -- omitted values are semantically distinct in the public API */
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useCropper } from 'vue-picture-cropper'
import 'cropperjs/dist/cropper.css'
import 'vue-picture-cropper/style.css'
import { api as viewerApi } from 'v-viewer'
import { useI18n } from 'vue-i18n-lite'
import { createFlowUploadI18n, getUploadMessages } from './i18n'
import 'viewerjs/dist/viewer.css'
import defaultAvatar from './assets/default-avatar.svg?url'
import {
  appendQuery,
  createHttpUploadTransport,
  resolveRequestUrl,
  withoutContentType,
} from './core/http-transport'
import { vueFlowUploadConfigKey } from './config'
import { normalizeUploadError } from './utils/error'
import { createUid, matchesAccept, normalizeFileList, toCssSize } from './utils/file'
import type {
  UploadData,
  UploadError,
  UploadFileItem,
  UploadPermissions,
  UploadSuccessResult,
  UploadTransport,
  UploadUserFile,
} from './types'

/** 裁剪后的头像输出边长（像素）。 Side length in pixels of the cropped avatar output. */
const AVATAR_OUTPUT_SIZE_PX = 512
/** 校验与请求提示在界面中保留的时间（毫秒）。 Duration in milliseconds that validation and request notices remain visible. */
const NOTICE_DURATION_MS = 2_200

/**
 * 头像上传组件的输入配置；未传入 `modelValue` 时组件维护自身的单项列表。
 * Avatar uploader input; without `modelValue`, the component owns its one-item list.
 */
interface AvatarUploadProps {
  /** 受控头像列表，组件仅使用第一项。 Controlled avatar list; only its first item is rendered. */
  modelValue?: UploadUserFile[]
  /** 初始头像上传端点。 Initial avatar upload endpoint. */
  action?: string
  /** 替换已有头像时使用的 PUT 端点，可包含 `{fileId}`。 PUT endpoint for replacement; may contain `{fileId}`. */
  updateAction?: string
  /** 删除已有头像的端点。 Endpoint used to delete an existing avatar. */
  deleteAction?: string
  /** 自定义上传与删除传输适配器。 Custom upload and delete transport adapter. */
  transport?: UploadTransport
  /** 每个上传请求携带的静态或惰性业务数据。 Static or lazy business data sent with every upload request. */
  data?: UploadData
  /** 允许选择的扩展名或 MIME 类型。 Accepted extensions or MIME types. */
  accept?: string | string[]
  /** 单张源图片的最大字节数。 Maximum source-image size in bytes. */
  maxSize?: number
  /** 头像卡片宽度；数字按像素处理。 Avatar card width; numbers are interpreted as pixels. */
  width?: string | number
  /** 头像卡片高度；数字按像素处理。 Avatar card height; numbers are interpreted as pixels. */
  height?: string | number
  /** 禁用所有交互。 Disables all interaction. */
  disabled?: boolean
  /** 是否允许打开当前头像的预览。 Whether previewing the current avatar is allowed. */
  preview?: boolean
  /** 按操作粒度限制选择、删除和预览。 Per-operation restrictions for selecting, deleting, and previewing. */
  permissions?: UploadPermissions
  /** 客户端校验后、打开裁剪器前执行的可选拦截器。 Optional guard run after client validation and before opening the cropper. */
  beforeUpload?: (file: File) => boolean | Promise<boolean>
}

/**
 * 头像上传组件向宿主报告状态和生命周期的事件契约。
 * Events through which the avatar uploader reports state and lifecycle changes to its host.
 */
interface AvatarUploadEmits {
  /** 受控列表更新时发送完整的标准化列表。 Sends the full normalized list when controlled state changes. */
  (event: 'update:modelValue', files: UploadFileItem[]): void
  /** 本地头像记录变更后发送当前记录和完整列表。 Sends the changed avatar record and the complete list after a local change. */
  (event: 'change', file: UploadFileItem, files: UploadFileItem[]): void
  /** 服务端确认上传成功后发送记录和响应。 Sends the record and response after the server confirms upload success. */
  (event: 'success', file: UploadFileItem, response: UploadSuccessResult): void
  /** 上传失败后发送源文件和保留兼容性的 Error 实例。 Sends the source file and a compatibility-preserving Error instance after upload failure. */
  (event: 'error', file: File, error: Error): void
  /** 头像删除成功后发送被删除的记录。 Sends the removed record after avatar deletion succeeds. */
  (event: 'remove', file: UploadFileItem): void
}

/** 经过 TypeScript 约束且带默认值的组件输入。 TypeScript-constrained component inputs with defaults. */
const props = withDefaults(defineProps<AvatarUploadProps>(), {
  width: 300,
  height: 300,
  disabled: false,
  preview: true,
  permissions: () => ({}),
})
/** 经过 TypeScript 约束的组件事件发送器。 TypeScript-constrained component event emitter. */
const emit = defineEmits<AvatarUploadEmits>()
/** 与头像 v-model 保持同步的内部单项列表。 Internal single-item list kept in sync with the avatar v-model. */
const files = ref<UploadFileItem[]>(normalizeFileList(props.modelValue ?? []))
/** 插件注入的应用级请求与默认配置。 Application-wide request and default settings injected by the plugin. */
const globalConfig = inject(vueFlowUploadConfigKey, {})
/** 对话框中选中的原图；实际上传的是裁剪后的派生文件。 Original file selected in the dialog; the cropped derivative is uploaded instead. */
const selectedFile = ref<File>()
/** 作为裁剪器图片源传入的对象 URL。 Object URL passed to the cropper as its image source. */
const source = ref('')
/** 组件生成的本地头像 URL；外部 URL 永不由组件撤销。 Object URLs generated for local avatars; external URLs are never revoked by this component. */
const generatedAvatarUrls = new Set<string>()
/** 控制裁剪对话框是否显示。 Controls the cropper dialog visibility. */
const editorVisible = ref(false)
/** 驱动编辑器拖放区域的悬停视觉状态。 Drives the drag-over visual state in the editor drop zone. */
const dragging = ref(false)
/** 短暂显示给用户的校验或请求错误信息。 Short-lived, user-facing validation or request error message. */
const notice = ref('')
/** 当前提示的计时器；替换或卸载时必须清理。 Timer for the current notice; it must be cleared on replacement or unmount. */
let noticeTimer: number | undefined
/** 当前上传请求的取消控制器；卸载时中止请求以防止过期写回。 Cancellation controller for the active upload; aborted on unmount to prevent stale writes. */
let uploadController: AbortController | undefined
/** 组件卸载标记；自定义传输忽略取消信号时仍阻止结果写回。 Unmount marker; also blocks writes if a custom transport ignores cancellation. */
let isUnmounted = false
/** “选择图片”按钮使用的隐藏原生 input。 Hidden native input used by the “choose image” button. */
const input = ref<HTMLInputElement>()
/** 组件只将第一条记录渲染为当前头像。 The component deliberately renders only the first record as the current avatar. */
const avatar = computed(() => files.value[0])
/** Remote thumbnail/URL wins; otherwise show the package default placeholder. */
const imageSrc = computed(() => avatar.value?.url || avatar.value?.thumbnailUrl || defaultAvatar)
/** Permission-derived UI capabilities. */
const canSelect = computed(() => !props.disabled && props.permissions.select !== false)
const canRemove = computed(() => !props.disabled && props.permissions.remove !== false)
const canPreview = computed(
  () => !props.disabled && props.preview && props.permissions.preview !== false,
)
/** Host i18n instance takes precedence over this component's fallback dictionary. */
const inheritedI18n = useI18n()
const localI18n = createFlowUploadI18n()
const text = computed(() => getUploadMessages(inheritedI18n ?? localI18n))
const cardStyle = computed(() => ({
  width: toCssSize(props.width),
  height: toCssSize(props.height),
}))
/** Creates the built-in transport only when callers did not supply a custom transport. */
const transport = computed(
  () =>
    props.transport ??
    (props.action
      ? createHttpUploadTransport({
          url: props.action,
          baseUrl: globalConfig.baseUrl,
          deleteUrl: props.deleteAction,
          credentials: globalConfig.auth?.credentials,
        })
      : undefined),
)
/** Reactive cropper input; the fixed 1:1 ratio produces a square avatar. */
const cropperProps = computed(() => ({
  img: source.value,
  options: { aspectRatio: 1, viewMode: 1 as const },
}))
const [CropperComponent, cropper] = useCropper(cropperProps)
watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined) files.value = normalizeFileList(value)
  },
)
onBeforeUnmount(() => {
  // 卸载后不允许网络完成或计时器再修改组件状态。 After unmount, neither network completion nor timers may mutate component state.
  isUnmounted = true
  uploadController?.abort()
  if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
  revokeSource()
  for (const url of generatedAvatarUrls) URL.revokeObjectURL(url)
  generatedAvatarUrls.clear()
})
/**
 * 同步本地状态与受控模型，并撤销不再被任何记录引用的本地 URL。
 * Synchronizes local and controlled state while revoking local URLs no longer referenced by a record.
 */
function update(next: UploadFileItem[], changed?: UploadFileItem) {
  // 本地状态、v-model 和可选 change 事件由同一事务更新。
  // Keep local state, v-model, and the optional change notification in one transaction.
  const retainedUrls = new Set(next.map((file) => file.url).filter((url): url is string => !!url))
  for (const url of generatedAvatarUrls) {
    if (!retainedUrls.has(url)) {
      URL.revokeObjectURL(url)
      generatedAvatarUrls.delete(url)
    }
  }
  files.value = next
  emit('update:modelValue', next)
  if (changed) emit('change', changed, next)
}
/** 释放裁剪器原图 URL，避免替换或关闭编辑器后泄漏。 Releases the cropper source URL after replacement or editor closure. */
function revokeSource() {
  // 裁剪器图片源为对象 URL，替换或关闭后必须释放。
  // The cropper source is an object URL and must be released after replacement/close.
  if (source.value) URL.revokeObjectURL(source.value)
  source.value = ''
}
function previewAvatar() {
  // Viewer receives the resolved displayed image, including local object URLs.
  if (canPreview.value) viewerApi({ images: [imageSrc.value], options: { title: false } })
}
function browse() {
  // Do not allow programmatic file selection when the component is disabled.
  if (canSelect.value) input.value?.click()
}
/**
 * 将原生 input 的首个文件交给统一编辑器入口，并重置 input 以允许重复选择同一文件。
 * Passes the first native-input file to the shared editor entry point and resets the input for re-selection.
 */
function select(event: Event) {
  // Reset the native input so choosing the same file again emits a change event.
  void openEditor((event.target as HTMLInputElement).files?.[0])
  ;(event.target as HTMLInputElement).value = ''
}
/**
 * 完成选择前校验后创建裁剪器源并打开编辑器；异步拦截完成后会重新确认组件仍可写入。
 * Opens the editor with a cropper source after validation and rechecks writability after an async guard.
 */
async function openEditor(file?: File) {
  // Validate before allocating an object URL or opening the cropper dialog.
  if (!file || !canSelect.value) return
  if (!matchesAccept(file, props.accept)) return showNotice(text.value.avatarInvalidType)
  if (props.maxSize && file.size > props.maxSize) return showNotice(text.value.avatarTooLarge)
  try {
    if (props.beforeUpload && !(await props.beforeUpload(file))) return
  } catch (error) {
    // 拦截器异常与请求失败采用同一错误收窄逻辑，避免遗留未处理的 Promise 拒绝。
    // Guard errors use the same narrowing as request failures so no rejected Promise is left unhandled.
    showNotice(normalizeUploadError(error).message)
    return
  }
  // 异步拦截器等待期间，禁用或卸载可以发生；此时不得再创建对象 URL 或打开对话框。
  // Disablement or unmount can happen while awaiting the guard; do not then allocate a URL or open the dialog.
  if (isUnmounted || !canSelect.value) return
  revokeSource()
  selectedFile.value = file
  source.value = URL.createObjectURL(file)
  editorVisible.value = true
}
function onDragOver(event: DragEvent) {
  // preventDefault is required for a browser drop target.
  event.preventDefault()
  dragging.value = true
}
function onDragLeave(event: DragEvent) {
  // Ignore transitions between descendants; only a real leave clears the indicator.
  const target = event.currentTarget as HTMLElement | null
  if (!target?.contains(event.relatedTarget as Node)) dragging.value = false
}
function onDrop(event: DragEvent) {
  // Reuse the same validation/cropper entry point as native file selection.
  event.preventDefault()
  dragging.value = false
  void openEditor(event.dataTransfer?.files?.[0])
}
function closeEditor() {
  // Closing is also the cleanup boundary for the pending selected file and object URL.
  editorVisible.value = false
  selectedFile.value = undefined
  revokeSource()
}
/** 显示短暂提示，并确保旧计时器不会清除新提示。 Shows a short notice and prevents an earlier timer from clearing a newer notice. */
function showNotice(message: string) {
  // 后来的消息拥有提示槽位，旧计时器不能清除它。
  // A later message owns the notice slot and must not be cleared by an older timer.
  notice.value = message
  if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
    noticeTimer = undefined
  }, NOTICE_DURATION_MS)
}
/**
 * 将头像 PUT 接口的未知 JSON 限制为公开上传响应，拒绝不符合协议的字段类型。
 * Narrows unknown JSON from the avatar PUT endpoint to the public upload response and rejects invalid field types.
 */
function parseAvatarUploadResponse(payload: unknown): UploadSuccessResult {
  // 空响应对象是合法的：组件会回退到裁剪文件自身的元数据和本地预览 URL。
  // An empty object is valid because the component falls back to cropped-file metadata and a local preview URL.
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(text.value.avatarUploadFailed)
  }
  // 响应记录只在边界处作为 unknown 字段容器使用，返回前会逐项收窄。
  // The response record is only an unknown-field container at this boundary; every returned field is narrowed.
  const responseRecord = payload as Record<string, unknown>
  if (
    (responseRecord.fileId !== undefined && typeof responseRecord.fileId !== 'string') ||
    (responseRecord.name !== undefined && typeof responseRecord.name !== 'string') ||
    (responseRecord.mimeType !== undefined && typeof responseRecord.mimeType !== 'string') ||
    (responseRecord.url !== undefined && typeof responseRecord.url !== 'string') ||
    (responseRecord.thumbnailUrl !== undefined &&
      typeof responseRecord.thumbnailUrl !== 'string') ||
    (responseRecord.size !== undefined &&
      (typeof responseRecord.size !== 'number' || !Number.isFinite(responseRecord.size)))
  ) {
    throw new Error(text.value.avatarUploadFailed)
  }
  if (
    responseRecord.status !== undefined &&
    responseRecord.status !== 'processing' &&
    responseRecord.status !== 'success'
  ) {
    throw new Error(text.value.avatarUploadFailed)
  }
  // 已收窄的字段组成公开响应，原始值只用于诊断而不会被组件业务逻辑读取。
  // Narrowed fields form the public response; the raw value is diagnostic-only and not read by component logic.
  return {
    fileId: responseRecord.fileId,
    name: responseRecord.name,
    size: responseRecord.size,
    mimeType: responseRecord.mimeType,
    url: responseRecord.url,
    thumbnailUrl: responseRecord.thumbnailUrl,
    status: responseRecord.status,
    raw: payload,
  } as UploadSuccessResult
}
async function resolveData() {
  // Data may be a lazy async factory so each request gets fresh values.
  return typeof props.data === 'function' ? await props.data() : (props.data ?? {})
}
async function resolveHeaders() {
  // Authentication headers are intentionally owned by the global plugin configuration.
  const headers = globalConfig.auth?.headers
  return typeof headers === 'function' ? await headers() : (headers ?? {})
}
async function resolveQuery() {
  // Query parameters follow the same lazy-resolution rule as headers and data.
  const query = globalConfig.auth?.query
  return typeof query === 'function' ? await query() : (query ?? {})
}
async function upload() {
  // A crop is always generated at the canonical avatar size before network transfer.
  if (!selectedFile.value) return showNotice(text.value.avatarSelectFirst)
  const cropped = (await cropper.getFile({
    width: AVATAR_OUTPUT_SIZE_PX,
    height: AVATAR_OUTPUT_SIZE_PX,
    fileName: selectedFile.value.name || 'avatar.png',
  })) as File | undefined
  if (!cropped) return showNotice(text.value.avatarNotReady)
  /** Existing record determines whether this is the initial POST or a PUT update. */
  const existing = avatar.value
  // 每次上传拥有独立控制器，重入时先取消旧请求，避免旧响应覆盖新裁剪结果。
  // Each upload owns a controller; a re-entry cancels the old request so its response cannot overwrite a new crop.
  uploadController?.abort()
  const activeController = new AbortController()
  uploadController = activeController
  try {
    let response: UploadSuccessResult = {}
    if (existing && props.updateAction) {
      // updateAction has an explicit REST contract: update the current server file by id.
      const formData = new FormData()
      formData.append('file', cropped)
      formData.append('fileId', existing.fileId ?? '')
      const result = await fetch(
        appendQuery(
          resolveRequestUrl(
            props.updateAction.replace('{fileId}', encodeURIComponent(existing.fileId ?? '')),
            globalConfig.baseUrl,
          ),
          await resolveQuery(),
        ),
        {
          method: 'PUT',
          body: formData,
          headers: withoutContentType(await resolveHeaders()),
          credentials: globalConfig.auth?.credentials,
          signal: activeController.signal,
        },
      )
      if (!result.ok)
        throw new Error(
          text.value.avatarUploadFailedWithStatus.replace('{status}', String(result.status)),
        )
      response = result.headers.get('content-type')?.includes('application/json')
        ? parseAvatarUploadResponse((await result.json()) as unknown)
        : {}
    } else if (transport.value) {
      // Without updateAction, both initial upload and replacement use the supplied transport.
      const data = await resolveData()
      response = await transport.value.uploadFile(
        { file: cropped, fileId: createUid(), data },
        {
          signal: activeController.signal,
          headers: await resolveHeaders(),
          data,
          fileFieldName: 'file',
          dataFieldName: 'data',
          query: await resolveQuery(),
          onProgress: () => {},
        },
      )
    } else throw new Error(text.value.avatarTransportNotConfigured)
    if (isUnmounted || activeController.signal.aborted) return
    // 保留替换时稳定的 uid/fileId，同时接受服务端权威元数据。
    // Preserve stable uid/fileId on replacement while accepting authoritative response metadata.
    const localUrl = response.url ? undefined : URL.createObjectURL(cropped)
    if (localUrl) generatedAvatarUrls.add(localUrl)
    const item: UploadFileItem = {
      uid: existing?.uid ?? createUid(),
      fileId: response.fileId ?? existing?.fileId,
      name: response.name ?? cropped.name,
      size: response.size ?? cropped.size,
      type: response.mimeType ?? cropped.type,
      status: 'success',
      percent: 100,
      file: cropped,
      url: response.url ?? localUrl,
      thumbnailUrl: response.thumbnailUrl,
    }
    update([item], item)
    emit('success', item, response)
    closeEditor()
  } catch (error) {
    if (isUnmounted || activeController.signal.aborted) return
    // 标准化未知错误以保留可读信息；事件仍发送 Error，避免破坏既有 AvatarUpload API。
    // Normalize unknown errors for readable feedback; the event remains Error to preserve the AvatarUpload API.
    const normalizedError: UploadError = normalizeUploadError(error)
    showNotice(normalizedError.message)
    emit('error', cropped, error instanceof Error ? error : new Error(normalizedError.message))
  } finally {
    if (uploadController === activeController) uploadController = undefined
  }
}
async function remove() {
  // Remote deletion must succeed before removing the rendered avatar locally.
  if (!avatar.value || !canRemove.value) return
  try {
    if (avatar.value.fileId && transport.value?.deleteFile)
      await transport.value.deleteFile(avatar.value.fileId, {
        headers: await resolveHeaders(),
        data: await resolveData(),
        fileFieldName: 'file',
        dataFieldName: 'data',
        query: await resolveQuery(),
      })
    const removed = avatar.value
    update([])
    emit('remove', removed)
  } catch {
    showNotice(text.value.avatarDeleteFailed)
  }
}
</script>

<template>
  <div class="vfu-avatar" :style="cardStyle">
    <input
      ref="input"
      class="vfu-file-input"
      type="file"
      :accept="Array.isArray(accept) ? accept.join(',') : accept"
      :disabled="!canSelect"
      @change="select"
    />
    <div class="vfu-avatar-card" :class="{ 'is-disabled': disabled }">
      <img :src="imageSrc" :alt="text.avatar" />
      <div class="vfu-avatar-mask">
        <button
          v-if="canPreview"
          class="vfu-action"
          type="button"
          :data-tooltip="text.avatarPreview"
          @click.stop="previewAvatar"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="2.8" />
          </svg></button
        ><button
          class="vfu-action"
          type="button"
          :data-tooltip="text.avatarUpdate"
          :disabled="!canSelect"
          @click.stop="editorVisible = true"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4l10-10-4-4L4 16v4Z" />
            <path d="m12.5 7.5 4 4" />
          </svg></button
        ><button
          v-if="avatar"
          class="vfu-action is-danger"
          type="button"
          :data-tooltip="text.remove"
          :disabled="!canRemove"
          @click.stop="remove"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v5m4-5v5M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" />
          </svg>
        </button>
      </div>
    </div>
    <div v-if="notice" class="vfu-avatar-notice" role="alert">{{ notice }}</div>
    <div v-if="editorVisible" class="vfu-avatar-dialog" @click.self="closeEditor">
      <section class="vfu-avatar-editor">
        <div
          class="vfu-avatar-cropper"
          :class="{ 'is-dragging': dragging }"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <CropperComponent v-if="source" /><button
            v-else
            type="button"
            class="vfu-avatar-empty"
            @click="browse"
          >
            {{ text.avatarDragHint }}
          </button>
          <div v-if="dragging" class="vfu-avatar-drop-mask">{{ text.avatarDropToUpload }}</div>
        </div>
        <footer class="vfu-avatar-editor__footer">
          <span>{{ text.avatarDragHint }}</span>
          <div>
            <button type="button" class="vfu-button" @click="browse">{{ text.avatarChoose }}</button
            ><button
              type="button"
              class="vfu-button is-success"
              :disabled="!selectedFile"
              @click="upload"
            >
              {{ text.avatarUpload }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>
