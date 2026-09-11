<script setup lang="ts">
import UploadPagination from './UploadPagination.vue'
import type { UploadPagination as UploadPaginationOptions } from '../types'

/** 页脚输入；分页存在时渲染受控分页，否则渲染宿主插槽。 Footer input; renders controlled pagination when present, otherwise the host slot. */
interface UploadFooterProps {
  visible: boolean
  pagination?: UploadPaginationOptions
}
/** 经过 TypeScript 约束的页脚输入。 TypeScript-constrained footer input. */
const props = defineProps<UploadFooterProps>()
/** 页脚向上同步完整分页值和简化变更事件。 Footer propagates both the complete pagination value and a convenience change event. */
interface UploadFooterEmits {
  /** 受控分页完整值。 Complete controlled pagination value. */
  (event: 'update:pagination', value: UploadPaginationOptions): void
  /** 页码或页尺寸变化后发送。 Sent after page number or page size changes. */
  (event: 'pagination-change', currentPage: number, pageSize: number): void
}
/** 经过 TypeScript 约束的页脚事件发送器。 TypeScript-constrained footer event emitter. */
const emit = defineEmits<UploadFooterEmits>()

function handlePaginationChange(currentPage: number, pageSize: number) {
  // Merge rather than replace so total/pageSizes survive a page or size change.
  emit('update:pagination', { ...props.pagination, currentPage, pageSize })
  emit('pagination-change', currentPage, pageSize)
}
</script>

<template>
  <div v-if="visible" class="vfu-upload__footer">
    <footer class="vfu-list-footer">
      <UploadPagination
        v-if="props.pagination"
        v-bind="props.pagination"
        @change="handlePaginationChange"
      />
      <slot v-else />
    </footer>
  </div>
</template>
