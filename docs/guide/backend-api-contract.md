# 后端接口协议

本页是后端与 `FlowUpload` 联调的单一协议参考。以下请求和响应对应内置 HTTP 适配器：`createHttpUploadTransport`、`createHttpDownloadTransport`、`createHttpFileQueryTransport`。若前端传入自定义 `transport`、`download-transport` 或 `query-transport`，URL、字段名和外层响应包装可自行映射；但适配器最终必须转换成这里列出的组件契约。

## 联调前的共同约定

- 所有控制面接口（创建、秒传检查、分片初始化/合并、查询、归档）使用 JSON；成功响应应直接是本页所示对象，不能额外包一层 `code`、`data`。若项目已有 `{ code, data }` 包装，请在适配器的 `parseResponse`、`parseArchiveResponse` 或 `parseResponse` 中解包。
- 普通上传使用 `multipart/form-data`，浏览器自动生成 boundary；请勿要求前端手动设置 `Content-Type`。
- `auth.headers` 会作为 HTTP 请求头发送；`auth.query` 会追加到每个内置上传、下载、查询 URL。业务归属不要放到 URL query，应放在 `data` 或 `query`。
- 任一 `2xx` 状态码都视为成功；空响应只允许普通上传、删除、分片上传和取消归档。查询、秒传检查、创建记录、分片初始化、合并和归档创建/查询必须返回 JSON。
- `fileId` 是服务端持久化文件 ID，必须稳定且可用于后续删除、下载和查询记录；不要使用客户端 `uid`。组件在未配置预创建接口时会生成 UUID 作为初始 `fileId` 并一并提交。
- 文件大小、`chunkSize`、分片字节数均以字节为单位；分片 `chunkIndex` 从 `0` 开始，页码 `currentPage` 从 `1` 开始。

## 上传流程

普通文件（不超过 `normal-upload-threshold`，默认 10 MiB）的流程是：

```text
选择文件
  → POST createUrl（可选，分配/确认 fileId）
  → POST checkUrl（可选，计算 SHA-256 后秒传检查）
  → POST/PUT url（multipart/form-data 上传二进制）
  → 返回文件结果（success 或 processing）
```

大文件（超过阈值）且配置分片能力时的流程是：

```text
选择文件
  → POST createUrl（可选）
  → POST checkUrl（可选）
  → POST multipart.initUrl（创建或恢复 uploadId）
  → 并发 PUT multipart.chunkUrl（只发送未完成的 chunkIndex）
  → POST multipart.completeUrl（服务端校验并合并）
  → 返回文件结果（success 或 processing）
```

暂停、移除或取消正在分片的文件时，前端会中止当前浏览器尚未完成的 HTTP 请求。共享会话不能由任一用户直接删除；`multipart.cancelUrl` 只应释放当前调用方的租约，服务端在没有租约且会话过期后再清理临时分片。删除已持久化文件时会调用 `deleteUrl`。只有 `checkUrl` 返回 `state: "ready"`（或兼容的 `exists: true`）后，前端才会跳过字节上传并采用返回的 `file`。

### 每个上传端点的请求与响应

| 操作 | HTTP 请求 | 请求体 / 请求头 | 成功响应 |
| --- | --- | --- | --- |
| 预创建文件 | `POST createUrl` | JSON：`FileMeta` + `data` | `{ "fileId": "file_123" }` |
| 秒传检查 | `POST checkUrl` | JSON：`FileMeta` | `{ "state": "missing" }`、`{ "state": "ready", "file": UploadSuccessResult }` 或共享上传状态 |
| 普通上传 | `POST`（默认）或 `PUT url` | `multipart/form-data`：文件字段、`fileId`、JSON 字符串 data 字段 | `UploadSuccessResult` 或空响应 |
| 初始化分片 | `POST multipart.initUrl` | JSON：`FileMeta` + `chunkSize`、`totalChunks`、`data` | `{ "uploadId": "upload_123", "state": "uploading", "uploadedChunks": [0, 1] }` |
| 上传分片 | `PUT multipart.chunkUrl` | body 为分片原始二进制；见下方请求头 | 空响应或任意合法 JSON（正文不会被使用） |
| 完成分片 | `POST multipart.completeUrl` | JSON：`fileId?`、`sha256?`、`data` | `UploadSuccessResult` |
| 取消分片 | `DELETE multipart.cancelUrl` | 无 body | 可为空 |
| 删除文件 | `DELETE deleteUrl` | 无 body | 可为空 |

