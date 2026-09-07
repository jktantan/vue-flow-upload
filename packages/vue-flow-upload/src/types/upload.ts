/** 单个文件行从本地校验到服务端完成的生命周期状态。 Lifecycle states for one UI file row, from local validation through server completion. */
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
  | 'processing'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'rejected'

/** 写入文件行和公开 error 事件的标准化错误。 Normalized error passed to row state and the public error event. */
export interface UploadError {
  /** Stable machine-readable reason such as HTTP_404 or FILE_TOO_LARGE. */
  code: string
  /** User-displayable error text. */
  message: string
  /** HTTP status when the failure came from a response. */
  status?: number
  /** Whether queue/chunk retry policy may safely repeat this request. */
  retriable: boolean
  /** Original exception or response parsing cause for diagnostics. */
  cause?: unknown
}
/** 上传端点接收文件后返回的元数据。 Metadata returned by an upload endpoint after it accepts a file. */
export interface UploadSuccessResult {
  /** Final availability is decided by the backend file record, never by the client. */
  status?: 'processing' | 'success'
  /** Persistent server-side file record identifier. */
  fileId?: string
  name?: string
  size?: number
  mimeType?: string
  url?: string
  thumbnailUrl?: string
  raw?: unknown
}
/** 单个文件的完整渲染状态；`uid` 是本地标识，`fileId` 是服务端标识。 Complete state object rendered for one file; `uid` is local and `fileId` is server-side. */
export interface UploadFileItem {
  /** Browser-local, stable row key used by Vue and cancellation maps. */
  uid: string
  /** Display name, normally sourced from File.name or the server response. */
  name: string
  /** File size in bytes. */
  size: number
  /** MIME type from the browser or server. */
  type: string
  /** Current client-side lifecycle state. */
  status: UploadStatus
  /** UI progress percentage; transfer progress tops out at 99 until server confirmation. */
  percent: number
  /** Original browser File; absent for records loaded from the server. */
  file?: File
  /** Persistent server record id used for update, delete, and download calls. */
  fileId?: string
  /** Whether the server-side file record has been created for this upload. */
  remoteCreated?: boolean
  /** Temporary multipart-session id returned by initMultipart. */
  uploadId?: string
  /** Content hash used by instant upload and resumable multipart sessions. */
  sha256?: string
  /** Primary remote URL or a local object URL used for display/preview. */
  url?: string
  /** Smaller remote image representation, preferred for list thumbnails. */
  thumbnailUrl?: string
  /** Raw normalized response from the final upload/merge request. */
  response?: UploadSuccessResult
  /** Most recent failure that put this row in failed/rejected state. */
  error?: UploadError
}
/** v-model/defaultFileList 接受的输入；标准化会补齐缺失的运行时字段。 Input accepted by v-model/defaultFileList; normalization fills omitted runtime fields. */
export type UploadUserFile = Partial<UploadFileItem> & Pick<UploadFileItem, 'name'>
/** 每次上传请求附带的静态或懒计算业务数据。 Static or lazily evaluated extra data sent alongside every upload request. */
export type UploadData =
  Record<string, unknown> | (() => Record<string, unknown> | Promise<Record<string, unknown>>)
export type UploadHeaders =
  Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
/** 各操作的 UI 权限；未填写即允许该操作。 Per-operation UI permissions; an omitted field allows the operation. */
export interface UploadPermissions {
  select?: boolean
  upload?: boolean
  remove?: boolean
  retry?: boolean
  preview?: boolean
  download?: boolean
  downloadAll?: boolean
}

/** 受控分页参数；FlowUpload 只发出变更，不自行加载页面数据。 Controlled pagination values; FlowUpload emits changes but never fetches page data itself. */
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
