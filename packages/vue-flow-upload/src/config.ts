import type { App, InjectionKey } from 'vue'
import type { UploadHeaders, UploadPagination } from './types'

export interface UploadAuthConfig {
  credentials?: RequestCredentials
  headers?: UploadHeaders
  query?: Record<string, string | number | boolean> | (() => Record<string, string | number | boolean> | Promise<Record<string, string | number | boolean>>)
}

export interface UploadDefaults {
  chunkSize?: number
  chunkConcurrency?: number
  maxConcurrentFiles?: number
  maxConcurrentRequests?: number
  normalUploadThreshold?: number
  retryCount?: number
  retryBaseDelay?: number
  resume?: boolean
  instantUpload?: boolean
  /** Default UI values used only when a FlowUpload instance enables pagination. */
  pagination?: Pick<UploadPagination, 'pageSize' | 'pageSizes'>
}

export interface VueFlowUploadOptions {
  auth?: UploadAuthConfig
  defaults?: UploadDefaults
}

export const vueFlowUploadConfigKey: InjectionKey<VueFlowUploadOptions> = Symbol('vue-flow-upload')

export const vueFlowUpload = {
  install(app: App, options: VueFlowUploadOptions = {}) {
    app.provide(vueFlowUploadConfigKey, options)
  },
}
