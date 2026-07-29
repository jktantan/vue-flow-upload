# Vue Flow Upload 组件设计文档

## 1. 背景与目标

`vue-flow-upload` 是一个面向 **Vue 3 + TypeScript** 的可配置上传组件库，要求以 Composition API 开发，并提供类型声明。组件将上传流程、断点续传、秒传、文件展示和 UI 适配解耦，使业务方只需提供后端上传协议与少量配置，即可在表单、素材库和图片管理等场景复用。

### 1.1 仓库与发布结构

仓库采用 pnpm workspace，将可发布组件包与本地手工测试页面分离：

```text
packages/vue-flow-upload/  # npm 包；仅此目录发布
playground/                # Vite 可视化开发与手工测试页；不发布
docs/                      # 设计与接入文档；不发布
```

`packages/vue-flow-upload` 中维护独立的 `package.json`、入口、构建配置和 `README.md`。组件包从 `src/` 构建为 `dist/`，npm 的 `files` 字段仅包含构建产物与包文档；Vue 为 `peerDependency`。根目录 `pnpm dev` 启动 `playground`，`pnpm build` 分别构建组件库和页面。发布前在组件包目录执行构建与 `npm publish`；实际发布名称可改为组织 scope，例如 `@scope/vue-flow-upload`。

### 1.2 核心目标

- 根据文件大小自动选择普通上传、分片上传或分片并发上传。
- 可选断点续传：页面刷新或网络中断后，可查询已上传分片并继续上传。
- 支持上传附带 JSON 业务数据，使用体验接近 `FormData`。
- 使用 SHA-256 实现秒传：服务端已存在相同完整文件时直接完成。
- 提供默认主题，并可通过适配器切换 Element Plus、Ant Design Vue 等组件库风格。
- 同时支持列表、图片墙、图片预览、拖拽和上传进度动画。
- 支持文件限制、手动/自动上传、权限控制和自定义请求头。
- 支持单文件下载、多文件打包下载和全部下载；后端下载逻辑由接入方适配。

### 1.3 非目标

- 不在组件内实现后端文件存储、病毒扫描或内容审核。
- 不直接绑定某一家对象存储；S3/OSS/COS 等通过请求适配器或服务端签名接口接入。
- 初版不在浏览器持久化上传会话；页面刷新后，用户重新选择同一文件即可向服务端恢复上传。
- 暂不支持目录上传；文件夹选择、目录递归和相对路径上传不属于初版范围。
- 不定义或实现服务端存储、合并、鉴权、去重、会话过期和任务清理的内部技术方案。

### 1.4 技术约束

- 运行环境：Vue `^3.5`、TypeScript，组件使用 `<script setup lang="ts">`、`defineProps`、`defineEmits`、`defineExpose` 与 Composition API。
- 构建产物：应输出 ESM、类型声明与独立样式入口；不将 Vue 打包进组件库产物，Vue 作为 `peerDependency`。
- 浏览器能力：使用 `File`、`Blob`、`AbortController`、Web Worker；不使用 IndexedDB。SHA-256 使用可增量计算的 JS/WASM 实现运行在 Worker 中，不能使用需一次性载入完整文件的 `crypto.subtle.digest`。缺少必要能力时需优雅降级并给出可识别错误。
- 传输层：默认提供基于 `fetch`/`XMLHttpRequest` 的实现；因上传进度需要，普通上传及分片上传默认使用 `XMLHttpRequest.upload.onprogress`，也允许业务方注入自己的 `UploadTransport`。

## 2. 总体架构

组件以“任务调度层 + 传输适配层 + 视图层”分层。UI 与实际 HTTP 协议不直接耦合。组件库只公布前后端请求/响应语义和 TypeScript 契约；接入方可使用任意语言、框架、存储或网关按该契约实现服务端，具体服务端技术方案不在本项目范围内。

```text
Upload / UploadList / UploadPictureWall
                │
         UploadManager（任务状态机、校验、进度聚合）
      ┌─────────┼──────────┐
 HashService             ChunkScheduler（并发控制）
      │                         │
      └──────── UploadTransport ─┴── HTTP / 自定义 SDK / 预签名 URL
                                      │
                            业务服务端 / 对象存储
```

