import type { ThemeAdapter, UploadMessages, UploadTheme } from './types'

const messages: Record<'zh-CN' | 'en-US', UploadMessages> = {
  'zh-CN': {
    selectFile: '选择文件或拖拽到这里',
    dragHint: '支持普通上传；可配置文件类型、大小和业务参数。',
    startUpload: '开始上传',
    pause: '暂停',
    resume: '继续',
    retry: '重试',
    remove: '移除',
    preview: '预览',
    download: '下载',
    downloadSelected: '下载已选',
    downloadAll: '下载全部',
    closePreview: '关闭预览',
    uploadFailed: '上传失败',
    waiting: '等待上传',
    validating: '正在校验',
    hashing: '正在计算 SHA-256',
    checking: '正在检查秒传',
    uploading: '正在上传',
    paused: '已暂停',
    completed: '已完成',
    rejected: '已拒绝',
  },
  'en-US': {
    selectFile: 'Select files or drop them here',
    dragHint: 'Configure accepted types, size limits, and request data.',
    startUpload: 'Start upload',
    pause: 'Pause',
    resume: 'Resume',
    retry: 'Retry',
    remove: 'Remove',
    preview: 'Preview',
    download: 'Download',
    downloadSelected: 'Download selected',
    downloadAll: 'Download all',
    closePreview: 'Close preview',
    uploadFailed: 'Upload failed',
    waiting: 'Waiting to upload',
    validating: 'Validating',
    hashing: 'Calculating SHA-256',
    checking: 'Checking instant upload',
    uploading: 'Uploading',
    paused: 'Paused',
    completed: 'Completed',
    rejected: 'Rejected',
  },
}

export function resolveMessages(locale: string, overrides?: Partial<UploadMessages>) {
  return { ...(messages[locale as keyof typeof messages] ?? messages['zh-CN']), ...overrides }
}

export function resolveTheme(theme: UploadTheme): ThemeAdapter {
  if (typeof theme === 'object') return theme
  if (theme === 'element-plus') {
    return {
      name: theme,
      className: 'vfu-theme-element-plus',
      variables: { '--vfu-signal': '#409eff', '--vfu-radius': '4px' },
    }
  }
  if (theme === 'ant-design-vue') {
    return {
      name: theme,
      className: 'vfu-theme-ant-design-vue',
      variables: { '--vfu-signal': '#1677ff', '--vfu-radius': '6px' },
    }
  }
  return { name: 'default', className: 'vfu-theme-default' }
}
