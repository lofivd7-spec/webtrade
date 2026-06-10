import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import AssetTable from '../components/AssetTable';
import Skeleton from '../components/Skeleton';
import { MOCK_ASSETS } from '../constants';
import { Asset, PageView, type NavigateToTradingOptions } from '../types';
import { useLiveAssets } from '../utils/useLiveAssets';
import {
  Gift,
  Headphones,
  MoreHorizontal,
  Rocket,
  Search,
  Sparkles,
  Ticket,
  User,
  Users,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Scan,
  Gem,
} from 'lucide-react';
import { Haptic } from '../utils/haptics';
import { useCurrency } from '../context/CurrencyContext';
import { useHideOnScroll } from '../utils/useHideOnScroll';
import { supabase } from '../lib/supabase';
import BottomSheet from '../components/BottomSheet';
import CryptoBannerWidget from '../components/CryptoBannerWidget';
import UserAvatar from '../components/UserAvatar';

interface HomePageProps {
    balance: number;
    balanceLoading?: boolean;
    user: import('../context/UserContext').DbUser | null;
    onNavigateToTrading: (asset: Asset, options?: NavigateToTradingOptions) => void;
    onSearch: () => void;
    onNavigate: (page: PageView) => void;
    onCurrencyClick?: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ balance, balanceLoading = false, user, onNavigateToTrading, onSearch, onNavigate, onCurrencyClick }) => {
  const { t } = useLanguage();
  const { formatPrice, currencyCode } = useCurrency();
  const liveAssets = useLiveAssets(MOCK_ASSETS);

  const [searchValue, setSearchValue] = useState('GOLD(XAUT)');
  const topBarHidden = useHideOnScroll();

  const totalAssetsText = useMemo(() => {
    const n = Number(balance);
    if (!Number.isFinite(n) || n <= 0) return '0';
    return formatPrice(n, { fractionDigits: n < 1 ? 4 : 0 });
  }, [balance, formatPrice]);

  // Мягкая “пульсация” баннера как в приложениях бирж
  const [promoTick, setPromoTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPromoTick((v) => (v + 1) % 1000), 3500);
    return () => window.clearInterval(id);
  }, []);

  const [workerEvent, setWorkerEvent] = useState<{
    title: string;
    bonus: string | null;
    body: string;
    image_url: string;
  } | null>(null);
  const [eventOpen, setEventOpen] = useState(false);

  useEffect(() => {
    const wid = user?.referrer_id;
    if (!wid) {
      setWorkerEvent(null);
      return;
    }
    supabase
      .from('worker_events')
      .select('title, bonus, body, image_url')
      .eq('worker_id', wid)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error) return;
        const row = (data as any[])?.[0];
        if (row?.image_url && row?.title && row?.body) {
          setWorkerEvent(row);
        } else {
          setWorkerEvent(null);
        }
      });
  }, [user?.user_id, user?.referrer_id, promoTick]);

  return (
    <div className="flex flex-col min-h-full animate-fade-in px-4 lg:px-6 lg:max-w-5xl mx-auto pb-28 lg:pb-12">
      {/* Top bar (как у MEXC) */}
      <header
        className={[
          'sticky top-0 z-40 -mx-4 lg:-mx-6 px-4 lg:px-6',
          'pt-2 pb-1.5',
          'bg-background/85 backdrop-blur-xl',
          'hairline-bottom',
          'transition-transform duration-200',
          topBarHidden ? '-translate-y-full' : 'translate-y-0',
        ].join(' ')}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => { Haptic.tap(); onNavigate('PROFILE'); }}
            className="touch-target h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/5 active:scale-95 transition-all shrink-0"
            aria-label={t('profile')}
          >
            <UserAvatar
              name={user?.full_name || user?.username || user?.email || t('profile')}
              photoUrl={user?.photo_url}
              className="h-6.5 w-6.5"
              imageClassName="border-neutral-700"
              fallbackClassName="bg-neutral-800 border-neutral-700 text-textSecondary text-[10px]"
              iconClassName="text-textSecondary"
              iconSize={12}
            />
          </button>

          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => { Haptic.tap(); onSearch(); }}
              className="w-full h-9 rounded-full bg-white/5 flex items-center gap-2 px-3.5 text-left active:scale-[0.99] transition-transform"
            >
              <Search size={14} className="text-textSubtle shrink-0" />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="bg-transparent outline-none text-xs text-textPrimary placeholder:text-textSubtle w-full min-w-0 font-medium"
                placeholder={t('search')}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { Haptic.tap(); onNavigate('SUPPORT'); }}
              className="touch-target h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/5 active:scale-95 transition-all text-textSecondary hover:text-textPrimary"
              aria-label={t('support')}
            >
              <Headphones size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Balance row + Deposit */}
      <section className="pt-2 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex flex-col justify-center">
            <div className="text-textSubtle text-xs leading-none">{t('home_total_assets')}</div>
            <div className="flex items-baseline gap-2 mt-1">
              {balanceLoading ? (
                <Skeleton className="w-28 h-8 rounded-lg bg-card/60" />
              ) : (
                <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums leading-[1]">
                  {totalAssetsText}
                </span>
              )}
              <div className="flex items-center gap-1 text-textSubtle text-xs leading-none">
                <span className="font-semibold uppercase tracking-wider">{currencyCode}</span>
              </div>
            </div>
            

          </div>

          <button
            type="button"
            onClick={() => { Haptic.tap(); onNavigate('DEPOSIT'); }}
            className="touch-target exchange-btn exchange-btn-primary px-4 h-10 rounded-full text-sm active:scale-[0.98] flex items-center justify-center animate-none"
          >
            {t('deposit')}
          </button>
        </div>
      </section>

      {/* “Complete Your Futures Trade” style banner */}
      <section className="pb-4">
        <div
          className="bg-white/5 rounded-xl px-3.5 py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-xs text-textPrimary truncate">
              3/3&nbsp;&nbsp;{t('home_complete_futures_banner')}
              <span className="text-neon font-semibold">&nbsp;{t('home_try_now')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { Haptic.tap(); onNavigate('TRADING'); }}
            className="touch-target h-8 px-3 rounded-xl exchange-btn-secondary text-textPrimary text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            {t('home_go')}
          </button>
        </div>
      </section>

      {/* Quick actions grid */}
      <section className="pb-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: t('deposit'), Icon: ArrowDownLeft, badge: null, onClick: () => onNavigate('DEPOSIT') },
            { label: t('staking_title'), Icon: Gem, badge: null, onClick: () => onNavigate('STAKING') },
            { label: t('quick_scan'), Icon: Scan, badge: null, onClick: () => onNavigate('QR_SCANNER') },
            { label: t('profile'), Icon: User, badge: null, onClick: () => onNavigate('PROFILE') },
          ].map(({ label, Icon, badge, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={() => { Haptic.tap(); onClick(); }}
              className="touch-target flex flex-col items-center justify-center gap-2 active:scale-[0.95] transition-transform relative py-1"
            >
              {badge ? (
                <span className="absolute top-1 right-2 text-[9px] font-bold text-white bg-neon rounded-full px-1.5 py-0.5 z-10">
                  {badge}
                </span>
              ) : null}
              <div className="h-12 w-12 rounded-full bg-white/5 hover:bg-white/8 flex items-center justify-center transition-colors">
                <Icon size={18} className="text-textPrimary" />
              </div>
              <span className="text-[11px] text-textSecondary font-semibold tracking-tight text-center leading-none">
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Special offer */}
      <section className="pb-5">
        <button
          type="button"
          onClick={() => {
            Haptic.tap();
            if (workerEvent) {
              setEventOpen(true);
              return;
            }
            // Если в P2P-deposit осталась активная сделка, DepositPage восстановит её автоматически.
            // Для промо-баннера это выглядит как баг → всегда начинаем пополнение с нуля.
            try { localStorage.removeItem('etoro_active_p2p_deal'); } catch {}
            try { localStorage.removeItem('etoro_active_deposit'); } catch {}
            onNavigate('DEPOSIT');
          }}
          className="w-full text-left rounded-2xl overflow-hidden exchange-card active:scale-[0.99] transition-transform"
          aria-label={t('special_offer')}
        >
          <div className="relative">
            <img
              src={workerEvent?.image_url || "/mexc-special-offer.jpg"}
              alt=""
              className="w-full h-[160px] sm:h-[180px] object-cover"
              loading="lazy"
              decoding="async"
            />
            {!workerEvent && <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent" />}

            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/35 backdrop-blur px-2.5 py-1.5">
              <img src="/mexc-logo.png" alt="" className="h-4 w-auto opacity-95" />
              <span className="text-[11px] font-semibold text-white/90">{workerEvent ? workerEvent.title : t('special_offer')}</span>
            </div>

            <div className="absolute left-4 bottom-4">
              <div className="inline-flex items-center gap-2 px-3 h-8.5 rounded-full bg-neon text-black text-xs font-bold">
                {workerEvent?.bonus ? workerEvent.bonus : t('quick_deposit')}
                <ArrowDownLeft size={14} />
              </div>
            </div>
          </div>
        </button>

        <CryptoBannerWidget />
        {workerEvent && (
          <BottomSheet
            open={eventOpen}
            onClose={() => setEventOpen(false)}
            title={workerEvent.title}
            variant="fullscreen"
            closeOnBackdrop
            showCloseButton
            stickyHeader={false}
            showHeaderDivider={false}
            contentClassName="bg-[#06090e] max-w-none"
          >
            <div className="-m-4">
              <div className="relative w-full aspect-video bg-black/40 overflow-hidden">
                <img
                  src={workerEvent.image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                {workerEvent.bonus ? (
                  <div className="absolute left-4 bottom-4 inline-flex items-center gap-2 px-3 h-8.5 rounded-full bg-neon text-black text-xs font-bold">
                    {workerEvent.bonus}
                    <Gift size={14} />
                  </div>
                ) : null}
              </div>
              <div className="p-4 space-y-3">
                <div className="text-base font-bold text-textPrimary">{workerEvent.title}</div>
                <div className="text-sm text-textSecondary whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">
                  {workerEvent.body}
                </div>
              </div>
            </div>
          </BottomSheet>
        )}
      </section>

      {/* Top assets */}
      <section className="pt-1">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-textPrimary">{t('home_top_assets')}</h2>
          <button
            type="button"
            onClick={() => { Haptic.tap(); onNavigate('COINS'); }}
            className="text-xs font-semibold text-neon"
          >
            {t('home_view_all')}
          </button>
        </div>

        {liveAssets.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <Skeleton key={idx} className="w-full h-14 rounded-lg bg-card/60" />
            ))}
          </div>
        ) : (
          <div className="-mx-1 bg-transparent">
            <AssetTable assets={liveAssets} onAssetClick={onNavigateToTrading} hideFilterBar variant="minimal" />
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
