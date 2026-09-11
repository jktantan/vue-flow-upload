# 常用场景

## 受控文件列表

传入 `v-model` 后，外部列表是事实来源。组件不会直接修改 prop，而是通过 `update:modelValue` 回传新列表。

```vue
<FlowUpload v-model="files" action="/files" />
```

## 限制类型、大小和数量

```vue
<FlowUpload
  v-model="files"
  action="/files"
  accept="image/*,.pdf"
  :max-size="20 * 1024 * 1024"
  :max-count="5"
  drag
/>
```

`accept` 是浏览器端选择提示，服务端仍应校验文件类型和大小。

## 关闭自动上传

设置 `auto-upload="false"` 后，选择文件不会立刻请求。通过组件实例的 `submit()` 启动队列，见[手动上传 DEMO](/demos/manual-upload)。

## 头像

`AvatarUpload` 面向单头像：图片选择后先进行 1:1 裁剪，再调用上传接口。见[头像上传 DEMO](/demos/avatar-upload)。