### 2.1 模块职责

| 模块 | 职责 |
| --- | --- |
| `UploadManager` | 创建任务、维护状态机、执行前置校验、决定上传策略、暴露暂停/继续/重试/删除/下载能力。 |
| `HashService` | 通过 Web Worker 分片读取 `File` 并计算 SHA-256，避免大文件计算阻塞 UI。 |
| `ChunkScheduler` | 切片、限制最大并发、重试失败分片、聚合总体进度、支持暂停与取消。 |
| 服务端恢复会话 | 由接入方后端按文件哈希和当前用户定位未完成会话，并返回已完成分片；这是断点续传的唯一事实来源。 |
| `UploadTransport` | 统一封装秒传检查、初始化、上传、查询进度、合并、取消等网络协议。 |
| `ThemeAdapter` | 把核心状态映射为默认 UI 或第三方 UI 库的按钮、列表和进度组件。 |
| View 组件 | 提供选择、拖拽、展示、预览与无障碍交互。 |

### 2.2 Vue 组件边界与建议目录

核心上传逻辑应以 composable 和普通 TypeScript 类实现，不把网络状态绑定到某个 UI 库；Vue 组件仅订阅响应式任务状态并触发动作。

```text
src/
├── index.ts                         # 对外导出组件、类型、默认传输适配器
├── components/
│   ├── FlowUpload.vue               # 主入口：选择、拖拽与任务编排
│   ├── UploadList.vue               # 列表展示
│   ├── UploadPictureWall.vue        # 图片墙展示
│   ├── UploadItem.vue               # 单文件项、下载与其他操作
│   └── ImagePreview.vue             # 图片预览弹窗
├── composables/
│   ├── useUploadManager.ts          # 将 UploadManager 转为 Vue refs/computed
│   ├── useDropzone.ts               # 拖拽事件处理
│   └── useObjectUrl.ts              # 本地图片 URL 生命周期
├── core/
│   ├── upload-manager.ts
│   ├── chunk-scheduler.ts
│   ├── hash-service.ts
│   └── transports/http-transport.ts
├── themes/
│   ├── default/
│   ├── element-plus/
│   └── ant-design-vue/
├── workers/sha256.worker.ts
├── types/
└── styles/
```

建议主入口组件为 `FlowUpload`，支持 `v-model`，并通过 `defineExpose` 暴露 `submit`、`pause`、`resume` 等方法。对外可同时提供 `useFlowUpload()`，方便业务方在完全自定义视图时复用任务能力。

组件同时支持受控与非受控模式：传入 `modelValue` 时为受控模式，未传时由 `defaultFileList` 初始化内部列表；两者同时传入时开发环境警告，`modelValue` 优先。组件内部运行中的任务不被父组件同 UID 的状态字段覆盖；父组件应调用 `remove(uid)` 取消运行中任务。

## 3. 上传策略与任务状态

### 3.1 策略决策

默认阈值应允许覆盖，建议如下：

| 文件大小 | 默认策略 | 说明 |
| --- | --- | --- |
| `<= normalUploadThreshold`（默认 10 MiB） | 普通上传 | 单个 `multipart/form-data` 请求，降低小文件协议成本。 |
| `> normalUploadThreshold` | 分片上传 | 按 `chunkSize`（默认 5 MiB）切片。 |
| 分片数 `> 1` | 多线程分片上传 | 按 `concurrency`（默认 3，最大建议 6）并发执行。 |

“多线程”在浏览器端指并行网络请求；哈希计算放入 Web Worker。并发数应考虑网络类型、后端限流和浏览器连接限制，不能无限增大。

### 3.2 状态机

```text
idle → validating → hashing → checking → preparing → queued → uploading → merging → success
  │        │           │           │             │          │
  └──────→ rejected    └──────────→ instant-success          └──→ failed
                                                        ↕
                                                    paused / canceled
```

