# Vue Flow Upload 后端 API 契约

本文档定义 Vue Flow Upload 对后端的接口约定。组件**没有默认 API 地址**：业务方必须提供 `action` 或自定义 `transport`，其他端点也按需配置。下表中的“API 地址”是应填写在组件或 `createHttpUploadTransport` 配置中的端点值；内置 HTTP 请求会把相对地址与全局 `baseUrl` 拼接。

`fileId` 是持久化的业务文件记录 ID，`uploadId` 是临时分片会话 ID，二者不可混用。`data` 是调用组件时传入的业务扩展数据（如目录 ID、业务单号），为任意 JSON 对象，后端负责校验。

## `baseUrl` 与 API 地址

`baseUrl` 是在 `vueFlowUpload` 插件中配置的**内置 HTTP 请求基础路径或源站**，不是请求参数，也不是某一个后端接口：

```ts
app.use(vueFlowUpload, { baseUrl: 'https://api.example.com/v1' })
```

组件中填写相对 API 地址时，最终请求地址为 `baseUrl + API 地址`（会自动处理连接处的 `/`）：

| `baseUrl` | 组件/API 配置值 | 最终请求地址 |
| --- | --- | --- |
| `https://api.example.com/v1` | `/uploads/file` | `https://api.example.com/v1/uploads/file` |
| `/api` | `/uploads/file` | `/api/uploads/file` |
| `https://api.example.com/v1` | `https://upload.example.com/file` | `https://upload.example.com/file`（绝对 URL 不拼接） |

`baseUrl` 只对组件内置 HTTP 请求生效，包括 `action`、`createAction`、`deleteAction`、`AvatarUpload.updateAction`，以及传入 `createHttpUploadTransport` 的 `url`、`checkUrl`、`multipart.*Url`。传入自定义 `transport` 时，业务方自行负责 URL 拼接。

下表用 `/uploads/...`、`/downloads/...` 说明**示例配置值**，它们不是默认值，也不是固定路由。项目可使用任意地址，但必须保持相同接口语义。`{fileId}`、`{uploadId}`、`{index}` 是组件替换的路径模板变量。

注意：下载和归档由业务方实现 `DownloadTransport`，组件不会替它自动拼接 `baseUrl`；`/downloads/...` 仅是推荐的后端路由约定，应由该适配器按项目的 `baseUrl` 或请求客户端配置来构造。

## 接口总览

| 分类 | HTTP Method | API 地址（配置值） | 用途 | 前端配置/调用 |
| --- | --- | --- | --- | --- |
| 文件 | `POST` | `{createAction}`（示例 `/uploads/files`） | 创建或确认文件记录 | `createAction` / `createUrl` |
| 文件 | `POST` | `{checkUrl}`（示例 `/uploads/check`） | SHA-256 秒传检查 | `checkUrl` / `checkFile` |
| 文件 | `POST` 或 `PUT` | `{action}`（示例 `/uploads/file`） | 一次性上传完整文件 | `action` / `url` / `uploadFile`；由 `method` 决定 |
| 文件 | `GET` | 业务方定义（示例 `/uploads/files`） | 获取文件列表、支持分页 | 业务页面自行加载 |
| 文件 | `GET` | `downloadFile` 自行定义 | 下载单个文件 | `downloadFile` |
| 文件 | `DELETE` | `{deleteAction}`（示例 `/uploads/files/{fileId}`） | 删除文件及关联临时会话 | `deleteAction` / `deleteUrl` / `deleteFile` |
| 分片 | `POST` | `{multipart.initUrl}`（示例 `/uploads/init`） | 创建或恢复上传会话 | `multipart.initUrl` / `initMultipart` |
| 分片 | `PUT` | `{multipart.chunkUrl}`（示例 `/uploads/{uploadId}/chunks/{index}`） | 上传一个二进制分片 | `multipart.chunkUrl` / `uploadChunk` |
| 分片 | `POST` | `{multipart.completeUrl}`（示例 `/uploads/{uploadId}/complete`） | 合并并校验分片 | `multipart.completeUrl` / `completeMultipart` |
| 分片 | `DELETE` | `{multipart.cancelUrl}`（示例 `/uploads/{uploadId}`） | 取消上传会话（推荐） | `multipart.cancelUrl` / `cancelMultipart` |
| 打包 | `POST` | `createArchive` 自行定义 | 创建多文件打包任务 | `createArchive` |
| 打包 | `GET` | `getArchiveTask` 自行定义 | 查询打包任务状态 | `getArchiveTask` |
| 打包 | `DELETE` | `cancelArchive` 自行定义 | 取消打包任务（推荐） | `cancelArchive` |
| 打包 | `GET` | `downloadUrl` 指向的地址 | 下载已完成压缩包 | 响应的 `downloadUrl` |
| 头像（可选） | `PUT` | `{updateAction}`（示例 `/avatar/{fileId}`） | 替换已有头像内容 | `AvatarUpload.updateAction` |

