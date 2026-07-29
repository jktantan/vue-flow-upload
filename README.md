# vue-flow-upload workspace

Vue 3 文件上传组件库与本地 Playground。

## 目录

- `packages/vue-flow-upload`：未来发布到 npm 的组件包。
- `playground`：本地可视化手工测试页面，不发布到 npm。
- `docs`：设计与接入文档。

## 开发

```bash
pnpm install
pnpm dev
```

运行后访问终端输出的 Vite 地址，即可使用 Playground 手工测试组件。

## 构建

```bash
pnpm build
```

组件包构建产物位于 `packages/vue-flow-upload/dist`。发布前请确认 npm 包名、版本和组织 scope，并在该目录执行 `npm publish`。
