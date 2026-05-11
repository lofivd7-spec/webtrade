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
import { fetchAssetPricesInRub } from '../lib/cryptoPrices';
import { useLiveAssets } from '../utils/useLiveAssets';
import { withNftDisplayWobbleRub } from '../utils/nftPriceWobble';
import { enrichNftListingRow, useNftReferrerPriceMap } from '../lib/nftReferrerPricing';
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
  const [ethRubNft, setEthRubNft] = useState(0);
  const refNftPriceMap = useNftReferrerPriceMap();
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
        const rowPriced = enrichNftListingRow(row, refNftPriceMap);
        const baseRub =
          ethRubNft > 0
            ? rowPriced.priceEth * ethRubNft
            : Math.max(h.avgPriceRub ?? 0, rowPriced.priceEth * 320_000, live?.price ?? 0, 1);
        const priceRub =
          Number.isFinite(baseRub) && baseRub > 0
            ? withNftDisplayWobbleRub(baseRub, h.ticker, now)
            : Math.max(h.avgPriceRub ?? 0, 1);
        const asset = nftListingToAsset(rowPriced, Math.max(priceRub, 1));
        const valueRub = (h.amount ?? 0) * (priceRub > 0 ? priceRub : h.avgPriceRub ?? 0);
        return { holding: h, asset, row, price: priceRub || h.avgPriceRub, valueRub };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .filter((r) => Number.isFinite(r.valueRub));
    rows.sort((a, b) => b.valueRub - a.valueRub);
    return rows;
  }, [spotHoldings, assetsByTicker, nftListingBySpotTicker, now, ethRubNft, refNftPriceMap]);

  const spotRows = useMemo(() => {
    const rows = spotHoldings
      .filter((h) => !nftListingBySpotTicker.has(h.ticker))
      .map((h) => {
        const live = assetsByTicker[h.ticker];
        const price = live?.price ?? h.avgPriceRub ?? 0;
        const valueRub = (h.amount ?? 0) * price;
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
        return { holding: h, asset, price, valueRub };
      })
      .filter((r) => Number.isFinite(r.valueRub));
    rows.sort((a, b) => b.valueRub - a.valueRub);
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
        const p = await fetchAssetPricesInRub(['ETH']);
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

  const stakingValueRub = useMemo(() => {
    if (!stakingPositions?.length) return 0;
    return stakingPositions.reduce((sum, p) => {
      const price = assetsByTicker[p.ticker]?.price ?? 0;
      return sum + (p.amount ?? 0) * price;
    }, 0);
  }, [stakingPositions, assetsByTicker]);

  const spotValueRub = useMemo(
    () =>
      spotRows.reduce((s, r) => s + (r.valueRub ?? 0), 0) +
      nftPortfolioRows.reduce((s, r) => s + (r.valueRub ?? 0), 0),
    [spotRows, nftPortfolioRows]
  );
  const totalPortfolioRub = useMemo(() => balance + spotValueRub + stakingValueRub, [balance, spotValueRub, stakingValueRub]);

  const dayChangeRub = useMemo(() => {
    const spotCrypto = spotRows.reduce(
      (s, r) =>
        s + (r.valueRub ?? 0) * (((assetsByTicker[r.holding.ticker]?.change24h ?? 0) as number) / 100),
      0
    );
    const nftDay = nftPortfolioRows.reduce((s, r) => {
      const chTicker = assetsByTicker[r.holding.ticker]?.change24h ?? assetsByTicker.ETH?.change24h ?? 0;
      return s + (r.valueRub ?? 0) * ((chTicker as number) / 100);
    }, 0);
    const staking = (stakingPositions ?? []).reduce((s, p) => {
      const price = assetsByTicker[p.ticker]?.price ?? 0;
      const value = (p.amount ?? 0) * price;
      const ch = ((assetsByTicker[p.ticker]?.change24h ?? 0) as number) / 100;
      return s + value * ch;
    }, 0);
    return spotCrypto + nftDay + staking;
  }, [spotRows, nftPortfolioRows, assetsByTicker, stakingPositions]);

  const dayChangePct = useMemo(() => (totalPortfolioRub > 0 ? (dayChangeRub / totalPortfolioRub) * 100 : 0), [dayChangeRub, totalPortfolioRub]);

  const nftHoldingsValueRub = useMemo(
    () => nftPortfolioRows.reduce((s, r) => s + (r.valueRub ?? 0), 0),
    [nftPortfolioRows]
  );
  const spotHoldingsValueRubOnly = useMemo(
    () => spotRows.reduce((s, r) => s + (r.valueRub ?? 0), 0),
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
                  {formatPrice(totalPortfolioRub, { fractionDigits: 2 })}
                </span>
              )}
              <span className="text-xs text-white/70 font-medium leading-none">{currencyCode}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-[11px] font-mono px-2 py-1 rounded-full ${
                  dayChangeRub >= 0 ? 'text-up bg-emerald-500/10' : 'text-down bg-red-500/10'
                }`}
              >
                {dayChangeRub >= 0 ? '+' : ''}
                {formatPrice(dayChangeRub)} {symbol} ({dayChangePct >= 0 ? '+' : ''}
                {dayChangePct.toFixed(2)}%)
              </span>
              {activeDeals.length > 0 ? (
                <span className="text-[11px] text-textMuted">
                  {activeDeals.length} {t('active_tab').toLowerCase()} · {formatPrice(totalActiveExposure)} {symbol}
                </span>
              ) : null}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-textMuted">P&L</p>
            <p className={`text-sm font-mono font-bold ${totalPnlActive >= 0 ? 'text-up' : 'text-down'}`}>
              {totalPnlActive >= 0 ? '+' : ''}
              {formatPrice(totalPnlActive)} {symbol}
            </p>
          </div>
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
            className="flex-1 h-10 rounded-full bg-white/10 text-white text-[13px] font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <ArrowUpRightIcon size={16} />
            {t('quick_withdraw')}
          </button>
        </div>

        <div className="flex gap-1 mt-4 p-1 rounded-full bg-surface/40">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => { Haptic.tap(); setActiveTab(id); }}
              className={`flex-1 py-2 px-2 text-xs font-medium rounded-full transition-all duration-200 active:scale-[0.98] ${
                activeTab === id
                  ? 'bg-card/35 text-textPrimary'
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
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 px-3 py-2 border-b border-border bg-surface/80 text-[10px] font-semibold uppercase tracking-wider text-textMuted">
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
                        <span className={`text-sm font-mono font-bold ${isProfitable ? 'text-up' : 'text-down'}`}>
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
                    (item.activity_type === 'trade' && (item.amount_rub ?? 0) >= 0);
                  const isRed =
                    item.activity_type === 'spot_sell' ||
                    item.activity_type === 'unstake' ||
                    (item.activity_type === 'trade' && (item.amount_rub ?? 0) < 0);
                  const ticker = item.ticker || (item.payload?.symbol as string) || '—';
                  const amountRub = item.amount_rub ?? 0;
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
                          <span className={`font-mono text-sm font-bold tabular-nums ${amountRub >= 0 ? 'text-up' : 'text-down'}`}>
                            {amountRub >= 0 ? '+' : ''}
                            {formatPrice(amountRub)} {symbol}
                          </span>
                        )}
                        {(item.activity_type === 'spot_buy' || item.activity_type === 'spot_sell') && (
                          <span className="font-mono text-sm text-textPrimary">{formatPrice(amountRub)} {symbol}</span>
                        )}
                        {item.activity_type === 'stake' && (
                          <span className="font-mono text-sm text-neon">−{formatPrice(amountRub)} {symbol}</span>
                        )}
                        {(item.activity_type === 'unstake' || item.activity_type === 'staking_reward') && (
                          <span className="font-mono text-sm text-up">+{formatPrice(amountRub)} {symbol}</span>
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
                      <div className="rounded-2xl px-3.5 py-3 bg-gradient-to-br from-violet-500/[0.16] via-fuchsia-500/[0.08] to-transparent">
                        <p className="text-[10px] uppercase tracking-wide text-textMuted font-semibold">
                          {t('portfolio_split_nft_value')}
                        </p>
                        <p className="text-[18px] font-bold font-mono text-neon tabular-nums leading-tight mt-1 truncate">
                          {formatPrice(nftHoldingsValueRub)} {symbol}
                        </p>
                        <p className="text-[10px] text-textMuted mt-1.5">
                          {nftPortfolioRows.length} {t('nft_items')}
                        </p>
                      </div>
                    ) : null}
                    {spotRows.length > 0 ? (
                      <div className="rounded-2xl px-3.5 py-3 bg-gradient-to-br from-emerald-500/[0.14] via-cyan-500/[0.07] to-transparent">
                        <p className="text-[10px] uppercase tracking-wide text-textMuted font-semibold">
                          {t('portfolio_split_spot_value')}
                        </p>
                        <p className="text-[18px] font-bold font-mono text-textPrimary tabular-nums leading-tight mt-1 truncate">
                          {formatPrice(spotHoldingsValueRubOnly)} {symbol}
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
                          <span className="text-[10px] font-mono px-2 py-px rounded-full bg-white/[0.06] text-textMuted">
                            {nftPortfolioRows.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-textMuted leading-snug mt-0.5">{t('portfolio_nft_sell_hint')}</p>
                      </div>
                    </div>
                  </div>
                  {nftPortfolioRows.length === 0 ? (
                    <div className="rounded-xl px-4 py-3 bg-white/[0.02] border border-white/[0.05] border-dashed">
                      <p className="text-xs text-textMuted leading-snug">{t('portfolio_nfts_hint')}</p>
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory scroll-pl-4 -mx-4 pl-4 pr-4 scroll-smooth">
                      {nftPortfolioRows.map(({ holding, asset, row, price, valueRub }) => {
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
                            className="snap-start shrink-0 w-[min(78vw,254px)] sm:w-[238px] text-left rounded-2xl overflow-hidden bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-lg shadow-black/30 active:scale-[0.987] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-neon/40 ring-1 ring-white/[0.08]"
                            aria-label={`${row.collectionName} ${row.codeDisplay} · ${t('sell')}`}
                          >
                            <div className="relative aspect-[4/5] bg-black/50">
                              <img
                                src={row.imageUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />
                              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/65 backdrop-blur-sm px-2 py-1 ring-1 ring-white/10">
                                <span className="text-[10px] font-mono font-bold text-neon tabular-nums">
                                  {qtyLabel}{' '}
                                  <span className="font-normal text-textMuted">{t('portfolio_units_label')}</span>
                                </span>
                              </div>
                              <p className="absolute bottom-2.5 left-3 right-3 font-mono text-[13px] font-bold text-white leading-tight drop-shadow-lg line-clamp-2">
                                {row.codeDisplay}
                              </p>
                            </div>
                            <div className="p-3 space-y-2">
                              <p className="text-[11px] text-textMuted leading-snug line-clamp-2 min-h-[2.25rem]">
                                {row.collectionName}
                              </p>
                              <div className="flex items-end justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[15px] font-mono font-bold text-textPrimary tabular-nums truncate">
                                    {formatPrice(valueRub)} {symbol}
                                  </p>
                                  <p className="text-[10px] text-textMuted font-mono tabular-nums mt-0.5">
                                    ~ {price > 0 ? formatPrice(price) : '—'} {symbol}/{t('portfolio_units_label')}
                                  </p>
                                </div>
                                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-neon bg-neon/12 px-2.5 py-1 rounded-lg">
                                  <ArrowDownRight size={14} aria-hidden />
                                  {t('sell')}
                                </span>
                              </div>
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
                    <div className="rounded-xl px-4 py-3 bg-white/[0.02] border border-white/[0.05] border-dashed">
                      <p className="text-xs text-textMuted">{t('portfolio_spot_empty_hint')}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden bg-white/[0.025] divide-y divide-white/[0.05] ring-1 ring-white/[0.07]">
                      {spotRows.map(({ holding, asset, price, valueRub }) => {
                        const initials = holding.ticker.slice(0, 3).toUpperCase();
                        return (
                          <button
                            key={holding.ticker}
                            type="button"
                            onClick={() => {
                              Haptic.tap();
                              onNavigateToTrading(asset, { tradeType: 'spot', initialActiveTab: 'TRADE' });
                            }}
                            className="w-full text-left px-3 py-3.5 flex items-center gap-3 min-h-[64px] active:bg-white/[0.04] transition-colors"
                          >
                            <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/15 flex items-center justify-center ring-1 ring-white/[0.08]">
                              <span className="text-[10px] font-mono font-bold text-emerald-200/95">{initials}</span>
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
                                  {formatPrice(valueRub)} {symbol}
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
