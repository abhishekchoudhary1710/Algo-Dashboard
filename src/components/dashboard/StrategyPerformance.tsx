"use client";

import type { RiskMetrics } from "@/lib/api";

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

export default function StrategyPerformance({ metrics }: StrategyPerformanceProps) {
  if (!metrics || !metrics.signals_per_strategy) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
        <p className="text-xs text-slate-400 font-medium mb-2">Strategy Performance</p>
        <p className="text-xs text-slate-500">No data</p>
      </div>
    );
  }

  const entries = Object.entries(metrics.signals_per_strategy);
  const maxCount = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
      <p className="text-xs text-slate-400 font-medium mb-2">Strategy Performance</p>
      <div className="space-y-2">
        {["bullish_swing", "bearish_swing", "bullish_divergence", "bearish_divergence"].map(
          (key) => {
            const count = metrics.signals_per_strategy[key] || 0;
            const pct = (count / maxCount) * 100;
            const color = STRATEGY_COLORS[key] || "#64748b";
            const label = STRATEGY_LABELS[key] || key;

            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-16 flex-shrink-0">
                  {label}
                </span>
                <div className="flex-1 bg-slate-700/50 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                      minWidth: count > 0 ? "4px" : "0",
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-300 font-mono w-6 text-right">
                  {count}
                </span>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