## 公共约定

- 普通上传使用 `multipart/form-data`，浏览器负责生成 boundary；分片上传使用 `application/octet-stream`；其余控制类请求使用 `application/json`。
- 所有接口必须按当前用户、租户和业务对象鉴权；不能只信任文件名、MIME、大小和客户端哈希。
- 所有写接口应幂等：创建记录、秒传、初始化、同一分片重复写入、合并、取消和删除均应可安全重试。
- `headers`、`query` 会由前端附加到所有请求，通常用于 `Authorization` 等认证信息。生产环境使用 HTTPS。
- 默认 HTTP transport 使用 XHR：任意 2xx 都表示成功；非 2xx 会转为 `HTTP_<status>`。网络错误、超时、`408`、`429`、`5xx` 可重试，其他 `4xx` 默认不可重试。

### 文件结果 `UploadSuccessResult`

上传、秒传命中、分片合并、文件列表中的单个文件都应使用此对象。`status` 缺省等同 `success`。

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `fileId` | `string` | 成功时是 | 持久化的业务文件记录 ID。 |
| `status` | `'success' \| 'processing'` | 否 | `success` 表示可访问；`processing` 表示仍在扫描/转存，尚不可下载。 |
| `name` | `string` | 建议 | 展示文件名。 |
| `size` | `number` | 建议 | 文件字节数，非负整数。 |
| `mimeType` | `string` | 建议 | 服务端最终确认的 MIME 类型。 |
| `url` | `string` | 否 | 可访问或下载 URL，仅文件可用时返回。 |
| `thumbnailUrl` | `string` | 否 | 图片或视频缩略图 URL。 |

```json
{
  "fileId": "file_01HXYZ",
  "status": "success",
  "name": "report.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "url": "/uploads/files/file_01HXYZ/download"
}
```

### 文件元数据 `FileMeta`

用于创建文件、秒传检查和分片初始化。

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `fileId` | `string` | 否 | 客户端预生成的 ID；服务端可接受或返回新的正式 ID，后续请求必须使用响应值。 |
| `name` | `string` | 是 | 原始文件名；服务端须过滤路径和危险字符。 |
| `size` | `number` | 是 | 原始文件字节数，非负整数。 |
| `mimeType` | `string` | 是 | 浏览器声明的 MIME 类型；服务端需要自行校验。 |
| `lastModified` | `number` | 是 | 文件最后修改时间，Unix 毫秒时间戳。 |
| `sha256` | `string` | 秒传、分片时是 | 完整文件 SHA-256，64 位十六进制字符串。 |

## 文件 API

### 创建文件记录 — `POST {createAction}`（示例：`POST /uploads/files`）

上传字节之前创建或确认业务文件记录。未配置 `createUrl` 时，此接口不会被调用。

请求体为 `FileMeta`：

```json
{
  "fileId": "client-9db1",
  "name": "report.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "lastModified": 1722470400000
}
```

成功响应 `201 Created`（或 `200 OK`）：

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `fileId` | `string` | 是 | 服务端确认的文件记录 ID。 |

```json
{ "fileId": "file_01HXYZ" }
```

### 普通上传 — `{method} {action}`（示例：`POST /uploads/file`）

请求 Content-Type 为 `multipart/form-data`，不能手动指定 boundary。

| 参数位置 | 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| 表单 | `file` | `File` / 二进制 | 是 | 文件内容；默认字段名是 `file`，可由 `fileFieldName` 修改。 |
| 表单 | `fileId` | `string` | 是 | 创建接口返回或客户端生成的文件记录 ID。 |
| 表单 | `data` | `string`（JSON） | 是 | 业务扩展参数的 JSON 字符串；无数据时为 `{}`，字段名可由 `dataFieldName` 修改。 |

