"use client";

import type { EntrySignal } from "@/lib/api";

interface TimeHeatmapWidgetProps {
  entries: EntrySignal[];
}

const MARKET_HOURS = Array.from({ length: 7 }, (_, i) => i + 9); // 9..15

function heatColor(count: number, max: number): string {
  if (count === 0) return "#1e293b";
  const pct = count / max;
  if (pct >= 0.8) return "#1d4ed8";
  if (pct >= 0.6) return "#2563eb";
  if (pct >= 0.4) return "#3b82f6";
  if (pct >= 0.2) return "#60a5fa";
  return "#93c5fd";
}

export default function TimeHeatmapWidget({ entries }: TimeHeatmapWidgetProps) {
  const hourCounts: Record<number, number> = {};
  for (const e of entries) {
    try {
      const h = new Date(e.timestamp).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    } catch {}
  }

  const maxCount = Math.max(...MARKET_HOURS.map((h) => hourCounts[h] || 0), 1);

  const stratCounts: Record<string, number> = {};
  for (const e of entries) {
    stratCounts[e.strategy] = (stratCounts[e.strategy] || 0) + 1;
  }
  const sortedStrats = Object.entries(stratCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-slate-400 font-medium">Signal Heatmap</span>
        <span className="text-[10px] text-slate-500">{entries.length} signals</span>
      </div>
      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-500">No signals today</p>
        </div>
      ) : (
        <div className="flex-1 p-3 flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* Hourly heatmap */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase mb-1.5">By Hour</p>
            <div className="flex gap-1">
              {MARKET_HOURS.map((h) => {
                const count = hourCounts[h] || 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-slate-400 font-mono">{count > 0 ? count : ""}</span>
                    <div
                      className="w-full rounded transition-colors duration-300"
                      style={{ height: 28, backgroundColor: heatColor(count, maxCount) }}
                      title={`${h}:00–${h + 1}:00 — ${count} signals`}
                    />
                    <span className="text-[8px] text-slate-500">{h}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategy breakdown */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase mb-1.5">By Strategy</p>
            <div className="space-y-1.5">
              {sortedStrats.map(([strat, count]) => (
                <div key={strat} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-28 truncate flex-shrink-0">
                    {strat}
                  </span>
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(count / entries.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-300 font-mono w-4 text-right flex-shrink-0">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
