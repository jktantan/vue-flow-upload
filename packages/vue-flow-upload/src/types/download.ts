import type { RequestContext } from './transport'

export interface DownloadResource {
  fileName?: string
  url?: string
  blob?: Blob
}
export interface ArchiveTask {
  taskId: string
  status: 'pending' | 'processing' | 'success' | 'failed' | 'canceled'
  progress?: number
  fileName?: string
  downloadUrl?: string
  errorMessage?: string
}
export type DownloadScope =
  | { type: 'file-ids'; fileIds: string[] }
  | { type: 'server-query'; queryKey: string; query: Record<string, unknown> }
export interface DownloadTransport {
  downloadFile(
    input: { fileId: string; fileName: string },
    context: RequestContext,
  ): Promise<DownloadResource>
  createArchive(
    input: { fileIds?: string[]; scope?: DownloadScope; archiveName?: string },
    context: RequestContext,
  ): Promise<ArchiveTask>
  getArchiveTask(taskId: string, context: RequestContext): Promise<ArchiveTask>
  cancelArchive?(taskId: string, context: RequestContext): Promise<void>
}