成功响应 `200 OK`/`201 Created`：返回 `UploadSuccessResult`。也允许 `204 No Content` 或空 2xx，但建议返回完整文件信息。

异步扫描、转存、生成预览尚未完成时：

```json
{ "fileId": "file_01HXYZ", "status": "processing" }
```

后端完成处理后必须在文件列表中返回 `status: "success"`、`url` 等最终字段；组件不会自动轮询。

### 秒传检查 — `POST {checkUrl}`（示例：`POST /uploads/check`）

请求体为 `FileMeta`，其中 `sha256` 必填。内置 transport 默认只传这些字段；若秒传需要业务 `data`，请实现自定义 `checkFile`。

成功响应 `200 OK`：

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `exists` | `boolean` | 是 | 是否命中当前用户可复用的、已完成文件。 |
| `file` | `UploadSuccessResult` | `exists=true` 时是 | 当前 `fileId` 已绑定复用内容后的文件结果。 |

```json
{ "exists": false }
```

```json
{
  "exists": true,
  "file": {
    "fileId": "file_01HXYZ",
    "status": "success",
    "name": "report.pdf",
    "size": 1048576,
    "mimeType": "application/pdf",
    "url": "/uploads/files/file_01HXYZ/download"
  }
}
```

命中时，服务端应先原子地绑定当前 `fileId` 再返回。不得把别人的进行中上传或未完成内容返回为 `exists: true`，也不得跨租户泄露文件是否存在。

### 文件列表 — `GET {业务方列表地址}`（示例：`GET /uploads/files`）

业务页面调用后，把响应转换为组件的 `v-model`/`defaultFileList`。组件自身不会请求列表。

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Query | `pagination` | `"true" \| "false"` | 否 | 是否启用分页；默认 `false`。 |
| Query | `currentPage` | 数字字符串 | `pagination=true` 时建议 | 页码，从 1 开始，默认 1。 |
| Query | `pageSize` | 数字字符串 | `pagination=true` 时建议 | 每页数量，默认 10。 |

成功响应 `200 OK`：

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `files` | `UploadSuccessResult[]` | 是 | 当前页或全部文件。 |
| `total` | `number` | 是 | 符合筛选条件的总数。 |

```json
{
  "files": [{ "fileId": "file_01HXYZ", "name": "report.pdf", "size": 1048576, "mimeType": "application/pdf", "url": "/uploads/files/file_01HXYZ/download" }],
  "total": 1
}
```

### 下载单文件 — `GET {downloadFile 定义的地址}`（示例：`GET /uploads/files/{fileId}/download`）

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Path | `fileId` | `string` | 是 | 要下载的业务文件记录 ID。 |

成功响应 `200 OK` 的响应体为原始文件二进制，`Content-Type` 为实际 MIME 类型；建议设置 `Content-Disposition: attachment; filename*=UTF-8''...`。必须重新按 `fileId` 鉴权。

### 删除文件 — `DELETE {deleteAction}`（示例：`DELETE /uploads/files/{fileId}`）

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Path | `fileId` | `string` | 是 | 要删除的业务文件记录 ID。 |

成功响应 `204 No Content`，没有响应体。重复删除仍应成功。删除时应同时清理未完成分片会话与临时对象；删除后的分片写入必须被拒绝或忽略。

## 分片 API

### 创建/恢复会话 — `POST {multipart.initUrl}`（示例：`POST /uploads/init`）

请求体在 `FileMeta` 基础上增加：

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `fileId` | `string` | 是 | 业务文件记录 ID。 |
| `sha256` | `string` | 是 | 完整文件 SHA-256。 |
| `chunkSize` | `number` | 是 | 计划分片大小，单位字节，正整数；最后一片可更小。 |
| `totalChunks` | `number` | 是 | 总分片数，正整数。 |
| `data` | `object` | 是 | 业务扩展参数；无数据为 `{}`。 |

`name`、`size`、`mimeType`、`lastModified` 均继承 `FileMeta` 且必填。

成功响应 `200 OK`：

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `uploadId` | `string` | 是 | 临时上传会话 ID。 |
| `uploadedChunks` | `number[]` | 否 | 已持久化的分片索引，从 0 开始；省略等于 `[]`。 |

```json
{ "uploadId": "upl_01HXYZ", "uploadedChunks": [0, 1, 2] }
```

服务端应按用户、租户/业务隔离域、哈希、大小与分片参数恢复未过期会话，并校验索引范围。

