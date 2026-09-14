import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createFlowUploadI18n,
  createHttpDownloadTransport,
  createHttpFileQueryTransport,
  ChunkScheduler,
  hashFile,
  resolveMessages,
  resolveTheme,
} from '../dist/index.js'

/**
 * 在 Node 测试中模拟足以验证 HTTP 下载适配器的最小 XHR 行为。
 * Simulates the minimum XHR behavior needed to verify the HTTP download adapter in Node tests.
 */
class DownloadTransportXmlHttpRequest {
  /** 测试按创建顺序消费的伪响应。 Fake responses consumed by tests in creation order. */
  static responses = []

  /** 已创建请求，供断言 HTTP 映射使用。 Created requests used to assert the HTTP mapping. */
  static requests = []

  /** 当前请求记录的请求头。 Request headers recorded for the current request. */
  headers = new Map()

  /** 当前请求的响应类型。 Response type for the current request. */
  responseType = ''

  /** 当前请求的 HTTP 状态码。 HTTP status code for the current request. */
  status = 0

  /** 当前请求的响应正文。 Response body for the current request. */
  response = null

  /** 当前请求的文本响应正文。 Text response body for the current request. */
  responseText = ''

  /** 当前请求的响应头。 Response headers for the current request. */
  responseHeaders = new Map()

  /** 记录请求行以验证 URL、方法和查询参数。 Records the request line to verify URL, method, and query parameters. */
  open(method, url) {
    this.method = method
    this.url = url
  }

  /** 记录调用方传入的 HTTP 请求头。 Records an HTTP request header supplied by the caller. */
  setRequestHeader(name, value) {
    this.headers.set(name, value)
  }

  /** 返回指定名称的伪响应头。 Returns a fake response header by name. */
  getResponseHeader(name) {
    return this.responseHeaders.get(name) ?? null
  }

  /** 测试不需要派发 loadend，只需接受适配器注册与移除监听。 Tests need not dispatch loadend; they only accept adapter listener registration and removal. */
  addEventListener() {}

  /** 测试不需要派发 loadend，只需接受适配器注册与移除监听。 Tests need not dispatch loadend; they only accept adapter listener registration and removal. */
  removeEventListener() {}

  /** 异步完成请求，使其匹配真实 XHR 的事件时序。 Completes the request asynchronously to match real XHR event timing. */
  send(body) {
    this.body = body
    DownloadTransportXmlHttpRequest.requests.push(this)
    /** 每个请求对应一个由测试预置的响应。 Each request maps to one response arranged by the test. */
    const nextResponse = DownloadTransportXmlHttpRequest.responses.shift()
    globalThis.queueMicrotask(() => {
      this.status = nextResponse.status
      this.response = nextResponse.response ?? null
      this.responseText = nextResponse.responseText ?? ''
      this.responseHeaders = new Map(Object.entries(nextResponse.headers ?? {}))
      this.onload()
    })
  }
}

test('scheduler observes request and file concurrency limits', async () => {
  const scheduler = new ChunkScheduler({
    maxConcurrentChunksPerFile: 1,
    maxConcurrentFiles: 1,
    maxConcurrentRequests: 1,
  })
  let running = 0
  let peak = 0
  const run = () =>
    scheduler.schedule('one', async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => globalThis.setTimeout(resolve, 5))
      running -= 1
    })
  await Promise.all([run(), run()])
  assert.equal(peak, 1)
})

test('messages and built-in themes resolve without UI library dependencies', () => {
  assert.equal(resolveMessages('en-US').downloadAll, 'Download all')
  const i18n = createFlowUploadI18n({
    locale: 'en-US',
    messages: { 'en-US': { VueFlowUpload: { downloadAll: 'Get every file' } } },
  })
  assert.equal(i18n.t('VueFlowUpload.downloadAll'), 'Get every file')
  assert.equal(i18n.t('VueFlowUpload.fileCount', { count: 3 }), '3 files total')
  assert.equal(resolveTheme('element-plus').variables['--vfu-signal'], '#409eff')
})