- `validating`：校验类型、大小、数量和自定义规则。
- `hashing`：仅在开启秒传或断点续传时计算 SHA-256。
- `checking`：向服务端查询是否已存在完整文件。
- `preparing`：创建或恢复上传会话，获取已上传分片集合。
- `queued`：已完成上传前准备，等待全局调度器分配请求槽位。
- `uploading`：普通上传或并行上传缺失分片。
- `merging`：通知服务端按分片序号合并；服务端应保证幂等。
- `paused`：中止进行中的请求但保留会话；`canceled`：主动取消并按配置清理会话。

所有网络状态切换均应是幂等的；重复点击开始、继续或重试不应制造重复上传任务。

## 4. 关键能力设计

### 4.1 普通上传

使用 `FormData` 发送文件字段及上传元数据。业务 JSON 数据不应被隐式展平，默认序列化后写入一个字段，例如 `data`：

```ts
formData.append('file', file)
formData.append('data', JSON.stringify(options.data ?? {}))
```

可配置 `fileFieldName`、`dataFieldName`，也可在传输适配器中改成服务端要求的格式。请求头可通过静态对象或异步函数提供，以支持 token 刷新。

### 4.2 分片与并发

- 每个分片附带 `uploadId`、`chunkIndex`、`totalChunks`、`chunkSize`、`fileName`、`fileSize`、`sha256`。
- 分片序号从 `0` 开始，合并时服务端按序号而非到达顺序拼接。
- 调度器仅派发未完成分片，并保持在途请求数不超过 `concurrency`。
- 单分片失败按指数退避重试，默认最多 3 次；不可恢复的 4xx（除 408/429）立即失败。
- 进度为已成功字节数加当前在途分片已发送字节数之和，避免并发时百分比倒退。

SHA-256 按原始字节顺序增量计算：Worker 循环读取 `file.slice(start, end).arrayBuffer()`，对同一个哈希上下文执行 `update()`，最后仅执行一次 `digest()`。分片大小不影响最终结果；不得文本解码、转码、遗漏或重叠读取任何字节。哈希计算支持取消；Worker 不可用时降级为主线程分批计算并让出事件循环。

所有文件共享 `ChunkScheduler` 的全局请求池。普通上传占用一个请求槽位，每个在途分片占用一个请求槽位；默认最多 2 个文件处于上传阶段、最多 6 个上传请求在途，且单文件最多 3 个分片并发。新任务按 FIFO 入队，暂停、取消、失败和退避等待均立即释放槽位；恢复任务排到队尾。调度器应保证活跃文件间不会长期饥饿。

### 4.3 断点续传

通过 `resume` 开关启用，默认建议开启。组件不使用 IndexedDB 或其他浏览器持久化存储；恢复标识由当前用户身份与 `sha256 + size` 构成，文件名和 `lastModified` 仅可作为辅助信息。

1. 用户选择文件后，组件计算 SHA-256，并调用接入方实现的 `initMultipart`。
2. 接入方后端根据“当前用户 + 文件哈希 + 文件大小”（及必要的业务隔离字段）创建或返回未完成会话。
3. 后端响应 `uploadId` 和 `uploadedChunks`；组件只上传该列表中缺失的分片。
4. 合并成功、主动取消或服务端会话过期后，由服务端清理会话和临时分片。

网络中断时，只要页面仍存活，组件保留内存中的 `uploadId` 并可立即继续。页面刷新或重新打开后，浏览器不能无授权地重新读取此前选择的本地文件；用户重新选择同一文件即可触发上述 `initMultipart` 流程，后端返回已有进度，组件随即续传。该方案不依赖客户端持久化，后端是唯一状态来源。

组件库只定义 `UploadTransport` 协议，不提供或要求固定后端接口。实际使用者应在项目中实现该接口，将其自有上传服务、网关或对象存储签名流程映射进来。

### 4.4 SHA-256 秒传

- `instantUpload` 开关控制，默认开启。
- 计算完成后调用 `checkFile({ sha256, size, name, mimeType })`。
- 若响应 `exists: true`，任务直接进入 `success`，并使用响应中的 `fileId`、`url`、`thumbnailUrl` 等文件信息。
- 若文件不存在，继续初始化上传；哈希值同时作为断点匹配和服务端去重的主键。

