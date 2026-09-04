import type { UploadError } from '../types'

export function makeUploadError(code: string, message: string, retriable: boolean): UploadError {
  return { code, message, retriable }
}

export function normalizeUploadError(cause: unknown): UploadError {
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
  const error = cause as { code?: string; name?: string }
  return error?.name === 'AbortError' || error?.code === 'ABORTED'
}
