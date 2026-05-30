"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { fetchAPI, patchAPI } from "@/lib/api";
import type {
  TradeSummary,
  Trade,
  TradesHistoryResponse,
  TradeReviewPatch,
  TradeReviewResponse,
} from "@/lib/api";
import Explainable from "@/components/Explainable";

type ReviewFilter = "all" | "aligned" | "off_plan" | "pending";

function PnlBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-slate-500">--</span>;
  const color = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  const prefix = value > 0 ? "+" : "";
  return <span className={`font-mono font-medium ${color}`}>{prefix}{value.toFixed(2)}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    PARTIAL: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    CLOSED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
    REJECTED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[status] || "bg-slate-700 text-slate-400"}`}>
      {status}
    </span>
  );
}

function ExitBadge({ reason }: { reason: string | null }) {
  if (!reason) return null;
  const colors: Record<string, string> = {
    TARGET_HIT: "text-green-400",
    SL_HIT: "text-red-400",
    MANUAL: "text-yellow-400",
    MARKET_CLOSE: "text-slate-400",
  };
  return <span className={`text-[10px] font-medium ${colors[reason] || "text-slate-400"}`}>{reason}</span>;
}

function PlanAlignedToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null | undefined;
  onChange: (next: boolean | null) => void;
  disabled?: boolean;
}) {
  // Tri-state cycle: null → true → false → null
  const next = value == null ? true : value === true ? false : null;
  const label = value == null ? "—" : value ? "✓" : "✗";
  const color =
    value == null
      ? "text-slate-500 border-slate-700 hover:border-slate-500"
      : value
      ? "text-green-400 border-green-500/40 bg-green-500/10 hover:bg-green-500/20"
      : "text-red-400 border-red-500/40 bg-red-500/10 hover:bg-red-500/20";
  const title =
    value == null
      ? "Not reviewed — click to mark as plan-aligned"
      : value
      ? "Aligned with EOD plan — click to mark off-plan"
      : "Off-plan — click to clear";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(next)}
      title={title}
      className={`w-7 h-7 inline-flex items-center justify-center text-xs font-mono font-bold rounded border transition-colors disabled:opacity-50 ${color}`}
    >
      {label}
    </button>
  );
}

function NoteEditorModal({
  trade,
  onClose,
  onSaved,
}: {
  trade: Trade;
  onClose: () => void;
  onSaved: (updated: Trade) => void;
}) {
  const [eodNote, setEodNote] = useState(trade.eod_note ?? "");
  const [planNote, setPlanNote] = useState(trade.plan_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: TradeReviewPatch = {
        eod_note: eodNote.trim() === "" ? null : eodNote,
        plan_note: planNote.trim() === "" ? null : planNote,
      };
      const res = await patchAPI<TradeReviewResponse>(
        `/api/trades/${encodeURIComponent(trade.trade_id)}/review`,
        body,
      );
      if (res.status !== "ok" || !res.trade) {
        throw new Error(res.error || "Save failed");
      }
      onSaved(res.trade);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#12121a] border border-[#1e1e2e] rounded-xl shadow-2xl w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[#1e1e2e] flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">EOD Review</p>
            <p className="text-xs text-slate-500 font-mono">{trade.trade_id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div><span className="text-slate-500">Strategy:</span> <span className="text-slate-200">{trade.strategy}</span></div>
            <div><span className="text-slate-500">P&amp;L:</span> <PnlBadge value={trade.realized_pnl} /></div>
            <div><span className="text-slate-500">Entry:</span> <span className="font-mono text-slate-200">{trade.entry_price?.toFixed(2) ?? "--"}</span></div>
            <div><span className="text-slate-500">Exit:</span> <span className="font-mono text-slate-200">{trade.exit_price?.toFixed(2) ?? "--"}</span></div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Plan tag <span className="text-slate-600">(e.g. &ldquo;LONG / bullish-div&rdquo;)</span>
            </label>
            <input
              type="text"
              value={planNote}
              onChange={(e) => setPlanNote(e.target.value)}
              placeholder="Short EOD bias tag"
              className="w-full bg-[#0a0e17] border border-[#1e1e2e] rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">EOD analysis notes</label>
            <textarea
              value={eodNote}
              onChange={(e) => setEodNote(e.target.value)}
              rows={8}
              placeholder="What happened, why, what to do differently..."
              className="w-full bg-[#0a0e17] border border-[#1e1e2e] rounded px-2 py-1.5 text-sm text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-blue-500/50 resize-y"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-2 py-1">
              {error}
            </p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#1e1e2e] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-slate-300 hover:bg-[#1a1a24] rounded border border-[#1e1e2e]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded hover:bg-blue-500/30 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function applyReviewFilter(trades: Trade[], filter: ReviewFilter): Trade[] {
  if (filter === "all") return trades;
  if (filter === "aligned") return trades.filter((t) => t.plan_aligned === true);
  if (filter === "off_plan") return trades.filter((t) => t.plan_aligned === false);
  // pending = closed-and-not-yet-reviewed
  return trades.filter((t) => t.status === "CLOSED" && t.plan_aligned == null && !t.eod_note);
}

export default function TradesPage() {
  const [summary, setSummary] = useState<TradeSummary | null>(null);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  // Hold an in-flight edit lock to suppress auto-refresh stomping over local state
  const editingRef = useRef<string | null>(null);

  const recomputeSummary = useCallback((trades: Trade[]) => {
    const realTrades = trades.filter((t) => t.execution_status !== "REJECTED");
    const closed = realTrades.filter((t) => t.status === "CLOSED");
    const winners = closed.filter((t) => (t.realized_pnl ?? 0) > 0);
    const losers = closed.filter((t) => (t.realized_pnl ?? 0) <= 0);
    const totalPnl = closed.reduce((sum, t) => sum + (t.realized_pnl ?? 0), 0);
    const pnls = closed.map((t) => t.realized_pnl ?? 0);
    return {
      date: "Filtered",
      total_trades: realTrades.length,
      open_trades: realTrades.filter((t) => t.status === "OPEN" || t.status === "PARTIAL").length,
      closed_trades: closed.length,
      total_pnl: totalPnl,
      winners: winners.length,
      losers: losers.length,
      win_rate: closed.length > 0 ? Math.round((winners.length / closed.length) * 1000) / 10 : 0,
      best_trade: pnls.length > 0 ? Math.max(...pnls) : 0,
      worst_trade: pnls.length > 0 ? Math.min(...pnls) : 0,
      trades: [],
    } satisfies TradeSummary;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const historyData = await fetchAPI<TradesHistoryResponse>("/api/trades/history?days=90");
      const trades = historyData.trades;
      setAllTrades((prev) => {
        // Preserve local optimistic state for the row currently being edited
        if (!editingRef.current) return trades;
        const editingId = editingRef.current;
        const prevRow = prev.find((t) => t.trade_id === editingId);
        if (!prevRow) return trades;
        return trades.map((t) => (t.trade_id === editingId ? { ...t, ...pickReview(prevRow) } : t));
      });
      setRejectedCount(trades.filter((t) => t.execution_status === "REJECTED").length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Recompute summary whenever data or filter changes
  useEffect(() => {
    const filtered = applyReviewFilter(allTrades, filter);
    setSummary(recomputeSummary(filtered));
  }, [allTrades, filter, recomputeSummary]);

  const handleReviewPatch = useCallback(
    async (tradeId: string, patch: TradeReviewPatch) => {
      // Optimistic update — apply locally first, then PATCH
      editingRef.current = tradeId;
      setAllTrades((prev) =>
        prev.map((t) => (t.trade_id === tradeId ? { ...t, ...patch } : t)),
      );
      try {
        const res = await patchAPI<TradeReviewResponse>(
          `/api/trades/${encodeURIComponent(tradeId)}/review`,
          patch,
        );
        if (res.status === "ok" && res.trade) {
          setAllTrades((prev) =>
            prev.map((t) => (t.trade_id === tradeId ? { ...t, ...pickReview(res.trade!) } : t)),
          );
        }
      } catch (e) {
        // Refetch on failure to undo optimistic state
        await fetchData();
        // surface a small error toast via banner state
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        editingRef.current = null;
      }
    },
    [fetchData],
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
          <p className="text-red-500/60 text-xs mt-1">
            Ensure the bot is running with DB_ENABLED=true
          </p>
        </div>
      </div>
    );
  }

  const filteredTrades = applyReviewFilter(allTrades, filter);
  const rejectedTrades = filteredTrades.filter((t) => t.execution_status === "REJECTED");
  const openTrades = filteredTrades.filter(
    (t) => (t.status === "OPEN" || t.status === "PARTIAL") && t.execution_status !== "REJECTED",
  );
  const closedTrades = filteredTrades.filter(
    (t) => t.status === "CLOSED" && t.execution_status !== "REJECTED",
  );
  const pendingReviewCount = allTrades.filter(
    (t) => t.status === "CLOSED" && t.plan_aligned == null && !t.eod_note,
  ).length;

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 bg-[#0a0e17] min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white">Trade Lifecycle</h1>
          <p className="text-xs text-slate-500">{summary?.date || "All trades"} | Auto-refresh 10s</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/trades/review"
            className="px-3 py-1.5 text-xs font-medium rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
            title="Walk through trades that still need an EOD note"
          >
            📓 EOD Review
            {pendingReviewCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500/30 text-amber-300 rounded">
                {pendingReviewCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Review filter */}
      <div className="flex items-center gap-1 flex-wrap text-xs">
        <span className="text-slate-500 mr-1">View:</span>
        {([
          ["all", "All", allTrades.length],
          ["aligned", "Plan-aligned ✓", allTrades.filter((t) => t.plan_aligned === true).length],
          ["off_plan", "Off-plan ✗", allTrades.filter((t) => t.plan_aligned === false).length],
          ["pending", "Pending review", pendingReviewCount],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2.5 py-1 rounded border transition-colors ${
              filter === key
                ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                : "text-slate-400 border-[#1e1e2e] hover:border-slate-600 hover:bg-[#12121a]"
            }`}
          >
            {label} <span className="text-slate-500">({count})</span>
          </button>
        ))}
      </div>

      {error && allTrades.length > 0 && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-2 py-1">
          {error}
        </p>
      )}

      {/* Summary Cards (recomputed on filtered subset) */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Explainable title="Total Trades" explanation="Total number of trades (both open and closed) in the current filter.">
            <SummaryCard label="Total Trades" value={summary.total_trades} />
          </Explainable>
          <Explainable title="Open Trades" explanation="Trades currently open/active in the current filter.">
            <SummaryCard label="Open" value={summary.open_trades} color="text-blue-400" />
          </Explainable>
          <Explainable title="Closed Trades" explanation="Trades that have been fully exited in the current filter.">
            <SummaryCard label="Closed" value={summary.closed_trades} />
          </Explainable>
          <Explainable
            title="Net P&L (filtered)"
            explanation="Sum of realized P&L over the currently selected filter. Use 'Plan-aligned' to see only trades that matched your EOD bias plan."
          >
            <SummaryCard
              label="Net P&L"
              value={summary.total_pnl === 0 ? "0.00" : `${summary.total_pnl > 0 ? "+" : ""}${summary.total_pnl.toFixed(2)}`}
              color={summary.total_pnl > 0 ? "text-green-400" : summary.total_pnl < 0 ? "text-red-400" : "text-slate-300"}
            />
          </Explainable>
          <Explainable title="Win Rate" explanation="Winners ÷ closed in the current filter.">
            <SummaryCard
              label="Win Rate"
              value={`${summary.win_rate}%`}
              color={summary.win_rate >= 60 ? "text-green-400" : summary.win_rate >= 40 ? "text-yellow-400" : "text-red-400"}
            />
          </Explainable>
          <Explainable title="Winners" explanation="Closed trades with positive P&L in the current filter.">
            <SummaryCard label="Winners" value={summary.winners} color="text-green-400" />
          </Explainable>
          <Explainable title="Losers" explanation="Closed trades with non-positive P&L in the current filter.">
            <SummaryCard label="Losers" value={summary.losers} color="text-red-400" />
          </Explainable>
          {rejectedCount > 0 && filter === "all" && (
            <Explainable title="Rejected" explanation="Orders rejected by broker — tracked as virtual/paper trades for analysis.">
              <SummaryCard label="Rejected" value={rejectedCount} color="text-orange-400" />
            </Explainable>
          )}
          <Explainable title="Best / Worst Trade" explanation="Best and worst single-trade P&L in the current filter.">
            <SummaryCard
              label="Best / Worst"
              value={`${summary.best_trade > 0 ? "+" : ""}${summary.best_trade.toFixed(0)} / ${summary.worst_trade.toFixed(0)}`}
              color="text-slate-300"
              small
            />
          </Explainable>
        </div>
      )}

      {/* Open Trades */}
      {openTrades.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-blue-500/30 overflow-hidden">
          <div className="px-4 py-2 border-b border-[#1e1e2e] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-sm font-medium text-blue-400">Open Trades</p>
          </div>
          <TradeTable
            trades={openTrades}
            showExit={false}
            onPlanToggle={(id, next) => handleReviewPatch(id, { plan_aligned: next })}
            onEdit={setEditingTrade}
          />
        </div>
      )}

      {/* Rejected / Virtual Trades */}
      {rejectedTrades.length > 0 && (
        <div className="bg-[#12121a] rounded-xl border border-orange-500/30 overflow-hidden">
          <div className="px-4 py-2 border-b border-[#1e1e2e] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <p className="text-sm font-medium text-orange-400">
              Rejected / Virtual Trades
              <span className="text-xs text-slate-500 ml-2">
                (broker rejected — tracked as paper)
              </span>
            </p>
          </div>
          <TradeTable
            trades={rejectedTrades}
            showExit={rejectedTrades.some((t) => t.status === "CLOSED")}
            onPlanToggle={(id, next) => handleReviewPatch(id, { plan_aligned: next })}
            onEdit={setEditingTrade}
          />
        </div>
      )}

      {/* Closed Trades */}
      <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1e1e2e]">
          <p className="text-sm font-medium text-slate-400">Closed Trades</p>
        </div>
        {closedTrades.length > 0 ? (
          <TradeTable
            trades={closedTrades}
            showExit
            onPlanToggle={(id, next) => handleReviewPatch(id, { plan_aligned: next })}
            onEdit={setEditingTrade}
          />
        ) : (
          <div className="p-6 text-center text-slate-500 text-sm">
            No closed trades in this filter
          </div>
        )}
      </div>

      {editingTrade && (
        <NoteEditorModal
          trade={editingTrade}
          onClose={() => setEditingTrade(null)}
          onSaved={(updated) => {
            setAllTrades((prev) =>
              prev.map((t) => (t.trade_id === updated.trade_id ? { ...t, ...pickReview(updated) } : t)),
            );
          }}
        />
      )}
    </div>
  );
}

