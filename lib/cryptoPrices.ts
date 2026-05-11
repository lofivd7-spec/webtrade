/**
 * Quotes: единственный источник — Binance Public API (free).
 * Кеш в localStorage — последний успешный снимок (чтобы не мигало при открытии).
 *
 * Важно: в приложении исторически "база" котировок = RUB.
 * Сервер `/api/prices` конвертирует USDT-цены в RUB через внешний FX и отдаёт готовые `prices`,
 * браузер к Binance не ходит (CORS). Курс сохраняем в market USD/RUB для остальной логики.
 */

/**
 * Quotes: в dev — `/api/prices` (Vite middleware, Binance upstream).
 * На статике (Render без Node) — 404 → `fetchPricesForStaticHost` (CoinGecko/CoinLore + USD/RUB).
 */
const PRICES_API_PATH = '/api/prices';

const CACHE_KEY = 'etoro_crypto_prices_v3';
const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;
const MARKET_USD_RUB_KEY = 'mexc_market_usd_rub_v1';

/** Из последней загрузки market_quotes — для перевода баланса/отображения USD без смешения с Forex API. */
let marketUsdRubMem: number | null = null;

export function setMarketUsdToRub(v: number | null | undefined): void {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 55 || v > 220) return;
  marketUsdRubMem = v;
  try {
    localStorage.setItem(MARKET_USD_RUB_KEY, JSON.stringify({ v, ts: Date.now() }));
  } catch {}
}

export function getMarketUsdToRub(): number | null {
  if (typeof marketUsdRubMem === 'number' && marketUsdRubMem > 0) return marketUsdRubMem;
  try {
    const raw = localStorage.getItem(MARKET_USD_RUB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; ts?: number } | null;
    const x = Number(parsed?.v);
    if (!Number.isFinite(x) || x < 55 || x > 220) return null;
    marketUsdRubMem = x;
    return x;
  } catch {
    return null;
  }
}

/** @deprecated — оставлено для случайных импортов; используйте getMarketUsdToRub */
export function getUsdRubOverride(): number | null {
  return getMarketUsdToRub();
}

export interface CachedPrices {
  prices: Record<string, { price: number; change24h: number }>;
  timestamp: number;
}

/** Возвращает кеш ЛЮБОГО возраста (stale-while-revalidate: лучше старая цена чем никакой). */
export function getCachedPrices(): Record<string, { price: number; change24h: number }> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CachedPrices = JSON.parse(raw);
    if (!data?.prices || Object.keys(data.prices).length === 0) return null;
    return data.prices;
  } catch {
    return null;
  }
}

export function isCacheExpired(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return true;
    const data: CachedPrices = JSON.parse(raw);
    return Date.now() - data.timestamp > CACHE_TTL_MS;
  } catch {
    return true;
  }
}

function setCachedPrices(prices: Record<string, { price: number; change24h: number }>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ prices, timestamp: Date.now() } satisfies CachedPrices));
  } catch {}
}

export interface CoinPriceData {
  price: number;
  change24h: number;
  unavailable?: boolean;
}

/** Тикеры в UI могут расходиться с парой Binance (делистинг/rebrand). */
const BINANCE_PAIR_BASE: Record<string, string> = {
  MATIC: 'POL',
  RNDR: 'RENDER',
};

function tickerToBinanceSymbol(ticker: string): string {
  const upper = String(ticker || '').toUpperCase();
  if (!upper || upper === 'RUB' || upper === 'USD' || upper === 'USDT') return '';
  const base = BINANCE_PAIR_BASE[upper] ?? upper;
  return `${base}USDT`;
}

type PricesApiBody = {
  usdToRub?: number;
  prices?: Record<string, { price: number; change24h: number }>;
  error?: string;
};

/** Один запрос: dev — middleware; прод — при 404/offline клиент добивает котировки без `/api`. */
async function fetchPricesFromAppBackend(binanceSymbols: string[]): Promise<PricesApiBody | null> {
  const uniq = [...new Set(binanceSymbols.map((s) => String(s || '').toUpperCase()).filter(Boolean))];
  if (uniq.length === 0) return null;

  const tryStatic = async (): Promise<PricesApiBody | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const { fetchPricesForStaticHost } = await import('./pricesApiCore');
      const body = await fetchPricesForStaticHost(uniq);
      return { usdToRub: body.usdToRub, prices: body.prices };
    } catch {
      return null;
    }
  };

  try {
    const url = `${PRICES_API_PATH}?symbols=${encodeURIComponent(uniq.join(','))}`;
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { method: 'GET', signal: ac.signal });
    } finally {
      clearTimeout(tid);
    }
    let json: PricesApiBody | null = null;
    try {
      json = (await res.json()) as PricesApiBody;
    } catch {
      json = null;
    }
    if (res.ok && json && !json.error) return json;
    if (!res.ok || res.status === 404) {
      const fb = await tryStatic();
      if (fb) return fb;
    }
    if (json?.error) {
      const fb = await tryStatic();
      if (fb) return fb;
    }
    return null;
  } catch {
    return await tryStatic();
  }
}

