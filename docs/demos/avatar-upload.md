# 头像上传

头像组件会在选择图片后打开 1:1 裁剪器，确认后再上传生成的 512 × 512 图片。圆形只影响卡片与裁剪框的显示，实际上传文件仍是方形。下方 DEMO 可即时组合形状、只读和预览三个常用配置。

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
  :shape="avatarShape"
  :read-only="avatarReadOnly"
  :preview="avatarPreview"
/>
```
