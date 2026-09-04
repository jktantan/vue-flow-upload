import { computed, ref, type ComputedRef } from 'vue'
import type { UploadFileItem } from '../types'

/** Owns selection state used by batch download and removal actions. */
export function useFileSelectionState(files: ComputedRef<UploadFileItem[]>) {
  const selected = ref(new Set<string>())
  const selectableFiles = computed(() => files.value.filter((file) => file.fileId))
  const allSelected = computed(
    () =>
      selectableFiles.value.length > 0 &&
      selectableFiles.value.every((file) => selected.value.has(file.uid)),
  )

  function toggle(uid: string) {
    const next = new Set(selected.value)
    if (next.has(uid)) next.delete(uid)
    else next.add(uid)
    selected.value = next
  }

  function toggleAll() {
    selected.value = allSelected.value
      ? new Set()
      : new Set(selectableFiles.value.map((file) => file.uid))
  }

  function remove(uid: string) {
    selected.value.delete(uid)
  }

  function clear() {
    selected.value = new Set()
  }

  return { selected, selectableFiles, allSelected, toggle, toggleAll, remove, clear }
}
