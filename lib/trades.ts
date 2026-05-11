import { Deal, DealStatus, type ForcedOutcome } from '../types';

export interface TradeRow {
  id: string;
  user_id: number;
  pair: string;
  symbol: string;
  type: 'Long' | 'Short';
  amount: number;
  leverage: number | null;
  entry_price: number;
  final_price: number | null;
  start_time: number;
  duration_seconds: number;
  status: 'active' | 'completed' | 'cancelled';
  final_pnl: number | null;
  is_winning: boolean | null;
  /** Новый режим исполнения: simulated (по удаче) или real (по реальной цене). */
  engine?: 'simulated' | 'real' | null;
  /** Для FIXED: принудительный исход win/lose (новая схема). */
  forced_outcome?: 'win' | 'lose' | null;
  /** Старая схема (baza.sql) — то же по смыслу, что forced_outcome. */
  forced_result?: 'win' | 'lose' | null;
  take_profit_price?: number | null;
  stop_loss_price?: number | null;
  created_at?: string;
}

export function tradeRowToDeal(row: TradeRow): Deal {
  const status: DealStatus =
    row.status === 'active'
      ? 'ACTIVE'
      : row.is_winning === true
        ? 'WIN'
        : 'LOSS';
  return {
    id: row.id,
    assetTicker: row.symbol,
    side: row.type === 'Long' ? 'UP' : 'DOWN',
    amount: row.amount,
    leverage: row.leverage ?? 1,
    entryPrice: row.entry_price,
    currentPrice: row.final_price ?? undefined,
    startTime: row.start_time,
    durationSeconds: row.duration_seconds,
    status,
    pnl: row.final_pnl ?? undefined,
    engine: (row.engine as any) ?? 'simulated',
    forcedOutcome: ((row.forced_outcome ?? row.forced_result) as ForcedOutcome | undefined) ?? null,
    takeProfitPrice: row.take_profit_price ?? undefined,
    stopLossPrice: row.stop_loss_price ?? undefined,
  };
}

export function dealToTradeInsert(deal: Deal, userId: number) {
  /**
   * Только колонки из базового `baza.sql` — без `engine` / `forced_outcome`,
   * иначе PostgREST падает, если миграция `supabase_trades_modes_migration.sql` не применена.
   */
  return {
    user_id: userId,
    pair: deal.assetTicker,
    symbol: deal.assetTicker,
    type: deal.side === 'UP' ? 'Long' : 'Short',
    amount: deal.amount,
    leverage: deal.leverage,
    entry_price: deal.entryPrice,
    start_time: deal.startTime,
    duration_seconds: deal.durationSeconds,
    status: 'active',
    take_profit_price: deal.takeProfitPrice ?? null,
    stop_loss_price: deal.stopLossPrice ?? null,
  };
}
