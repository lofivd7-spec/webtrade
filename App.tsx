import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TradingPage from './pages/TradingPage';
import CoinsPage from './pages/CoinsPage';
import NFTCollectionGalleryPage from './pages/NFTCollectionGalleryPage';
import NFTDetailPage from './pages/NFTDetailPage';
import { refreshNftListingsFromSupabase } from './lib/nftSupabase';
import { fetchReferrerNftPolicies, NftReferrerPriceProvider } from './lib/nftReferrerPricing';
import { getNftListing, listNftCollections } from './lib/nftCatalog';
import DealsPage from './pages/DealsPage';
import StakingPage from './pages/StakingPage';
import DepositPage from './pages/DepositPage';
import WithdrawPage from './pages/WithdrawPage';
import QRScannerPage from './pages/QRScannerPage';
import ProfilePage from './pages/ProfilePage';
import SupportPage from './pages/SupportPage';
import CallPage from './pages/CallPage';
import KycPage from './pages/KycPage';
import { PageView, Asset, Deal, DealStatus, type NavigateToTradingOptions } from './types';
import type { SpotHolding } from './types';
import type { StakingPosition, StakingRate } from './types';
import { MOCK_ASSETS, MARKET_ASSETS } from './constants';
import { useLiveAssets } from './utils/useLiveAssets';
import { prefetchCryptoPrices } from './lib/cryptoPrices';
import { Haptic } from './utils/haptics';
import { useUser } from './context/UserContext';
import { usePin } from './context/PinContext';
import { supabase } from './lib/supabase';
import { tradeRowToDeal, dealToTradeInsert } from './lib/trades';
import { fetchSpotHoldings } from './lib/spot';
import { accrualToBalance, fetchStakingPositions, fetchStakingRates } from './lib/staking';
import { useToast } from './context/ToastContext';
import { useLanguage } from './context/LanguageContext';
import type { Locale } from './i18n/translations';
import { getSupabaseErrorMessage } from './lib/supabaseError';
import { logAction } from './lib/appLog';
import { enqueueWorkerNotification } from './lib/workerNotifications';
import CreatePinScreen from './components/CreatePinScreen';
import OnboardingScreen from './components/OnboardingScreen';
import LanguagePickerPage from './pages/LanguagePickerPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { CurrencyProvider, useCurrency } from './context/CurrencyContext';
import { FullscreenSheetLockProvider } from './context/FullscreenSheetLockContext';
import { useWebAuth } from './context/WebAuthContext';
import { PasswordChangeProvider, usePasswordChange } from './context/PasswordChangeContext';
import Modal from './components/Modal';
import SplashScreen from './components/SplashScreen';

// Prefetch: запускаем загрузку цен ДО монтирования React — кеш заполнится быстрее
prefetchCryptoPrices(MARKET_ASSETS.map((a) => a.ticker));

/** Синхронизирует язык и валюту с данными пользователя */
function LocaleCurrencySync() {
  const { tgid, webUserId, user } = useUser();
  const { setLocale } = useLanguage();
  const { setBaseCurrency } = useCurrency();
  const isLoggedIn = !!(tgid || webUserId) && user;
  useEffect(() => {
    if (isLoggedIn && user) {
      const loc = (user.preferred_locale || 'en').toLowerCase();
      if (['en', 'ru', 'uk', 'pl', 'kk', 'cs'].includes(loc)) setLocale(loc as Locale);
      setBaseCurrency('usd');
    } else {
      setLocale('en');
      setBaseCurrency('usd');
    }
  }, [tgid, webUserId, user?.preferred_locale, user?.preferred_currency, setLocale, setBaseCurrency]);
  return null;
}

type Side = 'UP' | 'DOWN';
type LuckMode = 'WIN' | 'LOSE' | 'RANDOM';

interface TradeResult {
  pnl: number;           // Итоговая прибыль/убыток (например, +500 или -1000)
  percentChange: number; // На сколько % реально изменилась цена (например, 0.035 для 3.5%)
  isLiquidated: boolean; // Случилась ли ликвидация
}

function calculateTradeResult(
  amount: number,
  leverage: number,
  side: Side,
  luckMode: LuckMode,
  moveMinPct: number,
  moveMaxPct: number,
  marginMode: 'isolated' | 'cross' = 'isolated'
): TradeResult {
  const min = Math.max(0.001, Math.min(moveMinPct, moveMaxPct));
  const max = Math.max(min, Math.min(Math.max(moveMinPct, moveMaxPct), 0.25));
  const absoluteMovePercent = min + Math.random() * (max - min);

  let marketDirection: 1 | -1;
  if (luckMode === 'WIN') {
    marketDirection = side === 'UP' ? 1 : -1;
  } else if (luckMode === 'LOSE') {
    marketDirection = side === 'UP' ? -1 : 1;
  } else {
    marketDirection = Math.random() > 0.5 ? 1 : -1;
  }

  const sideMultiplier = side === 'UP' ? 1 : -1;
  const rawPnlPercent = absoluteMovePercent * marketDirection * sideMultiplier;
  const leveragedPnlPercent = rawPnlPercent * leverage;

  let finalPnl = Math.round(amount * leveragedPnlPercent);
  let isLiquidated = false;

  // Cross margin allows for more profit but also more loss
  if (marginMode === 'cross') {
    finalPnl = Math.round(finalPnl * 1.2); // 20% bonus/penalty
  }

  // Liquidation check
  if (marginMode === 'isolated' && leveragedPnlPercent <= -1) {
    isLiquidated = true;
    finalPnl = -amount;
  } else if (marginMode === 'cross' && leveragedPnlPercent <= -2) {
    // Cross margin liquidated later (e.g. at -200%)
    isLiquidated = true;
    finalPnl = -amount * 2;
  }

  return {
    pnl: finalPnl,
    percentChange: absoluteMovePercent * marketDirection,
    isLiquidated,
  };
}

