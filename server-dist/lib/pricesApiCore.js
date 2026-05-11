/**
 * Shared core for `/api/prices` used in:
 * - Vercel Edge function: `api/prices.ts`
 * - Local dev middleware in `vite.config.ts`
 *
 * Returns prices in RUB for requested Binance symbols, plus 24h change percent.
 */
const BINANCE_ENDPOINTS = [
    'https://data-api.binance.vision/api/v3/ticker/24hr',
    'https://api.binance.com/api/v3/ticker/24hr',
];
async function fetchUsdToRub(signal) {
    // fawazahmed0/currency-api: usd.rub = 92.5 → 1 USD = 92.5 RUB
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
            // try next source
        }
    }
    // Fallback: keep app usable if FX source is down.
    return 90;
}
function parseSymbols(url) {
    const raw = url.searchParams.get('symbols') ?? '';
    if (!raw.trim())
        return [];
    // allow: "BTCUSDT,ETHUSDT"
    const items = raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    // basic validation to avoid abuse: A-Z0-9 only, 1..20 chars
    const safe = items.filter((s) => /^[A-Z0-9]{1,20}$/.test(s));
    // hard cap to keep request small
    return safe.slice(0, 80);
}
async function fetchBinance24hMini(symbols, signal) {
    if (symbols.length === 0)
        return [];
    const query = `?symbols=${encodeURIComponent(JSON.stringify(symbols))}&type=MINI`;
    for (const base of BINANCE_ENDPOINTS) {
        try {
            const res = await fetch(`${base}${query}`, {
                signal,
                headers: {
                    // Some edges/CDNs behave better with explicit UA.
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
            // try next endpoint
        }
    }
    return null;
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
    const tid = setTimeout(() => ac.abort(), 8_000);
    try {
        const [usdToRub, mini] = await Promise.all([
            fetchUsdToRub(ac.signal),
            fetchBinance24hMini(symbols, ac.signal),
        ]);
        if (!mini) {
            // Soft-fail: keep UI working even if upstream is blocked.
            const body = { usdToRub, prices: {} };
            return new Response(JSON.stringify(body), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-store',
                },
            });
        }
        const prices = {};
        for (const item of mini) {
            const lastPrice = parseFloat(item.lastPrice);
            if (!Number.isFinite(lastPrice) || lastPrice <= 0)
                continue;
            const change24h = parseFloat(item.priceChangePercent);
            prices[item.symbol] = {
                price: lastPrice * usdToRub,
                change24h: Number.isFinite(change24h) ? change24h : 0,
            };
        }
        const body = { usdToRub, prices };
        return new Response(JSON.stringify(body), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                // Vercel CDN will cache Edge responses by this header.
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
