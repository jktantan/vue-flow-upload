# 全局配置与 Nuxt

`vueFlowUpload` 是 Vue 插件，用于向所有 `FlowUpload`、`AvatarUpload` 实例注入同一份请求和上传默认配置。它不会修改组件的 `v-model`、`data`、`belong-id` 或 `transport` 协议；这些仍由每个组件实例决定。

## Vue 3：安装全局配置

在创建应用时安装一次插件，并在入口处导入样式：

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
      // 每次请求重新读取 Token，避免登录刷新后继续使用旧值。
      // Reads the token for every request so a refreshed login never uses a stale value.
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

`headers` 和 `query` 都可传对象，或返回对象/Promise 的函数。函数会在每次请求前执行，适合读取会刷新或轮换的凭据。不要把 Token、密码等敏感数据放入 `query`，因为 URL 可能出现在日志、历史记录或代理中。

## 配置字段

### `baseUrl`

`baseUrl` 是内置上传端点的公共前缀，例如 `'/api'` 或 `'https://api.example.com'`。相对地址会自动拼接，完整 `http:`/`https:` 地址保持原样：

```vue
<FlowUpload belong-id="order-1" action="/files" />
<!-- 使用全局 baseUrl 后请求 /api/files -->
```

它用于 `action`、`create-action`、`delete-action`，以及 `AvatarUpload` 的 `action`、`update-action`、`delete-action`。它不改写调用方自定义 `transport` 中的地址。

### `auth`

| 字段          | 类型                 | 含义与范围                                                                                                                                                               |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `credentials` | `RequestCredentials` | 内置 XHR 的 Cookie 策略。`'same-origin'` 仅同源；`'include'` 允许跨域携带 Cookie，服务端必须正确设置 CORS。未设置时 FlowUpload 内置上传使用 `'same-origin'`。            |
| `headers`     | `UploadHeaders`      | 每次内置上传、创建、秒传检查、分片、合并、删除与头像请求附加的请求头；对象或异步工厂均可。`FormData` 请求中的 `Content-Type` 会被忽略，让浏览器生成 multipart boundary。 |
| `query`       | 对象或异步工厂       | 每次内置请求追加的公共 URL 参数。值只能是 string、number、boolean；适合租户、客户端标识等非敏感元数据。                                                                  |

### `defaults`

`defaults` 只为 `FlowUpload` 提供上传和分页默认值。组件上同名 prop 的优先级更高；未在全局或组件设置时，使用下表的组件内置默认值。

| 字段                    | 单位   | 内置默认值         | 含义                                                       |
| ----------------------- | ------ | ------------------ | ---------------------------------------------------------- |
| `normalUploadThreshold` | 字节   | 10 MiB             | 大于该值的文件进入分片流程。                               |
| `chunkSize`             | 字节   | 1 MiB              | 一个上传分片的大小。                                       |
| `chunkConcurrency`      | 个     | 3                  | 同一文件同时上传的分片数。                                 |
| `maxConcurrentFiles`    | 个     | 2                  | 同时占用上传槽位的文件数。                                 |
| `maxConcurrentRequests` | 个     | 6                  | 所有文件共享的最大网络请求数。                             |
| `retryCount`            | 次     | 3                  | 可重试请求的额外尝试次数。                                 |
| `retryBaseDelay`        | 毫秒   | 500                | 指数退避的初始等待时间。                                   |
| `resume`                | —      | `true`             | 分片上传是否尝试恢复未过期会话。                           |
| `instantUpload`         | —      | `true`             | transport 支持 `checkFile` 时是否先计算 SHA-256 秒传检查。 |
| `pagination.pageSize`   | 条     | 10                 | 启用分页但组件未传 `page-size` 时的默认页大小。            |
| `pagination.pageSizes`  | 条数组 | `[10, 20, 30, 40]` | 分页器允许选择的页大小。                                   |

## 自定义 transport 与下载/查询适配器

全局 `baseUrl` 与 `auth.credentials` 只会自动配置由组件通过 `action` 创建的内置上传/头像 transport。自定义 `UploadTransport`、`DownloadTransport`、`FileQueryTransport` 必须自行处理其地址和 Cookie 策略。

不过组件调用所有自定义适配器时，仍会传入全局 `auth.headers` 和 `auth.query`：上传/下载在 `context.headers`、`context.query`，文件查询在 `context.headers`、`context.urlQuery`。创建内置下载或查询适配器时，将地址和 Cookie 显式写在适配器上：

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

Nuxt 模块负责注册客户端组件和自动注入样式；它的配置项只有组件名 `prefix`。上传的 `baseUrl`、认证和默认调度策略仍要在客户端 Vue 插件中配置。

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-flow-upload/nuxt'],
  vueFlowUpload: {
    prefix: 'App',
  },
})
```

`prefix: ''` 是默认值，注册 `FlowUpload`、`AvatarUpload`；设为 `'App'` 后注册 `AppFlowUpload`、`AppAvatarUpload`。这不是接口 URL 前缀；接口前缀请使用 `baseUrl`。

然后新增仅客户端插件，避免 SSR 阶段访问浏览器文件、预览与裁剪 API：

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

模块已自动引入样式，因此 Nuxt 页面无需再次 `import 'vue-flow-upload/style.css'`。使用默认前缀时可直接写 `<FlowUpload />`；使用 `prefix: 'App'` 时写 `<AppFlowUpload />`。
