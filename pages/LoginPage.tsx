import React, { useState } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';
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

const fieldClass =
  'w-full min-h-[52px] py-3.5 px-4 bg-card/40 rounded-2xl text-textPrimary placeholder:text-textMuted focus:outline-none focus-visible:ring-2 focus-visible:ring-neon/30 text-[16px]';
const labelClass = 'block text-sm font-medium text-textSecondary mb-2';
const errorTextClass = 'mt-2 text-xs text-red-400';
const errorFieldClass = 'ring-2 ring-red-500/20';

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim().toLowerCase());
}

const LoginPage: React.FC<LoginPageProps> = ({ onBack, onSuccess, onGoRegister, onGoSupport }) => {
  const { login, resendEmailConfirmation } = useWebAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    if (!em) setEmailError(t('auth_enter_email'));
    else if (!isValidEmail(em)) setEmailError(t('auth_email_invalid'));
    if (!pw) setPassError(t('auth_enter_password'));
    if (!em || !pw || !isValidEmail(em)) {
      toast.show(t('auth_check_fields'), 'error');
      return;
    }
    setLoading(true);
    try {
      const { ok, error } = await login(em, pw);
      if (ok) {
        toast.show(t('login_btn'), 'success');
        onSuccess();
      } else {
        const msg = error || t('auth_error_login');
        toast.show(msg, 'error');
        setLoginError(msg);
        if (msg.toLowerCase().includes('парол')) {
          setPassError(t('pin_wrong'));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth_error_login');
      toast.show(msg, 'error');
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthFullScreenLayout onBack={onBack} title={t('login_title')} subtitle={t('login_subtitle')}>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div>
            <label className={labelClass} htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              className={`${fieldClass} ${emailError ? errorFieldClass : ''}`}
            />
            {emailError ? <div className={errorTextClass}>{emailError}</div> : null}
          </div>
          <div>
            <label className={labelClass} htmlFor="login-pass">
              {t('password_label')}
            </label>
            <div className="relative">
              <input
                id="login-pass"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${fieldClass} pr-12 ${passError ? errorFieldClass : ''}`}
              />
              <button
                type="button"
                aria-label={showPassword ? t('hide_password') : t('show_password')}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textPrimary transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passError ? <div className={errorTextClass}>{passError}</div> : null}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm text-neon font-medium hover:underline"
              onClick={() => setShowForgotSheet(true)}
            >
              {t('forgot_password')}
            </button>
          </div>

          {loginError && loginError.toLowerCase().includes('подтвердите email') && (
            <div className="rounded-2xl bg-neon/[0.06] px-3 py-2 text-sm text-textSecondary hairline-top hairline-bottom">
              {loginError}
              <div className="mt-2">
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
                  className="touch-target px-3 py-2 rounded-2xl bg-card/40 text-textPrimary hover:bg-card/55 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending ? t('auth_resending') : t('auth_resend_email')}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-neon text-black font-bold text-base shadow-lg shadow-neon/20 hover:bg-neon/90 disabled:opacity-60 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={22} /> : null}
            {t('login_btn')}
          </button>
        </form>

        <p className="text-center text-sm text-textMuted mt-10 pb-4">
          {t('no_account')}{' '}
          <button type="button" className="text-neon font-semibold hover:underline" onClick={onGoRegister}>
            {t('create_account')}
          </button>
        </p>
      </AuthFullScreenLayout>

      {/* Forgot password sheet */}
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
          className="w-full py-3.5 rounded-2xl bg-neon text-black font-bold text-base shadow-lg shadow-neon/20 hover:bg-neon/90 active:scale-[0.99] transition-all"
        >
          {t('support')}
        </button>
      </BottomSheet>
    </>
  );
};

export default LoginPage;
