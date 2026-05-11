import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isPlaceholderSupabaseUrl(v: string | undefined): boolean {
  if (!v) return true;
  const s = v.trim();
  if (!s) return true;
  return s.includes('your-project.supabase.co');
}

export const isSupabaseConfigured = Boolean(url && key && !isPlaceholderSupabaseUrl(url));

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in MEXC/.env (not .env.example).'
  );
}

export const supabase = createClient(url || '', key || '');
