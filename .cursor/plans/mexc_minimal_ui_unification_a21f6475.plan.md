---
name: MEXC minimal UI unification
overview: "Привести весь сайт к единому минималистичному MEXC-стилю: темнее фон, почти без рамок, ровные списки с hairline-разделителями, компактная типографика, единые шапки/шиты/кнопки."
todos:
  - id: design-tokens
    content: Унифицировать токены и добавить utility-классы panel/list-row/segmented в `index.css`
    status: completed
  - id: hide-on-scroll-hook
    content: Вынести hide-on-scroll в общий хук и подключить к ключевым страницам/хедерам
    status: completed
  - id: sheets-modals
    content: Привести `BottomSheet` и `Modal` к минимализму без рамок
    status: completed
  - id: asset-lists
    content: Довести `AssetTable` minimal до ровного списка и применить на рынках/главной
    status: completed
  - id: remove-inline-borders
    content: Убрать inline RGBA borders/backgrounds, начиная с `DepositPage`, затем остальные страницы
    status: completed
  - id: typography-scale
    content: Унифицировать размеры (inputs/buttons/titles) и радиусы по всему сайту
    status: completed
  - id: qa-pass
    content: Визуальный прогон основных сценариев + lints для изменённых файлов
    status: completed
isProject: false
---

### Цель
- Единый визуальный язык на всех страницах: **почти без рамок**, более тёмные поверхности, компактные размеры, “биржевой” минимализм.
- Убрать разнобой: inline `style={{ background: 'rgba(...)', border: '1px ...' }}` и разные паттерны карточек.

### Базовая дизайн-система (1 место правды)
- Обновить токены в `index.css` и/или `@theme`:
  - `--color-background`, `--color-surface`, `--color-card` (уже затемнены — довести до консистентности)
  - `--color-border` оставить почти прозрачным (по твоему выбору: **почти везде без рамок**) и добавить явный токен разделителя `--color-divider` (hairline)
  - унифицировать `hairline-top/bottom` и `border-subtle` как единственный способ “разделять”, а не “обводить”.
- Добавить глобальные utility-классы в `index.css` для частых паттернов:
  - `.panel` (фон/радиус/без рамки)
  - `.list-row` (строка списка + hover + hairline-divider)
  - `.segmented` (переключатели типа Crypto/Forex)

### Единая верхняя шапка (TopBar)
- Стандартизировать поведение шапки (sticky + hide-on-scroll) через один общий механизм:
  - Вынести логику “скролл вниз/вверх” в маленький хук `utils/useHideOnScroll.ts` (скроллер = `#root`), чтобы Home/Coins и остальные страницы использовали одно и то же.
  - Применить к страницам с собственными хедерами: `pages/HomePage.tsx`, `pages/CoinsPage.tsx`, `pages/TradingPage.tsx`, `pages/DepositPage.tsx`, `pages/WithdrawPage.tsx`, `pages/ProfilePage.tsx`, `pages/SupportPage.tsx`.
  - Оставить фон шапки **плотным** (`bg-background`) и разделитель только `hairline-bottom`.

### BottomSheet/Modal: минимализм без рамок
- `components/BottomSheet.tsx`:
  - Для `partial/expandable` убрать визуальные границы (`border-t border-border`) там, где они выглядят как “рамка”, оставить лишь `hairline-top` или лёгкую тень.
  - Хедер/контент: одинаковые отступы и радиусы (`rounded-t-3xl`).
- `components/Modal.tsx`:
  - Убрать `border border-border` у модалки (оставить тень + фон), чтобы не было “окантовки”.

### Списки активов и таблицы
- `components/AssetTable.tsx`:
  - Для `variant="minimal"` закрепить стиль ровного списка: без карточек, без ring, с `hairline-bottom`, единый hover.
  - Для `variant="default"` также ослабить рамки (перевести на panel/list).
- Применить `variant="minimal"` везде, где это рынки/списки: `pages/CoinsPage.tsx`, `pages/HomePage.tsx`, возможно `pages/ExchangePage.tsx`.

### Убрать inline RGBA-бордеры в “тяжёлых” страницах
- Самый большой источник рамок/inline-стилей сейчас `pages/DepositPage.tsx`.
  - Постепенно заменить inline `style={{ background/border }}` на классы из дизайн-системы (`panel`, `list-row`, `segmented`).
- Аналогично пройтись по: `pages/TradingPage.tsx`, `pages/SupportPage.tsx`, `pages/ProfilePage.tsx`, `pages/WithdrawPage.tsx`, `pages/LoginPage.tsx`, `pages/RegisterPage.tsx`, `pages/DealsPage.tsx`, `pages/LandingPage.tsx`.

### Типографика и размеры
- Уменьшить крупные элементы до единого масштаба:
  - заголовки, кнопки, поля ввода, карточки
  - унифицировать размеры и `rounded` по сайту (например: `rounded-2xl/3xl`, без смешения `rounded-lg` в ключевых местах).

### Контроль качества
- Проверить визуально ключевые сценарии:
  - Главная → Рынки → Торговля → Пополнение/Вывод
  - Открытие/закрытие BottomSheet/Modal, скролл и автоскрытие шапки
- Прогнать TypeScript/lints для затронутых файлов.

### Где конкретно уже видно разнобой (точки входа)
- `pages/DepositPage.tsx`: много inline RGBA background/border
- `pages/TradingPage.tsx`: много `border-*` в панелях
- `components/Modal.tsx`, `components/BottomSheet.tsx`: рамки у контейнеров
- `pages/*`: повсеместно `border border-border`, `border-white/[...]`