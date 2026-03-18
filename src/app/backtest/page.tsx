"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import type { Trade, TradesHistoryResponse } from "@/lib/api";

// ── Filter state ────────────────────────────────────────────────────────────
interface Filters {
  dateFrom: string;
  dateTo: string;
  strategies: string[];
  direction: "ALL" | "LONG" | "SHORT";
  minRR: number;
}

const ALL_STRATEGIES = ["bullish_swing", "bearish_swing", "bullish_divergence", "bearish_divergence"];
const STRATEGY_LABELS: Record<string, string> = {
  bullish_swing: "Bull Swing",
  bearish_swing: "Bear Swing",
  bullish_divergence: "Bull Div",
  bearish_divergence: "Bear Div",
};
const STRATEGY_COLORS: Record<string, string> = {
  bullish_swing: "#22c55e",
  bearish_swing: "#ef4444",
  bullish_divergence: "#3b82f6",
  bearish_divergence: "#a855f7",
};

/** Derive direction from strategy name — bearish = SHORT, bullish = LONG */
function deriveDirection(t: Trade): "LONG" | "SHORT" {
  const s = (t.strategy || "").toLowerCase();
  if (s.includes("bearish") || s.includes("bear")) return "SHORT";
  return "LONG";
}

function formatExitReason(reason: string | null): { label: string; cls: string } {
  if (!reason) return { label: "\u2014", cls: "text-slate-600" };
  const r = reason.toUpperCase();
  if (r.includes("TARGET")) return { label: "TARGET", cls: "text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded" };
  if (r.includes("OPT") && r.includes("SL")) return { label: "OPT SL", cls: "text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded" };
  if (r.includes("SPOT") && r.includes("SL")) return { label: "SPOT SL", cls: "text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded" };
  if (r.includes("SL")) return { label: "SL HIT", cls: "text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded" };
  if (r.includes("TIME") || r.includes("CLOSE")) return { label: "TIMEOUT", cls: "text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded" };
  return { label: reason, cls: "text-slate-500" };
}

function formatTime(ts: string | null): string {
  if (!ts) return "\u2014";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch { return ts.slice(11, 19); }
}

function defaultDateFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultDateTo(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Chart helpers (pure SVG) ────────────────────────────────────────────────

function EquityCurve({ trades }: { trades: Trade[] }) {
  const sorted = [...trades]
    .filter((t) => t.realized_pnl != null && t.exit_time)
    .sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime());

  if (sorted.length < 2) return <EmptyChart label="Equity Curve" />;

  let cum = 0;
  const points = sorted.map((t) => {
    cum += t.realized_pnl!;
    return cum;
  });

  const maxVal = Math.max(...points.map(Math.abs), 1);
  const w = 400, h = 120, pad = 20;

  const pathD = points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * (w - 2 * pad);
      const y = pad + ((maxVal - v) / (2 * maxVal)) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const zeroY = pad + (maxVal / (2 * maxVal)) * (h - 2 * pad);
  const finalPnl = points[points.length - 1];

  return (
    <div className="bg-[#0d0d14] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Equity Curve</span>
        <span className={`text-xs font-mono font-bold ${finalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {finalPnl >= 0 ? "+" : ""}{finalPnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 120 }}>
        <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="#1e1e2e" strokeWidth={1} />
        <path d={pathD} fill="none" stroke={finalPnl >= 0 ? "#22c55e" : "#ef4444"} strokeWidth={2} />
      </svg>
    </div>
  );
}

function DrawdownCurve({ trades }: { trades: Trade[] }) {
  const sorted = [...trades]
    .filter((t) => t.realized_pnl != null && t.exit_time)
    .sort((a, b) => new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime());

  if (sorted.length < 2) return <EmptyChart label="Drawdown Curve" />;

  let cum = 0, peak = 0;
  const dd = sorted.map((t) => {
    cum += t.realized_pnl!;
    peak = Math.max(peak, cum);
    return cum - peak;
  });

  const maxDD = Math.min(...dd, 0);
  const w = 400, h = 120, pad = 20;

  const pathD = dd
    .map((v, i) => {
      const x = pad + (i / (dd.length - 1)) * (w - 2 * pad);
      const y = pad + ((-v) / (-maxDD || 1)) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="bg-[#0d0d14] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Drawdown</span>
        <span className="text-xs font-mono font-bold text-red-400">
          {maxDD.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 120 }}>
        <path d={pathD} fill="none" stroke="#ef4444" strokeWidth={2} />
      </svg>
    </div>
  );
}

function TradesByHour({ trades }: { trades: Trade[] }) {
  const hours = new Array(7).fill(0); // 9, 10, 11, 12, 13, 14, 15
  for (const t of trades) {
    if (!t.entry_time) continue;
    try {
      const h = new Date(t.entry_time).getHours();
      if (h >= 9 && h <= 15) hours[h - 9]++;
    } catch {}
  }
  const maxH = Math.max(...hours, 1);
  const labels = ["9", "10", "11", "12", "13", "14", "15"];

  return (
    <div className="bg-[#0d0d14] rounded-lg p-3">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-2">Trades by Hour</span>
      <div className="flex items-end gap-1 h-[100px]">
        {hours.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
              <div
                className="w-full max-w-[28px] bg-blue-500/60 rounded-t"
                style={{ height: `${(count / maxH) * 100}%`, minHeight: count > 0 ? 4 : 0 }}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-600">{labels[i]}</span>
            <span className="text-[9px] font-mono text-slate-400">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SLvsTargetRatio({ trades }: { trades: Trade[] }) {
  const data: Record<string, { sl: number; tgt: number; tmo: number }> = {};
  for (const s of ALL_STRATEGIES) data[s] = { sl: 0, tgt: 0, tmo: 0 };

  for (const t of trades) {
    const s = t.strategy;
    if (!data[s]) continue;
    const r = (t.exit_reason || "").toUpperCase();
    if (r.includes("SL")) data[s].sl++;
    else if (r.includes("TARGET")) data[s].tgt++;
    else if (r.includes("TIME") || r.includes("CLOSE")) data[s].tmo++;
  }

  return (
    <div className="bg-[#0d0d14] rounded-lg p-3">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-2">SL vs Target</span>
      <div className="space-y-2">
        {ALL_STRATEGIES.map((s) => {
          const { sl, tgt, tmo } = data[s];
          const total = sl + tgt + tmo || 1;
          return (
            <div key={s}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-slate-400">{STRATEGY_LABELS[s]}</span>
                <span className="text-[10px] font-mono text-slate-500">{sl + tgt + tmo}</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden flex bg-[#1e1e2e]">
                <div className="bg-red-500/80 h-full" style={{ width: `${(sl / total) * 100}%` }} />
                <div className="bg-emerald-500/80 h-full" style={{ width: `${(tgt / total) * 100}%` }} />
                <div className="bg-yellow-500/60 h-full" style={{ width: `${(tmo / total) * 100}%` }} />
              </div>
            </div>
          );
        })}
        <div className="flex gap-4 text-[9px] text-slate-600 pt-1">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/80" />SL Hit</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/80" />Target</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/60" />Timeout</span>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="bg-[#0d0d14] rounded-lg p-3 flex items-center justify-center h-[160px]">
      <div className="text-center">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</div>
        <div className="text-[10px] text-slate-700 mt-1">Insufficient data</div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    dateFrom: defaultDateFrom(),
    dateTo: defaultDateTo(),
    strategies: [...ALL_STRATEGIES],
    direction: "ALL",
    minRR: 0,
  });

  const loadTrades = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAPI<TradesHistoryResponse>("/api/trades/history?days=90");
      if (data.error) setError(data.error);
      else setAllTrades(data.trades);
    } catch (e) {
      setError("Failed to fetch trade history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const filtered = useMemo(() => {
    return allTrades.filter((t) => {
      // Date range
      const tDate = (t.entry_time || t.created_at || "").slice(0, 10);
      if (tDate < filters.dateFrom || tDate > filters.dateTo) return false;
      // Strategy
      if (!filters.strategies.includes(t.strategy)) return false;
      // Direction (derived from strategy name)
      const dir = deriveDirection(t);
      if (filters.direction === "LONG" && dir !== "LONG") return false;
      if (filters.direction === "SHORT" && dir !== "SHORT") return false;
      // Min RR
      if (filters.minRR > 0 && (t.max_rr_achieved ?? 0) < filters.minRR) return false;
      return true;
    });
  }, [allTrades, filters]);

  function toggleStrategy(s: string) {
    setFilters((f) => ({
      ...f,
      strategies: f.strategies.includes(s)
        ? f.strategies.filter((x) => x !== s)
        : [...f.strategies, s],
    }));
  }

  const totalPnl = filtered.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
  const wins = filtered.filter((t) => (t.realized_pnl ?? 0) > 0).length;
  const losses = filtered.filter((t) => (t.realized_pnl ?? 0) <= 0 && t.status === "CLOSED").length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-mono font-bold tracking-widest uppercase text-slate-200">Backtest & Analysis</h1>
        <p className="text-xs text-slate-600 font-mono">Historical trade analysis · Filter · Visualize</p>
      </div>

      {/* Filter bar */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 flex flex-wrap items-end gap-4">
        {/* Date from */}
        <div>
          <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="bg-[#0d0d14] border border-[#1e1e2e] rounded px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-500"
          />
        </div>
        {/* Date to */}
        <div>
          <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="bg-[#0d0d14] border border-[#1e1e2e] rounded px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-500"
          />
        </div>
        {/* Strategy toggles */}
        <div>
          <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Strategy</label>
          <div className="flex gap-1">
            {ALL_STRATEGIES.map((s) => {
              const active = filters.strategies.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleStrategy(s)}
                  className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded border transition-colors ${
                    active
                      ? "border-slate-500 text-slate-200 bg-[#1e1e2e]"
                      : "border-[#1e1e2e] text-slate-600 bg-transparent hover:text-slate-400"
                  }`}
                  style={active ? { borderLeftColor: STRATEGY_COLORS[s], borderLeftWidth: 2 } : {}}
                >
                  {STRATEGY_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
        {/* Direction */}
        <div>
          <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Direction</label>
          <div className="flex gap-1">
            {(["ALL", "LONG", "SHORT"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setFilters((f) => ({ ...f, direction: d }))}
                className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded border transition-colors ${
                  filters.direction === d
                    ? "border-slate-500 text-slate-200 bg-[#1e1e2e]"
                    : "border-[#1e1e2e] text-slate-600 hover:text-slate-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        {/* Min RR */}
        <div>
          <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Min RR: {filters.minRR.toFixed(1)}</label>
          <input
            type="range"
            min="0"
            max="4"
            step="0.5"
            value={filters.minRR}
            onChange={(e) => setFilters((f) => ({ ...f, minRR: parseFloat(e.target.value) }))}
            className="w-24 accent-slate-500"
          />
        </div>
        {/* Summary */}
        <div className="ml-auto flex gap-4 text-xs">
          <div className="text-center">
            <div className="text-slate-600 text-[10px] uppercase">Trades</div>
            <div className="font-mono font-bold text-slate-200">{filtered.length}</div>
          </div>
          <div className="text-center">
            <div className="text-slate-600 text-[10px] uppercase">Win Rate</div>
            <div className="font-mono font-bold text-slate-200">
              {wins + losses > 0 ? `${Math.round((wins / (wins + losses)) * 100)}%` : "\u2014"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-600 text-[10px] uppercase">Net PnL</div>
            <div className={`font-mono font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{error}</div>
      ) : (
        <>
          {/* Charts grid */}
          <div className="grid grid-cols-2 gap-3">
            <EquityCurve trades={filtered} />
            <DrawdownCurve trades={filtered} />
            <TradesByHour trades={filtered} />
            <SLvsTargetRatio trades={filtered} />
          </div>

          {/* Trade table */}
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center justify-between">
              <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Filtered Trades</span>
              <span className="text-[10px] font-mono text-slate-600">{filtered.length} results</span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-[#1e1e2e] sticky top-0 bg-[#12121a] z-10">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Entry Time</th>
                    <th className="text-left px-3 py-2 font-medium">Strategy</th>
                    <th className="text-left px-3 py-2 font-medium">Dir</th>
                    <th className="text-left px-3 py-2 font-medium">Option</th>
                    <th className="text-right px-3 py-2 font-medium">Strike</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                    <th className="text-right px-3 py-2 font-medium">Entry ₹</th>
                    <th className="text-right px-3 py-2 font-medium">Exit ₹</th>
                    <th className="text-left px-3 py-2 font-medium">Exit Time</th>
                    <th className="text-center px-3 py-2 font-medium">Reason</th>
                    <th className="text-right px-3 py-2 font-medium">Max RR</th>
                    <th className="text-right px-3 py-2 font-medium">PnL</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((t, i) => {
                    const color = STRATEGY_COLORS[t.strategy] || "#64748b";
                    const dir = deriveDirection(t);
                    const reason = formatExitReason(t.exit_reason);
                    return (
                      <tr key={`${t.trade_id}-${i}`} className="border-b border-[#1e1e2e]/50 hover:bg-[#1a1a24]">
                        <td className="px-3 py-1.5 font-mono text-slate-400 whitespace-nowrap">
                          {(t.entry_time || t.created_at || "").slice(0, 10)}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">
                          {formatTime(t.entry_time)}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-slate-300 whitespace-nowrap">{STRATEGY_LABELS[t.strategy] || t.strategy}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`font-bold text-[10px] tracking-wider px-1.5 py-0.5 rounded ${
                            dir === "LONG" ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                          }`}>
                            {dir}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-400">
                          {t.option_type || "\u2014"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                          {t.strike ?? "\u2014"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                          {t.quantity ?? "\u2014"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-300">
                          {t.entry_price?.toFixed(2) ?? "\u2014"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-300">
                          {t.exit_price?.toFixed(2) ?? "\u2014"}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">
                          {formatTime(t.exit_time)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`text-[10px] font-bold tracking-wider ${reason.cls}`}>{reason.label}</span>
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono ${
                          (t.max_rr_achieved ?? 0) >= 1.5 ? "text-emerald-400" : (t.max_rr_achieved ?? 0) >= 1 ? "text-yellow-400" : "text-slate-300"
                        }`}>
                          {t.max_rr_achieved != null ? (t.max_rr_achieved as number).toFixed(2) : "\u2014"}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono font-bold ${
                          (t.realized_pnl ?? 0) > 0 ? "text-emerald-400" : (t.realized_pnl ?? 0) < 0 ? "text-red-400" : "text-slate-500"
                        }`}>
                          {t.realized_pnl != null
                            ? `${t.realized_pnl > 0 ? "+" : ""}${t.realized_pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                            : "\u2014"}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                            t.status === "CLOSED" ? "text-slate-400 bg-slate-800" :
                            t.status === "OPEN" ? "text-blue-400 bg-blue-500/10" :
                            "text-slate-600"
                          }`}>
                            {t.status || "\u2014"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-600 font-mono">No trades match filters</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