哈希命中后的业务文件记录创建、访问权限与关联关系均由接入方服务端处理；组件仅消费返回的统一结果。

## 5. 对外 API

### 5.1 组件 Props

```ts
interface UploadProps {
  modelValue?: UploadFileItem[]
  defaultFileList?: UploadFileItem[]
  transport: UploadTransport
  downloadTransport?: DownloadTransport
  removeRemoteFile?: (file: UploadFileItem, context: RequestContext) => Promise<void>
  data?: Record<string, unknown> | (() => Record<string, unknown> | Promise<Record<string, unknown>>)
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
  fileFieldName?: string                 // 默认 'file'
  dataFieldName?: string                 // 默认 'data'
  accept?: string | string[]
  maxSize?: number                       // 单位 byte
  maxCount?: number
  autoUpload?: boolean                   // 默认 true
  resume?: boolean                       // 默认 true
  instantUpload?: boolean                // 默认 true
  normalUploadThreshold?: number         // 默认 10 * 1024 * 1024
  chunkSize?: number                     // 默认 5 * 1024 * 1024
  concurrency?: number                   // 默认 3
  maxConcurrentFiles?: number            // 默认 2
  maxConcurrentRequests?: number         // 默认 6
  queueStrategy?: 'fifo'
  retryCount?: number                    // 默认 3
  retryBaseDelay?: number                // 默认 500 ms
  retryMaxDelay?: number                 // 默认 10_000 ms
  credentials?: RequestCredentials       // 默认 'same-origin'
  timeout?: number                       // 单请求超时，默认 60_000 ms
  listType?: 'list' | 'picture-card'
  theme?: 'default' | 'element-plus' | 'ant-design-vue' | ThemeAdapter
  draggable?: boolean                    // 默认 true
  pasteable?: boolean                    // 默认 true，支持从剪贴板粘贴文件
  sortable?: boolean                     // 默认 false，允许拖拽调整文件展示顺序
  disabled?: boolean
  permissions?: UploadPermissions
  preview?: boolean                      // 默认 true
  selectable?: boolean                   // 默认 false，用于多文件打包下载
  archivePollingInterval?: number        // 默认 2_000 ms
  archivePollingTimeout?: number         // 默认 10 分钟
  allDownloadScope?: DownloadScope
  beforeUpload?: (file: File) => boolean | Promise<boolean>
  beforeRemove?: (file: UploadFileItem) => boolean | Promise<boolean>
  onPreview?: (file: UploadFileItem) => void | Promise<void>
}

interface UploadPermissions {
  select?: boolean       // 默认 true
  upload?: boolean       // 默认 true
  remove?: boolean       // 默认 true
  preview?: boolean      // 默认 true
  retry?: boolean        // 默认 true
  download?: boolean     // 默认 true
  downloadAll?: boolean  // 默认 true
}
```

`accept` 仅用于文件选择器提示，组件仍会在客户端校验 MIME 类型、扩展名和大小；服务端侧的安全校验与策略不属于本组件库范围。

### 5.2 事件与实例方法

```ts
type UploadEmits = {
  'update:modelValue': [files: UploadFileItem[]]
  change: [file: UploadFileItem, files: UploadFileItem[]]
  progress: [file: UploadFileItem, percent: number]
  success: [file: UploadFileItem, response: UploadSuccessResult]
  error: [file: UploadFileItem, error: UploadError]
  remove: [file: UploadFileItem]
  exceed: [files: File[]]
  'download-start': [file: UploadFileItem]
  'download-success': [file: UploadFileItem]
  'download-error': [file: UploadFileItem, error: UploadError]
  'archive-start': [task: ArchiveTask, fileIds: string[]]
  'archive-progress': [task: ArchiveTask]
  'archive-success': [task: ArchiveTask]
  'archive-error': [task: ArchiveTask, error: UploadError]
  reorder: [files: UploadFileItem[]]
  'paste-error': [error: UploadError]
}

interface UploadExposed {
  submit(): Promise<void>
  pause(uid: string): void
  resume(uid: string): Promise<void>
  retry(uid: string): Promise<void>
  remove(uid: string): Promise<void>
  download(uid: string): Promise<void>
  downloadSelected(uids: string[]): Promise<void>
  downloadAll(scope?: DownloadScope): Promise<void>
  cancelArchive(taskId: string): Promise<void>
  removeSelected(uids: string[]): Promise<void>
  clear(): Promise<void>
}
```

