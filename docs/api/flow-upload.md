# FlowUpload

`FlowUpload` 用于多文件上传。传 `action` 时使用内置 XHR；传 `transport` 时由宿主完全控制请求协议，且 `transport` 优先。

## 常用 Props

| Prop            | 类型                                           | 默认值   | 说明                                |
| --------------- | ---------------------------------------------- | -------- | ----------------------------------- |
| `v-model`       | `UploadUserFile[]`                             | —        | 受控文件列表。                      |
| `action`        | `string`                                       | —        | 内置普通上传 URL。                  |
| `transport`     | `UploadTransport`                              | —        | 自定义上传适配器。                  |
| `accept`        | `string \| string[]`                           | —        | 扩展名或 MIME 过滤条件。            |
| `max-size`      | `number`                                       | —        | 单文件最大字节数。                  |
| `max-count`     | `number`                                       | 无限制   | 最多保留的文件数量。                |
| `auto-upload`   | `boolean`                                      | `true`   | 选择后是否立即上传。                |
| `drag`          | `boolean`                                      | `true`   | 是否允许拖入文件。                  |
| `multiple`      | `boolean`                                      | `true`   | 是否允许多选。                      |
| `disabled`      | `boolean`                                      | `false`  | 禁用全部交互。                      |
| `list-type`     | `'list' \| 'picture' \| 'picture-card'`        | `'list'` | 文件列表显示形式。                  |
| `before-upload` | `(file) => boolean \| Promise<boolean>`        | —        | 返回 `false` 或 reject 时拒绝文件。 |
| `before-remove` | `(file, files) => boolean \| Promise<boolean>` | —        | 返回 `false` 或 reject 时阻止删除。 |

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

## Slots 与实例方法

`#tip` 显示在选择区域下方；`#file` 可完全替换单个文件行。

组件实例公开 `submit()`、`abort(file?)`、`retry(uid)`、`pause(uid)`、`resume(uid)`、`remove(file)`、`clear()`、`download(uid)` 等方法。完整的手动调用方式见[手动上传 DEMO](/demos/manual-upload)。
