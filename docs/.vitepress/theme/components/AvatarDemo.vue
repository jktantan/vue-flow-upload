<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useData } from 'vitepress'
import {
  AvatarUpload,
  type AvatarShape,
  type UploadFileItem,
  type UploadTransport,
} from 'vue-flow-upload'

/** 当前文档语言决定头像演示台自身文案和组件 locale。 Current documentation language determines avatar-demo copy and component locale. */
const { lang } = useData()
/** 是否正在浏览英文文档路径。 Whether the current documentation path is English. */
const isEnglish = computed(() => lang.value === 'en-US')

/** 文档头像示例维护的受控头像列表。 Controlled avatar list maintained by the documentation avatar demo. */
const avatarFiles = ref<UploadFileItem[]>([])
/** 示例中实时控制头像卡片和裁剪框的轮廓。 Shape that controls the avatar card and crop box in real time. */
const avatarShape = ref<AvatarShape>('circle')
/** 示例中锁定选择、替换与删除操作的只读开关。 Read-only switch that locks selection, replacement, and deletion in the demo. */
const avatarReadOnly = ref(false)
/** 示例中控制大图查看入口是否可用的预览开关。 Preview switch that controls whether the full-image viewer is available in the demo. */
const avatarPreview = ref(true)
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
  <section
    class="demo-shell"
    :aria-label="isEnglish ? 'Interactive avatar upload demo' : '头像上传交互示例'"
  >
    <div
      class="avatar-demo-controls"
      :aria-label="isEnglish ? 'Avatar demo settings' : '头像示例配置'"
    >
      <label>
        {{ isEnglish ? 'Shape' : '形状' }}
        <select v-model="avatarShape">
          <option value="circle">{{ isEnglish ? 'Circle' : '圆形' }}</option>
          <option value="square">{{ isEnglish ? 'Square' : '方形' }}</option>
        </select>
      </label>
      <label
        ><input v-model="avatarReadOnly" type="checkbox" />
        {{ isEnglish ? 'Read only' : '只读' }}</label
      >
      <label
        ><input v-model="avatarPreview" type="checkbox" />
        {{ isEnglish ? 'Enable preview' : '允许预览' }}</label
      >
    </div>
    <p class="demo-caption">
      {{
        isEnglish
          ? 'Select an image, adjust it in the crop box, and confirm. Upload is simulated entirely in the browser.'
          : '选择一张图片，在裁剪框中调整后确认；上传过程仅在浏览器内模拟。'
      }}
    </p>
    <AvatarUpload
      v-model="avatarFiles"
      :transport="avatarTransport"
      :locale="isEnglish ? 'en-US' : 'zh-CN'"
      accept="image/*"
      :max-size="5 * 1024 * 1024"
      :width="190"
      :height="190"
      :read-only="avatarReadOnly"
      :preview="avatarPreview"
      :shape="avatarShape"
    />
  </section>
</template>
