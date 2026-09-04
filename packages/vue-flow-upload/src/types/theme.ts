export interface UploadMessages {
  selectFile: string
  chooseFile: string
  dragHint: string
  dragUpload: string
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
}
export interface ThemeAdapter {
  name: string
  className?: string
  variables?: Record<string, string>
}
export type UploadTheme = 'default' | 'element-plus' | 'ant-design-vue' | ThemeAdapter
