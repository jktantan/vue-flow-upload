# Адаптер запроса файлов

`query-transport` не зависит от адаптеров загрузки и скачивания и отвечает за чтение списка метаданных файлов. Он переиспользует `belongId`, `belongType` и `extra` загрузки: первые два задают бизнес-область, а `extra` несёт тонкие условия сопоставления конкретного проекта. После передачи `FlowUpload` умеет запрашивать список при монтировании, изменении `extra` или смене страницы; без него список по-прежнему полностью формирует хост через `v-model`.

Перед интеграцией с бэкендом см. [Соглашение с бэкендом](/ru/guide/backend-api-contract#запрос-файлов): там приведены точное тело POST, объединённый тип пагинации и полный пример ответа со списком файлов.

## Протокол пагинации

После успешного удаления из списка компонент дожидается завершения фонового запроса текущего диапазона и только затем завершает операцию удаления. При ошибке запроса удаления запрос не выполняется; ошибка повторного чтения сообщается через `query-error`, а успешное удаление не откатывается.

Режим «Локальный SQLite» в Playground вызывает `POST /api/files/query` через `createHttpFileQueryTransport`: загрузку, листание, обновление после загрузки и отмену запросов выполняет компонент, а переключатель пагинации обновляется публичным методом `refreshQuery()`. Режим Mock продолжает использовать демонстрационные файлы. Текущая локальная база использует один демонстрационный набор данных и пока не разделяет выборку по `query.belongId`, `query.belongType` или `query.extra`; производственный бэкенд обязан реализовать сопоставление по бизнес-области.

Запрос обязан содержать `pagination`, чтобы бэкенд не угадывал режим:

| Сценарий       | `pagination` в запросе                     | `pagination` в ответе                             |
| -------------- | ------------------------------------------ | ------------------------------------------------- |
| Без пагинации  | `{ enabled: false }`                       | `{ enabled: false }`                              |
| С пагинацией   | `{ enabled: true, currentPage, pageSize }` | `{ enabled: true, currentPage, pageSize, total }` |

`currentPage` и `pageSize` в ответе — это значения, которые бэкенд реально применил; их можно использовать для исправления страницы за пределами диапазона, а `total` — общее число записей, подходящих под текущий фильтр. Оба режима обязаны вернуть `files`.
Встроенный HTTP-адаптер проверяет режим пагинации и каждую запись файла: `name` обязателен и должен быть строкой; при наличии `type`, `uid`, `fileId`, `url` и `thumbnailUrl` должны быть строками, `size` — неотрицательным конечным числом, `percent` — в диапазоне 0–100, а `status` — известным состоянием файла; запись с браузерным полем `file` отклоняется. Числа пагинации должны быть целыми и неотрицательными, `currentPage` и `pageSize` ещё и больше нуля, а `pagination.enabled` обязан совпадать с запросом. Неверный ответ сообщается как `INVALID_RESPONSE`.

## HTTP-адаптер запросов

`createHttpFileQueryTransport` выполняет JSON `POST` на `queryUrl`. Назначение адреса — вернуть метаданные файлов по бизнес-принадлежности, условиям сопоставления `extra` и явному режиму пагинации; это не адрес для загрузки или скачивания бинарных данных.

Кроме `queryUrl` адаптер принимает `baseUrl` (префикс относительного адреса), `credentials` (при `'include'` отправляются Cookie кросс-доменных запросов), `timeout` (по умолчанию 60000 миллисекунд) и `parseResponse(response, input)` (своё преобразование результата, по умолчанию проверяются `files` и структура пагинации).

```ts
import { createHttpFileQueryTransport } from 'vue-flow-upload'

const queryTransport = createHttpFileQueryTransport({
  // 接收 query（含 extra）和 pagination，并返回文件元数据列表。
  // Receives query (including extra) and pagination and returns a file metadata list.
  queryUrl: '/files/query',
})
```

Тело запроса и ответ с пагинацией по умолчанию выглядят так:

```json
{
  "query": {
    "belongId": "order-1",
    "belongType": "order",
    "extra": { "keyword": "invoice", "status": "success" }
  },
  "pagination": { "enabled": true, "currentPage": 1, "pageSize": 20 }
}
```

```json
{
  "files": [
    { "name": "invoice.pdf", "size": 1024, "type": "application/pdf", "status": "success" }
  ],
  "pagination": { "enabled": true, "currentPage": 1, "pageSize": 20, "total": 42 }
}
```

При использовании компонента глубокое изменение `extra` прерывает старый запрос и загружает данные с первой страницы. `query-on-mount` по умолчанию равен `true`; если задать `false`, загрузку можно запускать вручную методом `refreshQuery()` экземпляра компонента.

```vue
<FlowUpload
  v-model="files"
  belong-id="order-1"
  belong-type="order"
  :pagination="pagination"
  :query-transport="queryTransport"
  :extra="{ keyword, status: 'success' }"
  @update:pagination="(value) => (pagination = value)"
  @query-error="handleQueryError"
/>
```

Собственный протокол реализует `FileQueryTransport.queryFiles(input, context)`. `context.query` содержит `belongId`, `belongType` и `extra`; бэкенд обязан использовать `query.extra` для сопоставления конкретного проекта. `context.urlQuery` предназначен только для параметров URL вроде аутентификации. `context.signal` обязательно передавать в сетевой слой, чтобы компонент отменял устаревшие запросы при изменении `extra`, смене страницы или размонтировании.

## Разработка собственного адаптера запросов

Когда проект использует GET-запросы, GraphQL, RPC или единый слой запросов, реализуйте `FileQueryTransport` и передайте его в `query-transport`. Адаптер обязан вернуть результат, режим пагинации которого совпадает с `input.pagination.enabled`.

```ts
import type { FileQueryResult, FileQueryTransport } from 'vue-flow-upload'

// 解析器必须验证 files 数组与 pagination.enabled；分页模式不一致应抛出错误。
// The parser must validate the files array and pagination.enabled; a mismatched pagination mode must throw.
async function parseFileQueryResult(response: Response): Promise<FileQueryResult> {
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object') throw new Error('查询响应不是对象')
  if (!('files' in payload) || !Array.isArray(payload.files)) throw new Error('查询响应缺少 files')
  if (!('pagination' in payload) || typeof payload.pagination !== 'object' || !payload.pagination)
    throw new Error('查询响应缺少 pagination')
  return payload as FileQueryResult
}

const queryTransport: FileQueryTransport = {
  async queryFiles(input, context) {
    // 业务查询条件始终放在 query；公共认证参数仅附加到 URL。
    // Business query conditions always belong in query; shared auth parameters are appended only to the URL.
    const url = new URL('/api/files/query', window.location.origin)
    for (const [key, value] of Object.entries(context.urlQuery ?? {}))
      url.searchParams.set(key, String(value))
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...context.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: context.query, pagination: input.pagination }),
      signal: context.signal,
    })
    if (!response.ok) throw new Error(`查询失败（${response.status}）`)
    return parseFileQueryResult(response)
  },
}
```

Если интерфейс поддерживает только GET, сериализуйте `context.query` и `input.pagination` в согласованные с бэкендом параметры URL; но не опускайте `pagination.enabled`. Новый `extra`, смена страницы или размонтирование прерывают `context.signal`; адаптер обязан его пробрасывать и не должен записывать отменённые или устаревшие результаты в другое состояние.