function pickReview(t: Trade) {
  return {
    plan_aligned: t.plan_aligned,
    plan_note: t.plan_note,
    eod_note: t.eod_note,
    eod_reviewed_at: t.eod_reviewed_at,
  };
}

function SummaryCard({
  label,
  value,
  color = "text-white",
  small = false,
}: {
  label: string;
  value: string | number;
  color?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-[#12121a] rounded-xl p-3 border border-[#1e1e2e]">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`${small ? "text-sm" : "text-xl"} font-bold mt-0.5 ${color}`}>
        {value}
      </p>
    </div>
  );
}

function TradeTable({
  trades,
  showExit,
  onPlanToggle,
  onEdit,
}: {
  trades: Trade[];
  showExit: boolean;
  onPlanToggle: (tradeId: string, next: boolean | null) => void;
  onEdit: (trade: Trade) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1e1e2e] text-left">
            <th className="px-3 py-2 text-slate-400 font-medium">Date</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Time</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Strategy</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Direction</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Type</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Strike</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Qty</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Entry</th>
            {showExit && (
              <>
                <th className="px-3 py-2 text-slate-400 font-medium">Exit</th>
                <th className="px-3 py-2 text-slate-400 font-medium">Reason</th>
                <th className="px-3 py-2 text-slate-400 font-medium">P&L</th>
              </>
            )}
            <th className="px-3 py-2 text-slate-400 font-medium">Status</th>
            <th className="px-3 py-2 text-slate-400 font-medium" title="Aligned with your EOD bias plan?">Plan</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Note</th>
            <th className="px-3 py-2 text-slate-400 font-medium">Chart</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const noteSnippet = (trade.eod_note ?? "").trim();
            const hasNote = noteSnippet.length > 0;
            return (
              <tr
                key={trade.trade_id}
                className={`border-b border-[#1e1e2e]/50 hover:bg-[#1a1a24] ${
                  trade.realized_pnl !== null && trade.realized_pnl > 0
                    ? "bg-green-500/5"
                    : trade.realized_pnl !== null && trade.realized_pnl < 0
                    ? "bg-red-500/5"
                    : ""
                }`}
              >
                <td className="px-3 py-2 text-slate-300 font-mono">
                  {trade.entry_time ? trade.entry_time.slice(0, 10) : "--"}
                </td>
                <td className="px-3 py-2 text-slate-300 font-mono">
                  {trade.entry_time ? trade.entry_time.slice(11, 19) : "--"}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    trade.strategy.includes("bullish")
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {trade.strategy}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-300">{trade.direction}</td>
                <td className="px-3 py-2">
                  <span className={trade.option_type === "CE" ? "text-green-400" : "text-red-400"}>
                    {trade.option_type || "--"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-300 font-mono">
                  {trade.strike ?? "--"}
                </td>
                <td className="px-3 py-2 text-slate-300 font-mono">
                  {trade.quantity ?? "--"}
                </td>
                <td className="px-3 py-2 text-slate-300 font-mono">
                  {trade.entry_price?.toFixed(2) ?? "--"}
                </td>
                {showExit && (
                  <>
                    <td className="px-3 py-2 text-slate-300 font-mono">
                      {trade.exit_price?.toFixed(2) ?? "--"}
                    </td>
                    <td className="px-3 py-2">
                      <ExitBadge reason={trade.exit_reason} />
                    </td>
                    <td className="px-3 py-2">
                      <PnlBadge value={trade.realized_pnl} />
                    </td>
                  </>
                )}
                <td className="px-3 py-2">
                  <StatusBadge status={trade.status} />
                </td>
                <td className="px-3 py-2">
                  <PlanAlignedToggle
                    value={trade.plan_aligned}
                    onChange={(next) => onPlanToggle(trade.trade_id, next)}
                  />
                </td>
                <td className="px-3 py-2 max-w-[260px]">
                  <button
                    onClick={() => onEdit(trade)}
                    className={`text-left w-full text-[11px] truncate hover:underline ${
                      hasNote ? "text-slate-300" : "text-slate-600 italic"
                    }`}
                    title={hasNote ? noteSnippet : "Add EOD note"}
                  >
                    {hasNote ? noteSnippet : "+ add note"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/trades/${encodeURIComponent(trade.trade_id)}/chart`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                    title="Open chart view"
                  >
                    📊 Chart
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
