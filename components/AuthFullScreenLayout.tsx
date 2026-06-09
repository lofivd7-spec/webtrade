import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ETORO_LOGO_URL } from '../constants';
import { Haptic } from '../utils/haptics';

interface AuthFullScreenLayoutProps {
  children: React.ReactNode;
  onBack: () => void;
  title?: string;
  subtitle?: string;
}

const AuthFullScreenLayout: React.FC<AuthFullScreenLayoutProps> = ({
  children,
  onBack,
  title,
  subtitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-[300] bg-background text-textPrimary overflow-y-auto overflow-x-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Clean background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-[30%] right-[-20%] w-[600px] h-[600px] bg-neon/[0.06] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-[#1b8eff]/[0.04] blur-[100px] rounded-full" />
      </div>

      <div className="min-h-full w-full lg:grid lg:grid-cols-2">
        {/* LEFT: Hero (desktop only) — clean, minimal */}
        <aside className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[#060a12] via-[#080d1a] to-[#0a1020] border-r border-border/40">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute top-[10%] left-[15%] w-72 h-72 bg-neon/[0.05] blur-[100px] rounded-full" />
            <div className="absolute bottom-[25%] right-[10%] w-48 h-48 bg-white/[0.03] blur-[80px] rounded-full" />
          </div>

          <div className="relative flex-1 flex flex-col justify-between p-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon/20 to-neon/5 ring-1 ring-white/10 flex items-center justify-center overflow-hidden">
                <img src={ETORO_LOGO_URL} alt="" width={24} height={24} className="object-contain" />
              </div>
              <span className="text-lg font-bold tracking-tight text-ink">MEXC</span>
            </div>

            <div className="space-y-2 -mt-16">
              <h1 className="text-[2rem] font-bold tracking-tight text-ink leading-[1.1]">
                Профессиональная
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-neon to-[#5ba3ff]">
                  криптобиржа
                </span>
              </h1>
              <p className="text-sm text-textSecondary max-w-sm leading-relaxed">
                Спот, фьючерсы, аналитика. Всё в одном терминале для реальной торговли.
              </p>
            </div>

            <div className="space-y-3">
              {[
                'Мгновенные депозиты и выводы',
                'Рыночные данные в реальном времени',
                'Защита средств и анонимность',
              ].map((text) => (
                <div key={text} className="flex items-center gap-3 text-sm text-textSecondary">
                  <div className="w-1.5 h-1.5 rounded-full bg-neon shrink-0" />
                  {text}
                </div>
              ))}
            </div>

            <div className="text-[11px] text-textMuted">&copy; MEXC {new Date().getFullYear()}</div>
          </div>
        </aside>

        {/* RIGHT: Form */}
        <section className="relative flex flex-col min-h-full">
          {/* Header */}
          <header className="relative shrink-0 flex items-center gap-3 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                Haptic.light();
                onBack();
              }}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-textMuted hover:text-textPrimary hover:bg-card/60 transition-all -ml-2"
              aria-label="Назад"
            >
              <ArrowLeft size={20} strokeWidth={1.5} />
            </button>

            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon/20 to-neon/5 ring-1 ring-white/10 flex items-center justify-center overflow-hidden">
                <img src={ETORO_LOGO_URL} alt="" width={18} height={18} className="object-contain" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-ink">MEXC</span>
            </div>
          </header>

          {(title || subtitle) && (
            <div className="relative shrink-0 px-5 pt-4 pb-2">
              {title ? <h1 className="text-xl font-bold text-ink tracking-tight">{title}</h1> : null}
              {subtitle ? <p className="text-sm text-textSecondary mt-1">{subtitle}</p> : null}
            </div>
          )}

          <div className="relative flex-1 px-5 pb-10 pt-4">
            <div className="max-w-sm mx-auto w-full">
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthFullScreenLayout;
