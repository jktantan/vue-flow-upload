import assert from 'node:assert/strict'
import process from 'node:process'
import { Blob } from 'node:buffer'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { localUploadApi } from '../../../playground/local-api.ts'

test('playground serves the default query protocol with pagination and validation', async () => {
  // 隔离演示存储，避免回归测试修改开发者的本地文件。
  // Isolate demo storage so regression tests never modify developer files.
  const directory = await mkdtemp(join(tmpdir(), 'vfu-query-'))
  // 保存环境配置并在测试结束恢复。
  // Preserve environment configuration and restore it after the test.
  const previous = [process.env.PLAYGROUND_UPLOAD_DIR, process.env.PLAYGROUND_DB_PATH]
  process.env.PLAYGROUND_UPLOAD_DIR = join(directory, 'uploads')
  process.env.PLAYGROUND_DB_PATH = join(directory, 'test.sqlite')
  // 使用真实 HTTP 请求执行 Vite 本地中间件。
  // Execute the Vite local middleware using real HTTP requests.
  const server = createServer()
  // 保存插件实例，以便测试结束时触发与 Vite 一致的资源清理钩子。
  // Retain the plugin instance so the test can invoke the same resource-cleanup hook as Vite.
  const uploadApi = localUploadApi()
  uploadApi.configureServer({
    middlewares: { use: (middleware) => server.on('request', middleware) },
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  // 临时服务地址仅在当前测试内使用。
  // The temporary server address is used only within this test.
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  try {
    for (const fileId of ['first', 'second']) {
      // 写入不同内容以满足本地哈希唯一约束。
      // Upload distinct content to satisfy the local unique hash constraint.
      const form = new FormData()
      form.set('fileId', fileId)
      form.set('file', new Blob([fileId], { type: 'text/plain' }), `${fileId}.txt`)
      assert.equal(
        (await fetch(`${baseUrl}/api/files/upload`, { method: 'POST', body: form })).status,
        200,
      )
    }
    for (const pagination of [{ enabled: false }, { enabled: true, currentPage: 2, pageSize: 1 }]) {
      // 请求形状与内置 HTTP 查询适配器保持一致。
      // Keep the request shape identical to the built-in HTTP query adapter.
      const response = await fetch(`${baseUrl}/api/files/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: { belongId: 'playground-demo', belongType: 'playground' },
          pagination,
        }),
      })
      assert.equal(response.status, 200)
      // 验证分页回显及组件需要的文件字段。
      // Verify pagination metadata and the file fields required by the component.
      const result = await response.json()
      assert.deepEqual(
        result.pagination,
        pagination.enabled ? { ...pagination, total: 2 } : pagination,
      )
      assert.equal(result.files.length, pagination.enabled ? 1 : 2)
      assert.equal(result.files[0].uid, result.files[0].fileId)
      assert.equal(result.files[0].type, 'text/plain')
      assert.equal(result.files[0].status, 'success')
    }
    // 删除后重新查询必须返回后台的新列表及总数。
    // A query after deletion must return the updated server list and total.
    assert.equal((await fetch(`${baseUrl}/api/files/first`, { method: 'DELETE' })).status, 204)
    // 使用与组件删除后刷新相同的 POST 协议回读。
    // Reload using the same POST protocol as the component's post-removal refresh.
    const refreshed = await (
      await fetch(`${baseUrl}/api/files/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: {},
          pagination: { enabled: true, currentPage: 1, pageSize: 10 },
        }),
      })
    ).json()
    assert.equal(refreshed.pagination.total, 1)
    assert.deepEqual(
      refreshed.files.map((file) => file.fileId),
      ['second'],
    )
    for (const pagination of [undefined, { enabled: true, currentPage: 0, pageSize: 1 }]) {
      assert.equal(
        (
          await fetch(`${baseUrl}/api/files/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pagination }),
          })
        ).status,
        400,
      )
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
    // 关闭 SQLite 原生句柄，避免 Node 测试 worker 在退出时保留数据库资源。
    // Close the SQLite native handle so the Node test worker cannot retain database resources at exit.
    await uploadApi.closeBundle?.()
    if (previous[0] === undefined) delete process.env.PLAYGROUND_UPLOAD_DIR
    else process.env.PLAYGROUND_UPLOAD_DIR = previous[0]
    if (previous[1] === undefined) delete process.env.PLAYGROUND_DB_PATH
    else process.env.PLAYGROUND_DB_PATH = previous[1]
    await rm(directory, { recursive: true, force: true })
  }
})
