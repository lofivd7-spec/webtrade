import { createClient } from '@supabase/supabase-js';
function assertServerOnly() {
    // Vite/React app: если этот модуль попал в браузерный бандл — это критическая ошибка.
    const hasWindow = typeof globalThis !== 'undefined' && 'window' in globalThis;
    if (hasWindow) {
        throw new Error('supabaseAdmin must never be initialized in the browser.');
    }
}
function getRequiredEnv(name) {
    const v = process.env[name];
    if (!v || !v.trim())
        throw new Error(`Missing required env var: ${name}`);
    return v.trim();
}
/**
 * Server-side Supabase client with service role (bypasses RLS).
 * IMPORTANT: import and use ONLY from server code (Node/edge functions).
 */
export function createSupabaseAdminClient() {
    assertServerOnly();
    const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || '';
    if (!url)
        throw new Error('Missing required env var: SUPABASE_URL (or VITE_SUPABASE_URL for server)');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    return createClient(url, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
}
