import React, { createContext, useContext, useMemo } from 'react';
import { supabase } from './supabase';
import { nftTickerForListing, type NftListingRow } from './nftCatalog';

export type RpcNftPolicyRow = {
  nft_listing_id?: string;
  spot_ticker?: string | null;
  collection_slug?: string | null;
  nft_code_norm?: string | null;
  custom_price_eth?: number | string | null;
  duo_pair_required?: boolean | string | null;
};

export type NftReferrerPolicies = {
  prices: Record<string, number>;
  duoByTicker: Record<string, boolean>;
};

const defaultPolicies: NftReferrerPolicies = { prices: {}, duoByTicker: {} };
const Ctx = createContext<NftReferrerPolicies>(defaultPolicies);

function normalizeTickerKey(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function NftReferrerPriceProvider({
  prices,
  duoByTicker,
  children,
}: {
  prices: Record<string, number>;
  duoByTicker?: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ prices, duoByTicker: duoByTicker ?? {} }),
    [prices, duoByTicker]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNftReferrerPriceMap(): Record<string, number> {
  return useContext(Ctx).prices;
}

export function useNftReferrerDuoByTicker(): Record<string, boolean> {
  return useContext(Ctx).duoByTicker;
}

function normalizeRpcNftPolicyRows(data: unknown): RpcNftPolicyRow[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as RpcNftPolicyRow[];
  if (typeof data === 'string') {
    try {
      return normalizeRpcNftPolicyRows(JSON.parse(data) as unknown);
    } catch {
      return [];
    }
  }
  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const k of ['rows', 'result', 'data', 'items', 'overrides', 'policies'] as const) {
      const v = o[k];
      if (Array.isArray(v)) return v as RpcNftPolicyRow[];
    }
    const looksLikeRow =
      typeof o.spot_ticker === 'string' ||
      o.nft_listing_id != null ||
      o.custom_price_eth != null;
    if (looksLikeRow) return [o as RpcNftPolicyRow];
    const vals = Object.values(o);
    if (vals.length > 0 && vals.every((x) => x != null && typeof x === 'object')) {
      const asRows = vals as RpcNftPolicyRow[];
      if (asRows.some((r) => typeof (r as { spot_ticker?: unknown }).spot_ticker === 'string')) {
        return asRows;
      }
    }
    console.warn('[get_referrer_nft_policy_overrides] unexpected response shape', data);
  }
  return [];
}

function policyRowTickerKeys(r: RpcNftPolicyRow): string[] {
  const slug = String(r.collection_slug ?? '').trim();
  const codeRaw = String(r.nft_code_norm ?? '').trim();
  const codeKey = codeRaw.replace(/^#/, '');
  const fromRpc = String(r.spot_ticker ?? '').trim();
  const keys = new Set<string>();
  if (fromRpc) keys.add(normalizeTickerKey(fromRpc));
  if (slug && codeKey) {
    keys.add(
      nftTickerForListing({
        collectionSlug: slug,
        codeKey,
        spotTicker: null,
      })
    );
  }
  return [...keys].filter(Boolean);
}

function parseDuoFlag(v: RpcNftPolicyRow['duo_pair_required']): boolean {
  if (v === true || v === 'true' || v === 't' || v === '1') return true;
  return false;
}

/** Цены и Duo-флаги политик реферера (для реферала на сайте). */
export async function fetchReferrerNftPolicies(
  viewerUid: number | null | undefined
): Promise<NftReferrerPolicies> {
  const prices: Record<string, number> = {};
  const duoByTicker: Record<string, boolean> = {};
  if (!Number.isFinite(viewerUid ?? NaN) || (viewerUid ?? 0) <= 0) {
    return { prices, duoByTicker };
  }
  const { data, error } = await supabase.rpc('get_referrer_nft_policy_overrides', {
    p_viewer_uid: viewerUid,
  });
  if (error || data == null) return { prices, duoByTicker };
  const rows = normalizeRpcNftPolicyRows(data);
  for (const r of rows) {
    const p = Number(r.custom_price_eth);
    const keys = policyRowTickerKeys(r);
    if (Number.isFinite(p) && p > 0) {
      for (const k of keys) prices[k] = p;
    }
    if (parseDuoFlag(r.duo_pair_required)) {
      for (const k of keys) {
        if (k) duoByTicker[k] = true;
      }
    }
  }
  return { prices, duoByTicker };
}

/** @deprecated Prefer fetchReferrerNftPolicies — возвращает только карту цен. */
export async function fetchReferrerNftPriceMap(
  viewerUid: number | null | undefined
): Promise<Record<string, number>> {
  const { prices } = await fetchReferrerNftPolicies(viewerUid);
  return prices;
}

function listingPriceOverrideEth(row: NftListingRow, map: Record<string, number>): number | undefined {
  const k1 = nftTickerForListing(row);
  const st = row.spotTicker?.trim();
  const k2 = st ? normalizeTickerKey(st) : '';
  for (const k of [k1, k2].filter(Boolean)) {
    const c = map[k];
    if (Number.isFinite(c) && c > 0) return c;
  }
  return undefined;
}

export function enrichNftListingRow(row: NftListingRow, map: Record<string, number>): NftListingRow {
  const custom = listingPriceOverrideEth(row, map);
  if (!Number.isFinite(custom) || !custom || custom <= 0) return row;
  return { ...row, priceEth: custom };
}

export function enrichNftListings(rows: NftListingRow[], map: Record<string, number>): NftListingRow[] {
  return rows.map((r) => enrichNftListingRow(r, map));
}
