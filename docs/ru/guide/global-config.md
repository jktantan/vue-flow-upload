# Глобальная конфигурация и Nuxt

`vueFlowUpload` — это плагин Vue, который передаёт всем экземплярам `FlowUpload` и `AvatarUpload` одну общую конфигурацию запросов и значений загрузки по умолчанию. Он не изменяет у компонентов `v-model`, `data`, `belong-id` или протокол `transport` — это по-прежнему решает каждый экземпляр.

## Vue 3: установка глобальной конфигурации

Установите плагин один раз при создании приложения и импортируйте стили в точке входа:

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { vueFlowUpload } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

createApp(App)
  .use(vueFlowUpload, {
    baseUrl: '/api',
    auth: {
      credentials: 'include',
      // 每次请求重新读取 Token，避免登录刷新后继续使用旧值。
      // Reads the token for every request so a refreshed login never uses a stale value.
      headers: async () => ({ Authorization: `Bearer ${getAccessToken()}` }),
      query: { client: 'web' },
    },
    defaults: {
      normalUploadThreshold: 10 * 1024 * 1024,
      chunkSize: 1024 * 1024,
      chunkConcurrency: 3,
      maxConcurrentFiles: 2,
      maxConcurrentRequests: 6,
      retryCount: 3,
      retryBaseDelay: 500,
      resume: true,
      instantUpload: true,
      pagination: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    },
  })
  .mount('#app')
```

`headers` и `query` принимают как объект, так и функцию, возвращающую объект или Promise. Функция выполняется перед каждым запросом, что удобно для обновляемых или сменяемых учётных данных. Не помещайте токены, пароли и другие чувствительные данные в `query`: URL может попасть в журналы, историю браузера или прокси.

## Поля конфигурации

### `baseUrl`

`baseUrl` — общий префикс встроенных адресов загрузки, например `'/api'` или `'https://api.example.com'`. Относительные адреса дополняются префиксом, полные адреса `http:`/`https:` остаются без изменений:

```vue
<FlowUpload belong-id="order-1" action="/files" />
<!-- 使用全局 baseUrl 后请求 /api/files -->
```

Он применяется к `action`, `create-action`, `delete-action`, а также к `action`, `update-action` и `delete-action` у `AvatarUpload`. Он не переписывает адреса внутри пользовательского `transport`.

### `auth`

| Поле          | Тип                  | Значение и область действия                                                                                                                                                                                                                               |
| ------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `credentials` | `RequestCredentials` | Политика Cookie для встроенного XHR. `'same-origin'` — только свой источник; `'include'` разрешает Cookie при кросс-доменных запросах, и сервер обязан корректно настроить CORS. Если значение не задано, встроенная загрузка FlowUpload использует `'same-origin'`. |
| `headers`     | `UploadHeaders`      | Заголовки, добавляемые к каждой встроенной загрузке, созданию записи, проверке мгновенной загрузки, отправке частей, слиянию, удалению и запросам аватара; допустим объект или асинхронная фабрика. В запросах `FormData` заголовок `Content-Type` игнорируется, чтобы браузер сам сформировал multipart boundary. |
| `query`       | Объект или асинхронная фабрика | Общие параметры URL, добавляемые к каждому встроенному запросу. Значения — только string, number, boolean; подходит для неконфиденциальных метаданных вроде тенанта или идентификатора клиента.                                                  |

### `defaults`

`defaults` задаёт значения загрузки и пагинации только для `FlowUpload`. Одноимённый prop на компоненте имеет приоритет; если значение не задано ни глобально, ни в компоненте, используются встроенные значения из таблицы ниже.

| Поле                    | Единица  | Встроенное значение | Значение                                                                                            |
| ----------------------- | -------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `normalUploadThreshold` | байты    | 10 MiB              | Файлы больше этого размера идут по пути частей.                                                     |
| `chunkSize`             | байты    | 1 MiB               | Размер одной загружаемой части.                                                                     |
| `chunkConcurrency`      | шт.      | 3                   | Число частей одного файла, загружаемых одновременно.                                                |
| `maxConcurrentFiles`    | шт.      | 2                   | Число файлов, одновременно занимающих слоты загрузки.                                               |
| `maxConcurrentRequests` | шт.      | 6                   | Максимум сетевых запросов, общий для всех файлов.                                                   |
| `retryCount`            | раз      | 3                   | Дополнительные попытки для повторяемого запроса.                                                    |
| `retryBaseDelay`        | мс       | 500                 | Начальная задержка экспоненциальной паузы между попытками.                                          |
| `resume`                | —        | `true`              | Пытаться ли восстановить неистёкшую сессию частей.                                                  |
| `instantUpload`         | —        | `true`              | Вычислять ли SHA-256 и проверять мгновенную загрузку, когда transport поддерживает `checkFile`.      |
| `pagination.pageSize`   | записей  | 10                  | Размер страницы по умолчанию, когда пагинация включена, а компонент не передал `page-size`.         |
| `pagination.pageSizes`  | размеры  | `[10, 20, 30, 40]`  | Размеры страницы, доступные в пагинаторе.                                                           |

## Пользовательский transport и адаптеры скачивания и запросов

Глобальные `baseUrl` и `auth.credentials` автоматически применяются только к встроенному transport загрузки и аватара, который компонент создаёт из `action`. Пользовательские `UploadTransport`, `DownloadTransport` и `FileQueryTransport` сами отвечают за свои адреса и политику Cookie.

При этом компонент всё равно передаёт всем пользовательским адаптерам глобальные `auth.headers` и `auth.query`: загрузка и скачивание получают их в `context.headers` и `context.query`, запрос файлов — в `context.headers` и `context.urlQuery`. Создавая встроенные адаптеры скачивания или запросов, указывайте адрес и Cookie явно:

```ts
import { createHttpDownloadTransport, createHttpFileQueryTransport } from 'vue-flow-upload'

