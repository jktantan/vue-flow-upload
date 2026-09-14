# FlowUpload

`FlowUpload` 用于多文件上传。`action` 是内置 XHR `transport` 的普通上传快捷写法；传入 `transport` 时由宿主完全控制请求协议，且它优先。

## 常用 Props

| Prop                 | 类型                                           | 默认值    | 说明                                                                                                             |
| -------------------- | ---------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| `v-model`            | `UploadUserFile[]`                             | —         | 受控文件列表。                                                                                                   |
| `action`             | `string`                                       | —         | 内置 XHR `transport` 的普通上传 URL 快捷写法。                                                                   |
| `transport`          | `UploadTransport`                              | —         | 上传协议适配器；可使用任意 HTTP 客户端或直传 SDK。                                                               |
| `download-transport` | `DownloadTransport`                            | —         | 下载单文件和创建服务端归档任务的协议适配器。                                                                     |
| `query-transport`    | `FileQueryTransport`                           | —         | 文件列表查询适配器；传入后组件可加载、筛选和翻页。                                                               |
| `query-on-mount`     | `boolean`                                      | `true`    | 是否在挂载时使用查询适配器加载文件列表。                                                                         |
| `accept`             | `string \| string[]`                           | —         | 扩展名或 MIME 过滤条件。                                                                                         |
| `max-size`           | `number`                                       | —         | 单文件最大字节数。                                                                                               |
| `max-count`          | `number`                                       | 无限制    | 最多保留的文件数量。                                                                                             |
| `auto-upload`        | `boolean`                                      | `true`    | 选择后是否立即上传。                                                                                             |
| `drag`               | `boolean`                                      | `true`    | 是否允许拖入文件。                                                                                               |
| `multiple`           | `boolean`                                      | `true`    | 是否允许多选。                                                                                                   |
| `disabled`           | `boolean`                                      | `false`   | 禁用全部交互。                                                                                                   |
| `list-type`          | `'list' \| 'picture'`                          | `'list'`  | 文件列表显示形式；`picture` 为图片墙。                                                                           |
| `before-upload`      | `(file) => boolean \| Promise<boolean>`        | —         | 返回 `false` 或 reject 时拒绝文件。                                                                              |
| `before-remove`      | `(file, files) => boolean \| Promise<boolean>` | —         | 返回 `false` 或 reject 时阻止删除。                                                                              |
| `belong-id`          | `string \| number`                             | 必填      | 所属业务记录 ID，写入上传请求的 JSON `data.belongId`。                                                           |
| `belong-type`        | `string`                                       | `default` | 所属业务类型，写入上传请求的 JSON `data.belongType`。                                                            |
| `extra`              | `Record<string, unknown>`                      | —         | 扩展属性对象，写入上传请求的 JSON `data.extra`；query-transport 用其做项目特定匹配，深度变化会从第一页重新加载。 |

## 大文件 Props

| Prop                      | 默认值   | 说明                            |
| ------------------------- | -------- | ------------------------------- |
| `normal-upload-threshold` | `10 MiB` | 超过此大小走分片流程。          |
| `chunk-size`              | `1 MiB`  | 每个分片字节数。                |
| `chunk-concurrency`       | `3`      | 单文件的并行分片数。            |
| `max-concurrent-files`    | `2`      | 同时上传的文件数。              |
| `max-concurrent-requests` | `6`      | 所有文件共享的最大请求数。      |
| `retry-count`             | `3`      | 可重试错误的额外尝试次数。      |
| `retry-base-delay`        | `500 ms` | 指数退避的初始等待时间。        |
| `resume`                  | `true`   | 是否恢复未过期的分片会话。      |
| `instant-upload`          | `true`   | 是否先计算 SHA-256 并查询秒传。 |

## Events

| 事件                | 参数               | 时机                         |
| ------------------- | ------------------ | ---------------------------- |
| `update:modelValue` | `(files)`          | 文件列表发生变化。           |
| `change`            | `(file, files)`    | 文件新增、状态或元数据变更。 |
| `progress`          | `(file, percent)`  | 上传或哈希进度变更。         |
| `success`           | `(file, response)` | 服务端确认成功。             |
| `error`             | `(file, error)`    | 校验或上传失败。             |
| `remove`            | `(file)`           | 文件被成功删除。             |
| `exceed`            | `(files)`          | 本次选择超过 `max-count`。   |
| `query-loading`     | `(isLoading)`      | 查询适配器加载状态变化。     |
| `query-success`     | `(result)`         | 文件查询成功并写入列表。     |
| `query-error`       | `(error)`          | 文件查询失败，取消请求除外。 |

## 文件状态诊断字段

当文件需要计算 SHA-256 时，`v-model` 中对应的 `UploadFileItem.hashStrategy` 会记录最终完成摘要的实现：`web-crypto`（浏览器原生）、`wasm`（`hash-wasm`）或 `local`（本地 TypeScript 回退）。该字段仅用于诊断，不影响服务端协议或摘要值。

## Slots 与实例方法

`#tip` 显示在选择区域下方；`#file` 可完全替换单个文件行。

组件实例公开 `submit()`、`abort(file?)`、`retry(uid)`、`pause(uid)`、`resume(uid)`、`remove(file)`、`clear()`、`download(uid)`、`refreshQuery()` 等方法。完整的手动调用方式见[手动上传 DEMO](/demos/manual-upload)。