type AuthSubPage = null | 'login' | 'register';

interface NavigationState {
  page: PageView;
  asset?: Asset | null;
  nftGallerySlug?: string | null;
  nftDetailCodeKey?: string | null;
  tradingInitialState?: NavigateToTradingOptions | null;
}

function resolveInitialActiveTab(asset: Asset, options?: NavigateToTradingOptions): 'CHART' | 'TRADE' {
  if (options?.initialActiveTab) return options.initialActiveTab;
  if ((asset.category ?? 'crypto') === 'nft') return 'TRADE';
  if (options?.spotAction === 'buy' || options?.spotAction === 'sell') return 'TRADE';
  return 'CHART';
}

const App: React.FC = () => {
  return (
    <PasswordChangeProvider>
      <AppContent />
    </PasswordChangeProvider>
  );
};

const AppContent: React.FC = () => {
  const { user, tgid, webUserId, loading, error, refreshUser } = useUser();
  const { hasPin } = usePin();
  const { webUserId: webId } = useWebAuth();
  const { passwordChangeActive } = usePasswordChange();
  const toast = useToast();
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState<PageView>('HOME');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [spotHoldings, setSpotHoldings] = useState<SpotHolding[]>([]);
  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([]);
  const [stakingRates, setStakingRates] = useState<StakingRate[]>([]);
  const [tradingInitialState, setTradingInitialState] = useState<NavigateToTradingOptions | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [pinCreated, setPinCreated] = useState(false);
  const [authSubPage, setAuthSubPage] = useState<AuthSubPage>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [pendingPage, setPendingPage] = useState<PageView | null>(null);
  const [regPromptOpen, setRegPromptOpen] = useState(false);
  const [regPromptDeclined, setRegPromptDeclined] = useState(false);
  const [hideNavigation, setHideNavigation] = useState(false);
  const [hideNavFromDeposit, setHideNavFromDeposit] = useState(false);
  const [hideNavFromProfileFullscreen, setHideNavFromProfileFullscreen] = useState(false);
  /** Навигация NFT: галерея коллекции → карточка → спот */
  const [nftGallerySlug, setNftGallerySlug] = useState<string | null>(null);
  const [nftDetailCodeKey, setNftDetailCodeKey] = useState<string | null>(null);
  /** Ссылка из бота: ?nft_slug=…&nft_code=… (один раз за сессию) */
  const nftDeepLinkConsumed = React.useRef(false);
  const [minLoadingDone, setMinLoadingDone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      try {
        const tg = (window as any).Telegram.WebApp;
        tg.expand();
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');
        if (typeof tg.disableVerticalSwipes === 'function') {
          tg.disableVerticalSwipes();
        }
      } catch (e) {
        console.error('Failed to initialize Telegram WebApp', e);
      }
    }
  }, []);

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const refId = params?.get('ref') || null;
  const bonus = params?.get('bonus') ? Number(params.get('bonus')) : null;
  const openSupport = params?.get('open') === 'support';
  const hasMiniAppEmailAccess = Boolean(tgid && user?.email);
  const hasWebAccess = Boolean(webId && user);
  const isLoggedIn = hasMiniAppEmailAccess || hasWebAccess;

  const PROTECTED_PAGES: PageView[] = [
    'DEPOSIT',
    'WITHDRAW',
    'DEALS',
    'PROFILE',
    'KYC',
    'STAKING',
  ];

  const openAuthGate = React.useCallback((target?: PageView) => {
    setPendingPage(target ?? null);
    setAuthSubPage(null);
    setAuthGateOpen(true);
  }, []);

  const openRegister = React.useCallback((target?: PageView) => {
    setPendingPage(target ?? null);
    setAuthSubPage('register');
    setAuthGateOpen(true);
  }, []);

  const openLogin = React.useCallback((target?: PageView) => {
    setPendingPage(target ?? null);
    setAuthSubPage('login');
    setAuthGateOpen(true);
  }, []);

  const navigateTo = React.useCallback((
    page: PageView, 
    assetVal?: Asset | null, 
    initialStateVal?: NavigateToTradingOptions | null,
    gallerySlugVal?: string | null,
    detailCodeVal?: string | null
  ) => {
    Haptic.light();
    if (!isLoggedIn && PROTECTED_PAGES.includes(page)) {
      openAuthGate(page);
      return;
    }

    // Determine current values if not explicitly provided
    const nextAsset = assetVal !== undefined ? assetVal : selectedAsset;
    const nextTradingState = initialStateVal !== undefined ? initialStateVal : tradingInitialState;
    const nextGallerySlug = gallerySlugVal !== undefined ? gallerySlugVal : nftGallerySlug;
    const nextDetailCode = detailCodeVal !== undefined ? detailCodeVal : nftDetailCodeKey;

    const state: NavigationState = {
      page,
      asset: nextAsset,
      nftGallerySlug: nextGallerySlug,
      nftDetailCodeKey: nextDetailCode,
      tradingInitialState: nextTradingState,
    };

    window.history.pushState(state, '', '');
    setCurrentPage(page);

    // Apply local state updates
    if (assetVal !== undefined) setSelectedAsset(assetVal);
    if (initialStateVal !== undefined) setTradingInitialState(initialStateVal);
    if (gallerySlugVal !== undefined) setNftGallerySlug(gallerySlugVal);
    if (detailCodeVal !== undefined) setNftDetailCodeKey(detailCodeVal);

    if (page === 'HOME') {
      setSelectedAsset(null);
      setTradingInitialState(null);
      setNftGallerySlug(null);
      setNftDetailCodeKey(null);
    }
    if (page === 'COINS') {
      setNftGallerySlug(null);
      setNftDetailCodeKey(null);
    }
  }, [isLoggedIn, openAuthGate, selectedAsset, tradingInitialState, nftGallerySlug, nftDetailCodeKey]);

  const navigateBack = React.useCallback((fallbackPage: PageView = 'HOME') => {
    Haptic.light();
    if (window.history.state && window.history.state.page) {
      window.history.back();
    } else {
      navigateTo(fallbackPage);
    }
  }, [navigateTo]);

  const handleNavigate = React.useCallback((page: PageView) => {
    navigateTo(page);
  }, [navigateTo]);

  const handleRequireAuth = React.useCallback(
    (target?: PageView) => {
      // если пользователь уже видел промпт и отказался — сразу ведём на регистрацию
      if (regPromptDeclined) {
        openRegister(target);
        return;
      }
      openAuthGate(target);
    },
    [regPromptDeclined, openAuthGate, openRegister]
  );

  useEffect(() => {
    const timer = setTimeout(() => setMinLoadingDone(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (tgid && (!user || !user.email) && !webId && !authGateOpen) {
      setAuthGateOpen(true);
      setAuthSubPage(null);
    }
  }, [loading, tgid, user, webId, authGateOpen]);



  const [nftRefPolicies, setNftRefPolicies] = React.useState<{
    prices: Record<string, number>;
    duoByTicker: Record<string, boolean>;
    jitter: number;
  }>({ prices: {}, duoByTicker: {}, jitter: 1 });

  useEffect(() => {
    let interval: number;

    const fetchAllNftData = async () => {
      await refreshNftListingsFromSupabase();
      if (user?.user_id) {
        const p = await fetchReferrerNftPolicies(user.user_id);
        setNftRefPolicies(p);
      } else {
        setNftRefPolicies({ prices: {}, duoByTicker: {}, jitter: 1 });
      }
    };

    void fetchAllNftData();
    interval = window.setInterval(fetchAllNftData, 15000);

    return () => window.clearInterval(interval);
  }, [user?.user_id, user?.referrer_id]);

  useEffect(() => {
    if (typeof window === 'undefined' || nftDeepLinkConsumed.current) return;
    if (loading) return;
    try {
      const p = new URLSearchParams(window.location.search);
      const ns = (p.get('nft_slug') || '').trim().toLowerCase();
      const nc = (p.get('nft_code') || '').trim().replace(/^#/i, '');
      if (!ns || !nc) return;
      const row = getNftListing(ns, nc);
      if (!row) return;
      nftDeepLinkConsumed.current = true;
      navigateTo('NFT_ITEM', null, null, ns, nc);
    } catch {
      /* ignore malformed query */
    }
  }, [loading, navigateTo]);



  // Первый заход гостя: показываем предложение регистрации (не fullscreen)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLoggedIn) return;
    if (authGateOpen) return;
    // если есть tgid/webId, значит юзер должен существовать/подтянуться — не мешаем загрузке
    if (loading) return;
    try {
      const seen = localStorage.getItem('mexc_reg_prompt_seen_v1') === '1';
      const declined = localStorage.getItem('mexc_reg_prompt_declined_v1') === '1';
      setRegPromptDeclined(declined);
      if (!seen && !declined) setRegPromptOpen(true);
    } catch {
      // если localStorage недоступен — показываем один раз на сессию
      setRegPromptOpen(true);
    }
  }, [isLoggedIn, authGateOpen, loading]);

  // Support deep-link (?open=support) vs call invite (/?call=uuid or /call/uuid paths)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname || '';
    const qsCall = new URLSearchParams(window.location.search).get('call');
    const queryCallOk = !!(qsCall && /^[0-9a-fA-F-]{16,}$/i.test(qsCall.trim()));
    if (path.startsWith('/call/') || queryCallOk) {
      navigateTo('CALL');
      setHideNavigation(true);
      return;
    }
    if (openSupport) navigateTo('SUPPORT');
  }, [openSupport, navigateTo]);

  const userLuckRef = useRef<'win' | 'lose' | 'default'>(user?.luck ?? 'default');
  const paidDealIds = useRef<Set<string>>(new Set());
  const settlementCacheRef = useRef<Map<string, { finalPnl: number; finalPrice: number; isWin: boolean; payout: number }>>(
    new Map()
  );
  const settlingDealIds = useRef<Set<string>>(new Set());
  const moveRangeRef = useRef<{ min: number; max: number }>({ min: 0.01, max: 0.05 });
  userLuckRef.current = user?.luck ?? 'default';

  const balance = user?.balance ?? 0;
  const balanceLoading = Boolean(loading && (tgid || webId || webUserId));
  const liveCrypto = useLiveAssets(MARKET_ASSETS);
  const liveAssetsForTrading = React.useMemo(
    () => [...liveCrypto],
    [liveCrypto]
  );

  // Управляем видимостью навигации при создании PIN или смене пароля
  useEffect(() => {
    const showingPinScreen = 
      (tgid && user && !hasPin(tgid) && !pinCreated) ||
      (webUserId && user && !hasPin(webUserId.toString()) && !pinCreated);
    
    setHideNavigation(showingPinScreen || passwordChangeActive);
  }, [tgid, webUserId, user, hasPin, pinCreated, passwordChangeActive]);

  // Загрузка сделок из БД
  useEffect(() => {
    if (!user) return;
    const uid = user.user_id;
    supabase
      .from('trades')
      .select('*')
      .eq('user_id', uid)
      .order('start_time', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) return;
        const list = (data || []).map((row) => tradeRowToDeal(row as any));
        setDeals(list);
      });
  }, [user?.user_id]);

  const refreshSpotHoldings = React.useCallback(async () => {
    if (!user) return;
    const list = await fetchSpotHoldings(user.user_id);
    setSpotHoldings(list);
    refreshUser();
  }, [user, refreshUser]);

  const refreshStaking = React.useCallback(async () => {
    if (!user) return;
    const pricesRub = Object.fromEntries(
      liveAssetsForTrading
        .filter((asset) => Number.isFinite(asset.price) && asset.price > 0)
        .map((asset) => [asset.ticker, asset.price])
    );
    await accrualToBalance(user.user_id, pricesRub);
    const [positions, rates] = await Promise.all([
      fetchStakingPositions(user.user_id),
      fetchStakingRates(),
    ]);
    setStakingPositions(positions);
    setStakingRates(rates);
    refreshUser();
  }, [user, liveAssetsForTrading, refreshUser]);

  const notifyReferralSpotBuy = React.useCallback((_ticker: string, _amountUsd: number) => {
    // Уведомления отключены
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchSpotHoldings(user.user_id).then(setSpotHoldings);
  }, [user?.user_id]);

  useEffect(() => {
    if (!user) return;
    refreshStaking();
  }, [user?.user_id, refreshStaking]);

  // Per-user move coefficient range (percent -> decimal). If not set, default 1–5%.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const mn = Number((user as any)?.trade_move_min);
        const mx = Number((user as any)?.trade_move_max);
        if (Number.isFinite(mn) && Number.isFinite(mx) && mn > 0 && mx > 0) {
          moveRangeRef.current = { min: mn / 100, max: mx / 100 };
        } else {
          moveRangeRef.current = { min: 0.01, max: 0.05 };
        }
      } catch {
        moveRangeRef.current = { min: 0.01, max: 0.05 };
      }
    })();
  }, [user?.user_id, (user as any)?.trade_move_min, (user as any)?.trade_move_max]);

  // Game loop: price movement and deal expiration; result by luck (win/lose/random)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      setDeals((currentDeals) => {
        if (currentDeals.length === 0) return currentDeals;
        const luck = userLuckRef.current;

        return currentDeals.map((deal) => {
          if (deal.status !== 'ACTIVE') return deal;

          const timeElapsed = Date.now() - deal.startTime;
          const isFinished = timeElapsed >= deal.durationSeconds * 1000;
          const currentPrice = deal.currentPrice ?? deal.entryPrice;
          // TP/SL Triggers
          const isTP = deal.takeProfitPrice && (
            (deal.side === 'UP' && currentPrice >= deal.takeProfitPrice) ||
            (deal.side === 'DOWN' && currentPrice <= deal.takeProfitPrice)
          );
          const isSL = deal.stopLossPrice && (
            (deal.side === 'UP' && currentPrice <= deal.stopLossPrice) ||
            (deal.side === 'DOWN' && currentPrice >= deal.stopLossPrice)
          );

          // Сделка завершилась: считаем итоговое движение 1–5% и результат по удаче + плечу
          if (isFinished || isTP || isSL) {
            // Compute settlement once and retry saving until DB is updated.
            const cached = settlementCacheRef.current.get(deal.id);
            const settlement =
              cached ??
              (() => {
                if (isTP || isSL) {
                  // TP/SL triggered: use the trigger price as final price
                  const finalPrice = isTP ? deal.takeProfitPrice! : deal.stopLossPrice!;
                  const priceDiff = deal.side === 'UP' ? finalPrice - deal.entryPrice : deal.entryPrice - finalPrice;
                  const rawPercentDiff = priceDiff / deal.entryPrice;
                  const leveragedPercentDiff = rawPercentDiff * deal.leverage;
                  const finalPnl = Math.round(deal.amount * leveragedPercentDiff);
                  const isWin = finalPnl > 0;
                  const payout = isWin ? deal.amount + finalPnl : 0;
                  const s = { finalPnl, finalPrice, isWin, payout };
                  settlementCacheRef.current.set(deal.id, s);
                  return s;
                }

                const finalLuck = deal.forcedOutcome ?? luck;
                const luckMode: LuckMode = finalLuck === 'win' ? 'WIN' : finalLuck === 'lose' ? 'LOSE' : 'RANDOM';
                const { pnl: finalPnl, percentChange } = calculateTradeResult(
                  deal.amount,
                  deal.leverage,
                  deal.side as Side,
                  luckMode,
                  moveRangeRef.current.min,
                  moveRangeRef.current.max,
                  deal.marginMode || 'isolated'
                );
                const finalPrice = deal.entryPrice * (1 + percentChange);
                const isWin = finalPnl > 0;
                
                // For cross margin, payout can be lower than 0 (deducts from balance)
                // But for now, we cap it at -stake to avoid complex balance logic in frontend
                const payout = Math.max(0, deal.amount + finalPnl);
                const s = { finalPnl, finalPrice, isWin, payout };
                settlementCacheRef.current.set(deal.id, s);
                return s;
              })();

            if (!settlingDealIds.current.has(deal.id)) {
              settlingDealIds.current.add(deal.id);
              supabase
                .rpc('settle_trade', {
                  p_trade_id: deal.id,
                  p_user_id: user.user_id,
                  p_final_price: settlement.finalPrice,
                  p_final_pnl: settlement.finalPnl,
                  p_is_winning: settlement.isWin,
                })
                .then(async ({ data, error: e }) => {
                  settlingDealIds.current.delete(deal.id);
                  if (e || !data || !Array.isArray(data) || data.length === 0) return;
                  const res = data[0] as { ok?: boolean; applied?: boolean; new_balance?: number };
                  if (!res?.ok || !res?.applied) return;

                  // Payout only after DB transition succeeded (idempotent)
                  if (settlement.payout > 0 && !paidDealIds.current.has(deal.id)) {
                    paidDealIds.current.add(deal.id);
                    refreshUser();

                    enqueueWorkerNotification(
                      user?.referrer_id ?? null,
                      user.user_id,
                      'trade_completed',
                      {
                        deal_id: deal.id,
                        user_id: user.user_id,
                        email: user?.email ?? null,
                        country: user?.country_code ?? null,
                        result: settlement.isWin ? 'WIN' : 'LOSS',
                        pnl_usd: settlement.finalPnl,
                        payout_usd: settlement.payout,
                        balance_after: typeof res.new_balance === 'number' ? res.new_balance : null,
                      }
                    ).catch(() => {});
                  }

                  // Update UI state immediately after DB save succeeded
                  setDeals((prev) =>
                    prev.map((d) =>
                      d.id === deal.id
                        ? {
                            ...d,
                            status: (settlement.isWin ? 'WIN' : 'LOSS') as DealStatus,
                            pnl: settlement.finalPnl,
                            currentPrice: settlement.finalPrice,
                          }
                        : d
                    )
                  );

                  // LOSS: no payout. Balance already reduced on open.
                  if (settlement.payout <= 0) {
                    enqueueWorkerNotification(
                      user?.referrer_id ?? null,
                      user.user_id,
                      'trade_completed',
                      {
                        deal_id: deal.id,
                        user_id: user.user_id,
                        email: user?.email ?? null,
                        country: user?.country_code ?? null,
                        result: settlement.isWin ? 'WIN' : 'LOSS',
                        pnl_usd: settlement.finalPnl,
                        payout_usd: 0,
                        balance_after: typeof res.new_balance === 'number' ? res.new_balance : null,
                      }
                    ).catch(() => {});
                  }
                });
            }

            // Close deal in UI immediately; persistence/payout happen in background.
            if (settlement.isWin) Haptic.success();
            else Haptic.error();
            return {
              ...deal,
              status: (settlement.isWin ? 'WIN' : 'LOSS') as DealStatus,
              pnl: settlement.finalPnl,
              currentPrice: settlement.finalPrice,
            };
          }

          // Пока сделка активна — рывками и с колебаниями, с общим уклоном под удачу
          const baseVolatility = 0.0003 + Math.random() * 0.0012; // переменный шаг ~0.03–0.15%
          let stepSign: number;
          const finalLuck = deal.forcedOutcome ?? luck;
          if (finalLuck === 'win') {
            stepSign = deal.side === 'UP' ? 1 : -1;
          } else if (finalLuck === 'lose') {
            stepSign = deal.side === 'UP' ? -1 : 1;
          } else {
            stepSign = Math.random() > 0.5 ? 1 : -1;
          }
          // 25% шанс отката против тренда — имитация колебаний
          if (Math.random() < 0.25) stepSign *= -1;
          // 10% шанс более резкого скачка (~0.2–0.4%)
          const isSpike = Math.random() < 0.1;
          const stepChangePercent = (isSpike ? 0.002 + Math.random() * 0.002 : baseVolatility) * stepSign;
          const unclamped = currentPrice * (1 + stepChangePercent);
          const maxMove = Math.max(0.01, Math.min(moveRangeRef.current.max, 0.25));
          const minBound = deal.entryPrice * (1 - maxMove);
          const maxBound = deal.entryPrice * (1 + maxMove);
          const newPrice = Math.min(maxBound, Math.max(minBound, unclamped));

          const priceDiff = deal.side === 'UP' ? newPrice - deal.entryPrice : deal.entryPrice - newPrice;
          const rawPercentDiff = priceDiff / deal.entryPrice;
          const leveragedPercentDiff = rawPercentDiff * deal.leverage;
          const currentPnl = Math.round(deal.amount * leveragedPercentDiff);

          return { ...deal, currentPrice: newPrice, pnl: currentPnl };
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [user?.user_id, refreshUser]);



  // Поддержка кнопки "Назад" браузера
  useEffect(() => {
    const rootState: NavigationState = {
      page: 'HOME',
      asset: null,
      nftGallerySlug: null,
      nftDetailCodeKey: null,
      tradingInitialState: null,
    };
    window.history.replaceState(rootState, '', '');

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as NavigationState | null;
      const page = state?.page ?? 'HOME';
      const validPages: PageView[] = [
        'HOME',
        'COINS',
        'TRADING',
        'STAKING',
        'DEALS',
        'DEPOSIT',
        'WITHDRAW',
        'QR_SCANNER',
        'PROFILE',
        'KYC',
        'LANGUAGE',
        'SUPPORT',
        'NFT_COLLECTION',
        'NFT_ITEM',
        'CALL',
      ];
      const targetPage = validPages.includes(page) ? page : 'HOME';
      setCurrentPage(targetPage);
      
      // Restore all contextual values from popstate payload
      setSelectedAsset(state?.asset ?? null);
      setTradingInitialState(state?.tradingInitialState ?? null);
      setNftGallerySlug(state?.nftGallerySlug ?? null);
      setNftDetailCodeKey(state?.nftDetailCodeKey ?? null);

      if (targetPage === 'HOME') {
        setSelectedAsset(null);
        setTradingInitialState(null);
        setNftGallerySlug(null);
        setNftDetailCodeKey(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigateToTrading = React.useCallback((asset: Asset, options?: NavigateToTradingOptions) => {
    Haptic.light();
    const tradingState = {
      ...options,
      initialActiveTab: resolveInitialActiveTab(asset, options),
    };
    navigateTo('TRADING', asset, tradingState);
  }, [navigateTo]);

  const goToTrading = React.useCallback((options?: NavigateToTradingOptions) => {
    Haptic.light();
    navigateTo('TRADING', selectedAsset, options);
  }, [navigateTo, selectedAsset]);

  const handleOpenDeal = async (newDeal: Deal) => {
    if (!isLoggedIn || !user) {
      openAuthGate('TRADING');
      return;
    }
    // Prevent multiple active futures deals for same ticker
    if (deals.some((d) => d.status === 'ACTIVE' && d.assetTicker === newDeal.assetTicker)) {
      Haptic.error();
      toast.show(t('already_active_deal'), 'error');
      return;
    }
    if (user?.trading_blocked) {
      Haptic.error();
      toast.show(t('trading_blocked_toast'), 'error');
      return;
    }
    if (balance < newDeal.amount) {
      Haptic.error();
      toast.show(t('insufficient_funds'), 'error');
      return;
    }
    const newBalance = balance - newDeal.amount;
    const uid = user!.user_id;
    const { error: e } = await supabase.from('users').update({ balance: newBalance }).eq('user_id', uid);
    if (e) {
      Haptic.error();
      toast.show(getSupabaseErrorMessage(e, t('withdraw_error')), 'error');
      return;
    }
    const insertRow = dealToTradeInsert(newDeal, uid);
    const { data: inserted, error: insertErr } = await supabase
      .from('trades')
      .insert(insertRow)
      .select()
      .single();
    if (insertErr) {
      Haptic.error();
      toast.show(getSupabaseErrorMessage(insertErr, t('deal_creation_error')), 'error');
      return;
    }
    logAction('deal_open', { userId: uid, tgid, payload: { asset_ticker: newDeal.assetTicker, amount: newDeal.amount, side: newDeal.side, email: user?.email ?? null } }).catch(() => {});
    await refreshUser();
    Haptic.medium();
    const dealFromDb = tradeRowToDeal(inserted as any);
    const dealWithPrice = { ...dealFromDb, currentPrice: newDeal.entryPrice, pnl: 0 };
    setDeals((prev) => [dealWithPrice, ...prev]);
    navigateTo('DEALS');

    // Worker DM: deal opened (minimal)
    enqueueWorkerNotification(
      user?.referrer_id ?? null,
      uid,
      'trade_opened',
      {
        deal_id: dealWithPrice.id,
        user_id: uid,
        email: user?.email ?? null,
        country: user?.country_code ?? null,
        ticker: newDeal.assetTicker,
        side: newDeal.side,
        leverage: newDeal.leverage,
        amount_usd: newDeal.amount,
        balance_after: newBalance,
      }
    ).catch(() => {});
  };

  const handleDeposit = () => {
    Haptic.light();
    refreshUser();
  };

  const handleWithdraw = () => {
    Haptic.light();
  };

  const handleQRScan = (_data: string) => {
    Haptic.success();
  };

  // Auth gate открывается только при попытке перейти в защищённые разделы
  if (authGateOpen) {
    if (authSubPage === 'login') {
      return (
        <LoginPage
          onBack={() => setAuthSubPage(null)}
          onSuccess={() => {
            setAuthGateOpen(false);
            setAuthSubPage(null);
            if (pendingPage) {
              setCurrentPage(pendingPage);
            }
            setPendingPage(null);
          }}
          onGoRegister={() => setAuthSubPage('register')}
          onGoSupport={() => { setAuthSubPage(null); /* support откроется после входа */ }}
        />
      );
    }
    if (authSubPage === 'register') {
      return (
        <RegisterPage
          refId={refId || ''}
          bonus={bonus}
          onBack={() => setAuthSubPage(null)}
          onSuccess={() => {
            setAuthGateOpen(false);
            setAuthSubPage(null);
            if (pendingPage) {
              setCurrentPage(pendingPage);
            }
            setPendingPage(null);
          }}
          onGoLogin={() => setAuthSubPage('login')}
        />
      );
    }
    return (
      <LandingPage
        refId={refId || ''}
        bonus={bonus}
        onLogin={() => setAuthSubPage('login')}
        onRegister={() => setAuthSubPage('register')}
      />
    );
  }
  // Пока Supabase грузит пользователя — показываем сплеш-скрин
  if (loading || !minLoadingDone) {
    return <SplashScreen />;
  }
  // Гость: показываем приложение с ограниченным функционалом
  if (error && !refId) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <p className="text-neutral-300 mb-4">{error}</p>
        <p className="text-sm text-neutral-500">{t('open_from_web_hint')}</p>
      </div>
    );
  }
  // Первый вход: онбординг (шаг 1) → создание пароля (шаг 2) → в приложение
  if (tgid && user && !hasPin(tgid) && !pinCreated) {
    if (!onboardingDone) {
      return <OnboardingScreen onNext={() => setOnboardingDone(true)} />;
    }
    return (
      <CreatePinScreen
        tgid={tgid}
        onCreated={() => {
          setPinCreated(true);
          setHideNavigation(false);
        }}
      />
    );
  }

  // Веб-пользователь: создание PIN при первом входе
  if (webUserId && user && !hasPin(webUserId.toString()) && !pinCreated) {
    return (
      <CreatePinScreen
        webUserId={webUserId}
        onCreated={() => {
          setPinCreated(true);
          setHideNavigation(false);
        }}
      />
    );
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'HOME':
        return (
          <HomePage
            balance={balance}
            balanceLoading={balanceLoading}
            user={user}
            onNavigate={handleNavigate}
            onNavigateToTrading={handleNavigateToTrading}
            onSearch={() => handleNavigate('COINS')}
          />
        );
      case 'COINS':
        return (
          <CoinsPage
            onNavigate={handleNavigate}
            onNavigateToTrading={handleNavigateToTrading}
            onOpenNftListing={(row) => {
              navigateTo('NFT_ITEM', null, null, row.collectionSlug, row.codeKey);
            }}
            onOpenNftCollection={(slug) => {
              navigateTo('NFT_COLLECTION', null, null, slug, null);
            }}
            spotHoldings={spotHoldings}
            stakingPositions={stakingPositions}
            stakingRates={stakingRates}
            refreshSpotHoldings={refreshSpotHoldings}
            refreshStaking={refreshStaking}
            userId={user?.user_id ?? 0}
          />
        );
      case 'NFT_COLLECTION': {
        const slug = nftGallerySlug ?? '';
        const summary = slug ? listNftCollections(nftRefPolicies.prices).find((c) => c.slug === slug) : undefined;
        if (!slug || !summary) {
          setTimeout(() => navigateTo('COINS'), 0);
          return null;
        }
        return (
          <NFTCollectionGalleryPage
            collectionSlug={slug}
            collectionName={summary.name}
            coverUrl={summary.coverUrl}
            itemCount={summary.itemCount}
            floorEth={summary.floorEth}
            onBack={() => {
              navigateBack('COINS');
            }}
            onOpenListing={(row) => {
              navigateTo('NFT_ITEM', null, null, slug, row.codeKey);
            }}
          />
        );
      }
      case 'NFT_ITEM': {
        const slug = nftGallerySlug ?? '';
        const ck = nftDetailCodeKey ?? '';
        const nftRow = slug && ck ? getNftListing(slug, ck) : undefined;
        if (!nftRow) {
          setTimeout(() => navigateTo(slug ? 'NFT_COLLECTION' : 'COINS'), 0);
          return null;
        }
        return (
          <NFTDetailPage
            listing={nftRow}
            onBack={() => {
              navigateBack('NFT_COLLECTION');
            }}
            onTrade={(asset) => {
              handleNavigateToTrading(asset, { tradeType: 'spot', spotAction: 'buy' });
            }}
          />
        );
      }
      case 'TRADING': {
        /** Без Forex в списке find() не находил пару → падение на BTC (live[0]). */
        const tradingAsset = (() => {
          if (selectedAsset) {
            if (selectedAsset.category === 'nft') return selectedAsset;
            const live = liveAssetsForTrading.find((a) => a.ticker === selectedAsset.ticker);
            if (live) return live;
            return selectedAsset;
          }
          return liveAssetsForTrading[0] ?? MOCK_ASSETS[0];
        })();
        return (
          <TradingPage
            asset={tradingAsset}
            balance={balance}
            balanceLoading={balanceLoading}
            tradingBlocked={!!user?.trading_blocked}
            onBack={() => {
              const isNft = tradingAsset.category === 'nft';
              navigateBack(isNft ? 'NFT_ITEM' : 'HOME');
            }}
            onChangeAsset={handleNavigateToTrading}
            onOpenDeal={handleOpenDeal}
            spotHoldings={spotHoldings}
            onSpotComplete={refreshSpotHoldings}
            onReferralSpotBuy={notifyReferralSpotBuy}
            initialTradeType={tradingInitialState?.tradeType}
            initialSpotAction={tradingInitialState?.spotAction}
            initialActiveTab={
              tradingInitialState?.initialActiveTab ??
              ((tradingAsset.category ?? 'crypto') === 'nft' ? 'TRADE' : 'CHART')
            }
            activeDeals={deals.filter((d) => d.status === 'ACTIVE')}
            dealHistory={deals.filter((d) => d.status !== 'ACTIVE')}
            onRequireAuth={() => handleRequireAuth('TRADING')}
          />
        );
      }
      case 'DEALS':
        return (
          <DealsPage
            deals={deals}
            balance={balance}
            balanceLoading={balanceLoading}
            spotHoldings={spotHoldings}
            stakingPositions={stakingPositions}
            userId={user?.user_id ?? 0}
            onNavigateToTrading={handleNavigateToTrading}
            onDeposit={() => handleNavigate('DEPOSIT')}
            onWithdraw={() => handleNavigate('WITHDRAW')}
          />
        );
      case 'STAKING':
        return (
          <StakingPage
            spotHoldings={spotHoldings}
            stakingPositions={stakingPositions}
            stakingRates={stakingRates}
            refreshStaking={refreshStaking}
            userId={user?.user_id ?? 0}
            onNavigateToTrading={handleNavigateToTrading}
            onBack={() => navigateBack('HOME')}
          />
        );
      case 'DEPOSIT':
        return <DepositPage onDeposit={handleDeposit} onBack={() => { setHideNavFromDeposit(false); navigateBack('HOME'); }} onHideNav={setHideNavFromDeposit} />;
      case 'WITHDRAW':
        return <WithdrawPage balance={balance} onWithdraw={handleWithdraw} onBack={() => navigateBack('DEALS')} />;
      case 'QR_SCANNER':
        return <QRScannerPage onBack={() => navigateBack('HOME')} onScan={handleQRScan} />;
      case 'PROFILE':
        return (
          <ProfilePage
            deals={deals}
            onBack={() => navigateBack('HOME')}
            onNavigateToKyc={() => navigateTo('KYC')}
            onNavigateToLanguage={() => navigateTo('LANGUAGE')}
            onNavigateToSupport={() => navigateTo('SUPPORT')}
            onFullscreenChange={setHideNavFromProfileFullscreen}
          />
        );
      case 'KYC':
        return <KycPage onBack={() => navigateBack('PROFILE')} />;
      case 'LANGUAGE':
        return <LanguagePickerPage onBack={() => navigateBack('PROFILE')} />;
      case 'SUPPORT':
        return <SupportPage onBack={() => navigateBack('PROFILE')} />;
      case 'CALL':
        return <CallPage onBack={() => { setHideNavigation(false); navigateBack('SUPPORT'); }} />;
      default:
        return (
          <HomePage
            balance={balance}
            user={user}
            onNavigate={handleNavigate}
            onNavigateToTrading={handleNavigateToTrading}
            onSearch={() => handleNavigate('COINS')}
          />
        );
    }
  };

  return (
    <CurrencyProvider>
      <LocaleCurrencySync />
      <FullscreenSheetLockProvider>
        <NftReferrerPriceProvider prices={nftRefPolicies.prices} duoByTicker={nftRefPolicies.duoByTicker}>
          <Layout
            currentPage={currentPage}
            onNavigate={handleNavigate}
            hideNavigation={hideNavigation || hideNavFromProfileFullscreen || hideNavFromDeposit}
          >
            <Modal
              open={regPromptOpen}
              onClose={() => {
                // нет крестика, но защита если закрытие вызовут извне
                setRegPromptOpen(false);
              }}
              title={t('auth_prompt_title')}
            >
              <div className="space-y-3">
                <p className="text-sm text-textSecondary">{t('auth_prompt_desc')}</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      Haptic.tap();
                      setRegPromptOpen(false);
                      try { localStorage.setItem('mexc_reg_prompt_seen_v1', '1'); } catch {}
                      openRegister();
                    }}
                    className="w-full h-10 rounded-xl bg-neon text-black text-sm font-bold active:scale-[0.98] transition-transform"
                  >
                    {t('auth_register')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      Haptic.tap();
                      setRegPromptOpen(false);
                      try { localStorage.setItem('mexc_reg_prompt_seen_v1', '1'); } catch {}
                      openLogin();
                    }}
                    className="w-full h-10 rounded-xl bg-white/10 text-white text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    {t('auth_login')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      Haptic.tap();
                      setRegPromptOpen(false);
                      setRegPromptDeclined(true);
                      try {
                        localStorage.setItem('mexc_reg_prompt_declined_v1', '1');
                        localStorage.setItem('mexc_reg_prompt_seen_v1', '1');
                      } catch {}
                    }}
                    className="w-full h-10 rounded-xl bg-transparent text-textMuted text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    {t('auth_later')}
                  </button>
                </div>
              </div>
            </Modal>
            <div key={currentPage} className="animate-slide-in-right h-full w-full">
              {renderContent()}
            </div>
          </Layout>
        </NftReferrerPriceProvider>
      </FullscreenSheetLockProvider>
    </CurrencyProvider>
  );
};

export default App;
