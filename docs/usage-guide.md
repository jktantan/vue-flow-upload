# Vue Flow Upload 使用指南

本文面向组件使用者，说明 `FlowUpload`、`AvatarUpload` 的接入步骤、参数、事件、实例方法和接口要求。后端 HTTP 协议细节见 [backend-api.md](./backend-api.md)，组件内部设计见 [upload-component-design.md](./upload-component-design.md)。

## 1. 先选接入方式

| 场景 | 推荐方式 | 说明 |
| --- | --- | --- |
| 只有一个普通上传接口 | `action` | 最少配置，组件用内置 XHR 发送 `multipart/form-data`。 |
| 有创建、秒传、分片、续传或自定义响应包装 | `transport` | 自己实现 `UploadTransport`，完全控制请求和响应转换。 |
| 头像首次上传与 REST 更新接口不同 | `action + update-action + delete-action` | 首次走 `action`，已有头像时 `PUT update-action`。 |
| 自定义头像协议 | 仅 `transport` | 不传 `update-action`，首次和替换均调用 `transport.uploadFile`。 |

`action` 和 `transport` 同时传入时，`transport` 优先。`baseUrl` 仅处理组件内置 HTTP 请求；自定义 `transport` 自己负责拼接 URL。

## 2. 安装与全局初始化

```bash
pnpm add vue-flow-upload
```

在普通 Vue 应用中安装插件。`baseUrl` 统一处理内置接口前缀，认证信息只在此处配置一次：

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { vueFlowUpload } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

createApp(App)
  .use(vueFlowUpload, {
    baseUrl: '/api',
    auth: {
      credentials: 'include',
      headers: async () => ({ Authorization: `Bearer ${getAccessToken()}` }),
      query: { client: 'web' },
    },
    defaults: {
      chunkSize: 1024 * 1024,
      chunkConcurrency: 3,
      maxConcurrentFiles: 2,
      maxConcurrentRequests: 6,
    },
  })
  .mount('#app')
```

| 全局配置 | 含义 |
| --- | --- |
| `baseUrl` | 内置端点的基础路径或完整域名。例如 `'/api'` 加 `action='/files'` 会请求 `/api/files`。完整 `https://...` 地址不会重复拼接。 |
| `auth.credentials` | Cookie 策略。跨域且后端允许凭据时使用 `'include'`。 |
| `auth.headers` | 所有内置请求的请求头，可用异步函数在每次请求前获取最新 Token。 |
| `auth.query` | 所有内置请求追加的查询参数；不要放敏感 Token。 |
| `defaults` | `FlowUpload` 的分片、并发、重试、续传、秒传和分页默认值；组件同名 prop 会覆盖它。 |

Nuxt 使用 `vue-flow-upload/nuxt` 模块注册客户端组件；模块的 `prefix` 只影响组件名（如 `AppFlowUpload`），不是接口前缀。全局请求配置仍在客户端插件中通过 `vueFlowUpload` 设置。

## 3. 最小普通上传

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'

const files = ref<UploadFileItem[]>([])
</script>

<template>
  <FlowUpload
    v-model="files"
    action="/files"
    accept="image/*,.pdf"
    :max-size="20 * 1024 * 1024"
    :max-count="5"
    drag
  >
    <template #tip>支持图片和 PDF，单个文件不超过 20 MB</template>
  </FlowUpload>
