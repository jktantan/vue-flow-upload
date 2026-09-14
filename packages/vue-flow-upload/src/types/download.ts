import type { RequestContext } from './transport'

/** 单文件下载接口返回的浏览器可保存资源。 Browser-saveable resource returned by a single-file download endpoint. */
export interface DownloadResource {
  /** 下载保存时优先使用的文件名。 Preferred file name used when saving the download. */
  fileName?: string
  /** 可由浏览器直接访问的远程下载地址。 Remote URL that the browser can download directly. */
  url?: string
  /** 已读取到内存中的二进制内容。 Binary content already read into memory. */
  blob?: Blob
}
/** 服务端异步归档任务的可观察状态。 Observable state of an asynchronous server archive task. */
export interface ArchiveTask {
  /** 服务端分配的、用于轮询与取消的任务标识。 Server-issued identifier used for polling and cancellation. */
  taskId: string
  /** 归档在服务端的当前生命周期状态。 Current archive lifecycle state on the server. */
  status: 'pending' | 'processing' | 'success' | 'failed' | 'canceled'
  /** 服务端可选提供的归档完成百分比，范围为 0–100。 Optional server-reported completion percent, ranging from 0–100. */
  progress?: number
  /** 归档下载时建议使用的文件名。 Suggested file name for the archive download. */
  fileName?: string
  /** 任务成功后可访问的归档下载地址。 Archive download URL available after the task succeeds. */
  downloadUrl?: string
  /** 任务失败时适合展示给用户的错误信息。 User-displayable error message when the task fails. */
  errorMessage?: string
}
/** 批量下载的持久化文件标识范围或服务端查询范围。 Persisted file-id scope or server-query scope for a bulk download. */
export type DownloadScope =
  | { type: 'file-ids'; fileIds: string[] }
  | { type: 'server-query'; queryKey: string; query: Record<string, unknown> }
/** 组件和任意下载/归档后端协议之间的适配器边界。 Adapter boundary between the component and any download/archive backend protocol. */
export interface DownloadTransport {
  /** 获取单文件可保存资源；抛出的错误应符合 UploadError 结构。 Gets a saveable resource for one file; thrown errors should follow the UploadError shape. */
  downloadFile(
    input: { fileId: string; fileName: string },
    context: RequestContext,
  ): Promise<DownloadResource>
  /** 创建服务端归档任务；任务可能需要后续轮询才能下载。 Creates a server archive task, which may need polling before download. */
  createArchive(
    input: { fileIds?: string[]; scope?: DownloadScope; archiveName?: string },
    context: RequestContext,
  ): Promise<ArchiveTask>
  /** 查询一个已创建归档任务的最新状态。 Gets the latest state of a previously created archive task. */
  getArchiveTask(taskId: string, context: RequestContext): Promise<ArchiveTask>
  /** 尽力取消尚未结束的服务端归档任务。 Best-effort cancellation of a server archive task that has not finished. */
  cancelArchive?(taskId: string, context: RequestContext): Promise<void>
}
