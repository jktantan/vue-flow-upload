<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useData } from 'vitepress'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'
import { createDemoUploadTransport } from '../demo-transport'

/**
 * 文档上传示例的输入；手动模式仅用于演示实例方法，不改变组件的生产行为。
 * Input for the documentation upload demo; manual mode only demonstrates exposed methods and does not alter production component behavior.
 */
interface UploadDemoProps {
  /** 是否要求用户点击按钮后才开始上传。 Whether a user must click a button before uploads begin. */
  manual?: boolean
}

/** 经过 TypeScript 约束的示例输入。 TypeScript-constrained demo input. */
const props = withDefaults(defineProps<UploadDemoProps>(), { manual: false })
/** 当前文档语言决定演示台自身文案和组件 locale。 Current documentation language determines demo-owned copy and the component locale. */
const { lang } = useData()
/** 是否正在浏览英文文档路径。 Whether the current documentation path is English. */
const isEnglish = computed(() => lang.value === 'en-US')
/** 文档示例所维护的受控文件列表。 Controlled file list maintained by the documentation demo. */
const files = ref<UploadFileItem[]>([])
/** 供手动模式调用的组件公开方法。 Component exposed methods used by manual mode. */
const uploader = ref<{ submit: () => Promise<void> }>()
/** 文档示例共用的浏览器内上传适配器；卸载时统一释放它排队的计时器。 Shared browser-only upload adapter for the demo; its queued timers are released together on unmount. */
const demoUpload = createDemoUploadTransport()
/** 根据模式生成清晰的示例提示。 Produces a clear demo hint based on the selected mode. */
const demoCaption = computed(() =>
  props.manual
    ? isEnglish.value
      ? 'Select files, then choose “Start upload” to run the queue.'
      : '选择文件后，点击“开始上传”触发队列。'
    : isEnglish.value
      ? 'Select or drop files to see the component’s real upload states.'
      : '选择或拖入文件，查看组件的真实上传状态变化。',
)

/**
 * 启动已选择的待上传文件；仅在关闭自动上传时显示该操作。
 * Starts selected pending files; this action is shown only when automatic upload is disabled.
 */
function submitSelectedFiles(): void {
  void uploader.value?.submit()
}

/**
 * 页面离开时释放模拟上传的计时器，防止异步进度覆盖其他页面。
 * Releases the simulated upload timers when leaving the page, preventing async progress from updating another page.
 */
onBeforeUnmount(() => {
  demoUpload.dispose()
})
</script>

<template>
  <section
    class="demo-shell"
    :aria-label="isEnglish ? 'Interactive file upload demo' : '文件上传交互示例'"
  >
    <div class="demo-toolbar">
      <button
        v-if="manual"
        class="demo-action"
        type="button"
        :disabled="files.length === 0"
        @click="submitSelectedFiles"
      >
        {{ isEnglish ? 'Start upload' : '开始上传' }}
      </button>
      <p class="demo-caption">{{ demoCaption }}</p>
    </div>
    <FlowUpload
      ref="uploader"
      v-model="files"
      belong-id="demo-order-1"
      :auto-upload="!manual"
      :transport="demoUpload.transport"
      :locale="isEnglish ? 'en-US' : 'zh-CN'"
      accept="image/*,.pdf,.zip"
      drag
      :max-count="3"
    >
      <template #tip>{{
        isEnglish
          ? 'Images, PDFs, and ZIP files; this demo sends no network request.'
          : '支持图片、PDF、ZIP；此示例不会发送网络请求。'
      }}</template>
    </FlowUpload>
  </section>
</template>
