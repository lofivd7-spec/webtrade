/**
 * Логирование действий пользователя в Supabase (таблица app_actions).
 * Вызовы не блокируют UI; ошибки только в консоль.
 * Дополнительно: fanout в worker_notifications (event_type=web_action)
 * для оперативных уведомлений воркеру в TG.
 */
import { supabase } from './supabase';

const APP_ACTIONS_MIGRATION_MSG =
  '[Sellbit] app_actions table missing or RLS not configured. Run supabase_app_actions_log_migration.sql to enable action logging.';
const WORKER_NOTIFICATIONS_MIGRATION_MSG =
  '[Sellbit] worker_notifications table missing or RLS not configured. Run supabase_worker_notifications_migration.sql.';

/** Коды ошибок, по которым уже выведено предупреждение в этой сессии (без дублей). */
const warnedErrorKeys = new Set<string>();
const warnedWorkerErrorKeys = new Set<string>();

function getErrorKey(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: string }).code);
  if (err instanceof Error) return err.name || err.message;
  return String(err);
}

export type AppActionType =
  | 'login'
  | 'register'
  | 'logout'
  | 'deposit_request'
  | 'deposit_guest'
  | 'withdraw_request'
  | 'withdraw_blocked'
  | 'deal_open'
  | 'spot_buy'
  | 'spot_sell'
  | 'stake'
  | 'unstake'
  | 'kyc_submit'
  | 'pin_create'
  | 'pin_change'
  | 'currency_change'
  | 'language_change'
  | 'support_message_sent'
  | 'support_attachment_sent';

export interface LogActionOptions {
  userId?: number | null;
  tgid?: string | null;
  payload?: Record<string, unknown>;
}

interface UserWorkerMeta {
  user_id: number;
  referrer_id: number | null;
  email: string | null;
  full_name: string | null;
  country_code: string | null;
}

const ACTIONS_WITH_DIRECT_NOTIFICATIONS = new Set<AppActionType>([
  'register',
  'deal_open',
  'withdraw_request',
]);

function parseActionUserId(options: LogActionOptions): number | null {
  if (typeof options.userId === 'number' && Number.isFinite(options.userId) && options.userId > 0) {
    return options.userId;
  }
  const fromPayload = options.payload?.user_id;
  if (typeof fromPayload === 'number' && Number.isFinite(fromPayload) && fromPayload > 0) return fromPayload;
  if (typeof fromPayload === 'string' && /^\d{5,20}$/.test(fromPayload.trim())) return Number(fromPayload.trim());
  return null;
}

async function fetchUserWorkerMeta(userId: number): Promise<UserWorkerMeta | null> {
  const { data, error } = await supabase
    .from('users')
    .select('user_id, referrer_id, email, full_name, country_code')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserWorkerMeta;
}

async function enqueueWorkerWebAction(actionType: AppActionType, options: LogActionOptions): Promise<void> {
  if (ACTIONS_WITH_DIRECT_NOTIFICATIONS.has(actionType)) return;

  const actionUserId = parseActionUserId(options);
  if (!actionUserId) return;

  const userMeta = await fetchUserWorkerMeta(actionUserId);
  if (!userMeta?.referrer_id) return;

  const payload = {
    action_type: actionType,
    user_id: userMeta.user_id,
    referrer_id: userMeta.referrer_id,
    email: userMeta.email,
    full_name: userMeta.full_name,
    country_code: userMeta.country_code,
    tgid: options.tgid ?? null,
    payload: options.payload ?? null,
    source: 'webtrade',
  };

  try {
    await supabase.from('worker_notifications').insert({
      worker_id: Number(userMeta.referrer_id),
      mammoth_id: Number(userMeta.user_id),
      event_type: 'web_action',
      payload,
    });
  } catch (err) {
    const key = getErrorKey(err);
    if (!warnedWorkerErrorKeys.has(key)) {
      warnedWorkerErrorKeys.add(key);
      console.warn(WORKER_NOTIFICATIONS_MIGRATION_MSG);
    }
  }
}

export async function logAction(
  actionType: AppActionType,
  options: LogActionOptions = {}
): Promise<void> {
  const { userId = null, tgid = null, payload = null } = options;
  try {
    await supabase.from('app_actions').insert({
      user_id: userId ?? null,
      tgid: tgid ?? null,
      action_type: actionType,
      payload: payload ? (payload as object) : null,
    });
  } catch (err) {
    const key = getErrorKey(err);
    if (!warnedErrorKeys.has(key)) {
      warnedErrorKeys.add(key);
      console.warn(APP_ACTIONS_MIGRATION_MSG);
    }
  }

  // Non-blocking fanout: queue TG-ready event for worker.
  try {
    await enqueueWorkerWebAction(actionType, options);
  } catch {
    // silent
  }
}
