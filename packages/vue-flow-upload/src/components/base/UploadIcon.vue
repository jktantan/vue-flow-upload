<script setup lang="ts">
/** 上传组件内部操作图标名称。 Names of internal upload-operation icons. */
type UploadIconName = 'preview' | 'download' | 'retry' | 'remove' | 'edit' | 'upload'

/** 操作图标输入。 Operation icon input. */
interface UploadIconProps {
  /** 要渲染的语义化图标。 Semantic icon to render. */
  name: UploadIconName
}
/** 经过 TypeScript 约束的操作图标输入。 TypeScript-constrained operation icon input. */
defineProps<UploadIconProps>()
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <template v-if="name === 'preview'">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </template>
    <template v-else-if="name === 'retry'">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </template>
    <template v-else-if="name === 'remove'">
      <path d="M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </template>
    <template v-else-if="name === 'edit'">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="m12.5 7.5 4 4" />
    </template>
    <template v-else>
      <path d="M12 16V4m-5 5 5-5 5 5M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
    </template>
  </svg>
</template>
