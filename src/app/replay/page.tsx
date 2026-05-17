"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAPI, postAPI } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

interface ReplayDate {
  date: string;
  coverage: Record<string, number>;
}

interface ReplayRun {
  run_id: string;
  version_tag: string;
  git_sha: string | null;
  date_from: string;
  date_to: string;
  strategy: string;
  status: string;
  total_pnl: number;
  trade_count: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  progress_ts: string | null;
}

// Trading day window used to convert simulated clock → progress %.
const TRADING_DAY_START_MIN = 9 * 60 + 15;   // 09:15
const TRADING_DAY_END_MIN   = 15 * 60 + 30;  // 15:30
const TRADING_DAY_SPAN_MIN  = TRADING_DAY_END_MIN - TRADING_DAY_START_MIN; // 375

function replayProgressPct(run: ReplayRun): number | null {
  if (run.status === "COMPLETED") return 100;
  if (run.status === "QUEUED") return 0;
  if (!run.progress_ts) return null;
  // progress_ts is "YYYY-MM-DDTHH:MM:SS" (naive sim time). Parse the
  // clock part directly so browser timezone doesn't shift it.
  const t = run.progress_ts.slice(11, 19); // "HH:MM:SS"
  const [hh, mm] = t.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const mins = hh * 60 + mm;
  const elapsed = mins - TRADING_DAY_START_MIN;
  if (elapsed <= 0) return 0;
  if (elapsed >= TRADING_DAY_SPAN_MIN) return 100;
  return Math.round((elapsed / TRADING_DAY_SPAN_MIN) * 100);
}

function progressLabel(run: ReplayRun): string {
  const pct = replayProgressPct(run);
  if (pct === null) return "—";
  if (run.progress_ts) {
    return `${run.progress_ts.slice(11, 16)} · ${pct}%`;
  }
  return `${pct}%`;
}

interface ReplayTrade {
  trade_id: string;
  strategy: string;
  instrument: string;
  direction: string;
  status: string;
  entry_order_id: string | null;
  entry_price: number | null;
  entry_time: string | null;
  exit_price: number | null;
  exit_time: string | null;
  exit_reason: string | null;
  option_type: string | null;
  strike: number | null;
  expiry: string | null;
  quantity: number | null;
  realized_pnl: number | null;
  initial_risk: number | null;
  max_rr_achieved: number | null;
  mfe_value: number | null;
  mae_value: number | null;
  rr_at_exit: number | null;
  entry_method: string | null;
  stop_loss: number | null;
}

interface SpawnedRun {
  run_id: string;
  date: string;
  log_path: string;
}

interface TriggerResponse {
  runs: SpawnedRun[];
  queued: number;
  status: string;
}

interface StopResponse {
  run_id: string;
  status: string;
  detail: string;
}

const MAX_PARALLEL_RUNS = 3;

// ── Formatters ──────────────────────────────────────────────────────────────

const STRATEGY_LABELS: Record<string, string> = {
  bullish_divergence: "Bull Div",
  bearish_divergence: "Bear Div",
  both: "Both",
};

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch {
    return ts.slice(11, 19);
  }
}

function formatDateTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return ts;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "RUNNING":  return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    case "QUEUED":   return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    case "COMPLETED":return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    case "FAILED":   return "text-red-400 bg-red-500/10 border-red-500/30";
    case "CANCELLED":return "text-orange-400 bg-orange-500/10 border-orange-500/30";
    default:         return "text-slate-500 bg-slate-700/40 border-slate-700";
  }
}

const isLive = (status: string): boolean => status === "RUNNING" || status === "QUEUED";

function exitReasonColor(reason: string | null): string {
  if (!reason) return "text-slate-600";
  const r = reason.toUpperCase();
  if (r.includes("TARGET")) return "text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded";
  if (r.includes("SL")) return "text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded";
  if (r.includes("TIME") || r.includes("EOD")) return "text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded";
  return "text-slate-500";
}

const ENTRY_METHOD_LABELS: Record<string, string> = {
  green_candle: "Green",
  red_candle:   "Red",
  pullback:     "Pullback",
  three_bottom: "3-Bottom",
  three_top:    "3-Top",
};

