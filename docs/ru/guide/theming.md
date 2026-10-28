# Темы и стили

Стили компонента подключаются через `vue-flow-upload/style.css`. По умолчанию используется светлая палитра [Element Plus](https://element-plus.org/), а в тёмном режиме — её тёмная палитра. Если в проекте уже установлен Element Plus, компонент сначала читает переменные `--el-*`, поэтому брендовый цвет и светлая/тёмная тема наследуются автоматически.

## Тёмный режим

Добавьте `dark` / `vfu-dark` на `html`, любой родительский элемент или обёртку компонента:

```html
<!-- Как принято в Element Plus и VitePress: тёмная тема для всей страницы -->
<html class="dark">
  <body>
    <!-- Либо тёмные токены только для одного участка -->
    <div class="vfu-dark">
      <FlowUpload v-model="files" belong-id="order-1" />
    </div>
  </body>
</html>
```

Компонент сам не реагирует на `prefers-color-scheme`, чтобы не затемняться раньше, чем хост подготовит фон. Если нужно следовать системе, хост сам управляет классом:

```ts
// Связываем системную настройку с классом dark, чтобы загрузчик переключался вместе с ней.
const media = window.matchMedia('(prefers-color-scheme: dark)')
const syncDarkMode = () => document.documentElement.classList.toggle('dark', media.matches)
media.addEventListener('change', syncDarkMode)
syncDarkMode()
```

## Переопределение токенов

Все настраиваемые значения — это CSS-переменные `--vfu-*`, объявленные на `:where(:root)` с нулевой специфичностью. Хост может переопределить их на `:root`, на бизнес-контейнере или на корне компонента без повышения специфичности:

```css
/* Приводим брендовый цвет, радиус и высоту строки к дизайн-системе проекта. */
:root {
  --vfu-color-primary: #126f67;
  --vfu-color-primary-light-3: #4a958e;
  --vfu-color-primary-light-7: #b7d8d4;
  --vfu-color-primary-light-9: #e7f2f0;
  --vfu-radius-base: 10px;
  --vfu-file-row-height: 60px;
}
```

Если в проекте установлен Element Plus со своими переменными темы, достаточно переопределить `--el-color-primary`: кнопки, прогресс и выбранные состояния подхватят цвет.

### Цвета

| Токен                             | Назначение                                             |
| --------------------------------- | ------------------------------------------------------ |
| `--vfu-color-primary`             | Основное действие, прогресс, выбор, фокус              |
| `--vfu-color-primary-light-3`     | Состояние наведения основной кнопки                    |
| `--vfu-color-primary-light-7`     | Светлые границы и подсказки                            |
| `--vfu-color-primary-light-9`     | Светлый фон наведения                                  |
| `--vfu-color-success`             | Успешная загрузка                                      |
| `--vfu-color-warning`             | Обработка и подсказка перетаскивания                   |
| `--vfu-color-danger`              | Ошибка/отклонение и удаление                           |
| `--vfu-color-text-primary`        | Заголовки и основной текст                             |
| `--vfu-color-text-regular`        | Обычный текст                                          |
| `--vfu-color-text-secondary`      | Второстепенный текст и статусы                         |
| `--vfu-color-text-disabled`       | Недоступный текст                                      |
| `--vfu-color-border`              | Границы контейнеров и карточек                         |
| `--vfu-color-border-lighter`      | Разделители строк                                      |
| `--vfu-color-fill-light`          | Фон строки при наведении и миниатюры                   |
| `--vfu-bg-color`                  | Фон списка, панели и подвала                           |
| `--vfu-bg-color-overlay`          | Диалоги, кроппер и плавающие кнопки                    |
| `--vfu-mask-color`                | Маска загрузки                                         |
| `--vfu-mask-color-strong`         | Маска действий аватара и галереи                       |
| `--vfu-tooltip-bg` / `color`      | Всплывающие подсказки                                  |
| `--vfu-shadow-sm` / `md` / `lg`   | Тени панелей, редактора и подтверждения                |

У `primary`, `success`, `warning`, `danger` и `info` также есть варианты `-light-3`, `-light-5`, `-light-7`, `-light-8` и `-light-9` с именами как в Element Plus.

### Радиусы, типографика и размеры

| Токен                                | Значение |
| ------------------------------------ | -------- |
| `--vfu-radius-small`                 | `4px`    |
| `--vfu-radius-base`                  | `6px`    |
| `--vfu-radius-large`                 | `8px`    |
| `--vfu-radius-round`                 | `99px`   |
| `--vfu-font-family`                  | `Inter, ui-sans-serif, system-ui, sans-serif` |
| `--vfu-font-size-tiny` / `small`     | `11px` / `12px` |
| `--vfu-font-size-medium` / `base`    | `13px` / `14px` |
| `--vfu-font-size-large`              | `16px`   |
| `--vfu-file-row-height`              | `52px`   |
| `--vfu-file-thumbnail-size`          | `41px`   |
| `--vfu-file-actions-width`           | `104px`  |
| `--vfu-toolbar-height`               | `50px`   |
| `--vfu-footer-height`                | `46px`   |
| `--vfu-action-size`                  | `28px`   |
| `--vfu-picture-wall-size`            | `192px`  |
| `--vfu-picture-wall-caption-height`  | `44px`   |

Токены слоёв (`--vfu-z-index-mask`, `-overlay`, `-tooltip`, `-toast`, `-dialog`, `-confirm`) помогают встроить компонент в существующую шкалу z-index.

## Пресеты тем

`theme` поддерживает три пресета:

```vue
<FlowUpload theme="element-plus" />
<FlowUpload theme="ant-design-vue" />
```

- `default`: светлая/тёмная палитра Element Plus.
- `element-plus`: дополнительно задаёт радиус 4px и вес кнопок; цвета читаются из `--el-*`.
- `ant-design-vue`: читает `--ant-color-primary` (при выключенном `cssVar` — `#1677ff`) и использует радиус 6px.

Для тонкой настройки передайте `ThemeAdapter`:

```ts
import type { ThemeAdapter } from 'vue-flow-upload'

// Своя тема задаёт только класс и переменные; компонент не устанавливает сторонние UI-библиотеки.
const brandTheme: ThemeAdapter = {
  name: 'brand',
  className: 'vfu-theme-brand',
  variables: {
    '--vfu-color-primary': '#126f67',
    '--vfu-radius-base': '10px',
  },
}
```

Старые имена переменных v0.2 (`--vfu-signal`, `--vfu-ink`, `--vfu-muted`, `--vfu-line`, `--vfu-danger`, `--vfu-radius`) продолжают работать: `resolveTheme` сопоставляет их с новыми токенами, а явно заданные новые переменные имеют приоритет.

## Без стандартных стилей

Чтобы полностью управлять оформлением, не подключайте `vue-flow-upload/style.css`, а перенесите определения токенов из `packages/vue-flow-upload/src/styles/_tokens.scss` в свои селекторы. Структура DOM стабильна, все классы имеют префикс `vfu-`.
