import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { fetchAssetPricesInRub } from '../lib/cryptoPrices';
import { getNftListingsForCollection, nftListingToAsset, nftTickerForListing, type NftListingRow } from '../lib/nftCatalog';
import { enrichNftListingRow, useNftReferrerPriceMap } from '../lib/nftReferrerPricing';
import { withNftDisplayWobbleRub } from '../utils/nftPriceWobble';
import type { Asset } from '../types';
import { Haptic } from '../utils/haptics';
import {
  APP_TOP_BAR_CLASS,
  APP_TOP_BAR_ROW,
  APP_TOP_BAR_STYLE,
} from '../components/appTopBar';
import NftHorizontalStrip from '../components/NftHorizontalStrip';

interface NFTDetailPageProps {
  listing: NftListingRow;
  onBack: () => void;
  onTrade: (asset: Asset) => void;
}

type BookRow = { price: number; size: number };

function buildOrderBook(midRub: number): { asks: BookRow[]; bids: BookRow[] } {
  if (!Number.isFinite(midRub) || midRub <= 0) return { asks: [], bids: [] };
  const rel = 0.00045;
  const asks: BookRow[] = Array.from({ length: 7 }, (_, i) => ({
    price: midRub * (1 + rel * (i + 1)),
    size: parseFloat((0.018 + ((i * 7 + 11) % 10) * 0.006).toFixed(3)),
  })).reverse();
  const bids: BookRow[] = Array.from({ length: 7 }, (_, i) => ({
    price: midRub * (1 - rel * (i + 1)),
    size: parseFloat((0.022 + ((i * 5 + 13) % 10) * 0.005).toFixed(3)),
  }));
  return { asks, bids };
}

