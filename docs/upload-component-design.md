# Vue Flow Upload 组件设计文档

本文档描述仓库当前实现（`vue-flow-upload@0.1.0`），以 `packages/vue-flow-upload/src` 为准。未在本文件或公共 TypeScript 类型中出现的能力不属于当前版本契约。

## 1. 范围与架构

这是一个 Vue 3 + TypeScript 上传组件包，包含 `FlowUpload`（多文件上传）和 `AvatarUpload`（单头像裁剪上传），以及可注入的 `UploadTransport`、`DownloadTransport` 和默认 XHR 适配器。组件不负责文件存储、鉴权、病毒扫描、内容审核或对象存储 SDK；服务端通过传输接口与组件解耦。

```text
FlowUpload / AvatarUpload
          |
     useUploadQueue / useDownloadManager
          |
  ChunkScheduler + hashFile(Web Worker)
          |
 UploadTransport / DownloadTransport
          |
       业务后端或对象存储网关
```

`FlowUpload` 的核心状态由 `useUploadQueue` 管理，所有文件共享一个 `ChunkScheduler`。普通上传和每个分片请求都受 `maxConcurrentRequests`、`maxConcurrentFiles` 与单文件 `chunkConcurrency` 限制。哈希计算使用 Web Worker；组件不使用 IndexedDB，也不保存跨页面的本地上传会话。

## 2. 上传策略与状态

| 条件 | 行为 |
| --- | --- |
| 文件大小 `<= normalUploadThreshold`（默认 10 MiB） | 调用 `uploadFile`，默认 XHR 为 `multipart/form-data` |
| 文件大小超过阈值 | 要求适配器实现 `initMultipart`、`uploadChunk`、`completeMultipart`，按 `chunkSize`（默认 1 MiB）分片 |
| `instantUpload` 且实现 `checkFile` | 先计算 SHA-256 并调用秒传检查；命中后不发送文件字节 |
| 大文件且 `resume` | 先计算 SHA-256，`initMultipart` 返回已完成分片后只上传缺失分片 |

秒传是对已完成内容的服务端去重，客户端调度器不协调不同浏览器或不同用户。默认后端策略是让并发上传者各自使用独立临时会话，并在 `completeMultipart` 校验完成后以租户隔离范围内的内容哈希唯一键收敛到同一个正式内容对象；上传中的内容不得作为秒传命中。

`action` 创建的内置适配器只实现普通上传；要使用秒传、分片或删除接口，应传 `transport`，或同时配置 `createAction`、`deleteAction` 及 `action`。状态值为 `idle`、`validating`、`hashing`、`checking`、`preparing`、`queued`、`uploading`、`paused`、`merging`、`success`、`failed`、`canceled`、`rejected`。暂停会中止请求但保留内存中的会话；卸载、`clear` 或删除会释放请求、Worker、对象 URL 和轮询器。

## 3. 公共 API

### 3.1 `FlowUpload` Props

源码中的 Props 包括：`modelValue`、`defaultFileList`、`transport`、`action`、`createAction`、`deleteAction`、`method`（默认 `POST`）、`withCredentials`（默认 `false`）、`downloadTransport`、`data`、`headers`、`fileFieldName`（`file`）、`dataFieldName`（`data`）、`accept`、`maxSize`、`maxCount`、`multiple`、`autoUpload`（`true`）、`normalUploadThreshold`（10 MiB）、`chunkSize`（1 MiB）、`chunkConcurrency`（3）、`maxConcurrentFiles`（2）、`maxConcurrentRequests`（6）、`retryCount`（3）、`retryBaseDelay`（500 ms）、`resume`（`true`）、`instantUpload`（`true`）、`showFileList`、`showOperation`、`pagination`、`drag`（`true`）、`directory`（`false`）、`listType`（`list`）、`preview`（`true`）、`selectable`（`false`）、`loading`、`width`（`auto`）、`height`（`600px`）、`archivePollingInterval`（2 s）、`archivePollingTimeout`（10 min）、`allDownloadScope`、`onPreview`、`theme`、`i18n`、兼容属性 `locale/messages`、`disabled`、`permissions`、`beforeUpload`、`beforeRemove`。

`directory` 只是传递给原生文件选择器的目录选择属性；当前组件没有 `pasteable` 或 `sortable` Props，也没有排序事件。

### 3.2 事件与实例方法

事件：`update:modelValue`、`change(file, files)`、`progress(file, percent)`、`success(file, response)`、`error(file, error)`、`remove(file)`、`exceed(files)`、`download-start`、`download-success`、`download-error`、`archive-start(taskId, fileIds)`、`archive-progress(taskId, percent?)`、`archive-success(taskId)`、`archive-error(taskId)`。

实例方法：`submit()`、`abort(uid?)`、`pause(uid)`、`resume(uid)`、`retry(uid)`、`remove(uid)`、`clear()`、`clearFiles()`、`handleStart(file)`、`handleRemove(file)`、`download(uid)`、`downloadSelected(uids)`、`downloadAll(scope?)`、`cancelArchive(taskId)`。

`UploadFileItem` 必需字段是 `uid/name/size/type/status/percent`；可选字段包括 `fileId`、`file`、`remoteCreated`、`uploadId`、`sha256`、`url`、`thumbnailUrl`、`response`、`error`。`RequestContext` 包含 `headers`、`data`、`fileFieldName`、`dataFieldName`；请求上下文额外包含 `signal` 和 `onProgress`。`data` 与 `headers` 可为异步函数，每次请求惰性解析。

## 4. 视图、删除与下载

- `listType=list` 使用文件列表；`picture/picture-card` 使用图片墙；本地预览使用对象 URL，完成后优先使用服务端 `url/thumbnailUrl`。
- `theme` 可传 `'default'`、`'element-plus'`、`'ant-design-vue'` 或 `ThemeAdapter`。当前主题适配器仅提供名称/类名/变量映射，不会自动安装第三方组件库。
- 成功、上传中、失败等已进入上传流程的文件删除前显示确认框，并要求 `deleteFile`；未开始或校验拒绝的文件直接移除。没有删除能力时远程清理失败且文件保留。
- 下载必须提供 `downloadTransport`。单文件调用 `downloadFile`；多选或全部下载调用服务端异步 `createArchive`，组件按轮询间隔查询任务，直到成功、失败、取消或超时。

## 5. 限制与验收

组件默认自动上传、启用续传和秒传、允许拖拽，最大并发文件 2、最大请求 6。组件不提供粘贴上传、拖拽排序、客户端持久化会话，也不定义后端存储实现。后端必须自行校验文件大小、类型、内容和权限。

至少验证普通上传携带 `fileId` 与 JSON `data`；大文件缺失分片上传与合并；秒传命中不发送文件字节；暂停/继续/重试可取消请求；删除在后端清理成功后才移除；归档下载轮询和超时；`pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过。
