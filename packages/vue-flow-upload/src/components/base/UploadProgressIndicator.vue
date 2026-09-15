<script setup lang="ts">
import { computed } from 'vue'

/** 进行中指示器输入；未知百分比显示不定进度。 Progress indicator input; an unknown percentage displays indeterminate progress. */
interface UploadProgressIndicatorProps {
  /** 供屏幕阅读器和视觉界面显示的进行中文案。 In-progress copy shown visually and to screen readers. */
  label: string
  /** 已知上传百分比；省略时不伪造确定进度。 Known upload percentage; omitted rather than faking determinate progress. */
  progressPercent?: number
}
/** 经过 TypeScript 约束的进行中指示器输入。 TypeScript-constrained progress indicator input. */
const props = defineProps<UploadProgressIndicatorProps>()
/** 仅在传输层提供可靠数值时暴露进度条属性。 Exposes progress-bar attributes only when the transport provides a reliable value. */
const hasProgress = computed(() => props.progressPercent !== undefined)
</script>

<template>
  <div
    class="vfu-progress-indicator"
    :role="hasProgress ? 'progressbar' : 'status'"
    :aria-label="label"
    :aria-valuenow="hasProgress ? progressPercent : undefined"
    :aria-valuemin="hasProgress ? 0 : undefined"
    :aria-valuemax="hasProgress ? 100 : undefined"
  >
    <span class="vfu-progress-indicator__spinner" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>
</template>
