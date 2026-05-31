import React, { useState } from 'react';
import { TrendingUp, BarChart3, Shield } from 'lucide-react';
import LegalDocModal, { LegalDocId } from '../components/LegalDocModal';
import { ETORO_LOGO_URL } from '../constants';

interface LandingPageProps {
  refId: string;
  bonus: number | null;
  onLogin: () => void;
  onRegister: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ refId, bonus, onLogin, onRegister }) => {
  const [legal, setLegal] = useState<LegalDocId | null>(null);

  return (
    <div className="min-h-[100dvh] bg-background text-white flex flex-col relative overflow-x-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-neon/[0.05] blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#1b8eff]/[0.03] blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
      </div>

      {/* Nav */}
      <header className="landing-animate landing-d1 relative z-20 flex items-center justify-between px-5 sm:px-8 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon/20 to-neon/5 ring-1 ring-white/10 flex items-center justify-center overflow-hidden">
            <img src={ETORO_LOGO_URL} alt="" width={22} height={22} className="object-contain" />
          </div>
          <span className="text-base font-bold text-ink tracking-tight">MEXC</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLogin}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-textSecondary hover:text-textPrimary hover:bg-card/50 transition-all"
          >
            Войти
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-neon text-black hover:bg-[#4a9fff] transition-all"
          >
            Регистрация
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 pb-20">
        {/* Hero */}
        <section className="landing-animate landing-d2 pt-16 sm:pt-24 pb-16 text-center max-w-3xl mx-auto">
          <h1 className="text-[2rem] sm:text-[3rem] font-bold text-ink tracking-tight leading-[1.1] mb-4">
            Торгуйте криптовалютой
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-neon to-[#5ba3ff]">
              профессионально
            </span>
          </h1>
          <p className="text-sm sm:text-base text-textSecondary max-w-lg mx-auto mb-8 leading-relaxed">
            Спот, фьючерсы и аналитика в едином терминале. 
            Более 1 млн пользователей по всему миру.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
            <button
              type="button"
              onClick={onRegister}
              className="w-full py-4 px-6 rounded-xl bg-neon text-black font-bold text-base hover:bg-[#4a9fff] active:scale-[0.99] transition-all"
            >
              Создать аккаунт
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="w-full py-4 px-6 rounded-xl border border-border/60 text-textSecondary font-medium hover:border-neon/30 hover:text-textPrimary transition-all"
            >
              Войти
            </button>
          </div>
          {refId ? (
            <p className="mt-5 text-xs text-neon/80">
              {bonus 
                ? `Вы получили бонус ${bonus.toLocaleString()} ₽ при регистрации по ссылке партнёра!` 
                : 'Вы перешли по реферальной ссылке партнёра.'}
            </p>
          ) : null}
        </section>

        {/* Features */}
        <section className="landing-animate landing-d3 max-w-4xl mx-auto mb-16">
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { Icon: TrendingUp, title: 'Рыночные данные', desc: 'Графики, ордера, стакан и лента сделок в реальном времени.' },
              { Icon: BarChart3, title: 'Аналитика', desc: 'Глубокий анализ рынка и управление позициями.' },
              { Icon: Shield, title: 'Безопасность', desc: 'Cold wallets, 2FA, AML/KYC — ваши средства под защитой.' },
            ].map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-xl bg-card/40 border border-border/40 p-5 text-left hover:border-neon/20 hover:bg-card/60 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-neon/10 flex items-center justify-center text-neon mb-3 group-hover:bg-neon/15 transition-colors">
                  <Icon size={20} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-textPrimary mb-1">{title}</h3>
                <p className="text-xs text-textMuted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="landing-animate landing-d4 mb-16">
          <div className="max-w-2xl mx-auto rounded-2xl bg-card/30 border border-border/40 px-8 py-8 sm:py-10 text-center">
            <p className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">1 200 000+</p>
            <p className="text-sm text-textSecondary mt-1">пользователей по всему миру</p>
            <div className="flex items-center justify-center gap-5 mt-5 pt-5 border-t border-border/40">
              {['BTC', 'ETH', 'SOL', 'TON'].map((c) => (
                <span key={c} className="text-xs font-mono font-semibold text-textMuted tracking-wider">{c}</span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="landing-animate landing-d5 max-w-xl mx-auto">
          <div className="rounded-2xl bg-gradient-to-br from-neon/[0.08] to-transparent border border-neon/15 px-8 py-10 text-center">
            <p className="text-lg font-semibold text-ink mb-5">Начните торговать прямо сейчас</p>
            <button
              type="button"
              onClick={onRegister}
              className="w-full max-w-xs mx-auto py-4 rounded-xl bg-neon text-black font-bold text-base hover:bg-[#4a9fff] active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
            >
              Создать аккаунт
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-animate landing-d6 relative z-20 border-t border-border/40 bg-background/80 backdrop-blur-md py-6 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-textMuted">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <button type="button" className="hover:text-textSecondary transition-colors" onClick={() => setLegal('tos')}>Terms of Service</button>
            <button type="button" className="hover:text-textSecondary transition-colors" onClick={() => setLegal('privacy')}>Privacy Policy</button>
            <button type="button" className="hover:text-textSecondary transition-colors" onClick={() => setLegal('aml')}>AML/KYC</button>
            <button type="button" className="hover:text-textSecondary transition-colors" onClick={() => setLegal('cookies')}>Cookies</button>
          </div>
          <p>&copy; {new Date().getFullYear()} MEXC · Демо-интерфейс</p>
        </div>
      </footer>

      <LegalDocModal doc={legal} onClose={() => setLegal(null)} />
    </div>
  );
};

export default LandingPage;
