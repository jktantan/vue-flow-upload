<script setup lang="ts">
import UploadPagination from './UploadPagination.vue'
import type { UploadPagination as UploadPaginationOptions } from '../types'

const props = defineProps<{
  visible: boolean
  pagination?: UploadPaginationOptions
}>()
const emit = defineEmits<{
  'update:pagination': [value: UploadPaginationOptions]
  'pagination-change': [currentPage: number, pageSize: number]
}>()

function handlePaginationChange(currentPage: number, pageSize: number) {
  // Emit one complete value so v-model:pagination never loses the other fields.
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
