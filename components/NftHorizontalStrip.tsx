import React from 'react';
import { type NftListingRow } from '../lib/nftCatalog';
import { Haptic } from '../utils/haptics';

interface NftHorizontalStripProps {
  title: string;
  items: NftListingRow[];
  onItemClick: (item: NftListingRow) => void;
  activeCodeKey?: string;
}

const NftHorizontalStrip: React.FC<NftHorizontalStripProps> = ({
  title,
  items,
  onItemClick,
  activeCodeKey,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col space-y-3 py-4">
      <div className="px-4 flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-textPrimary uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-[10px] text-textMuted font-medium tabular-nums">
          {items.length} items
        </span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 pb-2">
        {items.map((item) => {
          const isActive = item.codeKey === activeCodeKey;
          return (
            <button
              key={`${item.collectionSlug}-${item.codeKey}`}
              type="button"
              onClick={() => {
                Haptic.tap();
                onItemClick(item);
              }}
              className={`snap-start shrink-0 w-36 flex flex-col rounded-2xl overflow-hidden bg-white/[0.03] border transition-all duration-300 active:scale-[0.97] ${
                isActive 
                  ? 'border-neon/50 bg-neon/5 ring-1 ring-neon/20' 
                  : 'border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="aspect-square relative overflow-hidden bg-black/20">
                <img
                  src={item.imageUrl}
                  alt={item.codeDisplay}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                  loading="lazy"
                />
                {isActive && (
                  <div className="absolute inset-0 bg-neon/10 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="bg-neon text-black text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                      CURRENT
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-2.5 flex flex-col gap-0.5 min-w-0">
                <div className="text-[9px] text-textMuted truncate uppercase tracking-tight font-semibold">
                  {item.collectionName}
                </div>
                <div className="font-mono text-[12px] font-bold text-textPrimary truncate">
                  {item.codeDisplay}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[11px] font-bold text-neon tabular-nums">
                    {item.priceEth.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                  </span>
                  <span className="text-[8px] text-textMuted font-bold uppercase tracking-tighter">ETH</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NftHorizontalStrip;
