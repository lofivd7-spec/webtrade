import React, { useState } from 'react';
import { Asset } from '../types';
import { Filter } from 'lucide-react';
import { Haptic } from '../utils/haptics';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';

export type FilterType = 'Top' | 'Gainers' | 'Losers' | 'Vol' | 'New';

interface AssetTableProps {
  assets: Asset[];
  onAssetClick?: (asset: Asset) => void;
  externalFilter?: FilterType; // Optional prop to control sort from outside
  hideFilterBar?: boolean;     // Optional prop to hide the internal filter UI
  variant?: 'default' | 'minimal';
}

const AssetTable: React.FC<AssetTableProps> = ({ 
  assets, 
  onAssetClick, 
  externalFilter, 
  hideFilterBar = false,
  variant = 'default',
}) => {
  const [internalFilter, setInternalFilter] = useState<FilterType>('Top');
  const { formatPrice, symbol } = useCurrency();
  const { t } = useLanguage();

  const activeFilter = externalFilter || internalFilter;

  const filters: { key: FilterType; labelKey: string }[] = [
    { key: 'Top', labelKey: 'filter_top' },
    { key: 'Gainers', labelKey: 'filter_gainers' },
    { key: 'Losers', labelKey: 'filter_losers' },
    { key: 'Vol', labelKey: 'filter_vol' },
    { key: 'New', labelKey: 'filter_new' },
  ];

  const sortedAssets = [...assets].sort((a, b) => {
    switch (activeFilter) {
      case 'Gainers': return b.change24h - a.change24h;
      case 'Losers': return a.change24h - b.change24h;
      case 'Vol': return b.volume24h - a.volume24h;
      default: return 0; // Top
    }
  });


  const formatVol = (vol: number) => {
    if (vol >= 1000000000) return (vol / 1000000000).toFixed(1) + t('vol_b');
    if (vol >= 1000000) return (vol / 1000000).toFixed(1) + t('vol_m');
    return (vol / 1000).toFixed(0) + t('vol_k');
  };

  return (
    <div className="flex flex-col w-full relative">
      {!hideFilterBar && (
        <div className="py-2 mb-1 px-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Filter size={14} className="text-textMuted flex-shrink-0" />
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => { Haptic.tap(); setInternalFilter(filter.key); }}
              className={`text-xs font-mono uppercase tracking-cap px-3 py-2 rounded-lg whitespace-nowrap active:scale-[0.98] transition-etoro ${
                activeFilter === filter.key ? 'bg-card text-neon border border-neon' : 'text-textSecondary hover:text-textPrimary bg-transparent border border-transparent'
              }`}
            >
              {t(filter.labelKey)}
            </button>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-12 gap-1 text-cap font-mono text-textSecondary mb-1 px-1 ${variant === 'minimal' ? 'opacity-70' : ''}`}>
        <div className="col-span-5 text-left">{t('pair')}</div>
        <div className="col-span-3 text-right">{t('price')}</div>
        <div className="col-span-4 text-right">{t('change_24h')}</div>
      </div>

      <div className={`flex flex-col ${variant === 'minimal' ? 'gap-0 pb-4' : 'gap-1 pb-6'}`}>
        {sortedAssets.map((asset, idx) => (
          <div
            key={asset.id}
            onClick={() => { Haptic.tap(); onAssetClick?.(asset); }}
            className={[
              'grid grid-cols-12 gap-1 items-center min-h-[44px] py-1.5 px-2 cursor-pointer group transition-all duration-150 active:scale-[0.99]',
              variant === 'minimal'
                ? [
                    'rounded-none',
                    'bg-transparent hover:bg-white/[0.03]',
                    'focus:outline-none',
                    idx === sortedAssets.length - 1 ? '' : 'hairline-bottom',
                  ].join(' ')
                : 'rounded-md bg-transparent hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-neon/30 hairline-bottom',
            ].join(' ')}
          >
            <div className="col-span-5 flex items-center gap-2 min-w-0">
              {asset.logoUrl ? (
                <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden bg-black/40 ring-1 ring-white/[0.1]">
                  <img src={asset.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                </div>
              ) : null}
              <div className="flex flex-col min-w-0 gap-0">
                <span className="text-[14px] font-medium text-textPrimary group-hover:text-neon transition-etoro truncate">
                  {asset.ticker}
                </span>
                <span className="text-[12px] text-textSecondary truncate">{asset.name}</span>
              </div>
            </div>
            <div className="col-span-3 flex flex-col items-end justify-center gap-0.5">
              <span className="text-xs font-mono font-medium text-textPrimary tabular-nums">
                {asset.priceUnavailable
                  ? '—'
                  : formatPrice(asset.price)}
              </span>
              <span className="text-[11px] text-textSecondary">
                {symbol}
              </span>
            </div>
            <div className="col-span-4 flex flex-col items-end justify-center gap-0.5">
              <span className={`text-xs font-mono font-medium tabular-nums ${(asset.change24h ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                {asset.change24h > 0 ? '+' : ''}{(asset.change24h ?? 0).toFixed(2)}%
              </span>
              <span className="text-[11px] text-textSecondary">{formatVol(asset.volume24h)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetTable;