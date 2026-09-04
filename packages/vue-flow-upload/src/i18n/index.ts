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

const dangerousMessageKeys = new Set(['__proto__', 'constructor', 'prototype'])
const isSafeMessageKey = (key: string) => !dangerousMessageKeys.has(key)
const isPlainObject = (value: unknown): value is LocaleMessage => {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

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

/** Creates an isolated vue-i18n-lite instance for one FlowUpload tree. */
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
  const keys = Object.keys(getBuiltInMessages()['zh-CN'].VueFlowUpload as UploadMessages)
  return Object.fromEntries(
    keys.map((key) => [key, i18n.t(`VueFlowUpload.${key}`)]),
  ) as unknown as UploadMessages
}

/** @deprecated Use `createFlowUploadI18n({ locale, messages })` instead. */
export function resolveMessages(locale: string, messages?: Partial<UploadMessages>) {
  return getUploadMessages(createFlowUploadI18n({ locale }, messages))
}
/// <reference types="vite/client" />