当 `autoUpload: false` 时，选择文件仅创建 `idle` 任务，由父组件调用 `submit()` 或界面“开始上传”按钮触发。

### 5.3 文件数据模型

```ts
interface UploadFileItem {
  uid: string
  fileId?: string
  file?: File
  name: string
  size: number
  type: string
  status: UploadStatus
  percent: number
  sha256?: string
  uploadId?: string
  url?: string
  thumbnailUrl?: string
  response?: UploadSuccessResult
  error?: UploadError
  source: 'local' | 'remote'
}

type UploadStatus = 'idle' | 'validating' | 'hashing' | 'checking' | 'preparing' | 'queued' | 'uploading' | 'paused' | 'merging' | 'success' | 'failed' | 'canceled' | 'rejected'
```

远程回显项应至少提供 `uid`（建议 `remote:${fileId}`）、`fileId`、`name`、`size`、`type`、`status: 'success'`、`percent: 100` 与 `source: 'remote'`；其 `file` 为空，只可执行预览、下载和删除等权限允许的操作。`removeRemoteFile` 未提供时，删除远程项仅从前端列表移除，不默认删除物理文件。

父组件传入未知 `uid` 时组件将其视为远程成功项；移除某个运行中 `uid` 时组件先取消任务；更新同 UID 的名称、URL 等展示字段时合并更新。父组件不应直接修改运行中的 `status`、`file`、`sha256`、`uploadId`，开发环境应发出警告并保持任务状态不变。

## 6. 后端传输协议

以下为组件库向服务端开发者提供的**契约规范**；实际 URL、鉴权方式、服务端语言、存储和部署方式由接入方自行决定，并通过 `UploadTransport` 实现适配。组件库不约束服务端内部实现。

| 操作 | 建议方法 | 请求核心字段 | 响应核心字段 |
| --- | --- | --- | --- |
| 秒传检查 | `POST /uploads/check` | `sha256`、`size`、`name` | `exists`、`file` |
| 创建/恢复会话 | `POST /uploads/init` | 文件元数据、`sha256`、分片参数、`data` | `uploadId`、`uploadedChunks`、`expiresAt` |
| 普通上传 | `POST /uploads/file` | `file`、`data` | `file` |
| 上传分片 | `PUT /uploads/{uploadId}/chunks/{index}` | 二进制分片及元数据 | `etag` / `index` |
| 查询状态 | `GET /uploads/{uploadId}` | - | `uploadedChunks`、会话状态 |
| 合并分片 | `POST /uploads/{uploadId}/complete` | `sha256`、`data` | `file` |
| 取消会话 | `DELETE /uploads/{uploadId}` | - | 成功状态 |
| 单文件下载 | `POST /downloads/file` | `fileId` | 短时效下载 URL 或二进制流 |
| 创建打包下载 | `POST /downloads/archives` | `fileIds`、`archiveName` | `taskId`、任务状态 |
| 查询打包任务 | `GET /downloads/archives/{taskId}` | - | 状态、短时效下载 URL |

为保证组件的重试和续传逻辑可用，服务端实现应使 `init`、分片上传、`complete` 和 `check` 具备幂等语义；除此之外的存储、权限、去重、会话与清理策略由接入方服务端自行决定。

