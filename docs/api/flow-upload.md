# FlowUpload

`FlowUpload` 用于多文件上传。`action` 是内置 XHR `transport` 的普通上传快捷写法；传入 `transport` 时由宿主完全控制请求协议，且它优先。

## 常用 Props

| Prop              | 类型                             | 默认值    | 说明                                                                                                             |
| ----------------- | -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| `v-model`         | `UploadUserFile[]`               | —         | 受控文件列表，是外部事实来源。                                                                                   |
| `default-file-list` | `UploadUserFile[]`             | `[]`      | 非受控模式的初始文件列表。                                                                                       |
| `belong-id`       | `string \| number`               | 必填      | 所属业务记录 ID，写入上传请求的 JSON `data.belongId`。                                                           |
| `belong-type`     | `string`                         | `default` | 所属业务类型，写入上传请求的 JSON `data.belongType`。                                                            |
| `extra`           | `Record<string, unknown>`        | —         | 扩展属性对象，写入上传请求的 JSON `data.extra`；query-transport 用其做项目特定匹配，深度变化会从第一页重新加载。 |
| `action`          | `string`                         | —         | 内置 XHR `transport` 的普通上传 URL 快捷写法。                                                                   |
| `create-action`   | `string`                         | —         | 上传前创建或确认服务端文件记录并返回 `fileId` 的端点。                                                           |
| `delete-action`   | `string`                         | —         | 按 `fileId` 幂等删除文件及其上传会话的端点。                                                                     |
| `method`          | `'POST' \| 'PUT'`                | `'POST'`  | 内置普通上传使用的 HTTP 方法。                                                                                   |
| `transport`       | `UploadTransport`                | —         | 上传协议适配器；可使用任意 HTTP 客户端或直传 SDK。                                                               |
| `download-transport` | `DownloadTransport`           | —         | 下载单文件和创建服务端归档任务的协议适配器。                                                                     |
| `query-transport` | `FileQueryTransport`             | —         | 文件列表查询适配器；传入后组件可加载、筛选和翻页。                                                               |
| `query-on-mount`  | `boolean`                        | `true`    | 是否在挂载时使用查询适配器加载文件列表。                                                                         |
| `data`            | `UploadData`                     | —         | 随每次上传发送的业务数据，可为异步工厂；`belong-id`、`belong-type`、`extra` 覆盖同名字段。                       |
| `file-field-name` | `string`                         | `'file'`  | multipart 中二进制文件字段名。                                                                                   |
| `data-field-name` | `string`                         | `'data'`  | multipart 中 JSON 业务数据字段名。                                                                               |
| `accept`          | `string \| string[]`             | —         | 扩展名或 MIME 过滤条件。                                                                                         |
| `max-size`        | `number`                         | —         | 单文件最大字节数。                                                                                               |
| `max-count`       | `number`                         | 无限制    | 最多保留的文件数量；超出部分通过 `exceed` 事件返回。                                                            |
| `multiple`        | `boolean`                        | `true`    | 是否允许多选。                                                                                                   |
| `auto-upload`     | `boolean`                        | `true`    | 选择后是否立即上传；关闭后由实例方法 `submit()` 启动。                                                          |
| `before-upload`   | `(file) => boolean \| Promise<boolean>` | —  | 客户端校验通过后、创建上传任务前调用；返回 `false` 或 reject 时拒绝文件。                                        |
| `before-remove`   | `(file, files) => boolean \| Promise<boolean>` | — | 删除前调用；返回 `false` 或 reject 时保留文件。                                                                  |

## 大文件 Props

