import React, { useEffect, useMemo, useState } from 'react';

import type { BannerMarketId } from '../lib/bannerMarketsApiCore';
import { fetchBannerMarketsClientFallback } from '../lib/bannerMarketsClient';

type GeckoMarketCoin = {
  id: BannerMarketId;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  sparkline_in_7d?: { price: number[] };
};

const COINS: Array<{
  id: BannerMarketId;
  label: string;
  logoUrl: string;
  ticker: string;
}> = [
  {
    id: 'bitcoin',
    label: 'Bitcoin',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/960px-Bitcoin.svg.png',
    ticker: 'BTC',
  },
  {
    id: 'ethereum',
    label: 'Ethereum',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Ethereum_Logo.png',
    ticker: 'ETH',
  },
  {
    id: 'nvda',
    label: 'NVIDIA',
    logoUrl: 'https://s3-symbol-logo.tradingview.com/nvidia--600.png',
    ticker: 'NVDA',
  },
  {
    id: 'aapl',
    label: 'Apple',
    logoUrl: 'https://s3-symbol-logo.tradingview.com/apple--600.png',
    ticker: 'AAPL',
  },
];

function formatUsd(n: number) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const fractionDigits = abs >= 1000 ? 0 : abs >= 10 ? 2 : abs >= 1 ? 3 : 5;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

function fallbackSpark(seed: string, size: number) {
  const base = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    const t = i / Math.max(1, size - 1);
    const a = 0.55 + ((base % 7) / 20);
    const b = 0.25 + ((base % 11) / 30);
    const c = 0.18 + ((base % 5) / 40);
    const v =
      Math.sin((t * (6 + (base % 5))) * Math.PI) * a +
      Math.sin((t * (10 + (base % 9))) * Math.PI) * b +
      Math.cos((t * (4 + (base % 3))) * Math.PI) * c;
    out.push(v);
  }
  return out;
}

function sparklinePoints(values: number[], w: number, h: number, pad = 2) {
  if (!values || values.length < 2) return '';
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '';
  if (min === max) {
    const y = Math.round(h / 2);
    return `0,${y} ${w},${y}`;
  }
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  const step = innerW / (values.length - 1);
  const pts: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const x = pad + i * step;
    const t = (v - min) / (max - min);
    const y = pad + (1 - t) * innerH;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

export default function CryptoBannerWidget() {
  const [data, setData] = useState<Partial<Record<BannerMarketId, GeckoMarketCoin>> | null>(null);
  const [loading, setLoading] = useState(true);

  const ids = useMemo(() => COINS.map((c) => c.id).join(','), []);

  useEffect(() => {
    const ac = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        const url = `/api/banner-markets?ids=${encodeURIComponent(ids)}`;

        const res = await fetch(url, {
          signal: ac.signal,
          headers: {
            Accept: 'application/json',
          },
        });
        let arr: GeckoMarketCoin[];
        if (!res.ok) {
          arr = (await fetchBannerMarketsClientFallback(
            COINS.map((c) => c.id) as BannerMarketId[],
          )) as GeckoMarketCoin[];
        } else {
          arr = (await res.json()) as GeckoMarketCoin[];
        }

        const map: Partial<Record<BannerMarketId, GeckoMarketCoin>> = {};
        for (const c of arr) {
          if (!c?.id) continue;
          map[c.id] = c;
        }
        setData(map);
      } catch (e) {
        if (!ac.signal.aborted) {
          try {
            const arr = (await fetchBannerMarketsClientFallback(
              COINS.map((c) => c.id) as BannerMarketId[],
            )) as GeckoMarketCoin[];
            const map: Partial<Record<BannerMarketId, GeckoMarketCoin>> = {};
            for (const c of arr) {
              if (!c?.id) continue;
              map[c.id] = c;
            }
            setData(map);
          } catch {
            setData(null);
          }
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => ac.abort();
  }, [ids]);

  return (
    <div className="mt-3 rounded-2xl bg-[#050608]/95 border border-white/[0.06] overflow-hidden shadow-inner shadow-black/40">
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between border-b border-white/[0.04]">
        <div className="text-[10px] font-semibold text-textMuted uppercase tracking-wider">Market</div>
        <div className="text-[9px] text-textMuted/80 font-mono">{loading ? '…' : 'Live'}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-black/70">
        {COINS.map((coin) => {
          const row = data?.[coin.id];
          const price = row?.current_price;
          const change = row?.price_change_percentage_24h;
          const sparkRaw = row?.sparkline_in_7d?.price?.slice(-48) ?? [];
          const spark = sparkRaw.length >= 2 ? sparkRaw : fallbackSpark(coin.id, 48);
          const up = (change ?? 0) >= 0;

          const accent = (() => {
            switch (coin.ticker) {
              case 'BTC':
                return { stroke: 'rgba(212, 168, 75, 0.85)', glow: 'rgba(212, 168, 75, 0.08)' };
              case 'ETH':
                return { stroke: 'rgba(130, 140, 200, 0.85)', glow: 'rgba(130, 140, 200, 0.08)' };
              case 'NVDA':
                return { stroke: 'rgba(0, 214, 156, 0.75)', glow: 'rgba(0, 214, 156, 0.06)' };
              default:
                return { stroke: 'rgba(148, 163, 184, 0.8)', glow: 'rgba(148, 163, 184, 0.07)' };
            }
          })();

          return (
            <div
              key={coin.id}
              className="bg-[#07090e] px-2.5 py-2.5 relative overflow-hidden hover:bg-[#0a0d14] transition-colors"
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(100px 48px at 8% 0%, ${accent.glow} 0%, rgba(0,0,0,0) 70%)`,
                }}
              />

              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <img
                    src={coin.logoUrl}
                    alt=""
                    className="h-5 w-5 rounded-full bg-black/50 object-contain ring-1 ring-white/[0.06]"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-textPrimary/95 truncate">{coin.label}</div>
                    <div className="text-[10px] text-textMuted font-mono uppercase tracking-wide">
                      {coin.ticker.toLowerCase()}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono font-semibold text-textPrimary/95 tabular-nums">
                    {typeof price === 'number' ? formatUsd(price) : '—'}
                  </div>
                  <div
                    className={[
                      'text-[10px] font-mono tabular-nums',
                      typeof change === 'number' ? (up ? 'text-up' : 'text-down') : 'text-textMuted',
                    ].join(' ')}
                  >
                    {typeof change === 'number' ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
                  </div>
                </div>
              </div>

              <div className="mt-1.5 opacity-90">
                <svg width="100%" height="22" viewBox="0 0 120 22" preserveAspectRatio="none" aria-hidden="true">
                  <polyline
                    fill="none"
                    stroke="rgba(255,255,255,0.028)"
                    strokeWidth="6"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={sparklinePoints(spark, 120, 22, 2)}
                  />
                  <polyline
                    fill="none"
                    stroke={typeof change === 'number' ? (up ? accent.stroke : 'rgba(220, 90, 90, 0.8)') : accent.stroke}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={sparklinePoints(spark, 120, 22, 2)}
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
