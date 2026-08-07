"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAPI, postAPI } from "@/lib/api";

// ── API shapes (mirrors api/routes_plan.py) ────────────────────────────────
interface PlanStatus {
  enabled: boolean;
  paper_only: boolean;
  armed_today: boolean;
  armed_tomorrow: boolean;
  traded_today: boolean;
  today_trade: { trade_id: string; status: string; entry_time: string } | null;
  settings: {
    risk_per_trade: number;
    entry_cutoff: string;
    sl_floor_pts: number;
    target_rr: number;
    cap_mult: number;
    time_exit: string;
    fut_entry_methods: string[];
  };
}

interface PlanTrade {
  trade_id: string;
  status: string;
  entry_price: number | null;
  entry_time: string | null;
  exit_price: number | null;
  exit_time: string | null;
  exit_reason: string | null;
  option_type: string;
  strike: number;
  expiry: string;
  quantity: number;
  realized_pnl: number | null;
  initial_risk: number | null;
  entry_method: string | null;
  entry_bid: number | null;
  entry_ask: number | null;
  exit_bid: number | null;
  exit_ask: number | null;
  signal_instrument: string | null;
  spot_sl: number | null;
  planned_risk: number | null;
  r_multiple: number | null;
}

interface PlanStats {
  months: {
    month: string;
    trades: number;
    winners: number;
    win_pct: number | null;
    pnl: number;
    avg_r_pct: number | null;
    est_costs: number;
    net_pnl: number;
  }[];
  overall: {
    trades: number;
    winners: number;
    win_pct: number | null;
    pnl: number;
    avg_r_pct: number | null;
    est_costs: number;
    net_pnl: number;
  };
}

