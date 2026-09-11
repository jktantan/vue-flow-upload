# 头像上传

头像组件会在选择图片后打开 1:1 裁剪器，确认后再上传生成的 512 × 512 图片。

<script setup lang="ts">
import AvatarDemo from '../.vitepress/theme/components/AvatarDemo.vue'
</script>

<AvatarDemo />

```vue
<AvatarUpload
  v-model="avatarFiles"
  :transport="transport"
  accept="image/*"
  :max-size="5 * 1024 * 1024"
/>
```
