<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n-lite'
import { createFlowUploadI18n, flowUploadI18nKey, getUploadMessages } from '../../i18n'
import type { UploadPagination } from '../../types'

/** 受控分页输入；父组件始终负责加载所选页面。 Controlled pagination input; the parent remains responsible for loading the selected page. */
type UploadPaginationProps = UploadPagination
/** 经过 TypeScript 约束且填充默认值的分页输入。 TypeScript-constrained pagination input with defaults. */
const props = withDefaults(defineProps<UploadPaginationProps>(), {
  total: 0,
  currentPage: 1,
  pageSize: 10,
  pageSizes: () => [10, 20, 30, 40],
})
/** 分页组件向父级报告的受控值和组合变更事件。 Controlled-value and combined-change events reported by pagination. */
interface UploadPaginationEmits {
  /** 当前页变化时发送。 Sent when the current page changes. */
  (event: 'update:currentPage', value: number): void
  /** 每页条数变化时发送。 Sent when the page size changes. */
  (event: 'update:pageSize', value: number): void
  /** 页码或页尺寸变化后发送最终组合值。 Sends final combined values after either page number or size changes. */
  (event: 'change', currentPage: number, pageSize: number): void
}
/** 经过 TypeScript 约束的分页事件发送器。 TypeScript-constrained pagination event emitter. */
const emit = defineEmits<UploadPaginationEmits>()
/** At least one page is rendered even when the server reports an empty result set. */
const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
/** 宿主全局注入的 i18n 实例。 Host-wide injected i18n instance. */
const inheritedI18n = useI18n()
/** FlowUpload 解析后的 i18n 实例，优先使用以跟随组件的 locale 配置。 Resolved FlowUpload i18n instance, preferred so the component locale configuration is honored. */
const providedI18n = inject(flowUploadI18nKey, undefined)
/** 组件独立使用时的内置语言兜底，固定为默认语言。 Built-in fallback for standalone usage, fixed to the default locale. */
const localI18n = createFlowUploadI18n()
/** 分页文案；优先使用组件树实例，语言切换后随计算属性自动更新。 Pagination copy; prefers the component-tree instance and updates through the computed value when the locale changes. */
const text = computed(() => getUploadMessages(providedI18n?.value ?? inheritedI18n ?? localI18n))
/** Five-page sliding window around the current page, clamped at both ends. */
const pages = computed(() => {
  const start = Math.max(1, Math.min(props.currentPage - 2, pageCount.value - 4))
  const end = Math.min(pageCount.value, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

function changePage(page: number) {
  // Ignore duplicate and out-of-range requests before emitting to the host.
  if (page === props.currentPage || page < 1 || page > pageCount.value) return
  emit('update:currentPage', page)
  emit('change', page, props.pageSize)
}

function changeSize(event: Event) {
  // Changing page size resets to page 1 because the old page may no longer exist.
  const size = Number((event.target as HTMLSelectElement).value)
  if (!size) return
  emit('update:pageSize', size)
  emit('update:currentPage', 1)
  emit('change', 1, size)
}
</script>

<template>
  <nav class="vfu-pagination" :aria-label="text.paginationLabel">
    <span class="vfu-pagination__total">{{
      text.paginationTotal.replace('{total}', String(total))
    }}</span>
    <label class="vfu-pagination__sizes">
      <select :value="pageSize" :aria-label="text.paginationItemsPerPage" @change="changeSize">
        <option v-for="option in pageSizes" :key="option" :value="option">
          {{ text.paginationItemsPerPage.replace('{size}', String(option)) }}
        </option>
      </select>
    </label>
    <button
      type="button"
      :aria-label="text.paginationPrevious"
      :disabled="currentPage <= 1"
      @click="changePage(currentPage - 1)"
    >
      &lt;
    </button>
    <button
      v-for="page in pages"
      :key="page"
      type="button"
      :class="{ 'is-active': page === currentPage }"
      @click="changePage(page)"
    >
      {{ page }}
    </button>
    <button
      type="button"
      :aria-label="text.paginationNext"
      :disabled="currentPage >= pageCount"
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
        :aria-label="text.paginationPageNumber"
        @change="changePage(Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </nav>
</template>
