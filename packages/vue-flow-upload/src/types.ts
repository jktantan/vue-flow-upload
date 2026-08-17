export type UploadStatus =
  | 'idle'
  | 'validating'
  | 'hashing'
  | 'checking'
  | 'preparing'
  | 'queued'
  | 'uploading'
  | 'paused'
  | 'merging'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'rejected'

export interface UploadError {
  code: string
  message: string
  status?: number
  retriable: boolean
  cause?: unknown
}

export interface UploadSuccessResult {
  fileId?: string
  name?: string
  size?: number
  mimeType?: string
  url?: string
  thumbnailUrl?: string
  raw?: unknown
}

export interface UploadFileItem {
  uid: string
  name: string
  size: number
  type: string
  status: UploadStatus
  percent: number
  file?: File
  fileId?: string
  uploadId?: string
  sha256?: string
  url?: string
  thumbnailUrl?: string
  response?: UploadSuccessResult
  error?: UploadError
}

/** A lightweight file entry accepted by `v-model` and `defaultFileList`.
 * Missing runtime fields are filled by FlowUpload, which makes server-side
 * attachment replay possible without manufacturing client upload state. */
export type UploadUserFile = Partial<UploadFileItem> & Pick<UploadFileItem, 'name'>

export interface RequestContext {
  headers: Record<string, string>
  data: Record<string, unknown>
  fileFieldName: string
  dataFieldName: string
}

export interface UploadRequestContext extends RequestContext {
  signal: AbortSignal
  onProgress: (loaded: number, total: number) => void
}

export interface FileMeta {
  name: string
  size: number
  mimeType: string
  lastModified: number
  sha256?: string
}

export interface MultipartInitInput extends FileMeta {
  chunkSize: number
  totalChunks: number
  data: Record<string, unknown>
}

export interface MultipartSession {
  uploadId: string
  uploadedChunks?: number[]
}

export interface UploadChunkInput {
  uploadId: string
  chunkIndex: number
  totalChunks: number
  chunk: Blob
  chunkSize: number
  file: FileMeta
}

export interface UploadTransport {
  uploadFile(
    input: { file: File; data: Record<string, unknown> },
    context: UploadRequestContext,
  ): Promise<UploadSuccessResult>
  checkFile?(
    input: FileMeta,
    context: RequestContext,
  ): Promise<{ exists: boolean; file?: UploadSuccessResult }>
  initMultipart?(input: MultipartInitInput, context: RequestContext): Promise<MultipartSession>
  uploadChunk?(input: UploadChunkInput, context: UploadRequestContext): Promise<void>
  completeMultipart?(
    uploadId: string,
    input: { sha256?: string; data: Record<string, unknown> },
    context: RequestContext,
  ): Promise<UploadSuccessResult>
  cancelMultipart?(uploadId: string, context: RequestContext): Promise<void>
}

export interface DownloadResource {
  fileName?: string
  url?: string
  blob?: Blob
}

export interface ArchiveTask {
  taskId: string
  status: 'pending' | 'processing' | 'success' | 'failed' | 'canceled'
  progress?: number
  fileName?: string
  downloadUrl?: string
  errorMessage?: string
}

export type DownloadScope =
  | { type: 'file-ids'; fileIds: string[] }
  | { type: 'server-query'; queryKey: string; query: Record<string, unknown> }

export interface DownloadTransport {
  downloadFile(
    input: { fileId: string; fileName: string },
    context: RequestContext,
  ): Promise<DownloadResource>
  createArchive(
    input: { fileIds?: string[]; scope?: DownloadScope; archiveName?: string },
    context: RequestContext,
  ): Promise<ArchiveTask>
  getArchiveTask(taskId: string, context: RequestContext): Promise<ArchiveTask>
  cancelArchive?(taskId: string, context: RequestContext): Promise<void>
}

export type UploadData =
  Record<string, unknown> | (() => Record<string, unknown> | Promise<Record<string, unknown>>)

export type UploadHeaders =
  Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)

export interface UploadPermissions {
  select?: boolean
  upload?: boolean
  remove?: boolean
  retry?: boolean
  preview?: boolean
  download?: boolean
  downloadAll?: boolean
}

export interface UploadMessages {
  selectFile: string
  dragHint: string
  startUpload: string
  pause: string
  resume: string
  retry: string
  remove: string
  preview: string
  download: string
  downloadSelected: string
  downloadAll: string
  closePreview: string
  uploadFailed: string
  waiting: string
  validating: string
  hashing: string
  checking: string
  uploading: string
  paused: string
  completed: string
  rejected: string
}

export interface ThemeAdapter {
  name: string
  className?: string
  variables?: Record<string, string>
}

export type UploadTheme = 'default' | 'element-plus' | 'ant-design-vue' | ThemeAdapter
