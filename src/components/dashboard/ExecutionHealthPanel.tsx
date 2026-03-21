"use client";

import type { SystemHealth } from "@/lib/api";
import Explainable from "@/components/Explainable";

interface Props {
  health: SystemHealth | null;
  wsConnected: boolean;
}

type StatusLevel = "live" | "delayed" | "error" | "unknown";

interface Indicator {
  label: string;
  status: StatusLevel;
  detail?: string;
  explanation: string;
}

function isMarketHours(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const totalMins = hours * 60 + minutes;
  return totalMins >= 555 && totalMins <= 930; // 9:15 - 15:30 IST
}

function dot(status: StatusLevel) {
  const colors: Record<StatusLevel, string> = {
    live: "bg-emerald-400 shadow-emerald-400/60",
    delayed: "bg-yellow-400 shadow-yellow-400/60",
    error: "bg-red-500 shadow-red-500/60",
    unknown: "bg-slate-600",
  };
  const pulse = status === "live" ? "animate-pulse" : "";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shadow-[0_0_6px_currentColor] flex-shrink-0 ${colors[status]} ${pulse}`}
    />
  );
}

function badge(status: StatusLevel) {
  const cfg: Record<StatusLevel, { label: string; cls: string }> = {
    live:    { label: "LIVE",    cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
    delayed: { label: "DELAYED", cls: "text-yellow-400  bg-yellow-500/10  border-yellow-500/30" },
    error:   { label: "ERROR",   cls: "text-red-400     bg-red-500/10     border-red-500/30" },
    unknown: { label: "N/A",     cls: "text-slate-500   bg-slate-800      border-slate-700" },
  };
  const { label, cls } = cfg[status];
  return (
    <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

function buildIndicators(health: SystemHealth | null, wsConnected: boolean): Indicator[] {
  const marketOpen = isMarketHours();

  return [
    {
      label: "WebSocket",
      status: wsConnected ? "live" : "error",
      detail: wsConnected ? "connected" : "disconnected",
      explanation: "Real-time connection between the dashboard and the trading engine backend. WebSocket enables instant price updates, signals, and trade notifications without polling. If disconnected, the dashboard shows stale data.",
    },
    {
      label: "Broker Session",
      status: health == null
        ? "unknown"
        : health.broker_session_active
        ? "live"
        : marketOpen
        ? "error"
        : "delayed",
      detail: health?.broker_session_active
        ? "active"
        : marketOpen
        ? "offline"
        : "after hours",
      explanation: "Authentication session with the broker (e.g., Zerodha/Kite). Required for placing orders and receiving live market data. The session is established daily via login and expires after market hours. Shows 'after hours' when market is closed (expected).",
    },
    {
      label: "Tick Storage",
      status: health == null
        ? "unknown"
        : health.ticks_storing
        ? "live"
        : marketOpen
        ? "error"
        : "delayed",
      detail: health?.ticks_storing
        ? "writing"
        : marketOpen
        ? "stopped"
        : "market closed",
      explanation: "Indicates whether incoming price ticks are being saved to CSV files on disk. Ticks are stored as raw_ticks/spot_ticks_YYYYMMDD.csv for backtesting and analysis. Only active during market hours.",
    },
    {
      label: "Signal Engine",
      status: health == null
        ? "unknown"
        : health.signals_firing
        ? "live"
        : marketOpen && health.feed_alive
        ? "delayed"
        : marketOpen
        ? "error"
        : "delayed",
      detail: health?.signals_firing
        ? "firing"
        : marketOpen
        ? "quiet"
        : "after hours",
      explanation: "The signal engine analyzes incoming candles and price data to detect trade setups. When 'firing', it is actively processing data and generating entry signals. 'Quiet' during market hours may mean no setups are forming yet.",
    },
    {
      label: "Order Exec",
      status: health == null
        ? "unknown"
        : health.orders_rejected_today > 0 && health.orders_attempted_today > 0
        ? "delayed"
        : "live",
      detail: health
        ? `${health.orders_attempted_today} sent · ${health.orders_rejected_today} rejected`
        : undefined,
      explanation: "Tracks order placement health. Shows how many orders were sent to the broker and how many were rejected today. Rejections can happen due to insufficient margin, invalid prices, or broker limits. A 'DELAYED' status means some orders were rejected.",
    },
    {
      label: "DB Writes",
      status: health == null
        ? "unknown"
        : health.db_write_ok === null
        ? "unknown"
        : health.db_write_ok
        ? "live"
        : "error",
      detail: health?.db_write_ok === null ? "disabled" : health?.db_write_ok ? "ok" : "failed",
      explanation: "Database write health check. The bot stores trades, orders, and signals in a SQLite/PostgreSQL database. If writes fail, trade history and P&L tracking will be incomplete. 'Disabled' means DB_ENABLED is set to false.",
    },
  ];
}

export default function ExecutionHealthPanel({ health, wsConnected }: Props) {
  const indicators = buildIndicators(health, wsConnected);
  const marketOpen = isMarketHours();
  const allOk = indicators.every((i) => i.status === "live" || i.status === "unknown");
  const hasError = indicators.some((i) => i.status === "error");

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">System Health</span>
          {!marketOpen && (
            <span className="text-[9px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
              AFTER HOURS
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${
            hasError
              ? "text-red-400 bg-red-500/10 border-red-500/30"
              : allOk
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
              : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
          }`}
        >
          {hasError ? "DEGRADED" : allOk ? "ALL SYSTEMS LIVE" : marketOpen ? "PARTIAL" : "STANDBY"}
        </span>
      </div>

      {/* Indicators grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-1">
        {indicators.map((ind) => (
          <Explainable key={ind.label} title={ind.label} explanation={ind.explanation}>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#0d0d14] rounded-lg px-2 sm:px-3 py-2">
              {dot(ind.status)}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] sm:text-[11px] font-medium text-slate-300 truncate">{ind.label}</div>
                {ind.detail && (
                  <div className="text-[9px] sm:text-[10px] text-slate-600 truncate">{ind.detail}</div>
                )}
              </div>
              <span className="hidden sm:inline">{badge(ind.status)}</span>
            </div>
          </Explainable>
        ))}
      </div>

      {/* Latency row */}
      {health && (
        <div className="flex items-center gap-2 sm:gap-4 pt-1 border-t border-[#1e1e2e] text-[9px] sm:text-[10px] text-slate-600 flex-wrap">
          <Explainable inline title="Tick Latency" explanation="Time delay (in milliseconds) between when a price tick is generated by the exchange and when it reaches the bot. Lower is better. Values under 100ms are excellent, 100-500ms are acceptable, and above 500ms (shown in yellow) may cause delayed order execution.">
            <span>Tick latency: <span className={`font-mono ${health.tick_latency_ms > 500 ? "text-yellow-400" : "text-slate-400"}`}>{health.tick_latency_ms}ms</span></span>
          </Explainable>
          <Explainable inline title="Uptime" explanation="How long the bot has been running continuously since its last restart, shown in minutes. Monitors process stability.">
            <span>Uptime: <span className="font-mono text-slate-400">{Math.floor(health.uptime_seconds / 60)}m</span></span>
          </Explainable>
          <Explainable inline title="Signal Count" explanation="Total number of trading signals generated by the signal engine since the bot started. Includes all signals across all strategies — both triggered and untriggered.">
            <span>Signals: <span className="font-mono text-slate-400">{health.signal_history_count}</span></span>
          </Explainable>
        </div>
      )}
    </div>
  );
}