| Prop                      | 单位   | 默认值   | 说明                                                        |
| ------------------------- | ------ | -------- | ----------------------------------------------------------- |
| `normal-upload-threshold` | 字节   | `10 MiB` | 超过此大小走分片流程。                                      |
| `chunk-size`              | 字节   | `1 MiB`  | 每个分片字节数。                                            |
| `chunk-concurrency`       | 个     | `3`      | 单文件的并行分片数。                                        |
| `max-concurrent-files`    | 个     | `2`      | 同时上传的文件数。                                          |
| `max-concurrent-requests` | 个     | `6`      | 所有文件共享的最大请求数。                                  |
| `retry-count`             | 次     | `3`      | 可重试错误的额外尝试次数。                                  |
| `retry-base-delay`        | 毫秒   | `500`    | 指数退避的初始等待时间。                                    |
| `resume`                  | —      | `true`   | 是否恢复未过期的分片会话。                                  |
| `instant-upload`          | —      | `true`   | 是否先计算 SHA-256 并查询秒传。                             |

## 显示与交互 Props

| Prop                     | 类型                          | 默认值    | 说明                                                                                     |
| ------------------------ | ----------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `list-type`              | `'list' \| 'picture'`         | `'list'`  | 文件列表显示形式；`picture` 为图片墙。                                                   |
| `show-file-list`         | `boolean`                     | `true`    | 是否渲染文件列表或图片墙。                                                               |
| `show-operation`         | `boolean`                     | `true`    | 是否渲染工具栏和行操作。                                                                 |
| `drag`                   | `boolean`                     | `true`    | 是否允许拖入文件。                                                                       |
| `directory`              | `boolean`                     | `false`   | 是否允许选择文件夹（浏览器支持时）。                                                     |
| `preview`                | `boolean`                     | `true`    | 是否允许图片预览。                                                                       |
| `selectable`             | `boolean`                     | `false`   | 是否显示批量操作选择框；仅 `success` 且带 `fileId` 的行可被选中。                        |
| `loading`                | `boolean`                     | `false`   | 在列表/图片区域显示加载遮罩；查询适配器请求期间也会自动显示。                            |
| `pagination`             | `false \| UploadPagination`   | 未设置    | 受控分页；`false` 或省略时隐藏分页器且由宿主加载页面数据。                               |
| `disabled`               | `boolean`                     | `false`   | 禁用全部交互。                                                                           |
| `permissions`            | `UploadPermissions`           | `{}`      | 按操作粒度控制选择、上传、删除、重试、预览、下载与“全部下载”；未填写的操作默认为允许。   |
| `width`                  | `string \| number`            | `'auto'`  | CSS 宽度；数字按像素处理。                                                               |
| `height`                 | `string \| number`            | `'600px'` | CSS 高度；`'auto'` 表示填满具有明确高度的父容器。                                        |
| `on-preview`             | `(file) => void \| Promise<void>` | —     | 自定义预览处理；提供后替代内置图片查看器。                                               |
| `theme`                  | `UploadTheme`                 | `'default'` | 内置主题名（`default`、`element-plus`、`ant-design-vue`）或自定义主题适配器；默认配色对齐 Element Plus，深色在 `dark` / `vfu-dark` 下生效。 |
| `archive-polling-interval` | `number`（毫秒）            | `2000`    | 服务端归档任务的轮询间隔。                                                               |
| `archive-polling-timeout` | `number`（毫秒）             | `600000`  | 服务端归档任务的最长等待时间。                                                           |
| `all-download-scope`     | `DownloadScope`               | —         | “全部下载”提交给服务端的文件范围或查询范围；未提供时使用当前列表中的已持久化文件。       |

## 国际化 Props

| Prop       | 类型                      | 默认值     | 说明                                                                              |
| ---------- | ------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `i18n`     | `FlowUploadI18nOptions`   | —          | 推荐的国际化配置，文案使用 `VueFlowUpload` 命名空间。                             |
| `locale`   | `string`                  | `'zh-CN'`  | 已废弃，请使用 `i18n.locale`。                                                    |
| `messages` | `Partial<UploadMessages>` | —          | 已废弃，请使用 `i18n.messages[locale].VueFlowUpload`。                            |

## Events

