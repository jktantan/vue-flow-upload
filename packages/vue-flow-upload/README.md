# vue-flow-upload

面向 Vue 3 的上传组件：普通文件上传开箱即用，并为大文件提供分片、断点续传、SHA-256 秒传、并发调度、失败重试和下载归档。

## 安装与最小使用

```bash
pnpm add vue-flow-upload
```

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

const files = ref<UploadFileItem[]>([])
</script>

<template>
  <FlowUpload
    v-model="files"
    action="/api/files"
    drag
    accept="image/*,.pdf"
    :max-size="20 * 1024 * 1024"
  >
    <template #tip>单个文件不超过 20 MB</template>
  </FlowUpload>
</template>
```

`action` 使用内置 XHR（支持 `method`、`with-credentials`、`headers`、`data`）；需要秒传、分片或自定义协议时传入 `transport`。两者同时提供时优先使用 `transport`。

```ts
import { createHttpUploadTransport } from 'vue-flow-upload'

const transport = createHttpUploadTransport({
  url: '/uploads/file',
  checkUrl: '/uploads/check',
  multipart: {
    initUrl: '/uploads/init',
    chunkUrl: '/uploads/{uploadId}/chunks/{index}',
    completeUrl: '/uploads/{uploadId}/complete',
    cancelUrl: '/uploads/{uploadId}',
  },
})
```

## 国际化

内置语言文件位于 `src/i18n/lang`，文案统一使用 `VueFlowUpload.*` 命名空间。为多个组件统一语言时，在宿主应用安装一个实例：

```ts
import { createApp } from 'vue'
import { createFlowUploadI18n } from 'vue-flow-upload'

createApp(App).use(createFlowUploadI18n({ locale: 'en-US' }))
```

组件会优先复用宿主的 i18n 实例。需要某个组件独立覆盖时传入 `i18n`：

```vue
<FlowUpload
  :i18n="{
    locale: 'en-US',
    messages: {
      'en-US': { VueFlowUpload: { selectFile: 'Choose attachments' } },
    },
  }"
/>
```

旧的 `locale` 与扁平 `messages` 属性继续可用，但建议迁移到 `i18n`。

## 常用属性

| 属性                                                             | 说明                                                                            | 默认值                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------- |
| `action` / `transport`                                           | 简单上传地址 / 自定义上传协议（二选一）                                         | —                            |
| `v-model`、`default-file-list`                                   | 文件列表；回显只需 `{ name, url?, fileId? }`                                    | `[]`                         |
| `multiple`、`max-count`、`max-size`、`accept`                    | 选择和校验限制                                                                  | `true`、无限制、无限制、全部 |
| `auto-upload`                                                    | 选择后立刻上传；关闭后调用实例 `submit()`                                       | `true`                       |
| `drag`、`directory`                                              | 拖拽区域、浏览器支持的目录选择                                                  | `false`、`false`             |
| `width`、`height`                                                | 上传组件的 CSS 尺寸；数字按 px 处理。`height="auto"` 会填满具有明确高度的父容器 | `auto`、`300px`              |
| `show-file-list`                                                 | 是否渲染内置列表                                                                | `true`                       |
| `list-type`                                                      | `list`、`picture`、`picture-card`                                               | `list`                       |
| `data`、`headers`                                                | 对象或返回对象的异步函数                                                        | `{}`                         |
| `normal-upload-threshold`、`chunk-size`                          | 超过阈值时走分片；需 transport 支持分片                                         | 10 MiB、5 MiB                |
| `concurrency`、`max-concurrent-files`、`max-concurrent-requests` | 分片/文件/请求并发限制                                                          | 3、2、6                      |
| `resume`、`instant-upload`                                       | 续传和 SHA-256 秒传                                                             | `true`、`true`               |
| `before-upload`、`before-remove`                                 | 返回 `false` 或 reject 可阻止上传/删除                                          | —                            |

## 事件、插槽与实例

事件：`change(file, files)`、`progress(file, percent)`、`success(file, response)`、`error(file, error)`、`remove(file)`、`exceed(files)`；下载归档还会发出 `download-*` 与 `archive-*` 事件。

- `#default`：替换默认触发内容或拖拽区内容。
- `#trigger`：只替换非拖拽模式的触发器。
- `#tip`：紧跟选择区的说明。
- `#file="{ file, remove, preview, download, pause, resume, retry }"`：替换单个文件条目。

通过 `ref` 可调用 `submit()`、`abort(file?)`、`pause(uid)`、`resume(uid)`、`retry(uid)`、`remove(uid)`、`clear()`/`clearFiles()`、`handleStart(file)`、`handleRemove(file)`；此外还提供下载与归档方法。

完整后端分片协议见仓库根目录的 [`docs/backend-api.md`](../../docs/backend-api.md)。
