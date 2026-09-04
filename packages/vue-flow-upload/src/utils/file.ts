import type { FileMeta, UploadFileItem, UploadUserFile } from '../types'
import audioIcon from '../assets/file-icons/audio.svg?url'
import documentIcon from '../assets/file-icons/document.svg?url'
import fileIcon from '../assets/file-icons/file.svg?url'
import imageIcon from '../assets/file-icons/image.svg?url'
import jsonIcon from '../assets/file-icons/json.svg?url'
import excelIcon from '../assets/file-icons/microsoft-excel.svg?url'
import powerpointIcon from '../assets/file-icons/microsoft-powerpoint.svg?url'
import wordIcon from '../assets/file-icons/microsoft-word.svg?url'
import pdfIcon from '../assets/file-icons/pdf.svg?url'
import videoIcon from '../assets/file-icons/video.svg?url'
import zipIcon from '../assets/file-icons/zip.svg?url'

/** 生成浏览器安全的行唯一标识，并兼容旧运行环境。 Generates a browser-safe row id with an older-runtime fallback. */
export function createUid() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** 补全用户输入文件记录的默认字段，供渲染和队列统一使用。 Completes user records for consistent rendering and queue handling. */
export function normalizeFileList(fileList: UploadUserFile[]): UploadFileItem[] {
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

/** 校验扩展名、精确 MIME 类型及 MIME 通配符。 Evaluates extension, exact MIME, and MIME wildcard filters. */
export function matchesAccept(file: File, accept?: string | string[]) {
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

/** 提取可序列化元数据，刻意不包含文件二进制内容。 Extracts serializable metadata without file bytes. */
export function fileMeta(file: File, sha256?: string, fileId?: string): FileMeta {
  return {
    fileId,
    name: file.name,
    size: file.size,
    mimeType: file.type,
    lastModified: file.lastModified,
    sha256,
  }
}

/** 判断文件能否进入图片预览流程。 Returns whether a file can use image preview. */
export function isImage(file: UploadFileItem) {
  return file.type.startsWith('image/')
}

/** 将字节数格式化为列表使用的紧凑标签。 Formats bytes for compact list labels. */
export function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/** 优先按 MIME、其次按扩展名推断简短类型标签。 Infers a short label from MIME type, then extension. */
export function fileTypeLabel(file: UploadFileItem) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'PDF'
  if (file.type.startsWith('image/')) return file.type.slice(6, 9).toUpperCase()
  const extension = file.name.split('.').pop()
  return extension ? extension.slice(0, 3).toUpperCase() : 'FILE'
}

/** Resolves a local, colorful SVG using MIME type first and extension as a fallback. */
/** 优先按 MIME、其次按常见扩展名选择内置图标。 Chooses the built-in icon by MIME type, then extension. */
export function fileIconUrl(file: UploadFileItem) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type.toLowerCase()
  if (type === 'application/pdf' || extension === 'pdf') return pdfIcon
  if (type.includes('word') || ['doc', 'docx', 'dot', 'dotx', 'odt', 'rtf'].includes(extension))
    return wordIcon
  if (
    type.includes('excel') ||
    type.includes('spreadsheet') ||
    ['xls', 'xlsx', 'xlsm', 'csv', 'ods'].includes(extension)
  )
    return excelIcon
  if (
    type.includes('powerpoint') ||
    type.includes('presentation') ||
    ['ppt', 'pptx', 'pps', 'ppsx', 'odp'].includes(extension)
  )
    return powerpointIcon
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(extension))
    return audioIcon
  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg'].includes(extension))
    return videoIcon
  if (
    type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(extension)
  )
    return imageIcon
  if (
    type.includes('zip') ||
    type.includes('compressed') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'tgz'].includes(extension)
  )
    return zipIcon
  if (
    type.includes('json') ||
    ['json', 'xml', 'yaml', 'yml', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'md'].includes(
      extension,
    )
  )
    return jsonIcon
  if (type.startsWith('text/') || ['txt', 'log', 'ini', 'cfg'].includes(extension))
    return documentIcon
  return fileIcon
}

/** 数字尺寸转为 px，字符串 CSS 尺寸原样保留。 Converts numeric sizes to px while preserving CSS expressions. */
export function toCssSize(value: string | number) {
  return typeof value === 'number' ? `${value}px` : value
}
