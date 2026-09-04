import type { FileMeta, UploadFileItem, UploadUserFile } from '../types'

export function createUid() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

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

export function fileMeta(file: File, sha256?: string): FileMeta {
  return {
    name: file.name,
    size: file.size,
    mimeType: file.type,
    lastModified: file.lastModified,
    sha256,
  }
}

export function isImage(file: UploadFileItem) {
  return file.type.startsWith('image/')
}

export function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function fileTypeLabel(file: UploadFileItem) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'PDF'
  if (file.type.startsWith('image/')) return file.type.slice(6, 9).toUpperCase()
  const extension = file.name.split('.').pop()
  return extension ? extension.slice(0, 3).toUpperCase() : 'FILE'
}

export function toCssSize(value: string | number) {
  return typeof value === 'number' ? `${value}px` : value
}
