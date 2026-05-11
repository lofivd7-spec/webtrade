/**
 * Дисплей-only: множитель ≈ ±0.5%…±5% от базовой котировки (ETH×RUB или fallback),
 * плавное «дыхание» цены NFT для UI.
 */
export function nftDisplayRubMultiplier(seed: string, timeMs: number): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const s = ((h >>> 0) % 10000) / 10000;
  const t = timeMs * 0.001;
  const minPct = 0.005;
  const maxPct = 0.05;
  const amp = minPct + (Math.sin(t * 0.19 + s * 6.28318530718) * 0.5 + 0.5) * (maxPct - minPct);
  const wave = Math.sin(t * 0.71 + s * 9.17) * amp;
  return 1 + wave;
}

export function withNftDisplayWobbleRub(baseRub: number, seed: string, timeMs: number): number {
  if (!Number.isFinite(baseRub) || baseRub <= 0) return baseRub;
  return Math.max(1e-12, baseRub * nftDisplayRubMultiplier(seed, timeMs));
}
