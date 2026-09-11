<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { FlowUpload, type UploadFileItem, type UploadTransport } from 'vue-flow-upload'

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
/** 文档示例所维护的受控文件列表。 Controlled file list maintained by the documentation demo. */
const files = ref<UploadFileItem[]>([])
/** 供手动模式调用的组件公开方法。 Component exposed methods used by manual mode. */
const uploader = ref<{ submit: () => Promise<void> }>()
/** 正在上传的定时器集合；组件卸载时必须停止，避免示例在页面切换后写回状态。 Active upload timer collection; it must stop on unmount so demos do not write state after navigation. */
const uploadTimers = new Set<number>()
/** 根据模式生成清晰的示例提示。 Produces a clear demo hint based on the selected mode. */
const demoCaption = computed(() =>
  props.manual
    ? '选择文件后，点击“开始上传”触发队列。'
    : '选择或拖入文件，查看组件的真实上传状态变化。',
)

/**
 * 提供纯前端的上传过程，令文档示例无需依赖开发者的后端。
 * Provides a browser-only upload flow so documentation demos do not depend on a developer's backend.
 */
const demoTransport: UploadTransport = {
  uploadFile({ file }, { onProgress, signal }) {
    return new Promise((resolve, reject) => {
      // 模拟上传的已完成字节数，确保进度按文件尺寸计算。
      // Simulated uploaded byte count, ensuring progress is calculated against the file size.
      let uploadedBytes = 0
      // 将零字节文件也视为一次可完成的上传，避免除零或永久等待。
      // Treats zero-byte files as completable uploads too, avoiding division by zero or an endless wait.
      const totalBytes = Math.max(file.size, 1)
      // 用短间隔展示连续进度，既易观察又不拖慢文档浏览。
      // A short interval shows continuous progress without slowing documentation browsing.
      const timer = window.setInterval(() => {
        uploadedBytes = Math.min(totalBytes, uploadedBytes + Math.max(1, Math.ceil(totalBytes / 8)))
        onProgress(uploadedBytes, totalBytes)
        if (uploadedBytes === totalBytes) {
          window.clearInterval(timer)
          uploadTimers.delete(timer)
          resolve({
            fileId: `demo-${Date.now()}`,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            status: 'success',
          })
        }
      }, 130)
      uploadTimers.add(timer)
      signal.addEventListener(
        'abort',
        () => {
          window.clearInterval(timer)
          uploadTimers.delete(timer)
          reject({ code: 'ABORTED', message: '上传已取消', retriable: false })
        },
        { once: true },
      )
    })
  },
}

/**
 * 启动已选择的待上传文件；仅在关闭自动上传时显示该操作。
 * Starts selected pending files; this action is shown only when automatic upload is disabled.
 */
function submitSelectedFiles(): void {
  void uploader.value?.submit()
}

/**
 * 页面离开时释放模拟上传计时器，防止异步进度覆盖其他页面。
 * Releases simulated upload timers when leaving the page, preventing async progress from updating another page.
 */
onBeforeUnmount(() => {
  uploadTimers.forEach((timer) => window.clearInterval(timer))
  uploadTimers.clear()
})
</script>

<template>
  <section class="demo-shell" aria-label="文件上传交互示例">
    <div class="demo-toolbar">
      <button
        v-if="manual"
        class="demo-action"
        type="button"
        :disabled="files.length === 0"
        @click="submitSelectedFiles"
      >
        开始上传
      </button>
      <p class="demo-caption">{{ demoCaption }}</p>
    </div>
    <FlowUpload
      ref="uploader"
      v-model="files"
      :auto-upload="!manual"
      :transport="demoTransport"
      accept="image/*,.pdf,.zip"
      drag
      :max-count="3"
    >
      <template #tip>支持图片、PDF、ZIP；此示例不会发送网络请求。</template>
    </FlowUpload>
  </section>
</template>
