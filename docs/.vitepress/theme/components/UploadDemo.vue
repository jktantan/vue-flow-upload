<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useData } from 'vitepress'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'
import { createDemoUploadTransport } from '../demo-transport'
import { DEMO_COPY, resolveDemoLocale } from '../demo-text'

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
/** 当前文档语言决定示例文案与组件 locale。 Current documentation language determines demo copy and the component locale. */
const { lang } = useData()
/** 归一化后的示例语言。 Normalized demo locale. */
const demoLocale = computed(() => resolveDemoLocale(lang.value))
/** 当前语言的示例文案。 Demo copy for the current language. */
const text = computed(() => DEMO_COPY[demoLocale.value].upload)
/** 文档示例所维护的受控文件列表。 Controlled file list maintained by the documentation demo. */
const files = ref<UploadFileItem[]>([])
/** 供手动模式调用的组件公开方法。 Component exposed methods used by manual mode. */
const uploader = ref<{ submit: () => Promise<void> }>()
/** 文档示例共用的浏览器内上传适配器；卸载时统一释放它排队的计时器。 Shared browser-only upload adapter for the demo; its queued timers are released together on unmount. */
const demoUpload = createDemoUploadTransport()
/** 示例说明文案，随演示模式变化。 Caption following the selected demo mode. */
const demoCaption = computed(() =>
  props.manual ? text.value.captionManual : text.value.captionAuto,
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
  <section class="demo-shell" :aria-label="text.ariaLabel">
    <div class="demo-toolbar">
      <button
        v-if="manual"
        class="demo-action"
        type="button"
        :disabled="files.length === 0"
        @click="submitSelectedFiles"
      >
        {{ text.startUpload }}
      </button>
      <p class="demo-caption">{{ demoCaption }}</p>
    </div>
    <FlowUpload
      ref="uploader"
      v-model="files"
      belong-id="demo-order-1"
      :auto-upload="!manual"
      :transport="demoUpload.transport"
      :locale="demoLocale"
      accept="image/*,.pdf,.zip"
      drag
      :max-count="3"
    >
      <template #tip>{{ text.tip }}</template>
    </FlowUpload>
  </section>
</template>
