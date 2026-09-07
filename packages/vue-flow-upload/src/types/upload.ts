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
  /** Whether the server-side file record has been created for this upload. */
  remoteCreated?: boolean
  uploadId?: string
  sha256?: string
  url?: string
  thumbnailUrl?: string
  response?: UploadSuccessResult
  error?: UploadError
}
export type UploadUserFile = Partial<UploadFileItem> & Pick<UploadFileItem, 'name'>
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

export interface UploadPagination {
  total?: number
  currentPage?: number
  pageSize?: number
  pageSizes?: number[]
}

/**
 * Pagination is opt-in. When enabled, the host owns loading the selected page
 * and supplies the resulting files through v-model.
 */
export type UploadPaginationConfig = false | UploadPagination
