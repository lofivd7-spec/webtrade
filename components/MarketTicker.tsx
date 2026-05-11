import React, { useMemo, useState, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { MARKET_ASSETS } from '../constants';
import { useLiveAssets } from '../utils/useLiveAssets';

const MarketTicker: React.FC = () => {
  const [start, setStart] = useState(0);
  const visible = 4;
  const { formatPrice, symbol, currencyCode } = useCurrency();
  const { t } = useLanguage();
  const live = useLiveAssets(MARKET_ASSETS, { intervalMs: 10_000 });

  const items = useMemo(() => {
    const base = live
      .filter((a) => !a.priceUnavailable && (a.price ?? 0) > 0)
      .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
      .slice(0, 12)
      .map((a) => ({
        pair: a.ticker,
        price: a.price,
        change: (a.change24h ?? 0),
      }));
    const doubled = [...base, ...base];
    return doubled.slice(start, start + visible);
  }, [live, start]);

  useEffect(() => {
    const t = setInterval(() => {
      setStart((s) => (s + 1) % 12);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-lg bg-black/30 border border-white/5 px-3 py-1">
      <div className="text-[9px] text-neutral-500 uppercase tracking-wider mb-0.5">{t('last_trades')}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {items.map((item, i) => (
          <span key={`${item.pair}-${start}-${i}`} className="text-[11px] font-mono flex items-center gap-1 leading-tight">
            <span className="text-white">{item.pair}/{currencyCode}</span>
            <span className="text-neutral-500">{formatPrice(item.price)} {symbol}</span>
            <span className={item.change >= 0 ? 'text-up' : 'text-down'}>
              {item.change >= 0 ? '+' : ''}
              {item.change.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default MarketTicker;