#### `FileMeta`：预创建、秒传和分片初始化的文件元数据

```json
{
  "fileId": "4cb11903-6b4d-4c84-b988-a7c7d7a9f88f",
  "name": "invoice.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "lastModified": 1722470400000,
  "sha256": "可选，64 位十六进制摘要"
}
```

`sha256` 仅在启用秒传检查，或大文件启用 `resume` 时存在。预创建请求会在上述字段外增加 `data`；分片初始化还会增加 `chunkSize`、`totalChunks` 与 `data`：

```json
{
  "fileId": "file_123",
  "name": "archive.zip",
  "size": 26214400,
  "mimeType": "application/zip",
  "lastModified": 1722470400000,
  "sha256": "...",
  "chunkSize": 1048576,
  "totalChunks": 25,
  "data": {
    "belongId": "order-1001",
    "belongType": "order",
    "extra": { "category": "invoice" }
  }
}
```

`data` 来自组件的 `data` prop，并由 `belong-id`、`belong-type`、`extra` 覆盖同名字段。默认普通上传字段名为 `file` 和 `data`，可用 `file-field-name`、`data-field-name` 修改：

```text
Content-Type: multipart/form-data; boundary=…

file: <二进制文件>
fileId: file_123
data: {"belongId":"order-1001","belongType":"order","extra":{"category":"invoice"}}
```

## 极速上传与同内容并发上传

服务端必须把“内容对象”和“业务文件引用”分开：内容对象由 `sha256`、`size`、哈希算法和存储策略版本唯一确定；业务文件引用则记录当前用户、租户、业务归属及下载权限。不得仅凭 SHA-256 向调用方返回其他用户的 `fileId`、URL 或存在性信息。

`checkUrl` 的推荐响应是判别式 `state`，并且只能在内容已完成、当前调用方有权创建或读取引用时返回 `ready`：

```json
{ "state": "ready", "file": { "fileId": "file_123", "status": "success" } }
```

内容尚不存在时返回 `{ "state": "missing" }`。另一用户正在传输相同内容时返回如下状态；前端仍会调用幂等的 `initUrl` 获取权威的缺片列表，因此 `uploadId`、`uploadedChunks` 可选，仅用于诊断或展示：

```json
{ "state": "uploading", "uploadId": "upload_123", "uploadedChunks": [0, 1], "retryAfterMs": 1000 }
```

其他请求已开始合并或异步后处理时返回 `{ "state": "merging", "uploadId": "upload_123", "retryAfterMs": 1000 }`。

为兼容旧版，组件仍接受 `{ "exists": false }` 以及 `{ "exists": true, "file": ... }`；新服务端应迁移到 `state`。秒传检查发生在 `createUrl` 之前，避免命中共享内容时创建孤立的业务文件记录。未命中后，`createUrl` 必须幂等，并在后续完成时创建或确认当前调用方的业务引用。

`initUrl` 是“按内容获取或创建会话”的原子操作，不能先查询再插入。推荐为内容键建立唯一约束，或在短事务/分布式锁中完成创建。它必须始终返回相同活跃会话的权威状态：

```json
{
  "uploadId": "upload_123",
  "state": "uploading",
  "uploadedChunks": [0, 1]
}
```

`state` 省略时组件按 `uploading` 兼容处理。若会话已在合并或后处理，返回 `merging` 或 `processing`；前端不再写入分片，而是调用幂等 `completeUrl`，后端返回 `processing` 或最终文件结果。

#### 分片 PUT 请求

分片二进制不包在 `FormData` 或 JSON 中，整个 HTTP body 就是该分片。URL 中的 `{uploadId}`、`{index}` 会被替换并 URL 编码。后端按以下请求头定位与校验分片：

| 请求头 | 值 |
| --- | --- |
| `Content-Type` | `application/octet-stream` |
| `X-Upload-Id` | 当前分片会话 ID |
| `X-Chunk-Index` | 0 开始的分片序号 |
| `X-Total-Chunks` | 文件总分片数 |
| `X-Chunk-Size` | 配置的分片大小（字节） |
| `X-File-Name` | `encodeURIComponent` 后的原文件名 |
| `X-File-Size` | 原文件总字节数 |
| `X-File-Id` | 可选，持久化文件 ID |
| `X-File-Sha256` | 可选，完整文件 SHA-256 |

