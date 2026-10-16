# Адаптер загрузки

`transport` — единственная граница протокола загрузки в компоненте: он описывает, «как создавать, загружать, проверять, разбивать на части и удалять файлы», не ограничивая выбор HTTP-клиента. Подойдут XHR, Fetch, Axios, обёртка запросов проекта или прямая загрузка в объектное хранилище.

Перед интеграцией с бэкендом прочитайте [Соглашение с бэкендом](/ru/guide/backend-api-contract#процесс-загрузки): там перечислены JSON, поля `multipart/form-data`, заголовки частей и структуры ответов, которые реально отправляет встроенный HTTP-адаптер.

`action` — не второй механизм передачи, а сокращённая запись обычной загрузки для встроенного `createHttpUploadTransport({ url: action })`. Для стандартного интерфейса `multipart/form-data` достаточно `action`; преобразование ответа, подписанная загрузка, мгновенная загрузка, части и докачка требуют прямого `transport`. Если указаны оба, приоритет у `transport`, поэтому у одного экземпляра компонента должна быть только одна точка входа протокола.

## HTTP-адаптер загрузки

`createHttpUploadTransport` отображает типовые HTTP-интерфейсы:

```ts
import { createHttpUploadTransport } from 'vue-flow-upload'

// 将组件生命周期映射到项目的普通、秒传和分片端点。
// Maps the component lifecycle to the application's normal, instant, and multipart endpoints.
const transport = createHttpUploadTransport({
  url: '/uploads/file',
  createUrl: '/uploads/files',
  deleteUrl: '/uploads/files/{fileId}',
  checkUrl: '/uploads/check',
  multipart: {
    initUrl: '/uploads/init',
    chunkUrl: '/uploads/{uploadId}/chunks/{index}',
    completeUrl: '/uploads/{uploadId}/complete',
    cancelUrl: '/uploads/{uploadId}',
  },
})
```

| Адрес                   | Запрос          | Назначение                                                                     |
| ----------------------- | --------------- | ------------------------------------------------------------------------------ |
| `url`                   | `POST` или `PUT` | Загружает бинарные данные обычного файла и бизнес-данные.                      |
| `createUrl`             | `POST`          | Создаёт или подтверждает запись файла до загрузки и возвращает стабильный `fileId`. |
| `deleteUrl`             | `DELETE`        | Удаляет файл по `{fileId}` и временные сессии загрузки.                        |
| `checkUrl`              | `POST`          | Проверяет возможность мгновенной загрузки по имени, размеру и SHA-256.         |
| `multipart.initUrl`     | `POST`          | Создаёт или восстанавливает сессию частей, возвращает `uploadId` и загруженные части. |
| `multipart.chunkUrl`    | `PUT`           | Загружает часть с номером `{index}` в сессии `{uploadId}`.                     |
| `multipart.completeUrl` | `POST`          | Объединяет загруженные части `{uploadId}` и возвращает результат файла.        |
| `multipart.cancelUrl`   | `DELETE`        | Отменяет незавершённую сессию частей `{uploadId}`.                             |

`{fileId}`, `{uploadId}` и `{index}` — плейсхолдеры шаблона; встроенный адаптер кодирует динамические идентификаторы перед подстановкой в URL.

### Опции создания

Кроме адресов выше, `createHttpUploadTransport` принимает:

| Опция           | По умолчанию | Описание                                                                                                                             |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `baseUrl`       | —            | Префикс API или источник, добавляемый к относительным адресам; полные адреса `http(s)` не изменяются.                                |
| `method`        | `'POST'`     | HTTP-метод обычной загрузки; можно указать `'PUT'`.                                                                                  |
| `credentials`   | —            | Значение `'include'` отправляет Cookie вместе с кросс-доменными запросами.                                                           |
| `timeout`       | `60000`      | Тайм-аут одного запроса в миллисекундах.                                                                                             |
| `parseResponse` | —            | Преобразует `XMLHttpRequest` ответа загрузки в `UploadSuccessResult`; по умолчанию разбирается JSON, а пустой ответ считается `{}`.   |

`deleteUrl`, `multipart.chunkUrl`, `multipart.completeUrl` и `multipart.cancelUrl` помимо строкового шаблона принимают функцию обратного вызова, например `(fileId) => \`/files/${fileId}\``, — тогда вызывающий сам собирает и кодирует динамические значения.

## Разработка собственного адаптера загрузки

Когда в проекте используются Axios, обёртка над Fetch, подписанная прямая загрузка или SDK объектного хранилища, реализуйте `UploadTransport` и передайте его в `transport`. Минимальная реализация требует только `uploadFile`; остальные методы добавляются по мере возможностей бэкенда.

| Метод               | Когда вызывается                    | Что обязан вернуть                                                                                                 |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `uploadFile`        | Обычная загрузка файла              | `UploadSuccessResult`; желательно со стабильным `fileId`.                                                        |
| `createFile`        | Предварительное создание записи     | `{ fileId }`.                                                                                                    |
| `checkFile`         | Проверка мгновенной загрузки по SHA-256 | `{ state: 'ready', file }`, `{ state: 'missing' }` или состояние общей загрузки; совместим с `{ exists, file? }`. |
| `initMultipart`     | Создание или восстановление сессии  | `{ uploadId, state?, uploadedChunks? }`, где `state` — `uploading`, `merging` или `processing`.                   |
| `uploadChunk`       | Загрузка одной части                | `void`.                                                                                                          |
| `completeMultipart` | Слияние частей на сервере           | `UploadSuccessResult`.                                                                                           |
| `cancelMultipart`   | Отмена незавершённой сессии         | `void`.                                                                                                          |
| `deleteFile`        | Удаление постоянного файла          | `void`.                                                                                                          |

```ts
import type { UploadSuccessResult, UploadTransport } from 'vue-flow-upload'

// 项目请求层应验证 response.ok，并保留业务错误码与 HTTP 状态。
// The project request layer should validate response.ok and preserve business error codes and HTTP status.
async function parseUploadResult(response: Response): Promise<UploadSuccessResult> {
  // 服务端 JSON 是未知输入，解析器负责验证最小字段。
  // Server JSON is unknown input; the parser validates minimum fields.
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object') throw new Error('上传响应不是对象')
  return payload as UploadSuccessResult
}

const uploadTransport: UploadTransport = {
  async uploadFile({ file, fileId, data }, context) {
    // FormData 保持文件与业务数据的既有字段约定。
    // FormData preserves the established fields for file and business data.
    const formData = new FormData()
    formData.append(context.fileFieldName, file)
    formData.append('fileId', fileId)
    formData.append(context.dataFieldName, JSON.stringify(data))
    const response = await fetch('/api/files/upload', {
      method: 'POST',
      headers: context.headers,
      body: formData,
      signal: context.signal,
    })
    if (!response.ok)
      throw {
        code: `HTTP_${response.status}`,
        message: '上传失败',
        retriable: response.status >= 500,
      }
    // Fetch 不提供稳定上传进度时，至少在完成时报告全部字节。
    // When Fetch has no stable upload progress, report all bytes at completion at minimum.
    context.onProgress(file.size, file.size)
    return parseUploadResult(response)
  },
}
```

Передавайте `context.signal` в слой запросов; при использовании XHR или Axios преобразуйте прогресс в байтах в вызов `context.onProgress(loaded, total)`. При сбое обязательно выбрасывайте структуру `{ code, message, retriable, status?, cause? }`; не подавляйте сетевые ошибки, отмену и ошибки сервера. Если разбор ответа из примера не подходит вашему бэкенду, замените его собственным валидатором.

При дедуплицированной загрузке `checkFile` возвращает `state: 'ready'` только тогда, когда содержимое доступно и полностью загружено. При ответе `uploading` компонент через `initMultipart` получает авторитетный список отсутствующих частей и дозагружает их; при `merging` или `processing` запись частей прекращается, и вызывается идемпотентный `completeMultipart` в ожидании результата сервера. Полные требования к параллелизму, правам, блокировке слияния, проверке и очистке приведены в [Соглашении с бэкендом](/ru/guide/backend-api-contract#мгновенная-загрузка-и-параллельная-загрузка-одного-содержимого).
