import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ArrowLeftRight, Loader2, BarChart3, ArrowLeftRight as ConvertIcon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCurrency } from '../context/CurrencyContext';
import { useUser } from '../context/UserContext';
import { Haptic } from '../utils/haptics';
import { useLiveAssets } from '../utils/useLiveAssets';
import { MARKET_ASSETS } from '../constants';
import { spotBuy, spotSell } from '../lib/spot';
import { useToast } from '../context/ToastContext';
import ExchangeAssetPicker, { type ExchangeSide } from '../components/ExchangeAssetPicker';
import type { SpotHolding } from '../types';

const MIN_EXCHANGE_USD = 1;

interface ExchangePageProps {
  spotHoldings: SpotHolding[];
  refreshSpotHoldings: () => Promise<void>;
  onPickerOpenChange?: (open: boolean) => void;
  onBack: () => void;
  onRequireAuth?: () => void;
  onGoTrading?: (tradeType: 'spot' | 'futures') => void;
}

const ExchangePage: React.FC<ExchangePageProps> = ({
  spotHoldings,
  refreshSpotHoldings,
  onPickerOpenChange,
  onBack,
  onRequireAuth,
  onGoTrading,
}) => {
  const { t } = useLanguage();
  const { formatPrice, symbol, convertToUsd, convertFromUsd, currencyCode } = useCurrency();
  const { user, refreshUser } = useUser();
  const toast = useToast();
  const liveAssets = useLiveAssets(MARKET_ASSETS);

  const [fromSide, setFromSide] = useState<ExchangeSide>('currency');
  const [toSide, setToSide] = useState<ExchangeSide>('BTC');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerMode, setPickerMode] = useState<'from' | 'to' | null>(null);

  const openPicker = (mode: 'from' | 'to') => {
    setPickerMode(mode);
    onPickerOpenChange?.(true);
  };
  const closePicker = () => {
    setPickerMode(null);
    onPickerOpenChange?.(false);
  };

  const balanceUsd = user?.balance ?? 0;
  const assetFrom =
    fromSide === 'currency'
      ? null
      : liveAssets.find((a) => a.ticker === fromSide) ?? MARKET_ASSETS.find((a) => a.ticker === fromSide);
  const assetTo =
    toSide === 'currency'
      ? null
      : liveAssets.find((a) => a.ticker === toSide) ?? MARKET_ASSETS.find((a) => a.ticker === toSide);
  const priceFromUsd = fromSide === 'currency' ? 0 : (assetFrom?.price ?? 0);
  const priceToUsd = toSide === 'currency' ? 0 : (assetTo?.price ?? 0);
  const holdingFrom = fromSide === 'currency' ? null : spotHoldings.find((h) => h.ticker === fromSide);
  const fromAmount = fromSide === 'currency' ? 0 : (holdingFrom?.amount ?? 0);

  const normalizedAmount = amount.replace(',', '.');
  const numAmount = parseFloat(normalizedAmount) || 0;

  const isFromCurrency = fromSide === 'currency';
  const isToCurrency = toSide === 'currency';

  const amountInUsd = isFromCurrency ? convertToUsd(numAmount) : numAmount * priceFromUsd;
  const resultQuantity =
    isToCurrency ? (priceToUsd > 0 ? amountInUsd / priceToUsd : 0) : priceToUsd > 0 ? amountInUsd / priceToUsd : 0;
  const resultInCurrency = amountInUsd;
  const resultInCrypto = resultQuantity;

  const canSubmit =
    fromSide !== toSide &&
    numAmount > 0 &&
    Number.isFinite(amountInUsd) &&
    amountInUsd >= convertToUsd(MIN_EXCHANGE_USD) &&
    (isFromCurrency
      ? balanceUsd >= convertToUsd(numAmount) && (isToCurrency || priceToUsd > 0)
      : fromAmount >= numAmount && priceFromUsd > 0 && (isToCurrency || priceToUsd > 0));

  const canSubmitForUi =
    user
      ? canSubmit
      : fromSide !== toSide &&
        numAmount > 0 &&
        Number.isFinite(amountInUsd) &&
        amountInUsd >= convertToUsd(MIN_EXCHANGE_USD);

  const amountPresetsRub = useMemo(
    () =>
      [...new Set([convertToUsd(MIN_EXCHANGE_USD), 1000, 5000, Math.floor(balanceUsd * 0.5), balanceUsd])]
        .filter((v) => v >= convertToUsd(MIN_EXCHANGE_USD) && v > 0)
        .sort((a, b) => a - b)
        .slice(0, 4),
    [balanceUsd]
  );

  const sanitizeDecimalInput = (raw: string) => {
    const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    const [intPart, ...rest] = cleaned.split('.');
    const fraction = rest.join('');
    return rest.length > 0 ? `${intPart}.${fraction}` : intPart;
  };

  useEffect(() => {
    setAmount('');
  }, [fromSide]);

  const handleSubmit = async () => {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    if (!canSubmit) return;
    Haptic.tap();
    setLoading(true);
    try {
      if (isFromCurrency && !isToCurrency) {
        const amountUsd = convertToUsd(numAmount);
        if (amountUsd <= 0 || amountUsd > balanceUsd) {
          toast.show(t('exchange_insufficient_balance'), 'error');
          setLoading(false);
          return;
        }
        const res = await spotBuy(user.user_id, toSide as string, amountUsd, priceToUsd);
        if (res.ok) {
          toast.show(t('exchange_success'), 'success');
          setAmount('');
          await Promise.all([refreshSpotHoldings(), refreshUser()]);
          Haptic.success();
        } else {
          toast.show(res.error ?? t('exchange_insufficient_balance'), 'error');
          Haptic.error();
        }
      } else if (!isFromCurrency && isToCurrency) {
        if (numAmount <= 0 || numAmount > fromAmount) {
          toast.show(t('exchange_insufficient_balance'), 'error');
          setLoading(false);
          return;
        }
        const res = await spotSell(user.user_id, fromSide as string, numAmount, priceFromUsd);
        if (res.ok) {
          toast.show(t('exchange_success'), 'success');
          setAmount('');
          await Promise.all([refreshSpotHoldings(), refreshUser()]);
          Haptic.success();
        } else {
          toast.show(res.error ?? t('exchange_insufficient_balance'), 'error');
          Haptic.error();
        }
      } else if (!isFromCurrency && !isToCurrency) {
        if (numAmount <= 0 || numAmount > fromAmount || fromSide === toSide) {
          toast.show(t('exchange_insufficient_balance'), 'error');
          setLoading(false);
          return;
        }
        const sellRes = await spotSell(user.user_id, fromSide as string, numAmount, priceFromUsd);
        if (!sellRes.ok || sellRes.amount_usd == null) {
          toast.show(sellRes.error ?? t('exchange_insufficient_balance'), 'error');
          Haptic.error();
          setLoading(false);
          return;
        }
        const buyRes = await spotBuy(user.user_id, toSide as string, sellRes.amount_usd, priceToUsd);
        if (buyRes.ok) {
          toast.show(t('exchange_success'), 'success');
          setAmount('');
          await Promise.all([refreshSpotHoldings(), refreshUser()]);
          Haptic.success();
        } else {
          toast.show(buyRes.error ?? t('exchange_insufficient_balance'), 'error');
          Haptic.error();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fromLabel = isFromCurrency ? symbol : fromSide;
  const toLabel = isToCurrency ? symbol : toSide;
  const fromSub = isFromCurrency
    ? `${formatPrice(balanceUsd)} ${symbol}`
    : holdingFrom
      ? `${fromAmount.toFixed(6)} ${fromSide}`
      : null;
  const resultText = isToCurrency
    ? `≈ ${formatPrice(resultInCurrency)} ${symbol}`
    : `≈ ${resultInCrypto.toFixed(8)} ${toSide}`;

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in bg-background">
      {/* MEXC-like header: Convert / Spot / Futures */}
      <div className="sticky top-0 z-40 bg-background hairline-bottom">
        <div className="px-4 pt-2 pb-2 flex items-center gap-4 text-[15px] font-semibold">
          <button
            type="button"
            onClick={() => { Haptic.tap(); }}
            className="text-textPrimary"
            aria-current="page"
          >
            {t('exchange_mode_convert')}
          </button>
          <button
            type="button"
            onClick={() => { Haptic.tap(); onGoTrading?.('spot'); onBack(); }}
            className="text-textSubtle hover:text-textPrimary transition-colors"
          >
            {t('exchange_mode_spot')}
          </button>
          <button
            type="button"
            onClick={() => { Haptic.tap(); onGoTrading?.('futures'); onBack(); }}
            className="text-textSubtle hover:text-textPrimary transition-colors"
          >
            {t('exchange_mode_futures')}
          </button>
          <div className="flex-1" />
          <div className="h-9 w-9 rounded-xl bg-white/[0.03] flex items-center justify-center text-textSecondary">
            <ConvertIcon size={18} strokeWidth={1.75} />
          </div>
        </div>

        {/* Pair row (like Trading): shows current convert pair + chart button */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[16px] font-bold text-textPrimary truncate">
              {fromSide === 'currency' ? currencyCode : fromSide}
              <span className="text-textSubtle mx-1">/</span>
              {toSide === 'currency' ? currencyCode : toSide}
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => { Haptic.tap(); onGoTrading?.('spot'); onBack(); }}
              className="touch-target h-9 w-9 rounded-xl flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-white/5 active:scale-95 transition-all focus:outline-none"
              aria-label={t('chart_title')}
              title={t('chart_title')}
            >
              <BarChart3 size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-24">
        <div className="max-w-md w-full mx-auto space-y-3">
          {/* Карточка: Отдаю */}
          <div className="rounded-3xl bg-white/5 overflow-hidden">
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold text-textSubtle">{t('from_label')}</p>
            </div>
            <div className="p-3 space-y-3">
              <button
                type="button"
                onClick={() => {
                  Haptic.tap();
                  openPicker('from');
                }}
                className="touch-target w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-semibold text-sm text-textPrimary truncate">{fromLabel}</p>
                  {fromSub && (
                    <p className="text-[11px] font-mono text-textMuted truncate mt-0.5">{fromSub}</p>
                  )}
                </div>
                <ChevronDown size={16} className="text-textMuted flex-shrink-0" />
              </button>
              <input
                type="text"
                inputMode="decimal"
                placeholder={isFromCurrency ? `0 ${symbol}` : '0'}
                value={amount}
                onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
                className="w-full bg-white/[0.02] hover:bg-white/[0.03] focus:bg-white/[0.04] rounded-xl px-3 py-2.5 text-textPrimary font-mono text-sm placeholder:text-textMuted focus:outline-none transition-all"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-mono text-textMuted">
                  {t('exchange_min_amount', { amount: `${MIN_EXCHANGE_USD} ${symbol}` })}
                </p>
                {isFromCurrency && amountPresetsRub.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {amountPresetsRub.map((presetRub) => {
                      const presetDisplay = convertFromUsd(presetRub);
                      return (
                        <button
                          key={presetRub}
                          type="button"
                          onClick={() => {
                            Haptic.tap();
                            setAmount(String(presetDisplay));
                          }}
                          className="text-[10px] font-mono text-neon hover:underline active:scale-95"
                        >
                          {formatPrice(presetRub)} {symbol}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!isFromCurrency && fromAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      Haptic.tap();
                      setAmount(String(fromAmount));
                    }}
                    className="text-[10px] font-mono text-neon hover:underline active:scale-95"
                  >
                    {t('exchange_max')}: {fromAmount.toFixed(6)}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Карточка: Получаю */}
          <div className="rounded-3xl bg-white/5 overflow-hidden">
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold text-textSubtle">{t('to_label')}</p>
            </div>
            <div className="p-3">
              <button
                type="button"
                onClick={() => {
                  Haptic.tap();
                  openPicker('to');
                }}
                className="touch-target w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-semibold text-sm text-textPrimary truncate">{toLabel}</p>
                  {!isToCurrency && assetTo && (
                    <p className="text-[11px] font-mono text-textMuted truncate mt-0.5">
                      {assetTo.priceUnavailable ? '—' : `${formatPrice(assetTo.price)} ${symbol}`}
                    </p>
                  )}
                </div>
                <ChevronDown size={16} className="text-textMuted flex-shrink-0" />
              </button>
              {amount && numAmount > 0 && (
                <div className="mt-3 rounded-2xl bg-black/25 px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-textSubtle font-semibold">{t('you_receive')}</span>
                  <span className="text-[13px] font-mono font-bold text-textPrimary">
                    {resultText}
                    {isToCurrency && <span className="text-textSubtle font-normal ml-2">({currencyCode})</span>}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка обмена */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmitForUi || loading}
            className="w-full touch-target h-12 rounded-2xl bg-neon text-black font-bold text-base disabled:opacity-60 disabled:pointer-events-none active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin shrink-0" />
              </>
            ) : (
              <span>{t('exchange_btn')}</span>
            )}
          </button>

          {!user && (
            <p className="text-center text-[11px] text-textMuted py-2">
              {t('exchange_login_hint')}
            </p>
          )}
        </div>
      </div>

      <ExchangeAssetPicker
        open={pickerMode !== null}
        title={pickerMode === 'from' ? t('exchange_picker_from') : t('exchange_picker_to')}
        mode={pickerMode ?? 'to'}
        selected={pickerMode === 'from' ? fromSide : toSide}
        exclude={pickerMode === 'from' ? toSide : fromSide}
        spotHoldings={spotHoldings}
        balanceUsd={balanceUsd}
        onSelect={pickerMode === 'from' ? setFromSide : setToSide}
        onClose={closePicker}
      />
    </div>
  );
};

export default ExchangePage;
