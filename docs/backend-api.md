# Vue Flow Upload 后台 API 契约

本文档是 `UploadTransport`、`DownloadTransport` 的 HTTP 映射示例，不是组件强制的固定路由。后端可使用其他路由和鉴权方式，但必须保持请求语义、幂等性和响应字段等价。

## 1. 通用约定

- 默认适配器使用 XHR；2xx 表示成功，非 2xx 被转换为 `HTTP_<status>`。408、429、5xx 和网络/超时错误可重试，其他 4xx 默认不可重试。
- JSON 使用 camelCase。除普通上传和分片上传外，控制请求为 `application/json`。普通上传的 `Content-Type` 由浏览器生成，服务端不得要求客户端手动设置 boundary。
- 所有接口按当前用户、租户和业务数据鉴权。不得仅信任文件名、MIME 或客户端哈希。
- `fileId` 是业务文件记录 ID；`uploadId` 是临时分片会话 ID。`createFile`、`checkFile`、`initMultipart`、分片上传和 `completeMultipart` 应具备幂等语义。
- 默认的同内容并发策略是“独立会话、完成时去重”：不同用户或不同浏览器上传同一内容时，各自保有业务文件记录和临时分片会话；服务端仅在文件完整、校验成功后复用正式内容对象。不得将客户端生成的 `fileId` 或临时 `uploadId` 作为内容去重键。

## 2. 文件记录与普通上传

### 2.1 创建文件记录（可选）

`POST /uploads/files`（由 `createAction` 或 `transport.createFile` 配置）

```json
{
  "name": "report.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "lastModified": 1722470400000,
  "fileId": "client-generated-id"
}
```

返回 `{ "fileId": "file_01..." }`。前端若已生成 `fileId` 也会发送它；服务端可原样接受或返回正式 ID，后续请求必须使用返回值。

### 2.2 普通上传

`POST /uploads/file`（`action`）或自定义 `uploadFile` URL。`multipart/form-data` 字段为 `file`（文件，可由 `fileFieldName` 修改）、`fileId`（必填）和 `data`（JSON 字符串，可由 `dataFieldName` 修改）。成功返回：

```json
{"fileId":"file_01...","name":"report.pdf","size":1048576,"mimeType":"application/pdf","url":"https://cdn.example/files/file_01...","thumbnailUrl":"https://cdn.example/thumbs/file_01..."}
```

`url`、`thumbnailUrl` 可选；204 或空 2xx 响应也可被内置适配器接受，但建议返回完整文件结果。

### 2.3 秒传检查（可选）

`POST /uploads/check`，由 `transport.checkFile` 实现。请求包含 `fileId`、`name`、`size`、`mimeType`、`lastModified`、`sha256`。未命中返回 `{ "exists": false }`；命中返回 `{ "exists": true, "file": { ...UploadSuccessResult } }`。命中时组件不会调用上传或分片接口。

秒传只可命中已完成且当前用户有权引用的内容对象。内容仍在上传、合并、校验失败或已删除时必须返回 `{ "exists": false }`；不能把“其他用户正在上传”返回为 `exists: true`，因为组件会立即将当前文件标记为成功，不会等待该会话完成。

当秒传命中时，服务端应原子地将本次 `fileId` 对应的业务文件记录绑定到既有内容对象，再返回该业务记录的 `UploadSuccessResult`。这避免 `createFile` 已执行但秒传命中后留下未关联的业务记录。

### 2.4 同内容并发上传与完成时去重

同一租户和同一访问隔离域内，服务端应为已校验完成的内容对象建立唯一键，推荐为 `(tenantScope, sha256, size)`；若加密域、存储策略或内容规范化规则会改变实际字节或可见性，也必须纳入该键。不得跨租户或跨访问隔离域去重或暴露内容是否存在。

多个上传者在文件尚未完成时都可能秒传未命中，并各自创建会话、并发上传相同分片。这是预期行为。每个会话按其所属用户、业务范围、哈希、大小、分片大小和总分片数进行隔离和恢复；不要把不同上传者自动合并到同一个进行中的 `uploadId`。

