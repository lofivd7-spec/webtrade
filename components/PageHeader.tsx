import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Haptic } from '../utils/haptics';
import {
  APP_TOP_BAR_CLASS,
  APP_TOP_BAR_ROW,
  APP_TOP_BAR_STYLE,
  APP_TOP_BAR_TITLE_CLASS,
} from './appTopBar';

export interface PageHeaderProps {
  /** Заголовок экрана (справа от кнопки «Назад») */
  title?: React.ReactNode;
  /** Обработчик возврата. Если передан — показывается кнопка «Назад» в шапке (единственная точка возврата на экране). */
  onBack?: () => void;
  /** Дополнительные элементы справа (опционально) */
  right?: React.ReactNode;
  className?: string;
}

const BACK_BUTTON_CLASS =
  'touch-target py-2 -ml-2 rounded-xl text-textMuted hover:text-textPrimary active:scale-95 transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-neon/30 min-h-[40px] min-w-[40px] relative z-10';

/**
 * Единая шапка вложенных экранов: одна кнопка «Назад» слева, заголовок по центру.
 * Использовать на всех экранах с возвратом — чтобы пользователь привык к одному месту навигации.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, onBack, right, className = '' }) => {
  const handleBack = () => {
    if (onBack) {
      Haptic.tap();
      onBack();
    }
  };

  return (
    <header className={`${APP_TOP_BAR_CLASS} ${className}`} style={APP_TOP_BAR_STYLE}>
      <div className={`${APP_TOP_BAR_ROW} relative`}>
        {onBack ? (
          <button
            type="button"
            onClick={handleBack}
            className={BACK_BUTTON_CLASS}
            aria-label="Назад"
          >
            <ArrowLeft size={20} strokeWidth={1.75} className="icon-muted" />
          </button>
        ) : (
          <div className="w-10 h-10 shrink-0 relative z-10" aria-hidden />
        )}
        
        {title != null && (
          <div className="absolute inset-x-12 inset-y-0 flex items-center justify-center pointer-events-none pb-2.5 lg:pb-3">
            {typeof title === 'string' ? (
              <span className={`${APP_TOP_BAR_TITLE_CLASS} truncate block text-center px-2`}>{title}</span>
            ) : (
              title
            )}
          </div>
        )}
        
        <div className="flex-1" />
        
        {right != null ? (
          <div className="shrink-0 relative z-10 flex items-center justify-end min-w-[40px]">
            {right}
          </div>
        ) : (
          <div className="w-10 h-10 shrink-0 relative z-10" aria-hidden />
        )}
      </div>
    </header>
  );
};

export default PageHeader;
