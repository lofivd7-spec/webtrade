import React, { useEffect, useMemo, useState } from 'react';
import {
  getAllNftListings,
  listNftCollections,
  searchNftListingsByMarketQuery,
  type NftCollectionSummary,
  type NftListingRow,
} from '../lib/nftCatalog';
import { enrichNftListings, useNftReferrerPriceMap } from '../lib/nftReferrerPricing';
import { MARKET_ASSETS, STOCK_MARKET_ASSETS } from '../constants';
import { Asset, type NavigateToTradingOptions } from '../types';
import type { SpotHolding, StakingPosition, StakingRate } from '../types';
import { Search, Star, User, Headphones } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { usePin } from '../context/PinContext';
import { useUser } from '../context/UserContext';
import { useWebAuth } from '../context/WebAuthContext';
import { Haptic } from '../utils/haptics';
import { useLiveAssets } from '../utils/useLiveAssets';
import { useLiveStockAssets } from '../utils/useLiveStockAssets';
import Skeleton from '../components/Skeleton';
import { unstake } from '../lib/staking';
import { useToast } from '../context/ToastContext';
import BottomSheet from '../components/BottomSheet';
import BottomSheetFooter from '../components/BottomSheetFooter';
const MARKETS_PRIMARY_TAB_KEY = 'mexc_markets_primary_tab_v3';

type CryptoMarketsSort = 'list' | 'volume' | 'priceAsc' | 'priceDesc' | 'changeDesc' | 'changeAsc';
type NftMarketsSort = 'name' | 'floorDesc' | 'floorAsc' | 'itemsDesc' | 'notionalDesc';
type NftMarketLayout = 'collections' | 'catalog';

function marketsPickAvatarStage(asset: Asset): 'logo' | 'coincap' {
  return (asset.category ?? 'crypto') === 'stock' && asset.logoUrl ? 'logo' : 'coincap';
}

function MarketsPickAvatar({ asset }: { asset: Asset }) {
  const [stage, setStage] = useState<'logo' | 'coincap' | 'letter'>(() => marketsPickAvatarStage(asset));
  const isStock = (asset.category ?? 'crypto') === 'stock';

  useEffect(() => {
    setStage(marketsPickAvatarStage(asset));
  }, [asset.id]);

  if (stage === 'letter') {
    const initials = asset.ticker.replace(/[^A-Z0-9]/gi, '').slice(0, 2) || '?';
    return (
      <div className="h-7 w-7 shrink-0 rounded-md bg-white/[0.08] ring-1 ring-white/[0.08] flex items-center justify-center text-[9px] font-bold font-mono text-textPrimary">
        {initials}
      </div>
    );
  }

  const src =
    stage === 'logo' && asset.logoUrl
      ? asset.logoUrl
      : `https://assets.coincap.io/assets/icons/${asset.ticker.toLowerCase()}@2x.png`;

  return (
    <img
      src={src}
      alt=""
      className="h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-white/[0.08] bg-black/50"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (stage === 'logo' && isStock) setStage('coincap');
        else setStage('letter');
      }}
    />
  );
}

function cmpAssetPriceAsc(a: Asset, b: Asset): number {
  const ua = Boolean(a.priceUnavailable);
  const ub = Boolean(b.priceUnavailable);
  if (ua && ub) return a.ticker.localeCompare(b.ticker);
  if (ua) return 1;
  if (ub) return -1;
  return (a.price ?? 0) - (b.price ?? 0);
}

interface CoinsPageProps {
  onNavigateToTrading: (asset: Asset, options?: NavigateToTradingOptions) => void;
  onOpenNftCollection?: (collectionSlug: string) => void;
  onOpenNftListing?: (row: NftListingRow) => void;
  spotHoldings?: SpotHolding[];
  stakingPositions?: StakingPosition[];
  stakingRates?: StakingRate[];
  refreshSpotHoldings?: () => Promise<void>;
  refreshStaking?: () => Promise<void>;
  userId?: number;
  onReferralStake?: (ticker: string, amount: number) => void;
  onUnstakeModalChange?: (open: boolean) => void;
  onNavigate?: (page: any) => void;
}