初始化接口返回的 `uploadedChunks` 是已成功持久化的 0 开始序号数组；前端只补传缺失索引。分片表须对 `(uploadId, chunkIndex)` 建立唯一约束，对象存储应使用固定键并采用条件写入；重复提交同一内容的分片应返回成功，字节长度、摘要或索引冲突必须拒绝。后端应仅在所有索引完整、文件校验通过后让合并接口返回成功。

## 合并完成、错误与清理

整体上传完成以服务端 `completeUrl` 的原子结果为准，而不是以浏览器完成所有 `PUT` 为准。`completeUrl` 必须幂等，并使用每个 `uploadId` 的合并锁或状态条件更新，保证只有一个请求执行合并：

1. 在事务中确认会话为 `uploading`，并将其原子切换为 `merging`；已是 `ready` 时直接返回已有结果，已是 `merging` 时返回 `processing`。
2. 校验 `0..totalChunks-1` 每个索引均存在，校验每片字节数（最后一片除外）及可选分片摘要；缺片返回 `409` 和稳定业务码 `MISSING_CHUNKS`。
3. 按索引顺序合并到临时对象，重新计算完整 SHA-256，并与 `FileMeta.sha256` 对比；不一致返回不可重试的 `422 HASH_MISMATCH`。
4. 原子发布最终对象、标记内容为 `ready`，并创建/确认当前调用方的业务文件引用；之后才返回 `UploadSuccessResult`。

推荐错误处理如下：`408`、`429`、`5xx`、网络断开可重试；`401`、`403`、`400`、分片元数据冲突和哈希不匹配不可盲目重试。客户端重试前应再次调用 `initUrl`，以处理“分片已落盘但响应丢失”的情况。合并失败时保留可恢复分片，并记录错误码、原因、`uploadId`、内容指纹、分片索引和重试次数；会话使用租约/最后活跃时间，只有所有调用方租约释放且超时后才异步清理。

#### `UploadSuccessResult`：上传、秒传命中和合并结果

```json
{
  "status": "success",
  "fileId": "file_123",
  "name": "invoice.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "url": "https://cdn.example.com/files/file_123",
  "thumbnailUrl": "https://cdn.example.com/files/file_123/thumb"
}
```

所有字段均为可选，但生产接口至少应返回 `fileId`；`name`、`size`、`mimeType`、`url`、`thumbnailUrl` 会写入前端文件行。`status` 缺省或为 `success` 时组件触发上传成功；为 `processing` 时组件保留“服务端处理中”状态，待宿主刷新查询结果后再显示最终状态。

## 下载与服务端打包

### 单文件下载

`GET downloadUrl`，其中 URL 模板 `{fileId}` 由持久化文件 ID 替换。请求没有 JSON body，成功响应必须为文件二进制。内置适配器读取为 Blob，并按照下列优先级确定保存名：

1. `Content-Disposition: attachment; filename*=UTF-8''...`
2. `Content-Disposition: attachment; filename="..."`
3. 文件列表里的 `name`

推荐响应示例：

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename*=UTF-8''invoice.pdf

