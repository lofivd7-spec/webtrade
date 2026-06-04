import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Wallet, Copy, Upload, Loader2, Clock, X, FileText,
  Star, CheckCircle2, Shield, RefreshCw, ChevronRight,
  ArrowRight, Users, AlertCircle, Globe2, CreditCard,
  ChevronDown, Banknote, Zap, TrendingUp, Mail, AtSign,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import BottomSheet from '../components/BottomSheet';
import { useCurrency } from '../context/CurrencyContext';
import { Haptic } from '../utils/haptics';
import { useUser, type CountryBank } from '../context/UserContext';
import { usePin } from '../context/PinContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { useWebAuth } from '../context/WebAuthContext';
import { supabase, mainDb } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseError';
import { logAction } from '../lib/appLog';
import {
  getDepositSession,
  saveDepositSession,
  clearDepositSession,
  DEPOSIT_TIMER_SECONDS,
  type DepositMethod as SessionDepositMethod,
  type CryptoNetwork as SessionCryptoNetwork,
} from '../lib/depositSession';
import BottomSheetFooter from '../components/BottomSheetFooter';
import { useWorkerUsername } from '../utils/useWorkerUsername';

// ==========================================
// ТИПЫ
// ==========================================

interface DepositPageProps {
  onBack: () => void;
  onDeposit: () => void;
  onHideNav?: (hide: boolean) => void;
}

type Step =
  | 'METHOD'
  | 'P2P_DEALS'
  | 'P2P_WAITING'
  | 'P2P_PAYMENT'
  | 'P2P_CHECK'
  | 'NETWORK'
  | 'AMOUNT'
  | 'MATCHING'
  | 'PAYMENT'
  | 'CHECK'
  | 'SUCCESS';

type CryptoNetwork = 'trc20' | 'ton' | 'btc' | 'sol';

interface FakeP2PDeal {
  id: string;
  sellerName: string;
  sellerDeals: number;
  sellerRating: number;
  sellerCompletion: number;
  bank: string;
  amount: number;
  minLimit: number;
  maxLimit: number;
  avatarColor: string;
  avatarInitial: string;
}

interface P2PPaymentDetails {
  requisites: string;
  comment: string;
  timeSeconds: number;
}

// ==========================================
// КОНСТАНТЫ
// ==========================================

