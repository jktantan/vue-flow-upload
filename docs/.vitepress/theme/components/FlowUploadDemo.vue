<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useData } from 'vitepress'
import {
  FlowUpload,
  type UploadFileItem,
  type UploadListType,
  type UploadPermissions,
  type UploadTheme,
} from 'vue-flow-upload'
import { createDemoDownloadTransport, createDemoUploadTransport } from '../demo-transport'
import { DEMO_COPY, resolveDemoLocale, type FullUploadDemoCopy } from '../demo-text'
import { DEFAULT_THEME_COLOR, useDemoTheme } from '../theme-colors'
import ThemeColorPicker from './ThemeColorPicker.vue'

/** 完整版示例中可切换的主题预设。 Theme presets selectable in the full demo. */
const THEMES: UploadTheme[] = ['default', 'element-plus', 'ant-design-vue']
/**
 * 可逐个关闭的操作权限及其文案键；未关闭的权限不写入对象，保持组件“未填写即允许”的语义。
 * Per-operation permissions that can be switched off individually, with their copy keys; enabled ones are omitted so the component keeps its “omitted means allowed” semantics.
 */
const PERMISSION_FIELDS: { key: keyof UploadPermissions; label: keyof FullUploadDemoCopy }[] = [
  { key: 'select', label: 'permissionSelect' },
  { key: 'upload', label: 'permissionUpload' },
  { key: 'remove', label: 'permissionRemove' },
  { key: 'retry', label: 'permissionRetry' },
  { key: 'preview', label: 'permissionPreview' },
  { key: 'download', label: 'permissionDownload' },
  { key: 'downloadAll', label: 'permissionDownloadAll' },
]
/** 归档轮询间隔（毫秒）；示例把它缩短，使打包下载的处理过程可被观察到。 Archive polling interval in milliseconds; the demo shortens it so archive processing is observable. */
const DEMO_ARCHIVE_POLLING_INTERVAL_MS = 600

/** 当前文档语言决定示例文案与组件默认语言。 Current documentation language determines demo copy and the component's default language. */
const { lang, isDark } = useData()
/** 归一化后的示例语言。 Normalized demo locale. */
const demoLocale = computed(() => resolveDemoLocale(lang.value))
/** 当前语言的示例文案。 Demo copy for the current language. */
const text = computed(() => DEMO_COPY[demoLocale.value].full)

/** 示例维护的受控文件列表。 Controlled file list maintained by the demo. */
const files = ref<UploadFileItem[]>([])
/** 示例持有的组件公开方法：手动提交与清空列表。 Component methods held by the demo: manual submit and clearing the list. */
const uploader = ref<{ submit: () => Promise<void>; clear: () => void }>()

// 逐个权限开关；默认全部开启，便于直接观察关闭某一项后的差异。
// Per-permission switches, all enabled by default so turning one off shows an immediate difference.
const permissionSwitches = reactive<Record<keyof UploadPermissions, boolean>>({
  select: true,
  upload: true,
  remove: true,
  retry: true,
  preview: true,
  download: true,
  downloadAll: true,
})

/** 列表形态开关。 List layout switch. */
const listType = ref<UploadListType>('list')
/** 是否允许拖入文件。 Whether dropping files is allowed. */
const drag = ref(true)
/** 是否显示批量操作选择框。 Whether batch-selection controls are shown. */
const selectable = ref(false)
/** 是否渲染文件列表或照片墙。 Whether the file list or picture wall is rendered. */
const showFileList = ref(true)
/** 是否渲染工具栏与行操作。 Whether the toolbar and row actions are rendered. */
const showOperation = ref(true)
/** 是否关闭组件的全部交互。 Whether every component interaction is disabled. */
const disabled = ref(false)
/** 选择文件后是否立即上传。 Whether uploads start immediately after selection. */
const autoUpload = ref(true)
/** 接受的文件类型预设；`all` 时不限制。 Accepted-type preset; `all` applies no restriction. */
const accept = ref<'all' | 'image' | 'media'>('all')
/** 单文件大小上限（MB）；`0` 表示不限。 Maximum size per file in MB; `0` means unlimited. */
const maxSizeMb = ref(0)
/** 列表数量上限；`0` 表示不限。 File-count limit; `0` means unlimited. */
const maxCount = ref(0)
/** 组件主题预设或自定义主题适配器。 Component theme preset. */
const theme = ref<UploadTheme>('default')
/** 当前示例主色；色板控件直接覆盖组件的 --vfu-color-primary 派生 token。 Current demo primary color; the swatches override the component's --vfu-color-primary tokens. */
const primaryColor = ref(DEFAULT_THEME_COLOR)
/** 主色与深浅模式对应的 token；同时写入根节点，供 Teleport 弹窗继承。 Tokens for the primary color and color scheme; also written to the root so teleported dialogs inherit them. */
const themeStyle = useDemoTheme(primaryColor, isDark)
/** 组件内置文案语言；初始与文档语言一致，之后可独立切换以对比两种语言的布局。 Component copy language; starts equal to the documentation language and can then be switched independently to compare both layouts. */
const locale = ref<'zh-CN' | 'en-US' | 'ru-RU'>(resolveDemoLocale(lang.value))

