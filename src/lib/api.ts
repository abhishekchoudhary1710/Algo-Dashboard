const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
