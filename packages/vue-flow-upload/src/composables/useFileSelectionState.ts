import { computed, ref, type ComputedRef } from 'vue'
import type { UploadFileItem } from '../types'

/** 管理批量下载和删除操作使用的选择状态。 Owns selection state for batch download and removal actions. */
export function useFileSelectionState(files: ComputedRef<UploadFileItem[]>) {
  // 文件删除或状态变化后由调用方清理对应 id，避免保留过期选择。 Callers remove ids on file changes to avoid stale selections.
  const selected = ref(new Set<string>())
  const selectableFiles = computed(() => files.value.filter((file) => file.fileId))
  const allSelected = computed(
    () =>
      selectableFiles.value.length > 0 &&
      selectableFiles.value.every((file) => selected.value.has(file.uid)),
  )

  function toggle(uid: string) {
    // 创建新 Set 而非原地变更，以触发 Vue 对集合引用的响应式更新。 Replace rather than mutate the Set so Vue observes the selection update.
    const next = new Set(selected.value)
    if (next.has(uid)) next.delete(uid)
    else next.add(uid)
    selected.value = next
  }

  function toggleAll() {
    // 全选范围仅限具有服务端 fileId 的文件。 Select all only among files that have a server fileId.
    selected.value = allSelected.value
      ? new Set()
      : new Set(selectableFiles.value.map((file) => file.uid))
  }

  function remove(uid: string) {
    // 单文件删除时同步移除其选择标记。 Remove a file's selection marker when it is deleted.
    selected.value.delete(uid)
  }

  function clear() {
    // 清空列表或组件销毁时重置所有选择。 Reset all selections when the list is cleared or component is destroyed.
    selected.value = new Set()
  }

  return { selected, selectableFiles, allSelected, toggle, toggleAll, remove, clear }
}