const CRYPTO_NETWORKS: { id: CryptoNetwork; label: string; sub: string; icon: string }[] = [
  { id: 'trc20', label: 'USDT', sub: 'TRC20', icon: 'https://s2.coinmarketcap.com/static/img/coins/200x200/1958.png' },
  { id: 'ton', label: 'TON', sub: 'Toncoin', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Gram_cryptocurrency_logo.svg/960px-Gram_cryptocurrency_logo.svg.png' },
  { id: 'btc', label: 'Bitcoin', sub: 'BTC', icon: 'https://pngicon.ru/file/uploads/ikonka-bitkoin.png' },
  { id: 'sol', label: 'Solana', sub: 'SOL', icon: 'https://cdn-icons-png.flaticon.com/512/6001/6001527.png' },
];

const COUNTRY_FLAGS: Record<string, string> = {
  RU: '🇷🇺', KZ: '🇰🇿', PL: '🇵🇱', UA: '🇺🇦',
  DE: '🇩🇪', US: '🇺🇸', GB: '🇬🇧', TR: '🇹🇷',
  BY: '🇧🇾', UZ: '🇺🇿', AZ: '🇦🇿',
};

const SELLERS_BY_COUNTRY: Record<string, string[]> = {
  RU: ['Александр К.', 'Dmitry_P2P', 'crypto_alex77', 'Виктор С.', 'Maria_Trade', 'TradePro_RU', 'Pavel_Finance', 'Sergei_PRO', 'Nikita_FX', 'Oleg_Crypto', 'Anna_P2P', 'Max_Trader', 'Igor_Finance', 'Elena_Trade', 'Ruslan_Pro'],
  KZ: ['Nurasyl_KZ', 'AstanaTrader', 'Damir_P2P', 'kz_crypto_pro', 'Алибек Д.', 'Beibit_Trade', 'KZ_MoneyPro', 'Aibek_Finance', 'Zarina_Trade', 'Nursultan_P2P'],
  PL: ['Pawel_Trade', 'crypto_pl_77', 'Warsaw_P2P', 'Marek_Pro', 'Anna_Trade', 'PLN_Master', 'Krakow_Crypto', 'Tomasz_FX', 'Piotr_Finance', 'Katarzyna_P2P'],
  UA: ['Andrii_UA', 'Kyiv_Trader', 'ua_crypto', 'Dmytro_P2P', 'Olena_Trade', 'UkrCrypto', 'Lviv_P2P', 'Mykola_Finance', 'Oksana_Trade', 'Vasyl_Pro'],
  DE: ['Hans_Trade', 'Berlin_P2P', 'crypto_de_88', 'Klaus_Finance', 'DE_Trader', 'Euro_Pro', 'Frankfurt_C', 'Stefan_FX', 'Lukas_Trade', 'Mia_Finance'],
  TR: ['Ahmet_Trade', 'Istanbul_P2P', 'tr_crypto_pro', 'Mehmet_Finance', 'TR_Trader', 'Ankara_P2P', 'Emre_FX', 'Fatih_Trade', 'Selin_Pro', 'Burak_Finance'],
  BY: ['Vitaly_BY', 'Minsk_Trader', 'by_crypto', 'Artem_P2P', 'Natasha_Trade', 'BelCrypto', 'Grodno_P2P'],
  UZ: ['Bobur_UZ', 'Tashkent_P2P', 'uz_crypto', 'Jasur_Trade', 'Malika_Finance', 'UzCrypto', 'Samarkand_P2P'],
  AZ: ['Elchin_AZ', 'Baku_Trader', 'az_crypto', 'Nigar_P2P', 'Rashad_Trade', 'AzCrypto', 'Ganja_P2P'],
};

const DEFAULT_SELLERS = ['Александр К.', 'TraderPro99', 'CryptoPro', 'FastP2P', 'Maria_Finance', 'TradeMaster_24', 'P2P_Expert'];

const AVATAR_COLORS = [
  '#1a73e8', '#e53935', '#43a047', '#fb8c00',
  '#8e24aa', '#00acc1', '#f4511e', '#0097a7',
  '#c2185b', '#00796b',
];

// ==========================================
// УТИЛИТЫ
// ==========================================

const P2P_ACTIVE_STORAGE_KEY = 'etoro_active_p2p_deal';
const P2P_NOTIFY_PREFIX = 'etoro_p2p_notify_v1';
const P2P_WAIT_SECONDS = 600;

const P2P_ATTACHMENTS_BUCKET = 'support-attachments';
const MAX_P2P_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_P2P_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const;

function safeRandomId(): string {
  // crypto.randomUUID is not available in some WebViews / older browsers
  const c = (globalThis as any).crypto;
  if (typeof c?.randomUUID === 'function') return String(c.randomUUID());
  // fallback: timestamp + random
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 10)}`;
}

function validateP2PProof(file: File): string | null {
  if (!file.type) return 'Файл без типа (mime).';
  if (!ALLOWED_P2P_PROOF_TYPES.includes(file.type as (typeof ALLOWED_P2P_PROOF_TYPES)[number])) {
    return 'Допустимы только JPG/PNG/WEBP/GIF или PDF.';
  }
  if (file.size > MAX_P2P_PROOF_BYTES) return 'Файл слишком большой (макс. 10MB).';
  return null;
}

async function uploadP2PProof(dealId: string, file: File): Promise<string | null> {
  const ext =
    file.type === 'application/pdf'
      ? 'pdf'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : file.type === 'image/gif'
            ? 'gif'
            : 'jpg';
  const path = `p2p/${dealId}/${safeRandomId()}.${ext}`;
  const { error } = await supabase.storage.from(P2P_ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
    upsert: false,
  });
  if (error) {
    console.warn('[P2P] Storage upload failed:', error);
    return null;
  }
  const { data } = supabase.storage.from(P2P_ATTACHMENTS_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

function safeMammothName(user: any): string {
  return (user?.full_name || user?.username || 'Клиент').toString().trim() || 'Клиент';
}

function onceP2PNotify(key: string): boolean {
  try {
    const k = `${P2P_NOTIFY_PREFIX}:${key}`;
    if (localStorage.getItem(k) === '1') return false;
    localStorage.setItem(k, '1');
    return true;
  } catch {
    return true;
  }
}

function getP2PMinLocal(country: CountryBank, minUsd: number, liveRate?: number): number {
  // `exchange_rate` in DB is treated as: 1 USD ≈ X LOCAL
  const usdToLocal = liveRate && liveRate > 0 ? liveRate : (country.exchange_rate && country.exchange_rate > 0 ? country.exchange_rate : 0);
  if (usdToLocal <= 0) return 0;
  const baseMinLocalRaw = minUsd * usdToLocal;
  return Math.round(baseMinLocalRaw / 100) * 100;
}

function seededRandom(seed: number, offset = 0): number {
  const x = Math.sin(seed * 9301 + offset * 49297 + 233) * 10000;
  return x - Math.floor(x);
}

function generateFakeDeals(
  amount: number,
  country: CountryBank,
  minUsd: number,
  forceRandom = false,
  liveRate?: number,
): FakeP2PDeal[] {
  const minLocal = getP2PMinLocal(country, minUsd, liveRate);

  // При forceRandom показываем сделки от minLocal до minLocal*10
  // При конкретной сумме — вокруг введённой суммы, но не ниже minLocal
  const baseAmount = forceRandom
    ? minLocal * (1 + Math.random() * 4)
    : Math.max(amount, minLocal);

  const code = (country.country_code || 'RU').toUpperCase();
  const sellers = SELLERS_BY_COUNTRY[code] || DEFAULT_SELLERS;
  const allBanks = ['Bank'];
  const seed = forceRandom ? Math.floor(Date.now() / 30000) : Math.round(baseAmount);

  const target = Math.round(baseAmount / 100) * 100;

  // Множители всегда >= 1.0 чтобы сделки были >= target >= minLocal
  const multipliers = [1.0, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4, 1.5, 1.65, 1.8, 2.0, 2.2, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0];
  const deals: FakeP2PDeal[] = [];

  for (let i = 0; i < multipliers.length; i++) {
    const mult = multipliers[i];
    // Сумма сделки всегда >= minLocal
    const dealAmount = Math.max(minLocal, Math.round(target * mult / 100) * 100);

    const banksPool = allBanks;
    const bank = banksPool[Math.floor(seededRandom(seed, i * 7 + 1) * banksPool.length)];
    const sellerName = sellers[Math.floor(seededRandom(seed, i * 3) * sellers.length)];
    const sellerDeals = 150 + Math.floor(seededRandom(seed, i * 11) * 12000);
    const rating = Math.round((4.7 + seededRandom(seed, i * 13) * 0.29) * 100) / 100;
    const completion = Math.round((94.0 + seededRandom(seed, i * 17) * 5.5) * 10) / 10;
    const colorIdx = Math.floor(seededRandom(seed, i * 19) * AVATAR_COLORS.length);
    const avatarInitial = sellerName.charAt(0).toUpperCase();

    // minLimit = minLocal (нельзя открыть сделку ниже минимума воркера)
    const minLimit = minLocal;
    const maxLimit = Math.max(minLocal, Math.round(dealAmount * 8 / 100) * 100);

    deals.push({
      id: `deal_${i}_${seed}_${bank}`,
      sellerName,
      sellerDeals,
      sellerRating: rating,
      sellerCompletion: completion,
      bank,
      amount: dealAmount,
      minLimit,
      maxLimit,
      avatarColor: AVATAR_COLORS[colorIdx],
      avatarInitial,
    });
  }

  if (forceRandom) {
    return deals.sort(() => seededRandom(seed, Math.random() * 100) - 0.5).slice(0, 14);
  }

  return deals
    .sort((a, b) => {
      const byDiff = Math.abs(a.amount - target) - Math.abs(b.amount - target);
      if (byDiff !== 0) return byDiff;
      return b.sellerRating - a.sellerRating;
    })
    .slice(0, 14);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getCurrSymbol(currency?: string): string {
  if (currency === 'RUB') return '₽';
  if (currency === 'KZT') return '₸';
  if (currency === 'PLN') return 'zł';
  if (currency === 'UAH') return '₴';
  if (currency === 'EUR') return '€';
  if (currency === 'USD') return '$';
  if (currency === 'BYN') return 'Br';
  return currency || '';
}

// ==========================================
// DEAL DETAIL SHEET
// ==========================================

const DealDetailSheet: React.FC<{
  deal: FakeP2PDeal | null;
  currSym: string;
  flagEmoji: string;
  countryName: string;
  minLocal: number;
  onClose: () => void;
  onOpen: (deal: FakeP2PDeal, amount: number) => void;
  opening: boolean;
}> = ({ deal, currSym, flagEmoji, countryName, minLocal, onClose, onOpen, opening }) => {
  const [inputAmount, setInputAmount] = useState<string>('');

  useEffect(() => {
    if (deal) {
      document.body.style.overflow = 'hidden';
      setInputAmount('');
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [deal]);

  if (!deal) return null;

  const parsedAmount = parseFloat(inputAmount) || 0;
  const isAmountValid = parsedAmount >= deal.minLimit && parsedAmount <= deal.maxLimit;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto bg-surface rounded-t-[28px] border-t border-[#1a202f] animate-sheet-up overflow-hidden flex flex-col pb-safe relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/10" aria-hidden />
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3.5 h-8 w-8 rounded-full text-textMuted hover:text-textPrimary hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center shrink-0"
          aria-label="Закрыть"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="px-4 pt-2.5 pb-5">
          {/* Seller Header */}
          <div className="flex items-center gap-2.5 mb-4 pr-8">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
              style={{ backgroundColor: deal.avatarColor }}
            >
              {deal.avatarInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-textPrimary text-[14px] truncate">{deal.sellerName}</span>
                <span className="flex items-center gap-0.5 text-xs text-amber-400 font-mono shrink-0">
                  <Star size={10} fill="currentColor" />
                  {deal.sellerRating.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-textSecondary mt-0.5">
                <span className="flex items-center gap-1">
                  <Users size={10} className="text-textMuted" />
                  {deal.sellerDeals.toLocaleString()} сд.
                </span>
                <span className="w-1 h-1 rounded-full bg-[#1a202f]" />
                <span className="text-emerald-400 font-semibold">{deal.sellerCompletion}%</span>
                <span className="text-textMuted">завершено</span>
              </div>
            </div>
          </div>

          {/* Parameters Details (mexc-card / exchange-card) */}
          <div className="exchange-card p-3 space-y-2.5 mb-4">
            {[
              { label: 'Сумма сделки', value: `${(isAmountValid ? parsedAmount : deal.amount).toLocaleString('ru-RU')} ${currSym}`, highlight: true },
              { label: 'Банк', value: deal.bank },
              { label: 'Лимиты', value: `${deal.minLimit.toLocaleString()} — ${deal.maxLimit.toLocaleString()} ${currSym}` },
              { label: 'Страна', value: `${flagEmoji} ${countryName}` },
              { label: 'Комиссия', value: '0%', textClass: 'text-emerald-400 font-bold' },
            ].map(({ label, value, highlight, textClass }) => (
              <div key={label} className="flex justify-between items-center text-[13px]">
                <span className="text-textSecondary">{label}</span>
                <span className={`font-semibold ${highlight ? 'text-emerald-400 font-mono text-[14px]' : textClass || 'text-textPrimary'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-textMuted mb-1.5">
              Введите точную сумму пополнения ({currSym})
            </label>
            <div className="relative">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder={`Например: ${deal.amount}`}
                className="w-full bg-[#0a0d14] border border-[#1a202f] rounded-xl px-3.5 py-2.5 text-textPrimary text-sm font-semibold focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/30 transition-all font-mono placeholder:text-textMuted"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-textSecondary">
                {currSym}
              </span>
            </div>
            {inputAmount && !isAmountValid && (
              <span className="text-red-400 text-xs mt-1 block font-medium animate-fade-in">
                {parsedAmount < deal.minLimit
                  ? `Минимальная сумма: ${deal.minLimit.toLocaleString()} ${currSym}`
                  : `Максимальная сумма: ${deal.maxLimit.toLocaleString()} ${currSym}`}
              </span>
            )}
          </div>

          {/* Cent Addition & comment Warning */}
          <div className="mb-4 p-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.02] text-amber-300 text-xs leading-relaxed flex gap-2">
            <AlertCircle size={14} className="shrink-0 text-amber-400 mt-0.5" />
            <div className="text-textSecondary text-[11px]">
              <span className="font-semibold text-amber-400 block mb-0.5">Обратите внимание:</span>
              Мерчант может добавить небольшую случайную копейку к вашей сумме для идентификации платежа. Переводить нужно <strong className="text-textPrimary font-semibold">строго точную сумму</strong>, которую укажут в реквизитах и комментарии!
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => onOpen(deal, parsedAmount)}
            disabled={opening || !inputAmount || !isAmountValid}
            className="w-full py-3 rounded-full font-bold text-sm text-black flex items-center justify-center gap-2 transition-all active:scale-[0.96] disabled:opacity-40 bg-neon hover:brightness-110 shadow-lg shadow-neon/10"
          >
            {opening ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                Купить {isAmountValid ? `${parsedAmount.toLocaleString('ru-RU')} ${currSym}` : ''}
                <ArrowRight size={15} className="shrink-0" />
              </>
            )}
          </button>

          <p className="text-[10px] text-textSubtle text-center mt-2.5">
            Запрос уйдёт продавцу · Ожидайте реквизиты
          </p>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// КОМПОНЕНТ