| 事件                                      | 参数                                     | 时机                                                       |
| ----------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `update:modelValue`                       | `(files)`                                | 文件列表发生变化。                                         |
| `change`                                  | `(file, files)`                          | 文件新增、状态或元数据变更。                               |
| `progress`                                | `(file, percent)`                        | 传输或哈希进度变更，百分比范围为 0–100。                   |
| `success`                                 | `(file, response)`                       | 服务端确认成功。                                           |
| `error`                                   | `(file, error)`                          | 校验或上传失败；单文件下载失败时也会同时发送。             |
| `remove`                                  | `(file)`                                 | 文件被成功删除。                                           |
| `exceed`                                  | `(files)`                                | 本次选择超过 `max-count`。                                 |
| `download-start` / `download-success`     | `(file)`                                 | 单文件下载开始、成功。                                     |
| `download-error`                          | `(file, error)`                          | 单文件下载失败。                                           |
| `archive-start`                           | `(taskId, fileIds)`                      | 服务端归档任务创建后。                                     |
| `archive-progress`                        | `(taskId, percent?)`                     | 归档轮询上报进度；服务端未提供百分比时 `percent` 为 undefined。 |
| `archive-success`                         | `(taskId)`                               | 归档完成并开始下载归档文件。                               |
| `archive-error`                           | `(taskId, error)`                        | 归档创建或轮询失败；创建阶段失败时 `taskId` 为空字符串。   |
| `query-loading`                           | `(isLoading)`                            | 查询适配器加载状态变化。                                   |
| `query-success`                           | `(result)`                               | 文件查询成功并写入列表。                                   |
| `query-error`                             | `(error)`                                | 文件查询失败，取消请求除外。                               |
| `update:pagination`                       | `(value)`                                | 受控分页值变化。                                           |
| `pagination-change`                       | `(currentPage, pageSize)`                | 用户翻页；配置 query-transport 时组件随后加载目标页。      |

## 文件状态诊断字段

当文件需要计算 SHA-256 时，`v-model` 中对应的 `UploadFileItem.hashStrategy` 会记录最终完成摘要的实现：`web-crypto`（浏览器原生）、`wasm`（`hash-wasm`）或 `local`（本地 TypeScript 回退）。该字段仅用于诊断，不影响服务端协议或摘要值。

## Slots 与实例方法

`#tip` 显示在选择区域下方；`#file` 可完全替换单个文件行，插槽属性为 `file`、`remove`、`preview`、`download`、`pause`、`resume`、`retry`。

组件实例公开以下方法：

| 方法                              | 说明                                                |
| --------------------------------- | --------------------------------------------------- |
| `submit()`                        | 启动所有 `idle` 状态文件的上传。                    |
| `abort(file?)`                    | 暂停一个文件；省略参数时暂停全部文件。              |
| `pause(uid)` / `resume(uid)`      | 暂停或继续指定文件。                                |
| `retry(uid)`                      | 重新上传指定文件。                                  |
| `remove(uid \| file)`             | 删除指定文件，必要时先弹出确认框；返回是否已移除。  |
| `clear()` / `clearFiles()`        | 清空文件列表并释放相关资源。                        |
| `handleStart(file)`               | 以单个 `File` 走完整的选择、校验和入队流程。        |
| `handleRemove(uid \| file)`       | `remove` 的便捷包装，可接收完整文件项。             |
| `download(uid)`                   | 下载单个已持久化文件。                              |
| `downloadSelected(uids)`          | 为指定文件创建服务端归档任务并下载。                |
| `downloadAll()`                   | 按 `all-download-scope` 或当前列表下载全部文件。    |
| `cancelArchive(taskId)`           | 取消未完成的归档任务。                              |
| `refreshQuery()`                  | 立即按当前 `extra` 和分页重新查询服务端文件列表。   |

完整的手动调用方式见[手动上传 DEMO](/demos/manual-upload)。
