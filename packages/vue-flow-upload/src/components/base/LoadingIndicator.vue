<script setup lang="ts">
/** 通用加载指示器输入；用于查询、初始化等不具备可靠百分比的异步操作。 Generic loading-indicator input; used for queries, initialization, and other async work without a reliable percentage. */
interface LoadingIndicatorProps {
  /** 向用户和辅助技术说明正在加载的内容。 Describes the content currently loading to users and assistive technology. */
  label: string
}
/** 经过 TypeScript 约束的加载指示器输入。 TypeScript-constrained loading-indicator input. */
defineProps<LoadingIndicatorProps>()
</script>

<template>
  <div class="vfu-loading-indicator" role="status" :aria-label="label">
    <span class="vfu-loading-indicator__spinner" aria-hidden="true" />
    <span>{{ label }}</span>
  </div>
</template>
