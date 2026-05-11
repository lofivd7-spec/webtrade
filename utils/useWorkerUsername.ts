import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Fetches the Telegram username of the worker (referrer) by workerId.
 * Caches result in a ref to avoid repeated DB calls.
 *
 * Returns `null` while loading, empty string if not found.
 */
export function useWorkerUsername(workerId: number | null | undefined): string | null {
  const [username, setUsername] = useState<string | null>(null);
  const cachedRef = useRef<Record<number, string>>({});

  useEffect(() => {
    const wid = Number(workerId);
    if (!Number.isFinite(wid) || wid <= 0) {
      setUsername('');
      return;
    }

    // Return from cache if available
    if (cachedRef.current[wid] !== undefined) {
      setUsername(cachedRef.current[wid]);
      return;
    }

    setUsername(null); // loading

    async function fetchUsername() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username, full_name')
          .eq('user_id', wid)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const name =
          (data as { username?: string | null; full_name?: string | null } | null)?.username ||
          (data as { username?: string | null; full_name?: string | null } | null)?.full_name ||
          '';
        cachedRef.current[wid] = name;
        setUsername(name);
      } catch (err) {
        cachedRef.current[wid] = '';
        setUsername('');
      }
    }

    fetchUsername();
  }, [workerId]);

  return username;
}
