# vue-flow-upload

[![npm version](https://img.shields.io/npm/v/vue-flow-upload.svg)](https://www.npmjs.com/package/vue-flow-upload)
[![license](https://img.shields.io/npm/l/vue-flow-upload.svg)](https://github.com/jktantan/vue-flow-upload/blob/main/packages/vue-flow-upload/LICENSE)

[中文](https://github.com/jktantan/vue-flow-upload/blob/main/packages/vue-flow-upload/README.md) | [English](https://github.com/jktantan/vue-flow-upload/blob/main/packages/vue-flow-upload/README.en.md) | **Русский**

Компоненты загрузки файлов и аватаров для Vue 3: обычная загрузка работает сразу, а большие файлы обслуживают части, докачка, мгновенная загрузка по SHA-256 и планирование параллелизма; дополнительно доступны скачивание и серверная упаковка.

- **Документация**: <https://jktantan.github.io/vue-flow-upload/ru/>
- **Интерактивная демонстрация**: <https://jktantan.github.io/vue-flow-upload/ru/demos/full-upload.html> — переключение списка и галереи, пооперационных прав, перетаскивания, темы и языка прямо в браузере
- **Протокол для бэкенда**: <https://jktantan.github.io/vue-flow-upload/ru/guide/backend-api-contract.html>

## Установка

```bash
pnpm add vue-flow-upload
```

`vue` (`^3.5.0`) — peer-зависимость, её предоставляет хост-приложение; пользователям Nuxt нужно самостоятельно установить Nuxt 3 или 4.

## Минимальный пример

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

// 受控文件列表；组件通过 update:modelValue 回写完整状态。
// Controlled file list; the component writes the complete state back through update:modelValue.
const files = ref<UploadFileItem[]>([])
</script>

<template>
  <FlowUpload
    v-model="files"
    belong-id="order-1"
    action="/api/files"
    drag
    accept="image/*,.pdf"
    :max-size="20 * 1024 * 1024"
  >
    <template #tip>Не более 20 МБ на файл</template>
  </FlowUpload>
</template>
```

`action` — сокращённая запись обычной загрузки для встроенного `transport` на XHR; он поддерживает `method`, `data`, `create-action`, `delete-action` и глобальную конфигурацию `auth`, но реализует только обычную загрузку. Мгновенная загрузка, части, докачка, нестандартная структура ответа или обёртка запросов проекта требуют `transport`. Если указаны оба, приоритет у `transport`, поэтому у одного экземпляра компонента должна быть одна точка входа протокола.

Аутентификация настраивается один раз в `app.use(vueFlowUpload, config)`: `baseUrl` добавляет общий префикс встроенным HTTP-адресам, `credentials` управляет Cookie, `headers` — заголовками аутентификации, `query` — общими параметрами URL. Они применяются ко всем встроенным запросам загрузки, частей, слияния, удаления и аватара; полные адреса `http(s)` префикс не получают. Не дублируйте аутентификацию на компоненте и не помещайте секретные токены в `query`.

## Компонент аватара AvatarUpload

`AvatarUpload` — отдельный компонент одного аватара: выбранное изображение обрезается в пропорции 1:1 и сохраняется как файл 512 × 512. Он не показывает список файлов и прогресс загрузки, но поддерживает просмотр, замену, удаление и перетаскивание нового изображения в диалог обрезки.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AvatarUpload, type UploadFileItem } from 'vue-flow-upload'

// 单元素头像列表；组件只渲染第一项。
// Single-entry avatar list; the component renders only the first item.
const avatar = ref<UploadFileItem[]>([])
</script>

<template>
  <AvatarUpload
    v-model="avatar"
    belong-id="profile-1"
    action="/avatar"
    update-action="/avatar/{fileId}"
    delete-action="/avatar/{fileId}"
    accept="image/*"
    shape="circle"
  />
</template>
```

Первая загрузка идёт через `action`. Если аватар уже есть и настроен `update-action`, компонент отправляет `PUT` на URL с подставленным `{fileId}` и передаёт multipart-поля `file` и `fileId`. Первый ответ обязан вернуть `fileId`, иначе дальнейший URL обновления построить нельзя. `baseUrl` добавляется к относительным адресам и никогда не меняет полные адреса `http(s)`. Если замену обрабатывает собственный `transport`, не передавайте `update-action`.

`shape` управляет визуальным контуром карточки аватара и рамки обрезки и принимает `square` (по умолчанию) или `circle`; круг — только маска отображения, а загружаемый результат остаётся квадратным изображением 512 × 512. `read-only` блокирует выбор, замену и удаление, но просмотр остаётся доступным:

```vue
<AvatarUpload v-model="avatar" belong-id="profile-1" read-only shape="circle" />
```

## Подключение в Nuxt

Добавьте модуль в `nuxt.config.ts`. Он регистрирует клиентские компоненты `FlowUpload` и `AvatarUpload` и автоматически подключает стили, поэтому на этапе SSR не происходит обращений к файловым, просмотровым или обрезочным API браузера.

```ts
export default defineNuxtConfig({
  modules: ['vue-flow-upload/nuxt'],
  vueFlowUpload: {
    prefix: '',
  },
})
```

Аутентификация и значения загрузки по умолчанию для всего приложения задаются через плагин Vue, и компоненты не могут переопределить конфигурацию аутентификации:

```ts
// plugins/vue-flow-upload.client.ts
import { vueFlowUpload } from 'vue-flow-upload'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(vueFlowUpload, {
    baseUrl: '/api',
    auth: {
      credentials: 'include',
      headers: async () => ({ Authorization: `Bearer ${getAccessToken()}` }),
      query: { source: 'web' },
    },
    defaults: {
      chunkSize: 1024 * 1024,
      chunkConcurrency: 3,
      pagination: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    },
  })
})
```

После этого компоненты доступны на страницах без ручного импорта:

```vue
<template>
  <FlowUpload v-model="files" belong-id="order-1" action="/files" />
</template>
```

Значение `prefix: 'App'` меняет регистрируемые имена на `AppFlowUpload` и `AppAvatarUpload`. Этот `prefix` влияет только на имена компонентов; префикс интерфейса задавайте через `baseUrl` плагина.

## HTTP-адаптер загрузки

```ts
import { createHttpUploadTransport } from 'vue-flow-upload'

const transport = createHttpUploadTransport({
  url: '/uploads/file',
  checkUrl: '/uploads/check',
  multipart: {
    initUrl: '/uploads/init',
    chunkUrl: '/uploads/{uploadId}/chunks/{index}',
    completeUrl: '/uploads/{uploadId}/complete',
    cancelUrl: '/uploads/{uploadId}',
  },
})
```

Назначение адресов: `url` загружает обычные файлы; `checkUrl` проверяет мгновенную загрузку или состояние общей загрузки; `multipart.initUrl` атомарно создаёт или восстанавливает сессию; `multipart.chunkUrl` загружает одну отсутствующую часть; `multipart.completeUrl` идемпотентно объединяет части; `multipart.cancelUrl` освобождает только аренду текущего вызывающего. Полное соглашение см. в разделах [Адаптер загрузки](https://jktantan.github.io/vue-flow-upload/ru/api/transport.html) и [Соглашение с бэкендом](https://jktantan.github.io/vue-flow-upload/ru/guide/backend-api-contract.html).

## HTTP-адаптер скачивания

```ts
import { createHttpDownloadTransport } from 'vue-flow-upload'

const downloadTransport = createHttpDownloadTransport({
  downloadUrl: '/uploads/files/{fileId}/download',
  archive: {
    createUrl: '/uploads/archives',
    taskUrl: '/uploads/archives/{taskId}',
    cancelUrl: '/uploads/archives/{taskId}',
  },
})
```

Назначение адресов: `downloadUrl` скачивает один файл по `{fileId}`; `archive.createUrl` создаёт задачу пакетной архивации; `archive.taskUrl` опрашивает состояние `{taskId}` и итоговый адрес скачивания; `archive.cancelUrl` отменяет незавершённую задачу. Передайте `downloadTransport` в prop `download-transport` компонента, чтобы включить скачивание. Адаптер получает заголовки аутентификации и query, которые разрешает компонент; если нужен префикс API, кросс-доменные Cookie или свой тайм-аут, укажите `baseUrl`, `credentials` и `timeout` при создании. Полное соглашение см. в разделе [Адаптер скачивания](https://jktantan.github.io/vue-flow-upload/ru/api/download-transport.html).

## HTTP-адаптер запроса файлов

С настроенным `query-transport` успешное удаление из списка дожидается фонового перечитывания, и только затем завершается операция удаления; ошибка перечитывания вызывает `query-error` и не откатывает уже успешное удаление.

Режим локального SQLite в Playground использует встроенный адаптер с `POST /api/files/query`, напрямую проверяя управляемые компонентом загрузку, пагинацию и отмену. Локальный интерфейс использует один демонстрационный набор данных и не реализует фильтрацию по бизнес-принадлежности или `extra`.

`createHttpFileQueryTransport({ queryUrl })` отвечает за запрос метаданных файлов и не переиспользует адреса загрузки или скачивания. Он отправляет JSON `POST` вида `{ query, pagination }` на `queryUrl`: `query` содержит `belongId`, `belongType` и `extra`, где `extra` — это расширенные данные загрузки и одновременно условие сопоставления конкретного проекта при запросе; второго набора полей фильтрации нет. `pagination.enabled` явно указывает, используется ли пагинация. Запрос с пагинацией дополнительно отправляет `currentPage` и `pageSize` и требует в ответе `files`, `currentPage`, `pageSize` и `total`; запрос и ответ без пагинации используют `{ enabled: false }`. Каждая запись файла обязана содержать строковый `name`; адаптер отклоняет некорректные записи и числа пагинации и сообщает `INVALID_RESPONSE`. Передайте его в `query-transport`, и компонент сам обработает первую загрузку, изменение `extra`, пагинацию, отмену и устаревшие результаты. Полное соглашение см. в разделе [Адаптер запроса файлов](https://jktantan.github.io/vue-flow-upload/ru/api/query-transport.html).

## Локализация

Встроенные сообщения используют пространство имён `VueFlowUpload.*`. Чтобы задать один язык для нескольких компонентов, установите в хост-приложении один экземпляр i18n:

```ts
import { createApp } from 'vue'
import { createFlowUploadI18n } from 'vue-flow-upload'

// 宿主提供一份 i18n 实例，组件在未显式传入 locale 时复用它。
// The host provides one i18n instance that components reuse when no explicit locale is given.
createApp(App).use(createFlowUploadI18n({ locale: 'ru-RU' }))
```

Компоненты сначала переиспользуют экземпляр i18n хоста. Для отдельного компонента передайте `i18n`:

```vue
<FlowUpload
  :i18n="{
    locale: 'ru-RU',
    messages: {
      'ru-RU': { VueFlowUpload: { selectFile: 'Выберите вложения' } },
    },
  }"
/>
```

Старые свойства `locale` и плоский `messages` продолжают работать, но рекомендуется перейти на `i18n`. Встроенные языки: `zh-CN`, `en-US` и `ru-RU`.

## Темы и стили

По умолчанию используется светлая палитра Element Plus, а под `dark` / `vfu-dark` — её тёмная палитра. Если Element Plus установлен, компонент напрямую наследует переменные `--el-*`. Все настраиваемые значения — это CSS-переменные `--vfu-*`, которые можно переопределить на `:root` или любом родителе:

```css
:root {
  --vfu-color-primary: #126f67;
  --vfu-color-primary-light-3: #4a958e;
  --vfu-color-primary-light-7: #b7d8d4;
  --vfu-color-primary-light-9: #e7f2f0;
  --vfu-radius-base: 10px;
  --vfu-file-row-height: 60px;
}
```

`theme="element-plus"` / `theme="ant-design-vue"` задают пресеты, а `ThemeAdapter` принимает свой класс и переменные. Старые имена переменных (`--vfu-signal`, `--vfu-ink`, `--vfu-muted`, `--vfu-line`, `--vfu-danger`, `--vfu-radius`) по-прежнему поддерживаются. Полный список токенов, тёмный режим и примеры переопределения: [Темы и стили](https://jktantan.github.io/vue-flow-upload/ru/guide/theming.html).

## Основные props (кратко)

| Prop                                                                   | Описание                                                                                             | По умолчанию                             |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `action` / `transport`                                                 | URL встроенной обычной загрузки / собственный протокол; при обоих приоритет у `transport`              | —                                        |
| `create-action`, `delete-action`                                       | Создание записи файла до загрузки / очистка удалённого файла и его сессий по `fileId`                  | —                                        |
| `v-model`, `default-file-list`                                         | Управляемый список файлов / начальный список для неуправляемого режима; удалённые записи стоит снабжать `uid`, `fileId`, `url`, `status` | `—`, `[]` |
| `multiple`, `max-count`, `max-size`, `accept`                          | Ограничения выбора и проверки                                                                          | `true`, без ограничений, без ограничений, все |
| `auto-upload`                                                          | Загружать сразу после выбора; при выключении вызывайте `submit()` экземпляра                            | `true`                                   |
| `drag`, `directory`                                                    | Перетаскивание на весь компонент, подсказка в области операций и выбор папки там, где поддерживается    | `true`, `false`                          |
| `width`, `height`                                                      | Размеры компонента в CSS; числа — пиксели. `height="auto"` заполняет родителя с заданной высотой         | `auto`, `600px`                          |
| `show-file-list`                                                       | Рисовать ли встроенный список                                                                          | `true`                                   |
| `pagination`                                                           | `false` отключает, либо управляемое состояние пагинации; страницы в `v-model` загружает бизнес-слой     | не задано                                |
| `list-type`                                                            | `list` или `picture`; `picture` показывает карточки-галерею                                             | `list`                                   |
| `data`                                                                 | Объект или асинхронная функция, возвращающая объект; заголовки аутентификации задавайте в глобальном `auth.headers` | `{}`                    |
| `normal-upload-threshold`, `chunk-size`                                | Файлы выше порога идут частями; transport должен поддерживать части                                     | 10 MiB, 1 MiB                            |
| `chunk-concurrency`, `max-concurrent-files`, `max-concurrent-requests` | Ограничения параллелизма частей, файлов и запросов                                                      | 3, 2, 6                                  |
| `resume`, `instant-upload`                                             | Докачка и мгновенная загрузка по SHA-256                                                               | `true`, `true`                           |
| `before-upload`, `before-remove`                                       | `false` или reject блокирует загрузку или удаление                                                       | —                                        |
| `belong-id`, `belong-type`, `extra`                                    | Идентификатор и тип бизнес-записи, а также расширенные атрибуты в JSON `data` каждого запроса загрузки   | `belong-id` обязателен; `belong-type` — `default` |

Правила удаления: файлы в состояниях `idle`, `validating` и `rejected` исчезают из списка сразу; для всех состояний, попавших в процесс загрузки, показывается подтверждение. После подтверждения компонент вызывает `transport.deleteFile(fileId)` или `delete-action`, очищает бэкенд и удаляет локальную строку только при успехе. Поэтому настраивайте удаление для файлов, которые можно очистить на сервере, и следите за тем, чтобы сервер возвращал стабильный `fileId`. `transport.createFile()` или `create-action` позволяет бэкенду подтвердить или назначить этот идентификатор до загрузки; загрузка, повтор и удаление используют его повторно.

## События, слоты и экземпляр

События: `change(file, files)`, `progress(file, percent)`, `success(file, response)`, `error(file, error)`, `remove(file)` и `exceed(files)`; при настроенном адаптере запроса также `query-loading(isLoading)`, `query-success(result)` и `query-error(error)`; при включённой пагинации — `update:pagination(value)` и `pagination-change(currentPage, pageSize)`; скачивание и архивация добавляют `download-start/success/error` и `archive-start/progress/success/error`. Полную таблицу событий см. в [API FlowUpload](https://jktantan.github.io/vue-flow-upload/ru/api/flow-upload.html).

Слоты:

- `#tip`: подсказка сразу под областью выбора.
- `#file="{ file, remove, preview, download, pause, resume, retry }"`: заменяет строку одного файла.

Через `ref` доступны `submit()`, `abort(file?)`, `pause(uid)`, `resume(uid)`, `retry(uid)`, `remove(uid | file)`, `clear()`/`clearFiles()`, `handleStart(file)`, `handleRemove(uid | file)`, `refreshQuery()`, а также методы скачивания и архивации `download(uid)`, `downloadSelected(uids)`, `downloadAll()` и `cancelArchive(taskId)`.

## Серверная пагинация

По умолчанию пагинация выключена. Компонент отвечает только за её состояние и взаимодействие, не запрашивает список файлов и не добавляет параметры страницы к запросам загрузки, частей, удаления или скачивания. После включения бизнес-слой загружает по одной странице через тот же интерфейс списка и записывает результат страницы в `v-model`:

```vue
<script setup lang="ts">
import { ref } from 'vue'

// 宿主自行加载页面数据；组件只发出分页变更事件。
// The host loads page data itself; the component only emits pagination changes.
const files = ref([])
const loading = ref(false)
const pagination = ref({ total: 0, currentPage: 1, pageSize: 20 })
const paginationEnabled = ref(true)

async function loadFiles(currentPage: number, pageSize: number) {
  loading.value = true
  try {
    const result = await api.get('/api/files', {
      params: { pagination: paginationEnabled.value, currentPage, pageSize },
    })
    files.value = result.files
    pagination.value = { ...pagination.value, currentPage, pageSize, total: result.total }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <FlowUpload
    v-model="files"
    belong-id="order-1"
    :pagination="paginationEnabled ? pagination : false"
    :loading="loading"
    @update:pagination="(value) => (pagination = value)"
    @pagination-change="loadFiles"
  />
</template>
```

Имена полей и структуру ответа адаптирует слой бизнес-запросов; рекомендуется передавать в каждом запросе переключатель пагинации (например, `pagination`) и параметры страницы, чтобы один интерфейс списка возвращал одинаковую структуру в обоих режимах. При `:pagination="false"` компонент не рисует footer.

## Состояние постобработки

Когда части объединены, но файл всё ещё переносится в COS, OSS или Blob Storage либо проходит проверку на вирусы и перекодирование, запись файла на сервере должна быть в состоянии `processing`. Компонент показывает жёлтое состояние «обработка»; в это время файл нельзя просматривать, скачивать и включать в пакетное скачивание.

Ответ завершения загрузки может вернуть `{ "fileId": "...", "status": "processing" }`, и компонент сохранит жёлтое состояние. Переключение состояния полностью определяет запись на сервере: после обновления списка передайте полученный `status: "success"` вместе с итоговым `url` в `v-model`, и только тогда компонент покажет зелёное «готово». Компонент не опрашивает задачу обработки и не помечает файл успешным самостоятельно.

## Документация

- Документация (中文 / English / Русский): <https://jktantan.github.io/vue-flow-upload/>
- Полный протокол частей для бэкенда: <https://jktantan.github.io/vue-flow-upload/ru/guide/backend-api-contract.html>
- Репозиторий и обратная связь: <https://github.com/jktantan/vue-flow-upload>
- Материалы для поддержки (дизайн, протокол, руководство по разработке): <https://github.com/jktantan/vue-flow-upload/tree/main/internal-docs>

## Лицензия

[Apache-2.0](https://github.com/jktantan/vue-flow-upload/blob/main/packages/vue-flow-upload/LICENSE) © tantan
