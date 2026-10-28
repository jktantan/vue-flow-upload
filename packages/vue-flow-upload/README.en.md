# vue-flow-upload

[![npm version](https://img.shields.io/npm/v/vue-flow-upload.svg)](https://www.npmjs.com/package/vue-flow-upload)
[![license](https://img.shields.io/npm/l/vue-flow-upload.svg)](https://github.com/jktantan/vue-flow-upload/blob/main/packages/vue-flow-upload/LICENSE)

[中文](https://github.com/jktantan/vue-flow-upload/blob/main/packages/vue-flow-upload/README.md) | **English** | [Русский](https://github.com/jktantan/vue-flow-upload/blob/main/packages/vue-flow-upload/README.ru.md)

Vue 3 file and avatar upload components: normal uploads work out of the box, while chunked upload, resumable sessions, SHA-256 instant upload, and concurrency scheduling cover large files, with optional downloads and server-side archives.

- **Documentation**: <https://jktantan.github.io/vue-flow-upload/en/>
- **Interactive demo**: <https://jktantan.github.io/vue-flow-upload/en/demos/full-upload.html> — switch list/picture wall, per-operation permissions, drag and drop, theme, and language live
- **Backend protocol**: <https://jktantan.github.io/vue-flow-upload/en/guide/backend-api-contract.html>

## Install

```bash
pnpm add vue-flow-upload
```

`vue` (`^3.5.0`) is a peer dependency provided by the host application; Nuxt users install Nuxt 3 or 4 themselves.

## Minimal usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

// 受控文件列表；组件通过 update:modelValue 回写完整状态。
// Controlled file list; the component writes the complete state back through update:modelValue.
const files = ref<UploadFileItem[]>([])
</script>

<template>
  <FlowUpload
    v-model="files"
    belong-id="order-1"
    action="/api/files"
    drag
    accept="image/*,.pdf"
    :max-size="20 * 1024 * 1024"
  >
    <template #tip>Up to 20 MB per file</template>
  </FlowUpload>
</template>
```

`action` is the shortcut for the built-in XHR `transport`'s normal upload and supports `method`, `data`, `create-action`, `delete-action`, and the global `auth` configuration; it implements normal uploads only. Instant upload, chunks, resume, nonstandard response shapes, or a project request wrapper need a `transport`. When both are supplied, `transport` wins, so one component instance should keep a single protocol entry point.

Authentication is configured once in `app.use(vueFlowUpload, config)`: `baseUrl` prefixes built-in HTTP endpoints, `credentials` controls cookies, `headers` adds authentication headers, and `query` adds shared URL parameters. They apply to every built-in upload, chunk, merge, delete, and avatar request; absolute `http(s)` URLs never receive the `baseUrl` prefix. Do not repeat authentication on the component, and never put sensitive tokens in `query`.

## AvatarUpload

`AvatarUpload` is a standalone single-avatar component: it crops the selected image to 1:1 and produces a 512 × 512 file, shows no file list or upload progress, and supports preview, replacement, deletion, and dropping a new image inside the crop dialog.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AvatarUpload, type UploadFileItem } from 'vue-flow-upload'

// 单元素头像列表；组件只渲染第一项。
// Single-entry avatar list; the component renders only the first item.
const avatar = ref<UploadFileItem[]>([])
</script>

<template>
  <AvatarUpload
    v-model="avatar"
    belong-id="profile-1"
    action="/avatar"
    update-action="/avatar/{fileId}"
    delete-action="/avatar/{fileId}"
    accept="image/*"
    shape="circle"
  />
</template>
```

The initial upload uses `action`. When an avatar already exists and `update-action` is configured, the component sends a `PUT` to the URL with `{fileId}` substituted and submits the multipart fields `file` and `fileId`. The first response must return `fileId`, otherwise no later update URL can be built. `baseUrl` is prepended to relative addresses and never changes absolute `http(s)` URLs. When a custom `transport` handles replacement, do not pass `update-action`.

`shape` controls the visual outline of the avatar card and crop box and accepts `square` (default) or `circle`; a circle is only a display mask, and the uploaded result stays a 512 × 512 square image. `read-only` blocks selection, replacement, and deletion while preview stays available:

```vue
<AvatarUpload v-model="avatar" belong-id="profile-1" read-only shape="circle" />
```

## Nuxt

Add the module in `nuxt.config.ts`. It registers client-only `FlowUpload` and `AvatarUpload` components and imports the component styles automatically, so no SSR step touches browser file, preview, or cropper APIs.

```ts
export default defineNuxtConfig({
  modules: ['vue-flow-upload/nuxt'],
  vueFlowUpload: {
    prefix: '',
  },
})
```

Application-wide authentication and upload defaults are initialised through the Vue plugin, and components cannot override the authentication configuration:

```ts
// plugins/vue-flow-upload.client.ts
import { vueFlowUpload } from 'vue-flow-upload'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vueFlowUpload, {
    baseUrl: '/api',
    auth: {
      credentials: 'include',
      headers: async () => ({ Authorization: `Bearer ${getAccessToken()}` }),
      query: { source: 'web' },
    },
    defaults: {
      chunkSize: 1024 * 1024,
      chunkConcurrency: 3,
      pagination: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    },
  })
})
```

Components are then available on pages without a manual import:

```vue
<template>
  <FlowUpload v-model="files" belong-id="order-1" action="/files" />
</template>
```

`prefix: 'App'` changes the registered names to `AppFlowUpload` and `AppAvatarUpload`. That `prefix` only affects component names; use the plugin's `baseUrl` for the endpoint prefix.

## Upload HTTP adapter

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

Endpoint responsibilities: `url` uploads normal files; `checkUrl` checks instant upload or a shared-upload state; `multipart.initUrl` atomically creates or resumes a session; `multipart.chunkUrl` uploads one missing chunk; `multipart.completeUrl` idempotently merges chunks; `multipart.cancelUrl` releases only the current caller's lease. See the [upload transport](https://jktantan.github.io/vue-flow-upload/en/api/transport.html) and the [backend API contract](https://jktantan.github.io/vue-flow-upload/en/guide/backend-api-contract.html) for the full contract.

## Download HTTP adapter

```ts
import { createHttpDownloadTransport } from 'vue-flow-upload'

const downloadTransport = createHttpDownloadTransport({
  downloadUrl: '/uploads/files/{fileId}/download',
  archive: {
    createUrl: '/uploads/archives',
    taskUrl: '/uploads/archives/{taskId}',
    cancelUrl: '/uploads/archives/{taskId}',
  },
})
```

Endpoint responsibilities: `downloadUrl` downloads one `{fileId}` file; `archive.createUrl` creates a bulk archive task; `archive.taskUrl` polls `{taskId}` for status and the final download URL; `archive.cancelUrl` cancels an unfinished task. Pass `downloadTransport` to the component's `download-transport` to enable downloads. The adapter receives the authentication headers and query the component resolves; configure `baseUrl`, `credentials`, and `timeout` when creating it if you need an API prefix, cross-origin cookies, or a custom timeout. See the [download transport](https://jktantan.github.io/vue-flow-upload/en/api/download-transport.html) for the full contract.

## File query HTTP adapter

With `query-transport` configured, a successful list deletion waits for the background read-back before finishing the removal interaction; a failed read-back emits `query-error` and never rolls back the successful deletion.

The Playground's local SQLite mode uses this built-in adapter against `POST /api/files/query`, exercising the component-managed loading, pagination, and cancellation flow. The local endpoint shares one demo dataset and implements no business-ownership or `extra` filtering.

`createHttpFileQueryTransport({ queryUrl })` queries file metadata and never reuses an upload or download address. It POSTs JSON `{ query, pagination }` to `queryUrl`: `query` contains `belongId`, `belongType`, and `extra`, where `extra` is the upload extension data and also the project-specific matching condition at query time; there is no second set of filter fields. `pagination.enabled` states explicitly whether pagination is used. Paginated requests also send `currentPage` and `pageSize` and require `files`, `currentPage`, `pageSize`, and `total` in the response; non-paginated requests and responses both use `{ enabled: false }`. Every file record must contain a string `name`; the adapter rejects invalid records and pagination numbers and reports `INVALID_RESPONSE`. Pass it to `query-transport` and the component handles the initial load, `extra` changes, pagination, cancellation, and stale results. See the [file query transport](https://jktantan.github.io/vue-flow-upload/en/api/query-transport.html) for the full contract.

## Internationalization

Built-in messages live in the `VueFlowUpload.*` namespace. To use one language across components, install a single i18n instance on the host application:

```ts
import { createApp } from 'vue'
import { createFlowUploadI18n } from 'vue-flow-upload'

// 宿主提供一份 i18n 实例，组件在未显式传入 locale 时复用它。
// The host provides one i18n instance that components reuse when no explicit locale is given.
createApp(App).use(createFlowUploadI18n({ locale: 'en-US' }))
```

Components reuse the host i18n instance first. Override a single component with `i18n`:

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

The legacy `locale` and flat `messages` props still work, but migrating to `i18n` is recommended. Built-in locales are `zh-CN`, `en-US`, and `ru-RU`.

## Theming and styles

The default palette follows Element Plus light colors and switches to its dark palette under `dark` / `vfu-dark`. When Element Plus is installed, the component inherits its `--el-*` variables directly. Every customizable value is a `--vfu-*` CSS variable, overridable on `:root` or any ancestor:

```css
:root {
  --vfu-color-primary: #126f67;
  --vfu-color-primary-light-3: #4a958e;
  --vfu-color-primary-light-7: #b7d8d4;
  --vfu-color-primary-light-9: #e7f2f0;
  --vfu-radius-base: 10px;
  --vfu-file-row-height: 60px;
}
```

`theme="element-plus"` / `theme="ant-design-vue"` provide presets, and `ThemeAdapter` accepts custom class names and variables. Legacy variable names (`--vfu-signal`, `--vfu-ink`, `--vfu-muted`, `--vfu-line`, `--vfu-danger`, `--vfu-radius`) remain supported. The bundled cropperjs and Viewer.js consume the same tokens: the crop outline follows the primary color, viewer controls follow light/dark mode, and styles only target the component's own instances. See [Theming and styles](https://jktantan.github.io/vue-flow-upload/en/guide/theming.html) for the full token list, dark mode, and override examples.

## Common props (summary)

| Prop                                                                   | Description                                                                                       | Default                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `action` / `transport`                                                 | Built-in normal-upload URL / custom protocol; `transport` wins when both are passed                | —                                        |
| `create-action`, `delete-action`                                       | Create the file record before upload / clean up the remote file and its upload sessions by `fileId` | —                                        |
| `v-model`, `default-file-list`                                         | Controlled file list / initial list for uncontrolled mode; remote records should carry `uid`, `fileId`, `url`, `status` | `—`, `[]`         |
| `multiple`, `max-count`, `max-size`, `accept`                          | Selection and validation limits                                                                   | `true`, unlimited, unlimited, all        |
| `auto-upload`                                                          | Upload right after selection; when off, call the instance `submit()`                               | `true`                                   |
| `drag`, `directory`                                                    | Whole-component drag and drop, hint in the operation area, and folder selection where supported    | `true`, `false`                          |
| `width`, `height`                                                      | CSS size of the uploader; numbers are px. `height="auto"` fills a parent with an explicit height    | `auto`, `600px`                          |
| `show-file-list`                                                       | Whether to render the built-in list                                                                | `true`                                   |
| `pagination`                                                           | `false` disables it, or pass a controlled pagination state; the host loads each page into `v-model` | not set                                  |
| `list-type`                                                            | `list` or `picture`; `picture` renders picture-wall cards                                          | `list`                                   |
| `data`                                                                 | Object or an async function returning one; configure auth headers in the global `auth.headers`      | `{}`                                     |
| `normal-upload-threshold`, `chunk-size`                                | Files above the threshold use chunks; the transport must support chunks                             | 10 MiB, 1 MiB                            |
| `chunk-concurrency`, `max-concurrent-files`, `max-concurrent-requests` | Chunk, file, and request concurrency limits                                                        | 3, 2, 6                                  |
| `resume`, `instant-upload`                                             | Resume and SHA-256 instant upload                                                                  | `true`, `true`                           |
| `before-upload`, `before-remove`                                       | Return `false` or reject to block an upload or removal                                             | —                                        |
| `belong-id`, `belong-type`, `extra`                                    | Owner id, owner type, and extension attributes written to every upload request's JSON `data`        | `belong-id` required; `belong-type` is `default` |

Removal rules: `idle`, `validating`, and `rejected` files leave the list immediately; every state that entered the upload flow shows a confirmation dialog. Once confirmed, the component calls `transport.deleteFile(fileId)` or `delete-action` to clean up the backend and removes the local row only on success. Configure removal for files that can be cleaned up remotely, and make sure the server returns a stable `fileId`. `transport.createFile()` or `create-action` lets the backend confirm or assign that id before upload; upload, retry, and removal all reuse it.

## Events, slots, and instance

Events: `change(file, files)`, `progress(file, percent)`, `success(file, response)`, `error(file, error)`, `remove(file)`, and `exceed(files)`; with a query adapter also `query-loading(isLoading)`, `query-success(result)`, and `query-error(error)`; with pagination enabled `update:pagination(value)` and `pagination-change(currentPage, pageSize)`; downloads and archives add `download-start/success/error` and `archive-start/progress/success/error`. See the [FlowUpload API](https://jktantan.github.io/vue-flow-upload/en/api/flow-upload.html) for the complete event table.

Slots:

- `#tip`: the hint right below the selection area.
- `#file="{ file, remove, preview, download, pause, resume, retry }"`: replaces one file row.

Through a `ref` you can call `submit()`, `abort(file?)`, `pause(uid)`, `resume(uid)`, `retry(uid)`, `remove(uid | file)`, `clear()`/`clearFiles()`, `handleStart(file)`, `handleRemove(uid | file)`, `refreshQuery()`, and the download and archive methods `download(uid)`, `downloadSelected(uids)`, `downloadAll()`, and `cancelArchive(taskId)`.

## Server-side pagination

Pagination is off by default. The component owns the pagination state and interactions only; it never requests the file list and never appends page parameters to upload, chunk, delete, or download requests. Once enabled, the host loads one page at a time through the same file-list endpoint and writes the page result back to `v-model`:

```vue
<script setup lang="ts">
import { ref } from 'vue'

// 宿主自行加载页面数据；组件只发出分页变更事件。
// The host loads page data itself; the component only emits pagination changes.
const files = ref([])
const loading = ref(false)
const pagination = ref({ total: 0, currentPage: 1, pageSize: 20 })
const paginationEnabled = ref(true)

async function loadFiles(currentPage: number, pageSize: number) {
  loading.value = true
  try {
    const result = await api.get('/api/files', {
      params: { pagination: paginationEnabled.value, currentPage, pageSize },
    })
    files.value = result.files
    pagination.value = { ...pagination.value, currentPage, pageSize, total: result.total }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <FlowUpload
    v-model="files"
    belong-id="order-1"
    :pagination="paginationEnabled ? pagination : false"
    :loading="loading"
    @update:pagination="(value) => (pagination = value)"
    @pagination-change="loadFiles"
  />
</template>
```

The business request layer adapts field names and response shapes; always send the pagination switch (such as `pagination`) together with the page parameters so the same list endpoint returns the same structure in both modes. Passing `:pagination="false"` hides the footer.

## Post-processing state

When chunks are merged but the file is still being transferred to COS, OSS, or Blob Storage, or is still being virus-scanned or transcoded, the backend record should be `processing`. The component shows a yellow “processing” state, during which the file cannot be previewed, downloaded, or included in a bulk download.

An upload completion response may return `{ "fileId": "...", "status": "processing" }` and the component keeps the yellow state. The transition is driven entirely by the backend record: after refreshing the file list, write the returned `status: "success"` and the final `url` into `v-model`, and only then does the component show green “completed”. The component never polls the processing task or marks a file successful on its own.

## Documentation

- Documentation site (Chinese / English / Russian): <https://jktantan.github.io/vue-flow-upload/>
- Complete backend chunk protocol: <https://jktantan.github.io/vue-flow-upload/en/guide/backend-api-contract.html>
- Repository and issues: <https://github.com/jktantan/vue-flow-upload>
- Maintainer material (design, protocol, development guide): <https://github.com/jktantan/vue-flow-upload/tree/main/internal-docs>

## License

[Apache-2.0](https://github.com/jktantan/vue-flow-upload/blob/main/packages/vue-flow-upload/LICENSE) © tantan