// ── Main page ───────────────────────────────────────────────────────────────

export default function ReplayPage() {
  const [dates, setDates] = useState<ReplayDate[]>([]);
  const [runs, setRuns] = useState<ReplayRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [trades, setTrades] = useState<ReplayTrade[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trigger form state
  const [formMode, setFormMode] = useState<"single" | "range">("single");
  const [formDate, setFormDate] = useState<string>("");
  const [formDateFrom, setFormDateFrom] = useState<string>("");
  const [formDateTo, setFormDateTo] = useState<string>("");
  const [formTag, setFormTag] = useState<string>("");
  const [formStrategy, setFormStrategy] = useState<string>("both");
  const [submitting, setSubmitting] = useState(false);
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadDates = useCallback(async () => {
    setLoadingDates(true);
    try {
      const data = await fetchAPI<{ dates: ReplayDate[] }>("/api/replay/dates");
      setDates(data.dates);
      if (data.dates.length > 0) {
        const newest = data.dates[0].date;
        const oldest = data.dates[data.dates.length - 1].date;
        setFormDate((prev) => prev || newest);
        setFormDateTo((prev) => prev || newest);
        setFormDateFrom((prev) => prev || oldest);
      }
    } catch (e) {
      setError(`Failed to load dates: ${(e as Error).message}`);
    } finally {
      setLoadingDates(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const data = await fetchAPI<{ runs: ReplayRun[] }>("/api/replay/runs?limit=50");
      setRuns(data.runs);
      if (!selectedRunId && data.runs.length > 0) setSelectedRunId(data.runs[0].run_id);
    } catch (e) {
      setError(`Failed to load runs: ${(e as Error).message}`);
    } finally {
      setLoadingRuns(false);
    }
  }, [selectedRunId]);

  const loadTrades = useCallback(async (runId: string) => {
    setLoadingTrades(true);
    try {
      const data = await fetchAPI<{ trades: ReplayTrade[] }>(`/api/replay/runs/${runId}/trades`);
      setTrades(data.trades);
    } catch (e) {
      setError(`Failed to load trades: ${(e as Error).message}`);
    } finally {
      setLoadingTrades(false);
    }
  }, []);

  useEffect(() => { loadDates(); }, [loadDates]);
  useEffect(() => { loadRuns(); }, [loadRuns]);
  useEffect(() => {
    if (selectedRunId) loadTrades(selectedRunId);
  }, [selectedRunId, loadTrades]);

  // Auto-refresh runs list while any run is RUNNING/QUEUED
  useEffect(() => {
    const active = runs.some((r) => r.status === "RUNNING" || r.status === "QUEUED");
    if (!active) return;
    const id = setInterval(() => loadRuns(), 5000);
    return () => clearInterval(id);
  }, [runs, loadRuns]);

  // ── Trigger ────────────────────────────────────────────────────────────────

  const trigger = useCallback(async () => {
    const payload: Record<string, string> = {
      version_tag: formTag || "untagged",
      strategy: formStrategy,
    };
    if (formMode === "single") {
      if (!formDate) {
        setError("Pick a replay date first");
        return;
      }
      payload.date = formDate;
    } else {
      if (!formDateFrom || !formDateTo) {
        setError("Pick both start and end dates");
        return;
      }
      if (formDateFrom > formDateTo) {
        setError("Start date must be on or before end date");
        return;
      }
      payload.date_from = formDateFrom;
      payload.date_to = formDateTo;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await postAPI<TriggerResponse>("/api/replay/runs", payload);
      if (resp.runs.length > 0) setSelectedRunId(resp.runs[0].run_id);
      await loadRuns();
    } catch (e) {
      setError(`Failed to trigger replay: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }, [formMode, formDate, formDateFrom, formDateTo, formTag, formStrategy, loadRuns]);

  const stopRun = useCallback(async (runId: string) => {
    setStoppingIds((prev) => new Set(prev).add(runId));
    setError(null);
    try {
      await postAPI<StopResponse>(`/api/replay/runs/${runId}/stop`, {});
      await loadRuns();
    } catch (e) {
      setError(`Failed to stop ${runId}: ${(e as Error).message}`);
    } finally {
      setStoppingIds((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    }
  }, [loadRuns]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedRun = useMemo(
    () => runs.find((r) => r.run_id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const tradeSummary = useMemo(() => {
    const wins = trades.filter((t) => (t.realized_pnl ?? 0) > 0).length;
    const losses = trades.filter((t) => (t.realized_pnl ?? 0) < 0).length;
    const flat = trades.length - wins - losses;
    return { wins, losses, flat };
  }, [trades]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-3 md:p-4 space-y-3 md:space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-mono font-bold tracking-widest uppercase text-slate-200">Strategy Replay</h1>
        <p className="text-xs text-slate-600 font-mono">
          Re-simulate a past trading day through current strategy code · writes to replay_* tables · live engine untouched
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100 ml-2">×</button>
        </div>
      )}

      {/* Trigger card */}
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-3 md:p-4 space-y-3">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-[#0d0d14] border border-[#1e1e2e] rounded p-0.5 w-fit">
          {(["single", "range"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFormMode(m)}
              className={`text-[10px] font-mono tracking-wider px-3 py-1 rounded transition-colors ${
                formMode === m
                  ? "bg-[#1e1e2e] text-emerald-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {m === "single" ? "SINGLE DATE" : "DATE RANGE"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 md:gap-4">
          {formMode === "single" ? (
            <div>
              <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Date</label>
              <select
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                disabled={loadingDates}
                className="bg-[#0d0d14] border border-[#1e1e2e] rounded px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-500 min-w-[200px]"
              >
                {loadingDates && <option>Loading…</option>}
                {dates.map((d) => {
                  const spot = d.coverage.spot || 0;
                  return (
                    <option key={d.date} value={d.date}>
                      {d.date} ({spot.toLocaleString("en-IN")} ticks)
                    </option>
                  );
                })}
                {!loadingDates && dates.length === 0 && <option value="">No dates available</option>}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">From</label>
                <select
                  value={formDateFrom}
                  onChange={(e) => setFormDateFrom(e.target.value)}
                  disabled={loadingDates}
                  className="bg-[#0d0d14] border border-[#1e1e2e] rounded px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-500 min-w-[140px]"
                >
                  {dates.map((d) => (
                    <option key={d.date} value={d.date}>{d.date}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">To</label>
                <select
                  value={formDateTo}
                  onChange={(e) => setFormDateTo(e.target.value)}
                  disabled={loadingDates}
                  className="bg-[#0d0d14] border border-[#1e1e2e] rounded px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-500 min-w-[140px]"
                >
                  {dates.map((d) => (
                    <option key={d.date} value={d.date}>{d.date}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Version Tag</label>
            <input
              type="text"
              value={formTag}
              onChange={(e) => setFormTag(e.target.value)}
              placeholder="v_my-feature"
              maxLength={60}
              className="bg-[#0d0d14] border border-[#1e1e2e] rounded px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-500 min-w-[160px]"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Strategy</label>
            <select
              value={formStrategy}
              onChange={(e) => setFormStrategy(e.target.value)}
              className="bg-[#0d0d14] border border-[#1e1e2e] rounded px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-slate-500"
            >
              <option value="both">Both</option>
              <option value="bullish_divergence">Bull Div</option>
              <option value="bearish_divergence">Bear Div</option>
            </select>
          </div>

          <button
            onClick={trigger}
            disabled={submitting || (formMode === "single" ? !formDate : !formDateFrom || !formDateTo)}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold tracking-wider px-4 py-1.5 rounded border border-emerald-500/50 transition-colors"
          >
            {submitting ? "Triggering…" : formMode === "single" ? "▶ Run Replay" : "▶ Run Range"}
          </button>

          <div className="ml-auto text-[10px] font-mono text-slate-600 text-right">
            {formMode === "range" ? (
              <>
                <div>up to {MAX_PARALLEL_RUNS} runs in parallel</div>
                <div className="text-slate-700">extras stay QUEUED and auto-start as slots free</div>
              </>
            ) : (
              `${dates.length} replayable dates`
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout: runs list + selected run detail */}
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-3 md:gap-4">
        {/* Runs list */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[#1e1e2e] flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Run History</span>
            <button
              onClick={loadRuns}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-mono"
              disabled={loadingRuns}
            >
              {loadingRuns ? "…" : "↻"}
            </button>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {loadingRuns && runs.length === 0 ? (
              <div className="p-6 text-center text-slate-600 text-xs font-mono">Loading…</div>
            ) : runs.length === 0 ? (
              <div className="p-6 text-center text-slate-600 text-xs font-mono">No replay runs yet</div>
            ) : (
              runs.map((r) => {
                const active = r.run_id === selectedRunId;
                const live = isLive(r.status);
                const stopping = stoppingIds.has(r.run_id);
                return (
                  <div
                    key={r.run_id}
                    onClick={() => setSelectedRunId(r.run_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedRunId(r.run_id);
                    }}
                    className={`cursor-pointer px-3 py-2 border-b border-[#1e1e2e]/50 transition-colors ${
                      active ? "bg-[#1e1e2e]" : "hover:bg-[#1a1a24]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-slate-300 truncate">{r.version_tag}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {live && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!stopping) stopRun(r.run_id);
                            }}
                            disabled={stopping}
                            title="Stop this replay"
                            className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            {stopping ? "…" : "■ STOP"}
                          </button>
                        )}
                        <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${statusColor(r.status)}`}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] font-mono text-slate-600">{r.date_from}</span>
                      <span className={`text-[10px] font-mono font-bold ${
                        r.total_pnl > 0 ? "text-emerald-400" : r.total_pnl < 0 ? "text-red-400" : "text-slate-500"
                      }`}>
                        {r.total_pnl != null ? (r.total_pnl > 0 ? "+" : "") + r.total_pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] font-mono text-slate-700">{formatDateTime(r.created_at)}</span>
                      <span className="text-[9px] font-mono text-slate-600">{r.trade_count} trades</span>
                    </div>
                    {live && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-[#0d0d14] border border-[#1e1e2e] rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500/70 transition-all duration-500"
                            style={{ width: `${replayProgressPct(r) ?? 0}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 tabular-nums">
                          {progressLabel(r)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected run detail */}
        <div className="space-y-3 md:space-y-4">
          {selectedRun ? (
            <>
              {/* Summary card */}
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-3 md:p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-mono font-bold text-slate-200">{selectedRun.version_tag}</div>
                    <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                      {selectedRun.run_id}
                      {selectedRun.git_sha && <span className="ml-2 text-slate-700">@ {selectedRun.git_sha}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isLive(selectedRun.status) && (
                      <button
                        onClick={() => {
                          if (!stoppingIds.has(selectedRun.run_id)) stopRun(selectedRun.run_id);
                        }}
                        disabled={stoppingIds.has(selectedRun.run_id)}
                        className="text-[10px] font-bold tracking-wider px-2 py-1 rounded border text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {stoppingIds.has(selectedRun.run_id) ? "STOPPING…" : "■ STOP"}
                      </button>
                    )}
                    <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded border ${statusColor(selectedRun.status)}`}>
                      {selectedRun.status}
                    </span>
                  </div>
                </div>

                {selectedRun.error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-[11px] text-red-300 font-mono mb-3 whitespace-pre-wrap">
                    {selectedRun.error}
                  </div>
                )}

                {isLive(selectedRun.status) && (() => {
                  const pct = replayProgressPct(selectedRun) ?? 0;
                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
                        <span>
                          Simulated clock {selectedRun.progress_ts ? selectedRun.progress_ts.slice(11, 16) : "—"}
                          <span className="text-slate-700"> / 15:30</span>
                        </span>
                        <span className="tabular-nums text-slate-400">{pct}%</span>
                      </div>
                      <div className="h-2 bg-[#0d0d14] border border-[#1e1e2e] rounded overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500/70 to-cyan-400/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider">Date</div>
                    <div className="font-mono text-slate-300">{selectedRun.date_from}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider">Strategy</div>
                    <div className="font-mono text-slate-300">{STRATEGY_LABELS[selectedRun.strategy] || selectedRun.strategy}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider">Total P&L</div>
                    <div className={`font-mono font-bold ${
                      selectedRun.total_pnl > 0 ? "text-emerald-400" : selectedRun.total_pnl < 0 ? "text-red-400" : "text-slate-500"
                    }`}>
                      {selectedRun.total_pnl != null
                        ? `${selectedRun.total_pnl > 0 ? "+" : ""}${selectedRun.total_pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider">Trades</div>
                    <div className="font-mono text-slate-300">
                      {selectedRun.trade_count}
                      <span className="text-[10px] text-slate-600 ml-1">
                        ({tradeSummary.wins}W / {tradeSummary.losses}L)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wider">Started</div>
                    <div className="font-mono text-slate-400 text-[11px]">{formatDateTime(selectedRun.created_at)}</div>
                  </div>
                </div>
              </div>

              {/* Trades table */}
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Trades</span>
                  <span className="text-[10px] font-mono text-slate-600">{trades.length}</span>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  {loadingTrades ? (
                    <div className="p-8 text-center text-slate-600 text-xs font-mono">Loading…</div>
                  ) : trades.length === 0 ? (
                    <div className="p-8 text-center text-slate-600 text-xs font-mono">
                      {selectedRun.status === "RUNNING" || selectedRun.status === "QUEUED"
                        ? "Replay in progress — trades will appear as they fire."
                        : "No trades produced by this run."}
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-[#1e1e2e] sticky top-0 bg-[#12121a] z-10">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Entry</th>
                          <th className="text-left px-3 py-2 font-medium">Strategy</th>
                          <th className="text-left px-3 py-2 font-medium">Method</th>
                          <th className="text-left px-3 py-2 font-medium">CP</th>
                          <th className="text-right px-3 py-2 font-medium">Strike</th>
                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 font-medium">Entry ₹</th>
                          <th className="text-right px-3 py-2 font-medium">SL ₹</th>
                          <th className="text-right px-3 py-2 font-medium">Exit ₹</th>
                          <th className="text-left px-3 py-2 font-medium">Exit</th>
                          <th className="text-center px-3 py-2 font-medium">Reason</th>
                          <th className="text-right px-3 py-2 font-medium">Max RR</th>
                          <th className="text-right px-3 py-2 font-medium">PnL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((t, i) => (
                          <tr key={`${t.trade_id}-${i}`} className="border-b border-[#1e1e2e]/50 hover:bg-[#1a1a24]">
                            <td className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">{formatTime(t.entry_time)}</td>
                            <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">
                              {STRATEGY_LABELS[t.strategy] || t.strategy}
                            </td>
                            <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                              {t.entry_method
                                ? (ENTRY_METHOD_LABELS[t.entry_method] || t.entry_method)
                                : "—"}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-slate-400">{t.option_type || "—"}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-400">{t.strike ?? "—"}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                              {t.quantity != null ? t.quantity.toLocaleString("en-IN") : "—"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-300">{t.entry_price?.toFixed(2) ?? "—"}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-red-400/80">{t.stop_loss?.toFixed(2) ?? "—"}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-300">{t.exit_price?.toFixed(2) ?? "—"}</td>
                            <td className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">{formatTime(t.exit_time)}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`text-[10px] font-bold tracking-wider ${exitReasonColor(t.exit_reason)}`}>
                                {t.exit_reason || "—"}
                              </span>
                            </td>
                            <td className={`px-3 py-1.5 text-right font-mono ${
                              (t.max_rr_achieved ?? 0) >= 1.5 ? "text-emerald-400" :
                              (t.max_rr_achieved ?? 0) >= 1 ? "text-yellow-400" : "text-slate-300"
                            }`}>
                              {t.max_rr_achieved != null ? t.max_rr_achieved.toFixed(2) : "—"}
                            </td>
                            <td className={`px-3 py-1.5 text-right font-mono font-bold ${
                              (t.realized_pnl ?? 0) > 0 ? "text-emerald-400" :
                              (t.realized_pnl ?? 0) < 0 ? "text-red-400" : "text-slate-500"
                            }`}>
                              {t.realized_pnl != null
                                ? `${t.realized_pnl > 0 ? "+" : ""}${t.realized_pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-8 text-center text-slate-600 text-xs font-mono">
              Pick a run from the list, or trigger a new one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