const NFTDetailPage: React.FC<NFTDetailPageProps> = ({ listing, onBack, onTrade }) => {
  const { t } = useLanguage();
  const { formatPrice, currencyCode } = useCurrency();
  const refPrices = useNftReferrerPriceMap();
  const [display, setDisplay] = useState(listing);
  const pricedRow = useMemo(() => enrichNftListingRow(display, refPrices), [display, refPrices]);

  useEffect(() => {
    setDisplay(listing);
  }, [listing.collectionSlug, listing.codeKey, listing.imageUrl]);

  const siblings = useMemo(
    () => getNftListingsForCollection(display.collectionSlug),
    [display.collectionSlug]
  );
  const index = siblings.findIndex((s) => s.codeKey === display.codeKey);

  const [ethRubSpot, setEthRubSpot] = useState(0);
  /** Перерисовка «живого» дрейфа цены NFT на карточке */
  const [wobblePulse, setWobblePulse] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prices = await fetchAssetPricesInRub(['ETH']);
        const ethRub = prices.ETH?.price ?? 0;
        if (cancelled) return;
        setEthRubSpot(ethRub > 0 ? ethRub : 0);
      } catch {
        if (!cancelled) setEthRubSpot(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pricedRow.priceEth]);

  useEffect(() => {
    const id = window.setInterval(() => setWobblePulse((p) => p + 1), 1600);
    return () => clearInterval(id);
  }, []);

  const nftSpotTicker = useMemo(() => nftTickerForListing(pricedRow), [pricedRow.collectionSlug, pricedRow.codeKey]);
  const baselineRub =
    ethRubSpot > 0 ? pricedRow.priceEth * ethRubSpot : Math.max(pricedRow.priceEth * 320_000, 1);
  const priceRub = useMemo(() => {
    void wobblePulse;
    return withNftDisplayWobbleRub(Math.max(baselineRub, 1), nftSpotTicker, Date.now());
  }, [baselineRub, nftSpotTicker, wobblePulse]);

  const midRub = priceRub;
  const [book, setBook] = useState(() => buildOrderBook(midRub));

  const refreshBook = useCallback(() => {
    setBook(buildOrderBook(midRub));
  }, [midRub]);

  useEffect(() => {
    refreshBook();
    const id = window.setInterval(refreshBook, 1800);
    return () => clearInterval(id);
  }, [refreshBook]);

  const goSibling = (dir: -1 | 1) => {
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= siblings.length) return;
    Haptic.tap();
    setDisplay(siblings[nextIdx]!);
  };

  const assetReady = nftListingToAsset(pricedRow, Math.max(priceRub, midRub, 1));

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background animate-fade-in relative overflow-x-hidden">
      {/* Компактная шапка в стиле биржи */}
      <header className={`${APP_TOP_BAR_CLASS} z-[35]`} style={APP_TOP_BAR_STYLE}>
        <div className={`${APP_TOP_BAR_ROW} max-w-2xl mx-auto`}>
          <button
            type="button"
            onClick={() => {
              Haptic.tap();
              onBack();
            }}
            className="touch-target shrink-0 p-2 -ml-2 rounded-xl text-textMuted hover:text-textPrimary hover:bg-card active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={20} strokeWidth={1.75} />
          </button>
          <div className="flex-1 min-w-0 text-center px-2">
            <div className="text-[13px] font-semibold text-textPrimary truncate">{display.collectionName}</div>
            <div className="text-[12px] font-mono font-bold text-neon tabular-nums">{display.codeDisplay}</div>
          </div>
          <div className="w-10 shrink-0" aria-hidden />
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto no-scrollbar pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] max-w-2xl w-full mx-auto"
      >
        <div className="px-4 pt-2">
          <div className="rounded-xl overflow-hidden bg-black/30 mx-auto max-h-[38vh] sm:max-h-[42vh]">
            <div className="aspect-[1] max-h-[38vh] sm:max-h-[42vh] bg-black/45 relative mx-auto">
              <img
                key={display.codeKey}
                src={display.imageUrl}
                alt=""
                className="w-full h-full object-contain"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

        </div>

        <div className="px-4 mt-4 space-y-3">
          <div className="flex items-center gap-2 sm:gap-3 pt-0.5 pb-3 border-b border-white/[0.06]">
            <div className="flex flex-1 min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] text-textMuted uppercase tracking-wider font-semibold">{t('nft_list_price_eth')}</div>
                <div className="text-base sm:text-lg font-mono font-bold text-textPrimary leading-tight truncate">
                  {pricedRow.priceEth.toLocaleString('en-US', { maximumFractionDigits: 4 })} ETH
                </div>
              </div>
              <div className="text-right min-w-0 shrink">
                <div className="text-[10px] text-textMuted uppercase tracking-wider font-semibold">{t('markets_table_last_price')}</div>
                <div className="text-sm font-mono font-bold text-neon truncate">{priceRub > 0 ? formatPrice(priceRub) : '—'}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                Haptic.medium();
                onTrade(assetReady);
              }}
              className="shrink-0 h-11 px-4 sm:px-6 rounded-xl bg-neon text-black text-[13px] font-bold active:scale-[0.97] transition-transform whitespace-nowrap"
            >
              {t('nft_trade_cta')}
            </button>
          </div>

          {/* Стакан на полную ширину экрана */}
          <div className="relative left-1/2 -translate-x-1/2 w-screen max-w-[100vw] border-t border-b border-white/[0.06] bg-background/40">
            <div className="flex justify-between px-4 pt-2.5 pb-1 text-[10px] text-textMuted uppercase tracking-wider font-semibold">
              <span>{t('order_book_price')}</span>
              <span>{t('order_book_size')} (ETH)</span>
            </div>
            <div className="flex flex-col-reverse max-h-[140px] overflow-hidden py-0.5">
              {book.asks.map((ask, i) => (
                <div key={`a-${i}`} className="flex justify-between px-4 py-[2px] relative">
                  <span className="text-[10px] font-mono text-red-400/95 relative z-10">{formatPrice(ask.price)}</span>
                  <span className="text-[10px] font-mono text-textMuted relative z-10 tabular-nums">{ask.size.toFixed(3)}</span>
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-red-500/10 z-0 rounded-sm"
                    style={{ width: `${28 + (i * 9) % 44}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="py-2 flex flex-col items-center bg-black/20">
              <span className="text-sm font-mono font-bold text-textPrimary">{formatPrice(midRub)}</span>
              <span className="text-[8px] text-textMuted uppercase">{currencyCode}</span>
            </div>
            <div className="flex flex-col max-h-[140px] overflow-hidden py-0.5">
              {book.bids.map((bid, i) => (
                <div key={`b-${i}`} className="flex justify-between px-4 py-[2px] relative">
                  <span className="text-[10px] font-mono text-green-400 relative z-10">{formatPrice(bid.price)}</span>
                  <span className="text-[10px] font-mono text-textMuted relative z-10 tabular-nums">{bid.size.toFixed(3)}</span>
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 z-0 rounded-sm"
                    style={{ width: `${30 + (i * 11) % 42}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="py-2 flex justify-center text-textMuted/70">
              <ChevronDown size={14} />
            </div>
          </div>

          <p className="text-[10px] text-textMuted leading-relaxed px-0.5 pb-4">{t('nft_spot_disclaimer')}</p>
        </div>

        <div className="mt-4 border-t border-white/[0.05] bg-black/10">
          <NftHorizontalStrip 
            title={t('nft_more_from_collection') || "More from this collection"}
            items={siblings}
            activeCodeKey={display.codeKey}
            onItemClick={(item) => {
              setDisplay(item);
              // Scroll to top when switching
              const container = document.querySelector('.overflow-y-auto');
              if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default NFTDetailPage;