/** 传给组件的权限对象；未被关闭的权限不写入，保持组件的默认允许语义。 Permission object passed to the component; enabled permissions are omitted to keep the default allowed semantics. */
const permissions = computed<UploadPermissions>(() => {
  const result: UploadPermissions = {}
  for (const field of PERMISSION_FIELDS) {
    if (!permissionSwitches[field.key]) result[field.key] = false
  }
  return result
})
/** 解析后的类型过滤条件；`all` 时交给组件默认值。 Resolved type filter; `all` keeps the component default. */
const acceptValue = computed(() =>
  accept.value === 'all' ? undefined : accept.value === 'image' ? 'image/*' : 'image/*,.pdf,.zip',
)
/** 解析后的单文件上限（字节）；`0` 表示不限。 Resolved size limit in bytes; `0` means unlimited. */
const maxSizeBytes = computed(() =>
  maxSizeMb.value > 0 ? maxSizeMb.value * 1024 * 1024 : undefined,
)
/** 解析后的数量上限；`0` 时交给组件默认值。 Resolved count limit; `0` keeps the component default. */
const maxCountValue = computed(() => (maxCount.value > 0 ? maxCount.value : undefined))

/** 浏览器内模拟的上传适配器；卸载时释放其排队的计时器。 Browser-only upload adapter; its queued timers are released on unmount. */
const demoUpload = createDemoUploadTransport()
/** 浏览器内模拟的下载与归档适配器，使下载相关权限具备可见效果。 Browser-only download and archive adapter so download permissions have visible effects. */
const demoDownloadTransport = createDemoDownloadTransport()

/**
 * 启动当前列表中的待上传文件；仅在关闭自动上传时可用。
 * Starts pending files in the current list; available only when automatic upload is off.
 */
function submitFiles(): void {
  void uploader.value?.submit()
}

/**
 * 清空示例列表，便于连续试用不同参数组合。
 * Clears the demo list so different parameter combinations can be tried in a row.
 */
function clearFiles(): void {
  uploader.value?.clear()
}

/**
 * 页面离开时停止模拟请求，避免异步进度在其他页面写回状态。
 * Stops simulated requests when leaving the page so async progress cannot write state on another page.
 */
onBeforeUnmount(() => {
  demoUpload.dispose()
})
</script>

<template>
  <section class="demo-shell" :aria-label="text.ariaLabel" :style="themeStyle">
    <div class="demo-controls demo-controls--stacked">
      <fieldset>
        <legend>{{ text.groupOperation }}</legend>
        <label>
          {{ text.listType }}
          <select v-model="listType">
            <option value="list">{{ text.listTypeList }}</option>
            <option value="picture">{{ text.listTypePicture }}</option>
          </select>
        </label>
        <label><input v-model="drag" type="checkbox" /> {{ text.drag }}</label>
        <label><input v-model="selectable" type="checkbox" /> {{ text.batchSelect }}</label>
        <label><input v-model="showFileList" type="checkbox" /> {{ text.fileList }}</label>
        <label><input v-model="showOperation" type="checkbox" /> {{ text.toolbar }}</label>
      </fieldset>

      <fieldset>
        <legend>{{ text.groupPermissions }}</legend>
        <label v-for="field in PERMISSION_FIELDS" :key="field.key">
          <input v-model="permissionSwitches[field.key]" type="checkbox" />
          {{ text[field.label] }}
        </label>
        <label><input v-model="disabled" type="checkbox" /> {{ text.disableAll }}</label>
      </fieldset>

      <fieldset>
        <legend>{{ text.groupLimits }}</legend>
        <label>
          {{ text.acceptedTypes }}
          <select v-model="accept">
            <option value="all">{{ text.acceptAll }}</option>
            <option value="image">{{ text.acceptImage }}</option>
            <option value="media">{{ text.acceptMedia }}</option>
          </select>
        </label>
        <label>
          {{ text.maxSize }}
          <input v-model.number="maxSizeMb" type="number" min="0" step="1" />
        </label>
        <label>
          {{ text.maxCount }}
          <input v-model.number="maxCount" type="number" min="0" step="1" />
        </label>
      </fieldset>

      <fieldset>
        <legend>{{ text.groupState }}</legend>
        <label><input v-model="autoUpload" type="checkbox" /> {{ text.autoUpload }}</label>
        <label>
          {{ text.theme }}
          <select v-model="theme">
            <option v-for="name in THEMES" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <div class="demo-color-field">
          <span>{{ text.themeColor }}</span>
          <ThemeColorPicker v-model="primaryColor" :label="text.themeColor" />
        </div>
        <label>
          {{ text.componentLanguage }}
          <select v-model="locale">
            <option value="zh-CN">zh-CN</option>
            <option value="en-US">en-US</option>
            <option value="ru-RU">ru-RU</option>
          </select>
        </label>
      </fieldset>
    </div>

    <div class="demo-toolbar">
      <button
        v-if="!autoUpload"
        class="demo-action"
        type="button"
        :disabled="files.length === 0"
        @click="submitFiles"
      >
        {{ text.startUpload }}
      </button>
      <button class="demo-action" type="button" :disabled="files.length === 0" @click="clearFiles">
        {{ text.clearList }}
      </button>
      <p class="demo-caption">{{ text.caption }}</p>
    </div>

    <FlowUpload
      ref="uploader"
      v-model="files"
      belong-id="demo-order-1"
      :transport="demoUpload.transport"
      :download-transport="demoDownloadTransport"
      :list-type="listType"
      :drag="drag"
      :selectable="selectable"
      :show-file-list="showFileList"
      :show-operation="showOperation"
      :disabled="disabled"
      :auto-upload="autoUpload"
      :accept="acceptValue"
      :max-size="maxSizeBytes"
      :max-count="maxCountValue"
      :permissions="permissions"
      :theme="theme"
      :locale="locale"
      :archive-polling-interval="DEMO_ARCHIVE_POLLING_INTERVAL_MS"
    >
      <template #tip>{{ text.tip }}</template>
    </FlowUpload>
  </section>
</template>
