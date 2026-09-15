export interface UploadMessages {
  selectFile: string
  chooseFile: string
  uploadLimits: string
  allFileTypes: string
  unlimited: string
  dragHint: string
  dragUpload: string
  dropToUpload: string
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
  /** 列表查询或初始化读取时的通用加载文案。 Generic loading copy for list queries or initial reads. */
  loading: string
  processing: string
  paused: string
  completed: string
  canceled: string
  rejected: string
  fileTooLarge: string
  fileTypeNotAllowed: string
  beforeUploadRejected: string
  pendingFiles: string
  selectAll: string
  fileActions: string
  selectedFiles: string
  removeSelected: string
  fileCount: string
  removeConfirmTitle: string
  /** 单文件删除确认文案，使用 {name} 插入文件名。 Single-file removal confirmation copy; {name} inserts the filename. */
  removeSingleConfirmMessage: string
  /** 批量删除确认文案，使用 {count} 插入文件数量。 Batch-removal confirmation copy; {count} inserts the file count. */
  removeMultipleConfirmMessage: string
  removeConfirmProcessing: string
  cancel: string
  removeCleanupFailed: string
  uploadingToast: string
  noUploadFilesToast: string
  noDownloadFilesToast: string
  noRemoveFilesToast: string
  uploadFile: string
  noData: string
  avatar: string
  /** 头像裁剪对话框标题。 Title of the avatar crop dialog. */
  avatarCropTitle: string
  avatarInvalidType: string
  avatarTooLarge: string
  avatarSelectFirst: string
  avatarNotReady: string
  avatarUploadFailed: string
  avatarUploadFailedWithStatus: string
  avatarTransportNotConfigured: string
  avatarDeleteFailed: string
  avatarPreview: string
  avatarUpdate: string
  avatarDragHint: string
  avatarDropToUpload: string
  avatarChoose: string
  avatarUpload: string
  /** 头像裁剪结果提交时的进行中文案。 In-progress copy while submitting an avatar crop result. */
  avatarUploading: string
  paginationTotal: string
  paginationItemsPerPage: string
  paginationPrevious: string
  paginationNext: string
  paginationPageNumber: string
  paginationGoTo: string
  paginationLabel: string
}
export interface ThemeAdapter {
  name: string
  className?: string
  variables?: Record<string, string>
}
export type UploadTheme = 'default' | 'element-plus' | 'ant-design-vue' | ThemeAdapter
