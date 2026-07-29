export interface UploadFileItem {
  uid: string
  name: string
  size: number
  type: string
  status: 'idle' | 'success'
  percent: number
  file?: File
}
