import { ref, type ComputedRef } from 'vue'
import type { UploadFileItem } from '../types'
import { isImage } from '../utils/file'

interface FilePreviewOptions {
  canPreview: ComputedRef<boolean>
  onPreview?: (file: UploadFileItem) => void | Promise<void>
}

/** Manages image preview state and the object URLs created for local files. */
export function useFilePreview(options: FilePreviewOptions) {
  const previewing = ref<UploadFileItem>()
  const objectUrls = new Map<string, string>()

  function imageUrl(file: UploadFileItem) {
    if (file.thumbnailUrl || file.url) return file.thumbnailUrl ?? file.url
    if (!file.file || !isImage(file)) return undefined
    const existing = objectUrls.get(file.uid)
    if (existing) return existing
    const url = window.URL.createObjectURL(file.file)
    objectUrls.set(file.uid, url)
    return url
  }

  async function previewFile(file: UploadFileItem) {
    if (!options.canPreview.value) return
    if (!isImage(file)) return options.onPreview?.(file)
    if (options.onPreview) await options.onPreview(file)
    else previewing.value = file
  }

  function revoke(uid: string) {
    const objectUrl = objectUrls.get(uid)
    if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    objectUrls.delete(uid)
  }

  function clear() {
    for (const url of objectUrls.values()) window.URL.revokeObjectURL(url)
    objectUrls.clear()
    previewing.value = undefined
  }

  return { previewing, imageUrl, previewFile, revoke, clear }
}
