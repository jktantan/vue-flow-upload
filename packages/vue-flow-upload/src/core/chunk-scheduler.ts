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

/** 单个 FlowUpload 实例内所有文件分片共享的 FIFO 请求池。 FIFO request pool shared by every file chunk in one FlowUpload instance. */
export class ChunkScheduler {
  private readonly queue: ScheduledTask<unknown>[] = []
  private readonly activeByFile = new Map<string, number>()
  private activeRequests = 0

  /** 保存并发策略；实际调度在任务入队后立即尝试执行。 Stores concurrency policy; scheduling starts when a task is enqueued. */
  constructor(private readonly options: ChunkSchedulerOptions) {}

  /** 将任务加入队列，并在满足文件与请求并发限制时执行。 Enqueues a task and runs it when file/request limits allow. */
  schedule<T>(fileId: string, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fileId, run, resolve: resolve as (value: unknown) => void, reject })
      this.drain()
    })
  }

  /** 仅拒绝尚未开始的同文件任务；已开始任务由 AbortController 取消。 Rejects only queued tasks; active work is cancelled by AbortController. */
  cancel(fileId: string, reason = new DOMException('Upload canceled', 'AbortError')) {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index].fileId === fileId) {
        this.queue.splice(index, 1)[0].reject(reason)
      }
    }
  }

  private drain() {
    // 从队首开始寻找可运行任务，避免一个达到上限的文件阻塞其他文件。 Find the first runnable task so a saturated file does not block others.
    while (this.activeRequests < this.options.maxConcurrentRequests) {
      const index = this.queue.findIndex((task) => this.canRun(task.fileId))
      if (index === -1) return
      const task = this.queue.splice(index, 1)[0]
      this.start(task)
    }
  }

  private canRun(fileId: string) {
    // 同时限制单文件请求数、活跃文件数及全局请求数（后者由 drain 负责）。 Limit per-file and active-file counts; drain enforces the global request cap.
    const ownRequests = this.activeByFile.get(fileId) ?? 0
    const activeFiles = this.activeByFile.size
    return (
      ownRequests < this.options.concurrency &&
      (ownRequests > 0 || activeFiles < this.options.maxConcurrentFiles)
    )
  }

  private start(task: ScheduledTask<unknown>) {
    // 计数在 promise 最终完成时归还，无论任务成功还是失败。 Return capacity in finally whether the task resolves or rejects.
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