`completeMultipart` 必须在事务、数据库唯一约束或等价的分布式互斥下完成以下操作：

1. 确认会话未取消且所有分片完整，按 index 合并并校验文件大小和 SHA-256。
2. 尝试创建正式内容对象；第一个完成者写入内容对象。
3. 若内容唯一键冲突，读取已存在的正式内容对象，丢弃当前会话的临时对象，而不是报上传失败。
4. 原子地把当前 `fileId` 绑定到最终内容对象，并返回当前业务文件记录的 `UploadSuccessResult`。

因此，先完成者与后完成者都应得到成功结果，但可拥有不同的 `fileId`、名称、目录或业务元数据；底层字节只保留一份。若并发完成期间发现目标内容尚未处于可用状态，服务端应在锁内等待、重读或重试，绝不能返回未完成内容。

## 3. 分片上传

### 3.1 创建或恢复会话

`POST /uploads/init`，请求包含文件元数据、`sha256`、`chunkSize`、`totalChunks`、`data`；返回：

```json
{ "uploadId": "upl_01...", "uploadedChunks": [0, 1] }
```

`uploadedChunks` 可省略，省略等同空数组。服务端应按用户、业务隔离条件、哈希和大小恢复未过期会话，并校验分片范围。

### 3.2 上传分片

`PUT /uploads/{uploadId}/chunks/{index}`，请求体是 `application/octet-stream` 原始 Blob。内置适配器发送 `X-Upload-Id`、`X-Chunk-Index`（从 0 开始）、`X-Total-Chunks`、`X-Chunk-Size`、`X-File-Name`（URI 编码）、`X-File-Size`，以及可选 `X-File-Id`、`X-File-Sha256`。重复提交同一 index 且字节一致必须视为成功；不一致返回 409。

### 3.3 合并

`POST /uploads/{uploadId}/complete`，JSON 为 `{ "fileId": "...", "sha256": "...", "data": {} }`。服务端确认所有分片存在，按 index 合并并校验大小/哈希，再返回 `UploadSuccessResult`；重复调用返回同一结果。缺片建议返回 409：`{ "code": "CHUNKS_MISSING", "missingChunks": [3] }`。

### 3.4 取消与删除

`DELETE /uploads/{uploadId}` 可由 `cancelMultipart` 配置，用于取消临时会话。`DELETE /uploads/files/{fileId}`（`deleteAction` 或 `deleteFile`）应幂等删除正式文件、关联会话和临时对象，推荐返回 204。上传进行中收到删除后，后续写入必须被忽略。

## 4. 下载契约

下载不由 `createHttpUploadTransport` 提供，业务方实现 `DownloadTransport`。`downloadFile({ fileId, fileName })` 可返回 `{ fileName, url }` 或 `{ fileName, blob }`，服务端必须按 `fileId` 重新鉴权。

`createArchive({ fileIds?, scope?, archiveName? })` 返回 `{ "taskId": "arc_01...", "status": "pending", "progress": 0 }`。组件轮询 `getArchiveTask(taskId)`，状态为 `pending | processing | success | failed | canceled`。成功返回 `fileName` 与 `downloadUrl`；失败返回 `errorMessage`。`cancelArchive` 可映射为 `DELETE /downloads/archives/{taskId}`。

## 5. 错误与验收

```json
{"code":"SESSION_EXPIRED","message":"upload session expired","retriable":false,"requestId":"req_01..."}
```

建议使用 400（参数/分片非法）、401、403、404、409、413、415、429、5xx，并在 429 返回 `Retry-After`。内置适配器不解析 `{code,message,data}` 业务包装；请在自定义 transport 中解包。验收应覆盖幂等创建、秒传不上传字节、断点缺片续传、重复分片/complete、按 index 合并、过期会话拒绝写入、删除清理和权限隔离。
