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

// ─── Main bot DB (read-only: static_cards, card_countries) ──────────────────
const MAIN_BOT_URL = 'https://yzvavkllierbwuegfmhd.supabase.co';
const MAIN_BOT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dmF2a2xsaWVyYnd1ZWdmbWhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE3NzA2MSwiZXhwIjoyMDkxNzUzMDYxfQ.Wv6hWenL0jbwwZSdSfhlydHcy0IpnIphHpXPmd7aOog';

export const mainDb = createClient(MAIN_BOT_URL, MAIN_BOT_SERVICE_KEY);
