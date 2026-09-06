<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useCropper } from 'vue-picture-cropper'
import 'cropperjs/dist/cropper.css'
import 'vue-picture-cropper/style.css'
import { api as viewerApi } from 'v-viewer'
import { useI18n } from 'vue-i18n-lite'
import { createFlowUploadI18n, getUploadMessages } from './i18n'
import 'viewerjs/dist/viewer.css'
import defaultAvatar from './assets/default-avatar.svg?url'
import { createHttpUploadTransport } from './core/http-transport'
import { vueFlowUploadConfigKey } from './config'
import { createUid, matchesAccept, normalizeFileList, toCssSize } from './utils/file'
import type {
  UploadData,
  UploadFileItem,
  UploadPermissions,
  UploadSuccessResult,
  UploadTransport,
  UploadUserFile,
} from './types'

const props = withDefaults(
  defineProps<{
    modelValue?: UploadUserFile[]
    action?: string
    updateAction?: string
    deleteAction?: string
    transport?: UploadTransport
    data?: UploadData
    accept?: string | string[]
    maxSize?: number
    width?: string | number
    height?: string | number
    disabled?: boolean
    preview?: boolean
    permissions?: UploadPermissions
    beforeUpload?: (file: File) => boolean | Promise<boolean>
  }>(),
  { width: 300, height: 300, disabled: false, preview: true, permissions: () => ({}) },
)
const emit = defineEmits<{
  'update:modelValue': [files: UploadFileItem[]]
  change: [file: UploadFileItem, files: UploadFileItem[]]
  success: [file: UploadFileItem, response: UploadSuccessResult]
  error: [file: File, error: Error]
  remove: [file: UploadFileItem]
}>()
const files = ref<UploadFileItem[]>(normalizeFileList(props.modelValue ?? []))
const globalConfig = inject(vueFlowUploadConfigKey, {})
const selectedFile = ref<File>()
const source = ref('')
const editorVisible = ref(false)
const dragging = ref(false)
const notice = ref('')
const input = ref<HTMLInputElement>()
const avatar = computed(() => files.value[0])
const imageSrc = computed(() => avatar.value?.url || avatar.value?.thumbnailUrl || defaultAvatar)
const canSelect = computed(() => !props.disabled && props.permissions.select !== false)
const canRemove = computed(() => !props.disabled && props.permissions.remove !== false)
const canPreview = computed(() => props.preview && props.permissions.preview !== false)
const inheritedI18n = useI18n()
const localI18n = createFlowUploadI18n()
const text = computed(() => getUploadMessages(inheritedI18n ?? localI18n))
const cardStyle = computed(() => ({
  width: toCssSize(props.width),
  height: toCssSize(props.height),
}))
const transport = computed(
  () =>
    props.transport ??
    (props.action
      ? createHttpUploadTransport({ url: props.action, deleteUrl: props.deleteAction, credentials: globalConfig.auth?.credentials })
      : undefined),
)
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
onBeforeUnmount(revokeSource)
function update(next: UploadFileItem[], changed?: UploadFileItem) {
  files.value = next
  emit('update:modelValue', next)
  if (changed) emit('change', changed, next)
}
function revokeSource() {
  if (source.value) URL.revokeObjectURL(source.value)
  source.value = ''
}
function preview() {
  if (canPreview.value) viewerApi({ images: [imageSrc.value], options: { title: false } })
}
function browse() {
  if (canSelect.value) input.value?.click()
}
function select(event: Event) {
  void openEditor((event.target as HTMLInputElement).files?.[0])
  ;(event.target as HTMLInputElement).value = ''
}
async function openEditor(file?: File) {
  if (!file || !canSelect.value) return
  if (!matchesAccept(file, props.accept)) return showNotice(text.value.avatarInvalidType)
  if (props.maxSize && file.size > props.maxSize) return showNotice(text.value.avatarTooLarge)
  if (props.beforeUpload && !(await props.beforeUpload(file))) return
  revokeSource()
  selectedFile.value = file
  source.value = URL.createObjectURL(file)
  editorVisible.value = true
}
function onDragOver(event: DragEvent) {
  event.preventDefault()
  dragging.value = true
}
function onDragLeave(event: DragEvent) {
  const target = event.currentTarget as HTMLElement | null
  if (!target?.contains(event.relatedTarget as Node)) dragging.value = false
}
function onDrop(event: DragEvent) {
  event.preventDefault()
  dragging.value = false
  void openEditor(event.dataTransfer?.files?.[0])
}
function closeEditor() {
  editorVisible.value = false
  selectedFile.value = undefined
  revokeSource()
}
function showNotice(message: string) {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 2200)
}
async function resolveData() {
  return typeof props.data === 'function' ? await props.data() : (props.data ?? {})
}
async function resolveHeaders() {
  const headers = globalConfig.auth?.headers
  return typeof headers === 'function' ? await headers() : (headers ?? {})
}
async function resolveQuery() {
  const query = globalConfig.auth?.query
  return typeof query === 'function' ? await query() : (query ?? {})
}
async function upload() {
  if (!selectedFile.value) return showNotice(text.value.avatarSelectFirst)
  const cropped = (await cropper.getFile({
    width: 512,
    height: 512,
    fileName: selectedFile.value.name || 'avatar.png',
  })) as File | undefined
  if (!cropped) return showNotice(text.value.avatarNotReady)
  const existing = avatar.value
  try {
    let response: UploadSuccessResult = {}
    if (existing && props.updateAction) {
      const formData = new FormData()
      formData.append('file', cropped)
      formData.append('fileId', existing.fileId ?? '')
      const result = await fetch(
        props.updateAction.replace('{fileId}', encodeURIComponent(existing.fileId ?? '')),
        { method: 'PUT', body: formData, headers: await resolveHeaders(), credentials: globalConfig.auth?.credentials },
      )
      if (!result.ok)
        throw new Error(
          text.value.avatarUploadFailedWithStatus.replace('{status}', String(result.status)),
        )
      response = result.headers.get('content-type')?.includes('application/json')
        ? await result.json()
        : {}
    } else if (transport.value) {
      const data = await resolveData()
      response = await transport.value.uploadFile(
        { file: cropped, fileId: createUid(), data },
        {
          signal: new AbortController().signal,
          headers: await resolveHeaders(),
          data,
          fileFieldName: 'file',
          dataFieldName: 'data',
          query: await resolveQuery(),
          onProgress: () => {},
        },
      )
    } else throw new Error(text.value.avatarTransportNotConfigured)
    const item: UploadFileItem = {
      uid: existing?.uid ?? createUid(),
      fileId: response.fileId ?? existing?.fileId,
      name: response.name ?? cropped.name,
      size: response.size ?? cropped.size,
      type: response.mimeType ?? cropped.type,
      status: 'success',
      percent: 100,
      file: cropped,
      url: response.url ?? URL.createObjectURL(cropped),
      thumbnailUrl: response.thumbnailUrl,
    }
    update([item], item)
    emit('success', item, response)
    closeEditor()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : text.value.avatarUploadFailed)
    emit(
      'error',
      cropped,
      error instanceof Error ? error : new Error(text.value.avatarUploadFailed),
    )
  }
}
async function remove() {
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
          @click.stop="preview"
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
