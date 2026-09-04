import { computed, ref, type ComputedRef } from 'vue'

interface FileSelectionOptions {
  accept: ComputedRef<string | string[] | undefined>
  canSelect: ComputedRef<boolean>
  addFiles: (files: File[]) => void | Promise<void>
}

/** Owns DOM-only file-input and drag/drop state, leaving validation to the upload queue. */
export function useFileSelection(options: FileSelectionOptions) {
  const input = ref<HTMLInputElement>()
  const acceptValue = computed(() =>
    Array.isArray(options.accept.value) ? options.accept.value.join(',') : options.accept.value,
  )

  function browse() {
    if (options.canSelect.value) input.value?.click()
  }

  function onSelect(event: Event) {
    void options.addFiles(Array.from((event.target as HTMLInputElement).files ?? []))
    if (input.value) input.value.value = ''
  }

  return { input, acceptValue, browse, onSelect }
}
