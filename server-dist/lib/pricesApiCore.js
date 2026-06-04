/**
 * Shared core for `/api/prices` used in:
 * - Vercel Edge function: `api/prices.ts`
 * - Local dev middleware in `vite.config.ts`
 *
 * Binance первичный источник; при ошибке батча — рекурсивное деление или один символ.
 * Если после Binance есть дыры — CoinLore `/api/ticker`, затем CoinGecko simple/price (мапинги в отдельных файлах).
 */
import { COINGECKO_ID_BY_TICKER } from './pricesCoingeckoMap.js';
import { COINLORE_ID_BY_TICKER } from './pricesCoinloreMap.js';
const BINANCE_ENDPOINTS = [
    'https://data-api.binance.vision/api/v3/ticker/24hr',
    'https://api.binance.com/api/v3/ticker/24hr',
];
const COINLORE_TICKER_URL = 'https://api.coinlore.net/api/ticker/';
function change24hPercentFromBinanceTicker(row) {
    const direct = parseFloat(String(row.priceChangePercent ?? ''));
    if (Number.isFinite(direct))
        return direct;
    const lp = parseFloat(String(row.lastPrice ?? ''));
    const op = parseFloat(String(row.openPrice ?? ''));
    if (Number.isFinite(lp) && Number.isFinite(op) && op !== 0)
        return ((lp - op) / op) * 100;
    return 0;
}
async function fetchUsdToRub(signal) {
    const sources = [
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
        'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
    ];
    for (const url of sources) {
        try {
            const res = await fetch(url, { signal });
            if (!res.ok)
                continue;
            const data = (await res.json());
            const rub = data?.usd?.rub;
            if (typeof rub === 'number' && Number.isFinite(rub) && rub > 0)
                return rub;
        }
        catch {
            // next
        }
    }
    return 90;
}
export function parseSymbols(url) {
    const raw = url.searchParams.get('symbols') ?? '';
    if (!raw.trim())
        return [];
    const items = raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    const safe = items.filter((s) => /^[A-Z0-9]{1,24}$/.test(s));
    return safe.slice(0, 220);
}
function baseTickerFromPair(symbolUpper) {
    const s = symbolUpper.toUpperCase();
    if (s.endsWith('USDT'))
        return s.slice(0, -4) || s;
    return s;
}
/** Батч символов: default FULL (MINI не содержит priceChangePercent → в UI везде 0%). */
async function fetchBinance24hBatch(symbols, signal) {
    if (symbols.length === 0)
        return [];
    const query = `?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
    for (const base of BINANCE_ENDPOINTS) {
        try {
            const res = await fetch(`${base}${query}`, {
                signal,
                headers: {
                    'User-Agent': 'prices-api/1.0',
                    Accept: 'application/json',
                },
            });
            if (!res.ok)
                continue;
            const data = (await res.json());
            if (!Array.isArray(data))
                continue;
            return data;
        }
        catch {
            // next endpoint
        }
    }
    return null;
}
/** Один символ (ответ — объект, FULL). */
async function fetchBinance24hSingle(symbol, signal) {
    const q = `?symbol=${encodeURIComponent(symbol)}`;
    for (const base of BINANCE_ENDPOINTS) {
        try {
            const res = await fetch(`${base}${q}`, {
                signal,
                headers: {
                    'User-Agent': 'prices-api/1.0',
                    Accept: 'application/json',
                },
            });
            if (!res.ok)
                continue;
            const row = (await res.json());
            const sym = String(row?.symbol ?? symbol).toUpperCase();
            const lastPrice = row?.lastPrice;
            if (!lastPrice || !sym)
                continue;
            const parsed = {
                symbol: sym,
                lastPrice: String(lastPrice),
                priceChangePercent: row.priceChangePercent != null ? String(row.priceChangePercent) : undefined,
                openPrice: row.openPrice != null ? String(row.openPrice) : undefined,
            };
            return {
                ...parsed,
                priceChangePercent: String(change24hPercentFromBinanceTicker(parsed)),
            };
        }
        catch {
            // next endpoint
        }
    }
    return null;
}
function rowKey(r) {
    return String(r.symbol ?? '').toUpperCase();
}
/**
 * Рекурсия: один неверный символ в батче может дать 400 на весь список — делим пополам.
 * Один символ — отдельный `?symbol=`.
 */
async function fetchBinance24hMerged(symbols, signal) {
    if (symbols.length === 0)
        return [];
    const want = [...new Set(symbols.map((s) => String(s || '').toUpperCase()).filter(Boolean))];
    if (want.length === 0)
        return [];
    const batch = await fetchBinance24hBatch(want, signal);
    const byRequested = new Set(want);
    if (batch != null) {
        const picked = batch.filter((r) => byRequested.has(rowKey(r)));
        if (picked.length === want.length)
            return picked.map((r) => ({
                ...r,
                priceChangePercent: String(change24hPercentFromBinanceTicker(r)),
            }));
    }
    if (want.length === 1) {
        const sym = want[0];
        const one = await fetchBinance24hSingle(sym, signal);
        return one && byRequested.has(rowKey(one)) ? [one] : [];
    }
    const mid = Math.ceil(want.length / 2);
    const left = want.slice(0, mid);
    const right = want.slice(mid);
    const [a, b] = await Promise.all([fetchBinance24hMerged(left, signal), fetchBinance24hMerged(right, signal)]);
    const map = new Map();
    for (const r of [...a, ...b])
        map.set(rowKey(r), r);
    return [...map.values()];
}
/** Для малого числа символов (например, баннер рынков) без дублирования логики батчинга Binance. */
export async function fetchBinanceTicker24hMerged(symbols, signal) {
    return fetchBinance24hMerged(symbols, signal);
}
/**
 * CoinLore: батчи `GET /api/ticker/?id=90,80,...` без ключа API.
 * Ответ массив; цена в USD — умножаем на тот же usd→RUB, что и Binance.
 */
async function fetchCoinloreFill(symbolListUsdtPair, usdToRub, filledKeys, signal) {
    const out = {};
    /** один CoinLore id → какие ключи нам нужно заполнить (например POLUSDT). */
    const idToBinanceKeys = {};
    for (const pair of symbolListUsdtPair) {
        const raw = pair.toUpperCase().trim();
        const key = raw.endsWith('USDT') ? raw : `${raw}USDT`;
        if (!key.endsWith('USDT') || key === 'USDTRUB')
            continue;
        if (filledKeys.has(key))
            continue;
        const base = baseTickerFromPair(key);
        const loreId = COINLORE_ID_BY_TICKER[base];
        if (!loreId)
            continue;
        if (!idToBinanceKeys[loreId])
            idToBinanceKeys[loreId] = [];
        idToBinanceKeys[loreId].push(key);
    }
    const uniqIds = [...new Set(Object.keys(idToBinanceKeys))];
    if (uniqIds.length === 0)
        return out;
    const chunks = [];
    for (let i = 0; i < uniqIds.length; i += 45)
        chunks.push(uniqIds.slice(i, i + 45));
    for (const chunk of chunks) {
        try {
            const query = encodeURIComponent(chunk.join(','));
            const res = await fetch(`${COINLORE_TICKER_URL}?id=${query}`, {
                signal,
                headers: { Accept: 'application/json', 'User-Agent': 'prices-api/1.0' },
            });
            if (!res.ok)
                continue;
            const data = (await res.json());
            const rows = Array.isArray(data) ? data : [];
            const byId = new Map(rows.map((r) => [String(r.id ?? ''), r]));
            for (const lid of chunk) {
                const row = byId.get(lid);
                const px = parseFloat(String(row?.price_usd ?? ''));
                const chRaw = parseFloat(String(row?.percent_change_24h ?? '0'));
                const targets = idToBinanceKeys[lid];
                if (!targets?.length || !Number.isFinite(px) || px <= 0)
                    continue;
                for (const binanceKey of targets) {
                    if (filledKeys.has(binanceKey))
                        continue;
                    out[binanceKey] = {
                        price: px,
                        change24h: Number.isFinite(chRaw) ? chRaw : 0,
                    };
                }
            }
        }
        catch {
            // next chunk
        }
    }
    return out;
}
async function fetchCoingeckoFill(symbolListUsdtPair, usdToRub, filledKeys, signal) {
    const out = {};
    const ids = [];
    const idToSymbols = {};
    for (const pair of symbolListUsdtPair) {
        const p = pair.toUpperCase();
        const key = p.endsWith('USDT') ? p : `${p}USDT`;
        if (filledKeys.has(key))
            continue;
        const base = baseTickerFromPair(p.endsWith('USDT') ? p : `${p}USDT`);
        const cid = COINGECKO_ID_BY_TICKER[base];
        if (!cid)
            continue;
        ids.push(cid);
        if (!idToSymbols[cid])
            idToSymbols[cid] = [];
        idToSymbols[cid].push(key);
    }
    const uniqIds = [...new Set(ids)];
    if (uniqIds.length === 0)
        return out;
    const chunks = [];
    for (let i = 0; i < uniqIds.length; i += 30)
        chunks.push(uniqIds.slice(i, i + 30));
    const urls = chunks.map((c) => {
        const u = new URL('https://api.coingecko.com/api/v3/simple/price');
        u.searchParams.set('ids', c.join(','));
        u.searchParams.set('vs_currencies', 'usd');
        u.searchParams.set('include_24hr_change', 'true');
        return u.toString();
    });
    for (const url of urls) {
        try {
            const res = await fetch(url, { signal });
            if (!res.ok)
                continue;
            const data = (await res.json());
            if (!data || typeof data !== 'object')
                continue;
            for (const [cid, row] of Object.entries(data)) {
                const px = typeof row?.usd === 'number' ? row.usd : NaN;
                const ch = typeof row?.usd_24h_change === 'number' ? row.usd_24h_change : 0;
                const syms = idToSymbols[cid];
                if (!syms?.length || !Number.isFinite(px) || px <= 0)
                    continue;
                for (const binanceKey of syms) {
                    if (filledKeys.has(binanceKey))
                        continue;
                    out[binanceKey] = { price: px, change24h: Number.isFinite(ch) ? ch : 0 };
                }
            }
        }
        catch {
            // next chunk
        }
    }
    return out;
}
function rowsToPrices(rows, usdToRub) {
    const prices = {};
    for (const item of rows) {
        const symKey = String(item.symbol).toUpperCase();
        const lastPrice = parseFloat(item.lastPrice);
        if (!Number.isFinite(lastPrice) || lastPrice <= 0)
            continue;
        const change24h = change24hPercentFromBinanceTicker(item);
        prices[symKey] = {
            price: lastPrice,
            change24h: Number.isFinite(change24h) ? change24h : 0,
        };
    }
    return prices;
}
/**
 * Статик-хостинг (Render и т.п.): нет `/api/prices` middleware.
 * Только CORS-дружелюбные источники: USD/RUB (jsdelivr) + CoinLore + CoinGecko.
 */
export async function fetchPricesForStaticHost(symbolPairs, signal) {
    const want = [...new Set(symbolPairs.map((s) => String(s || '').toUpperCase()).filter(Boolean))];
    if (want.length === 0)
        return { usdToRub: 90, prices: {} };
    const usdToRub = await fetchUsdToRub(signal);
    let prices = {};
    const filled = new Set();
    const lore = await fetchCoinloreFill(want, usdToRub, filled, signal);
    prices = { ...prices, ...lore };
    for (const k of Object.keys(lore))
        filled.add(k);
    const geo = await fetchCoingeckoFill(want, usdToRub, filled, signal);
    prices = { ...prices, ...geo };
    return { usdToRub, prices };
}
export async function handlePricesRequest(url) {
    const symbols = parseSymbols(url);
    if (symbols.length === 0) {
        return new Response(JSON.stringify({ usdToRub: 0, prices: {} }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, s-maxage=600, max-age=60, stale-while-revalidate=600',
            },
        });
    }
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 15_000);
    try {
        const usdToRubPromise = fetchUsdToRub(ac.signal);
        const rowsPromise = fetchBinance24hMerged(symbols, ac.signal);
        const [usdToRub, rows] = await Promise.all([usdToRubPromise, rowsPromise]);
        let prices = rowsToPrices(rows, usdToRub);
        const filled = new Set(Object.keys(prices));
        const lore = await fetchCoinloreFill(symbols, usdToRub, filled, ac.signal);
        prices = { ...prices, ...lore };
        for (const k of Object.keys(lore))
            filled.add(k);
        const geo = await fetchCoingeckoFill(symbols, usdToRub, filled, ac.signal);
        prices = { ...prices, ...geo };
        const body = { usdToRub, prices };
        return new Response(JSON.stringify(body), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, s-maxage=600, max-age=60, stale-while-revalidate=600',
            },
        });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }
    finally {
        clearTimeout(tid);
    }
}
