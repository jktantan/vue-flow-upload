<script setup lang="ts">
import UploadPagination from './UploadPagination.vue'
import type { UploadPagination as UploadPaginationOptions } from '../types'

const props = defineProps<{
  visible: boolean
  count: number
  t: (key: string, values?: Record<string, string | number>) => string
  pagination?: UploadPaginationOptions
}>()
const emit = defineEmits<{
  'update:pagination': [value: Partial<UploadPaginationOptions>]
  'pagination-change': [currentPage: number, pageSize: number]
}>()
</script>

<template>
  <div v-if="visible" class="vfu-upload__footer">
    <footer class="vfu-list-footer">
      {{ t('fileCount', { count }) }}
      <UploadPagination
        v-if="props.pagination"
        v-bind="props.pagination"
        @update:current-page="(value) => emit('update:pagination', { currentPage: value })"
        @update:page-size="(value) => emit('update:pagination', { pageSize: value })"
        @change="(page, size) => emit('pagination-change', page, size)"
      />
      <slot v-else />
    </footer>
  </div>
</template>
