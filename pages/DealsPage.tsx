import React, { useMemo, useState, useEffect } from 'react';
import { Deal } from '../types';
import type { SpotHolding, StakingPosition, ActivityHistoryItem, Asset, NavigateToTradingOptions } from '../types';
import {
  TrendingUp,
  Wallet,
  History,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  ArrowUpRight as ArrowUpRightIcon,
  Sparkles,
  Coins,
} from 'lucide-react';
import Skeleton from '../components/Skeleton';
import { Haptic } from '../utils/haptics';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { MARKET_ASSETS } from '../constants';
import { fetchAssetPricesInUsd } from '../lib/cryptoPrices';
import { useLiveAssets } from '../utils/useLiveAssets';
import { withNftDisplayWobbleUsd } from '../utils/nftPriceWobble';
import { enrichNftListingRow, useNftReferrerPriceMap, useNftMarketJitter } from '../lib/nftReferrerPricing';
import { fetchActivityHistory } from '../lib/activityHistory';
import {
  getAllNftListings,
  nftListingToAsset,
  nftTickerForListing,
  type NftListingRow,
} from '../lib/nftCatalog';

interface DealsPageProps {
  deals: Deal[];
  balance: number;
  balanceLoading?: boolean;
  spotHoldings: SpotHolding[];
  stakingPositions?: StakingPosition[];
  userId: number;
  onNavigateToTrading: (asset: Asset, options?: NavigateToTradingOptions) => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

type TabId = 'ACTIVE' | 'HISTORY' | 'ASSETS';

const DealsPage: React.FC<DealsPageProps> = ({
  deals,
  balance,
  balanceLoading = false,
  spotHoldings,
  stakingPositions = [],
  userId,
  onNavigateToTrading,
  onDeposit,
  onWithdraw,
}) => {
  const { formatPrice, symbol, currencyCode } = useCurrency();
  const { t, locale } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('ACTIVE');
  const [now, setNow] = useState(Date.now());
  const [ethUsdNft, setEthRubNft] = useState(0);
  const refNftPriceMap = useNftReferrerPriceMap();
  const jitter = useNftMarketJitter();
  const [activityHistory, setActivityHistory] = useState<ActivityHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const liveAssets = useLiveAssets(MARKET_ASSETS);

  const assetsByTicker = useMemo(() => {
    const map: Record<string, Asset> = {};
    liveAssets.forEach((a) => { map[a.ticker] = a; });
    return map;
  }, [liveAssets]);

  const nftListingBySpotTicker = useMemo(() => {
    const map = new Map<string, NftListingRow>();
    for (const row of getAllNftListings()) {
      map.set(nftTickerForListing(row), row);
    }
    return map;
  }, []);

  const nftPortfolioRows = useMemo(() => {
    const rows = spotHoldings
      .map((h) => {
        const row = nftListingBySpotTicker.get(h.ticker);
        if (!row) return null;
        const live = assetsByTicker[h.ticker];
        const rowPriced = enrichNftListingRow(row, refNftPriceMap, jitter);
        const baseUsd =
          ethUsdNft > 0
            ? rowPriced.priceEth * ethUsdNft
            : Math.max(h.avgPriceRub ?? 0, rowPriced.priceEth * 320_000, live?.price ?? 0, 1);
        const priceUsd =
          Number.isFinite(baseUsd) && baseUsd > 0
            ? withNftDisplayWobbleUsd(baseUsd, h.ticker, now)
            : Math.max(h.avgPriceRub ?? 0, 1);
        const asset = nftListingToAsset(rowPriced, Math.max(priceUsd, 1));
        const valueUsd = (h.amount ?? 0) * (priceUsd > 0 ? priceUsd : h.avgPriceRub ?? 0);
        return { holding: h, asset, row, price: priceUsd || h.avgPriceRub, valueUsd };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .filter((r) => Number.isFinite(r.valueUsd) && (r.holding.amount ?? 0) > 1e-6);
    rows.sort((a, b) => b.valueUsd - a.valueUsd);
    return rows;
  }, [spotHoldings, assetsByTicker, nftListingBySpotTicker, now, ethUsdNft, refNftPriceMap]);

  const spotRows = useMemo(() => {
    const rows = spotHoldings
      .filter((h) => !nftListingBySpotTicker.has(h.ticker))
      .map((h) => {
        const live = assetsByTicker[h.ticker];
        const price = live?.price ?? h.avgPriceRub ?? 0;
        const valueUsd = (h.amount ?? 0) * price;
        const asset: Asset =
          live ??
          (MARKET_ASSETS.find((a) => a.ticker === h.ticker) ||
            ({
              id: h.ticker,
              ticker: h.ticker,
              name: h.ticker,
              price,
              volume24h: 0,
              change24h: 0,
            } as Asset));
        return { holding: h, asset, price, valueUsd };
      })
      .filter((r) => Number.isFinite(r.valueUsd));
    rows.sort((a, b) => b.valueUsd - a.valueUsd);
    return rows;
  }, [spotHoldings, assetsByTicker, nftListingBySpotTicker]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const p = await fetchAssetPricesInUsd(['ETH']);
        if (cancelled) return;
        const x = p.ETH?.price ?? 0;
        if (Number.isFinite(x) && x > 0 && !p.ETH?.unavailable) setEthRubNft(x);
      } catch {
        /* silent */
      }
    };
    void pull();
    const id = window.setInterval(pull, 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'HISTORY' || userId <= 0) return;
    setHistoryLoading(true);
    fetchActivityHistory(userId).then((list) => {
      setActivityHistory(list);
      setHistoryLoading(false);
    });
  }, [activeTab, userId]);