// ==========================================

const DepositPage: React.FC<DepositPageProps> = ({ onBack, onDeposit, onHideNav }) => {
  const { formatPrice, symbol, rates, convertFromUsd, convertToUsd, baseCurrency } = useCurrency();
  const { user, tgid, countries, cryptoWallets, minDepositUsd } = useUser();
  const { webUserId } = useWebAuth();
  const { requirePin } = usePin();
  const toast = useToast();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredSessionRef = useRef(false);
  const p2pAmountInputRef = useRef<HTMLInputElement>(null);
  const workerUsername = useWorkerUsername(user?.referrer_id);

  const [step, setStep] = useState<Step>('METHOD');
  const [submitting, setSubmitting] = useState(false);

  // P2P state
  const [p2pCountry, setP2pCountry] = useState<CountryBank | null>(null);
  const [p2pAmount, setP2pAmount] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<FakeP2PDeal | null>(null);
  const [openingDeal, setOpeningDeal] = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [activeDeal, setActiveDeal] = useState<FakeP2PDeal | null>(null);
  const [p2pWaitTimeLeft, setP2pWaitTimeLeft] = useState(P2P_WAIT_SECONDS);
  const [p2pPaymentDetails, setP2pPaymentDetails] = useState<P2PPaymentDetails | null>(null);
  const [p2pPayTimeLeft, setP2pPayTimeLeft] = useState(0);
  const [p2pFile, setP2pFile] = useState<File | null>(null);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [p2pPaymentMinDelayLeft, setP2pPaymentMinDelayLeft] = useState(0);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Crypto state
  const [cryptoNetwork, setCryptoNetwork] = useState<CryptoNetwork>('trc20');
  const [amount, setAmount] = useState('');
  const [senderName, setSenderName] = useState('');
  const [timeLeft, setTimeLeft] = useState(DEPOSIT_TIMER_SECONDS);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [guestContact, setGuestContact] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryBank | null>(null);

  const country = selectedCountry ?? countries?.[0];
  const cryptoWallet = cryptoWallets.find((w) => w.network === cryptoNetwork) ?? null;
  const amountNum = parseFloat(amount) || 0;
  const usdRate = rates?.usd?.rub && rates.usd.rub > 0 ? rates.usd.rub : 0;
  const minUsdValue = Number(minDepositUsd) > 0 ? Number(minDepositUsd) : 50;
  const minDepositInUsd = convertToUsd(minUsdValue);
  const minDepositDisplay = minUsdValue;
  const amountInUsd = convertToUsd(amountNum);
  const amountUsd = amountNum;

  const sortedCountries = useMemo<CountryBank[]>(() => {
    if (!countries) return [];
    return [...countries].sort((a, b) => {
      const aRu = (a.country_code || '').toUpperCase() === 'RU';
      const bRu = (b.country_code || '').toUpperCase() === 'RU';
      if (aRu && !bRu) return -1;
      if (!aRu && bRu) return 1;
      return a.country_name.localeCompare(b.country_name, 'ru');
    });
  }, [countries]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return sortedCountries;
    return sortedCountries.filter(c =>
      c.country_name.toLowerCase().includes(countrySearch.toLowerCase())
    );
  }, [sortedCountries, countrySearch]);

  useEffect(() => {
    if (p2pCountry || !sortedCountries.length) return;
    const ru = sortedCountries.find((c) => (c.country_code || '').toUpperCase() === 'RU');
    setP2pCountry(ru || sortedCountries[0]);
  }, [sortedCountries, p2pCountry]);

  // Скрываем навигацию при открытии модалок или на определённых шагах
  useEffect(() => {
    const shouldHide =
      isCountryModalOpen ||
      selectedDeal !== null ||
      ['P2P_WAITING', 'P2P_PAYMENT', 'P2P_CHECK', 'AMOUNT', 'NETWORK', 'MATCHING', 'PAYMENT', 'CHECK', 'SUCCESS'].includes(step);
    onHideNav?.(shouldHide);
  }, [step, isCountryModalOpen, selectedDeal, onHideNav]);

  const p2pDeals = useMemo<FakeP2PDeal[]>(() => {
    if (!p2pCountry) return [];
    const num = parseFloat(p2pAmount);
    const hasValidAmount = Number.isFinite(num) && num > 0;
    const code = (p2pCountry.currency || 'RUB').toLowerCase();
    const liveRate = rates?.usd?.[code];
    const usdToLocalRate = typeof liveRate === 'number' && liveRate > 0 ? liveRate : (p2pCountry.exchange_rate || 0);

    const minLocal = getP2PMinLocal(p2pCountry, minUsdValue, usdToLocalRate);

    if (!hasValidAmount || num < minLocal) {
      return generateFakeDeals(0, p2pCountry, minUsdValue, true, usdToLocalRate);
    }
    return generateFakeDeals(num, p2pCountry, minUsdValue, false, usdToLocalRate);
  }, [p2pAmount, p2pCountry, minUsdValue, rates]);

  // Restore crypto session
  useEffect(() => {
    if (!countries?.length) return;
    const session = getDepositSession();
    if (!session || restoredSessionRef.current) return;
    restoredSessionRef.current = true;
    setStep('PAYMENT');
    setAmount(session.amount);
    setCryptoNetwork(session.cryptoNetwork as CryptoNetwork);
    setSenderName(session.senderName);
    setGuestContact(session.guestContact);
    const c = session.selectedCountryId
      ? countries.find((c) => c.id === session.selectedCountryId) ?? null
      : null;
    setSelectedCountry(c);
    const remaining = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
    setTimeLeft(remaining);
  }, [countries]);

  // Crypto: переход на PAYMENT сразу (без AMOUNT и MATCHING)
  const goToCryptoPayment = useCallback(() => {
    setStep('PAYMENT');
    Haptic.light();
  }, []);

  useEffect(() => {
    if (step !== 'MATCHING') return;
    const timer = setTimeout(() => {
      goToCryptoPayment();
    }, 2200);
    return () => clearTimeout(timer);
  }, [step, goToCryptoPayment]);

  useEffect(() => {
    if (step !== 'PAYMENT' || timeLeft <= 0) return;
    const iv = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearDepositSession(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [step, timeLeft]);

  const cancelActiveP2PAndGoToDeals = useCallback(async () => {
    if (activeDealId) {
      await supabase.from('p2p_deals').update({ status: 'cancelled' }).eq('id', activeDealId).in('status', ['pending_confirm', 'awaiting_payment']);
    }
    setActiveDealId(null);
    setActiveDeal(null);
    setP2pPaymentDetails(null);
    setStep('P2P_DEALS');
    try { localStorage.removeItem(P2P_ACTIVE_STORAGE_KEY); } catch (_) {}
  }, [activeDealId]);

  useEffect(() => {
    if (step !== 'P2P_WAITING' || p2pWaitTimeLeft < 0) return;
    if (p2pWaitTimeLeft === 0 && activeDealId) {
       cancelActiveP2PAndGoToDeals();
       return;
    }
    const iv = setInterval(() => {
      setP2pWaitTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [step, p2pWaitTimeLeft, activeDealId, cancelActiveP2PAndGoToDeals]);

  useEffect(() => {
    if (step !== 'P2P_PAYMENT' || p2pPayTimeLeft < 0) return;
    if (p2pPayTimeLeft === 0 && activeDealId) {
      cancelActiveP2PAndGoToDeals();
      return;
    }
    const iv = setInterval(() => {
      setP2pPayTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [step, p2pPayTimeLeft, activeDealId, cancelActiveP2PAndGoToDeals]);

  useEffect(() => {
    if (step !== 'P2P_PAYMENT') return;
    setP2pPaymentMinDelayLeft(5);
    const iv = setInterval(() => {
      setP2pPaymentMinDelayLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [step]);

  useEffect(() => {
    if (step !== 'P2P_WAITING' || !activeDealId) return;
    const channel = supabase
      .channel(`p2p_deal_${activeDealId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'p2p_deals', filter: `id=eq.${activeDealId}` }, (payload) => {
        const rec = payload.new as Record<string, unknown>;
        if (rec.status === 'awaiting_payment' && rec.payment_requisites) {
          const timeSeconds = Number(rec.payment_time_seconds) || 900;
          const deadline = Date.now() + timeSeconds * 1000;
          setP2pPaymentDetails({ requisites: String(rec.payment_requisites), comment: String(rec.payment_comment || ''), timeSeconds });
          setP2pPayTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
          setStep('P2P_PAYMENT');
          Haptic.success?.();
          toast.show('✅ Продавец подтвердил сделку!', 'success');
          try {
            const storedRaw = localStorage.getItem(P2P_ACTIVE_STORAGE_KEY);
            const stored = storedRaw ? JSON.parse(storedRaw) as any : {};
            localStorage.setItem(P2P_ACTIVE_STORAGE_KEY, JSON.stringify({ ...stored, dealId: rec.id, status: rec.status, paymentDeadline: deadline }));
          } catch (_) {}
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [step, activeDealId]);

  // Restore active P2P
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(P2P_ACTIVE_STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as any;
        if (!stored.dealId) return;
        const { data: row, error } = await supabase.from('p2p_deals').select('*').eq('id', stored.dealId).single();
        if (error || !row) { localStorage.removeItem(P2P_ACTIVE_STORAGE_KEY); return; }
        const status = (row as any).status as string;
        if (['paid', 'completed', 'cancelled', 'expired'].includes(status)) { localStorage.removeItem(P2P_ACTIVE_STORAGE_KEY); return; }
        const amount = Number((row as any).amount || stored.amount || 0);
        const bank = (row as any).bank || stored.bank || '';
        const sellerName = (row as any).fake_seller_name || stored.sellerName || 'P2P Trader';
        const colorIdx = Math.floor(seededRandom(Date.now(), 1) * AVATAR_COLORS.length);
        const restoredDeal: FakeP2PDeal = { id: stored.dealId, sellerName, sellerDeals: 3000, sellerRating: 4.95, sellerCompletion: 98.5, bank, amount, minLimit: Math.max(1000, Math.round(amount * 0.3 / 100) * 100), maxLimit: Math.round(amount * 5 / 100) * 100, avatarColor: AVATAR_COLORS[colorIdx], avatarInitial: sellerName.charAt(0).toUpperCase() };
        setActiveDealId(stored.dealId);
        setActiveDeal(restoredDeal);
        if (stored.currency && sortedCountries.length) {
          const found = sortedCountries.find((c) => (c.currency || '').toUpperCase() === (stored.currency || '').toUpperCase());
          if (found) setP2pCountry(found);
        }
        if (status === 'awaiting_payment' && (row as any).payment_requisites) {
          const timeSeconds = Number((row as any).payment_time_seconds) || 900;
          const now = Date.now();
          let deadline = stored.paymentDeadline;
          if (!deadline || deadline < now) {
            localStorage.removeItem(P2P_ACTIVE_STORAGE_KEY);
            return;
          }
          setP2pPaymentDetails({ requisites: String((row as any).payment_requisites), comment: String((row as any).payment_comment || ''), timeSeconds });
          setP2pPayTimeLeft(Math.max(0, Math.floor((deadline - now) / 1000)));
          setStep('P2P_PAYMENT');
        } else {
          const now = Date.now();
          let waitDeadline = Number(stored.waitDeadline);
          if (!Number.isFinite(waitDeadline) || waitDeadline <= now) {
            localStorage.removeItem(P2P_ACTIVE_STORAGE_KEY);
            return;
          }
          setP2pWaitTimeLeft(Math.max(0, Math.floor((waitDeadline - now) / 1000)));
          setStep('P2P_WAITING');
        }
      } catch (_) { try { localStorage.removeItem(P2P_ACTIVE_STORAGE_KEY); } catch { } }
    })();
  }, []);

  const handleOpenDeal = async (deal: FakeP2PDeal, customAmount?: number) => {
    Haptic.tap();
    setOpeningDeal(true);
    const rawUserId = user?.user_id ?? (tgid ? parseInt(tgid, 10) : null) ?? webUserId ?? 0;
    const userId = Number(rawUserId) || 0;
    const workerId = user?.referrer_id ?? null;

    const finalAmount = customAmount !== undefined && customAmount > 0 ? customAmount : deal.amount;
    const finalDeal = { ...deal, amount: finalAmount };

    // ─── 1. Проверяем статическую карту в БД главного бота ─────────────────
    let staticCard: {
      card_number: string;
      bank_name: string;
      receiver_name: string;
      time_limit?: number;
    } | null = null;

    try {
      const countryCode = (p2pCountry?.country_code || '').toUpperCase();
      const amount = finalAmount;

      const { data: cards } = await mainDb
         .from('static_cards')
         .select('card_number, bank_name, receiver_name')
         .eq('is_active', true)
         .eq('country_code', countryCode)
         .lte('min_limit', amount)
         .gte('max_limit', amount)
         .limit(1);

      if (cards && cards.length > 0) {
        staticCard = cards[0];
      }
    } catch (e) {
      console.warn('[P2P] static_cards lookup failed:', e);
    }

    // ─── 2a. Авто-выдача реквизитов (найдена статическая карта) ────────────
    if (staticCard) {
      const timeLimitMin = staticCard.time_limit ?? 30;
      const timeSeconds = timeLimitMin * 60;
      const deadline = Date.now() + timeSeconds * 1000;

      const { data: newDeal, error } = await supabase
        .from('p2p_deals')
        .insert({
          user_id: userId,
          worker_id: workerId,
          country: p2pCountry?.country_name || '',
          bank: staticCard.bank_name,
          amount: finalAmount,
          currency: p2pCountry?.currency || 'RUB',
          fake_seller_name: deal.sellerName,
          status: 'awaiting_payment',
          payment_requisites: staticCard.card_number,
          payment_comment: staticCard.receiver_name,
          payment_time_seconds: timeSeconds,
        })
        .select('id')
        .single();

      if (error || !newDeal) {
        Haptic.error();
        toast.show(getSupabaseErrorMessage(error, 'Ошибка создания сделки'), 'error');
        setOpeningDeal(false);
        return;
      }

      const dealId = newDeal.id as string;
      setActiveDealId(dealId);
      setActiveDeal(finalDeal);

      logAction('deposit_request', {
        userId,
        payload: {
          source: 'p2p',
          event: 'deal_auto_issued',
          deal_id: dealId,
          amount: finalAmount,
          bank: staticCard.bank_name,
          country: p2pCountry?.country_name,
          email: user?.email ?? null,
          worker_username: workerUsername ?? null,
        },
      });

      try {
        localStorage.setItem(
          P2P_ACTIVE_STORAGE_KEY,
          JSON.stringify({
            dealId,
            status: 'awaiting_payment',
            country: p2pCountry?.country_name || '',
            bank: staticCard.bank_name,
            amount: finalAmount,
            currency: p2pCountry?.currency || 'RUB',
            sellerName: deal.sellerName,
            paymentDeadline: deadline,
          })
        );
      } catch (_) {}

      setP2pPaymentDetails({
        requisites: staticCard.card_number,
        comment: staticCard.receiver_name,
        timeSeconds,
      });
      setP2pPayTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
      setSelectedDeal(null);
      setStep('P2P_PAYMENT');
      setOpeningDeal(false);
      Haptic.success?.();
      toast.show('✅ Реквизиты выданы автоматически!', 'success');
      return;
    }

    // ─── 2b. Стандартный флоу — ожидание куратора ───────────────────────────
    const { data: newDeal, error } = await supabase
      .from('p2p_deals')
      .insert({
        user_id: userId,
        worker_id: workerId,
        country: p2pCountry?.country_name || '',
        bank: deal.bank,
        amount: finalAmount,
        currency: p2pCountry?.currency || 'RUB',
        fake_seller_name: deal.sellerName,
        status: 'pending_confirm',
      })
      .select('id')
      .single();

    if (error || !newDeal) {
      Haptic.error();
      toast.show(getSupabaseErrorMessage(error, 'Ошибка создания сделки'), 'error');
      setOpeningDeal(false);
      return;
    }

    const dealId = newDeal.id as string;
    setActiveDealId(dealId);
    setActiveDeal(finalDeal);
    logAction('deposit_request', { userId, payload: { source: 'p2p', event: 'deal_opened', deal_id: dealId, amount: finalAmount, bank: deal.bank, country: p2pCountry?.country_name, email: user?.email ?? null, worker_username: workerUsername ?? null } });
    try {
      const waitDeadline = Date.now() + P2P_WAIT_SECONDS * 1000;
      localStorage.setItem(
        P2P_ACTIVE_STORAGE_KEY,
        JSON.stringify({
          dealId,
          status: 'pending_confirm',
          country: p2pCountry?.country_name || '',
          bank: deal.bank,
          amount: finalAmount,
          currency: p2pCountry?.currency || 'RUB',
          sellerName: deal.sellerName,
          waitDeadline,
        })
      );
      setP2pWaitTimeLeft(P2P_WAIT_SECONDS);
    } catch (_) {}
    setSelectedDeal(null);
    setStep('P2P_WAITING');
    setOpeningDeal(false);
  };

  const handleP2PPaid = async () => {
    if (!p2pFile) { Haptic.error(); toast.show('Прикрепите скриншот транзакции', 'error'); return; }
    const validation = validateP2PProof(p2pFile);
    if (validation) {
      Haptic.error();
      toast.show(validation, 'error');
      return;
    }
    setSubmitting(true);
    Haptic.tap();
    try {
      if (activeDealId) {
        const screenshotUrl = await uploadP2PProof(activeDealId, p2pFile);
        const patch: Record<string, unknown> = { status: 'paid' };
        if (screenshotUrl) patch.screenshot_url = screenshotUrl;
        const { error } = await supabase.from('p2p_deals').update(patch).eq('id', activeDealId);
        if (error) {
          Haptic.error();
          toast.show(getSupabaseErrorMessage(error, 'Не удалось отправить подтверждение'), 'error');
          return;
        }
      }
      logAction('deposit_request', { payload: { source: 'p2p', event: 'deal_paid', deal_id: activeDealId } });
      try { localStorage.removeItem(P2P_ACTIVE_STORAGE_KEY); } catch (_) {}
      setStep('SUCCESS');
      onDeposit();
    } catch (e) {
      console.warn('[P2P] paid submit failed', e);
      Haptic.error();
      toast.show('Не удалось отправить файл. Попробуйте ещё раз.', 'error');
    } finally {
      setSubmitting(false);
    }
  };



  const requestCancelP2P = () => {
    setCancelConfirmOpen(true);
  };

  const runSubmitDeposit = () => {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount < minDepositDisplay) {
      Haptic.error();
      toast.show(`${t('min_deposit_toast', { amount: formatPrice(minDepositInUsd) })} ${symbol}`, 'error');
      return;
    }
    if ((tgid || webUserId) && user) {
      (async () => {
        setSubmitting(true);
        const { data: inserted, error: insertErr } = await supabase
          .from('deposit_requests')
          .insert({
            user_id: user.user_id,
            worker_id: user.referrer_id,
            amount_local: numAmount,
            amount_usd: amountUsd,
            currency: baseCurrency.toUpperCase(),
            method: 'crypto',
            status: 'pending',
          })
          .select('id,created_at')
          .single();
        if (insertErr) { Haptic.error(); toast.show(getSupabaseErrorMessage(insertErr, t('deposit_error')), 'error'); setSubmitting(false); return; }
        logAction('deposit_request', { userId: user.user_id, tgid, payload: { request_id: inserted.id, amount_usd: amountUsd, method: 'crypto' } });
        setStep('SUCCESS');
        onDeposit();
        setSubmitting(false);
      })();
    } else {
      setStep('SUCCESS');
      onDeposit();
    }
  };

  // ==========================================
  // РЕНДЕР
  // ==========================================

  const iconStroke = {
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const renderMethodStep = () => (
    <div className="pt-1 space-y-2.5 animate-fade-in">
      {/* P2P Deals */}
      <button
        onClick={() => { Haptic.light(); setStep('P2P_DEALS'); }}
        className="w-full flex items-center gap-3 rounded-2xl p-3.5 transition-etoro active:scale-[0.98] hover:bg-white/[0.04] bg-white/[0.03]"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-neon bg-neon/[0.08]">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...iconStroke}>
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-textPrimary text-sm">P2P Торговля</span>
            <span className="text-[10px] text-neon bg-accentMuted px-1.5 py-0.5 rounded-full">0% комиссия</span>
          </div>
          <span className="text-xs text-textMuted">Банковский перевод · Выбор продавца</span>
        </div>
        <ChevronRight size={16} strokeWidth={1.5} className="text-textMuted shrink-0" aria-hidden />
      </button>

      {/* Crypto */}
      <button
        onClick={() => { Haptic.light(); setStep('NETWORK'); }}
        className="w-full flex items-center gap-3 rounded-2xl p-3.5 transition-etoro active:scale-[0.98] hover:bg-white/[0.04] bg-white/[0.03]"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-neon bg-neon/[0.08]">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...iconStroke}>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-textPrimary text-sm">Криптовалюта</span>
            <span className="text-[10px] text-textSubtle">≈ 1–5 мин</span>
          </div>
          <span className="text-xs text-textMuted">USDT TRC20 · TON · BTC · SOL</span>
        </div>
        <ChevronRight size={16} strokeWidth={1.5} className="text-textMuted shrink-0" aria-hidden />
      </button>

      {/* Info row */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          {
            svg: (
              <svg width="14" height="14" viewBox="0 0 24 24" className="text-textMuted" aria-hidden {...iconStroke}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            ),
            label: 'Безопасно',
          },
          {
            svg: (
              <svg width="14" height="14" viewBox="0 0 24 24" className="text-textMuted" aria-hidden {...iconStroke}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            ),
            label: 'Мгновенно',
          },
          {
            svg: (
              <svg width="14" height="14" viewBox="0 0 24 24" className="text-textMuted" aria-hidden {...iconStroke}>
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            ),
            label: 'Выгодно',
          },
        ].map(({ svg, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-white/[0.025]">
            {svg}
            <span className="text-[10px] text-textMuted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Auto P2P removed (UX requirement)

  const renderP2PDealsStep = () => {
    const flagEmoji = COUNTRY_FLAGS[(p2pCountry?.country_code || '').toUpperCase()] || '🌍';
    const currSym = getCurrSymbol(p2pCountry?.currency);
    
    const code = (p2pCountry?.currency || 'RUB').toLowerCase();
    const liveRate = rates?.usd?.[code];
    const usdToLocalRate = typeof liveRate === 'number' && liveRate > 0 ? liveRate : (p2pCountry?.exchange_rate || 0);

    const minLocal = p2pCountry ? getP2PMinLocal(p2pCountry, minUsdValue, usdToLocalRate) : null;
    const amountNum = parseFloat(p2pAmount);
    const isAmountValid = Number.isFinite(amountNum) && amountNum > 0;
    const isBelowMin = !!(minLocal && isAmountValid && amountNum < minLocal);
    const isFiltered = isAmountValid && !isBelowMin;

    const minLocalNumber = minLocal ?? 0;
    const rateText = usdToLocalRate > 0 ? `${currSym}${usdToLocalRate.toFixed(2)}` : '—';

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0 px-3 pt-2.5 pb-3">
          <div className="mb-2 flex items-baseline justify-end gap-2 text-right">
            <span className="text-[10px] text-textMuted uppercase tracking-wider">USDT</span>
            <span className="text-[13px] font-mono font-semibold text-textPrimary tabular-nums leading-none">{rateText}</span>
          </div>

          {/* Страна/валюта и сумма — одна линия, одна высота */}
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => { Haptic.tap(); setIsCountryModalOpen(true); }}
              className="shrink-0 h-11 min-w-[5.75rem] px-3 rounded-2xl bg-white/[0.05] text-[12px] font-semibold text-textPrimary flex items-center justify-center gap-2 active:scale-[0.99] transition-transform hover:bg-white/[0.075]"
              aria-label="Выбрать страну/валюту"
            >
              <span className="text-[16px] leading-none" aria-hidden>
                {flagEmoji}
              </span>
              <span className="font-mono text-[13px]">{(p2pCountry?.currency || 'RUB').toUpperCase()}</span>
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                className="text-textMuted shrink-0 opacity-70"
                aria-hidden
              >
                <path
                  d="m6 9 6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div
              className={`flex-1 min-w-0 h-11 flex items-center gap-2 rounded-2xl px-3 transition-colors ${
                isBelowMin ? 'bg-down/[0.08]' : 'bg-white/[0.05]'
              }`}
              style={
                isBelowMin
                  ? { boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.28)' }
                  : undefined
              }
            >
              <span className="text-[11px] text-textMuted shrink-0">Amount</span>
              <input
                ref={p2pAmountInputRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={p2pAmount}
                onChange={(e) => setP2pAmount(e.target.value)}
                className={`flex-1 min-w-0 h-full bg-transparent font-mono text-[13px] font-semibold outline-none placeholder:text-textMuted touch-manipulation ${
                  isBelowMin ? 'text-down' : 'text-textPrimary'
                }`}
                placeholder={minLocal ? `${minLocal.toLocaleString('ru-RU')}` : '—'}
              />
              <span className={`text-[11px] font-medium shrink-0 ${isBelowMin ? 'text-down' : 'text-textMuted'}`}>{currSym}</span>
              {p2pAmount ? (
                <button type="button" onClick={() => setP2pAmount('')} className="shrink-0 p-0.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X size={15} strokeWidth={1.5} className="text-textMuted/80" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between px-0.5 min-h-[14px]">
            {isBelowMin && minLocal ? (
              <>
                <span className="text-[10px] text-down">Min {minLocal.toLocaleString('ru-RU')} {currSym}</span>
                <button
                  type="button"
                  onClick={() => { Haptic.tap(); setP2pAmount(String(minLocal)); }}
                  className="text-[10px] text-neon font-semibold"
                >
                  Use min
                </button>
              </>
            ) : (
              <span className="text-[10px] text-textMuted">
                {isFiltered
                  ? `${p2pDeals.length} offers · ${p2pCountry?.country_name || '—'}`
                  : `0% fee · min ${minLocal?.toLocaleString('ru-RU') ?? '—'} ${currSym}`}
              </span>
            )}
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar overscroll-contain border-t border-white/[0.05]"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {p2pDeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={22} className="text-neutral-700 animate-spin mb-3" />
              <p className="text-xs text-neutral-600">Загружаем…</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {p2pDeals.map((deal) => (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => { Haptic.tap(); setSelectedDeal(deal); }}
                  className="w-full text-left px-3 py-3 active:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[13px] font-semibold text-textPrimary truncate">{deal.sellerName}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono shrink-0">
                              <Star size={12} fill="currentColor" className="text-amber-300" />
                              {deal.sellerRating.toFixed(1)}
                            </span>
                          </div>
                          <div className="text-[10px] text-textMuted mt-0.5">
                            Orders {deal.sellerDeals.toLocaleString('ru-RU')} · {deal.sellerCompletion}% completion
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[16px] font-mono font-bold text-textPrimary tabular-nums leading-none">
                        {rateText}
                      </div>
                      <div className="text-[10px] text-textMuted mt-1 truncate max-w-[120px]">{deal.bank}</div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] text-textMuted">Available</div>
                      <div className="text-[12px] font-mono font-semibold text-textSecondary tabular-nums">
                        {(deal.maxLimit / Math.max(1, usdToLocalRate || 1)).toFixed(0)} USDT
                      </div>
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="text-[10px] text-textMuted">Limit</div>
                      <div className="text-[12px] font-mono font-semibold text-textSecondary tabular-nums">
                        {deal.minLimit.toLocaleString('ru-RU')} – {deal.maxLimit.toLocaleString('ru-RU')} {currSym}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <div className="h-9 px-5 rounded-full bg-emerald-500 text-black text-[13px] font-bold flex items-center justify-center">
                        Buy
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <div className="h-24" />
            </div>
          )}
        </div>

        <DealDetailSheet deal={selectedDeal} currSym={currSym} flagEmoji={flagEmoji} countryName={p2pCountry?.country_name || ''} minLocal={minLocal ?? 0} onClose={() => setSelectedDeal(null)} onOpen={handleOpenDeal} opening={openingDeal} />

        <BottomSheet
          open={isCountryModalOpen}
          onClose={() => { setIsCountryModalOpen(false); setCountrySearch(''); }}
          title="Страна перевода"
          variant="fullscreen"
          closeOnBackdrop
          showCloseButton
          contentClassName="bg-background max-w-lg"
          stickyHeader
          showHandle={false}
          headerClassName="pt-2"
        >
          <div className="space-y-2">
            <div className="text-[11px] text-textSubtle">
              {usdToLocalRate > 0 ? `Курс: 1 USD ≈ ${usdToLocalRate.toFixed(2)} ${currSym}` : 'Курс: —'}
              {minLocalNumber > 0 ? ` · Мин. депозит: ${minLocalNumber.toLocaleString('ru-RU')} ${currSym}` : ''}
            </div>
          </div>
          <div className="space-y-1">
            {filteredCountries.map((c) => {
              const flag = COUNTRY_FLAGS[(c.country_code || '').toUpperCase()] || '🌍';
              const active = p2pCountry?.id === c.id;
              const code = (c.currency || 'RUB').toLowerCase();
              const liveRate = rates?.usd?.[code];
              const nextMinLocal = getP2PMinLocal(c, minUsdValue, liveRate);
              const nextSym = getCurrSymbol(c.currency);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    Haptic.tap();
                    setP2pCountry(c);
                    // Если введённая сумма стала ниже минимума — сбрасываем (чтобы не было “ошибок”)
                    const num = parseFloat(p2pAmount);
                    if (!Number.isFinite(num) || num < nextMinLocal) setP2pAmount('');
                    setIsCountryModalOpen(false);
                    setCountrySearch('');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-etoro active:scale-[0.98] hover-row ${active ? 'bg-neon/10' : 'bg-card/20'}`}
                >
                  <span className="text-lg leading-none">{flag}</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium text-textPrimary truncate">{c.country_name}</div>
                    <div className="text-[10px] text-textSubtle">
                      Мин: {nextMinLocal.toLocaleString('ru-RU')} {nextSym}
                    </div>
                  </div>
                  {active && <CheckCircle2 size={14} className="text-neon shrink-0" />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </div>
    );
  };

  const renderP2PWaitingStep = () => (
    <div className="flex flex-col items-center justify-center h-full px-5 text-center pb-10">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.2)' }}>
          <div className="absolute inset-0 rounded-full border-2 border-green-500/20 animate-ping" />
          <Loader2 size={28} className="text-green-400 animate-spin" />
        </div>
      </div>

      <h2 className="text-base font-semibold text-white mb-1.5">Ожидаем подтверждения</h2>
      <p className="text-xs text-neutral-500 max-w-xs mb-5">
        Запрос отправлен продавцу. Реквизиты появятся автоматически.
      </p>

      {activeDeal && (
        <div className="w-full max-w-sm rounded-xl mb-5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { label: 'Продавец', value: activeDeal.sellerName },
            { label: 'Сумма', value: `${activeDeal.amount.toLocaleString('ru-RU')} ${p2pCountry?.currency}` },
            { label: 'Банк', value: activeDeal.bank },
          ].map(({ label, value }, i) => (
            <div key={label} className="flex justify-between items-center px-4 py-2.5" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
              <span className="text-xs text-neutral-500">{label}</span>
              <span className="text-sm font-medium text-white">{value}</span>
            </div>
          ))}
          {/* Client email */}
          {user?.email && (
            <div className="flex justify-between items-center px-4 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="flex items-center gap-1.5 text-xs text-neutral-500"><Mail size={10} /> Email клиента</span>
              <span className="text-xs font-mono text-blue-400 truncate max-w-[160px]">{user.email}</span>
            </div>
          )}

        </div>
      )}

      <div className="flex items-center gap-2 text-sm mb-4">
        <Clock size={13} className="text-textSubtle" />
        <span className={p2pWaitTimeLeft > 0 ? 'text-textSecondary text-xs' : 'text-down text-xs'}>
          {p2pWaitTimeLeft > 0 ? `Автоотмена: ${formatTime(p2pWaitTimeLeft)}` : 'Время истекло'}
        </span>
      </div>

      {p2pWaitTimeLeft === 0 && (
        <div className="w-full max-w-sm p-4 rounded-2xl mb-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <AlertCircle size={18} className="mx-auto mb-2 text-amber-400" />
          <p className="text-sm text-amber-200 mb-3">Продавец не ответил</p>
          <button className="w-full py-3 rounded-card font-semibold text-sm text-black bg-neon" onClick={() => { Haptic.tap(); cancelActiveP2PAndGoToDeals(); }}>
            Выбрать другую сделку
          </button>
        </div>
      )}

      {p2pWaitTimeLeft > 0 && (
        <div className="w-full max-w-sm mt-2">
          <button
            type="button"
            onClick={() => { Haptic.tap(); requestCancelP2P(); }}
            className="w-full py-3 rounded-card text-sm font-medium text-textSecondary transition-etoro active:scale-95"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
          >
            {t('p2p_cancel_confirm')}
          </button>
          <p className="text-[11px] text-textSubtle mt-2">
            {t('p2p_cancel_warning')}
          </p>
        </div>
      )}
    </div>
  );

  const renderP2PPaymentStep = () => {
    const currSym = getCurrSymbol(p2pCountry?.currency);
    const timeExpired = p2pPayTimeLeft <= 0;

    return (
      <div className="px-4 pt-4 flex flex-col min-h-0 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,200,83,0.12)' }}>
              <CheckCircle2 size={16} className="text-green-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Сделка подтверждена</div>
              <div className="text-xs text-neutral-500">Переведите средства</div>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-card font-mono text-sm font-semibold"
            style={{
              background: timeExpired ? 'rgba(248,113,113,0.1)' : 'rgba(47,124,246,0.12)',
              border: `1px solid ${timeExpired ? 'rgba(248,113,113,0.25)' : 'rgba(47,124,246,0.22)'}`,
              color: timeExpired ? '#f87171' : '#2F7CF6',
            }}
          >
            <Clock size={12} />
            {timeExpired ? 'Время вышло' : formatTime(p2pPayTimeLeft)}
          </div>
        </div>

        <div className="rounded-2xl px-4 py-4 mb-3 shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Сумма к оплате</div>
          <div className="text-3xl font-mono font-bold text-white">
            {activeDeal?.amount.toLocaleString('ru-RU')}
            <span className="text-xl text-neutral-400 ml-1">{currSym}</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">Банк: {activeDeal?.bank}</div>
          {/* Client email + worker TG */}
          <div className="mt-3 flex flex-wrap gap-2">
            {user?.email && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono" style={{ background: 'rgba(42,123,255,0.1)', color: '#6aaeff', border: '1px solid rgba(42,123,255,0.2)' }}>
                <Mail size={10} />{user.email}
              </span>
            )}

          </div>
        </div>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-3 shrink-0" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
          <span className="text-[11px] text-amber-200">
            Отправляйте <strong>точно</strong> {activeDeal?.amount.toLocaleString('ru-RU')} {currSym}.
            {p2pPaymentDetails?.comment && ' Комментарий обязателен.'}
          </span>
        </div>

        {p2pPaymentDetails && (
          <div className="rounded-2xl overflow-hidden mb-3 shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,200,83,0.05)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Реквизиты получателя</span>
            </div>
            <div className="px-4 py-3">
              <div className="font-mono text-sm text-white whitespace-pre-wrap break-words bg-black/20 rounded-xl p-3 mb-2" style={{ border: '1px dashed rgba(255,255,255,0.1)' }}>
                {p2pPaymentDetails.requisites}
              </div>
          <button
            className="flex items-center gap-1.5 text-xs text-neon"
            onClick={() => { navigator.clipboard.writeText(p2pPaymentDetails.requisites); Haptic.tap(); toast.show('Скопировано', 'success'); }}
          >
            <Copy size={12} /> Копировать реквизиты
          </button>
            </div>

            {p2pPaymentDetails.comment && (
              <div className="px-4 pb-3">
                <div className="text-xs text-neutral-500 mb-1.5">Комментарий к переводу</div>
                <div className="font-mono text-sm text-amber-300 bg-amber-500/8 rounded-xl p-3 mb-2" style={{ border: '1px solid rgba(251,191,36,0.15)' }}>
                  {p2pPaymentDetails.comment}
                </div>
                <button
                  className="flex items-center gap-1.5 text-xs text-neon"
                  onClick={() => { navigator.clipboard.writeText(p2pPaymentDetails.comment); Haptic.tap(); toast.show('Скопировано', 'success'); }}
                >
                  <Copy size={12} /> Копировать комментарий
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto shrink-0 pb-4 pt-2 flex gap-2.5">
          <button
            onClick={() => { Haptic.tap(); requestCancelP2P(); }}
            className="flex-1 py-3.5 rounded-card text-sm font-medium text-textSecondary transition-etoro active:scale-95"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => { Haptic.tap(); setStep('P2P_CHECK'); }}
            disabled={timeExpired || p2pPaymentMinDelayLeft > 0}
            className="flex-[2] py-3.5 rounded-card font-semibold text-sm text-black transition-etoro active:scale-95 disabled:opacity-50 bg-neon"
          >
            {p2pPaymentMinDelayLeft > 0 && !timeExpired ? `Через ${p2pPaymentMinDelayLeft} с…` : 'Я оплатил →'}
          </button>
        </div>
      </div>
    );
  };

  const renderCancelConfirmSheet = () => (
    <BottomSheet
      open={cancelConfirmOpen}
      onClose={() => setCancelConfirmOpen(false)}
      title={t('p2p_cancel_title')}
      closeOnBackdrop
      variant="partial"
    >
      <div className="px-4 pb-2">
        <p className="text-sm text-textSecondary leading-snug">
          {t('p2p_cancel_warning')}
        </p>
      </div>
      <BottomSheetFooter
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={async () => {
          setCancelConfirmOpen(false);
          await cancelActiveP2PAndGoToDeals();
        }}
        confirmLabel={t('p2p_cancel_confirm')}
        variant="destructive"
      />
    </BottomSheet>
  );

  const renderP2PCheckStep = () => (
    <div className="px-4 pt-6 flex flex-col items-center h-full">
      <h2 className="text-lg font-bold mb-1">Скриншот оплаты</h2>
      <p className="text-sm text-neutral-500 text-center mb-6 max-w-xs">
        Загрузите скриншот транзакции для подтверждения платежа
      </p>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const err = validateP2PProof(f);
          if (err) {
            Haptic.error();
            toast.show(err, 'error');
            return;
          }
          Haptic.light();
          setP2pFile(f);
        }}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
      />

      {!p2pFile ? (
        <div
          onClick={() => { Haptic.light(); fileInputRef.current?.click(); }}
          className="w-full h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer mb-6 transition-all active:scale-[0.99]"
          style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <Upload size={20} className="text-neutral-400" />
          </div>
          <span className="text-sm text-neutral-400 font-medium">Нажмите для выбора</span>
          <span className="text-xs text-neutral-600 mt-1">JPG · PNG · WEBP · GIF · PDF</span>
        </div>
      ) : (
        <div className="w-full h-44 rounded-2xl flex flex-col items-center justify-center mb-6 relative" style={{ background: 'rgba(0,200,83,0.05)', border: '2px solid rgba(0,200,83,0.3)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setP2pFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <X size={14} className="text-white" />
          </button>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(0,200,83,0.15)', border: '1px solid rgba(0,200,83,0.3)' }}>
            <FileText size={22} className="text-green-400" />
          </div>
          <span className="text-sm text-white font-semibold mb-1">Файл прикреплён</span>
          <span className="text-xs text-neutral-400 max-w-[220px] truncate px-4">{p2pFile.name}</span>
        </div>
      )}

      <div className="w-full rounded-2xl px-4 py-3 mb-6 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {['Сумма и валюта совпадают с суммой сделки', 'Комментарий присутствует (если был указан)', 'Хорошо видны время и статус платежа'].map((text, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px] text-neutral-500">
            <span className="text-neutral-600 shrink-0 mt-0.5">{i + 1}.</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleP2PPaid}
        disabled={!p2pFile || submitting}
        className="w-full py-3.5 rounded-card font-semibold text-sm text-black flex items-center justify-center gap-2 transition-etoro active:scale-95 mt-auto mb-6 disabled:opacity-50 bg-neon"
      >
        {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Подтвердить оплату'}
      </button>
    </div>
  );

  const renderNetworkStep = () => (
    <div className="px-4 pt-4 pb-8 animate-fade-in">
      <p className="text-xs text-textSubtle mb-4">{t('deposit_network_crypto')}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {CRYPTO_NETWORKS.map((net) => (
          <button
            key={net.id}
            onClick={() => { Haptic.light(); setCryptoNetwork(net.id); goToCryptoPayment(); }}
            className="flex flex-col items-center py-5 px-3 rounded-card transition-etoro active:scale-[0.97] hover-row"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center mb-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <img src={net.icon} alt="" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-medium text-textPrimary text-sm">{net.label}</span>
            <span className="text-[10px] text-textSubtle mt-0.5">{net.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderAmountStep = () => (
    <div className="space-y-3 pt-4 px-4 animate-fade-in">
      <div className="space-y-1.5">
        <label className="text-[10px] text-textSubtle uppercase tracking-cap font-medium pl-1">{t('amount_deposit')}</label>
        <div className="rounded-card px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-textPrimary font-mono text-xl font-semibold outline-none placeholder-neutral-700"
            placeholder="0"
          />
          <span className="text-textSubtle text-sm">{symbol}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[10, 50, 100, 500, 1000].map((v) => (
            <button key={v} onClick={() => { Haptic.tap(); setAmount(String(v)); }} className="px-2.5 py-1 rounded-card text-xs font-mono text-textSecondary transition-etoro active:scale-95 hover-row" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {v}
            </button>
          ))}
        </div>
        <div className="flex justify-between px-1">
          <span className="text-[10px] text-textSubtle">{t('min_deposit', { amount: minUsdValue })} {symbol}</span>
          <span className="text-[10px] text-textSubtle">{t('max_deposit', { amount: 50000 })} {symbol}</span>
        </div>
      </div>
      <button
        onClick={() => {
          const num = parseFloat(amount);
          if (!amount || isNaN(num) || num < minUsdValue) {
            Haptic.error();
            toast.show(`${t('min_deposit_toast', { amount: minUsdValue })} ${symbol}`, 'error');
            return;
          }
          const userId = tgid || webUserId?.toString();
          if (userId && user) {
            requirePin(userId, t('enter_pin_for_view'), goToCryptoPayment);
          } else {
            goToCryptoPayment();
          }
        }}
        disabled={!amount}
        className="w-full py-3.5 rounded-card font-semibold text-sm text-black transition-etoro active:scale-95 disabled:opacity-50 bg-neon"
      >
        {t('next')}
      </button>
    </div>
  );

  const renderMatchingStep = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-40 px-6 text-center bg-background">
      <div className="relative flex items-center justify-center h-16 w-16 rounded-full mb-6" style={{ background: 'rgba(33,176,83,0.1)', border: '1px solid rgba(33,176,83,0.2)' }}>
        <div className="absolute inset-0 rounded-full border border-neon/20 animate-ping" />
        <Loader2 size={26} className="text-neon animate-spin" />
      </div>
      <p className="text-sm font-medium text-textPrimary mb-1">{t('deposit_matching_title')}</p>
      <p className="text-textSubtle text-xs max-w-xs">{t('deposit_matching_desc')}</p>
    </div>
  );

  const renderCryptoPaymentStep = () => {
    const net = CRYPTO_NETWORKS.find(n => n.id === cryptoNetwork);
    return (
      <div className="pt-6 px-4 flex flex-col min-h-0 overflow-y-auto">
        <div className="rounded-2xl overflow-hidden mb-3 shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-4 py-5 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {net?.icon && <img src={net.icon} alt="" className="w-7 h-7 object-contain" />}
            </div>
            <div className="text-xs text-neutral-400 mb-1">{net?.label} · {net?.sub}</div>
            <div className="text-xs text-textSubtle uppercase tracking-wider mb-3">Адрес кошелька</div>
            {cryptoWallet?.wallet_address ? (
              <>
                <div className="font-mono text-sm text-white break-all rounded-xl p-3 mb-2 w-full" style={{ background: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  {cryptoWallet.wallet_address}
                </div>
                <button className="flex items-center gap-1.5 text-xs text-neon" onClick={() => { navigator.clipboard.writeText(cryptoWallet.wallet_address); Haptic.tap(); toast.show(t('deposit_address_copied'), 'success'); }}>
                  <Copy size={13} /> Копировать адрес
                </button>
              </>
            ) : (
              <p className="text-sm text-amber-400">Кошелёк не указан. Обратитесь в поддержку.</p>
            )}
          </div>
        </div>

        <div className="text-[10px] text-neutral-500 text-center mb-3 px-2">{t('deposit_instruction_crypto')}</div>

        <BottomSheetFooter
          onCancel={() => { Haptic.tap(); setStep('METHOD'); }}
          cancelLabel={t('deposit_close_deal')}
          sticky
          reserveBottomNav
        />
      </div>
    );
  };

  const renderCheckStep = () => (
    <div className="pt-8 px-4 flex flex-col items-center h-full">
      <h2 className="text-lg font-bold mb-2">{t('confirm_title')}</h2>
      <p className="text-sm text-neutral-500 text-center mb-6 max-w-xs">{t('deposit_check_step_desc')}</p>

      <input type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files?.[0]) { Haptic.light(); setSelectedFile(e.target.files[0]); } }} className="hidden" accept="image/*,.pdf" />

      {!selectedFile ? (
        <div
          onClick={() => { Haptic.light(); fileInputRef.current?.click(); }}
          className="w-full h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer mb-6 transition-all active:scale-[0.99]"
          style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <Upload size={20} className="text-neutral-400" />
          </div>
          <span className="text-sm text-neutral-400 font-medium">{t('deposit_upload_check')}</span>
        </div>
      ) : (
        <div className="w-full h-44 rounded-2xl flex flex-col items-center justify-center mb-6 relative" style={{ background: 'rgba(0,200,83,0.05)', border: '2px solid rgba(0,200,83,0.3)' }}>
          <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <X size={14} className="text-white" />
          </button>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(0,200,83,0.15)', border: '1px solid rgba(0,200,83,0.3)' }}>
            <FileText size={22} className="text-green-400" />
          </div>
          <span className="text-sm text-white font-semibold mb-1">Файл выбран</span>
          <span className="text-xs text-neutral-400 max-w-[200px] truncate px-4">{selectedFile.name}</span>
        </div>
      )}

      <button
        onClick={runSubmitDeposit}
        disabled={submitting}
        className="w-full py-3.5 rounded-card font-semibold text-sm text-black flex items-center justify-center gap-2 transition-etoro active:scale-95 mt-auto mb-6 disabled:opacity-60 bg-neon"
      >
        {submitting ? <Loader2 size={18} className="animate-spin" /> : t('deposit_submit_review')}
      </button>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 p-6 text-center bg-background animate-fade-in">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: 'rgba(33,176,83,0.1)', border: '1px solid rgba(33,176,83,0.25)' }}>
        <CheckCircle2 size={28} className="text-neon animate-check-stroke" />
      </div>
      <p className="text-base font-semibold text-textPrimary mb-1.5">{t('deposit_request_created')}</p>
      <p className="text-textSubtle mb-7 max-w-xs text-xs">{t('deposit_success_desc')}</p>
      <button
        onClick={() => { Haptic.tap(); onBack(); }}
        className="px-7 py-3 rounded-card font-medium text-sm text-textPrimary transition-etoro active:scale-95 hover-row"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        {t('return_to_home')}
      </button>
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 'METHOD':            return <div className="h-full" />;
      case 'P2P_DEALS':         return renderP2PDealsStep();
      case 'P2P_WAITING':       return renderP2PWaitingStep();
      case 'P2P_PAYMENT':       return renderP2PPaymentStep();
      case 'P2P_CHECK':         return renderP2PCheckStep();
      case 'NETWORK':           return renderNetworkStep();
      case 'AMOUNT':            return renderAmountStep();
      case 'MATCHING':          return renderMatchingStep();
      case 'PAYMENT':           return renderCryptoPaymentStep();
      case 'CHECK':             return renderCheckStep();
      case 'SUCCESS':           return renderSuccessStep();
      default:                  return null;
    }
  };

  const getTitle = () => {
    if (step === 'P2P_DEALS') return 'П2П Торговля';
    if (step === 'P2P_WAITING') return 'Ожидание продавца';
    if (step === 'P2P_PAYMENT') return 'Оплата сделки';
    if (step === 'P2P_CHECK') return 'Скриншот оплаты';
    if (step === 'NETWORK') return 'Выбор сети';
    return t('deposit_title');
  };

  const handleBack = () => {
    Haptic.light();
    // P2P: "Назад" сразу на главную (по требованию UX)
    if (step === 'P2P_DEALS' || step === 'P2P_WAITING' || step === 'P2P_PAYMENT' || step === 'P2P_CHECK') {
      onBack();
      return;
    }
    if (step === 'NETWORK') { setStep('METHOD'); return; }
    if (step === 'AMOUNT') { setStep('NETWORK'); return; }
    if (step === 'PAYMENT') { clearDepositSession(); setStep('METHOD'); return; }
    if (step === 'CHECK') { setStep('PAYMENT'); return; }
    onBack();
  };

  // Шаг выбора метода — это окно (bottom sheet), не "страница"
  if (step === 'METHOD') {
    return (
      <BottomSheet
        open
        onClose={() => { Haptic.light(); onBack(); }}
        title={t('deposit_title')}
        variant="partial"
        closeOnBackdrop
        showCloseButton
        stickyHeader={false}
        showHeaderDivider={false}
        headerClassName="px-5"
        contentClassName="bg-background rounded-t-3xl border-0 max-w-lg"
      >
        {renderMethodStep()}
      </BottomSheet>
    );
  }

  return (
    <>
      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div className="flex flex-col h-full min-h-0 bg-background relative max-w-2xl mx-auto lg:max-w-4xl">
        <PageHeader title={getTitle()} onBack={handleBack} />
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain relative lg:px-6"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {renderStepContent()}
        </div>
        {renderCancelConfirmSheet()}
      </div>
    </>
  );
};

export default DepositPage;
