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

## Playground 本地真实上传模式

Playground 默认使用 Mock transport。页面切换为“本地 SQLite”后，Vite 开发服务器会提供本地 API，真实保存普通上传、分片会话、秒传哈希和文件记录。

默认数据目录为 `.playground/uploads`，数据库为 `.playground/upload.sqlite`，均已忽略 Git。可在启动前覆盖：

```bash
PLAYGROUND_UPLOAD_DIR=/private/tmp/vfu-files PLAYGROUND_DB_PATH=/private/tmp/vfu.sqlite pnpm dev
```

“清空本地测试数据”会要求确认，并清除 SQLite 记录、已上传文件及未完成分片会话；仅在本地 SQLite 模式显示。

## 构建

```bash
pnpm build
```

组件包构建产物位于 `packages/vue-flow-upload/dist`。发布前请确认 npm 包名、版本和组织 scope，并在该目录执行 `npm publish`。
