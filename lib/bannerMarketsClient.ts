/**
 * Клиентский fallback для баннера рынков, когда `/api/banner-markets` недоступен (статик на Render).
 * BTC/ETH — CoinGecko; NVDA/AAPL — разумные статические USD (обновляйте при необходимости).
 */

import type { BannerMarketId } from './bannerMarketsApiCore';

export type BannerClientRow = {
  id: BannerMarketId;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  sparkline_in_7d?: { price: number[] };
};

const META: Record<BannerMarketId, { symbol: string; name: string }> = {
  bitcoin: { symbol: 'btc', name: 'Bitcoin' },
  ethereum: { symbol: 'eth', name: 'Ethereum' },
  nvda: { symbol: 'nvda', name: 'NVIDIA' },
  aapl: { symbol: 'aapl', name: 'Apple' },
};

/** Статические USD для акций, если нет Finnhub на сервере. Подправляйте периодически. */
const STOCK_USD_FALLBACK: Record<'nvda' | 'aapl', { price: number; changePct: number | null }> = {
  nvda: { price: 139.5, changePct: null },
  aapl: { price: 231.0, changePct: null },
};

export async function fetchBannerMarketsClientFallback(
  ids: BannerMarketId[]
): Promise<BannerClientRow[]> {
  const wantCrypto = ids.filter((id) => id === 'bitcoin' || id === 'ethereum');
  let cg: Record<string, { usd?: number; usd_24h_change?: number }> = {};
  if (wantCrypto.length > 0) {
    try {
      const u = new URL('https://api.coingecko.com/api/v3/simple/price');
      u.searchParams.set('ids', 'bitcoin,ethereum');
      u.searchParams.set('vs_currencies', 'usd');
      u.searchParams.set('include_24hr_change', 'true');
      const res = await fetch(u.toString(), { headers: { Accept: 'application/json' } });
      if (res.ok) cg = (await res.json()) as typeof cg;
    } catch {
      cg = {};
    }
  }

  const out: BannerClientRow[] = [];
  for (const id of ids) {
    const meta = META[id];
    if (!meta) continue;
    if (id === 'bitcoin') {
      const row = cg.bitcoin;
      const px = typeof row?.usd === 'number' ? row.usd : 0;
      const ch = typeof row?.usd_24h_change === 'number' ? row.usd_24h_change : null;
      out.push({
        id,
        symbol: meta.symbol,
        name: meta.name,
        image: '',
        current_price: px,
        price_change_percentage_24h: ch,
        sparkline_in_7d: { price: [] },
      });
      continue;
    }
    if (id === 'ethereum') {
      const row = cg.ethereum;
      const px = typeof row?.usd === 'number' ? row.usd : 0;
      const ch = typeof row?.usd_24h_change === 'number' ? row.usd_24h_change : null;
      out.push({
        id,
        symbol: meta.symbol,
        name: meta.name,
        image: '',
        current_price: px,
        price_change_percentage_24h: ch,
        sparkline_in_7d: { price: [] },
      });
      continue;
    }
    if (id === 'nvda' || id === 'aapl') {
      const fb = STOCK_USD_FALLBACK[id];
      out.push({
        id,
        symbol: meta.symbol,
        name: meta.name,
        image: '',
        current_price: fb.price,
        price_change_percentage_24h: fb.changePct,
        sparkline_in_7d: { price: [] },
      });
    }
  }
  return out;
}
