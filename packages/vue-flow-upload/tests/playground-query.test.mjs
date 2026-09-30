import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import { localUploadApi } from '../../../playground/local-api.ts'

/**
 * 在不绑定 TCP 端口的前提下执行本地上传 Vite 中间件，避免 Node 测试 worker 保留网络原生资源。
 * Executes the local-upload Vite middleware without binding a TCP port, preventing Node test workers from retaining native network resources.
 */
function invokeMiddleware(middleware, requestOptions) {
  // 内存请求体与 Node IncomingMessage 一样可异步迭代，供本地 API 读取 JSON 或 multipart 数据。
  // The in-memory body is async iterable like Node IncomingMessage, allowing the local API to read JSON or multipart data.
  const request = Object.assign(Readable.from(requestOptions.body ? [requestOptions.body] : []), {
    method: requestOptions.method,
    url: requestOptions.path,
    headers: requestOptions.headers ?? {},
  })
  return new Promise((resolve, reject) => {
    // 响应记录仅实现本地 API 实际使用的 writeHead 与 end 接口。
    // The response record implements only writeHead and end, which are the interfaces actually used by the local API.
    const response = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode
        this.headers = headers
      },
      end(body) {
        // 统一转换响应正文，以便调用方按真实 HTTP 的 JSON 文本处理。
        // Normalize the response body so callers process JSON text as they would from real HTTP.
        resolve({ status: this.statusCode, headers: this.headers, body: Buffer.from(body ?? '') })
      },
    }
    // 非 API 路径会调用 next；测试将其视为意外路由，避免静默通过。
    // Non-API paths call next; treat that as an unexpected route instead of silently passing the test.
    void middleware(request, response, () =>
      reject(new Error(`未处理的路由：${requestOptions.path}`)),
    )
  })
}

/**
 * 构造本地 API 所需的最小 multipart 请求体，覆盖普通文件上传和后续查询的完整持久化路径。
 * Builds the minimum multipart body required by the local API, covering normal upload and the persisted path needed by subsequent queries.
 */
function createUploadBody(fileId) {
  // 固定边界使测试请求稳定，并与 Content-Type 声明保持一致。
  // A fixed boundary keeps the test request stable and matches the Content-Type declaration.
  const boundary = 'vfu-query-boundary'
  // 文件内容与标识不同，确保本地 SHA-256 唯一索引不会拒绝第二次上传。
  // File contents differ by identifier so the local SHA-256 unique index does not reject the second upload.
  const content = Buffer.from(fileId)
  // multipart 字段按本地解析器支持的 CRLF 格式组装。
  // Multipart fields are assembled in the CRLF format accepted by the local parser.
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="fileId"\r\n\r\n${fileId}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileId}.txt"\r\nContent-Type: text/plain\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}

/**
 * 将中间件 JSON 响应转换为对象，并保留断言所需的状态码。
 * Converts a middleware JSON response into an object while retaining its status code for assertions.
 */
async function invokeJson(middleware, path, payload) {
  // JSON 请求体由调用方提供，确保查询形状与内置 HTTP 查询适配器一致。
  // The caller supplies the JSON payload, ensuring the query shape matches the built-in HTTP query adapter.
  const response = await invokeMiddleware(middleware, {
    method: 'POST',
    path,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(JSON.stringify(payload)),
  })
  return {
    ...response,
    json: response.body.length ? JSON.parse(response.body.toString('utf8')) : undefined,
  }
}

test('playground serves the default query protocol with pagination and validation', async () => {
  // 隔离演示存储，避免回归测试修改开发者的本地文件。
  // Isolate demo storage so regression tests never modify developer files.
  const directory = await mkdtemp(join(tmpdir(), 'vfu-query-'))
  // 保存环境配置并在测试结束恢复。
  // Preserve environment configuration and restore it after the test.
  const previous = [process.env.PLAYGROUND_UPLOAD_DIR, process.env.PLAYGROUND_DB_PATH]
  process.env.PLAYGROUND_UPLOAD_DIR = join(directory, 'uploads')
  process.env.PLAYGROUND_DB_PATH = join(directory, 'test.sqlite')
  // 保存插件实例，以便测试结束时触发与 Vite 一致的资源清理钩子。
  // Retain the plugin instance so the test can invoke the same resource-cleanup hook as Vite.
  const uploadApi = localUploadApi()
  // 本地 API 注册的中间件；测试以内存请求直接调用它而不启动 HTTP 服务。
  // Middleware registered by the local API; tests invoke it with in-memory requests instead of starting an HTTP server.
  let middleware
  uploadApi.configureServer({
    middlewares: { use: (registeredMiddleware) => (middleware = registeredMiddleware) },
  })
  try {
    for (const fileId of ['first', 'second']) {
      // 写入不同内容以满足本地哈希唯一约束。
      // Upload distinct content to satisfy the local unique hash constraint.
      const upload = createUploadBody(fileId)
      assert.equal(
        (
          await invokeMiddleware(middleware, {
            method: 'POST',
            path: '/api/files/upload',
            headers: { 'content-type': upload.contentType },
            body: upload.body,
          })
        ).status,
        200,
      )
    }
    for (const pagination of [{ enabled: false }, { enabled: true, currentPage: 2, pageSize: 1 }]) {
      // 请求形状与内置 HTTP 查询适配器保持一致。
      // Keep the request shape identical to the built-in HTTP query adapter.
      const response = await invokeJson(middleware, '/api/files/query', {
        query: { belongId: 'playground-demo', belongType: 'playground' },
        pagination,
      })
      assert.equal(response.status, 200)
      // 验证分页回显及组件需要的文件字段。
      // Verify pagination metadata and the file fields required by the component.
      const result = response.json
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
    assert.equal(
      (await invokeMiddleware(middleware, { method: 'DELETE', path: '/api/files/first' })).status,
      204,
    )
    // 使用与组件删除后刷新相同的 POST 协议回读。
    // Reload using the same POST protocol as the component's post-removal refresh.
    const refreshed = (
      await invokeJson(middleware, '/api/files/query', {
        query: {},
        pagination: { enabled: true, currentPage: 1, pageSize: 10 },
      })
    ).json
    assert.equal(refreshed.pagination.total, 1)
    assert.deepEqual(
      refreshed.files.map((file) => file.fileId),
      ['second'],
    )
    for (const pagination of [undefined, { enabled: true, currentPage: 0, pageSize: 1 }]) {
      assert.equal((await invokeJson(middleware, '/api/files/query', { pagination })).status, 400)
    }
  } finally {
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
