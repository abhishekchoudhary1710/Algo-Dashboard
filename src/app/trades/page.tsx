"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import type { TradeSummary, Trade, TradesResponse } from "@/lib/api";

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

export default function TradesPage() {
  const [summary, setSummary] = useState<TradeSummary | null>(null);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, tradesData] = await Promise.all([
        fetchAPI<TradeSummary>("/api/trades/summary"),
        fetchAPI<TradesResponse>("/api/trades/today"),
      ]);
      setSummary(summaryData);
      setAllTrades(tradesData.trades);
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-slate-400 animate-pulse">Loading trades...</p>
      </div>
    );
  }

  if (error) {
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

  return (
    <div className="p-6 space-y-6 bg-[#0a0e17] min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Trade Lifecycle</h1>
        <p className="text-xs text-slate-500">{summary?.date || "Today"} | Auto-refresh 10s</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <SummaryCard label="Total Trades" value={summary.total_trades} />
          <SummaryCard label="Open" value={summary.open_trades} color="text-blue-400" />
          <SummaryCard label="Closed" value={summary.closed_trades} />
          <SummaryCard
            label="Total P&L"
            value={summary.total_pnl === 0 ? "0.00" : `${summary.total_pnl > 0 ? "+" : ""}${summary.total_pnl.toFixed(2)}`}
            color={summary.total_pnl > 0 ? "text-green-400" : summary.total_pnl < 0 ? "text-red-400" : "text-slate-300"}
          />
          <SummaryCard
            label="Win Rate"
            value={`${summary.win_rate}%`}
            color={summary.win_rate >= 60 ? "text-green-400" : summary.win_rate >= 40 ? "text-yellow-400" : "text-red-400"}
          />
          <SummaryCard label="Winners" value={summary.winners} color="text-green-400" />
          <SummaryCard label="Losers" value={summary.losers} color="text-red-400" />
          <SummaryCard
            label="Best / Worst"
            value={`${summary.best_trade > 0 ? "+" : ""}${summary.best_trade.toFixed(0)} / ${summary.worst_trade.toFixed(0)}`}
            color="text-slate-300"
            small
          />
        </div>
      )}

      {/* Open Trades */}
      {allTrades.filter(t => t.status === "OPEN" || t.status === "PARTIAL").length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-blue-500/30 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-sm font-medium text-blue-400">Open Trades</p>
          </div>
          <TradeTable
            trades={allTrades.filter(t => t.status === "OPEN" || t.status === "PARTIAL")}
            showExit={false}
          />
        </div>
      )}

      {/* Closed Trades */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700">
          <p className="text-sm font-medium text-slate-400">Closed Trades</p>
        </div>
        {allTrades.filter(t => t.status === "CLOSED").length > 0 ? (
          <TradeTable
            trades={allTrades.filter(t => t.status === "CLOSED")}
            showExit
          />
        ) : (
          <div className="p-6 text-center text-slate-500 text-sm">
            No closed trades today
          </div>
        )}
      </div>
    </div>
  );
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
    <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`${small ? "text-sm" : "text-xl"} font-bold mt-0.5 ${color}`}>
        {value}
      </p>
    </div>
  );
}

function TradeTable({ trades, showExit }: { trades: Trade[]; showExit: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700 text-left">
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
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.trade_id}
              className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${
                trade.realized_pnl !== null && trade.realized_pnl > 0
                  ? "bg-green-500/5"
                  : trade.realized_pnl !== null && trade.realized_pnl < 0
                  ? "bg-red-500/5"
                  : ""
              }`}
            >
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