```ts
interface FileMeta {
  name: string; size: number; mimeType: string; sha256: string; lastModified: number
}
interface MultipartInitInput extends FileMeta {
  chunkSize: number; totalChunks: number; data: Record<string, unknown>
}
interface MultipartSession {
  uploadId: string; uploadedChunks: number[]; expiresAt?: string
}
interface UploadChunkInput {
  uploadId: string; chunkIndex: number; totalChunks: number; chunk: Blob; chunkSize: number; file: FileMeta
}
interface UploadSuccessResult {
  fileId: string; name: string; size: number; mimeType: string
  url?: string; thumbnailUrl?: string; instantUpload?: boolean; raw?: unknown
}
type UploadErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'FILE_NOT_FOUND' | 'SESSION_EXPIRED' | 'SESSION_NOT_FOUND' | 'CHUNK_CONFLICT' | 'CHUNK_INVALID' | 'FILE_TOO_LARGE' | 'FILE_TYPE_NOT_ALLOWED' | 'QUOTA_EXCEEDED' | 'SERVER_ERROR' | 'UNKNOWN'
interface UploadError extends Error {
  code: UploadErrorCode; status?: number; retriable: boolean; cause?: unknown
}
interface RequestContext {
  headers: Record<string, string>; data: Record<string, unknown>
}
interface UploadRequestContext extends RequestContext {
  signal: AbortSignal; onProgress: (loaded: number, total: number) => void
}
interface UploadTransport {
  checkFile(input: FileMeta, context: RequestContext): Promise<{ exists: boolean; file?: UploadSuccessResult }>
  uploadFile(input: { file: File; data: Record<string, unknown> }, context: UploadRequestContext): Promise<UploadSuccessResult>
  initMultipart(input: MultipartInitInput, context: RequestContext): Promise<MultipartSession>
  uploadChunk(input: UploadChunkInput, context: UploadRequestContext): Promise<void>
  getMultipartStatus?(uploadId: string, context: RequestContext): Promise<{ uploadedChunks: number[] }>
  completeMultipart(uploadId: string, input: { sha256: string; data: Record<string, unknown> }, context: RequestContext): Promise<UploadSuccessResult>
  cancelMultipart?(uploadId: string, context: RequestContext): Promise<void>
}

/**
 * 下载协议完全由接入方实现，组件不内置下载接口地址或后端压缩逻辑。
 * 多文件与全部下载均通过 createArchive 交由服务端异步打包。
 */
interface DownloadTransport {
  downloadFile(input: { fileId: string; fileName: string }, context: RequestContext): Promise<DownloadResource>
  createArchive(input: { fileIds?: string[]; scope?: DownloadScope; archiveName?: string }, context: RequestContext): Promise<ArchiveTask>
  getArchiveTask(taskId: string, context: RequestContext): Promise<ArchiveTask>
  cancelArchive?(taskId: string, context: RequestContext): Promise<void>
}

interface DownloadResource {
  fileName?: string
  url?: string
  blob?: Blob
}

interface ArchiveTask {
  taskId: string
  status: 'pending' | 'processing' | 'success' | 'failed' | 'canceled'
  progress?: number
  fileName?: string
  downloadUrl?: string
  errorMessage?: string
}
type DownloadScope =
  | { type: 'file-ids'; fileIds: string[] }
  | { type: 'server-query'; queryKey: string; query: Record<string, unknown> }
```

## 7. UI、主题与交互

### 7.1 默认样式

默认主题应是独立 CSS，不要求安装第三方组件库。提供 CSS Variables（如 `--vfu-primary`、`--vfu-border-color`、`--vfu-radius`）供业务覆盖。上传百分比使用 CSS `transition` 或动画库平滑过渡；真实数值以事件上报为准，动画不能伪造完成状态。

### 7.2 主题适配

`theme` 采用适配器模式：核心只输出状态和动作，适配器负责渲染对应库的 UI。Element Plus、Ant Design Vue 应作为可选 peer dependency，按需导入，避免默认包体积引入两套组件库。

适配器至少统一以下能力：选择区域、拖拽区域、文件项、进度条、操作按钮、预览弹窗与错误提示。若未安装所选依赖，应在开发环境给出明确警告并回退默认主题。

### 7.3 列表、图片墙与预览

- `listType: 'list'`：显示文件名、大小、状态、进度和操作。
- `listType: 'picture-card'`：图片显示缩略图和遮罩进度；非图片显示文件类型占位图。
- 本地图片缩略图使用 `URL.createObjectURL`，文件移除/组件卸载时必须 `revokeObjectURL`。
- 成功后优先使用服务端 `thumbnailUrl`/`url`。预览支持本地图片和远程图片，非图片交由 `onPreview` 回调自定义处理。

