import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseError';
import { logAction } from '../lib/appLog';

const STORAGE_KEY = 'etoro_web_user_id';
const PENDING_EMAIL_KEY = 'etoro_pending_email_v1';
const PENDING_PASS_KEY = 'etoro_pending_pass_v1';
const PENDING_FLAG_KEY = 'etoro_pending_confirm_v1';

interface WebAuthContextValue {
  webUserId: number | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    fullName: string,
    refCode: string,
    bonus?: number | null
  ) => Promise<{ ok: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  resendEmailConfirmation?: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

export function WebAuthProvider({ children }: { children: React.ReactNode }) {
  const rpcLoginWebUser = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.rpc('login_web_user', {
      p_email: email.trim().toLowerCase(),
      p_password: password,
    });
    if (error) return { ok: false as const, error };
    const row = data as { user_id?: number; error?: string } | null;
    if (!row || typeof row !== 'object') return { ok: false as const, error: null };
    if (row.error === 'INVALID_CREDENTIALS' || row.user_id == null) {
      return { ok: false as const, error: null };
    }
    return { ok: true as const, data: { user_id: row.user_id } };
  }, []);

  const [webUserId, setWebUserId] = useState<number | null>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) return parseInt(s, 10);
    } catch {}
    return null;
  });

  // Автовход после подтверждения email по ссылке Supabase:
  // 1) обмениваем `code`/`access_token` на сессию
  // 2) если регистрация была в этом браузере, берём email+пароль из sessionStorage и логиним в вашу БД (RPC), получаем user_id
  useEffect(() => {
    let alive = true;
    (async () => {
      if (webUserId) return;
      if (typeof window === 'undefined') return;

      const url = new URL(window.location.href);
      const search = url.searchParams;
      const hashParams = new URLSearchParams((url.hash || '').replace(/^#/, ''));
      const code = search.get('code');
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');

      try {
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          search.delete('code');
          search.delete('type');
          search.delete('next');
          url.hash = '';
          window.history.replaceState({}, '', `${url.pathname}${search.toString() ? `?${search.toString()}` : ''}`);
        } else if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          url.hash = '';
          window.history.replaceState({}, '', `${url.pathname}${url.search}`);
        }
      } catch {
        // Если обмен не удался — не блокируем UX, пользователь сможет зайти вручную
      }

      // Если у нас есть “ожидающие” креды после регистрации — логиним пользователя автоматически
      try {
        const pendingFlag = sessionStorage.getItem(PENDING_FLAG_KEY) === '1';
        const pendingEmail = sessionStorage.getItem(PENDING_EMAIL_KEY) || '';
        const pendingPass = sessionStorage.getItem(PENDING_PASS_KEY) || '';
        if (!pendingFlag || !pendingEmail || !pendingPass) return;

        const { data: sess } = await supabase.auth.getSession();
        if (!sess?.session) return; // ещё не подтверждено / нет сессии

        const rpc = await rpcLoginWebUser(pendingEmail.trim().toLowerCase(), pendingPass);
        if (!rpc.ok) return;
        const u = rpc.data as { user_id?: number };
        if (!u?.user_id) return;

        if (!alive) return;
        setWebUserId(u.user_id);
        localStorage.setItem(STORAGE_KEY, String(u.user_id));
        sessionStorage.removeItem(PENDING_FLAG_KEY);
        sessionStorage.removeItem(PENDING_EMAIL_KEY);
        sessionStorage.removeItem(PENDING_PASS_KEY);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [webUserId, rpcLoginWebUser]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      // 1) Supabase Auth — используем как gating email confirmation
      const normalizedEmail = email.trim().toLowerCase();
      const authRes = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authRes.error) {
        const msg = authRes.error.message?.toLowerCase() ?? '';
        // Типовые сообщения: "Email not confirmed", "confirmation required" и т.п.
        if (msg.includes('confirm') && (msg.includes('email') || msg.includes('e-mail'))) {
          return { ok: false, error: 'Подтвердите email. Мы отправили письмо на вашу почту.' };
        }
        if (msg.includes('not found') || msg.includes('invalid') || msg.includes('credentials')) {
          // Наследие: у старых пользователей может не быть Supabase Auth аккаунта.
          // Пробуем ваш RPC login_web_user как fallback.
        } else {
          return { ok: false, error: getSupabaseErrorMessage(authRes.error, 'Не удалось выполнить вход') };
        }
      } else {
        // 2) Если Auth вход успешен — значит email подтверждён (или подтверждение не требуется).
        // Дальше: берём user_id напрямую из таблицы users по email.
        const { data: row, error: rowErr } = await supabase
          .from('users')
          .select('user_id')
          .eq('email', normalizedEmail)
          .limit(1)
          .maybeSingle();
        if (rowErr) {
          return { ok: false, error: getSupabaseErrorMessage(rowErr, 'Не удалось выполнить вход') };
        }
        if (row?.user_id) {
          setWebUserId(Number(row.user_id));
          localStorage.setItem(STORAGE_KEY, String(row.user_id));
          try {
            sessionStorage.removeItem(PENDING_FLAG_KEY);
            sessionStorage.removeItem(PENDING_EMAIL_KEY);
            sessionStorage.removeItem(PENDING_PASS_KEY);
          } catch {}
          logAction('login', { userId: Number(row.user_id), payload: { email: normalizedEmail } }).catch(() => {});
          return { ok: true };
        }
        return { ok: false, error: getSupabaseErrorMessage(null, 'Неверный email или пароль') };
      }

      // Fallback (legacy): login_web_user
      const rpc = await rpcLoginWebUser(normalizedEmail, password);
      if (!rpc.ok) {
        const msg = rpc.error ? getSupabaseErrorMessage(rpc.error, 'Неверный email или пароль') : 'Неверный email или пароль';
        return { ok: false, error: msg };
      }
      const u = rpc.data as { user_id?: number };
      if (u?.user_id) {
        setWebUserId(u.user_id);
        localStorage.setItem(STORAGE_KEY, String(u.user_id));
        try {
          sessionStorage.removeItem(PENDING_FLAG_KEY);
          sessionStorage.removeItem(PENDING_EMAIL_KEY);
          sessionStorage.removeItem(PENDING_PASS_KEY);
        } catch {}
        logAction('login', { userId: u.user_id, payload: { email: normalizedEmail } }).catch(() => {});
        return { ok: true };
      }
      return { ok: false, error: getSupabaseErrorMessage(null, 'Неверный email или пароль') };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось выполнить вход';
      return { ok: false, error: msg };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string, refCode: string, bonus: number | null = null) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedRefCode = (refCode || '').trim();
      const normalizedRefId =
        /^\d{5,20}$/.test(normalizedRefCode) ? Number(normalizedRefCode) : null;

      // 1) Supabase Auth (отправка письма подтверждения)
      const authRes = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          data: {
            full_name: fullName.trim(),
            ref_code: normalizedRefCode || null,
          },
        },
      });

      if (authRes.error) {
        const status =
          (authRes.error as any)?.status ??
          (authRes.error as any)?.code ??
          (authRes.error as any)?.statusCode;
        const msg = authRes.error.message?.toLowerCase() ?? '';
        if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
          return { ok: false, error: 'Слишком много попыток регистрации. Подождите 1–2 минуты и попробуйте снова.' };
        }
        if (msg.includes('already') && (msg.includes('registered') || msg.includes('exists'))) {
          return { ok: false, error: 'Этот email уже зарегистрирован' };
        }
        return { ok: false, error: getSupabaseErrorMessage(authRes.error, 'Ошибка регистрации') };
      }

      const requiresEmailConfirmation = !authRes.data?.session;

      // 2) Создаём строку в public.users (если нет).
      const genId = (): number => {
        const base = 1_000_000_000;
        return base + Math.floor(Math.random() * 8_000_000_000);
      };

      let createdUserId: number | null = null;
      for (let i = 0; i < 5; i++) {
        const userId = genId();
        const { error: insErr } = await supabase.from('users').insert({
          user_id: userId,
          full_name: fullName.trim(),
          email: normalizedEmail,
          web_registered: true,
          referrer_id: normalizedRefId,
          balance: bonus || 0,
          luck: 'default',
          withdraw_message_type: 'default',
          preferred_currency: 'RUB',
          is_kyc: false,
          country_code: 'RU',
        });
        if (!insErr) {
          createdUserId = userId;
          break;
        }
      }

      if (requiresEmailConfirmation) {
        try {
          sessionStorage.setItem(PENDING_FLAG_KEY, '1');
          sessionStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);
          sessionStorage.setItem(PENDING_PASS_KEY, password);
        } catch {}
        return { ok: true, requiresEmailConfirmation: true };
      }

      if (createdUserId) {
        setWebUserId(createdUserId);
        localStorage.setItem(STORAGE_KEY, String(createdUserId));
        logAction('register', { userId: createdUserId, payload: { email: normalizedEmail, refCode: normalizedRefCode || null } }).catch(() => {});
        return { ok: true };
      }

      return { ok: false, error: 'Ошибка регистрации' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка регистрации';
      return { ok: false, error: msg };
    }
  }, []);

  const resendEmailConfirmation = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const res = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    if (res.error) return { ok: false, error: getSupabaseErrorMessage(res.error, 'Не удалось отправить письмо') };
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setWebUserId(null);
    localStorage.removeItem(STORAGE_KEY);
    supabase.auth.signOut().catch(() => {});
  }, []);

  const value: WebAuthContextValue = { webUserId, login, register, resendEmailConfirmation, logout };
  return <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth() {
  const ctx = useContext(WebAuthContext);
  if (!ctx) throw new Error('useWebAuth must be used within WebAuthProvider');
  return ctx;
}