</template>
```

首次选择文件后，组件会生成本地 `uid` 和 `fileId`，以 `multipart/form-data` 提交：

| 字段 | 含义 |
| --- | --- |
| `file` | 二进制文件；可通过 `file-field-name` 改名。 |
| `fileId` | 当前业务文件记录 ID。若配置 `create-action`，后端返回的 ID 会覆盖它。 |
| `data` | 业务数据 JSON 字符串；可通过 `data-field-name` 改名。 |

成功响应建议为：

```json
{
  "fileId": "file_123",
  "name": "report.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "url": "https://cdn.example.com/report.pdf",
  "thumbnailUrl": "https://cdn.example.com/report-thumb.png",
  "status": "success"
}
```

响应必须是组件可直接读取的 JSON；若后端统一包装为 `{ code, data }`，请使用自定义 `transport` 解包。首次上传响应应返回 `fileId`，否则后续更新、删除、下载无法定位服务端文件。

## 4. `FlowUpload` 参数

### 数据与请求

| 参数 | 类型 / 默认值 | 用途 |
| --- | --- | --- |
| `v-model` | `UploadUserFile[]` | 受控文件列表；组件状态变化会发出 `update:modelValue`。 |
| `default-file-list` | `UploadUserFile[]` / `[]` | 非受控模式的初始回显列表。 |
| `action` | `string` | 内置普通上传 URL。相对地址会拼接 `baseUrl`。 |
| `method` | `'POST' \| 'PUT'` / `'POST'` | 内置普通上传 HTTP 方法。 |
| `transport` | `UploadTransport` | 自定义上传协议；优先级高于 `action`。 |
| `create-action` | `string` | 上传字节前创建/确认业务文件记录，返回 `{ fileId }`。 |
| `delete-action` | `string` | 删除服务端文件的内置 `DELETE` URL；支持 `{fileId}` 模板。 |
| `data` | 对象或异步函数 | 上传请求携带的业务数据。 |
| `file-field-name` | `string` / `'file'` | multipart 二进制字段名。 |
| `data-field-name` | `string` / `'data'` | multipart JSON 数据字段名。 |

### 选择、校验与显示

| 参数 | 类型 / 默认值 | 用途 |
| --- | --- | --- |
| `accept` | `string \| string[]` | 扩展名、精确 MIME 或 `image/*` 过滤条件。服务端仍必须校验。 |
| `max-size` | `number` | 单文件最大字节数。 |
| `max-count` | `number` / 无限 | 最多保留的文件数；超出的本次选择文件触发 `exceed`。 |
| `multiple` | `boolean` / `true` | 是否允许原生文件选择器多选。 |
| `drag` | `boolean` / `true` | 是否允许向组件拖入文件。 |
| `directory` | `boolean` / `false` | 请求浏览器允许选择文件夹；浏览器不支持时无效。 |
| `auto-upload` | `boolean` / `true` | 选择后立即上传；关闭时调用实例 `submit()` 或点击开始上传。 |
| `show-file-list` | `boolean` / `true` | 是否显示内置文件列表。 |
| `show-operation` | `boolean` / `true` | 是否显示工具栏和文件行操作。 |
| `list-type` | `'list' \| 'picture' \| 'picture-card'` / `'list'` | 文件列表或图片墙样式。 |
| `preview` | `boolean` / `true` | 是否允许内置图片预览。 |
| `selectable` | `boolean` / `false` | 是否显示勾选框，用于批量下载和删除。 |
| `loading` | `boolean` / `false` | 在文件区显示加载遮罩，适合列表回显请求期间使用。 |
| `width` / `height` | CSS 尺寸 / `'auto'`、`'600px'` | 根容器尺寸；数字自动转换为 px。 |
| `disabled` | `boolean` / `false` | 禁用全部交互。 |
| `permissions` | `UploadPermissions` | 细粒度控制 `select/upload/remove/retry/preview/download/downloadAll`。未填写表示允许。 |
| `before-upload` | `(file) => boolean \| Promise<boolean>` | 返回 `false` 或 reject 时将文件标记为 `rejected`。 |
| `before-remove` | `(file, files) => boolean \| Promise<boolean>` | 返回 `false` 或 reject 时取消删除。 |

### 大文件、秒传与下载

| 参数 | 类型 / 默认值 | 用途 |
| --- | --- | --- |
| `normal-upload-threshold` | `number` / 10 MiB | 大于此字节数走分片流程。 |
| `chunk-size` | `number` / 1 MiB | 单个分片字节数。 |
| `chunk-concurrency` | `number` / 3 | 每个文件并行上传的分片数。 |
| `max-concurrent-files` | `number` / 2 | 同时占用上传槽位的最大文件数。 |
| `max-concurrent-requests` | `number` / 6 | 所有文件共享的最大网络请求数。 |
| `retry-count` / `retry-base-delay` | `number` / 3、500 ms | 可重试错误的重试次数与初始指数退避时间。 |
| `resume` | `boolean` / `true` | 大文件是否请求后端恢复会话并跳过已上传分片。 |
| `instant-upload` | `boolean` / `true` | transport 实现 `checkFile` 时，先按 SHA-256 查询已完成文件。 |
| `download-transport` | `DownloadTransport` | 单文件下载和服务端打包下载的适配器。 |
| `all-download-scope` | `DownloadScope` | 全部下载范围；可传当前 fileId 列表或服务端查询范围。 |
| `archive-polling-interval` / `archive-polling-timeout` | `number` / 2 s、10 min | 服务端归档任务的轮询间隔与超时。 |

### 分页、主题与国际化

| 参数 | 类型 / 默认值 | 用途 |
| --- | --- | --- |
| `pagination` | `false \| UploadPagination` / `false` | 仅提供分页 UI 与事件；宿主负责请求指定页并回写 `v-model`。 |
| `on-preview` | `(file) => void \| Promise<void>` | 自定义预览；提供后替代内置查看器。 |
| `theme` | `'default' \| 'element-plus' \| 'ant-design-vue' \| ThemeAdapter` | 选择内置 CSS 变量预设或自定义主题适配器。 |
| `i18n` | `FlowUploadI18nOptions` | 单组件国际化配置，使用 `VueFlowUpload` 命名空间。 |
| `locale` / `messages` | 已废弃 | 兼容旧 API；新代码使用 `i18n`。 |

## 5. 事件、插槽与实例方法

| 事件 | 参数 | 触发时机 |
| --- | --- | --- |
| `change` | `(file, files)` | 文件新增或状态/元数据变化。 |
| `progress` | `(file, percent)` | 上传或哈希进度变化。100 表示后端已确认成功或处理中。 |
| `success` | `(file, response)` | 后端返回可用文件结果。 |
| `error` | `(file, error)` | 校验或上传错误。 |
| `remove` | `(file)` | 本地删除或远程清理成功后。 |
| `exceed` | `(files)` | 本次选择中超出 `max-count` 的文件。 |
| `update:pagination` | `(value)` | 分页组件改变页码或页大小。 |
| `pagination-change` | `(page, size)` | 宿主应据此加载对应文件页。 |
| `download-start/success/error` | 文件及可选错误 | 单文件下载生命周期。 |
| `archive-start/progress/success/error` | 任务 ID、进度或错误 | 服务端打包下载生命周期。 |

插槽：`#tip` 位于选择区下方；`#file="{ file, remove, preview, download, pause, resume, retry }"` 可替换单行渲染。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { UploadFileItem } from 'vue-flow-upload'

const uploader = ref<{
  submit: () => Promise<void>
  pause: (uid: string) => void
  resume: (uid: string) => Promise<void>
  remove: (uid: string) => Promise<boolean>
}>()
</script>

<template>
  <FlowUpload ref="uploader" :auto-upload="false" action="/files" />
  <button @click="uploader?.submit()">开始上传</button>
</template>
```

实例还公开 `abort(file?)`、`retry(uid)`、`clear()`/`clearFiles()`、`handleStart(file)`、`handleRemove(uid | file)`、`download(uid)`、`downloadSelected(uids)`、`downloadAll(scope?)`、`cancelArchive(taskId)`。

## 6. 头像上传

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AvatarUpload, type UploadFileItem } from 'vue-flow-upload'

const avatar = ref<UploadFileItem[]>([])
</script>

<template>
  <AvatarUpload
    v-model="avatar"
    action="/avatar"
    update-action="/avatar/{fileId}"
    delete-action="/avatar/{fileId}"
    accept="image/*"
    :max-size="5 * 1024 * 1024"
  />
</template>
```

选择图片后先出现 1:1 裁剪对话框，确认后输出 512 × 512 图片。首次上传走 `action` 或 `transport.uploadFile`；已有头像且传了 `update-action` 时会发 `PUT` 到替换后的 URL，并提交 `file`、`fileId` 两个 multipart 字段。

| 参数 | 用途 |
| --- | --- |
| `v-model` | 单元素头像列表；成功后元素包含 `fileId`、`url` 等信息。 |
| `action` | 首次上传的内置端点。 |
| `update-action` | 更新端点，`{fileId}` 被当前头像 ID 替换。必须保证首次响应含 `fileId`。 |
| `delete-action` | 删除端点；仅在使用内置 action 时生效。 |
| `transport` | 自定义上传/删除适配器。若需要它处理更新，不要传 `update-action`。 |
| `data`、`accept`、`max-size`、`width`、`height`、`disabled`、`preview`、`permissions`、`before-upload` | 含义与 FlowUpload 对应项一致，其中头像不支持多文件、列表和上传进度。 |

事件：`update:modelValue(files)`、`change(file, files)`、`success(file, response)`、`error(file, error)`、`remove(file)`。

## 7. 分片、续传与秒传：自定义 transport 示例

内置 `action` 只适合普通上传。下面的配置由 `createHttpUploadTransport` 生成完整的 HTTP 映射；后端字段和地址需与 [backend-api.md](./backend-api.md) 一致。

```ts
import { createHttpUploadTransport } from 'vue-flow-upload'

const transport = createHttpUploadTransport({
  url: '/uploads/file',
  createUrl: '/uploads/files',
  deleteUrl: '/uploads/files/{fileId}',
  checkUrl: '/uploads/check',
  multipart: {
    initUrl: '/uploads/init',
    chunkUrl: '/uploads/{uploadId}/chunks/{index}',
    completeUrl: '/uploads/{uploadId}/complete',
    cancelUrl: '/uploads/{uploadId}',
  },
})
```

```vue
<FlowUpload
  v-model="files"
  :transport="transport"
  :normal-upload-threshold="10 * 1024 * 1024"
  :chunk-size="1024 * 1024"
  :instant-upload="true"
  :resume="true"
/>
```

`checkFile` 只能命中已经可用、且当前用户有权限引用的内容；正在上传或 `processing` 的文件必须返回 `{ exists: false }`。分片端点需要幂等，重复上传同一分片不能失败。

## 8. 回显、删除和 processing 状态

回显服务器文件时至少传 `name`；建议同时传 `uid`、`fileId`、`size`、`type`、`status: 'success'`、`url`：

```ts
files.value = [{
  uid: 'file_123', fileId: 'file_123', name: '合同.pdf', size: 1048576,
  type: 'application/pdf', status: 'success', percent: 100,
  url: 'https://cdn.example.com/contract.pdf',
}]
```

已进入上传流程的文件删除时需要服务端清理能力；内置方式配置 `delete-action`，自定义方式实现 `transport.deleteFile`。后端仍在转存、扫描或转码时返回 `status: 'processing'`；组件不会自行轮询或改为成功。业务方应刷新文件列表，并在后端返回 `status: 'success'` 与最终 URL 后回写 `v-model`。
