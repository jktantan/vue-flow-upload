export type UploadStatus = 'idle' | 'validating' | 'uploading' | 'success' | 'failed' | 'rejected'

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
  url?: string
  thumbnailUrl?: string
  response?: UploadSuccessResult
  error?: UploadError
}

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

export interface UploadTransport {
  uploadFile(
    input: { file: File; data: Record<string, unknown> },
    context: UploadRequestContext,
  ): Promise<UploadSuccessResult>
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
}
