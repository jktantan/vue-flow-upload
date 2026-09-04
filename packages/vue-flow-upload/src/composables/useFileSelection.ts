import { computed, ref, type ComputedRef } from 'vue'

interface FileSelectionOptions {
  accept: ComputedRef<string | string[] | undefined>
  canSelect: ComputedRef<boolean>
  addFiles: (files: File[]) => void | Promise<void>
}

/** 管理仅属于 DOM 的文件输入状态，校验仍由上传队列负责。 Owns DOM-only file-input state while the upload queue validates files. */
export function useFileSelection(options: FileSelectionOptions) {
  // 将数组 accept 转为原生 input 可识别的逗号分隔值。 Converts array accept values to the native input's comma-separated form.
  const input = ref<HTMLInputElement>()
  const acceptValue = computed(() =>
    Array.isArray(options.accept.value) ? options.accept.value.join(',') : options.accept.value,
  )

  function browse() {
    // 权限允许时才主动打开隐藏的原生文件选择器。 Open the hidden native picker only when selection is permitted.
    if (options.canSelect.value) input.value?.click()
  }

  function onSelect(event: Event) {
    // 读取后立即清空 input，确保重复选择同一文件仍会触发 change。 Clear the input after reading so reselecting the same file still emits change.
    void options.addFiles(Array.from((event.target as HTMLInputElement).files ?? []))
    if (input.value) input.value.value = ''
  }

  return { input, acceptValue, browse, onSelect }
}
