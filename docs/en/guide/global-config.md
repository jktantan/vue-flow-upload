# Global configuration and Nuxt

`vueFlowUpload` is the Vue plugin that injects one shared request and upload-default configuration into every `FlowUpload` and `AvatarUpload`. It does not replace per-component `v-model`, `data`, `belong-id`, or transport protocols.

## Vue 3: install once

Install the plugin and import styles at application startup:

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { vueFlowUpload } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

createApp(App)
  .use(vueFlowUpload, {
    baseUrl: '/api',
    auth: {
      credentials: 'include',
      // Read a fresh token for every request after login refreshes it.
      // 每次请求读取最新 Token，避免登录刷新后继续使用旧值。
      headers: async () => ({ Authorization: `Bearer ${getAccessToken()}` }),
      query: { client: 'web' },
    },
    defaults: {
      normalUploadThreshold: 10 * 1024 * 1024,
      chunkSize: 1024 * 1024,
      chunkConcurrency: 3,
      maxConcurrentFiles: 2,
      maxConcurrentRequests: 6,
      retryCount: 3,
      retryBaseDelay: 500,
      resume: true,
      instantUpload: true,
      pagination: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    },
  })
  .mount('#app')
```

`headers` and `query` accept either an object or a function returning an object or Promise. The function runs before each request, which is useful for rotating credentials. Do not put tokens or other secrets in `query`: URLs can appear in logs, browser history, and proxies.

## Configuration reference

### `baseUrl`

`baseUrl` is a common prefix for built-in upload endpoints, for example `'/api'` or `'https://api.example.com'`. It is prepended to relative URLs but never changes complete `http:` or `https:` URLs:

```vue
<FlowUpload belong-id="order-1" action="/files" />
<!-- With the global baseUrl, the request goes to /api/files. -->
```

It applies to `action`, `create-action`, and `delete-action`, plus `AvatarUpload`'s `action`, `update-action`, and `delete-action`. It does not rewrite URLs inside a custom transport.

### `auth`

| Field         | Type                    | Meaning and scope                                                                                                                                                                                                                            |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `credentials` | `RequestCredentials`    | Cookie policy for built-in XHR. `'same-origin'` only sends same-origin cookies; `'include'` permits cross-origin cookies when CORS allows them. Built-in FlowUpload uses `'same-origin'` when omitted.                                       |
| `headers`     | `UploadHeaders`         | Headers for every built-in upload, create, instant-check, chunk, merge, delete, and avatar request. It accepts an object or async factory. `Content-Type` is ignored for FormData requests so the browser can create the multipart boundary. |
| `query`       | object or async factory | Shared URL parameters for every built-in request. Values may be strings, numbers, or booleans; use it only for non-sensitive metadata such as tenant or client identifiers.                                                                  |

### `defaults`

`defaults` provides upload and pagination defaults for `FlowUpload` only. The same-named component prop wins. When neither is set, the component uses the built-in defaults below.

| Field                   | Unit          | Built-in default   | Meaning                                                                                 |
| ----------------------- | ------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `normalUploadThreshold` | bytes         | 10 MiB             | Files above this size use multipart upload.                                             |
| `chunkSize`             | bytes         | 1 MiB              | Bytes per multipart chunk.                                                              |
| `chunkConcurrency`      | count         | 3                  | Chunks uploaded concurrently for one file.                                              |
| `maxConcurrentFiles`    | count         | 2                  | Files allowed to hold active upload slots.                                              |
| `maxConcurrentRequests` | count         | 6                  | Shared maximum number of network requests.                                              |
| `retryCount`            | attempts      | 3                  | Additional attempts for a retryable request.                                            |
| `retryBaseDelay`        | milliseconds  | 500                | Initial exponential-backoff delay.                                                      |
| `resume`                | —             | `true`             | Attempts to resume an eligible, unexpired multipart session.                            |
| `instantUpload`         | —             | `true`             | Calculates SHA-256 and checks instant upload when the transport implements `checkFile`. |
| `pagination.pageSize`   | records       | 10                 | Default page size when pagination is enabled.                                           |
| `pagination.pageSizes`  | record counts | `[10, 20, 30, 40]` | Page sizes offered by the paginator.                                                    |

## Custom, download, and query transports

Global `baseUrl` and `auth.credentials` are applied automatically only to the built-in upload/avatar transport created from component `action` props. A custom `UploadTransport`, `DownloadTransport`, or `FileQueryTransport` owns its own URL and cookie configuration.

The component still passes global `auth.headers` and `auth.query` to every custom adapter: upload/download use `context.headers` and `context.query`; file queries use `context.headers` and `context.urlQuery`. Configure built-in download and query adapters explicitly:

```ts
import { createHttpDownloadTransport, createHttpFileQueryTransport } from 'vue-flow-upload'

const downloadTransport = createHttpDownloadTransport({
  baseUrl: '/api',
  credentials: 'include',
  downloadUrl: '/files/{fileId}/download',
  archive: { createUrl: '/archives', taskUrl: '/archives/{taskId}' },
})

const queryTransport = createHttpFileQueryTransport({
  baseUrl: '/api',
  credentials: 'include',
  queryUrl: '/files/query',
})
```

## Nuxt 3 / 4

The Nuxt module globally registers client-only components and imports package styles. Its only option is the component-name `prefix`; upload `baseUrl`, authentication, and scheduling defaults still belong in a client-side Vue plugin.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-flow-upload/nuxt'],
  vueFlowUpload: {
    prefix: 'App',
  },
})
```

The default `prefix: ''` registers `FlowUpload` and `AvatarUpload`. `prefix: 'App'` registers `AppFlowUpload` and `AppAvatarUpload`. This is not an API URL prefix; use `baseUrl` for endpoint URLs.

Add a client-only plugin so SSR never touches browser file, preview, or cropper APIs:

```ts
// plugins/vue-flow-upload.client.ts
import { vueFlowUpload } from 'vue-flow-upload'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vueFlowUpload, {
    baseUrl: useRuntimeConfig().public.apiBase,
    auth: {
      credentials: 'include',
      headers: () => ({ Authorization: `Bearer ${useCookie('access_token').value ?? ''}` }),
    },
    defaults: { chunkSize: 1024 * 1024, chunkConcurrency: 3 },
  })
})
```

The module already imports styles, so Nuxt pages do not need `import 'vue-flow-upload/style.css'`. Use `<FlowUpload />` with the default prefix or `<AppFlowUpload />` with `prefix: 'App'`.