### 7.4 下载

下载仅对状态为 `success` 且含服务端 `fileId` 的文件可用，并遵循 `permissions.download`、`permissions.downloadAll`。`downloadTransport` 未传入时不显示下载入口。

- **单文件下载**：文件项提供下载操作，调用 `downloadFile` 获取短时效 URL 或 Blob 后，触发浏览器下载。
- **多文件打包下载**：列表开启多选后，调用 `downloadSelected(uids)`；组件将选中成功文件的 `fileId` 传给 `createArchive`。
- **全部下载**：调用 `downloadAll()`；未传 `scope` 时只下载当前 `modelValue` 中的成功文件（“当前列表全部”）。跨分页或按筛选条件的真正“全部下载”必须传入 `server-query` 范围，由后端决定文件集合。

压缩包由后端异步生成，前端不读取文件后自行压缩。`createArchive` 返回 `pending`/`processing` 时，组件默认每 2 秒轮询 `getArchiveTask`，最长 10 分钟；接入方也可以通过 WebSocket、SSE 或外部事件通知任务完成。任务支持取消并在成功后使用短时效 `downloadUrl` 下载。

### 7.5 拖拽与可访问性

拖放区处理 `dragenter`、`dragover`、`dragleave`、`drop`，并阻止浏览器默认打开文件行为。选择区域必须保留键盘可访问的 `<input type="file">` 或等价控件，进度通过 `aria-live` 适度播报，不能只依赖颜色区分状态。

### 7.6 粘贴、排序、批量操作与国际化

- `pasteable: true` 时，组件监听自身容器或指定目标的 `paste` 事件，从 `ClipboardEvent.clipboardData.files/items` 提取文件后，复用与文件选择、拖拽完全相同的校验与入队流程；剪贴板中没有文件时忽略。
- 初版不支持目录上传，也不处理粘贴/拖拽中的目录条目。
- `sortable: true` 时，用户可拖拽调整文件展示顺序；组件更新 `v-model` 并触发 `reorder`，排序只影响前端展示与传给业务方的文件顺序，不修改服务端文件内容。
- 批量删除通过多选与 `removeSelected(uids)` 实现。它逐个复用 `beforeRemove` 和 `removeRemoteFile`，任何失败项保留并通过 `error` 事件报告，其他项继续处理。
- 国际化采用 `locale` 与 `messages` 配置。组件内置 `zh-CN`、`en-US` 文案；业务方可覆盖任意键，第三方主题适配器应复用同一套翻译键。

```ts
interface UploadProps {
  locale?: 'zh-CN' | 'en-US' | string
  messages?: Partial<UploadMessages>
}

interface UploadMessages {
  selectFile: string
  dragHint: string
  pasteHint: string
  startUpload: string
  pause: string
  resume: string
  retry: string
  remove: string
  download: string
  downloadAll: string
  uploadFailed: string
}
```

## 8. 校验、异常与安全

- 上传前校验：数量、字节大小、`accept`、自定义 `beforeUpload`；失败进入 `rejected` 并触发错误事件。
- 网络错误可重试，鉴权失败应将刷新 token 的策略交给 `headers` 函数或 HTTP 客户端。
- `headers` 在秒传、初始化、每个分片、合并、下载和任务轮询前动态解析。`FormData` 请求不允许手动设置 `Content-Type`，浏览器负责写入 boundary；分片二进制请求由适配器设置 `application/octet-stream`。
- 请求支持 `credentials`、超时与重试退避。超时、网络错误、408、429、5xx 可重试；401 由适配器刷新鉴权后重试一次；403、文件校验失败、配额不足及其他明确 4xx 不重试。
- 取消、暂停使用 `AbortController`；暂停不删除服务端会话，取消是否删除服务端会话由 `cancelMultipart` 的接入方实现决定。
- 不在日志、错误消息或组件状态中暴露 `Authorization` 等敏感请求头。
- 服务端安全校验、访问控制、临时资源处理等内部策略不属于本组件库范围；前端只通过既定传输契约调用并处理结果。
- 对象 URL、Worker 与 AbortController 应在任务完成、移除或组件卸载时释放。

