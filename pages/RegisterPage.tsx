import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import AuthFullScreenLayout from '../components/AuthFullScreenLayout';
import LegalDocModal, { LegalDocId } from '../components/LegalDocModal';
import { useWebAuth } from '../context/WebAuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

export const POST_REGISTER_WELCOME_KEY = 'etoro_post_register_welcome_v1';

interface RegisterPageProps {
  refId: string;
  bonus: number | null;
  onBack: () => void;
  onSuccess: () => void;
  onGoLogin?: () => void;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim().toLowerCase());
}

function validatePassword(pw: string) {
  return {
    len: pw.length >= 8,
    upper: /[A-ZА-Я]/.test(pw),
    lower: /[a-zа-я]/.test(pw),
    num: /\d/.test(pw),
    sym: /[^A-Za-zА-Яа-я0-9]/.test(pw),
  };
}

const inputClass =
  'w-full h-12 px-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-border/60 text-sm text-textPrimary placeholder-textSubtle outline-none transition-all focus:border-neon/50 focus:bg-[rgba(255,255,255,0.05)] focus:shadow-[0_0_0_1px_rgba(27,142,255,0.15)]';

const errorInputClass =
  'border-red-500/40 focus:border-red-500/60 focus:shadow-[0_0_0_1px_rgba(239,68,68,0.15)]';

const RegisterPage: React.FC<RegisterPageProps> = ({ refId, bonus, onBack, onSuccess, onGoLogin }) => {
  const { register } = useWebAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const isMiniApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [legal, setLegal] = useState<LegalDocId | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [pass2Error, setPass2Error] = useState<string | null>(null);

  const refCode = (refId || '').trim();

  const displayNameFromEmail = useCallback((em: string) => {
    const local = em.split('@')[0] || 'User';
    return local.replace(/[._+-]+/g, ' ').trim() || 'User';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const trimmed = email.trim().toLowerCase();
    setEmailError(null);
    setPassError(null);
    setPass2Error(null);
    let hasError = false;
    if (!trimmed) { setEmailError(t('auth_enter_email')); hasError = true; }
    else if (!isValidEmail(trimmed)) { setEmailError(t('auth_email_invalid')); hasError = true; }
    const pv = validatePassword(password);
    if (!password) { setPassError(t('auth_enter_password')); hasError = true; }
    else if (!pv.len) { setPassError(t('auth_password_min8')); hasError = true; }
    if (!confirmPassword) { setPass2Error(t('auth_repeat_password')); hasError = true; }
    else if (password !== confirmPassword) { setPass2Error(t('auth_passwords_mismatch')); hasError = true; }
    if (hasError) return;
    if (!agreeTos || !agreePrivacy) {
      toast.show(t('auth_accept_terms_privacy'), 'error');
      return;
    }

    setLoading(true);
    try {
      const fullName = displayNameFromEmail(trimmed);
      const { ok, error } = await register(trimmed, password, fullName, refCode, bonus);

      if (ok) {
        toast.show(t('auth_account_created'), 'success');
        onSuccess();
      } else {
        toast.show(error || t('auth_error_register'), 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth_error_register');
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthFullScreenLayout
        onBack={onBack}
        title={t('auth_register_title')}
        subtitle={isMiniApp ? 'Создайте аккаунт по email и паролю' : 'Укажите email и пароль для нового аккаунта'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5 tracking-wide">Email</label>
            <input
              id="reg-email"
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
              id="reg-pass"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 8 символов"
              className={`${inputClass} ${passError ? errorInputClass : ''}`}
            />
            {passError ? <p className="mt-1.5 text-xs text-red-400">{passError}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5 tracking-wide">{t('confirm_password_label')}</label>
            <input
              id="reg-pass2"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              className={`${inputClass} ${pass2Error ? errorInputClass : ''}`}
            />
            {pass2Error ? <p className="mt-1.5 text-xs text-red-400">{pass2Error}</p> : null}
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTos}
                onChange={(e) => setAgreeTos(e.target.checked)}
                className="w-4 h-4 rounded border-border/80 bg-transparent accent-neon"
              />
              <span className="text-xs text-textSecondary leading-snug select-none">
                Я согласен с{' '}
                <button type="button" className="text-neon hover:underline font-medium" onClick={(e) => { e.preventDefault(); setLegal('tos'); }}>
                  Terms of Service
                </button>
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="w-4 h-4 rounded border-border/80 bg-transparent accent-neon"
              />
              <span className="text-xs text-textSecondary leading-snug select-none">
                Я согласен с{' '}
                <button type="button" className="text-neon hover:underline font-medium" onClick={(e) => { e.preventDefault(); setLegal('privacy'); }}>
                  Privacy Policy
                </button>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-neon text-black text-sm font-bold tracking-wide hover:bg-[#4a9fff] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
            {t('create_account')}
          </button>

          <p className="text-center text-sm text-textMuted">
            {t('auth_have_account')}{' '}
            <button type="button" className="text-neon font-semibold hover:underline" onClick={onGoLogin}>
              {t('login_btn')}
            </button>
          </p>
        </form>
      </AuthFullScreenLayout>

      <LegalDocModal doc={legal} onClose={() => setLegal(null)} />
    </>
  );
};

export default RegisterPage;