<binary bytes>
```

不要让该端点返回 JSON 的 Base64 或 `{ url }`。若下载必须先换取签名 URL，请实现自定义 `DownloadTransport.downloadFile`，并返回 `{ url, fileName? }`。

### 批量归档任务

批量下载由后端异步打包。归档创建、查询、取消接口如下：

| 操作 | HTTP 请求 | body | 成功响应 |
| --- | --- | --- | --- |
| 创建任务 | `POST archive.createUrl` | `ArchiveCreateInput` JSON | `ArchiveTask` |
| 查询任务 | `GET archive.taskUrl` | 无 body | `ArchiveTask` |
| 取消任务 | `DELETE archive.cancelUrl` | 无 body | 可为空 |

默认按当前可见文件创建任务时，body 为：

```json
{
  "fileIds": ["file_123", "file_456"],
  "archiveName": "order-1001-attachments.zip"
}
```

设置 `all-download-scope` 后，组件可能使用服务端查询范围代替一长串文件 ID：

```json
{
  "scope": {
    "type": "server-query",
    "queryKey": "order-attachments",
    "query": { "orderId": "order-1001", "includeArchived": false }
  },
  "archiveName": "order-1001-attachments.zip"
}
```

另一种显式范围的 `scope` 为 `{ "type": "file-ids", "fileIds": ["file_123"] }`。服务端应只接受调用方有权限访问的文件；不能仅信任传入 ID。

`ArchiveTask` 的响应格式如下，`status` 只能为 `pending`、`processing`、`success`、`failed`、`canceled`：

```json
{
  "taskId": "archive_123",
  "status": "processing",
  "progress": 45,
  "fileName": "order-1001-attachments.zip"
}
```

成功后的轮询响应必须含 `downloadUrl`：

```json
{
  "taskId": "archive_123",
  "status": "success",
  "progress": 100,
  "fileName": "order-1001-attachments.zip",
  "downloadUrl": "https://storage.example.com/signed/archive_123"
}
```

失败任务应提供可展示的 `errorMessage`。前端只会对 `pending`、`processing` 持续轮询；`success` 开始下载 `downloadUrl`，其余终态结束流程。

## 文件查询

配置 `createHttpFileQueryTransport({ queryUrl })` 后，组件使用 `POST queryUrl`。首次挂载、`extra` 深度变更、翻页、上传完成后的刷新，以及删除成功后的回读都会触发查询；新请求会取消旧请求，后端应正确处理客户端断开。

### 查询请求

```json
{
  "query": {
    "belongId": "order-1001",
    "belongType": "order",
    "extra": {
      "keyword": "invoice",
      "status": "success"
    }
  },
  "pagination": {
    "enabled": true,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

`query` 的构造规则与上传 `data` 相同：`data` prop 为基础，`belongId`、`belongType`、`extra` 覆盖同名字段。`pagination.enabled` 始终存在：

| 模式 | 请求 pagination | 响应 pagination |
| --- | --- | --- |
| 不分页 | `{ "enabled": false }` | `{ "enabled": false }` |
| 分页 | `{ "enabled": true, "currentPage": 1, "pageSize": 20 }` | `{ "enabled": true, "currentPage": 1, "pageSize": 20, "total": 42 }` |

分页响应的 `currentPage`、`pageSize` 应为服务端实际采用的值（例如将越界页回正后的页码），`total` 是当前 `query` 条件下的总记录数。

### 查询响应与文件项

分页查询完整响应：

```json
{
  "files": [
    {
      "fileId": "file_123",
      "name": "invoice.pdf",
      "size": 1048576,
      "type": "application/pdf",
      "status": "success",
      "percent": 100,
      "url": "https://cdn.example.com/files/file_123",
      "thumbnailUrl": "https://cdn.example.com/files/file_123/thumb"
    }
  ],
  "pagination": {
    "enabled": true,
    "currentPage": 1,
    "pageSize": 20,
    "total": 42
  }
}
```

`files` 必须是数组，响应 `pagination.enabled` 必须与请求一致。每项对应 `UploadUserFile`：唯一硬性字段是 `name`，但为使文件可删除和下载，后端应至少返回 `fileId`、`name`、`size`、`type`、`status: "success"`、`percent: 100`。服务端加载的文件不要返回浏览器专属的 `file`，也不需要返回 `uid`；组件会补齐本地 `uid`。

## 错误与幂等建议

- 对普通上传、分片、合并和归档创建，建议后端以 `fileId`、`uploadId + chunkIndex`、`taskId` 实现幂等，网络重试不会产生重复对象或重复分片。
- `DELETE deleteUrl`、`DELETE multipart.cancelUrl`、`DELETE archive.cancelUrl` 建议幂等：资源已不存在也可返回 `204` 或成功状态，避免客户端重试变成错误。
- 对非 2xx 响应，组件会保留 HTTP 状态并判定 `408`、`429` 和 `5xx` 为可重试；业务不可重试错误应返回合适的 `4xx`。自定义适配器可以抛出 `{ code, message, retriable, status?, cause? }` 以提供更精确的错误语义。
- `403`、`404`、`409`、`413` 等错误的 JSON 格式由业务决定；内置适配器不会解析它们的 body。日志中请关联 `fileId`、`uploadId`、`taskId`，不要记录文件二进制或敏感认证信息。

相关 API 的前端配置见[上传传输适配器](/api/transport)、[下载传输适配器](/api/download-transport)和[文件查询传输适配器](/api/query-transport)。
