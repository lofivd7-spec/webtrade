import React, { useMemo } from 'react';
import { MARKET_ASSETS } from '../constants';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { useLiveAssets } from '../utils/useLiveAssets';

/**
 * Compact live-quote block in the desktop sidebar (above main nav).
 */
const UnifiedMarketsRibbon: React.FC = () => {
  const { formatPrice, symbol } = useCurrency();
  const { t } = useLanguage();
  const live = useLiveAssets(MARKET_ASSETS, { intervalMs: 10_000 });

  const items = useMemo(() => {
    return [...live]
      .filter((a) => !a.priceUnavailable && (a.price ?? 0) > 0)
      .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
      .slice(0, 6);
  }, [live]);

  if (items.length === 0) {
    return <div className="mx-2 mb-2 h-16 rounded-lg bg-black/20 border border-white/[0.06] animate-pulse" aria-hidden />;
  }

  return (
    <div className="px-2 pb-3">
      <p className="text-[10px] text-textMuted uppercase tracking-wide font-semibold mb-1.5 px-1">{t('last_trades')}</p>
      <div className="flex flex-col gap-1 rounded-xl bg-black/20 border border-white/[0.06] p-1.5">
        {items.map((a) => {
          const ch = a.change24h ?? 0;
          const up = ch >= 0;
          return (
            <div key={a.id} className="flex items-center justify-between gap-2 px-1.5 py-1 rounded-lg hover:bg-white/[0.04]">
              <span className="text-xs font-mono font-bold text-textPrimary w-10 shrink-0">{a.ticker}</span>
              <span className="text-[11px] font-mono text-textSubtle tabular-nums truncate min-w-0">
                {formatPrice(a.price)} {symbol}
              </span>
              <span className={`text-[11px] font-mono font-semibold tabular-nums shrink-0 ${up ? 'text-up' : 'text-down'}`}>
                {up ? '+' : ''}
                {ch.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnifiedMarketsRibbon;
