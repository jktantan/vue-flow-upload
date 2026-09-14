# Avatar upload

The avatar component opens a 1:1 cropper after image selection and uploads a 512 × 512 result after confirmation. A circle changes only the card and cropper mask; the uploaded image remains square.

<script setup lang="ts">
import AvatarDemo from '../../.vitepress/theme/components/AvatarDemo.vue'
</script>

<AvatarDemo />

```vue
<AvatarUpload
  v-model="avatarFiles"
  belong-id="profile-1"
  :transport="transport"
  accept="image/*"
  :max-size="5 * 1024 * 1024"
  :shape="avatarShape"
  :read-only="avatarReadOnly"
  :preview="avatarPreview"
/>
```
