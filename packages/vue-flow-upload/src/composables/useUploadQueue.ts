import type { ComputedRef } from 'vue'
import { ChunkScheduler } from '../core/chunk-scheduler'
import { hashFile } from '../core/hash-service'
import type { UploadError, UploadFileItem, UploadSuccessResult, UploadTransport } from '../types'
import { isAbortError, makeUploadError, normalizeUploadError } from '../utils/error'
import { fileMeta } from '../utils/file'

interface UploadQueueOptions {
  files: ComputedRef<UploadFileItem[]>
  canUpload: ComputedRef<boolean>
  transport: ComputedRef<UploadTransport | undefined>
  scheduler: ChunkScheduler
  normalUploadThreshold: number
  chunkSize: number
  retryCount: number
  retryBaseDelay: number
  resume: boolean
  instantUpload: boolean
  fileFieldName: string
  dataFieldName: string
  resolveData: () => Promise<Record<string, unknown>>
  resolveHeaders: () => Promise<Record<string, string>>
  updateFile: (uid: string, patch: Partial<UploadFileItem>) => UploadFileItem | undefined
  onProgress: (file: UploadFileItem, percent: number) => void
  onSuccess: (file: UploadFileItem, response: UploadSuccessResult) => void
  onError: (file: UploadFileItem, error: UploadError) => void
}

/** Coordinates hashing, instant upload, normal uploads and resumable multipart uploads. */
export function useUploadQueue(options: UploadQueueOptions) {
  const controllers = new Map<string, Set<AbortController>>()

  function requireTransport() {
    const transport = options.transport.value
    if (!transport) throw makeUploadError('TRANSPORT_REQUIRED', '请提供 transport 或 action', false)
    return transport
  }

  function requestMeta(data: Record<string, unknown>, headers: Record<string, string>) {
    return {
      data,
      headers,
      fileFieldName: options.fileFieldName,
      dataFieldName: options.dataFieldName,
    }
  }

  function requestContext(
    data: Record<string, unknown>,
    headers: Record<string, string>,
    controller: AbortController,
    onProgress: (loaded: number, total: number) => void,
  ) {
    return { ...requestMeta(data, headers), signal: controller.signal, onProgress }
  }

  function trackController(uid: string) {
    const controller = new AbortController()
    const current = controllers.get(uid) ?? new Set<AbortController>()
    current.add(controller)
    controllers.set(uid, current)
    return controller
  }

  function untrackController(uid: string, controller: AbortController) {
    const current = controllers.get(uid)
    current?.delete(controller)
    if (!current?.size) controllers.delete(uid)
  }

  function updateProgress(uid: string, loaded: number, total: number) {
    const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0
    const current = options.updateFile(uid, { percent })
    if (current) options.onProgress(current, percent)
  }

  function ensureTaskActive(uid: string) {
    const status = options.files.value.find((file) => file.uid === uid)?.status
    if (!status || status === 'paused') throw makeUploadError('ABORTED', '上传已取消', false)
  }

  async function retryOperation<T>(operation: () => Promise<T>) {
    let attempt = 0
    while (true) {
      try {
        return await operation()
      } catch (cause) {
        const error = normalizeUploadError(cause)
        if (!error.retriable || attempt >= options.retryCount || isAbortError(cause)) throw cause
        await new Promise((resolve) =>
          window.setTimeout(resolve, options.retryBaseDelay * 2 ** attempt),
        )
        attempt += 1
      }
    }
  }

  function finishSuccess(uid: string, response: UploadSuccessResult) {
    const success = options.updateFile(uid, {
      status: 'success',
      percent: 100,
      fileId: response.fileId,
      url: response.url,
      thumbnailUrl: response.thumbnailUrl,
      response,
    })
    if (success) {
      options.onProgress(success, 100)
      options.onSuccess(success, response)
    }
  }

  async function uploadNormal(uid: string, file: File, data: Record<string, unknown>) {
    return options.scheduler.schedule(uid, async () => {
      const controller = trackController(uid)
      const current = options.updateFile(uid, { status: 'uploading' })
      if (current) options.onProgress(current, 0)
      try {
        return await requireTransport().uploadFile(
          { file, data },
          requestContext(data, await options.resolveHeaders(), controller, (loaded, total) =>
            updateProgress(uid, loaded, total),
          ),
        )
      } finally {
        untrackController(uid, controller)
      }
    })
  }

  async function uploadMultipart(
    uid: string,
    file: File,
    data: Record<string, unknown>,
    sha256?: string,
  ) {
    const { initMultipart, uploadChunk, completeMultipart } = requireTransport()
    if (!initMultipart || !uploadChunk || !completeMultipart) {
      throw makeUploadError('MULTIPART_NOT_SUPPORTED', '当前传输适配器不支持分片上传', false)
    }
    const chunkSize = Math.max(1, options.chunkSize)
    const totalChunks = Math.ceil(file.size / chunkSize)
    options.updateFile(uid, { status: 'preparing' })
    const session = await initMultipart(
      { ...fileMeta(file, sha256), chunkSize, totalChunks, data },
      requestMeta(data, await options.resolveHeaders()),
    )
    ensureTaskActive(uid)
    options.updateFile(uid, { uploadId: session.uploadId, status: 'queued' })
    const completed = new Set(session.uploadedChunks ?? [])
    const progress = Array.from({ length: totalChunks }, (_, index) =>
      completed.has(index) ? Math.min(chunkSize, file.size - index * chunkSize) : 0,
    )
    const missing = Array.from({ length: totalChunks }, (_, index) => index).filter(
      (index) => !completed.has(index),
    )
    await Promise.all(
      missing.map((index) =>
        options.scheduler.schedule(uid, async () => {
          const controller = trackController(uid)
          options.updateFile(uid, { status: 'uploading' })
          const start = index * chunkSize
          const chunk = file.slice(start, Math.min(start + chunkSize, file.size))
          try {
            await retryOperation(async () =>
              uploadChunk(
                {
                  uploadId: session.uploadId,
                  chunkIndex: index,
                  totalChunks,
                  chunk,
                  chunkSize,
                  file: fileMeta(file, sha256),
                },
                requestContext(data, await options.resolveHeaders(), controller, (loaded) => {
                  progress[index] = Math.min(chunk.size, loaded)
                  updateProgress(
                    uid,
                    progress.reduce((sum, value) => sum + value, 0),
                    file.size,
                  )
                }),
              ),
            )
            progress[index] = chunk.size
            updateProgress(
              uid,
              progress.reduce((sum, value) => sum + value, 0),
              file.size,
            )
          } finally {
            untrackController(uid, controller)
          }
        }),
      ),
    )
    options.updateFile(uid, { status: 'merging', percent: 99 })
    return completeMultipart(
      session.uploadId,
      { sha256, data },
      requestMeta(data, await options.resolveHeaders()),
    )
  }

  async function upload(uid: string) {
    if (!options.canUpload.value) return
    const target = options.files.value.find((file) => file.uid === uid)
    if (!target?.file || target.status === 'uploading') return
    if (!options.updateFile(uid, { status: 'queued', percent: 0, error: undefined })) return
    try {
      const transport = requireTransport()
      const data = await options.resolveData()
      const isMultipart = target.file.size > options.normalUploadThreshold
      const needsHash =
        (options.instantUpload && !!transport.checkFile) || (isMultipart && options.resume)
      let sha256: string | undefined
      if (needsHash) {
        const controller = trackController(uid)
        options.updateFile(uid, { status: 'hashing' })
        try {
          sha256 = await hashFile(target.file, {
            signal: controller.signal,
            onProgress: (loaded, total) => updateProgress(uid, loaded, total),
          })
        } finally {
          untrackController(uid, controller)
        }
        options.updateFile(uid, { sha256, percent: 0 })
      }
      if (sha256 && options.instantUpload && transport.checkFile) {
        options.updateFile(uid, { status: 'checking' })
        const check = await transport.checkFile(
          fileMeta(target.file, sha256),
          requestMeta(data, await options.resolveHeaders()),
        )
        if (check.exists) {
          if (!check.file) throw makeUploadError('INVALID_RESPONSE', '秒传响应缺少文件信息', false)
          finishSuccess(uid, check.file)
          return
        }
      }
      ensureTaskActive(uid)
      finishSuccess(
        uid,
        isMultipart
          ? await uploadMultipart(uid, target.file, data, sha256)
          : await uploadNormal(uid, target.file, data),
      )
    } catch (cause) {
      if (isAbortError(cause)) return
      const error = normalizeUploadError(cause)
      const failed = options.updateFile(uid, { status: 'failed', error })
      if (failed) options.onError(failed, error)
    } finally {
      controllers.delete(uid)
    }
  }

  async function submit() {
    await Promise.all(
      options.files.value.filter((file) => file.status === 'idle').map((file) => upload(file.uid)),
    )
  }

  function pause(uid: string) {
    const target = options.files.value.find((file) => file.uid === uid)
    if (
      !target ||
      !['hashing', 'checking', 'queued', 'uploading', 'preparing'].includes(target.status)
    )
      return
    options.scheduler.cancel(uid)
    controllers.get(uid)?.forEach((controller) => controller.abort())
    options.updateFile(uid, { status: 'paused' })
  }

  function resume(uid: string) {
    if (options.files.value.find((file) => file.uid === uid)?.status === 'paused')
      return upload(uid)
  }

  function abort(file?: string | UploadFileItem) {
    if (file) return pause(typeof file === 'string' ? file : file.uid)
    for (const item of options.files.value) pause(item.uid)
  }

  function clear() {
    for (const [uid, group] of controllers) {
      options.scheduler.cancel(uid)
      group.forEach((controller) => controller.abort())
    }
    controllers.clear()
  }

  return { upload, submit, retry: upload, pause, resume, abort, clear, requestMeta }
}