test('scheduler rejects queued work for a canceled file without interrupting active work', async () => {
  const scheduler = new ChunkScheduler({
    maxConcurrentChunksPerFile: 1,
    maxConcurrentFiles: 1,
    maxConcurrentRequests: 1,
  })
  let release
  const active = scheduler.schedule(
    'one',
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  const queued = scheduler.schedule('one', async () => 'must not run')
  scheduler.cancel('one')
  await assert.rejects(queued, { name: 'AbortError' })
  release('done')
  assert.equal(await active, 'done')
})

test('hashFile hashes incrementally and reports final progress outside worker environments', async () => {
  const file = new File(['abc'], 'sample.txt', { type: 'text/plain' })
  const progress = []
  const digest = await hashFile(file, {
    chunkSize: 1,
    onProgress: (loaded) => progress.push(loaded),
  })
  assert.equal(digest, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.deepEqual(progress, [1, 2, 3])
})

test('HTTP download transport maps direct download and archive lifecycle endpoints', async () => {
  /** 保存并替换浏览器 XHR，以在 Node 环境中验证传输契约。 Saves and replaces browser XHR to verify the transport contract in Node. */
  const originalXmlHttpRequest = globalThis.XMLHttpRequest
  globalThis.XMLHttpRequest = DownloadTransportXmlHttpRequest
  DownloadTransportXmlHttpRequest.requests = []
  DownloadTransportXmlHttpRequest.responses = [
    {
      status: 200,
      response: new globalThis.Blob(['content']),
      headers: { 'Content-Disposition': "attachment; filename*=UTF-8''report%20one.pdf" },
    },
    { status: 202, responseText: JSON.stringify({ taskId: 'task-1', status: 'pending' }) },
    {
      status: 200,
      responseText: JSON.stringify({
        taskId: 'task-1',
        status: 'success',
        downloadUrl: 'https://files.example.test/archive.zip',
      }),
    },
    { status: 204 },
  ]
  try {
    /** 下载端点使用模板，归档端点使用同一基础 URL 与认证配置。 Download uses a template while archive endpoints share the base URL and auth configuration. */
    const transport = createHttpDownloadTransport({
      baseUrl: '/api',
      credentials: 'include',
      downloadUrl: '/files/{fileId}/download',
      archive: {
        createUrl: '/archives',
        taskUrl: '/archives/{taskId}',
        cancelUrl: '/archives/{taskId}',
      },
    })
    /** 请求上下文模拟组件解析后的认证和公共查询元数据。 Request context simulates the component-resolved authentication and common query metadata. */
    const context = {
      headers: { Authorization: 'Bearer example' },
      data: {},
      fileFieldName: 'file',
      dataFieldName: 'data',
      query: { source: 'test' },
    }

    const resource = await transport.downloadFile(
      { fileId: 'one/two', fileName: 'fallback.pdf' },
      context,
    )
    assert.equal(resource.fileName, 'report one.pdf')
    assert.ok(resource.blob instanceof globalThis.Blob)
    const archive = await transport.createArchive({ fileIds: ['one', 'two'] }, context)
    assert.deepEqual(archive, { taskId: 'task-1', status: 'pending' })
    const completedArchive = await transport.getArchiveTask('task-1', context)
    assert.equal(completedArchive.downloadUrl, 'https://files.example.test/archive.zip')
    await transport.cancelArchive('task-1', context)

    assert.equal(DownloadTransportXmlHttpRequest.requests[0].method, 'GET')
    assert.match(
      DownloadTransportXmlHttpRequest.requests[0].url,
      /files\/one%2Ftwo\/download\?source=test/,
    )
    assert.equal(
      DownloadTransportXmlHttpRequest.requests[0].headers.get('Authorization'),
      'Bearer example',
    )
    assert.equal(DownloadTransportXmlHttpRequest.requests[1].method, 'POST')
    assert.equal(
      DownloadTransportXmlHttpRequest.requests[1].headers.get('Content-Type'),
      'application/json',
    )
    assert.equal(
      DownloadTransportXmlHttpRequest.requests[1].body,
      JSON.stringify({ fileIds: ['one', 'two'] }),
    )
    assert.equal(DownloadTransportXmlHttpRequest.requests[3].method, 'DELETE')
  } finally {
    /** 恢复全局 XHR，确保本测试不会影响其他测试。 Restores global XHR so this test cannot affect other tests. */
    globalThis.XMLHttpRequest = originalXmlHttpRequest
  }
})

test('HTTP file query transport sends explicit pagination and validates the response', async () => {
  /** 保存并替换浏览器 XHR，以验证查询适配器的请求体与标准化结果。 Saves and replaces browser XHR to verify query-adapter payloads and normalized results. */
  const originalXmlHttpRequest = globalThis.XMLHttpRequest
  globalThis.XMLHttpRequest = DownloadTransportXmlHttpRequest
  DownloadTransportXmlHttpRequest.requests = []
  DownloadTransportXmlHttpRequest.responses = [
    {
      status: 200,
      responseText: JSON.stringify({
        files: [{ name: 'report.pdf', size: 12, type: 'application/pdf', status: 'success' }],
        pagination: { enabled: true, currentPage: 2, pageSize: 20, total: 41 },
      }),
    },
  ]
  try {
    /** 内置查询适配器始终以 JSON POST 发送归属数据（含 extra 匹配条件）和分页模式。 The built-in query adapter always POSTs ownership data, including extra match conditions, and pagination mode as JSON. */
    const transport = createHttpFileQueryTransport({ queryUrl: '/files/query', baseUrl: '/api' })
    const controller = new AbortController()
    const result = await transport.queryFiles(
      {
        pagination: { enabled: true, currentPage: 2, pageSize: 20 },
      },
      {
        query: { belongId: 'order-1', belongType: 'order', extra: { keyword: 'report' } },
        headers: { Authorization: 'Bearer example' },
        urlQuery: { source: 'test' },
        signal: controller.signal,
      },
    )
    assert.equal(result.pagination.enabled, true)
    assert.equal(result.files[0].name, 'report.pdf')
    assert.equal(DownloadTransportXmlHttpRequest.requests[0].method, 'POST')
    assert.match(DownloadTransportXmlHttpRequest.requests[0].url, /api\/files\/query\?source=test/)
    assert.equal(
      DownloadTransportXmlHttpRequest.requests[0].headers.get('Content-Type'),
      'application/json',
    )
    assert.equal(
      DownloadTransportXmlHttpRequest.requests[0].body,
      JSON.stringify({
        query: { belongId: 'order-1', belongType: 'order', extra: { keyword: 'report' } },
        pagination: { enabled: true, currentPage: 2, pageSize: 20 },
      }),
    )
  } finally {
    /** 恢复全局 XHR，确保查询测试不会影响其他传输测试。 Restores global XHR so the query test cannot affect other transport tests. */
    globalThis.XMLHttpRequest = originalXmlHttpRequest
  }
})

test('HTTP file query transport rejects a response with a mismatched pagination mode', async () => {
  /** 保存并替换浏览器 XHR，以验证错误响应不会进入组件文件状态。 Saves and replaces browser XHR to verify invalid responses cannot enter component file state. */
  const originalXmlHttpRequest = globalThis.XMLHttpRequest
  globalThis.XMLHttpRequest = DownloadTransportXmlHttpRequest
  DownloadTransportXmlHttpRequest.requests = []
  DownloadTransportXmlHttpRequest.responses = [
    {
      status: 200,
      responseText: JSON.stringify({
        files: [],
        pagination: { enabled: false },
      }),
    },
  ]
  try {
    /** 分页请求收到非分页响应时必须生成标准 INVALID_RESPONSE 错误。 A paginated request receiving a non-paginated response must produce a standard INVALID_RESPONSE error. */
    const transport = createHttpFileQueryTransport({ queryUrl: '/files/query' })
    const controller = new AbortController()
    await assert.rejects(
      transport.queryFiles(
        { pagination: { enabled: true, currentPage: 1, pageSize: 20 } },
        { query: {}, headers: {}, signal: controller.signal },
      ),
      { code: 'INVALID_RESPONSE' },
    )
  } finally {
    /** 恢复全局 XHR，确保失败路径测试不会泄漏到其他用例。 Restores global XHR so the failure-path test cannot leak into other cases. */
    globalThis.XMLHttpRequest = originalXmlHttpRequest
  }
})
