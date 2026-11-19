export type DayBias = "LONG" | "SHORT" | "BOTH" | "NONE";

export interface BiasStats {
  trades: number;
  closed: number;
  open: number;
  winners: number;
  losers: number;
  flat: number;
  win_pct: number | null;
  pnl: number;
  avg_pnl: number | null;
  profit_factor: number | null;
  max_drawdown: number;
  virtual: number;
  rejected: number;
}

export interface BiasTrade {
  trade_id: string;
  date: string;
  day_bias: DayBias | null;
  aligned: boolean;
  entry_time: string;
  exit_time: string | null;
  status: string;
  option_type: string;
  strike: number | null;
  quantity: number;
  entry_price: number | null;
  exit_price: number | null;
  realized_pnl: number | null;
  exit_reason: string | null;
  entry_method: string | null;
  trade_class: string;
  historical: boolean;
  tracking_mode: string;
  execution_status: string;
  execution_group: "paper" | "rejected" | "live" | "other";
}

export interface BiasResultsResponse {
  mode: "aligned" | "all";
  filters: {
    first_n_per_day: number | null;
    entry_from: string | null;
    entry_before: string | null;
  };
  summary: BiasStats & { equity: { time: string; pnl: number }[] };
  by_bias: (BiasStats & { bias: DayBias })[];
  monthly: (BiasStats & { month: string })[];
  daily: (BiasStats & {
    date: string;
    day_bias: DayBias | null;
    recorded_trades: number;
    off_bias_trades: number;
    ce_pnl: number;
    pe_pnl: number;
  })[];
  trades: BiasTrade[];
  coverage: {
    recorded_days: number;
    labelled_days: number;
    unmarked_days: string[];
    excluded_plan_copies: number;
    off_bias_trades: number;
    time_excluded_trades: number;
    limit_excluded_trades: number;
  };
}
