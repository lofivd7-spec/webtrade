import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Scan, User } from 'lucide-react';
import { PageView } from '../types';
import { Haptic } from '../utils/haptics';
import { useLanguage } from '../context/LanguageContext';

interface QuickActionsProps {
    onNavigate: (page: PageView) => void;
}

const DepIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
  </svg>
);

const WthIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V8m0 0l-4 4m4-4l4 4M4 4h16" />
  </svg>
);

const ScanIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
  </svg>
);

const UserIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);

const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const actions: { labelKey: string; icon: any; highlight: boolean; target: PageView }[] = [
    { labelKey: 'quick_deposit', icon: DepIcon, highlight: true, target: 'DEPOSIT' },
    { labelKey: 'quick_withdraw', icon: WthIcon, highlight: false, target: 'WITHDRAW' },
    { labelKey: 'quick_scan', icon: ScanIcon, highlight: false, target: 'QR_SCANNER' },
    { labelKey: 'profile', icon: UserIcon, highlight: false, target: 'PROFILE' },
  ];

  return (
    <div className="flex justify-between items-start gap-3 sm:gap-6 px-4 lg:px-6 mb-6 -mt-1 max-w-2xl mx-auto lg:max-w-4xl">
      {actions.map((action) => (
        <button
          key={action.labelKey}
          type="button"
          onClick={() => { Haptic.tap(); onNavigate(action.target); }}
          className="touch-target group flex flex-col items-center flex-1 min-w-0 space-y-3 rounded-2xl active:scale-95 transition-all duration-300 focus:outline-none"
        >
          <div
            className={`
              h-12 w-12 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center transition-all duration-300 border shadow-lg flex-shrink-0
              ${action.highlight
                ? 'bg-accent text-white border-accent shadow-[0_4px_16px_rgba(36,108,249,0.4)] group-hover:bg-blue-600'
                : 'bg-card text-textPrimary border-border shadow-[0_4px_12px_rgba(0,0,0,0.2)] group-hover:border-accent/30 group-hover:shadow-[0_4px_16px_rgba(36,108,249,0.15)]'
              }
            `}
          >
            <action.icon size={22} className="sm:w-7 sm:h-7" />
          </div>
          <span className="text-xs font-semibold text-textSecondary group-hover:text-textPrimary transition-colors text-center leading-tight">
            {t(action.labelKey)}
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActions;