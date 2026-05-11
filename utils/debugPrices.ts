/**
 * Optional debug logger for pricing/currency issues.
 *
 * This module is intentionally safe in production builds:
 * - does nothing unless the developer enables it in the browser console.
 * - never throws.
 */

type DebugOptions = { throttleMs?: number };

const lastByKey = new Map<string, number>();

function isEnabled(): boolean {
  try {
    // Enable via: localStorage.setItem('mexc_debug_prices', '1')
    return typeof window !== 'undefined' && localStorage.getItem('mexc_debug_prices') === '1';
  } catch {
    return false;
  }
}

export function debugPriceLog(
  key: string,
  payload: unknown,
  options?: DebugOptions
): void {
  try {
    if (!isEnabled()) return;
    const now = Date.now();
    const throttleMs = typeof options?.throttleMs === 'number' ? options.throttleMs : 0;
    const last = lastByKey.get(key) ?? 0;
    if (throttleMs > 0 && now - last < throttleMs) return;
    lastByKey.set(key, now);
    // eslint-disable-next-line no-console
    console.debug(`[prices:${key}]`, payload);
  } catch {
    // no-op
  }
}

