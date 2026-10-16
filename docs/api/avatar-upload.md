# AvatarUpload

`AvatarUpload` 是单头像组件：选择图片后先进行 1:1 裁剪，并将结果输出为 512 × 512 图片。它只渲染 `v-model` 列表中的第一项。圆形是卡片与裁剪框的视觉遮罩，上传到服务端的文件始终是方形图片。

| Prop               | 类型                                    | 默认值     | 说明                                                        |
| ------------------ | --------------------------------------- | ---------- | ----------------------------------------------------------- |
| `v-model`          | `UploadUserFile[]`                      | —          | 单元素头像列表，组件只渲染第一项。                          |
| `belong-id`        | `string \| number`                      | 必填       | 所属业务记录 ID，写入上传请求的 JSON `data.belongId`。      |
| `belong-type`      | `string`                                | `default`  | 所属业务类型，写入上传请求的 JSON `data.belongType`。       |
| `extra`            | `Record<string, unknown>`               | —          | 扩展属性对象，写入上传请求的 JSON `data.extra`。            |
| `action`           | `string`                                | —          | 首次上传的内置端点。                                        |
| `update-action`    | `string`                                | —          | 已有头像替换时的 PUT 端点，可用 `{fileId}` 占位。           |
| `delete-action`    | `string`                                | —          | 删除已有头像的内置端点。                                    |
| `transport`        | `UploadTransport`                       | —          | 自定义上传与删除适配器。                                    |
| `data`             | `UploadData`                            | —          | 随每次上传发送的业务数据，可为异步工厂。                    |
| `accept`           | `string \| string[]`                    | —          | 可选图片类型。                                              |
| `max-size`         | `number`                                | —          | 源图片最大字节数。                                          |
| `width` / `height` | `string \| number`                      | `300`      | 头像卡片尺寸；数字按像素处理。                              |
| `disabled`         | `boolean`                               | `false`    | 禁用全部交互。                                              |
| `read-only`        | `boolean`                               | `false`    | 禁止选择、替换和删除；若 `preview` 为真仍可预览。           |
| `shape`            | `'square' \| 'circle'`                  | `'square'` | 卡片和裁剪框的视觉轮廓；圆形建议使用等宽高。                |
| `preview`          | `boolean`                               | `true`     | 是否允许预览当前头像。                                      |
| `permissions`      | `UploadPermissions`                     | `{}`       | 按操作粒度限制选择、删除和预览；未填写的操作默认为允许。    |
| `before-upload`    | `(file) => boolean \| Promise<boolean>` | —          | 客户端校验后、打开裁剪器前执行；返回 `false` 或 reject 时中止。 |
| `locale`           | `string`                                | 继承宿主   | 组件内置操作文案的语言。                                    |

首次上传走 `action` 或 `transport.uploadFile`。已有头像且配置 `update-action` 时，组件使用 `PUT` 提交 `file`、`fileId` 两个 multipart 字段；首次成功响应必须返回 `fileId`。

`belong-id` 为必填项；`belong-type` 默认为 `default`。两者和 `extra` 会合并到 multipart 的 JSON `data` 字段，分别表示所属业务记录 ID、所属类型和扩展属性；`update-action` 更新请求同样携带该字段。

只读展示可使用 `read-only`，它等价于锁定选择、替换和删除操作，但不会关闭预览：

```vue
<AvatarUpload v-model="avatarFiles" read-only shape="circle" />
```

## Events

| 事件                | 参数               | 时机                                                             |
| ------------------- | ------------------ | ---------------------------------------------------------------- |
| `update:modelValue` | `(files)`          | 受控列表更新，携带标准化后的完整列表。                           |
| `change`            | `(file, files)`    | 本地头像记录变更后发送当前记录和完整列表。                       |
| `success`           | `(file, response)` | 服务端确认上传成功后发送记录和响应。                             |
| `error`             | `(file, error)`    | 上传失败；`file` 为裁剪后的 `File`，`error` 为 `Error` 实例。    |
| `remove`            | `(file)`           | 头像删除成功后发送被删除的记录。                                 |

可直接体验[头像上传 DEMO](/demos/avatar-upload)。
