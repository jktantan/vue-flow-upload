import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const maxRequestBytes = 64 * 1024 * 1024

/**
 * Local-only upload API used by the playground. It deliberately lives outside
 * the library package so published consumers never inherit a storage choice.
 */
export function localUploadApi(): Plugin {
  const storageRoot = resolve(process.env.PLAYGROUND_UPLOAD_DIR ?? '.playground/uploads')
  const databasePath = resolve(process.env.PLAYGROUND_DB_PATH ?? '.playground/upload.sqlite')
  const filesRoot = join(storageRoot, 'files')
  const sessionsRoot = join(storageRoot, 'sessions')
  const archivesRoot = join(storageRoot, 'archives')
  let database: DatabaseSync | undefined

  async function ready() {
    await Promise.all([
      mkdir(filesRoot, { recursive: true }),
      mkdir(sessionsRoot, { recursive: true }),
      mkdir(archivesRoot, { recursive: true }),
    ])
    await mkdir(dirname(databasePath), { recursive: true })
    database ??= new DatabaseSync(databasePath)
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, mime_type TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0, sha256 TEXT, path TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS files_sha256_idx ON files(sha256) WHERE sha256 IS NOT NULL;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, file_id TEXT NOT NULL, name TEXT NOT NULL,
        mime_type TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT,
        chunk_size INTEGER NOT NULL, total_chunks INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS chunks (
        session_id TEXT NOT NULL, chunk_index INTEGER NOT NULL,
        size INTEGER NOT NULL, PRIMARY KEY(session_id, chunk_index)
      );
    `)
    return database
  }

  return {
    name: 'playground-local-upload-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/')) return next()
        try {
          await handle(request, response, await ready())
        } catch (error) {
          console.error('[playground upload api]', error)
          json(response, 500, { message: '本地上传服务发生错误' })
        }
      })
    },
  }

  async function handle(request: IncomingMessage, response: ServerResponse, db: DatabaseSync) {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const method = request.method ?? 'GET'
    const path = url.pathname
    if (method === 'POST' && path === '/api/files') {
      const input = await bodyJson(request)
      const id =
        typeof input.fileId === 'string' && validId(input.fileId) ? input.fileId : randomUUID()
      db.prepare('INSERT OR IGNORE INTO files (id, name, mime_type) VALUES (?, ?, ?)').run(
        id,
        string(input.name),
        string(input.mimeType),
      )
      return json(response, 201, { fileId: id })
    }
    if (method === 'POST' && path === '/api/files/check') {
      const input = await bodyJson(request)
      const row = db
        .prepare('SELECT * FROM files WHERE sha256 = ? AND path IS NOT NULL')
        .get(string(input.sha256)) as FileRow | undefined
      return json(response, 200, row ? { exists: true, file: fileResult(row) } : { exists: false })
    }
    if (method === 'POST' && path === '/api/files/upload') {
      const form = await multipart(request)
      const fileId = string(form.fields.fileId)
      const file = form.file
      if (!validId(fileId) || !file) return json(response, 400, { message: '缺少 fileId 或文件' })
      const destination = join(filesRoot, fileId)
      await writeFile(destination, file.data)
      const hash = createHash('sha256').update(file.data).digest('hex')
      // AvatarUpload calls uploadFile directly, while FlowUpload creates its
      // record first. Supporting both keeps the playground transport complete.
      db.prepare('INSERT OR IGNORE INTO files (id, name, mime_type) VALUES (?, ?, ?)').run(
        fileId,
        file.name,
        file.type || 'application/octet-stream',
      )
      db.prepare('UPDATE files SET name=?, mime_type=?, size=?, sha256=?, path=? WHERE id=?').run(
        file.name,
        file.type || 'application/octet-stream',
        file.data.length,
        hash,
        destination,
        fileId,
      )
      return json(
        response,
        200,
        fileResult({
          id: fileId,
          name: file.name,
          mime_type: file.type || 'application/octet-stream',
          size: file.data.length,
          sha256: hash,
          path: destination,
        }),
      )
    }
    const avatar = path.match(/^\/api\/avatar\/([\w-]+)$/)
    if (method === 'PUT' && avatar) {
      const file = (await multipart(request)).file
      if (!file) return json(response, 400, { message: '缺少文件' })
      const existing = db.prepare('SELECT id FROM files WHERE id=?').get(avatar[1])
      if (!existing) return json(response, 404, { message: '头像文件不存在' })
      const destination = join(filesRoot, avatar[1])
      const hash = createHash('sha256').update(file.data).digest('hex')
      await writeFile(destination, file.data)
      db.prepare('UPDATE files SET name=?, mime_type=?, size=?, sha256=?, path=? WHERE id=?').run(
        file.name,
        file.type || 'application/octet-stream',
        file.data.length,
        hash,
        destination,
        avatar[1],
      )
      return json(
        response,
        200,
        fileResult({
          id: avatar[1],
          name: file.name,
          mime_type: file.type || 'application/octet-stream',
          size: file.data.length,
          sha256: hash,
          path: destination,
        }),
      )
    }
    if (method === 'GET' && path === '/api/files') {
      const rows = db
        .prepare('SELECT * FROM files WHERE path IS NOT NULL ORDER BY created_at DESC')
        .all() as FileRow[]
      // The list endpoint always returns the same shape. The client tells us
      // whether it needs a page, so both modes use this one endpoint.
      const paginationEnabled = url.searchParams.get('pagination') === 'true'
      const currentPage = positiveInteger(url.searchParams.get('currentPage'), 1)
      const pageSize = positiveInteger(url.searchParams.get('pageSize'), 10)
      const files = paginationEnabled
        ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
        : rows
      return json(response, 200, { files: files.map(fileResult), total: rows.length })
    }
    if (method === 'POST' && path === '/api/archives') {
      const input = await bodyJson(request)
      const fileIds = Array.isArray(input.fileIds)
        ? input.fileIds.filter(
            (value): value is string => typeof value === 'string' && validId(value),
          )
        : []
      if (!fileIds.length) return json(response, 400, { message: '没有可打包的文件' })
      const placeholders = fileIds.map(() => '?').join(',')
      const rows = db
        .prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND path IS NOT NULL`)
        .all(...fileIds) as FileRow[]
      if (!rows.length) return json(response, 404, { message: '没有找到可打包的文件' })
      const taskId = randomUUID()
      await writeFile(join(archivesRoot, `${taskId}.tar`), await tar(rows))
      return archiveTask(response, 201, taskId)
    }
    const archive = path.match(/^\/api\/archives\/([\w-]+)(?:\/(download))?$/)
    if (method === 'GET' && archive?.[2] === 'download') {
      const bytes = await readFile(join(archivesRoot, `${archive[1]}.tar`)).catch(() => undefined)
      if (!bytes) return json(response, 404, { message: '归档不存在或已被清理' })
      response.writeHead(200, {
        'Content-Type': 'application/x-tar',
        'Content-Length': bytes.length,
        'Content-Disposition': "attachment; filename*=UTF-8''playground-download.tar",
      })
      return response.end(bytes)
    }
    if (method === 'GET' && archive) {
      const exists = await readFile(join(archivesRoot, `${archive[1]}.tar`))
        .then(() => true)
        .catch(() => false)
      return exists
        ? archiveTask(response, 200, archive[1])
        : json(response, 404, { message: '归档不存在或已被清理' })
    }
    if (method === 'POST' && path === '/api/multipart/init') {
      const input = await bodyJson(request)
      const fileId = string(input.fileId)
      if (!validId(fileId)) return json(response, 400, { message: '无效 fileId' })
      const prior = db
        .prepare('SELECT * FROM sessions WHERE file_id=? AND sha256=?')
        .get(fileId, string(input.sha256)) as SessionRow | undefined
      const uploadId = prior?.id ?? randomUUID()
      if (!prior)
        db.prepare(
          'INSERT INTO sessions (id, file_id, name, mime_type, size, sha256, chunk_size, total_chunks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          uploadId,
          fileId,
          string(input.name),
          string(input.mimeType),
          number(input.size),
          string(input.sha256),
          number(input.chunkSize),
          number(input.totalChunks),
        )
      await mkdir(join(sessionsRoot, uploadId), { recursive: true })
      const uploadedChunks = (
        db.prepare('SELECT chunk_index FROM chunks WHERE session_id=?').all(uploadId) as {
          chunk_index: number
        }[]
      ).map((row) => row.chunk_index)
      return json(response, 200, { uploadId, uploadedChunks })
    }
    const chunk = path.match(/^\/api\/multipart\/([\w-]+)\/chunks\/(\d+)$/)
    if (method === 'PUT' && chunk) {
      const [, uploadId, indexText] = chunk
      const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(uploadId) as
        SessionRow | undefined
      const index = Number(indexText)
      if (!session || !Number.isInteger(index) || index < 0 || index >= session.total_chunks)
        return json(response, 404, { message: '上传会话或分片不存在' })
      const bytes = await bodyBuffer(request)
      await writeFile(join(sessionsRoot, uploadId, String(index)), bytes)
      db.prepare(
        'INSERT OR REPLACE INTO chunks (session_id, chunk_index, size) VALUES (?, ?, ?)',
      ).run(uploadId, index, bytes.length)
      return empty(response, 204)
    }
    const complete = path.match(/^\/api\/multipart\/([\w-]+)\/complete$/)
    if (method === 'POST' && complete) {
      const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(complete[1]) as
        SessionRow | undefined
      if (!session) return json(response, 404, { message: '上传会话不存在' })
      const chunks = db
        .prepare('SELECT chunk_index FROM chunks WHERE session_id=?')
        .all(session.id) as { chunk_index: number }[]
      if (chunks.length !== session.total_chunks)
        return json(response, 409, { message: '仍有分片未上传' })
      const output = join(filesRoot, session.file_id)
      const content = Buffer.concat(
        await Promise.all(
          Array.from({ length: session.total_chunks }, (_, index) =>
            readFile(join(sessionsRoot, session.id, String(index))),
          ),
        ),
      )
      const hash = createHash('sha256').update(content).digest('hex')
      if (session.sha256 && hash !== session.sha256)
        return json(response, 422, { message: '文件哈希校验失败' })
      await writeFile(output, content)
      db.prepare('UPDATE files SET name=?, mime_type=?, size=?, sha256=?, path=? WHERE id=?').run(
        session.name,
        session.mime_type,
        content.length,
        hash,
        output,
        session.file_id,
      )
      db.prepare('DELETE FROM chunks WHERE session_id=?').run(session.id)
      db.prepare('DELETE FROM sessions WHERE id=?').run(session.id)
      await rm(join(sessionsRoot, session.id), { recursive: true, force: true })
      return json(
        response,
        200,
        fileResult({
          id: session.file_id,
          name: session.name,
          mime_type: session.mime_type,
          size: content.length,
          sha256: hash,
          path: output,
        }),
      )
    }
    const filePath = path.match(/^\/api\/files\/([\w-]+)(?:\/(download))?$/)
    if (filePath && method === 'DELETE') return removeFile(response, db, filePath[1])
    if (filePath && method === 'GET' && filePath[2] === 'download') {
      const row = db
        .prepare('SELECT * FROM files WHERE id=? AND path IS NOT NULL')
        .get(filePath[1]) as FileRow | undefined
      if (!row?.path) return json(response, 404, { message: '文件不存在' })
      const bytes = await readFile(row.path)
      response.writeHead(200, {
        'Content-Type': row.mime_type,
        'Content-Length': bytes.length,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      })
      return response.end(bytes)
    }
    if (method === 'POST' && path === '/api/test/reset') {
      // Keep the opened SQLite file in place; removing its parent directory while
      // it is open would leave this process writing to an unlinked database file.
      await Promise.all([
        rm(filesRoot, { recursive: true, force: true }),
        rm(sessionsRoot, { recursive: true, force: true }),
        rm(archivesRoot, { recursive: true, force: true }),
      ])
      await Promise.all([
        mkdir(filesRoot, { recursive: true }),
        mkdir(sessionsRoot, { recursive: true }),
        mkdir(archivesRoot, { recursive: true }),
      ])
      db.exec('DELETE FROM chunks; DELETE FROM sessions; DELETE FROM files; VACUUM;')
      return json(response, 200, { cleared: true })
    }
    return json(response, 404, { message: '接口不存在' })
  }

  async function removeFile(response: ServerResponse, db: DatabaseSync, fileId: string) {
    const sessions = db.prepare('SELECT id FROM sessions WHERE file_id=?').all(fileId) as {
      id: string
    }[]
    const row = db.prepare('SELECT path FROM files WHERE id=?').get(fileId) as
      { path?: string } | undefined
    if (row?.path) await unlink(row.path).catch(() => undefined)
    await Promise.all(
      sessions.map((session) =>
        rm(join(sessionsRoot, session.id), { recursive: true, force: true }),
      ),
    )
    db.prepare(
      'DELETE FROM chunks WHERE session_id IN (SELECT id FROM sessions WHERE file_id=?)',
    ).run(fileId)
    db.prepare('DELETE FROM sessions WHERE file_id=?').run(fileId)
    db.prepare('DELETE FROM files WHERE id=?').run(fileId)
    return empty(response, 204)
  }
}

