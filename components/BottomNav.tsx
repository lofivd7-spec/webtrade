import React from 'react';
import { PageView, NavItem } from '../types';
import { Haptic } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';
import { NavHomeIcon, NavMarketsIcon, NavTradeIcon, NavWalletIcon } from './icons/MexcNavIcons';

interface BottomNavProps {
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
  /** When true, outer shell (fixed / glass) is provided by Layout — ribbon + dock share one panel */
  embedded?: boolean;
}

const pageToNav: Partial<Record<PageView, PageView>> = {
  DEPOSIT: 'HOME',
  WITHDRAW: 'HOME',
  PROFILE: 'HOME',
  KYC: 'HOME',
  SUPPORT: 'HOME',
  LANGUAGE: 'HOME',
  CURRENCY: 'HOME',
  QR_SCANNER: 'HOME',
  NFT_COLLECTION: 'COINS',
  NFT_ITEM: 'COINS',
};

const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onNavigate, embedded = false }) => {
  const { t } = useLanguage();
  const navItems: NavItem[] = [
    { id: 'HOME', label: t('nav_home'), icon: NavHomeIcon },
    { id: 'COINS', label: t('nav_coins'), icon: NavMarketsIcon },
    { id: 'TRADING', label: t('nav_trading'), icon: NavTradeIcon },
    { id: 'DEALS', label: t('nav_deals'), icon: NavWalletIcon },
  ];

  const activeNav = pageToNav[currentPage] ?? currentPage;

  const navBody = (
    <div className="flex justify-around items-stretch min-h-[50px] px-2 pt-1 pb-0">
      {navItems.map((item) => {
        const isActive = activeNav === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => { Haptic.tap(); onNavigate(item.id); }}
            className="touch-target nav-item flex flex-col items-center justify-center flex-1 min-w-0 gap-1 py-1.5"
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="flex items-center justify-center rounded-2xl">
              <div className="h-7 w-10 flex items-center justify-center">
                <Icon active={isActive} className={isActive ? 'text-textPrimary' : 'text-textSubtle'} size={19} />
              </div>
            </div>
            <span
              className={`text-[10px] font-semibold tracking-tight transition-colors duration-200 truncate w-full text-center leading-none ${
                isActive ? 'text-textPrimary' : 'text-textSubtle'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (embedded) {
    return <nav className="relative z-50">{navBody}</nav>;
  }

  return (
    <nav
      className="fixed left-0 right-0 bottom-0 z-50 nav-glass border-t border-white/[0.06]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {navBody}
    </nav>
  );
};

export default BottomNav;