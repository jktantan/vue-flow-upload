import { createI18n, type I18n, type I18nOptions } from 'vue-i18n-lite'
import type { UploadMessages } from '../types'

export type LocaleMessage = Record<string, unknown>
export type LocaleMessages = Record<string, LocaleMessage>
export interface FlowUploadI18nOptions {
  locale?: string
  messages?: LocaleMessages
}
type I18nCompatibleMessages = NonNullable<I18nOptions['messages']>
type LocaleModule = { default?: LocaleMessage }

// 阻止原型污染键进入用户语言包。 Blocks prototype-pollution keys from user locale messages.
const dangerousMessageKeys = new Set(['__proto__', 'constructor', 'prototype'])
const isSafeMessageKey = (key: string) => !dangerousMessageKeys.has(key)
const isPlainObject = (value: unknown): value is LocaleMessage => {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** 安全地深拷贝语言包对象。 Safely deep-clones a locale message object. */
export function cloneLocaleMessage(message: LocaleMessage): LocaleMessage {
  const cloned: LocaleMessage = {}
  for (const key of Object.keys(message)) {
    if (!isSafeMessageKey(key)) continue
    const value = message[key]
    cloned[key] = isPlainObject(value) ? cloneLocaleMessage(value) : value
  }
  return cloned
}

export function mergeLocaleMessages(
  base: LocaleMessage = {},
  override: LocaleMessage = {},
): LocaleMessage {
  // 对普通对象递归合并，标量和数组由覆盖值整体替换。 Recursively merge plain objects; replace scalars and arrays wholesale.
  const merged = cloneLocaleMessage(base)
  for (const key of Object.keys(override)) {
    if (!isSafeMessageKey(key)) continue
    const baseValue = merged[key]
    const overrideValue = override[key]
    merged[key] = isPlainObject(overrideValue)
      ? isPlainObject(baseValue)
        ? mergeLocaleMessages(baseValue, overrideValue)
        : cloneLocaleMessage(overrideValue)
      : overrideValue
  }
  return merged
}

let builtInMessagesCache: LocaleMessages | undefined
const modules = import.meta.glob<LocaleModule>('./lang/*', { eager: true })

export function getBuiltInMessages(): LocaleMessages {
  // Vite 在构建期加载语言模块；结果缓存避免每次渲染重复合并。 Vite loads locale modules at build time; cache avoids repeat merging.
  if (builtInMessagesCache) return builtInMessagesCache
  const messages: LocaleMessages = {}
  for (const [path, module] of Object.entries(modules)) {
    if (!module.default) continue
    const locale = path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
    messages[locale] = mergeLocaleMessages(messages[locale], module.default)
  }
  builtInMessagesCache = messages
  return messages
}

/** 为单个 FlowUpload 组件树创建隔离的 i18n 实例。 Creates an isolated vue-i18n-lite instance for one FlowUpload tree. */
export function createFlowUploadI18n(
  options: FlowUploadI18nOptions = {},
  legacyMessages?: Partial<UploadMessages>,
): I18n {
  const locale = options.locale ?? 'zh-CN'
  const messages: LocaleMessages = {}
  for (const [name, message] of Object.entries(getBuiltInMessages()))
    messages[name] = cloneLocaleMessage(message)
  for (const [name, message] of Object.entries(options.messages ?? {})) {
    if (isSafeMessageKey(name)) messages[name] = mergeLocaleMessages(messages[name], message)
  }
  if (legacyMessages)
    messages[locale] = mergeLocaleMessages(messages[locale], { VueFlowUpload: legacyMessages })
  return createI18n({
    locale,
    fallbackLocale: 'en-US',
    messages: messages as I18nCompatibleMessages,
  })
}

export function getUploadMessages(i18n: I18n): UploadMessages {
  // 使用中文内置包的键集合，确保所有语言返回完整且一致的消息形状。 Use zh-CN keys so every locale returns a complete, consistent message shape.
  const keys = Object.keys(getBuiltInMessages()['zh-CN'].VueFlowUpload as UploadMessages)
  return Object.fromEntries(
    keys.map((key) => [key, i18n.t(`VueFlowUpload.${key}`)]),
  ) as unknown as UploadMessages
}

/** 已废弃：请改用 `createFlowUploadI18n({ locale, messages })`。 @deprecated Use `createFlowUploadI18n({ locale, messages })` instead. */
export function resolveMessages(locale: string, messages?: Partial<UploadMessages>) {
  return getUploadMessages(createFlowUploadI18n({ locale }, messages))
}
/// <reference types="vite/client" />