/** Криптовалюты и прочие тикеры, которые есть в market_quotes. */
export async function fetchCryptoPricesInRub(tickers: string[]): Promise<Record<string, CoinPriceData>> {
  const upper = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const cached = getCachedPrices() ?? {};

  const binanceSymbols = upper.map(tickerToBinanceSymbol).filter(Boolean);

  let api: PricesApiBody | null = null;
  if (typeof window !== 'undefined') {
    try {
      api = await fetchPricesFromAppBackend(binanceSymbols);
    } catch {
      api = null;
    }
  }

  const usdRub =
    typeof api?.usdToRub === 'number' && Number.isFinite(api.usdToRub) && api.usdToRub > 0
      ? api.usdToRub
      : getMarketUsdToRub();

  if (typeof api?.usdToRub === 'number' && Number.isFinite(api.usdToRub) && api.usdToRub > 0) {
    setMarketUsdToRub(api.usdToRub);
  }

  const merged: Record<string, CoinPriceData> = {};
  const priceMap = api?.prices ?? {};

  // Сначала заполняем из кеша — гарантируем что хоть что-то есть
  for (const t of upper) {
    const c = cached[t];
    if (c?.price > 0) merged[t] = { price: c.price, change24h: c.change24h ?? 0 };
  }

  if (!(typeof usdRub === 'number' && Number.isFinite(usdRub) && usdRub > 0)) {
    return merged;
  }

  const symForTicker = (t: string) => tickerToBinanceSymbol(t).toUpperCase();

  // Перезаписываем кеш свежими данными из API
  for (const t of upper) {
    if (!t) continue;
    if (t === 'USDT') {
      merged[t] = { price: usdRub, change24h: 0 };
      continue;
    }
    const sym = symForTicker(t);
    const row = sym ? priceMap[sym] : undefined;
    if (row?.price != null && Number.isFinite(row.price) && row.price > 0) {
      merged[t] = { price: row.price, change24h: row.change24h ?? 0 };
    }
  }

  if (Object.keys(merged).length > 0) setCachedPrices({ ...cached, ...merged });
  return merged;
}

/**
 * Prefetch: запускаем загрузку цен сразу при импорте модуля,
 * не дожидаясь монтирования React-компонентов.
 * Результат попадёт в кеш и хуки мгновенно подхватят его.
 */
let prefetchStarted = false;
export function prefetchCryptoPrices(tickers: string[]): void {
  if (prefetchStarted) return;
  prefetchStarted = true;
  const upper = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const binanceSymbols = upper.map(tickerToBinanceSymbol).filter(Boolean);
  if (binanceSymbols.length === 0 || typeof window === 'undefined') return;
  void fetchPricesFromAppBackend(binanceSymbols).then((api) => {
    if (!api) return;
    if (typeof api.usdToRub === 'number' && Number.isFinite(api.usdToRub) && api.usdToRub > 0) {
      setMarketUsdToRub(api.usdToRub);
    }
    const priceMap = api.prices ?? {};
    if (Object.keys(priceMap).length > 0) {
      const cached = getCachedPrices() ?? {};
      setCachedPrices({ ...cached, ...priceMap });
    }
  });
}

export async function fetchAssetPricesInRub(tickers: string[]): Promise<Record<string, CoinPriceData>> {
  if (!tickers.length) return {};
  try {
    return await fetchCryptoPricesInRub([...new Set(tickers.map((t) => t.toUpperCase()))]);
  } catch {
    const cached = getCachedPrices();
    if (!cached) return {};
    return Object.fromEntries(
      tickers
        .map((t) => t.toUpperCase())
        .filter((t) => cached[t])
        .map((t) => [t, cached[t]]),
    );
  }
}

export function getCoinGeckoId(_ticker: string): string | undefined {
  // Kept for backward compatibility. Not used when Binance is the only source.
  return undefined;
}
