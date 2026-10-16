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

/** 完整版示例中可切换的主题预设。 Theme presets selectable in the full demo. */
const THEMES: UploadTheme[] = ['default', 'element-plus', 'ant-design-vue']
/**
 * 可逐个关闭的操作权限及其界面文案；未关闭的权限不写入对象，保持组件“未填写即允许”的语义。
 * Per-operation permissions that can be switched off individually, with their labels; enabled ones are omitted so the component keeps its “omitted means allowed” semantics.
 */
const PERMISSION_FIELDS: { key: keyof UploadPermissions; zh: string; en: string }[] = [
  { key: 'select', zh: '选择', en: 'Select' },
  { key: 'upload', zh: '上传', en: 'Upload' },
  { key: 'remove', zh: '删除', en: 'Remove' },
  { key: 'retry', zh: '重试', en: 'Retry' },
  { key: 'preview', zh: '预览', en: 'Preview' },
  { key: 'download', zh: '下载', en: 'Download' },
  { key: 'downloadAll', zh: '全部下载', en: 'Download all' },
]
/** 归档轮询间隔（毫秒）；示例把它缩短，使打包下载的处理过程可被观察到。 Archive polling interval in milliseconds; the demo shortens it so archive processing is observable. */
const DEMO_ARCHIVE_POLLING_INTERVAL_MS = 600

/** 当前文档语言决定示例自身文案。 Current documentation language determines the demo's own copy. */
const { lang } = useData()
/** 是否正在浏览英文文档路径。 Whether the current documentation path is English. */
const isEnglish = computed(() => lang.value === 'en-US')

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
/** 组件内置文案语言，可与文档语言不同，便于对比两种语言的布局。 Component copy language, independent of the document language so both layouts can be compared. */
const locale = ref<'zh-CN' | 'en-US'>('zh-CN')

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
/** 示例说明文案，随文档语言切换。 Demo caption, switching with the document language. */
const demoCaption = computed(() =>
  isEnglish.value
    ? 'Change any control to see how the component disables or reshapes itself. Uploads, downloads, and archives are simulated in the browser.'
    : '改动任意控件，观察组件如何禁用或改变形态。上传、下载与打包均在浏览器内模拟。',
)

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
  <section
    class="demo-shell"
    :aria-label="isEnglish ? 'Full-featured upload demo' : '完整功能上传示例'"
  >
    <div class="demo-controls demo-controls--stacked">
      <fieldset>
        <legend>{{ isEnglish ? 'Operation' : '操作' }}</legend>
        <label>
          {{ isEnglish ? 'List type' : '列表形态' }}
          <select v-model="listType">
            <option value="list">{{ isEnglish ? 'List' : '列表' }}</option>
            <option value="picture">{{ isEnglish ? 'Picture wall' : '照片墙' }}</option>
          </select>
        </label>
        <label
          ><input v-model="drag" type="checkbox" />
          {{ isEnglish ? 'Drag and drop' : '拖拽上传' }}</label
        >
        <label
          ><input v-model="selectable" type="checkbox" />
          {{ isEnglish ? 'Batch select' : '批量选择' }}</label
        >
        <label
          ><input v-model="showFileList" type="checkbox" />
          {{ isEnglish ? 'File list' : '显示文件列表' }}</label
        >
        <label
          ><input v-model="showOperation" type="checkbox" />
          {{ isEnglish ? 'Toolbar' : '显示工具栏' }}</label
        >
      </fieldset>

      <fieldset>
        <legend>{{ isEnglish ? 'Permissions' : '权限' }}</legend>
        <label v-for="field in PERMISSION_FIELDS" :key="field.key">
          <input v-model="permissionSwitches[field.key]" type="checkbox" />
          {{ isEnglish ? field.en : field.zh }}
        </label>
        <label
          ><input v-model="disabled" type="checkbox" />
          {{ isEnglish ? 'Disable all' : '全部禁用' }}</label
        >
      </fieldset>

      <fieldset>
        <legend>{{ isEnglish ? 'Selection limits' : '选择限制' }}</legend>
        <label>
          {{ isEnglish ? 'Accepted types' : '接受类型' }}
          <select v-model="accept">
            <option value="all">{{ isEnglish ? 'Any file' : '全部文件' }}</option>
            <option value="image">{{ isEnglish ? 'Images' : '仅图片' }}</option>
            <option value="media">
              {{ isEnglish ? 'Images, PDF, ZIP' : '图片、PDF、ZIP' }}
            </option>
          </select>
        </label>
        <label>
          {{ isEnglish ? 'Max size MB (0 = none)' : '单文件上限 MB（0 不限）' }}
          <input v-model.number="maxSizeMb" type="number" min="0" step="1" />
        </label>
        <label>
          {{ isEnglish ? 'Max count (0 = none)' : '数量上限（0 不限）' }}
          <input v-model.number="maxCount" type="number" min="0" step="1" />
        </label>
      </fieldset>

      <fieldset>
        <legend>{{ isEnglish ? 'State, theme and language' : '状态、主题与语言' }}</legend>
        <label
          ><input v-model="autoUpload" type="checkbox" />
          {{ isEnglish ? 'Auto upload' : '自动上传' }}</label
        >
        <label>
          {{ isEnglish ? 'Theme' : '主题' }}
          <select v-model="theme">
            <option v-for="name in THEMES" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <label>
          {{ isEnglish ? 'Component language' : '组件语言' }}
          <select v-model="locale">
            <option value="zh-CN">zh-CN</option>
            <option value="en-US">en-US</option>
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
        {{ isEnglish ? 'Start upload' : '开始上传' }}
      </button>
      <button
        class="demo-action"
        type="button"
        :disabled="files.length === 0"
        @click="clearFiles"
      >
        {{ isEnglish ? 'Clear list' : '清空列表' }}
      </button>
      <p class="demo-caption">{{ demoCaption }}</p>
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
      <template #tip>{{
        isEnglish
          ? 'Permission, layout, and selection limits apply immediately; nothing is sent to a server.'
          : '权限、布局与选择限制即时生效；此示例不会发送任何网络请求。'
      }}</template>
    </FlowUpload>
  </section>
</template>
