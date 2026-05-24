import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchUsdRates, UsdRates } from '../lib/currencyApi';
import { getMarketUsdToRub } from '../lib/cryptoPrices';
import { debugPriceLog } from '../utils/debugPrices';

/** Символы основных валют */
const CURRENCY_SYMBOLS: Record<string, string> = {
  rub: '₽',
  usd: '$',
  eur: '€',
  gbp: '£',
  cny: '¥',
  kzt: '₸',
  jpy: '¥',
  uah: '₴',
  try: '₺',
  brl: 'R$',
  inr: '₹',
  chf: 'Fr',
  krw: '₩',
};

interface CurrencyContextValue {
  baseCurrency: string;
  setBaseCurrency: (code: string) => void;
  rates: UsdRates | null;
  loading: boolean;
  /** Конвертировать цену из RUB в выбранную валюту */
  convertFromRub: (priceRub: number) => number;
  /** Конвертировать сумму из выбранной валюты в RUB */
  convertToRub: (amountInDisplayCurrency: number) => number;
  /** Символ выбранной валюты (₽, $, € и т.д.) */
  symbol: string;
  /** Код валюты для пар (RUB, USD, EUR) */
  currencyCode: string;
  /** Название валюты для отображения */
  currencyName: string;
  /** Форматировать цену (из RUB) в выбранной валюте */
  formatPrice: (priceRub: number, options?: { fractionDigits?: number }) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [baseCurrency, setBaseCurrencyInternal] = useState<string>('usd');
  const [rates, setRates] = useState<UsdRates | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUsdRates()
      .then((data) => {
        if (!cancelled) setRates(data);
      })
      .catch(() => {
        if (!cancelled) setRates(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const setBaseCurrency = useCallback((_code: string) => {
    // По ТЗ: пока фиксируем USD.
    setBaseCurrencyInternal('usd');
    try { localStorage.setItem('etoro_currency', 'usd'); } catch {}
  }, []);

  const convertFromRub = useCallback(
    (priceRub: number): number => {
      if (baseCurrency === 'rub') return priceRub;
      const usdRub = (() => {
        const fromQuotes = getMarketUsdToRub();
        const fromRates = rates?.usd?.rub;
        if (typeof fromQuotes === 'number' && Number.isFinite(fromQuotes) && fromQuotes >= 55 && fromQuotes <= 220) {
          return fromQuotes;
        }
        if (typeof fromRates === 'number' && Number.isFinite(fromRates) && fromRates > 0 && fromRates >= 55 && fromRates <= 220) {
          return fromRates;
        }
        return typeof fromRates === 'number' && Number.isFinite(fromRates) && fromRates > 0 ? fromRates : null;
      })();
      if (!usdRub) return priceRub;
      debugPriceLog(
        'usd_rub',
        {
          baseCurrency,
          usdRubUsed: usdRub,
          usdRubRates: rates?.usd?.rub ?? null,
          marketUsdRub: getMarketUsdToRub(),
        },
        { throttleMs: 10_000 }
      );
      const usdPerRub = 1 / usdRub;
      const priceUsd = priceRub * usdPerRub;
      if (baseCurrency === 'usd') return priceUsd;
      const targetRate = rates.usd[baseCurrency];
      if (targetRate == null) return priceRub;
      return priceUsd * targetRate;
    },
    [baseCurrency, rates]
  );

  const convertToRub = useCallback(
    (amountInDisplayCurrency: number): number => {
      if (baseCurrency === 'rub') return amountInDisplayCurrency;
      const oneRubInDisplay = convertFromRub(1);
      if (oneRubInDisplay === 0) return amountInDisplayCurrency;
      return amountInDisplayCurrency / oneRubInDisplay;
    },
    [baseCurrency, convertFromRub]
  );

  const formatPrice = useCallback(
    (priceRub: number, options?: { fractionDigits?: number }): string => {
      const value = convertFromRub(priceRub);
      const fractionDigits = options?.fractionDigits ?? (value === 0 ? 2 : value < 1 ? 6 : value < 100 ? 2 : 0);
      return new Intl.NumberFormat('ru-RU', {
        style: 'decimal',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value);
    },
    [convertFromRub]
  );

  const symbol = CURRENCY_SYMBOLS[baseCurrency] ?? baseCurrency.toUpperCase();
  const currencyCode = baseCurrency.toUpperCase();
  const currencyName =
    baseCurrency === 'rub' ? 'рублях' :
    baseCurrency === 'usd' ? 'долларах' :
    baseCurrency === 'eur' ? 'евро' :
    baseCurrency === 'kzt' ? 'тенге' :
    baseCurrency === 'uah' ? 'гривнах' :
    baseCurrency === 'cny' ? 'юанях' :
    baseCurrency === 'gbp' ? 'фунтах' :
    baseCurrency.toUpperCase();

  const value: CurrencyContextValue = {
    baseCurrency,
    setBaseCurrency,
    rates,
    loading,
    convertFromRub,
    convertToRub,
    symbol,
    currencyCode,
    currencyName,
    formatPrice,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
