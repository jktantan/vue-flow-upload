import type { App, InjectionKey } from 'vue'
import type { UploadHeaders, UploadPagination } from './types'

/** 应用级认证与请求参数；用于内置上传、分片、删除及头像请求。 Application-wide auth and request settings for built-in upload, multipart, deletion, and avatar requests. */
export interface UploadAuthConfig {
  /** Cookie 携带策略；`include` 会跨域携带凭据，`same-origin` 仅同源携带。 Cookie credential policy; `include` sends credentials cross-origin, while `same-origin` restricts them to same-origin requests. */
  credentials?: RequestCredentials
  /** 每次请求附加的认证/业务请求头；可使用函数按请求刷新 Token。 Headers appended to every request; a function can refresh tokens per request. */
  headers?: UploadHeaders
  /** 每次请求附加到 URL 的公共查询参数；支持异步函数。 Shared query parameters appended to every request URL; supports an async factory. */
  query?:
    | Record<string, string | number | boolean>
    | (() =>
        | Record<string, string | number | boolean>
        | Promise<Record<string, string | number | boolean>>)
}

/** 应用级上传行为默认值；组件同名 prop 优先级更高。 Application-wide upload behavior defaults; same-named component props take precedence. */
export interface UploadDefaults {
  /** 分片大小（字节）；仅大于普通上传阈值的文件使用。 Chunk size in bytes; used only for files above the normal-upload threshold. */
  chunkSize?: number
  /** 单个文件同时上传的最大分片数。 Maximum chunks uploading concurrently for one file. */
  chunkConcurrency?: number
  /** 同时处于上传中的最大文件数。 Maximum number of files with active upload work. */
  maxConcurrentFiles?: number
  /** 全部文件共享的最大 HTTP 请求数。 Maximum HTTP requests shared by all files. */
  maxConcurrentRequests?: number
  /** 普通 multipart/form-data 上传的大小上限（字节）；超过后进入分片流程。 Size threshold in bytes above which the multipart workflow is used. */
  normalUploadThreshold?: number
  /** 单个可重试请求的最大额外尝试次数。 Maximum additional attempts for one retryable request. */
  retryCount?: number
  /** 重试退避的初始等待时间（毫秒），后续按指数增长。 Initial retry backoff in milliseconds; later waits grow exponentially. */
  retryBaseDelay?: number
  /** 是否向服务端恢复未过期的分片会话。 Whether to resume an unexpired multipart session from the server. */
  resume?: boolean
  /** 是否先按 SHA-256 调用秒传检查接口。 Whether to call the SHA-256 instant-upload check before transfer. */
  instantUpload?: boolean
  /** 分页启用时使用的默认页大小和可选页大小，不负责加载数据。 Default page size/options used only when pagination is enabled; this does not fetch page data. */
  pagination?: Pick<UploadPagination, 'pageSize' | 'pageSizes'>
}

export interface VueFlowUploadOptions {
  /** 内置 HTTP 端点的基础路径或源站，如 `/api` 或 `https://api.example.com`；相对 action 会拼接此前缀，完整 URL 保持不变。 Base path/origin for built-in HTTP endpoints, such as `/api` or `https://api.example.com`; relative actions are prefixed and absolute URLs are unchanged. */
  baseUrl?: string
  /** 所有内置请求共享的认证、请求头与查询参数。 Shared authentication, headers, and query parameters for built-in requests. */
  auth?: UploadAuthConfig
  /** 所有 FlowUpload 实例共享的上传调度默认值。 Shared upload scheduling defaults for every FlowUpload instance. */
  defaults?: UploadDefaults
}

/** Vue 注入键，供插件与组件实例共享配置。 Vue injection key shared by the plugin and component instances. */
export const vueFlowUploadConfigKey: InjectionKey<VueFlowUploadOptions> = Symbol('vue-flow-upload')

/** Vue 插件：向所有上传组件提供共享 URL、认证与队列默认值。 Vue plugin that provides shared URL, authentication, and queue defaults to upload components. */
export const vueFlowUpload = {
  install(app: App, options: VueFlowUploadOptions = {}) {
    app.provide(vueFlowUploadConfigKey, options)
  },
}