const CoinsPage: React.FC<CoinsPageProps> = ({
  onNavigateToTrading,
  onOpenNftCollection,
  onOpenNftListing,
  spotHoldings = [],
  stakingPositions = [],
  stakingRates = [],
  refreshSpotHoldings = async () => {},
  refreshStaking = async () => {},
  userId = 0,
  onReferralStake,
  onUnstakeModalChange,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { symbol, formatPrice, rates, currencyCode } = useCurrency();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [cryptoSort, setCryptoSort] = useState<CryptoMarketsSort>('list');
  const [nftSort, setNftSort] = useState<NftMarketsSort>('name');
  const [nftMarketLayout, setNftMarketLayout] = useState<NftMarketLayout>('collections');
  const [primaryTab, setPrimaryTab] = useState<'favorites' | 'crypto' | 'stocks' | 'nft'>(() => {
    try {
      const v = localStorage.getItem(MARKETS_PRIMARY_TAB_KEY);
      if (v === 'favorites' || v === 'crypto' || v === 'stocks' || v === 'nft') return v;
    } catch {
      /* ignore */
    }
    return 'favorites';
  });
  const [unstakeTicker, setUnstakeTicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { requirePin } = usePin();
  const { tgid } = useUser();
  const { webUserId } = useWebAuth();
  const pinUserId = String(tgid ?? webUserId ?? '');
  const rubPerUsd = rates?.usd?.rub ?? null;

  useEffect(() => {
    try {
      localStorage.setItem(MARKETS_PRIMARY_TAB_KEY, primaryTab);
    } catch {
      /* ignore */
    }
  }, [primaryTab]);

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('mexc_favorites_v1');
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set((arr || []).filter(Boolean));
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = (ticker: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      try {
        localStorage.setItem('mexc_favorites_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    onUnstakeModalChange?.(!!unstakeTicker);
    return () => onUnstakeModalChange?.(false);
  }, [unstakeTicker, onUnstakeModalChange]);

  const liveCrypto = useLiveAssets(MARKET_ASSETS);
  const liveStocks = useLiveStockAssets(STOCK_MARKET_ASSETS, { rubPerUsd });
  const rateByTicker = useMemo(() => {
    const m: Record<string, StakingRate> = {};
    stakingRates.forEach((r) => { m[r.ticker] = r; });
    return m;
  }, [stakingRates]);

  const spotByTicker = useMemo(() => {
    const m: Record<string, SpotHolding> = {};
    spotHoldings.forEach((h) => { m[h.ticker] = h; });
    return m;
  }, [spotHoldings]);

  const refNftPrices = useNftReferrerPriceMap();
  const nftCollections = useMemo<NftCollectionSummary[]>(
    () => listNftCollections(refNftPrices),
    [refNftPrices]
  );
  const nftMarketHits = useMemo(
    () => enrichNftListings(searchNftListingsByMarketQuery(searchQuery.trim()), refNftPrices),
    [searchQuery, refNftPrices]
  );

  const filteredNftCollections = useMemo(() => {
    let base = nftCollections;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const hitSlugs = new Set(searchNftListingsByMarketQuery(searchQuery.trim()).map((r) => r.collectionSlug));
      base = nftCollections.filter(
        (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || hitSlugs.has(c.slug)
      );
    }
    const list = [...base];
    switch (nftSort) {
      case 'floorDesc':
        list.sort((a, b) => b.floorEth - a.floorEth);
        break;
      case 'floorAsc':
        list.sort((a, b) => a.floorEth - b.floorEth);
        break;
      case 'itemsDesc':
        list.sort((a, b) => b.itemCount - a.itemCount);
        break;
      case 'notionalDesc':
        list.sort((a, b) => b.floorEth * b.itemCount - a.floorEth * a.itemCount);
        break;
      default:
        list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [nftCollections, searchQuery, nftSort]);

  const catalogListingRows = useMemo(() => {
    const q = searchQuery.trim();
    const raw = q ? searchNftListingsByMarketQuery(q) : getAllNftListings();
    return enrichNftListings(raw, refNftPrices);
  }, [searchQuery, refNftPrices]);

  const catalogSortedListings = useMemo(() => {
    const list = [...catalogListingRows];
    const countBySlug = (slug: string) => nftCollections.find((c) => c.slug === slug)?.itemCount ?? 0;
    switch (nftSort) {
      case 'floorDesc':
        list.sort((a, b) => b.priceEth - a.priceEth);
        break;
      case 'floorAsc':
        list.sort((a, b) => a.priceEth - b.priceEth);
        break;
      case 'itemsDesc':
        list.sort((a, b) => countBySlug(b.collectionSlug) - countBySlug(a.collectionSlug));
        break;
      case 'notionalDesc':
        list.sort(
          (a, b) =>
            b.priceEth * countBySlug(b.collectionSlug) - a.priceEth * countBySlug(a.collectionSlug)
        );
        break;
      default:
        list.sort((a, b) =>
          `${a.collectionName} ${a.codeKey}`.localeCompare(`${b.collectionName} ${b.codeKey}`)
        );
    }
    return list;
  }, [catalogListingRows, nftSort, nftCollections]);

  const nftHasResults =
    nftMarketLayout === 'catalog'
      ? catalogSortedListings.length > 0
      : filteredNftCollections.length > 0 || (Boolean(searchQuery.trim()) && nftMarketHits.length > 0);

  const cryptoSortChips = useMemo(
    () =>
      [
        { key: 'list' as const, label: t('markets_sort_list') },
        { key: 'volume' as const, label: t('markets_sort_volume') },
        { key: 'priceAsc' as const, label: t('markets_sort_price_low') },
        { key: 'priceDesc' as const, label: t('markets_sort_price_high') },
        { key: 'changeDesc' as const, label: t('markets_sort_gainers') },
        { key: 'changeAsc' as const, label: t('markets_sort_losers') },
      ] satisfies { key: CryptoMarketsSort; label: string }[],
    [t]
  );

  const nftSortChips = useMemo(
    () =>
      [
        { key: 'name' as const, label: t('markets_nft_sort_alpha') },
        { key: 'floorDesc' as const, label: t('markets_nft_sort_floor_high') },
        { key: 'floorAsc' as const, label: t('markets_nft_sort_floor_low') },
        { key: 'itemsDesc' as const, label: t('markets_nft_sort_supply') },
        { key: 'notionalDesc' as const, label: t('markets_nft_sort_notional') },
      ] satisfies { key: NftMarketsSort; label: string }[],
    [t]
  );

  const filteredAssets = useMemo(() => {
    if (primaryTab === 'nft') return [];

    let base: Asset[] =
      primaryTab === 'crypto'
        ? liveCrypto
        : primaryTab === 'stocks'
          ? liveStocks
          : [...liveCrypto, ...liveStocks];

    if (primaryTab === 'favorites') {
      base = base.filter((a) => favorites.has(a.ticker));
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      base = base.filter((a) => {
        const tag = (a.tagline ?? '').toLowerCase();
        return (
          a.ticker.toLowerCase().includes(lowerQuery) ||
          a.name.toLowerCase().includes(lowerQuery) ||
          (tag && tag.includes(lowerQuery))
        );
      });
    }

    const sorted = [...base].sort((a, b) => {
      switch (cryptoSort) {
        case 'volume':
          return (b.volume24h ?? 0) - (a.volume24h ?? 0);
        case 'priceAsc':
          return cmpAssetPriceAsc(a, b);
        case 'priceDesc':
          return cmpAssetPriceAsc(b, a);
        case 'changeDesc':
          return (b.change24h ?? 0) - (a.change24h ?? 0);
        case 'changeAsc':
          return (a.change24h ?? 0) - (b.change24h ?? 0);
        default:
          return 0;
      }
    });

    return sorted;
  }, [searchQuery, liveCrypto, liveStocks, cryptoSort, primaryTab, favorites]);

  const listSourceEmpty =
    primaryTab === 'crypto'
      ? liveCrypto.length === 0
      : primaryTab === 'stocks'
        ? liveStocks.length === 0
        : primaryTab === 'favorites'
          ? liveCrypto.length === 0 && liveStocks.length === 0
          : false;

  const formatVolCompact = (volRub: number) => {
    const v = Math.max(0, volRub);
    if (v >= 1e9) return `${(v / 1e9).toFixed(3)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(3)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(3)}K`;
    return `${v.toFixed(0)}`;
  };

  const topStocksPick = useMemo(
    () => [...liveStocks].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 4),
    [liveStocks]
  );
  const topCryptoPick = useMemo(
    () => [...liveCrypto].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 4),
    [liveCrypto]
  );
  const favoritesNftTopPicks = useMemo(() => {
    const list = enrichNftListings(getAllNftListings(), refNftPrices);
    return [...list].sort((a, b) => b.priceEth - a.priceEth).slice(0, 10);
  }, [refNftPrices]);

  const openPickAsset = (asset: Asset) => {
    Haptic.tap();
    const cat = asset.category ?? 'crypto';
    const isListedNft = cat === 'nft';
    const nonCrypto = cat !== 'crypto' && !isListedNft;
    const forced = isListedNft
      ? ({ tradeType: 'spot' as const, spotAction: 'buy' as const })
      : nonCrypto
        ? { tradeType: 'futures' as const }
        : { tradeType: 'spot' as const };
    onNavigateToTrading(asset, forced);
  };

  const handleUnstake = async (ticker: string) => {
    if (userId <= 0) return;
    const asset = liveCrypto.find((a) => a.ticker === ticker);
    const priceRub = asset?.price ?? 0;
    if (priceRub <= 0) {
      toast.show(t('price_unknown'), 'error');
      return;
    }
    setLoading(true);
    const res = await unstake(userId, ticker, priceRub);
    setLoading(false);
    setUnstakeTicker(null);
    if (res.ok) {
      await refreshStaking();
      toast.show(t('unstake_btn'), 'success');
      Haptic.success();
    } else {
      toast.show(res.error || t('error_generic'), 'error');
      Haptic.error();
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in relative">
      <header
        className={[
          'sticky top-0 z-40 transition-transform duration-200',
          'bg-background',
          'hairline-bottom',
        ].join(' ')}
      >
        {/* Combined search and tabs */}
        <div className="px-4 lg:px-6 pt-3 pb-2 max-w-2xl w-full mx-auto">
          {/* Search input */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => { Haptic.tap(); onNavigate?.('PROFILE'); }}
              className="h-8 w-8 rounded-full bg-surface/60 flex items-center justify-center text-textSecondary active:scale-95 transition-transform"
            >
              <User size={16} />
            </button>
            <div className="flex-1 relative">
              <div className="w-full h-8 rounded-2xl bg-surface/60 flex items-center gap-2 px-3 transition-transform">
                <Search size={16} className="text-textSubtle shrink-0" />
                <input
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder={primaryTab === 'nft' ? t('markets_nft_search_placeholder') : t('search_pair')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => Haptic.tap()}
                  className="bg-transparent outline-none text-sm text-textPrimary placeholder:text-textSubtle w-full min-w-0 font-normal"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-textSubtle hover:text-textPrimary transition-colors"
                  >
                    <span className="text-[18px]">×</span>
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { Haptic.tap(); onNavigate?.('SUPPORT'); }}
              className="h-8 w-8 rounded-full bg-surface/60 flex items-center justify-center text-textSecondary active:scale-95 transition-transform"
            >
              <Headphones size={16} />
            </button>
          </div>

          {/* Primary tabs with pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(
              [
                ['favorites', t('markets_tab_favorites')],
                ['crypto', t('markets_tab_crypto')],
                ['stocks', t('markets_tab_stocks')],
                ['nft', t('markets_tab_nft')],
              ] as const
            ).map(([id, label]) => {
              const active = primaryTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    Haptic.tap();
                    setPrimaryTab(id);
                  }}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    active
                      ? 'bg-neon/10 text-neon border border-neon/20'
                      : 'text-textSubtle hover:text-textSecondary hover:bg-white/[0.04]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort chips - compact horizontal scroll */}
        <div className="px-4 lg:px-6 max-w-2xl w-full mx-auto pb-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(primaryTab === 'crypto' || primaryTab === 'favorites' || primaryTab === 'stocks'
              ? cryptoSortChips
              : nftSortChips
            ).map((chip) => {
              const active = (primaryTab === 'crypto' || primaryTab === 'favorites' || primaryTab === 'stocks')
                ? cryptoSort === chip.key
                : nftSort === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    Haptic.tap();
                    if (primaryTab === 'crypto' || primaryTab === 'favorites' || primaryTab === 'stocks') {
                      setCryptoSort(chip.key as CryptoMarketsSort);
                    } else {
                      setNftSort(chip.key as NftMarketsSort);
                    }
                  }}
                  className={`whitespace-nowrap shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    active
                      ? 'bg-white/[0.08] text-textPrimary border border-white/[0.08]'
                      : 'text-textSubtle hover:text-textSecondary hover:bg-white/[0.04]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table header - more compact */}
        <div className="px-4 lg:px-6 max-w-2xl w-full mx-auto pb-2 pt-1">
          <div className="grid grid-cols-12 gap-2 text-[11px] text-textMuted font-medium">
            {primaryTab === 'nft' ? (
              <>
                <div className="col-span-5">{t('markets_table_nft_pair')}</div>
                <div className="col-span-4 text-right">{t('markets_table_nft_last')}</div>
                <div className="col-span-3 text-right font-mono">{t('nft_table_hint_eth')}</div>
              </>
            ) : (
              <>
                <div className="col-span-5">{t('markets_table_pair_vol')}</div>
                <div className="col-span-4 text-right">{t('markets_table_last_price')}</div>
                <div className="col-span-3 text-right">{t('markets_table_change')}</div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 pb-56 pt-2 min-h-screen max-w-2xl w-full mx-auto">
        {primaryTab === 'nft' ? (
          nftHasResults ? (
            <div className="flex flex-col">
              <div className="mb-2 flex w-full rounded-lg bg-black/25 p-[3px]" role="tablist" aria-label={t('markets_nft_layout_label')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={nftMarketLayout === 'collections'}
                  onClick={() => {
                    Haptic.tap();
                    setNftMarketLayout('collections');
                  }}
                  className={`min-w-0 flex-1 rounded-md py-1 px-1.5 text-center text-[11px] font-medium transition-colors truncate ${
                    nftMarketLayout === 'collections'
                      ? 'bg-white/[0.08] text-textPrimary shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                      : 'text-textSubtle hover:text-textSecondary'
                  }`}
                >
                  {t('markets_nft_layout_collections')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={nftMarketLayout === 'catalog'}
                  onClick={() => {
                    Haptic.tap();
                    setNftMarketLayout('catalog');
                  }}
                  className={`min-w-0 flex-1 rounded-md py-1 px-1.5 text-center text-[11px] font-medium transition-colors truncate ${
                    nftMarketLayout === 'catalog'
                      ? 'bg-white/[0.08] text-textPrimary shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                      : 'text-textSubtle hover:text-textSecondary'
                  }`}
                >
                  {t('markets_nft_layout_catalog')}
                </button>
              </div>

              {nftMarketLayout === 'catalog' ? (
                <div className="grid grid-cols-3 gap-2">
                  {catalogSortedListings.map((hit) => (
                    <button
                      key={`${hit.collectionSlug}-${hit.codeKey}`}
                      type="button"
                      onClick={() => {
                        Haptic.tap();
                        onOpenNftListing?.(hit);
                      }}
                      className="rounded-xl overflow-hidden bg-white/[0.03] ring-1 ring-white/[0.08] text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="aspect-square bg-black/40">
                        <img src={hit.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <div className="p-1.5 min-w-0">
                        <div className="text-[8px] text-textMuted truncate leading-tight">{hit.collectionName}</div>
                        <div className="font-mono text-[11px] font-bold text-textPrimary truncate">{hit.codeDisplay}</div>
                        <div className="text-[10px] font-mono text-neon tabular-nums mt-0.5">
                          {hit.priceEth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          <span className="text-textMuted font-normal"> ETH</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {searchQuery.trim() && nftMarketHits.length > 0 ? (
                    <div className="mb-3 rounded-xl overflow-hidden bg-white/[0.03] ring-1 ring-white/[0.08] divide-y divide-white/[0.06]">
                      {nftMarketHits.map((hit) => (
                        <button
                          key={`hit-${hit.collectionSlug}-${hit.codeKey}`}
                          type="button"
                          onClick={() => {
                            Haptic.tap();
                            onOpenNftListing?.(hit);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-white/[0.06] transition-colors"
                        >
                          <div className="h-10 w-10 rounded-lg overflow-hidden bg-black/40 shrink-0 ring-1 ring-white/10">
                            <img src={hit.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] text-textMuted truncate">{hit.collectionName}</div>
                            <div className="font-mono text-[14px] font-bold text-textPrimary">{hit.codeDisplay}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-textMuted">ETH</div>
                            <div className="text-[12px] font-mono font-semibold text-neon tabular-nums">
                              {hit.priceEth.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {filteredNftCollections.map((col, idx) => (
                    <div
                      key={col.slug}
                      className={['py-2', idx === 0 ? '' : 'hairline-top'].join(' ')}
                    >
                      <button
                        type="button"
                        className="w-full grid grid-cols-12 gap-2 items-center text-left active:scale-[0.99] transition-transform outline-none focus-visible:ring-2 focus-visible:ring-neon/25 rounded-xl"
                        onClick={() => {
                          Haptic.tap();
                          onOpenNftCollection?.(col.slug);
                        }}
                      >
                        <div className="col-span-5 min-w-0 flex items-center gap-2">
                          <div className="h-11 w-11 rounded-xl overflow-hidden bg-black/40 ring-1 ring-white/[0.08] shrink-0">
                            <img src={col.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-bold text-textPrimary truncate">{col.name}</div>
                            <div className="text-[11px] text-textSubtle mt-0.5">
                              {col.itemCount} {t('nft_items')}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-4 text-right font-mono text-[14px] font-bold text-neon tabular-nums">
                          {col.floorEth.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </div>
                        <div className="col-span-3 text-right font-mono text-[11px] text-textMuted">ETH</div>
                      </button>
                    </div>
                  ))}
                </>
              )}
              <div className="h-24" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-600 space-y-2">
              <Search size={32} className="opacity-20" />
              <span className="text-sm font-mono">{t('nothing_found_for', { query: searchQuery })}</span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-neutral-400 hover:text-neon underline underline-offset-2"
              >
                {t('clear_search')}
              </button>
            </div>
          )
        ) : listSourceEmpty ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                className="w-full h-14 rounded-lg bg-card/60"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            {primaryTab === 'favorites' && !searchQuery.trim() ? (
              <div className="mb-3 rounded-xl overflow-hidden bg-black/25 ring-1 ring-white/[0.06]">
                <div className="px-3 pt-2 pb-2 border-b border-white/[0.05]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-textPrimary leading-tight truncate">
                      {t('markets_favorites_picks_title')}
                    </p>
                    <span className="shrink-0 text-[8px] uppercase tracking-wide text-textMuted font-semibold">
                      {t('markets_favorites_picks_kicker')}
                    </span>
                  </div>
                  <p className="text-[10px] text-textSubtle mt-0.5 leading-snug line-clamp-2">
                    {t('markets_favorites_picks_subtitle')}
                  </p>
                </div>
                <div className="px-2 py-2 space-y-2.5">
                  <div>
                    <p className="text-[9px] uppercase tracking-wide text-textMuted font-semibold mb-1 px-0.5">
                      {t('markets_favorites_section_stocks')}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {topStocksPick.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => openPickAsset(asset)}
                          className="flex items-center gap-1.5 text-left rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.99] transition-colors"
                        >
                          <MarketsPickAvatar asset={asset} />
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[12px] font-bold text-textPrimary leading-none truncate">
                              {asset.ticker}
                            </div>
                            <div className="text-[8px] text-textMuted truncate leading-tight mt-0.5">{asset.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wide text-textMuted font-semibold mb-1 px-0.5">
                      {t('markets_favorites_section_crypto')}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {topCryptoPick.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => openPickAsset(asset)}
                          className="flex items-center gap-1.5 text-left rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.99] transition-colors"
                        >
                          <MarketsPickAvatar asset={asset} />
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[12px] font-bold text-textPrimary leading-none truncate">
                              {asset.ticker}
                            </div>
                            <div className="text-[8px] text-textMuted truncate leading-tight mt-0.5">{asset.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {favoritesNftTopPicks.length > 0 ? (
                    <div>
                      <p className="text-[9px] uppercase tracking-wide text-textMuted font-semibold mb-1 px-0.5">
                        {t('markets_favorites_section_nft')}
                      </p>
                      <div className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory pb-0.5 -mx-0.5 px-0.5 no-scrollbar scroll-smooth">
                        {favoritesNftTopPicks.map((hit) => (
                          <button
                            key={`pick-${hit.collectionSlug}-${hit.codeKey}`}
                            type="button"
                            onClick={() => {
                              Haptic.tap();
                              onOpenNftListing?.(hit);
                            }}
                            className="snap-start shrink-0 w-[32%] max-w-[104px] text-left rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-white/10 active:scale-[0.99] transition-colors"
                          >
                            <div className="aspect-square bg-black/40">
                              <img src={hit.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            </div>
                            <div className="px-1 py-1 min-w-0">
                              <div className="text-[7px] text-textMuted truncate leading-tight">{hit.collectionName}</div>
                              <div className="font-mono text-[10px] font-bold text-textPrimary truncate leading-tight">
                                {hit.codeDisplay}
                              </div>
                              <div className="text-[9px] font-mono text-neon tabular-nums leading-none mt-0.5">
                                {hit.priceEth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                <span className="text-textMuted font-normal"> ETH</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {primaryTab === 'favorites' && !searchQuery.trim() && filteredAssets.length > 0 ? (
              <div className="mb-2 flex items-center gap-1.5 px-0.5">
                <Star size={12} className="text-amber-400/90 shrink-0" fill="currentColor" aria-hidden />
                <span className="text-[9px] uppercase tracking-wide text-textMuted font-semibold">
                  {t('markets_favorites_yours_heading')}
                </span>
              </div>
            ) : null}

            {filteredAssets.length > 0 ? (
              <>
            {filteredAssets.map((asset, idx) => {
              const change = asset.change24h ?? 0;
              const isUp = change >= 0;
              const pairQuote = currencyCode;
              const volText = formatVolCompact(asset.volume24h ?? 0);
              const subRowText =
                (asset.category ?? 'crypto') === 'stock' && asset.tagline ? asset.tagline : volText;
              const priceText = asset.priceUnavailable
                ? '—'
                : formatPrice(asset.price, { fractionDigits: asset.price < 1 ? 8 : asset.price < 100 ? 4 : 2 });
              const badgeClass = isUp ? 'bg-up text-black' : 'bg-down text-black';
              const fav = favorites.has(asset.ticker);
              return (
                <div
                  key={asset.id}
                  className={['py-2', idx === 0 ? '' : 'hairline-top'].join(' ')}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      Haptic.tap();
                      const cat = asset.category ?? 'crypto';
                      const isListedNft = cat === 'nft';
                      const forced = isListedNft
                        ? ({ tradeType: 'spot' as const, spotAction: 'buy' as const })
                        : { tradeType: 'futures' as const };
                      onNavigateToTrading(asset, forced);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        Haptic.tap();
                        const cat = asset.category ?? 'crypto';
                        const isListedNft = cat === 'nft';
                        const forced = isListedNft
                          ? ({ tradeType: 'spot' as const, spotAction: 'buy' as const })
                          : { tradeType: 'futures' as const };
                        onNavigateToTrading(asset, forced);
                      }
                    }}
                    className="w-full grid grid-cols-12 gap-2 items-center text-left active:scale-[0.99] transition-transform outline-none focus-visible:ring-2 focus-visible:ring-neon/25 rounded-xl"
                    aria-label={`${asset.ticker} ${t('price')}`}
                  >
                    <div className="col-span-5 min-w-0 flex items-center gap-2.5">
                      {(asset.category ?? 'crypto') === 'stock' && asset.logoUrl ? (
                        <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-black/40 ring-1 ring-white/[0.1]">
                          <img
                            src={asset.logoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-bold text-textPrimary font-mono truncate">{asset.ticker}</span>
                          <span className="text-[12px] text-textSubtle font-mono shrink-0">/{pairQuote}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              Haptic.tap();
                              toggleFavorite(asset.ticker);
                            }}
                            className="ml-1 h-7 w-7 rounded-lg flex items-center justify-center text-textSubtle active:scale-[0.98] transition-transform"
                            aria-label={t('favorite')}
                          >
                            <Star size={16} className={fav ? 'text-amber-400 fill-amber-400' : 'text-textSubtle'} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-4 text-right">
                      <div className={`text-[16px] font-mono font-bold ${isUp ? 'text-up' : 'text-down'}`}>
                        {priceText}
                      </div>
                    </div>

                    <div className="col-span-3 flex justify-end">
                      <div className={`min-w-[76px] h-8 px-3 rounded-lg ${badgeClass} flex items-center justify-center font-mono font-bold text-[13px]`}>
                        {isUp ? '+' : ''}{change.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="h-24" />
              </>
            ) : primaryTab === 'favorites' && !searchQuery.trim() ? (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center rounded-2xl ring-1 ring-white/[0.06] bg-white/[0.02]">
                <Star size={36} className="text-textMuted opacity-35 mb-3" />
                <p className="text-sm text-textSubtle leading-relaxed max-w-xs">{t('markets_favorites_empty_hint')}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-600 space-y-2">
                <Search size={32} className="opacity-20" />
                <span className="text-sm font-mono">
                  {t('nothing_found_for', { query: searchQuery })}
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs text-neutral-400 hover:text-neon underline underline-offset-2"
                >
                  {t('clear_search')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модалка вывода из стейкинга */}
      {unstakeTicker != null && (() => {
        const pos = stakingPositions.find((p) => p.ticker === unstakeTicker);
        const asset = liveCrypto.find((a) => a.ticker === unstakeTicker);
        const price = asset?.price ?? 0;
        const amount = pos?.amount ?? 0;
        const amountRub = price * amount;
        return (
          <BottomSheet
            open
            onClose={() => setUnstakeTicker(null)}
            title={t('unstake_modal_title')}
            closeOnBackdrop
          >
            <p className="text-xs text-textMuted mb-3">
              {unstakeTicker} · {t('unstake_you_receive')}:
            </p>
            <div className="rounded-xl bg-surface border border-border p-3 mb-4">
              <p className="text-lg font-mono font-bold text-neon">
                {amount.toFixed(8)} {unstakeTicker}
              </p>
              <p className="text-xs text-textMuted mt-0.5">
                {asset?.priceUnavailable ? '—' : price > 0 ? `≈ ${amountRub.toFixed(0)} ${symbol}` : ''}
              </p>
            </div>
            <p className="text-xs text-textMuted mb-4">
              {t('unstake_principal_only')}
            </p>
            <BottomSheetFooter
              onCancel={() => {
                Haptic.tap();
                setUnstakeTicker(null);
              }}
              onConfirm={() => {
                if (pinUserId) {
                  requirePin(pinUserId, t('enter_pin_for_confirm'), () => handleUnstake(unstakeTicker));
                } else {
                  handleUnstake(unstakeTicker);
                }
              }}
              confirmLabel={t('confirm')}
              confirmLoading={loading}
              variant="destructive"
            />
          </BottomSheet>
        );
      })()}
    </div>
  );
};

export default CoinsPage;
