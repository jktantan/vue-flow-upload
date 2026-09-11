<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { AvatarUpload, type UploadFileItem, type UploadTransport } from 'vue-flow-upload'

/** 文档头像示例维护的受控头像列表。 Controlled avatar list maintained by the documentation avatar demo. */
const avatarFiles = ref<UploadFileItem[]>([])
/** 模拟上传计时器；离开页面时清理以避免异步回写。 Simulated upload timer; cleared on navigation to prevent async writes. */
let uploadTimer: number | undefined

/**
 * 为头像裁剪与上传流程提供本地成功响应，避免示例依赖后端接口。
 * Supplies a local success response for the avatar crop-and-upload flow, avoiding a backend dependency in the demo.
 */
const avatarTransport: UploadTransport = {
  uploadFile({ file }, { onProgress, signal }) {
    return new Promise((resolve, reject) => {
      // 用固定的短延迟保留“确认上传”这一真实交互反馈。
      // A short fixed delay preserves real feedback for the "confirm upload" interaction.
      uploadTimer = window.setTimeout(() => {
        uploadTimer = undefined
        onProgress(file.size, file.size)
        resolve({ fileId: `avatar-demo-${Date.now()}`, name: file.name, status: 'success' })
      }, 260)
      signal.addEventListener(
        'abort',
        () => {
          if (uploadTimer !== undefined) window.clearTimeout(uploadTimer)
          uploadTimer = undefined
          reject({ code: 'ABORTED', message: '上传已取消', retriable: false })
        },
        { once: true },
      )
    })
  },
}

/**
 * 卸载时停止尚未完成的模拟请求，确保示例资源完全释放。
 * Stops a pending simulated request on unmount, ensuring all demo resources are released.
 */
onBeforeUnmount(() => {
  if (uploadTimer !== undefined) window.clearTimeout(uploadTimer)
})
</script>

<template>
  <section class="demo-shell" aria-label="头像上传交互示例">
    <p class="demo-caption">选择一张图片，在裁剪框中调整后确认；上传过程仅在浏览器内模拟。</p>
    <AvatarUpload
      v-model="avatarFiles"
      :transport="avatarTransport"
      accept="image/*"
      :max-size="5 * 1024 * 1024"
      :width="190"
      :height="190"
    />
  </section>
</template>