  const activeDeals = deals.filter((d) => d.status === 'ACTIVE').sort((a, b) => b.startTime - a.startTime);
  const totalActiveExposure = activeDeals.reduce((sum, d) => sum + d.amount, 0);
  const totalPnlActive = activeDeals.reduce((sum, d) => sum + (d.pnl ?? 0), 0);

  const stakingValueUsd = useMemo(() => {
    if (!stakingPositions?.length) return 0;
    return stakingPositions.reduce((sum, p) => {
      const price = assetsByTicker[p.ticker]?.price ?? 0;
      return sum + (p.amount ?? 0) * price;
    }, 0);
  }, [stakingPositions, assetsByTicker]);

  const spotValueUsd = useMemo(
    () =>
      spotRows.reduce((s, r) => s + (r.valueUsd ?? 0), 0) +
      nftPortfolioRows.reduce((s, r) => s + (r.valueUsd ?? 0), 0),
    [spotRows, nftPortfolioRows]
  );
  const totalPortfolioUsd = useMemo(() => balance + spotValueUsd + stakingValueUsd, [balance, spotValueUsd, stakingValueUsd]);

  const dayChangeUsd = useMemo(() => {
    const spotCrypto = spotRows.reduce(
      (s, r) =>
        s + (r.valueUsd ?? 0) * (((assetsByTicker[r.holding.ticker]?.change24h ?? 0) as number) / 100),
      0
    );
    const nftDay = nftPortfolioRows.reduce((s, r) => {
      const chTicker = assetsByTicker[r.holding.ticker]?.change24h ?? assetsByTicker.ETH?.change24h ?? 0;
      return s + (r.valueUsd ?? 0) * ((chTicker as number) / 100);
    }, 0);
    const staking = (stakingPositions ?? []).reduce((s, p) => {
      const price = assetsByTicker[p.ticker]?.price ?? 0;
      const value = (p.amount ?? 0) * price;
      const ch = ((assetsByTicker[p.ticker]?.change24h ?? 0) as number) / 100;
      return s + value * ch;
    }, 0);
    return spotCrypto + nftDay + staking;
  }, [spotRows, nftPortfolioRows, assetsByTicker, stakingPositions]);

  const dayChangePct = useMemo(() => (totalPortfolioUsd > 0 ? (dayChangeUsd / totalPortfolioUsd) * 100 : 0), [dayChangeUsd, totalPortfolioUsd]);

