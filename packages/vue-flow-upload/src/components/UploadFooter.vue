<script setup lang="ts">
import UploadPagination from './UploadPagination.vue'
import type { UploadPagination as UploadPaginationOptions } from '../types'

/** Footer is either a pagination controller or the host-provided footer slot. */
const props = defineProps<{
  visible: boolean
  pagination?: UploadPaginationOptions
}>()
/** Propagates both the full pagination v-model and a convenient change event. */
const emit = defineEmits<{
  'update:pagination': [value: UploadPaginationOptions]
  'pagination-change': [currentPage: number, pageSize: number]
}>()

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