### 上传分片 — `PUT {multipart.chunkUrl}`（示例：`PUT /uploads/{uploadId}/chunks/{index}`）

路径参数：

| 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `uploadId` | `string` | 是 | 初始化接口返回的会话 ID。 |
| `index` | `number` | 是 | 分片索引，从 0 开始，范围 `0` 到 `totalChunks - 1`。 |

请求头：

| 请求头 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `Content-Type` | `application/octet-stream` | 是 | 请求体为原始分片字节。 |
| `X-Upload-Id` | `string` | 是 | 与路径 `uploadId` 一致，用于交叉校验。 |
| `X-Chunk-Index` | 数字字符串 | 是 | 与路径 `index` 一致。 |
| `X-Total-Chunks` | 数字字符串 | 是 | 总分片数。 |
| `X-Chunk-Size` | 数字字符串 | 是 | 客户端配置的分片大小。 |
| `X-File-Name` | URI 编码字符串 | 是 | 原始文件名。 |
| `X-File-Size` | 数字字符串 | 是 | 原始文件总字节数。 |
| `X-File-Id` | `string` | 否 | 业务文件 ID，通常会发送。 |
| `X-File-Sha256` | `string` | 否 | 完整文件 SHA-256，通常会发送。 |

请求体：当前分片的原始 `Blob`，必填。成功响应 `204 No Content`，无响应体。同一索引的相同字节重复上传应成功；字节不同应返回 `409 Conflict`，不可静默覆盖。

### 合并分片 — `POST {multipart.completeUrl}`（示例：`POST /uploads/{uploadId}/complete`）

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Path | `uploadId` | `string` | 是 | 要完成的会话 ID。 |
| Body | `fileId` | `string` | 建议 | 业务文件 ID，应与会话绑定 ID 一致。 |
| Body | `sha256` | `string` | 建议 | 完整文件 SHA-256，服务端应交叉校验。 |
| Body | `data` | `object` | 是 | 业务扩展参数；无数据为 `{}`。 |

成功响应 `200 OK`：`UploadSuccessResult`。所有分片存在后按 `index` 合并，并校验最终大小/哈希；可在异步后处理时返回 `processing`。缺片建议返回 `409`：

```json
{ "code": "CHUNKS_MISSING", "message": "仍有分片未上传", "missingChunks": [3, 4] }
```

重复调用必须返回当前文件记录状态，不能重复创建文件。

### 取消会话 — `DELETE {multipart.cancelUrl}`（示例：`DELETE /uploads/{uploadId}`）

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Path | `uploadId` | `string` | 是 | 要取消的临时会话 ID。 |

成功响应 `204 No Content`，无响应体。应清理临时分片、禁止后续写入；重复请求也应成功。这是可选端点，但生产服务建议实现并配置 `multipart.cancelUrl`。

## 打包下载 API

下载不属于 `createHttpUploadTransport` 的内置能力，业务方应实现 `DownloadTransport`。单文件下载方法 `downloadFile({ fileId, fileName })` 可以在前端返回 `{ fileName, url }` 或 `{ fileName, blob }`；无论采用哪种方式，服务端都必须按 `fileId` 重新鉴权。

### 创建打包任务 — `POST {createArchive 定义的地址}`（示例：`POST /downloads/archives`）

| 参数位置 | 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Body | `fileIds` | `string[]` | 与 `scope` 二选一 | 要打包的文件 ID，不能为空数组，后端逐个鉴权。 |
| Body | `scope` | `object \| string` | 与 `fileIds` 二选一 | 后端定义的业务范围，如订单、目录。 |
| Body | `archiveName` | `string` | 否 | 期望的压缩包名，后端需清理危险字符。 |

成功响应 `201 Created`/`200 OK`：

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `taskId` | `string` | 是 | 打包任务 ID。 |
| `status` | `'pending' \| 'processing' \| 'success' \| 'failed' \| 'canceled'` | 是 | 当前任务状态。 |
| `progress` | `number` | 否 | 进度百分比，0–100。 |
| `fileName` | `string` | 成功时建议 | 压缩包下载名。 |
| `downloadUrl` | `string` | 成功时建议 | 下载地址，仍须鉴权或签名保护。 |
| `errorMessage` | `string` | 失败时建议 | 面向用户的失败原因。 |

```json
{ "taskId": "arc_01HXYZ", "status": "processing", "progress": 35 }
```

