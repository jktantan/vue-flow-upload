import type { UploadError } from '../types'

export function makeUploadError(code: string, message: string, retriable: boolean): UploadError {
  /** 创建队列与传输层共用的标准上传错误。 Creates the standard upload error shared by queue and transport layers. */
  return { code, message, retriable }
}

export function normalizeUploadError(cause: unknown): UploadError {
  /** 将未知异常归一化为可显示、可判断重试性的上传错误。 Normalizes unknown exceptions into displayable, retry-aware upload errors. */
  if (typeof cause === 'object' && cause && 'code' in cause && 'message' in cause) {
    const error = cause as UploadError
    return { ...error, retriable: error.retriable ?? false }
  }
  return makeUploadError(
    'UPLOAD_FAILED',
    cause instanceof Error ? cause.message : '上传失败',
    false,
  )
}

export function isAbortError(cause: unknown) {
  /** 识别 DOM 与组件内部两种取消错误格式。 Recognizes both DOM and component-internal cancellation error shapes. */
  const error = cause as { code?: string; name?: string }
  return error?.name === 'AbortError' || error?.code === 'ABORTED'
}
