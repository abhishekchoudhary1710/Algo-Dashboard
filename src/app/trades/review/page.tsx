"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchAPI, patchAPI } from "@/lib/api";
import type { Trade, TradesHistoryResponse, TradeReviewResponse } from "@/lib/api";

function dateKey(t: Trade): string | null {
  const stamp = t.entry_time ?? t.created_at ?? null;
  return stamp ? stamp.slice(0, 10) : null;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function PnlSpan({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-slate-500">--</span>;
  const color = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  const prefix = value > 0 ? "+" : "";
  return <span className={`font-mono font-semibold ${color}`}>{prefix}{value.toFixed(2)}</span>;
}

function PlanToggle({
  value,
  onChange,
}: {
  value: boolean | null | undefined;
  onChange: (next: boolean | null) => void;
}) {
  return (
    <div className="inline-flex rounded border border-[#1e1e2e] overflow-hidden text-[11px]">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-2 py-1 ${value === true ? "bg-green-500/20 text-green-400" : "text-slate-500 hover:bg-[#1a1a24]"}`}
        title="Mark as aligned with EOD plan"
      >
        ✓ Aligned
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-2 py-1 border-l border-[#1e1e2e] ${value === false ? "bg-red-500/20 text-red-400" : "text-slate-500 hover:bg-[#1a1a24]"}`}
        title="Off-plan trade"
      >
        ✗ Off-plan
      </button>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`px-2 py-1 border-l border-[#1e1e2e] ${value == null ? "bg-slate-700/40 text-slate-300" : "text-slate-500 hover:bg-[#1a1a24]"}`}
        title="Clear mark"
      >
        — Unset
      </button>
    </div>
  );
}

interface TradeCardState {
  planAligned: boolean | null | undefined;
  planNote: string;
  eodNote: string;
  saving: boolean;
  error: string | null;
  savedAt: string | null;
  dirty: boolean;
}

function buildState(t: Trade): TradeCardState {
  return {
    planAligned: t.plan_aligned,
    planNote: t.plan_note ?? "",
    eodNote: t.eod_note ?? "",
    saving: false,
    error: null,
    savedAt: t.eod_reviewed_at ?? null,
    dirty: false,
  };
}

