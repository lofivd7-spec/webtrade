import React, { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useLanguage } from '../context/LanguageContext';
import { getNftListingsForCollection, getAllNftListings, type NftListingRow } from '../lib/nftCatalog';
import { enrichNftListings, useNftReferrerPriceMap } from '../lib/nftReferrerPricing';
import { Haptic } from '../utils/haptics';
import NftHorizontalStrip from '../components/NftHorizontalStrip';

/** Снизу оставляем место под fixed bottom-nav + safe-area (+ запас под баннер P2P над навбаром). */
const GALLERY_SCROLL_BOTTOM_PADDING =
  'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]';

type GallerySort = 'floorAsc' | 'floorDesc' | 'tokenId';

interface NFTCollectionGalleryPageProps {
  collectionSlug: string;
  collectionName: string;
  coverUrl?: string;
  itemCount?: number;
  floorEth?: number;
  onBack: () => void;
  onOpenListing: (row: NftListingRow) => void;
}

const NFTCollectionGalleryPage: React.FC<NFTCollectionGalleryPageProps> = ({
  collectionSlug,
  collectionName,
  coverUrl: coverProp,
  itemCount: itemCountProp,
  floorEth: floorProp,
  onBack,
  onOpenListing,
}) => {
  const { t } = useLanguage();

  const refPrices = useNftReferrerPriceMap();
  const listings = useMemo(
    () => enrichNftListings(getNftListingsForCollection(collectionSlug), refPrices),
    [collectionSlug, refPrices]
  );

  const [sort, setSort] = useState<GallerySort>('floorAsc');

  const sortedListings = useMemo(() => {
    const rows = [...listings];
    switch (sort) {
      case 'floorDesc':
        rows.sort((a, b) => b.priceEth - a.priceEth);
        break;
      case 'floorAsc':
        rows.sort((a, b) => a.priceEth - b.priceEth);
        break;
      case 'tokenId':
        rows.sort((a, b) =>
          a.codeKey.localeCompare(b.codeKey, undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        );
        break;
      default:
        break;
    }
    return rows;
  }, [listings, sort]);

  const coverUrl = coverProp ?? listings[0]?.imageUrl;
  const itemCount = itemCountProp ?? listings.length;

  const priceRollup = useMemo(() => {
    if (!listings.length) return { floor: floorProp ?? 0, high: 0, avg: 0 };
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const r of listings) {
      const p = r.priceEth;
      sum += p;
      min = Math.min(min, p);
      max = Math.max(max, p);
    }
    const fallbackFloor = Number.isFinite(min) ? min : 0;
    const floor =
      typeof floorProp === 'number' && Number.isFinite(floorProp)
        ? floorProp
        : fallbackFloor;
    return {
      floor,
      high: Number.isFinite(max) ? max : 0,
      avg: listings.length ? sum / listings.length : 0,
    };
  }, [listings, floorProp]);

  const fmtEth = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—';

  const statRow = (label: string, valueMono: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-1.5 last:border-0 last:pb-0">
      <span className="text-[10px] text-textMuted shrink-0">{label}</span>
      <span className="text-[11px] font-mono font-semibold text-neon tabular-nums tracking-tight text-right min-w-0 truncate">
        {valueMono}
      </span>
    </div>
  );

  const sortChip = (
    key: GallerySort,
    label: string
  ) => {
    const on = sort === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => {
          Haptic.tap();
          setSort(key);
        }}
        className={`whitespace-nowrap shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
          on
            ? 'bg-neon/20 text-neon ring-1 ring-inset ring-neon/35'
            : 'bg-white/[0.04] text-textSubtle hover:text-textSecondary hover:bg-white/[0.06]'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="bg-background animate-fade-in min-h-screen">
      <div className="max-w-2xl w-full mx-auto">
        <PageHeader title={collectionName} onBack={onBack} />
      </div>

      {/* Premium Hero Header */}
      <div className="relative w-full overflow-hidden">
        {/* Background Layer: Blurry cover */}
        <div className="absolute inset-0 z-0">
          <img 
            src={coverUrl} 
            alt="" 
            className="w-full h-full object-cover blur-2xl scale-110 opacity-30 saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/60 to-background" />
        </div>

        {/* Content Layer */}
        <div className="relative z-10 px-4 pt-4 pb-8 flex flex-col items-center text-center">
          {/* Avatar with Glow */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-neon/20 blur-xl rounded-2xl scale-110 animate-pulse" />
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl bg-surface">
              <img 
                src={coverUrl} 
                alt={collectionName} 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight mb-2 drop-shadow-lg">
            {collectionName}
          </h1>
          
          <p className="text-[10px] font-mono text-textSubtle uppercase tracking-[0.2em] mb-8 opacity-70">
            {collectionSlug}
          </p>

          {/* Stats Row */}
          <div className="flex items-center gap-4 sm:gap-8 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-textSubtle uppercase tracking-widest font-bold mb-1">Floor</span>
              <span className="text-sm font-mono font-bold text-neon">{fmtEth(priceRollup.floor)} <span className="text-[10px] text-textMuted">ETH</span></span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-textSubtle uppercase tracking-widest font-bold mb-1">Items</span>
              <span className="text-sm font-mono font-bold text-white">{itemCount}</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-textSubtle uppercase tracking-widest font-bold mb-1">Highest</span>
              <span className="text-sm font-mono font-bold text-white">{fmtEth(priceRollup.high)} <span className="text-[10px] text-textMuted">ETH</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-2xl w-full mx-auto px-4 pt-4 space-y-5`}>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
          {sortChip('floorAsc', t('markets_nft_sort_floor_low'))}
          {sortChip('floorDesc', t('markets_nft_sort_floor_high'))}
          {sortChip('tokenId', t('markets_nft_sort_alpha'))}
        </div>

        {sortedListings.length === 0 ? (
          <p className="text-sm text-textMuted text-center py-14">{t('nothing_found')}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 pb-2">
            {sortedListings.map((row) => (
              <button
                key={`${row.codeKey}-${row.collectionSlug}`}
                type="button"
                onClick={() => {
                  Haptic.tap();
                  onOpenListing(row);
                }}
                aria-label={`${collectionName} ${row.codeDisplay}`}
                className="group rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.08] shadow-lg shadow-black/30 text-left active:scale-[0.97] transition-all hover:bg-white/[0.05] hover:border-white/[0.12] focus:outline-none"
              >
                <div className="aspect-[4/5] bg-black/40 relative overflow-hidden">
                  <img
                    src={row.imageUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Glassy overlay for details */}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] font-bold text-white/90 truncate drop-shadow-sm">
                      {row.codeDisplay}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-neon tabular-nums">
                        {row.priceEth.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      </span>
                      <span className="text-[8px] text-textMuted font-medium uppercase tracking-tighter">ETH</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Other NFTs */}
      <div className={`mt-8 border-t border-white/[0.05] bg-black/10 ${GALLERY_SCROLL_BOTTOM_PADDING}`}>
        <NftHorizontalStrip 
          title={t('nft_explore_others')}
          items={enrichNftListings(getAllNftListings().filter(n => n.collectionSlug !== collectionSlug), refPrices).slice(0, 15)}
          onItemClick={(item) => onOpenListing(item)}
        />
      </div>
    </div>
  );
};

export default NFTCollectionGalleryPage;