### 查询打包任务 — `GET {getArchiveTask 定义的地址}`（示例：`GET /downloads/archives/{taskId}`）

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Path | `taskId` | `string` | 是 | 创建接口返回的任务 ID。 |

成功响应 `200 OK`：返回上一节相同的任务对象。前端在 `pending`/`processing` 时轮询，`success` 时取 `downloadUrl`。

### 取消打包任务 — `DELETE {cancelArchive 定义的地址}`（示例：`DELETE /downloads/archives/{taskId}`）

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Path | `taskId` | `string` | 是 | 要取消的任务 ID。 |

成功响应 `204 No Content`，无响应体；已结束任务可幂等成功或返回最终状态。是否实现由业务方的 `DownloadTransport.cancelArchive` 能力决定。

### 下载压缩包 — `GET {downloadUrl}`（示例：`GET /downloads/archives/{taskId}/download`）

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Path | `taskId` | `string` | 是 | 已成功的打包任务 ID。 |

成功响应 `200 OK` 为压缩包二进制流，设置正确的 `Content-Type`、`Content-Length`、`Content-Disposition`。任务未完成建议返回 `409`/`425`；无权访问返回 `403`。

## 头像替换 API（可选）

### 替换头像 — `PUT {updateAction}`（示例：`PUT /avatar/{fileId}`）

请求为 `multipart/form-data`。

| 参数位置 | 参数 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- | --- |
| Path | `fileId` | `string` | 是 | 待替换的已有头像记录 ID。 |
| Form | `file` | `File` / 二进制 | 是 | 裁剪后的头像，字段名可跟随 `fileFieldName`。 |
| Form | `data` | JSON 字符串 | 否 | 业务扩展参数。 |

成功响应 `200 OK`：`UploadSuccessResult`；文件记录不存在时返回 `404 Not Found`。

## 错误响应与生产要求

建议所有失败响应使用统一 JSON：

```json
{
  "code": "SESSION_EXPIRED",
  "message": "upload session expired",
  "retriable": false,
  "requestId": "req_01HXYZ"
}
```

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `code` | `string` | 是 | 稳定、机器可读的错误码。 |
| `message` | `string` | 是 | 错误说明。 |
| `retriable` | `boolean` | 否 | 是否建议重试。 |
| `requestId` | `string` | 否 | 链路追踪 ID。 |

推荐状态码：`400` 参数/分片非法，`401` 未登录，`403` 无权，`404` 资源不存在，`409` 冲突或缺片，`413` 过大，`415` 类型不支持，`422` 哈希校验失败，`429` 限流（应带 `Retry-After`），`5xx` 服务端异常。

### 同内容并发与完成时去重

对**已经校验完成**的内容，推荐按 `(tenantScope, sha256, size)` 建唯一键；若加密域、对象存储策略或内容规范化会影响实际字节或可见性，也必须加入唯一键。`fileId`、`uploadId` 都不能作为内容去重键。

同一内容在尚未完成时，多个用户或浏览器秒传未命中、各自建立独立会话并并发上传，是预期行为。会话必须按用户、租户/业务范围、哈希、大小、分片大小、总分片数隔离，不能把不同上传者自动合并到同一个进行中的 `uploadId`。

合并接口应在事务、数据库唯一约束或等价的分布式互斥中完成：

1. 确认会话未取消、所有分片完整，按索引合并并校验大小与 SHA-256。
2. 尝试创建正式内容对象；若唯一键已冲突，读取已存在的正式对象并丢弃本会话临时对象，而不是报上传失败。
3. 原子地将当前 `fileId` 绑定到最终内容对象；若仍需转存或后处理，持久化 `processing` 并返回该业务记录状态。

因此每个上传者可拥有不同 `fileId`、名称、目录和业务数据，而底层字节只保留一份。并发完成时若目标内容尚不可用，必须返回 `processing`，绝不能提前返回 `success`。

若后端成功响应统一包装为 `{ code, message, data }`，需在 `parseResponse` 或自定义 transport 中解包，因为内置 transport 直接读取响应 JSON。

### 验收清单

- 幂等创建文件记录；秒传命中时不再上传任何字节。
- 断点续传只提交缺失分片；重复分片和重复合并安全返回当前状态。
- 服务端按分片索引而非到达顺序合并；过期或已取消会话拒绝写入。
- 删除会清理正式文件、会话和临时对象，并确保权限、租户和业务隔离。
