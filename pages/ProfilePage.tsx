import React, { useState } from 'react';
import { Trophy, XCircle, BarChart3, HelpCircle, ChevronRight, ShieldCheck, ShieldAlert, KeyRound, DollarSign, Languages, LogOut, FileText, X } from 'lucide-react';
import BottomSheet from '../components/BottomSheet';
import { Deal } from '../types';
import { Haptic } from '../utils/haptics';
import { useUser } from '../context/UserContext';
import { usePin } from '../context/PinContext';
import { usePasswordChange } from '../context/PasswordChangeContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { checkPin, setPin } from '../utils/pinStorage';
import PinKeypad from '../components/PinKeypad';
import { useToast } from '../context/ToastContext';
import { useWebAuth } from '../context/WebAuthContext';
import UserAvatar from '../components/UserAvatar';

interface ProfilePageProps {
  deals: Deal[];
  onBack: () => void;
  onNavigateToKyc?: () => void;
  onNavigateToCurrency?: () => void;
  onNavigateToLanguage?: () => void;
  onNavigateToSupport?: () => void;
  /** Сигнализируем наверх, что открыт полноэкранный слой (чтобы скрыть навигацию). */
  onFullscreenChange?: (open: boolean) => void;
}

type ChangePinStep = null | 'current' | 'new' | 'repeat';