export default function EodReviewPage() {
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>(todayKey());
  // Per-trade local form state, keyed by trade_id
  const [cards, setCards] = useState<Record<string, TradeCardState>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchAPI<TradesHistoryResponse>("/api/trades/history?days=90");
      setAllTrades(res.trades);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize card state when trades load — preserve dirty edits across refetch
  useEffect(() => {
    setCards((prev) => {
      const next: Record<string, TradeCardState> = {};
      for (const t of allTrades) {
        const existing = prev[t.trade_id];
        if (existing && existing.dirty) {
          next[t.trade_id] = existing;
        } else {
          next[t.trade_id] = buildState(t);
        }
      }
      return next;
    });
  }, [allTrades]);

  // Default the date picker to the most recent date that actually has trades
  useEffect(() => {
    if (allTrades.length === 0) return;
    const dates = new Set<string>();
    for (const t of allTrades) {
      const k = dateKey(t);
      if (k) dates.add(k);
    }
    if (dates.has(todayKey())) return; // today is fine
    if (dates.has(date)) return; // current selection is valid
    const sorted = Array.from(dates).sort().reverse();
    if (sorted[0]) setDate(sorted[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTrades]);

  const dayTrades = useMemo(() => {
    return allTrades
      .filter((t) => dateKey(t) === date)
      .filter((t) => t.execution_status !== "REJECTED" && t.status === "CLOSED")
      .sort((a, b) => (a.entry_time ?? "").localeCompare(b.entry_time ?? ""));
  }, [allTrades, date]);

  const dayStats = useMemo(() => {
    const reviewed = dayTrades.filter((t) => t.plan_aligned != null || (t.eod_note ?? "").trim() !== "");
    const aligned = dayTrades.filter((t) => t.plan_aligned === true);
    const offPlan = dayTrades.filter((t) => t.plan_aligned === false);
    const alignedPnl = aligned.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
    const totalPnl = dayTrades.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
    return {
      total: dayTrades.length,
      reviewed: reviewed.length,
      pending: dayTrades.length - reviewed.length,
      aligned: aligned.length,
      offPlan: offPlan.length,
      alignedPnl,
      totalPnl,
    };
  }, [dayTrades]);

  const datesWithTrades = useMemo(() => {
    const s = new Set<string>();
    for (const t of allTrades) {
      const k = dateKey(t);
      if (k) s.add(k);
    }
    return s;
  }, [allTrades]);

  const setCardField = useCallback(
    <K extends keyof TradeCardState>(tradeId: string, key: K, value: TradeCardState[K]) => {
      setCards((prev) => {
        const existing = prev[tradeId];
        if (!existing) return prev;
        return {
          ...prev,
          [tradeId]: { ...existing, [key]: value, dirty: true, error: null },
        };
      });
    },
    [],
  );

  const saveCard = useCallback(
    async (tradeId: string) => {
      const card = cards[tradeId];
      if (!card) return;
      setCards((prev) => ({ ...prev, [tradeId]: { ...card, saving: true, error: null } }));
      try {
        const res = await patchAPI<TradeReviewResponse>(
          `/api/trades/${encodeURIComponent(tradeId)}/review`,
          {
            plan_aligned: card.planAligned ?? null,
            plan_note: card.planNote.trim() === "" ? null : card.planNote,
            eod_note: card.eodNote.trim() === "" ? null : card.eodNote,
          },
        );
        if (res.status !== "ok" || !res.trade) {
          throw new Error(res.error || "Save failed");
        }
        const updated = res.trade;
        setAllTrades((prev) =>
          prev.map((t) =>
            t.trade_id === tradeId
              ? {
                  ...t,
                  plan_aligned: updated.plan_aligned,
                  plan_note: updated.plan_note,
                  eod_note: updated.eod_note,
                  eod_reviewed_at: updated.eod_reviewed_at,
                }
              : t,
          ),
        );
        setCards((prev) => ({
          ...prev,
          [tradeId]: {
            planAligned: updated.plan_aligned,
            planNote: updated.plan_note ?? "",
            eodNote: updated.eod_note ?? "",
            saving: false,
            error: null,
            savedAt: updated.eod_reviewed_at ?? null,
            dirty: false,
          },
        }));
      } catch (e) {
        setCards((prev) => ({
          ...prev,
          [tradeId]: {
            ...prev[tradeId],
            saving: false,
            error: e instanceof Error ? e.message : "Save failed",
          },
        }));
      }
    },
    [cards],
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-slate-400 animate-pulse">Loading trades...</p>
      </div>
    );
  }

  if (error && allTrades.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 bg-[#0a0e17] min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white">EOD Review</h1>
          <p className="text-xs text-slate-500">
            Mark plan alignment and write per-trade analysis for the trading day
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/trades"
            className="px-3 py-1.5 text-xs text-slate-400 border border-[#1e1e2e] rounded hover:bg-[#12121a]"
          >
            ← Back to Trades
          </Link>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setDate(shiftDate(date, -1))}
          className="px-2.5 py-1 text-xs border border-[#1e1e2e] rounded text-slate-300 hover:bg-[#12121a]"
        >
          ◀ Prev
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-[#12121a] border border-[#1e1e2e] rounded px-2 py-1 text-xs text-slate-200 font-mono"
        />
        <button
          onClick={() => setDate(shiftDate(date, 1))}
          className="px-2.5 py-1 text-xs border border-[#1e1e2e] rounded text-slate-300 hover:bg-[#12121a]"
        >
          Next ▶
        </button>
        <button
          onClick={() => setDate(todayKey())}
          className="px-2.5 py-1 text-xs border border-[#1e1e2e] rounded text-slate-300 hover:bg-[#12121a]"
        >
          Today
        </button>
        {!datesWithTrades.has(date) && (
          <span className="text-[11px] text-slate-500 italic ml-2">
            no closed trades on this date
          </span>
        )}
      </div>

      {/* Day stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Trades" value={dayStats.total} />
        <Stat label="Reviewed" value={dayStats.reviewed} color="text-emerald-400" />
        <Stat label="Pending" value={dayStats.pending} color={dayStats.pending > 0 ? "text-amber-400" : "text-slate-400"} />
        <Stat label="Aligned ✓" value={dayStats.aligned} color="text-green-400" />
        <Stat label="Off-plan ✗" value={dayStats.offPlan} color="text-red-400" />
        <Stat
          label="Net P&L (day)"
          value={`${dayStats.totalPnl >= 0 ? "+" : ""}${dayStats.totalPnl.toFixed(2)}`}
          color={dayStats.totalPnl > 0 ? "text-green-400" : dayStats.totalPnl < 0 ? "text-red-400" : "text-slate-300"}
        />
        <Stat
          label="Net P&L (aligned only)"
          value={`${dayStats.alignedPnl >= 0 ? "+" : ""}${dayStats.alignedPnl.toFixed(2)}`}
          color={dayStats.alignedPnl > 0 ? "text-green-400" : dayStats.alignedPnl < 0 ? "text-red-400" : "text-slate-300"}
        />
      </div>

      {/* Trade cards */}
      {dayTrades.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm border border-[#1e1e2e] rounded-xl bg-[#12121a]">
          No closed trades for {date}
        </div>
      ) : (
        <div className="space-y-3">
          {dayTrades.map((t) => {
            const card = cards[t.trade_id] ?? buildState(t);
            return (
              <TradeReviewCard
                key={t.trade_id}
                trade={t}
                card={card}
                onPlanAligned={(v) => setCardField(t.trade_id, "planAligned", v)}
                onPlanNote={(v) => setCardField(t.trade_id, "planNote", v)}
                onEodNote={(v) => setCardField(t.trade_id, "eodNote", v)}
                onSave={() => saveCard(t.trade_id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-[#12121a] rounded-xl p-3 border border-[#1e1e2e]">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function TradeReviewCard({
  trade,
  card,
  onPlanAligned,
  onPlanNote,
  onEodNote,
  onSave,
}: {
  trade: Trade;
  card: TradeCardState;
  onPlanAligned: (v: boolean | null) => void;
  onPlanNote: (v: string) => void;
  onEodNote: (v: string) => void;
  onSave: () => void;
}) {
  const time = trade.entry_time ? trade.entry_time.slice(11, 19) : "--";
  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center flex-wrap gap-x-4 gap-y-2 text-xs">
        <span className="text-slate-500 font-mono">{time}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            trade.strategy.includes("bullish")
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {trade.strategy}
        </span>
        <span className="text-slate-300">{trade.direction}</span>
        <span className={trade.option_type === "CE" ? "text-green-400" : "text-red-400"}>
          {trade.option_type} {trade.strike}
        </span>
        <span className="text-slate-400 font-mono">Qty {trade.quantity}</span>
        <span className="text-slate-400 font-mono">
          {trade.entry_price?.toFixed(2)} → {trade.exit_price?.toFixed(2)}
        </span>
        <span className="text-slate-500 text-[10px]">{trade.exit_reason}</span>
        <span className="ml-auto"><PnlSpan value={trade.realized_pnl} /></span>
        <Link
          href={`/trades/${encodeURIComponent(trade.trade_id)}/chart`}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
        >
          📊 Chart
        </Link>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-400">Plan alignment:</span>
          <PlanToggle value={card.planAligned} onChange={onPlanAligned} />
          <input
            type="text"
            value={card.planNote}
            onChange={(e) => onPlanNote(e.target.value)}
            placeholder="EOD bias tag (e.g. LONG / bullish-div)"
            className="flex-1 min-w-[200px] bg-[#0a0e17] border border-[#1e1e2e] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">EOD analysis</label>
          <textarea
            value={card.eodNote}
            onChange={(e) => onEodNote(e.target.value)}
            rows={4}
            placeholder="What set this up, what played out, what to do differently next time..."
            className="w-full bg-[#0a0e17] border border-[#1e1e2e] rounded px-2 py-1.5 text-sm text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-blue-500/50 resize-y"
          />
        </div>

        {card.error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-2 py-1">
            {card.error}
          </p>
        )}

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-600">
            {card.savedAt ? `Last saved ${card.savedAt}` : "Not yet reviewed"}
            {card.dirty && <span className="text-amber-400 ml-2">• unsaved changes</span>}
          </span>
          <button
            onClick={onSave}
            disabled={card.saving || !card.dirty}
            className="px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {card.saving ? "Saving..." : card.dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}
