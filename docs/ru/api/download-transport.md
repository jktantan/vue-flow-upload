# Адаптер скачивания

`download-transport` — граница протокола скачивания у `FlowUpload`, независимая от `transport` загрузки. Он отвечает за скачивание постоянных файлов, а также за создание, опрос и отмену серверных задач архивации; адреса загрузки нельзя переиспользовать для скачивания.

Перед интеграцией с бэкендом см. [Соглашение с бэкендом](/ru/guide/backend-api-contract#скачивание-и-архивация-на-сервере): там описаны бинарный ответ скачивания, `Content-Disposition`, тело создания архива и ответы опроса.

## HTTP-адаптер скачивания

`createHttpDownloadTransport` использует заголовки аутентификации и общие query, которые разрешает компонент; `baseUrl`, политика Cookie и тайм-аут задаются при создании адаптера.

```ts
import { createHttpDownloadTransport } from 'vue-flow-upload'

// `{fileId}` и `{taskId}` кодируются в URL автоматически.
// `{fileId}` and `{taskId}` are URL encoded automatically.
const downloadTransport = createHttpDownloadTransport({
  // Возвращает бинарное содержимое одного файла.
  // Returns binary content for one persisted file.
  downloadUrl: '/files/{fileId}/download',
  archive: {
    // Создаёт задачу архивации по выбранным файлам или серверному диапазону запроса.
    // Creates an archive task from selected files or a server-query scope.
    createUrl: '/archives',
    // Возвращает состояние асинхронной задачи архивации и итоговый адрес скачивания.
    // Gets asynchronous archive status and its final download URL.
    taskUrl: '/archives/{taskId}',
    // Отменяет незавершённую задачу архивации.
    // Cancels an archive task that has not completed.
    cancelUrl: '/archives/{taskId}',
  },
})
```

| Адрес               | Запрос   | Назначение                                                                                                                                                                    |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `downloadUrl`       | `GET`    | Скачивает один готовый файл по `{fileId}`. Адаптер читает ответ как Blob и предпочитает имя для сохранения из `Content-Disposition` (включая `filename*`).                    |
| `archive.createUrl` | `POST`   | Создаёт асинхронную задачу архивации по выбранным `fileIds` или диапазону `server-query`; ответ обязан содержать как минимум `taskId` и `status`.                             |
| `archive.taskUrl`   | `GET`    | Опрашивает состояние `{taskId}`; при успехе обязан вернуть `downloadUrl`, чтобы браузер начал скачивание архива.                                                              |
| `archive.cancelUrl` | `DELETE` | Отменяет незавершённую задачу архивации `{taskId}`; можно не указывать — тогда компонент только прекращает локальный опрос.                                                   |

Передайте адаптер в prop `download-transport` компонента:

```vue
<FlowUpload :download-transport="downloadTransport" />
```

Статус архива принимает только `pending`, `processing`, `success`, `failed` или `canceled`. Если структура ответа бэкенда отличается, задайте `parseArchiveResponse`; если ответ скачивания не сразу является Blob — `parseDownloadResponse`.

### Опции создания

Кроме адресов выше, `createHttpDownloadTransport` принимает:

| Опция                   | По умолчанию | Описание                                                                                                                                 |
| ----------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`               | —            | Префикс API или источник, добавляемый к относительным адресам; полные адреса `http(s)` не изменяются.                                     |
| `credentials`           | —            | Значение `'include'` отправляет Cookie вместе с кросс-доменными запросами.                                                                |
| `timeout`               | `60000`      | Тайм-аут одного запроса скачивания или архивации в миллисекундах.                                                                        |
| `parseDownloadResponse` | —            | `(response, fallbackFileName) => DownloadResource`; по умолчанию читает Blob и имя файла из `Content-Disposition`.                        |
| `parseArchiveResponse`  | —            | `(response) => ArchiveTask`; по умолчанию требует `taskId` и корректный `status`.                                                        |

## Разработка собственного адаптера скачивания

Когда скачивание требует короткоживущего подписанного URL, SDK объектного хранилища, корпоративного слоя запросов или нестандартного протокола архивации, реализуйте `DownloadTransport` и передайте его в `download-transport`.

| Метод            | Когда вызывается                               | Что обязан вернуть                                        |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `downloadFile`   | Пользователь скачивает один готовый файл       | `DownloadResource` хотя бы с `blob` или `url`.             |
| `createArchive`  | Скачивание выбранного или всех файлов          | Начальный `ArchiveTask` с `taskId` и `status`.             |
| `getArchiveTask` | Начальная задача всё ещё `pending`/`processing` | Актуальный `ArchiveTask`; при успехе с `downloadUrl`.      |
| `cancelArchive`  | Пользователь отменяет незавершённый архив      | `void`; необязательный метод.                              |

```ts
import type { ArchiveTask, DownloadTransport } from 'vue-flow-upload'

// 解析器应校验 taskId、status 等字段；不要将未知 JSON 直接断言为 ArchiveTask。
// The parser should validate taskId, status, and related fields; do not directly assert unknown JSON as ArchiveTask.
async function parseArchiveTask(response: Response): Promise<ArchiveTask> {
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object') throw new Error('归档响应不是对象')
  if (!('taskId' in payload) || typeof payload.taskId !== 'string')
    throw new Error('归档响应缺少 taskId')
  if (!('status' in payload) || typeof payload.status !== 'string')
    throw new Error('归档响应缺少 status')
  return payload as ArchiveTask
}

const downloadTransport: DownloadTransport = {
  async downloadFile({ fileId, fileName }, context) {
    // 单文件接口返回二进制，因此读取 Blob 而不是 JSON。
    // The single-file endpoint returns binary content, so read Blob rather than JSON.
    const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/download`, {
      headers: context.headers,
    })
    if (!response.ok) throw new Error(`下载失败（${response.status}）`)
    return { blob: await response.blob(), fileName }
  },
  async createArchive(input, context) {
    const response = await fetch('/api/archives', {
      method: 'POST',
      headers: { ...context.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error(`创建归档失败（${response.status}）`)
    return parseArchiveTask(response)
  },
  async getArchiveTask(taskId, context) {
    const response = await fetch(`/api/archives/${encodeURIComponent(taskId)}`, {
      headers: context.headers,
    })
    if (!response.ok) throw new Error(`查询归档失败（${response.status}）`)
    return parseArchiveTask(response)
  },
}
```

В текущем контракте `DownloadTransport` нет сигнала отмены; опрос архива останавливает компонент. Собственная реализация всё равно должна сохранять HTTP-статус и исходную причину сбоя и выбрасывать структуру `{ code, message, retriable, status?, cause? }`, чтобы события `download-error` и `archive-error` сообщали о проблеме корректно.
