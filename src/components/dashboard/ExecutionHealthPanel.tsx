"use client";

import type { SystemHealth } from "@/lib/api";

interface Props {
  health: SystemHealth | null;
  wsConnected: boolean;
}

type StatusLevel = "live" | "delayed" | "error" | "unknown";

interface Indicator {
  label: string;
  status: StatusLevel;
  detail?: string;
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
    },
    {
      label: "Broker Session",
      status: health == null
        ? "unknown"
        : health.broker_session_active
        ? "live"
        : marketOpen
        ? "error"
        : "delayed", // expected offline after hours
      detail: health?.broker_session_active
        ? "active"
        : marketOpen
        ? "offline"
        : "after hours",
    },
    {
      label: "Tick Storage",
      status: health == null
        ? "unknown"
        : health.ticks_storing
        ? "live"
        : marketOpen
        ? "error"
        : "delayed", // no ticks expected after hours
      detail: health?.ticks_storing
        ? "writing"
        : marketOpen
        ? "stopped"
        : "market closed",
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
        : "delayed", // quiet is expected after hours
      detail: health?.signals_firing
        ? "firing"
        : marketOpen
        ? "quiet"
        : "after hours",
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
          <div
            key={ind.label}
            className="flex items-center gap-1.5 sm:gap-2 bg-[#0d0d14] rounded-lg px-2 sm:px-3 py-2"
          >
            {dot(ind.status)}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-medium text-slate-300 truncate">{ind.label}</div>
              {ind.detail && (
                <div className="text-[9px] sm:text-[10px] text-slate-600 truncate">{ind.detail}</div>
              )}
            </div>
            <span className="hidden sm:inline">{badge(ind.status)}</span>
          </div>
        ))}
      </div>

      {/* Latency row */}
      {health && (
        <div className="flex items-center gap-2 sm:gap-4 pt-1 border-t border-[#1e1e2e] text-[9px] sm:text-[10px] text-slate-600 flex-wrap">
          <span>Tick latency: <span className={`font-mono ${health.tick_latency_ms > 500 ? "text-yellow-400" : "text-slate-400"}`}>{health.tick_latency_ms}ms</span></span>
          <span>Uptime: <span className="font-mono text-slate-400">{Math.floor(health.uptime_seconds / 60)}m</span></span>
          <span>Signals: <span className="font-mono text-slate-400">{health.signal_history_count}</span></span>
        </div>
      )}
    </div>
  );
}
