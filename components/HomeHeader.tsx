import React from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { DbUser } from '../context/UserContext';
import { Haptic } from '../utils/haptics';
import { useCurrency } from '../context/CurrencyContext';
import { APP_TOP_BAR_CLASS, APP_TOP_BAR_ROW, APP_TOP_BAR_STYLE } from './appTopBar';
import UserAvatar from './UserAvatar';

interface HomeHeaderProps {
  showBalanceTitle: boolean;
  balance: number;
  user: DbUser | null;
  onSearch?: () => void;
  onProfileClick?: () => void;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({ showBalanceTitle: _showBalanceTitle, balance, user, onSearch, onProfileClick }) => {
  const { formatPrice, symbol } = useCurrency();
  const { t } = useLanguage();
  const formattedBalance = formatPrice(balance, { fractionDigits: 2 });

  return (
    <header className={APP_TOP_BAR_CLASS} style={APP_TOP_BAR_STYLE}>
      <div className={APP_TOP_BAR_ROW}>
        <button
          type="button"
          onClick={() => { Haptic.tap(); onProfileClick?.(); }}
          className="touch-target flex items-center gap-2 min-w-0 px-2 py-1 rounded-full hover:bg-card active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-neon/30 min-h-[44px]"
        >
          <UserAvatar
            name={user?.full_name || user?.username || user?.email || t('profile')}
            photoUrl={user?.photo_url}
            className="h-7 w-7"
            imageClassName="border-neutral-700"
            fallbackClassName="bg-neutral-800 border-neutral-700 text-neon text-[10px]"
            iconClassName="text-neon"
            iconSize={14}
          />
          <div className="hidden xs:flex flex-col items-start leading-tight gap-0">
            <span className="text-[10px] font-semibold text-textMuted uppercase tracking-wider">
              {t('sellbit')}
            </span>
            <span className="text-xs font-medium text-textPrimary truncate max-w-[120px]">
              {user?.full_name || user?.username || t('profile')}
            </span>
          </div>
        </button>

        <div className="flex-1 flex items-center justify-center min-w-0">
          <div className="inline-flex items-baseline gap-1 rounded-full bg-surface px-2.5 py-1">
            <span className="text-[13px] font-bold text-ink tabular-nums tracking-tight">
              {symbol}
              {formattedBalance}
            </span>
          </div>
        </div>

        <button
          onClick={() => { Haptic.tap(); onSearch?.(); }}
          className="touch-target h-11 w-11 rounded-full flex items-center justify-center hover:bg-card active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-neon/30 flex-shrink-0"
        >
          <Search size={17} strokeWidth={1.5} className="text-icon-muted" />
        </button>
      </div>
    </header>
  );
};

export default HomeHeader;
