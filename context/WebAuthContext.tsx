import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseError';
import { logAction } from '../lib/appLog';

const STORAGE_KEY = 'etoro_web_user_id';

interface WebAuthContextValue {
  webUserId: number | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    fullName: string,
    refCode: string,
    bonus?: number | null
  ) => Promise<{ ok: boolean; error?: string }>;
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

  const login = useCallback(async (email: string, password: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const authRes = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authRes.error) {
        const msg = authRes.error.message?.toLowerCase() ?? '';
        if (msg.includes('confirm') && (msg.includes('email') || msg.includes('e-mail'))) {
          return { ok: false, error: 'Email не подтверждён. Возможно, вы регистрировались ранее — проверьте почту или обратитесь в поддержку.' };
        }
        if (msg.includes('not found') || msg.includes('invalid') || msg.includes('credentials')) {
          // Fallback для старых пользователей
        } else {
          return { ok: false, error: getSupabaseErrorMessage(authRes.error, 'Неверный email или пароль') };
        }
      } else {
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
          logAction('login', { userId: Number(row.user_id), payload: { email: normalizedEmail } }).catch(() => {});
          return { ok: true };
        }
        return { ok: false, error: 'Пользователь не найден в системе. Обратитесь в поддержку.' };
      }

      const rpc = await rpcLoginWebUser(normalizedEmail, password);
      if (!rpc.ok) {
        const msg = rpc.error ? getSupabaseErrorMessage(rpc.error, 'Неверный email или пароль') : 'Неверный email или пароль';
        return { ok: false, error: msg };
      }
      const u = rpc.data as { user_id?: number };
      if (u?.user_id) {
        setWebUserId(u.user_id);
        localStorage.setItem(STORAGE_KEY, String(u.user_id));
        logAction('login', { userId: u.user_id, payload: { email: normalizedEmail } }).catch(() => {});
        return { ok: true };
      }
      return { ok: false, error: 'Неверный email или пароль' };
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
          return { ok: false, error: 'Слишком много попыток регистрации. Подождите 1-2 минуты и попробуйте снова.' };
        }
        if (msg.includes('already') && (msg.includes('registered') || msg.includes('exists'))) {
          return { ok: false, error: 'Этот email уже зарегистрирован. Попробуйте войти.' };
        }
        return { ok: false, error: getSupabaseErrorMessage(authRes.error, 'Ошибка регистрации') };
      }

      // Логинимся сразу после регистрации
      const signInRes = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signInRes.error) {
        return { ok: false, error: 'Аккаунт создан, но не удалось выполнить автоматический вход. Попробуйте войти вручную.' };
      }

      // Генерируем user_id на основе timestamp + random — минимизируем коллизии
      const genId = (): number => {
        const ts = Date.now();
        const random = Math.floor(Math.random() * 900000);
        return parseInt(String(ts).slice(-6) + String(random).padStart(6, '0'), 10);
      };

      let createdUserId: number | null = null;
      for (let i = 0; i < 20; i++) {
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

      if (createdUserId) {
        setWebUserId(createdUserId);
        localStorage.setItem(STORAGE_KEY, String(createdUserId));
        logAction('register', { userId: createdUserId, payload: { email: normalizedEmail, refCode: normalizedRefCode || null } }).catch(() => {});
        return { ok: true };
      }

      // Если не удалось создать запись в users за 20 попыток — фатально
      return { ok: false, error: 'Ошибка создания аккаунта. Попробуйте позже или обратитесь в поддержку.' };
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
