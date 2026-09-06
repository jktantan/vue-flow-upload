<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n-lite'
import { createFlowUploadI18n, getUploadMessages } from '../i18n'
import type { UploadPagination } from '../types'

const props = withDefaults(defineProps<UploadPagination>(), {
  total: 0,
  currentPage: 1,
  pageSize: 10,
  pageSizes: () => [10, 20, 30, 40],
  size: 'default',
  background: false,
  disabled: false,
})
const emit = defineEmits<{
  'update:currentPage': [value: number]
  'update:pageSize': [value: number]
  change: [currentPage: number, pageSize: number]
}>()
const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const inheritedI18n = useI18n()
const localI18n = createFlowUploadI18n()
const text = computed(() => getUploadMessages(inheritedI18n ?? localI18n))
const pages = computed(() => {
  const start = Math.max(1, Math.min(props.currentPage - 2, pageCount.value - 4))
  const end = Math.min(pageCount.value, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

function changePage(page: number) {
  if (props.disabled || page === props.currentPage || page < 1 || page > pageCount.value) return
  emit('update:currentPage', page)
  emit('change', page, props.pageSize)
}

function changeSize(event: Event) {
  const size = Number((event.target as HTMLSelectElement).value)
  if (!size || props.disabled) return
  emit('update:pageSize', size)
  emit('update:currentPage', 1)
  emit('change', 1, size)
}
</script>

<template>
  <nav
    class="vfu-pagination"
    :class="[`is-${size}`, { 'is-background': background, 'is-disabled': disabled }]"
    :aria-label="text.paginationLabel"
  >
    <span class="vfu-pagination__total">{{
      text.paginationTotal.replace('{total}', String(total))
    }}</span>
    <label class="vfu-pagination__sizes">
      <select
        :value="pageSize"
        :disabled="disabled"
        :aria-label="text.paginationItemsPerPage"
        @change="changeSize"
      >
        <option v-for="option in pageSizes" :key="option" :value="option">
          {{ text.paginationItemsPerPage.replace('{size}', String(option)) }}
        </option>
      </select>
    </label>
    <button
      type="button"
      :aria-label="text.paginationPrevious"
      :disabled="disabled || currentPage <= 1"
      @click="changePage(currentPage - 1)"
    >
      &lt;
    </button>
    <button
      v-for="page in pages"
      :key="page"
      type="button"
      :class="{ 'is-active': page === currentPage }"
      :disabled="disabled"
      @click="changePage(page)"
    >
      {{ page }}
    </button>
    <button
      type="button"
      :aria-label="text.paginationNext"
      :disabled="disabled || currentPage >= pageCount"
      @click="changePage(currentPage + 1)"
    >
      &gt;
    </button>
    <label class="vfu-pagination__jumper">
      {{ text.paginationGoTo }}
      <input
        :value="currentPage"
        type="number"
        min="1"
        :max="pageCount"
        :disabled="disabled"
        :aria-label="text.paginationPageNumber"
        @change="changePage(Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </nav>
</template>