async function deleteAPI<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/backend${endpoint}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const rupees = (v: number | null | undefined) =>
  v == null ? "—" : `${v < 0 ? "−" : "+"}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;

export default function PlanPage() {
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [trades, setTrades] = useState<PlanTrade[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, t, st] = await Promise.all([
        fetchAPI<PlanStatus>("/api/plan/status"),
        fetchAPI<{ trades: PlanTrade[] }>("/api/plan/trades"),
        fetchAPI<PlanStats>("/api/plan/stats"),
      ]);
      setStatus(s);
      setTrades(t.trades);
      setStats(st);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan data");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const toggleArm = async (day: string, armed: boolean) => {
    setBusy(true);
    try {
      if (armed) await deleteAPI(`/api/plan/arm/${day}`);
      else await postAPI("/api/plan/arm", { day });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Arm/disarm failed");
    } finally {
      setBusy(false);
    }
  };

  const o = stats?.overall;

  return (
    <div className="space-y-4 p-3 md:p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-mono font-bold tracking-widest uppercase text-slate-200">
          The Plan
        </h2>
        {status?.paper_only && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700 text-amber-300 uppercase tracking-wider">
            Paper Trading
          </span>
        )}
        {status && !status.enabled && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-900/40 border border-red-700 text-red-300 uppercase tracking-wider">
            Disabled
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
          <p className="text-red-400 text-sm font-mono">{error}</p>
        </div>
      )}

      {/* Rule summary + arming */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#12121c] border border-[#1e1e2e] rounded-lg p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            The rule
          </p>
          <p className="text-xs text-slate-300 leading-relaxed font-mono">
            Short-bias day → one PE trade → first qualifying signal before{" "}
            {status?.settings.entry_cutoff ?? "12:30"} (spot: any entry · fut:{" "}
            {status?.settings.fut_entry_methods.join("/") ?? "mother_child/green_candle"})
            → current-expiry ITM1 100-strike → ₹
            {status?.settings.risk_per_trade ?? 2000} risk → exit on 1:
            {status?.settings.target_rr ?? 2} premium target / chart-SL touch /{" "}
            {Math.round(((status?.settings.cap_mult ?? 1.1) as number) * 100)}% cap /{" "}
            {status?.settings.time_exit ?? "15:25"}.
          </p>
          <div className="flex gap-4 pt-1 text-xs font-mono">
            <span className={status?.traded_today ? "text-emerald-400" : "text-slate-500"}>
              {status?.traded_today
                ? `● traded today (${status.today_trade?.status ?? ""})`
                : "○ no trade today"}
            </span>
          </div>
        </div>

        <div className="bg-[#12121c] border border-[#1e1e2e] rounded-lg p-4 space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Arm short-bias days
          </p>
          {[
            { label: "Today", day: isoDate(0), armed: status?.armed_today ?? false },
            { label: "Tomorrow", day: isoDate(1), armed: status?.armed_tomorrow ?? false },
          ].map(({ label, day, armed }) => (
            <div key={day} className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-300">
                {label} <span className="text-slate-600">({day})</span>
              </span>
              <button
                disabled={busy || !status}
                onClick={() => toggleArm(day, armed)}
                className={`text-[11px] font-mono px-3 py-1 rounded border transition-colors ${
                  armed
                    ? "bg-emerald-900/40 border-emerald-700 text-emerald-300 hover:bg-emerald-900/70"
                    : "bg-[#0d0d14] border-[#2a2a3e] text-slate-500 hover:text-slate-300 hover:border-slate-500"
                } disabled:opacity-40`}
              >
                {armed ? "ARMED ✓ (click to disarm)" : "DISARMED (click to arm)"}
              </button>
            </div>
          ))}
          <p className="text-[10px] text-slate-600 font-mono">
            The gate only takes trades on armed days. Re-checked by the engine every 60s.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Trades", value: o ? String(o.trades) : "—" },
          { label: "Win %", value: o?.win_pct != null ? `${o.win_pct}%` : "—" },
          {
            label: "Avg return / trade",
            value: o?.avg_r_pct != null ? `${o.avg_r_pct > 0 ? "+" : ""}${o.avg_r_pct}% of risk` : "—",
          },
          { label: "Net P&L (est. costs)", value: o ? rupees(o.net_pnl) : "—" },
        ].map((c) => (
          <div key={c.label} className="bg-[#12121c] border border-[#1e1e2e] rounded-lg p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {c.label}
            </p>
            <p className="text-lg font-mono font-bold text-slate-200 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      {stats && stats.months.length > 0 && (
        <div className="bg-[#12121c] border border-[#1e1e2e] rounded-lg overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-500 border-b border-[#1e1e2e] text-left">
                <th className="p-2">Month</th>
                <th className="p-2">Trades</th>
                <th className="p-2">Win%</th>
                <th className="p-2">Avg R</th>
                <th className="p-2">Gross</th>
                <th className="p-2">Est. costs</th>
                <th className="p-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {stats.months.map((m) => (
                <tr key={m.month} className="border-b border-[#1e1e2e]/50 text-slate-300">
                  <td className="p-2">{m.month}</td>
                  <td className="p-2">{m.trades}</td>
                  <td className="p-2">{m.win_pct != null ? `${m.win_pct}%` : "—"}</td>
                  <td className="p-2">{m.avg_r_pct != null ? `${m.avg_r_pct}%` : "—"}</td>
                  <td className={`p-2 ${m.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {rupees(m.pnl)}
                  </td>
                  <td className="p-2 text-slate-500">₹{m.est_costs}</td>
                  <td className={`p-2 ${m.net_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {rupees(m.net_pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trades table */}
      <div className="bg-[#12121c] border border-[#1e1e2e] rounded-lg overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-slate-500 border-b border-[#1e1e2e] text-left">
              <th className="p-2">Entry</th>
              <th className="p-2">Strike</th>
              <th className="p-2">Sig</th>
              <th className="p-2">Method</th>
              <th className="p-2">Qty</th>
              <th className="p-2">In @ (bid/ask)</th>
              <th className="p-2">SL pts</th>
              <th className="p-2">Exit</th>
              <th className="p-2">Reason</th>
              <th className="p-2">P&L</th>
              <th className="p-2">R</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={11} className="p-4 text-center text-slate-600">
                  No plan trades yet — arm a bias day and the first qualifying
                  short before {status?.settings.entry_cutoff ?? "12:30"} will appear here.
                </td>
              </tr>
            )}
            {trades.map((t) => (
              <tr key={t.trade_id} className="border-b border-[#1e1e2e]/50 text-slate-300">
                <td className="p-2 whitespace-nowrap">{t.entry_time?.slice(0, 16) ?? "—"}</td>
                <td className="p-2 whitespace-nowrap">
                  {t.strike} {t.option_type}
                </td>
                <td className="p-2">{t.signal_instrument ?? "—"}</td>
                <td className="p-2">{t.entry_method ?? "—"}</td>
                <td className="p-2">{t.quantity}</td>
                <td className="p-2 whitespace-nowrap">
                  {t.entry_price ?? "—"}
                  {t.entry_bid != null && (
                    <span className="text-slate-600"> ({t.entry_bid}/{t.entry_ask})</span>
                  )}
                </td>
                <td className="p-2">{t.initial_risk ?? "—"}</td>
                <td className="p-2 whitespace-nowrap">
                  {t.exit_price ?? (t.status === "OPEN" ? "open" : "—")}
                </td>
                <td className="p-2">{t.exit_reason ?? "—"}</td>
                <td
                  className={`p-2 whitespace-nowrap ${
                    (t.realized_pnl ?? 0) > 0
                      ? "text-emerald-400"
                      : t.realized_pnl != null
                      ? "text-red-400"
                      : ""
                  }`}
                >
                  {rupees(t.realized_pnl)}
                </td>
                <td className="p-2">{t.r_multiple != null ? `${t.r_multiple}R` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
