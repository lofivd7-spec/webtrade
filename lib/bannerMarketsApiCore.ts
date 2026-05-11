/**
 * `/api/banner-markets`: BTC/ETH с Binance; акции (NVDA, AAPL) — USD и % за день с Finnhub.
 * Без прямого CoinGecko из браузера.
 */

import { fetchBinanceTicker24hMerged } from './pricesApiCore';
import { FINNHUB_API_KEY, FINNHUB_BASE } from './finnhubConfig';

export const BANNER_MARKET_IDS = ['bitcoin', 'ethereum', 'nvda', 'aapl'] as const;
export type BannerMarketId = (typeof BANNER_MARKET_IDS)[number];

const CRYPTO_PAIR: Partial<Record<BannerMarketId, string>> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
};

const STOCK_FINNHUB: Partial<Record<BannerMarketId, string>> = {
  nvda: 'NVDA',
  aapl: 'AAPL',
};

const ID_META: Record<BannerMarketId, { symbol: string; name: string }> = {
  bitcoin: { symbol: 'btc', name: 'Bitcoin' },
  ethereum: { symbol: 'eth', name: 'Ethereum' },
  nvda: { symbol: 'nvda', name: 'NVIDIA' },
  aapl: { symbol: 'aapl', name: 'Apple' },
};

function parseBannerIds(searchParams: URLSearchParams): BannerMarketId[] {
  const raw = searchParams.get('ids');
  if (!raw?.trim()) return [...BANNER_MARKET_IDS];
  const want = [...new Set(raw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const ordered = BANNER_MARKET_IDS.filter((id) => want.includes(id));
  return ordered.length > 0 ? ordered : [...BANNER_MARKET_IDS];
}

type BannerMarketRow = {
  id: BannerMarketId;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  sparkline_in_7d?: { price: number[] };
};

async function fetchFinnhubQuoteUsd(symbol: string): Promise<{ c: number; dp: number | null } | null> {
  const s = String(symbol || '').trim().toUpperCase();
  if (!s) return null;
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(s)}&token=${encodeURIComponent(FINNHUB_API_KEY)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as { c?: number; dp?: number };
    const c = Number(j?.c);
    const dp = Number(j?.dp);
    if (!Number.isFinite(c) || c <= 0) return null;
    return { c, dp: Number.isFinite(dp) ? dp : null };
  } catch {
    return null;
  }
}

export async function handleBannerMarketsRequest(url: URL): Promise<Response> {
  const ids = parseBannerIds(url.searchParams);

  const headersInit: HeadersInit = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=45, s-maxage=120, stale-while-revalidate=240',
    'Access-Control-Allow-Origin': '*',
    Vary: 'Origin',
  };

  try {
    const cryptoIds = ids.filter((id): id is 'bitcoin' | 'ethereum' => id === 'bitcoin' || id === 'ethereum');
    const pairs = cryptoIds.map((id) => CRYPTO_PAIR[id]!).filter(Boolean);
    const binanceRows = pairs.length ? await fetchBinanceTicker24hMerged(pairs) : [];
    const byPair = new Map(binanceRows.map((r) => [String(r.symbol ?? '').toUpperCase(), r]));

    const payload: BannerMarketRow[] = [];
    let stockFetchIndex = 0;

    for (const id of ids) {
      const meta = ID_META[id];
      if (CRYPTO_PAIR[id]) {
        const pair = CRYPTO_PAIR[id]!;
        const row = byPair.get(pair.toUpperCase());
        const lp = parseFloat(row?.lastPrice ?? 'nan');
        const pct = parseFloat(row?.priceChangePercent ?? 'nan');
        payload.push({
          id,
          symbol: meta.symbol,
          name: meta.name,
          image: '',
          current_price: Number.isFinite(lp) ? lp : 0,
          price_change_percentage_24h: Number.isFinite(pct) ? pct : null,
          sparkline_in_7d: { price: [] },
        });
        continue;
      }

      const fh = STOCK_FINNHUB[id];
      if (fh) {
        if (stockFetchIndex++ > 0) await new Promise((r) => setTimeout(r, 450));
        const q = await fetchFinnhubQuoteUsd(fh);
        payload.push({
          id,
          symbol: meta.symbol,
          name: meta.name,
          image: '',
          current_price: q ? q.c : 0,
          price_change_percentage_24h: q?.dp ?? null,
          sparkline_in_7d: { price: [] },
        });
      }
    }

    return new Response(JSON.stringify(payload), { status: 200, headers: headersInit });
  } catch {
    return new Response(JSON.stringify([]), { status: 200, headers: headersInit });
  }
}
