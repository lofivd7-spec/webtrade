---
name: pro_trading_terminal_upgrade
overview: "Прокачать страницу трейдинга до “проф” терминала для Spot + Futures в рамках текущей симуляционной модели: добавить лимитные/стоп-ордера (pending) и риск‑контролы, плюс расширенные панели (Positions/Orders/History) и настройки UI без ломки текущего флоу сделок."
todos:
  - id: types-orders
    content: Добавить типы PendingOrder/RiskSettings в `types.ts` + минимальные helper enums
    status: completed
  - id: storage
    content: Сделать localStorage слой для pending orders и настроек (versioned payload)
    status: completed
  - id: trade-ui
    content: В `pages/TradingPage.tsx` добавить UI выбора order type + поля limit/stop + риск-контролы и валидацию
    status: completed
  - id: execution
    content: "Добавить исполнение pending orders по livePrice и интеграцию: spotBuy/spotSell и onOpenDeal(deal)"
    status: completed
  - id: pro-tabs
    content: Добавить вкладки Positions/OpenOrders/History и кнопку/шит настроек
    status: completed
  - id: i18n
    content: Добавить переводы для новых элементов UI
    status: completed
  - id: polish
    content: "Пройтись по UX: пустые состояния, disable states, loading, тоасты; проверить линтер"
    status: completed
isProject: false
---

# Pro Trading: Spot+Futures upgrade plan

## Current state (what we already have)
- Trading screen is in `pages/TradingPage.tsx`.
- Two modes already exist: `tradeType: 'futures' | 'spot'` with spot buy/sell via `lib/spot.ts` and futures deal creation via `onOpenDeal(deal)`.
- Live price polling exists (every ~10s) and there is a simulated order book panel already.
- Deals lifecycle (ACTIVE→WIN/LOSS) is handled globally in `App.tsx` game loop; `Deal` type is in `types.ts`.

## Goal (your request)
Make the trading page feel like a professional terminal **within our system constraints**:
- **Limit/Stop orders (pending)** for Spot and Futures.
- **Risk controls** (position sizing helpers, max risk, quick presets, validation).
- Extra pro UI: tabs for **Positions / Open Orders / Order History**, and a compact settings panel.

## Key design decisions
- We will implement **client-side pending orders** (stored locally, executed when live price crosses trigger). This matches current architecture (no matching engine / no server OMS).
- Futures remains the current “deal” model; pending orders will create a `Deal` at fill time using the same `onOpenDeal` callback.
- Spot pending orders will call `spotBuy/spotSell` at fill time.

## Data model additions
- Extend `types.ts` with new entities:
  - `OrderType`: `market | limit | stop`
  - `OrderSide`: `buy | sell` (spot), `long | short` (futures)
  - `PendingOrder`: includes `id`, `symbol`, `tradeType`, `orderType`, `triggerPrice?`, `limitPrice?`, `amount`, `quantity?`, `leverage?`, `durationSeconds?`, `createdAt`, `status: open|filled|cancelled|expired`.
  - `RiskSettings`: `riskMode (fixedAmount | percentBalance)`, `riskValue`, `maxLeverage`, `maxOrderSize`, `confirmMarketOrders`, etc.

## Execution engine (fills)
- Add a small order execution loop inside `pages/TradingPage.tsx` driven by `livePrice` updates:
  - On each price update, iterate `open` pending orders for current ticker (and optionally background-fill all tickers if we decide to support global orders).
  - Fill rules:
    - **Limit**: buy fills when `livePrice <= limitPrice`, sell when `livePrice >= limitPrice`.
    - **Stop**: buy fills when `livePrice >= triggerPrice`, sell when `livePrice <= triggerPrice`.
  - On fill:
    - Spot: call `spotBuy/spotSell`.
    - Futures: create `Deal` and call `onOpenDeal(deal)`.
  - Update local storage + UI state.

## UI upgrades (TradingPage)
- **Trade panel**:
  - Add an **Order type segmented control**: Market / Limit / Stop.
  - For Limit/Stop show price inputs (`limitPrice`, `triggerPrice`).
  - Keep leverage/duration/side for futures, and amount/qty for spot.
  - Add **risk helper row**:
    - “Use % of balance” slider/presets (e.g. 1%, 2%, 5%, 10%).
    - Max order size validation + inline warnings.
- **Pro bottom section** (new tabs under trade panel or as a right column on desktop):
  - `Positions` (for futures: active deals summary; for spot: holdings summary)
  - `OpenOrders` (pending orders list with cancel)
  - `History` (filled/cancelled orders local history)
- **Settings sheet**:
  - Toggles: confirm market, default order type, show advanced fields, risk mode, max leverage.

## Persistence
- Store pending orders + settings in localStorage:
  - Key examples: `mexc_pending_orders_v1`, `mexc_trading_settings_v1`.
  - Migrate safely (try/catch, versioned payload).

## Navigation / integration points
- `App.tsx` passes needed props (already passes `onOpenDeal`, `spotHoldings`, etc.).
- Optional: show counts/badges (open orders) on `TradingPage` header.

## Files to change
- `pages/TradingPage.tsx`: main UI + order creation + execution loop + tabs.
- `types.ts`: add `PendingOrder`, enums, settings types.
- `lib/spot.ts`: no API change expected; reuse existing `spotBuy/spotSell`.
- `i18n/translations.ts`: add strings for order types, risk controls, warnings.

## Test plan
- Manual:
  - Create Spot limit buy below price → wait for price update → verify order fills and holdings change.
  - Create Futures stop short → verify deal opens when trigger hits.
  - Cancel open order → verify it never fills.
  - Risk presets respect balance and min amount.
  - Reload page → open orders persist.

