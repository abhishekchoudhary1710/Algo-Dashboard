"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import type { RiskMetrics, TradesPerformanceResponse, StrategyPerformanceRow } from "@/lib/api";

interface StrategyPerformanceProps {
  metrics: RiskMetrics | null;
}

const STRATEGY_COLORS: Record<string, string> = {
  bullish_swing: "#22c55e",
  bearish_swing: "#ef4444",
  bullish_divergence: "#3b82f6",
  bearish_divergence: "#a855f7",
};

const STRATEGY_LABELS: Record<string, string> = {
  bullish_swing: "Bull Swing",
  bearish_swing: "Bear Swing",
  bullish_divergence: "Bull Div",
  bearish_divergence: "Bear Div",
};

const ALL_STRATEGIES = ["bullish_swing", "bearish_swing", "bullish_divergence", "bearish_divergence"];

function emptyRow(strategy: string): StrategyPerformanceRow {
  return { strategy, total: 0, wins: 0, losses: 0, sl_hits: 0, target_hits: 0, timeout_exits: 0, avg_rr: null, net_pnl: 0 };
}

export default function StrategyPerformance({ metrics }: StrategyPerformanceProps) {
  const [rows, setRows] = useState<StrategyPerformanceRow[]>([]);
  const [source, setSource] = useState<string>("none");

  const fetchPerformance = useCallback(async () => {
    try {
      const data = await fetchAPI<TradesPerformanceResponse>("/api/trades/performance");
      setSource(data.source);
      if (Array.isArray(data.strategies)) {
        // DB source: array of rows
        const mapped = ALL_STRATEGIES.map((key) => {
          const found = data.strategies.find((r) => r.strategy === key);
          return found ?? emptyRow(key);
        });
        setRows(mapped);
      } else {
        // Signal fallback: object keyed by strategy name
        const obj = data.strategies as unknown as Record<string, StrategyPerformanceRow>;
        const mapped = ALL_STRATEGIES.map((key) => obj[key] ?? emptyRow(key));
        setRows(mapped);
      }
    } catch {
      // Fallback to metrics.signals_per_strategy
      if (metrics?.signals_per_strategy) {
        setSource("metrics");
        setRows(
          ALL_STRATEGIES.map((key) => ({
            ...emptyRow(key),
            total: metrics.signals_per_strategy[key] || 0,
          }))
        );
      }
    }
  }, [metrics]);

  useEffect(() => {
    fetchPerformance();
    const interval = setInterval(fetchPerformance, 30000);
    return () => clearInterval(interval);
  }, [fetchPerformance]);

  const totalPnl = rows.reduce((s, r) => s + r.net_pnl, 0);

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
          Strategy Performance
        </span>
        <span
          className={`text-sm font-mono font-bold ${
            totalPnl > 0 ? "text-emerald-400" : totalPnl < 0 ? "text-red-400" : "text-slate-400"
          }`}
        >
          {totalPnl > 0 ? "+" : ""}
          {totalPnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-[#1e1e2e]">
              <th className="text-left py-1.5 pr-2 font-medium">Strategy</th>
              <th className="text-right py-1.5 px-1 font-medium">Trades</th>
              <th className="text-right py-1.5 px-1 font-medium">W</th>
              <th className="text-right py-1.5 px-1 font-medium">L</th>
              <th className="text-right py-1.5 px-1 font-medium">SL</th>
              <th className="text-right py-1.5 px-1 font-medium">TGT</th>
              <th className="text-right py-1.5 px-1 font-medium">TMO</th>
              <th className="text-right py-1.5 px-1 font-medium">Avg RR</th>
              <th className="text-right py-1.5 font-medium">PnL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const label = STRATEGY_LABELS[r.strategy] || r.strategy;
              const color = STRATEGY_COLORS[r.strategy] || "#64748b";
              const winRate = r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0;

              return (
                <tr
                  key={r.strategy}
                  className="border-b border-[#1e1e2e]/50 last:border-0 hover:bg-[#1a1a24] transition-colors"
                >
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-medium text-slate-300">{label}</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-1">
                    <span className="text-xs font-mono text-slate-200">{r.total}</span>
                  </td>
                  <td className="text-right py-2 px-1">
                    <span className="text-xs font-mono text-emerald-400">{r.wins}</span>
                  </td>
                  <td className="text-right py-2 px-1">
                    <span className="text-xs font-mono text-red-400">{r.losses}</span>
                  </td>
                  <td className="text-right py-2 px-1">
                    <span className="text-xs font-mono text-red-400/70">{r.sl_hits}</span>
                  </td>
                  <td className="text-right py-2 px-1">
                    <span className="text-xs font-mono text-emerald-400/70">{r.target_hits}</span>
                  </td>
                  <td className="text-right py-2 px-1">
                    <span className="text-xs font-mono text-slate-500">{r.timeout_exits}</span>
                  </td>
                  <td className="text-right py-2 px-1">
                    <span
                      className={`text-xs font-mono font-bold ${
                        r.avg_rr != null && r.avg_rr >= 1.5
                          ? "text-emerald-400"
                          : r.avg_rr != null && r.avg_rr >= 1.0
                          ? "text-yellow-400"
                          : "text-slate-500"
                      }`}
                    >
                      {r.avg_rr != null ? r.avg_rr.toFixed(1) : "\u2014"}
                    </span>
                  </td>
                  <td className="text-right py-2">
                    <span
                      className={`text-xs font-mono font-bold ${
                        r.net_pnl > 0
                          ? "text-emerald-400"
                          : r.net_pnl < 0
                          ? "text-red-400"
                          : "text-slate-500"
                      }`}
                    >
                      {r.net_pnl > 0 ? "+" : ""}
                      {r.net_pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: source + totals */}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#1e1e2e] text-[10px] text-slate-600">
        <span>
          Source: <span className="text-slate-500 font-mono">{source}</span>
        </span>
        <span>
          Total trades:{" "}
          <span className="text-slate-400 font-mono font-bold">
            {rows.reduce((s, r) => s + r.total, 0)}
          </span>
        </span>
      </div>
    </div>
  );
}
