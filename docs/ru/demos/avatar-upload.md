# Загрузка аватара

Компонент аватара открывает обрезчик 1:1 после выбора изображения и загружает готовое изображение 512 × 512 после подтверждения. Круг влияет только на карточку и маску обрезки, а загружаемый файл остаётся квадратным. Демонстрация ниже позволяет сразу комбинировать три частых настройки: форму, режим только чтения и просмотр.

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