function archiveTask(response: ServerResponse, status: number, taskId: string) {
  return json(response, status, {
    taskId,
    status: 'success',
    fileName: 'playground-download.tar',
    downloadUrl: `/api/archives/${taskId}/download`,
  })
}

async function tar(rows: FileRow[]) {
  const entries = await Promise.all(
    rows.map(async (row) => {
      const content = await readFile(row.path!)
      const header = Buffer.alloc(512)
      const name = archiveName(row.name, row.id)
      header.write(name, 0, 100, 'utf8')
      writeTarNumber(header, 100, 8, 0o644)
      writeTarNumber(header, 108, 8, 0)
      writeTarNumber(header, 116, 8, 0)
      writeTarNumber(header, 124, 12, content.length)
      writeTarNumber(header, 136, 12, Math.floor(Date.now() / 1000))
      header.fill(0x20, 148, 156)
      header[156] = '0'.charCodeAt(0)
      header.write('ustar', 257, 6, 'ascii')
      header.write('00', 263, 2, 'ascii')
      const checksum = header.reduce((total, byte) => total + byte, 0)
      writeTarNumber(header, 148, 8, checksum)
      const padding = Buffer.alloc((512 - (content.length % 512)) % 512)
      return [header, content, padding]
    }),
  )
  return Buffer.concat([...entries.flat(), Buffer.alloc(1024)])
}