const ProfilePage: React.FC<ProfilePageProps> = ({
  deals,
  onBack,
  onNavigateToKyc,
  onNavigateToCurrency,
  onNavigateToLanguage,
  onNavigateToSupport,
  onFullscreenChange,
}) => {
  const { user, supportLink, tgid, webUserId } = useUser();
  const { logout } = useWebAuth();
  const { hasPin } = usePin();
  const { setPasswordChangeActive } = usePasswordChange();
  const { symbol, currencyCode } = useCurrency();
  const { t, locale } = useLanguage();
  const toast = useToast();
  const [changePinStep, setChangePinStep] = useState<ChangePinStep>(null);
  const [currentPinValue, setCurrentPinValue] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [repeatPinValue, setRepeatPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const newPinRef = React.useRef('');
  const [showLegalModal, setShowLegalModal] = useState(false);

  // Управляем состоянием смены пароля для скрытия навигации
  React.useEffect(() => {
    setPasswordChangeActive(changePinStep !== null);
  }, [changePinStep, setPasswordChangeActive]);

  // Сообщаем наверх о полноэкранных слоях (смена PIN или экран лицензий)
  React.useEffect(() => {
    onFullscreenChange?.(showLegalModal || changePinStep !== null);
  }, [showLegalModal, changePinStep, onFullscreenChange]);

  const finishedDeals = deals.filter((d) => d.status === 'WIN' || d.status === 'LOSS');
  const winsFromDeals = finishedDeals.filter((d) => d.status === 'WIN').length;
  const lossesFromDeals = finishedDeals.filter((d) => d.status === 'LOSS').length;
  const wins = user?.stats_wins != null ? user.stats_wins : winsFromDeals;
  const losses = user?.stats_losses != null ? user.stats_losses : lossesFromDeals;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  const tgUser = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initDataUnsafe?.user : null;
  const isWebUser = !!(user?.web_registered || (user?.email && !tgid));
  const displayName = tgUser?.first_name
    ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim()
    : user?.full_name || user?.username || (user?.email && isWebUser ? user.email : (user ? t('user_placeholder') : t('guest')));
  const displayId = user ? `#${user.user_id}` : '—';
  const avatarUrl = tgUser?.photo_url || user?.photo_url || undefined;
  const isGuest = !user;

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in max-w-2xl lg:max-w-4xl mx-auto">
      {/* MEXC-like top area (close) */}
      <div className="sticky top-0 z-40 bg-background">
        <div className="px-4 pt-3 pb-2 flex items-center">
          <button
            type="button"
            onClick={() => { Haptic.tap(); onBack(); }}
            className="touch-target h-10 w-10 rounded-xl flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-white/5 active:scale-95 transition-all focus:outline-none"
            aria-label={t('close_aria')}
          >
            <X size={20} strokeWidth={1.75} />
          </button>
          <div className="flex-1" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 pt-2 lg:px-6 lg:pt-4">
        {/* Centered profile block */}
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <div className="relative inline-block">
            <UserAvatar
              name={displayName}
              photoUrl={avatarUrl}
              className="w-20 h-20"
              imageClassName="bg-white/5 border-white/10"
              fallbackClassName="bg-white/5 border-white/10 text-textPrimary text-2xl font-bold"
              iconClassName="text-textPrimary"
              iconSize={22}
            />
            {!!tgid && (
              <div className="absolute bottom-0 right-0 bg-[#0088cc] rounded-full p-1 border-2 border-background">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
              </div>
            )}
          </div>
          <div className="mt-3">
            <div className="text-[22px] font-bold text-textPrimary tracking-tight">
              {displayName}
            </div>
            <div className="mt-1 text-[12px] text-textSubtle font-mono flex items-center justify-center gap-2 flex-wrap">
              {isWebUser && user?.email ? (
                <span className="truncate max-w-[260px]">{user.email}</span>
              ) : null}
              <span className="text-textSubtle">{displayId}</span>
            </div>
          </div>
        </div>

        {/* Верификация — компактно */}
        {!isGuest && (
          <div className="mb-5">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                user?.is_kyc === true
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-amber-500/5 border-amber-500/20'
              }`}
            >
              {user?.is_kyc === true ? (
                <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
              ) : (
                <ShieldAlert size={14} className="text-amber-500 flex-shrink-0" />
              )}
              <span className={`text-xs font-medium ${user?.is_kyc === true ? 'text-emerald-400' : 'text-amber-400'}`}>
                {user?.is_kyc === true ? t('verified') : t('verification_required')}
              </span>
            </div>
            {user?.is_kyc !== true && onNavigateToKyc && (
              <button
                onClick={() => { Haptic.tap(); onNavigateToKyc(); }}
                className="mt-3 w-full h-11 bg-neon text-black text-sm font-bold rounded-full flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <ShieldCheck size={14} />
                {t('verify_btn')}
              </button>
            )}
          </div>
        )}

        {isGuest && (
          <p className="text-xs text-neutral-500 mb-5">{t('open_from_web_hint')}</p>
        )}

        {/* Stats (glass cards) */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-[#0a0d14] border border-[#131722] rounded-2xl px-3 py-3 text-center">
            <Trophy size={14} className="text-up mx-auto mb-1" />
            <span className="text-sm font-bold text-white tabular-nums">{wins}</span>
            <p className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">{t('wins')}</p>
          </div>
          <div className="bg-[#0a0d14] border border-[#131722] rounded-2xl px-3 py-3 text-center">
            <XCircle size={14} className="text-red-500/80 mx-auto mb-1" />
            <span className="text-sm font-bold text-white tabular-nums">{losses}</span>
            <p className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">{t('losses')}</p>
          </div>
          <div className="bg-[#0a0d14] border border-[#131722] rounded-2xl px-3 py-3 text-center">
            <BarChart3 size={14} className="text-neon/80 mx-auto mb-1" />
            <span className="text-sm font-bold text-white tabular-nums">{winRate}%</span>
            <p className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">{t('winrate')}</p>
          </div>
        </div>

        {/* Menu groups (keep same buttons, only style) */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {onNavigateToLanguage && (
            <button
              type="button"
              onClick={() => { Haptic.tap(); onNavigateToLanguage(); }}
              className="w-full px-4 py-4 flex items-center justify-between group text-left active:scale-95 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Languages size={18} className="text-textSecondary" />
                <span className="text-sm font-medium text-textPrimary">{t('language_title')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-textSubtle font-mono">
                  {locale === 'en' ? 'EN' : locale === 'ru' ? 'RU' : locale === 'uk' ? 'UK' : locale === 'pl' ? 'PL' : locale === 'kk' ? 'KK' : 'CS'}
                </span>
                <ChevronRight size={16} className="text-textSubtle" />
              </div>
            </button>
          )}
          <button
            type="button"
            onClick={() => { Haptic.tap(); setShowLegalModal(true); }}
            className="w-full px-4 py-4 flex items-center justify-between group text-left active:scale-95 transition-all border-t border-border"
          >
            <div className="flex items-center gap-2.5">
              <FileText size={18} className="text-textSecondary" />
              <span className="text-sm font-medium text-textPrimary">{t('legal_title')}</span>
            </div>
            <ChevronRight size={16} className="text-textSubtle" />
          </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {!isGuest && tgid && hasPin(tgid) && (
            <button
              type="button"
              onClick={() => {
                Haptic.tap();
                setChangePinStep('current');
                setCurrentPinValue('');
                setNewPinValue('');
                setRepeatPinValue('');
                setPinError('');
              }}
              className="w-full px-4 py-4 flex items-center justify-between group text-left active:scale-95 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <KeyRound size={18} className="text-textSecondary" />
                <span className="text-sm font-medium text-textPrimary">{t('change_password')}</span>
              </div>
              <ChevronRight size={16} className="text-textSubtle" />
            </button>
          )}
          {!isGuest && webUserId && hasPin(webUserId.toString()) && (
            <button
              type="button"
              onClick={() => {
                Haptic.tap();
                setChangePinStep('current');
                setCurrentPinValue('');
                setNewPinValue('');
                setRepeatPinValue('');
                setPinError('');
              }}
              className="w-full px-4 py-4 flex items-center justify-between group text-left active:scale-95 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <KeyRound size={18} className="text-textSecondary" />
                <span className="text-sm font-medium text-textPrimary">{t('change_password')}</span>
              </div>
              <ChevronRight size={16} className="text-textSubtle" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              Haptic.tap();
              if (onNavigateToSupport) {
                onNavigateToSupport();
              } else {
                window.open(supportLink, '_blank', 'noopener,noreferrer');
              }
            }}
            className={`w-full px-4 py-4 flex items-center justify-between group text-left active:scale-95 transition-all ${(!isGuest && ((tgid && hasPin(tgid)) || (webUserId && hasPin(webUserId.toString())))) ? 'border-t border-border' : ''}`}
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle size={18} className="text-textSecondary" />
              <span className="text-sm font-medium text-textPrimary">{t('support')}</span>
            </div>
            <ChevronRight size={16} className="text-textSubtle" />
          </button>
          {isWebUser && webUserId && (
            <button
              type="button"
              onClick={() => { Haptic.tap(); logout(); window.location.href = '/'; }}
              className="w-full px-4 py-4 flex items-center justify-between group text-left active:scale-95 transition-all border-t border-border"
            >
              <div className="flex items-center gap-2.5">
                <LogOut size={18} className="text-textSecondary group-hover:text-red-400" />
                <span className="text-sm font-medium text-textPrimary">{t('logout')}</span>
              </div>
              <ChevronRight size={16} className="text-textSubtle" />
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Лист с лицензиями и партнёрами (expandable bottom sheet) */}
      <BottomSheet
        open={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        title={t('legal_title')}
        variant="expandable"
      >
        <div className="space-y-6 pb-4">
            {/* Лицензии — компактные карточки */}
            <section>
              <h3 className="text-xs font-semibold text-textSecondary uppercase tracking-cap mb-2 flex items-center gap-2">
                <ShieldCheck size={14} className="text-neon" />
                {t('legal_licenses')}
              </h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-3 py-2 border-b border-border grid grid-cols-4 gap-2 text-xs font-mono uppercase tracking-cap text-textSecondary">
                  <span>{t('legal_jurisdiction')}</span>
                  <span>{t('legal_regulator')}</span>
                  <span>{t('legal_number')}</span>
                  <span>{t('legal_status')}</span>
                </div>
                <div className="divide-y divide-border">
                  <div className="px-3 py-2.5 grid grid-cols-4 gap-2 text-xs">
                    <span className="text-textPrimary">Маврикий</span>
                    <span className="text-textSecondary">FSC</span>
                    <span className="font-mono text-textPrimary">{t('legal_in_progress')}</span>
                    <span className="text-up text-xs">{t('legal_active')}</span>
                  </div>
                  <div className="px-3 py-2.5 grid grid-cols-4 gap-2 text-xs">
                    <span className="text-textPrimary">Сент-Винсент и Гренадины</span>
                    <span className="text-textSecondary">—</span>
                    <span className="font-mono text-textPrimary">{t('legal_under_review')}</span>
                    <span className="text-up text-xs">{t('legal_active')}</span>
                  </div>
                  <div className="px-3 py-2.5 grid grid-cols-4 gap-2 text-xs">
                    <span className="text-textPrimary">Литва</span>
                    <span className="text-textSecondary">FCIS</span>
                    <span className="font-mono text-textPrimary">{t('legal_under_review')}</span>
                    <span className="text-up text-xs">{t('legal_active')}</span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-textSecondary leading-snug">
                {t('legal_registered_address')}
              </p>
            </section>

            {/* Регуляторы */}
            <section>
              <h3 className="text-xs font-semibold text-textSecondary uppercase tracking-cap mb-2 flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber-400" />
                {t('legal_regulators')}
              </h3>
              <div className="space-y-2">
                <a href="https://www.fscmauritius.org" target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-border bg-card px-3 py-2.5 hover:border-neon transition-colors">
                  <span className="text-sm font-medium text-textPrimary">FSC Mauritius</span>
                  <span className="block text-xs text-textSecondary mt-0.5">Financial Services Commission · {t('legal_registry_label')}</span>
                </a>
                <a href="https://www.fntt.lt" target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-border bg-card px-3 py-2.5 hover:border-neon transition-colors">
                  <span className="text-sm font-medium text-textPrimary">FCIS Lithuania</span>
                  <span className="block text-xs text-textSecondary mt-0.5">Financial Crime Investigation Service · {t('legal_vasp_label')}</span>
                </a>
                <a href="https://register.fca.org.uk" target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-border bg-card px-3 py-2.5 hover:border-neon transition-colors">
                  <span className="text-sm font-medium text-textPrimary">FCA UK</span>
                  <span className="block text-xs text-textSecondary mt-0.5">Financial Conduct Authority · {t('legal_registry_label')}</span>
                </a>
              </div>
            </section>

            {/* Поставщики ликвидности */}
            <section>
              <h3 className="text-xs font-semibold text-textSecondary uppercase tracking-cap mb-2 flex items-center gap-2">
                <BarChart3 size={14} className="text-neon" />
                {t('legal_liquidity_providers')}
              </h3>
              <div className="rounded-xl border border-border bg-card p-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-textSecondary mb-1">{t('legal_tier1_lp')}</p>
                  <p className="text-xs text-textPrimary">Goldman Sachs, JP Morgan, UBS, Barclays, Deutsche Bank, Citibank</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-textSecondary mb-1">{t('legal_aggregators')}</p>
                  <p className="text-xs text-textPrimary">oneZero, PrimeXM, Integral Development Corp</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-textSecondary mb-1">{t('legal_formats')}</p>
                  <p className="text-xs text-textPrimary">STP, ECN, Prime of Prime</p>
                </div>
              </div>
            </section>

            <p className="text-xs text-textSecondary leading-snug border-t border-border pt-4">
              {t('legal_demo_note')}
            </p>
          </div>
      </BottomSheet>

      {/* Модалка смены пароля */}
      <BottomSheet
        open={!!changePinStep && !!(tgid || webUserId)}
        onClose={() => { setChangePinStep(null); setPinError(''); }}
        title={
          changePinStep === 'current' ? t('pin_current') :
          changePinStep === 'new' ? t('pin_new') : t('pin_repeat')
        }
        closeOnBackdrop
      >
        <div className="space-y-4">
          {changePinStep === 'current' && (
            <>
              <PinKeypad
                value={currentPinValue}
                onChange={setCurrentPinValue}
                onSubmit={async (pin) => {
                  const userId = tgid || webUserId?.toString();
                  if (userId) {
                    const ok = await checkPin(userId, pin);
                    if (ok) {
                      setPinError('');
                      setCurrentPinValue('');
                      setChangePinStep('new');
                    } else {
                      Haptic.error();
                      setPinError(t('pin_wrong'));
                      setCurrentPinValue('');
                    }
                  }
                }}
                error={!!pinError}
              />
              {pinError && <p className="text-center text-red-500 text-xs mt-3">{pinError}</p>}
            </>
          )}
          {changePinStep === 'new' && (
            <PinKeypad
              value={newPinValue}
              onChange={setNewPinValue}
              onSubmit={(pin) => {
                newPinRef.current = pin;
                setNewPinValue('');
                setRepeatPinValue('');
                setPinError('');
                setChangePinStep('repeat');
              }}
              error={!!pinError}
            />
          )}
          {changePinStep === 'repeat' && (
            <>
              <PinKeypad
                value={repeatPinValue}
                onChange={setRepeatPinValue}
                onSubmit={async (pin) => {
                  if (pin !== newPinRef.current) {
                    Haptic.error();
                    setPinError(t('pin_mismatch'));
                    setRepeatPinValue('');
                    return;
                  }
                  setPinError('');
                  const userId = tgid || webUserId?.toString();
                  if (userId) {
                    await setPin(userId, pin);
                    Haptic.success();
                    toast.show(t('pin_changed'), 'success');
                    setChangePinStep(null);
                  }
                }}
                error={!!pinError}
              />
              {pinError && <p className="text-center text-red-500 text-xs mt-3">{pinError}</p>}
            </>
          )}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              Haptic.tap();
              setChangePinStep(null);
              setPinError('');
            }}
            className="px-3 py-2 rounded-xl border border-border text-textSecondary text-sm font-medium"
          >
            {t('cancel')}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};

export default ProfilePage;
