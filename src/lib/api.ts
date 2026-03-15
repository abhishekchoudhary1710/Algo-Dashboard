const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://34.47.224.176:8000";

export async function fetchAPI<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function postAPI<T>(endpoint: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Types
export interface BotStatus {
  bot_running: boolean;
  kill_switch: boolean;
  uptime: string | null;
  bot_start_time: string | null;
  tick_count: number;
  last_tick_time: string | null;
}

export interface Prices {
  spot_ltp: number;
  fut_ltp: number;
  premium: number;
  last_tick_time: string | null;
}

export interface SwingStrategy {
  active: boolean;
  D: number | null;
  H1?: number | null;
  L1?: number | null;
  A?: number | null;
  B?: number | null;
  C?: number | null;
  pending_setup: {
    entry_price: number | null;
    stop_loss: number | null;
    target: number | null;
  } | null;
}

export interface PivotEntry {
  pivot_number: number;
  time: string;
  price: number;
  breakout_price?: number;
  breakout_time?: string;
  breakdown_price?: number;
  breakdown_time?: string;
}

export interface PivotData {
  total: number;
  unbroken: PivotEntry[];
  broken: PivotEntry[];
}

export interface FirstCandle {
  time: string;
  price: number;
  broken: boolean;
  breakdown_price?: number | null;
  breakout_price?: number | null;
}

export interface DivergenceStrategy {
  active: boolean;
  active_divergences: Array<{
    pivot_number: number;
    divergence_type: string;
    start_time: string;
    candle_time: string;
    spot_broken: boolean;
    fut_broken: boolean;
  }>;
  entry_setups: Record<string, string> | string;
  pivots?: PivotData;
  first_candle?: FirstCandle | null;
}

export interface Strategies {
  bullish_swing: SwingStrategy;
  bearish_swing: SwingStrategy;
  bullish_divergence: DivergenceStrategy;
  bearish_divergence: DivergenceStrategy;
}

export interface Order {
  order_id: string;
  timestamp: string;
  symbol: string;
  token: string;
  strike: number;
  option_type: string;
  expiry: string;
  transaction_type: string;
  quantity: number;
  order_type: string;
  status: string;
  variety: string;
  stop_loss: string | null;
  target: string | null;
}

export interface OrdersResponse {
  orders: Order[];
  count: number;
}

export interface DailyPnl {
  date: string;
  trades: number;
  orders: Order[];
}

export interface MonthlyPnlResponse {
  daily_pnl: DailyPnl[];
  total_trades: number;
}

export interface LiveSnapshot {
  bot_running: boolean;
  bot_start_time: string | null;
  kill_switch: boolean;
  spot_ltp: number;
  fut_ltp: number;
  last_tick_time: string | null;
  strategies: Strategies;
  today_orders_count: number;
  today_signals_count: number;
  tick_count: number;
  candles: {
    spot_1m: number;
    spot_5m: number;
    fut_1m: number;
    fut_5m: number;
  };
  prices: {
    spot_ltp: number;
    fut_ltp: number;
    premium: number;
  };
}

// --- New types for dashboard overhaul ---

export interface OHLCCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface OHLCResponse {
  candles: OHLCCandle[];
  current_candle: OHLCCandle | null;
  instrument: string;
  timeframe: string;
  count: number;
}

export interface SignalEvent {
  timestamp: string;
  strategy: string;
  instrument: string;
  price: number;
  entry_price: number;
  stop_loss: number;
  target: number;
}

export interface SignalsResponse {
  signals: SignalEvent[];
  count: number;
}

export interface RiskMetrics {
  win_rate: number;
  total_trades: number;
  total_signals: number;
  avg_risk_reward: number;
  total_risk: number;
  max_drawdown: number;
  sharpe_proxy: number | null;
  signals_per_strategy: Record<string, number>;
}

export interface SystemHealth {
  feed_alive: boolean;
  last_tick_time: string | null;
  tick_latency_ms: number;
  uptime_seconds: number;
  candle_cache_status: Record<string, number>;
  signal_history_count: number;
  metrics_cache_age_seconds: number | null;
}

export interface EntrySignal {
  timestamp: string;
  strategy: string;
  instrument: string;
  tick_price: number;
  entry_price: number;
  stop_loss: number;
  target: number;
  option_type: string;
  strike: number;
  expiry: string;
  quantity: number;
  risk: number;
}

export interface EntriesResponse {
  entries: EntrySignal[];
  count: number;
}

// --- Trade Excursion Tracking ---

export interface TradeExcursion {
  order_id: string;
  timestamp: string;
  strategy: string;
  option_display_name: string;
  duration_seconds: number;
  // Spot tracking
  spot_entry: number;
  spot_sl: number;
  spot_target: number;
  spot_mfe: number;
  spot_mae: number;
  spot_rr_achieved: number;
  spot_sl_hit: boolean;
  spot_target_hit: boolean;
  // Option tracking
  option_symbol: string;
  option_entry_price: number;
  option_sl: number;
  option_target: number;
  option_mfe: number;
  option_mae: number;
  option_rr_achieved: number;
  option_sl_hit: boolean;
  option_target_hit: boolean;
  // Meta
  option_type: string;
  strike: number;
  expiry: string;
  quantity: number;
  is_positive: boolean;
  status: string;
}

export interface ExcursionsResponse {
  trades: TradeExcursion[];
  count: number;
}

// --- WS typed message types ---

export interface TickData {
  spot_ltp: number;
  fut_ltp: number;
  premium: number;
  tick_count: number;
  last_tick_time: string | null;
}

export interface CandleUpdate {
  instrument: string;
  timeframe: string;
  candle: OHLCCandle;
}

export interface HeartbeatData {
  server_time: string;
  feed_alive: boolean;
  uptime_seconds: number;
}

export type WSMessage =
  | { type: "tick"; data: TickData }
  | { type: "candle"; data: CandleUpdate }
  | { type: "signal"; data: SignalEvent }
  | { type: "snapshot"; data: LiveSnapshot }
  | { type: "heartbeat"; data: HeartbeatData }
  | { type: "excursion"; data: ExcursionsResponse };

// --- Trade Lifecycle (from trades table) ---

export interface Trade {
  trade_id: string;
  strategy: string;
  instrument: string;
  direction: string;
  status: string;
  entry_order_id: string;
  entry_price: number | null;
  entry_time: string | null;
  exit_price: number | null;
  exit_time: string | null;
  exit_reason: string | null;
  option_type: string;
  strike: number | null;
  expiry: string;
  quantity: number | null;
  realized_pnl: number | null;
}

export interface TradesResponse {
  trades: Trade[];
  count: number;
}

export interface TradeSummary {
  date: string;
  total_trades: number;
  open_trades: number;
  closed_trades: number;
  total_pnl: number;
  winners: number;
  losers: number;
  win_rate: number;
  best_trade: number;
  worst_trade: number;
  trades: Trade[];
}

export interface DailyTradePnl {
  date: string;
  total_trades: number;
  closed_trades: number;
  total_pnl: number;
  winners: number;
  losers: number;
  win_rate: number;
}

export interface MonthlyTradesResponse {
  daily: DailyTradePnl[];
  total_days: number;
  total_trades: number;
  total_pnl: number;
  overall_win_rate: number;
}

// --- DB Health ---

export interface DbHealth {
  enabled: boolean;
  active?: boolean;
  min?: number;
  max?: number;
  db_size?: string;
  table_sizes?: Record<string, string>;
  tick_partitions?: Record<string, string>;
  excursion_vacuum?: {
    live_rows: number;
    dead_rows: number;
    mods_since_analyze: number;
    last_vacuum: string | null;
    last_autovacuum: string | null;
    last_autoanalyze: string | null;
  };
  row_counts?: Record<string, number>;
  error?: string;
}