## 9. 默认配置建议

```ts
export const defaultUploadOptions = {
  autoUpload: true,
  resume: true,
  instantUpload: true,
  normalUploadThreshold: 10 * 1024 * 1024,
  chunkSize: 5 * 1024 * 1024,
  concurrency: 3,
  maxConcurrentFiles: 2,
  maxConcurrentRequests: 6,
  retryCount: 3,
  retryBaseDelay: 500,
  listType: 'list',
  draggable: true,
  preview: true,
  permissions: { download: true, downloadAll: true },
}
```

阈值与并发应允许按后端网关限制、对象存储最小分片要求及目标用户网络状况调整。对超大文件可额外配置 `maxSize`，避免浏览器本地存储和内存压力。

## 10. 验收标准

1. 小于等于阈值的文件走一次普通上传并正确携带 JSON 数据和自定义请求头。
2. 大于阈值的文件按配置切片，任意时刻在途分片数不超过并发数，最终合并后的 SHA-256 与原文件一致。
3. 中断后重新选择同一文件，能从服务端已完成分片之后继续，且不会重复提交已完成分片。
4. 服务端返回 SHA-256 命中时，无文件/分片上传请求，任务直接成功并得到服务端文件信息。
5. 自动和手动上传、拖拽与粘贴、类型/大小限制、暂停/继续/重试/删除、批量删除、排序、只读等权限均符合配置；目录上传入口不存在。
6. 列表与图片墙正确展示状态；图片可预览；进度数值与动画平滑且不倒退。
7. 默认主题在未安装 UI 库时可独立使用；第三方主题适配不强制打包其依赖。
8. 单元测试覆盖策略决策、分片调度、进度聚合、恢复状态、错误重试、受控/非受控列表与 SHA-256 分片一致性；端到端测试覆盖普通上传、分片、秒传与断点续传主路径。
9. 任意时刻的实际在途上传请求数不超过 `maxConcurrentRequests`，单任务不超过 `concurrency`，活跃上传文件数不超过 `maxConcurrentFiles`。
10. 单文件下载可处理短时效 URL 和 Blob；多选、当前列表全部、服务端筛选范围的打包下载，以及任务轮询、失败、超时、取消和权限控制均正确工作。
11. 使用至少 1 GiB 测试文件验证哈希过程不将整个文件读入主线程内存，并覆盖 Chrome、Edge、Safari 的主流程。
12. `zh-CN`、`en-US` 默认文案和业务方覆盖文案均正确生效，第三方主题适配器复用相同翻译键。

## 11. 实施建议与阶段划分

| 阶段 | 交付内容 |
| --- | --- |
| M1：基础组件 | 默认主题、普通上传、校验、`headers/data`、自动/手动上传、列表与受控/非受控文件模型。 |
| M2：大文件调度 | 分片、全局队列、并发控制、进度聚合、暂停/取消/重试、默认 HTTP 适配器。 |
| M3：完整性与恢复 | Worker 增量 SHA-256、秒传、以服务端会话为唯一状态来源的断点续传、统一错误与鉴权策略。 |
| M4：文件消费能力 | 图片墙/预览、单文件下载、多选打包、全部下载、下载任务轮询与权限。 |
| M5：生态与质量 | Element Plus、Ant Design Vue 适配器、无障碍、单元/组件/E2E/性能测试与构建产物。 |

## 12. 已确认业务边界

- 组件库只给出前后端传输契约；接入方可按契约使用任意技术栈建设服务端。服务端采用自建上传、对象存储直传或混合模式均可，组件不关心其内部实现。
- 秒传命中后的业务文件记录创建、访问权限与关联关系属于接入方服务端职责；前端只消费统一的 `UploadSuccessResult`。
- 断点续传会话过期、取消后分片保留、文件去重与服务端临时资源清理均属于接入方服务端职责；前端仅按 `UploadTransport` 返回的会话和错误结果恢复、重试或提示用户。
- 暂不支持目录上传；初版支持粘贴上传、文件排序、批量删除和国际化。SSR、移动端兼容等扩展能力暂不纳入当前范围。
