import type { ComputedRef } from 'vue'
import { api as viewerApi } from 'v-viewer'
import type { UploadFileItem } from '../types'
import { isImage } from '../utils/file'

interface FilePreviewOptions {
  files: ComputedRef<UploadFileItem[]>
  canPreview: ComputedRef<boolean>
  onPreview?: (file: UploadFileItem) => void | Promise<void>
}

/** 管理图片预览状态及本地文件的对象 URL。 Manages image preview state and local-file object URLs. */
export function useFilePreview(options: FilePreviewOptions) {
  // 由此处统一持有对象 URL，替换或删除时可释放浏览器资源。 Owns object URLs here so replacement/removal can release browser resources.
  const objectUrls = new Map<string, string>()

  function imageUrl(file: UploadFileItem) {
    // 远端文件直接复用地址；本地图片延迟创建并缓存对象 URL。 Reuse remote URLs; lazily create and cache local-image object URLs.
    if (file.thumbnailUrl || file.url) return file.thumbnailUrl ?? file.url
    if (!file.file || !isImage(file)) return undefined
    const existing = objectUrls.get(file.uid)
    if (existing) return existing
    const url = window.URL.createObjectURL(file.file)
    objectUrls.set(file.uid, url)
    return url
  }

  async function previewFile(file: UploadFileItem) {
    // 自定义预览优先；否则以当前全部图片创建可切换的查看器。 Prefer custom preview; otherwise open a viewer over all current images.
    if (!options.canPreview.value) return
    if (!isImage(file)) return options.onPreview?.(file)
    if (options.onPreview) await options.onPreview(file)
    else {
      const imageFiles = options.files.value
        .filter(isImage)
        .map((item) => ({ file: item, url: imageUrl(item) }))
        .filter((item): item is { file: UploadFileItem; url: string } => !!item.url)
      const initialViewIndex = imageFiles.findIndex((item) => item.file.uid === file.uid)
      if (initialViewIndex >= 0) {
        const fileNames = new Map(imageFiles.map((item) => [item.url, item.file.name]))
        viewerApi({
          images: imageFiles.map((item) => item.url),
          options: {
            initialViewIndex,
            title: (image) => fileNames.get(image.src) ?? file.name,
          },
        })
      }
    }
  }

  function revoke(uid: string) {
    // 单文件移除时同步释放其对象 URL。 Release an object's URL when its file is removed.
    const objectUrl = objectUrls.get(uid)
    if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    objectUrls.delete(uid)
  }

  function clear() {
    // 销毁组件前释放所有尚未回收的对象 URL。 Release every remaining object URL before component teardown.
    for (const url of objectUrls.values()) window.URL.revokeObjectURL(url)
    objectUrls.clear()
  }

  return { imageUrl, previewFile, revoke, clear }
}
