export interface ChunkSchedulerOptions {
  maxConcurrentFiles: number
  maxConcurrentRequests: number
  concurrency: number
}

interface ScheduledTask<T> {
  fileId: string
  run: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

/** FIFO request pool shared by all chunks belonging to one FlowUpload instance. */
export class ChunkScheduler {
  private readonly queue: ScheduledTask<unknown>[] = []
  private readonly activeByFile = new Map<string, number>()
  private activeRequests = 0

  constructor(private readonly options: ChunkSchedulerOptions) {}

  schedule<T>(fileId: string, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fileId, run, resolve: resolve as (value: unknown) => void, reject })
      this.drain()
    })
  }

  cancel(fileId: string, reason = new DOMException('Upload canceled', 'AbortError')) {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index].fileId === fileId) {
        this.queue.splice(index, 1)[0].reject(reason)
      }
    }
  }

  private drain() {
    while (this.activeRequests < this.options.maxConcurrentRequests) {
      const index = this.queue.findIndex((task) => this.canRun(task.fileId))
      if (index === -1) return
      const task = this.queue.splice(index, 1)[0]
      this.start(task)
    }
  }

  private canRun(fileId: string) {
    const ownRequests = this.activeByFile.get(fileId) ?? 0
    const activeFiles = this.activeByFile.size
    return (
      ownRequests < this.options.concurrency &&
      (ownRequests > 0 || activeFiles < this.options.maxConcurrentFiles)
    )
  }

  private start(task: ScheduledTask<unknown>) {
    this.activeRequests += 1
    this.activeByFile.set(task.fileId, (this.activeByFile.get(task.fileId) ?? 0) + 1)
    void task
      .run()
      .then(task.resolve, task.reject)
      .finally(() => {
        this.activeRequests -= 1
        const remaining = (this.activeByFile.get(task.fileId) ?? 1) - 1
        if (remaining) this.activeByFile.set(task.fileId, remaining)
        else this.activeByFile.delete(task.fileId)
        this.drain()
      })
  }
}