  const nftHoldingsValueUsd = useMemo(
    () => nftPortfolioRows.reduce((s, r) => s + (r.valueUsd ?? 0), 0),
    [nftPortfolioRows]
  );
  const spotHoldingsValueUsdOnly = useMemo(
    () => spotRows.reduce((s, r) => s + (r.valueUsd ?? 0), 0),
    [spotRows]
  );

  const formatTimeLeft = (deal: Deal) => {
    const endTime = deal.startTime + deal.durationSeconds * 1000;
    const left = Math.max(0, endTime - now);
    const seconds = Math.floor((left / 1000) % 60);
    const minutes = Math.floor(left / 1000 / 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const qtyFormatLocale =
    locale === 'ru'
      ? 'ru-RU'
      : locale === 'uk'
        ? 'uk-UA'
        : locale === 'pl'
          ? 'pl-PL'
          : locale === 'cs'
            ? 'cs-CZ'
            : locale === 'kk'
              ? 'kk-KZ'
              : 'en-US';

  const formatHistoryDate = (createdAt: string) => {
    const d = new Date(createdAt);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const lang = locale === 'ru' ? 'ru-RU' : locale === 'uk' ? 'uk-UA' : 'en-US';
    if (isToday) {
      return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return d.toLocaleString(lang, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'ACTIVE', label: t('active_tab'), count: activeDeals.length },
    { id: 'HISTORY', label: t('history_tab'), count: activityHistory.length },
    { id: 'ASSETS', label: t('my_assets'), count: spotHoldings.length },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      {/* Wallet / Portfolio header (минималистично, как на бирже) */}
      <header className="shrink-0 px-4 pt-4 pb-3 bg-background hairline-bottom">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-textSubtle leading-none">{t('portfolio_title')}</p>
            <div className="flex items-baseline gap-2 mt-1 min-w-0">
              {balanceLoading ? (
                <Skeleton className="w-40 h-9 rounded-xl bg-card/60" />
              ) : (
                <span className="text-[34px] font-semibold tracking-tight text-white tabular-nums leading-[1] truncate">
                  {formatPrice(totalPortfolioUsd, { fractionDigits: 2 })}
                </span>
              )}
              <span className="text-xs text-white/70 font-medium leading-none">{currencyCode}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {dayChangeUsd !== 0 && (
                <span
                  className={`text-[11px] font-mono px-2 py-1 rounded-full ${
                    dayChangeUsd > 0 ? 'text-up bg-emerald-500/10' : 'text-down bg-red-500/10'
                  }`}
                >
                  {dayChangeUsd > 0 ? '+' : ''}
                  {formatPrice(dayChangeUsd)} {symbol} ({dayChangePct > 0 ? '+' : ''}
                  {dayChangePct.toFixed(2)}%)
                </span>
              )}
              {activeDeals.length > 0 ? (
                <span className="text-[11px] text-textMuted">
                  {activeDeals.length} {t('active_tab').toLowerCase()} · {formatPrice(totalActiveExposure)} {symbol}
                </span>
              ) : null}
            </div>
          </div>

          {activeDeals.length > 0 && (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-textMuted">P&L</p>
              <p className={`text-sm font-mono font-bold ${totalPnlActive >= 0 ? 'text-up' : 'text-down'}`}>
                {totalPnlActive >= 0 ? '+' : ''}
                {formatPrice(totalPnlActive)} {symbol}
              </p>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { Haptic.tap(); onDeposit?.(); }}
            className="flex-1 h-10 rounded-full bg-neon text-black text-[13px] font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <ArrowDownLeft size={16} />
            {t('quick_deposit')}
          </button>
          <button
            type="button"
            onClick={() => { Haptic.tap(); onWithdraw?.(); }}
            className="flex-1 h-10 rounded-full bg-[#121723] border border-[#1a202f] text-white text-[13px] font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <ArrowUpRightIcon size={16} />
            {t('quick_withdraw')}
          </button>
        </div>

        <div className="flex gap-1 mt-4 p-1 rounded-full bg-[#0a0d14] border border-[#131722]">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => { Haptic.tap(); setActiveTab(id); }}
              className={`flex-1 py-2 px-2 text-xs font-medium rounded-full transition-all duration-200 active:scale-95 ${
                activeTab === id
                  ? 'bg-card border border-border text-textPrimary'
                  : 'text-textMuted hover:text-textSecondary'
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5 min-w-0">
                <span className="truncate">{label}</span>
                <span className="text-[10px] font-mono opacity-70">{count}</span>
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto overflow-x-auto no-scrollbar pb-8">
        {/* ——— Активные сделки ——— */}
        {activeTab === 'ACTIVE' && (
          <div className="px-4 py-3">
            {activeDeals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="relative w-24 h-24 flex items-center justify-center mb-5">
                  <div className="absolute inset-0 bg-up/10 rounded-full blur-xl opacity-70 animate-pulse-ring" />
                  <div className="w-16 h-16 rounded-[1.5rem] bg-surface border border-white/5 flex items-center justify-center relative z-10 shadow-elevation-2">
                    <TrendingUp size={28} strokeWidth={1.5} className="text-up opacity-80" aria-hidden />
                  </div>
                </div>
                <p className="text-sm font-semibold text-textPrimary">{t('no_open_positions')}</p>
                <p className="text-[11px] text-textMuted mt-1 max-w-[200px]">{t('portfolio_empty_active_hint')}</p>
              </div>
            )}

            {activeDeals.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Заголовки колонок */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 px-3 py-2 border-b border-border bg-surface text-[10px] font-semibold uppercase tracking-wider text-textMuted">
                  <span>Пара / Направление</span>
                  <span className="text-right">Вход</span>
                  <span className="text-right">P&L</span>
                  <span className="text-right">Закрытие</span>
                </div>
                {activeDeals.map((deal) => {
                  const isProfitable = (deal.pnl ?? 0) >= 0;
                  const priceDiff = (deal.currentPrice ?? deal.entryPrice) - deal.entryPrice;
                  const pricePercent = deal.entryPrice ? (priceDiff / deal.entryPrice) * 100 : 0;
                  return (
                    <div
                      key={deal.id}
                      className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 px-3 py-2.5 border-b border-border last:border-b-0 hover-row items-center min-h-[56px] ${
                        isProfitable ? 'border-l-2 border-l-up' : 'border-l-2 border-l-down'
                      }`}
                    >
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-textPrimary truncate">{deal.assetTicker}</span>
                          <span className="shrink-0 text-[10px] font-mono text-textMuted bg-surface px-1.5 py-0.5 rounded border border-border">
                            x{deal.leverage}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {deal.side === 'UP' ? (
                            <ArrowUpRight size={12} className="text-up shrink-0" />
                          ) : (
                            <ArrowDownRight size={12} className="text-down shrink-0" />
                          )}
                          <span className={`text-[11px] font-medium ${deal.side === 'UP' ? 'text-up' : 'text-down'}`}>
                            {deal.side === 'UP' ? t('up') : t('down')}
                          </span>
                        </div>
                        {(deal.takeProfitPrice || deal.stopLossPrice) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {deal.takeProfitPrice && (
                              <span className="text-[9px] text-up font-mono border border-up/30 px-1 rounded bg-up/5">
                                TP: {formatPrice(deal.takeProfitPrice)}
                              </span>
                            )}
                            {deal.stopLossPrice && (
                              <span className="text-[9px] text-down font-mono border border-down/30 px-1 rounded bg-down/5">
                                SL: {formatPrice(deal.stopLossPrice)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono text-textSecondary block">
                          {formatPrice(deal.entryPrice)}
                        </span>
                        <span className="text-[10px] text-textMuted">
                          {pricePercent >= 0 ? '+' : ''}
                          {pricePercent.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 text-xs font-mono font-bold rounded-[6px] ${isProfitable ? 'bg-up text-black' : 'bg-down text-white'}`}>
                          {isProfitable ? '+' : ''}
                          {formatPrice(deal.pnl ?? 0)}
                        </span>
                        <span className="text-[10px] text-textMuted block">{symbol}</span>
                      </div>
                      <div className="text-right">
                        {deal.durationSeconds === 0 ? (
                          <span className="text-xs text-textMuted font-medium">Ручное<br/>закрытие</span>
                        ) : (
                          <>
                            <span className="text-sm font-mono font-bold text-textPrimary tabular-nums">
                              {formatTimeLeft(deal)}
                            </span>
                            <span className="text-[10px] text-textMuted block">{t('left')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ——— История операций ——— */}
        {activeTab === 'HISTORY' && (
          <div className="px-4 py-3">
            {historyLoading && (
              <div className="overflow-hidden rounded-2xl bg-surface/30">
                {Array.from({ length: 3 }).map((_, idx) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Skeleton key={idx} className="w-full h-14 bg-neutral-900/60" />
                ))}
              </div>
            )}

            {!historyLoading && activityHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="relative w-24 h-24 flex items-center justify-center mb-5">
                  <div className="absolute inset-0 bg-neon/10 rounded-full blur-xl opacity-70" />
                  <div className="w-16 h-16 rounded-[1.5rem] bg-surface border border-white/5 flex items-center justify-center relative z-10 shadow-elevation-2">
                    <History size={28} strokeWidth={1.5} className="text-neon opacity-80" aria-hidden />
                  </div>
                </div>
                <p className="text-sm font-semibold text-textPrimary">{t('history_empty')}</p>
                <p className="text-[11px] text-textMuted mt-1 max-w-[200px]">{t('portfolio_empty_history_hint')}</p>
              </div>
            )}

            {!historyLoading && activityHistory.length > 0 && (
              <div className="-mx-4">
                {activityHistory.map((item) => {
                  const labelMap: Record<ActivityHistoryItem['activity_type'], string> = {
                    spot_buy: t('spot_buy'),
                    spot_sell: t('spot_sell'),
                    stake: t('stake_btn'),
                    unstake: t('unstake_btn'),
                    trade: t('history_trade'),
                    staking_reward: t('staking_reward_history'),
                  };
                  const label = labelMap[item.activity_type];
                  const isGreen =
                    item.activity_type === 'spot_buy' ||
                    item.activity_type === 'stake' ||
                    item.activity_type === 'staking_reward' ||
                    (item.activity_type === 'trade' && (item.amount_usd ?? 0) >= 0);
                  const isRed =
                    item.activity_type === 'spot_sell' ||
                    item.activity_type === 'unstake' ||
                    (item.activity_type === 'trade' && (item.amount_usd ?? 0) < 0);
                  const ticker = item.ticker || (item.payload?.symbol as string) || '—';
                  const amountUsd = item.amount_usd ?? 0;
                  const quantity = item.quantity ?? 0;
                  const payload = item.payload as { type?: string; leverage?: number } | undefined;
                  return (
                    <div
                      key={`${item.id}-${item.created_at}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 list-row min-h-[56px]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium ${isGreen ? 'text-up' : isRed ? 'text-down' : 'text-textSecondary'}`}>
                          {label}
                        </p>
                        <p className="font-mono text-sm font-semibold text-textPrimary truncate">{ticker}</p>
                        {(payload?.type || payload?.leverage) && (
                          <p className="text-[10px] text-textMuted mt-0.5">
                            {payload?.type ?? ''} · x{payload?.leverage ?? 1}
                          </p>
                        )}
                        {quantity > 0 && (
                          <p className="text-[10px] text-textMuted font-mono">{quantity.toFixed(6)}</p>
                        )}
                        <p className="text-[10px] text-textMuted mt-0.5">{formatHistoryDate(item.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {item.activity_type === 'trade' && (
                          <span className={`font-mono text-sm font-bold tabular-nums ${amountUsd >= 0 ? 'text-up' : 'text-down'}`}>
                            {amountUsd >= 0 ? '+' : ''}
                            {formatPrice(amountUsd)} {symbol}
                          </span>
                        )}
                        {(item.activity_type === 'spot_buy' || item.activity_type === 'spot_sell') && (
                          <span className="font-mono text-sm text-textPrimary">{formatPrice(amountUsd)} {symbol}</span>
                        )}
                        {item.activity_type === 'stake' && (
                          <span className="font-mono text-sm text-neon">−{formatPrice(amountUsd)} {symbol}</span>
                        )}
                        {(item.activity_type === 'unstake' || item.activity_type === 'staking_reward') && (
                          <span className="font-mono text-sm text-up">+{formatPrice(amountUsd)} {symbol}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ——— Мои активы (спот) ——— */}
        {activeTab === 'ASSETS' && (
          <div className="px-4 py-3">
            {spotHoldings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="relative w-24 h-24 flex items-center justify-center mb-5">
                  <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-xl opacity-70" />
                  <div className="w-16 h-16 rounded-[1.5rem] bg-surface border border-white/5 flex items-center justify-center relative z-10 shadow-elevation-2">
                    <Wallet size={28} strokeWidth={1.5} className="text-purple-400 opacity-80" aria-hidden />
                  </div>
                </div>
                <p className="text-sm font-semibold text-textPrimary">{t('no_spot_assets')}</p>
                <p className="text-[11px] text-textMuted mt-1 max-w-[200px]">{t('portfolio_empty_spot_hint')}</p>
              </div>
            )}

            {spotHoldings.length > 0 && (nftPortfolioRows.length > 0 || spotRows.length > 0) && (
              <div className="space-y-7">
                {(nftPortfolioRows.length > 0 || spotRows.length > 0) && (
                  <div
                    className={`grid gap-2.5 ${
                      nftPortfolioRows.length > 0 && spotRows.length > 0 ? 'grid-cols-2' : 'grid-cols-1'
                    }`}
                  >
                    {nftPortfolioRows.length > 0 ? (
                      <div className="rounded-2xl px-3.5 py-3 bg-card border border-border border-l-4 border-l-violet-500">
                        <p className="text-[10px] uppercase tracking-wide text-textMuted font-semibold">
                          {t('portfolio_split_nft_value')}
                        </p>
                        <p className="text-[18px] font-bold font-mono text-neon tabular-nums leading-tight mt-1 truncate">
                          {formatPrice(nftHoldingsValueUsd)} {symbol}
                        </p>
                        <p className="text-[10px] text-textMuted mt-1.5">
                          {nftPortfolioRows.length} {t('nft_items')}
                        </p>
                      </div>
                    ) : null}
                    {spotRows.length > 0 ? (
                      <div className="rounded-2xl px-3.5 py-3 bg-card border border-border border-l-4 border-l-emerald-500">
                        <p className="text-[10px] uppercase tracking-wide text-textMuted font-semibold">
                          {t('portfolio_split_spot_value')}
                        </p>
                        <p className="text-[18px] font-bold font-mono text-textPrimary tabular-nums leading-tight mt-1 truncate">
                          {formatPrice(spotHoldingsValueUsdOnly)} {symbol}
                        </p>
                        <p className="text-[10px] text-textMuted mt-1.5">
                          {spotRows.length}{' '}
                          {t('portfolio_spot_block')} ·{' '}
                          {currencyCode}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* NFT: горизонтальная лента */}
                <section aria-label={t('portfolio_my_nfts')}>
                  <div className="flex items-end justify-between gap-2 px-0.5 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-neon/12 flex items-center justify-center shrink-0">
                        <Sparkles size={18} className="text-neon" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[15px] font-bold text-textPrimary tracking-tight">
                            {t('portfolio_my_nfts')}
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-px rounded-full bg-[#121723] border border-[#1a202f] text-textMuted">
                            {nftPortfolioRows.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-textMuted leading-snug mt-0.5">{t('portfolio_nft_sell_hint')}</p>
                      </div>
                    </div>
                  </div>
                  {nftPortfolioRows.length === 0 ? (
                    <div className="rounded-xl px-4 py-3 bg-card border border-border border-dashed">
                      <p className="text-xs text-textMuted leading-snug">{t('portfolio_nfts_hint')}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden bg-card border border-border divide-y divide-border">
                      {nftPortfolioRows.map(({ holding, asset, row, price, valueUsd }) => {
                        const qtyRounded = Math.round((holding.amount ?? 0) * 1000) / 1000;
                        const qtyLabel =
                          Math.abs(qtyRounded - Math.floor(qtyRounded + 1e-9)) < 1e-6
                            ? String(Math.floor(qtyRounded + 1e-9))
                            : qtyRounded.toFixed(3).replace(/\.?0+$/, '');
                        return (
                          <button
                            key={holding.ticker}
                            type="button"
                            onClick={() => {
                              Haptic.tap();
                              onNavigateToTrading(asset, { tradeType: 'spot', spotAction: 'sell' });
                            }}
                            className="w-full text-left px-3 py-3 flex items-center gap-3 min-h-[64px] active:bg-[#121723] transition-colors"
                            aria-label={`${row.collectionName} ${row.codeDisplay} · ${t('sell')}`}
                          >
                            <div className="h-12 w-12 shrink-0 rounded-xl bg-black/50 overflow-hidden relative border border-[#1a202f]">
                              <img
                                src={row.imageUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[14px] font-bold text-textPrimary">{row.codeDisplay}</span>
                                <span className="text-[10px] text-textMuted truncate">{row.collectionName}</span>
                              </div>
                              <p className="text-[11px] text-textMuted font-mono mt-0.5 tabular-nums">
                                {qtyLabel} {t('portfolio_units_label')} · {price > 0 ? formatPrice(price) : '—'} {symbol}
                              </p>
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              <div>
                                <p className="font-mono text-[14px] font-bold text-textPrimary tabular-nums">
                                  {formatPrice(valueUsd)} {symbol}
                                </p>
                                <p className="text-[10px] text-textMuted font-mono tabular-nums">{currencyCode}</p>
                              </div>
                              <ChevronRight size={18} className="text-textMuted opacity-75" aria-hidden />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Криптоспот: карточки списком */}
                <section aria-label={t('portfolio_spot_block')}>
                  <div className="flex items-center justify-between gap-2 px-0.5 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <Coins size={18} className="text-emerald-400/90" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold text-textPrimary tracking-tight">{t('portfolio_spot_block')}</h3>
                        <p className="text-[10px] text-textMuted mt-0.5">{t('portfolio_spot_trade_hint')}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-textMuted shrink-0">{spotRows.length}</span>
                  </div>
                  {spotRows.length === 0 ? (
                    <div className="rounded-xl px-4 py-3 bg-card border border-border border-dashed">
                      <p className="text-xs text-textMuted">{t('portfolio_spot_empty_hint')}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden bg-card border border-border divide-y divide-border">
                      {spotRows.map(({ holding, asset, price, valueUsd }) => {
                        const initials = holding.ticker.slice(0, 3).toUpperCase();
                        return (
                          <button
                            key={holding.ticker}
                            type="button"
                            onClick={() => {
                              Haptic.tap();
                              onNavigateToTrading(asset, { tradeType: 'spot', initialActiveTab: 'TRADE' });
                            }}
                            className="w-full text-left px-3 py-3.5 flex items-center gap-3 min-h-[64px] active:bg-[#121723] transition-colors"
                          >
                            <div className="h-11 w-11 shrink-0 rounded-xl bg-[#0a0d14] border border-[#131722] flex items-center justify-center">
                              <span className="text-[10px] font-mono font-bold text-emerald-400">{initials}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[14px] font-bold text-textPrimary">{holding.ticker}</span>
                                <span className="text-[10px] text-textMuted truncate">{asset.name}</span>
                              </div>
                              <p className="text-[11px] text-textMuted font-mono mt-1 tabular-nums">
                                {holding.amount.toLocaleString(qtyFormatLocale, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 8,
                                })}{' '}
                                · {formatPrice(price)} {symbol}
                              </p>
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              <div>
                                <p className="font-mono text-[14px] font-bold text-textPrimary tabular-nums">
                                  {formatPrice(valueUsd)} {symbol}
                                </p>
                                <p className="text-[10px] text-textMuted font-mono tabular-nums">{currencyCode}</p>
                              </div>
                              <ChevronRight size={18} className="text-textMuted opacity-75" aria-hidden />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealsPage;