const downloadTransport = createHttpDownloadTransport({
  baseUrl: '/api',
  credentials: 'include',
  downloadUrl: '/files/{fileId}/download',
  archive: { createUrl: '/archives', taskUrl: '/archives/{taskId}' },
})

const queryTransport = createHttpFileQueryTransport({
  baseUrl: '/api',
  credentials: 'include',
  queryUrl: '/files/query',
})
```

## Nuxt 3 / 4

Модуль Nuxt регистрирует клиентские компоненты и автоматически подключает стили; его единственная опция — `prefix` для имён компонентов. `baseUrl`, аутентификация и значения по умолчанию для планирования загрузки по-прежнему задаются в клиентском плагине Vue.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['vue-flow-upload/nuxt'],
  vueFlowUpload: {
    prefix: 'App',
  },
})
```

Значение по умолчанию — `prefix: ''`, оно регистрирует `FlowUpload` и `AvatarUpload`; при `'App'` регистрируются `AppFlowUpload` и `AppAvatarUpload`. Это не префикс URL интерфейса — для адресов используйте `baseUrl`.

Затем добавьте клиентский плагин, чтобы SSR не обращался к файловым, просмотровым и обрезочным API браузера:

```ts
// plugins/vue-flow-upload.client.ts
import { vueFlowUpload } from 'vue-flow-upload'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vueFlowUpload, {
    baseUrl: useRuntimeConfig().public.apiBase,
    auth: {
      credentials: 'include',
      headers: () => ({ Authorization: `Bearer ${useCookie('access_token').value ?? ''}` }),
    },
    defaults: { chunkSize: 1024 * 1024, chunkConcurrency: 3 },
  })
})
```

Стили модуль подключает сам, поэтому страницам Nuxt не нужен повторный `import 'vue-flow-upload/style.css'`. С префиксом по умолчанию пишите `<FlowUpload />`, с `prefix: 'App'` — `<AppFlowUpload />`.
