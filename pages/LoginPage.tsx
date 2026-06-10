import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import AuthFullScreenLayout from '../components/AuthFullScreenLayout';
import BottomSheet from '../components/BottomSheet';
import { useWebAuth } from '../context/WebAuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

interface LoginPageProps {
  onBack: () => void;
  onSuccess: () => void;
  onGoRegister?: () => void;
  onGoSupport?: () => void;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim().toLowerCase());
}

const inputClass =
  'w-full h-12 px-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-border/60 text-sm text-textPrimary placeholder-textSubtle outline-none transition-all focus:border-neon/50 focus:bg-[rgba(255,255,255,0.05)] focus:shadow-[0_0_0_1px_rgba(27,142,255,0.15)]';

const errorInputClass =
  'border-red-500/40 focus:border-red-500/60 focus:shadow-[0_0_0_1px_rgba(239,68,68,0.15)]';

const LoginPage: React.FC<LoginPageProps> = ({ onBack, onSuccess, onGoRegister, onGoSupport }) => {
  const { login, resendEmailConfirmation } = useWebAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const isMiniApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [showForgotSheet, setShowForgotSheet] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setEmailError(null);
    setPassError(null);
    const em = email.trim().toLowerCase();
    const pw = password;
    let hasError = false;
    if (!em) { setEmailError(t('auth_enter_email')); hasError = true; }
    else if (!isValidEmail(em)) { setEmailError(t('auth_email_invalid')); hasError = true; }
    if (!pw) { setPassError(t('auth_enter_password')); hasError = true; }
    if (hasError) return;

    setLoading(true);
    try {
      const { ok, error } = await login(em, pw);
      if (ok) {
        onSuccess();
      } else {
        const msg = error || t('auth_error_login');
        toast.show(msg, 'error');
        setLoginError(msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth_error_login');
      toast.show(msg, 'error');
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isEmailConfirmError = loginError?.toLowerCase().includes('подтвердите email')
    || loginError?.toLowerCase().includes('confirm')
    || loginError?.toLowerCase().includes('not confirmed');

  return (
    <>
      <AuthFullScreenLayout
        onBack={onBack}
        title={t('login_title')}
        subtitle={isMiniApp ? 'Введите email и пароль для входа' : 'Войдите по email и паролю'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5 tracking-wide">Email</label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              className={`${inputClass} ${emailError ? errorInputClass : ''}`}
            />
            {emailError ? <p className="mt-1.5 text-xs text-red-400">{emailError}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5 tracking-wide">{t('password_label')}</label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              className={`${inputClass} ${passError ? errorInputClass : ''}`}
            />
            {passError ? <p className="mt-1.5 text-xs text-red-400">{passError}</p> : null}
          </div>

          <div className="flex justify-end -mt-1">
            <button
              type="button"
              className="text-xs text-textMuted hover:text-neon transition-colors"
              onClick={() => setShowForgotSheet(true)}
            >
              {t('forgot_password')}
            </button>
          </div>

          {isEmailConfirmError && (
            <div className="rounded-xl bg-neon/[0.05] border border-neon/15 px-4 py-3">
              <p className="text-xs text-textSecondary">{loginError}</p>
              <button
                type="button"
                disabled={resending || !resendEmailConfirmation}
                onClick={async () => {
                  setResending(true);
                  const res = await resendEmailConfirmation?.(email);
                  setResending(false);
                  if (!res?.ok) toast.show(res?.error || t('error_generic'), 'error');
                  else toast.show(t('auth_email_resent'), 'success');
                }}
                className="mt-2 text-xs font-medium text-neon hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? t('auth_resending') : t('auth_resend_email')}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-neon text-black text-sm font-bold tracking-wide hover:bg-[#4a9fff] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
            {t('login_btn')}
          </button>

          <p className="text-center text-sm text-textMuted">
            {t('no_account')}{' '}
            <button type="button" className="text-neon font-semibold hover:underline" onClick={onGoRegister}>
              {t('create_account')}
            </button>
          </p>
        </form>
      </AuthFullScreenLayout>

      <BottomSheet
        open={showForgotSheet}
        onClose={() => setShowForgotSheet(false)}
        title={t('forgot_password')}
        closeOnBackdrop
      >
        <p className="text-sm text-textSecondary leading-relaxed mb-5">
          {t('forgot_password_instruction')}
        </p>
        <button
          type="button"
          onClick={() => {
            setShowForgotSheet(false);
            onGoSupport?.();
          }}
          className="w-full h-12 rounded-xl bg-neon text-black text-sm font-bold tracking-wide hover:bg-[#4a9fff] transition-all"
        >
          {t('support')}
        </button>
      </BottomSheet>
    </>
  );
};

export default LoginPage;
