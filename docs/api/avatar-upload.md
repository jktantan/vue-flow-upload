# AvatarUpload

`AvatarUpload` 是单头像组件：选择图片后先进行 1:1 裁剪，并将结果输出为 512 × 512 图片。它只渲染 `v-model` 列表中的第一项。

| Prop               | 类型                 | 默认值  | 说明                                              |
| ------------------ | -------------------- | ------- | ------------------------------------------------- |
| `v-model`          | `UploadUserFile[]`   | —       | 单元素头像列表。                                  |
| `action`           | `string`             | —       | 首次上传的内置端点。                              |
| `update-action`    | `string`             | —       | 已有头像替换时的 PUT 端点，可用 `{fileId}` 占位。 |
| `delete-action`    | `string`             | —       | 删除已有头像的内置端点。                          |
| `transport`        | `UploadTransport`    | —       | 自定义上传与删除适配器。                          |
| `accept`           | `string \| string[]` | —       | 可选图片类型。                                    |
| `max-size`         | `number`             | —       | 源图片最大字节数。                                |
| `width` / `height` | `string \| number`   | `300`   | 头像卡片尺寸。                                    |
| `disabled`         | `boolean`            | `false` | 禁用全部交互。                                    |
| `preview`          | `boolean`            | `true`  | 是否允许预览当前头像。                            |

首次上传走 `action` 或 `transport.uploadFile`。已有头像且配置 `update-action` 时，组件使用 `PUT` 提交 `file`、`fileId` 两个 multipart 字段；首次成功响应必须返回 `fileId`。

事件包括 `update:modelValue`、`change`、`success`、`error`、`remove`。可直接体验[头像上传 DEMO](/demos/avatar-upload)。