function archiveName(name: string, fileId: string) {
  const base = name.replace(/[\\/\0]/g, '_') || fileId
  return base.length <= 100 ? base : `${fileId}-${base.slice(-Math.max(1, 99 - fileId.length))}`
}

function writeTarNumber(target: Buffer, offset: number, width: number, value: number) {
  const digits = Math.max(1, width - 2)
  target.write(value.toString(8).padStart(digits, '0').slice(-digits), offset, digits, 'ascii')
  target[offset + digits] = 0
  target[offset + digits + 1] = 0x20
}

type FileRow = {
  id: string
  name: string
  mime_type: string
  size: number
  sha256?: string
  path?: string
}
type SessionRow = {
  id: string
  file_id: string
  name: string
  mime_type: string
  size: number
  sha256?: string
  chunk_size: number
  total_chunks: number
}

function fileResult(row: FileRow) {
  return {
    fileId: row.id,
    name: row.name,
    size: row.size,
    mimeType: row.mime_type,
    url: `/api/files/${row.id}/download`,
  }
}
function validId(value: string) {
  return /^[\w-]{1,100}$/.test(value)
}
function string(value: unknown) {
  return typeof value === 'string' ? value : ''
}
function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}
function empty(response: ServerResponse, status: number) {
  response.writeHead(status)
  response.end()
}
async function bodyBuffer(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const value = Buffer.from(chunk)
    length += value.length
    if (length > maxRequestBytes) throw new Error('请求体过大')
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}
async function bodyJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const value = JSON.parse((await bodyBuffer(request)).toString('utf8'))
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}
async function multipart(request: IncomingMessage) {
  const boundary =
    /boundary=(?:"([^"]+)"|([^;]+))/.exec(request.headers['content-type'] ?? '')?.[1] ??
    /boundary=(?:"([^"]+)"|([^;]+))/.exec(request.headers['content-type'] ?? '')?.[2]
  if (!boundary) throw new Error('缺少 multipart boundary')
  const delimiter = Buffer.from(`--${boundary}`)
  const body = await bodyBuffer(request)
  const fields: Record<string, string> = {}
  let file: { name: string; type: string; data: Buffer } | undefined
  for (
    let start = body.indexOf(delimiter) + delimiter.length + 2;
    start > delimiter.length + 1 && start < body.length;
  ) {
    const end = body.indexOf(delimiter, start)
    if (end < 0) break
    const part = body.subarray(start, end - 2)
    const split = part.indexOf(Buffer.from('\r\n\r\n'))
    if (split >= 0) {
      const header = part.subarray(0, split).toString()
      const content = part.subarray(split + 4)
      const name = /name="([^"]+)"/.exec(header)?.[1]
      if (name) {
        const filename = /filename="([^"]*)"/.exec(header)?.[1]
        if (filename !== undefined)
          file = {
            name: filename,
            type: /Content-Type:\s*([^\r\n]+)/i.exec(header)?.[1] ?? '',
            data: content,
          }
        else fields[name] = content.toString()
      }
    }
    start = end + delimiter.length + 2
  }
  return { fields, file }
}
