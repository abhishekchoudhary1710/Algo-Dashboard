"use client";

import type { TradeExcursion } from "@/lib/api";

interface RRDistributionWidgetProps {
  excursions: TradeExcursion[];
}

const BUCKETS = [
  { label: "<0", min: -Infinity, max: 0, color: "#dc2626" },
  { label: "0–0.5", min: 0, max: 0.5, color: "#ef4444" },
  { label: "0.5–1", min: 0.5, max: 1, color: "#f97316" },
  { label: "1–2", min: 1, max: 2, color: "#eab308" },
  { label: "2–4", min: 2, max: 4, color: "#84cc16" },
  { label: "4+", min: 4, max: Infinity, color: "#22c55e" },
];

export default function RRDistributionWidget({ excursions }: RRDistributionWidgetProps) {
  const counts = BUCKETS.map((b) => ({
    ...b,
    count: excursions.filter(
      (t) => t.option_rr_achieved >= b.min && t.option_rr_achieved < b.max
    ).length,
  }));

  const maxCount = Math.max(...counts.map((b) => b.count), 1);
  const slHits = excursions.filter((t) => t.option_sl_hit).length;
  const targetHits = excursions.filter((t) => t.option_target_hit).length;
  const tracking = excursions.filter((t) => t.status === "TRACKING").length;
  const avgRR =
    excursions.length > 0
      ? (
          excursions.reduce((s, t) => s + t.option_rr_achieved, 0) /
          excursions.length
        ).toFixed(2)
      : "0.00";

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-slate-400 font-medium">R:R Distribution</span>
        <span className="text-[10px] text-slate-400 font-mono">
          Avg: <span className="text-white font-bold">{avgRR}x</span>
        </span>
      </div>
      {excursions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-500">No trades today</p>
        </div>
      ) : (
        <div className="flex-1 p-3 flex flex-col gap-3 min-h-0">
          {/* Bar chart */}
          <div className="flex items-end gap-1.5 flex-1">
            {counts.map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-slate-400 font-mono">
                  {b.count > 0 ? b.count : ""}
                </span>
                <div className="w-full relative" style={{ height: 72 }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t transition-all duration-500"
                    style={{
                      height: `${(b.count / maxCount) * 100}%`,
                      backgroundColor: b.color,
                      opacity: b.count === 0 ? 0.15 : 1,
                      minHeight: b.count > 0 ? 4 : 0,
                    }}
                  />
                </div>
                <span className="text-[8px] text-slate-500 text-center leading-tight">
                  {b.label}x
                </span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-1.5 flex-shrink-0">
            {[
              { label: "SL Hits", value: slHits, color: "text-red-400" },
              { label: "Targets", value: targetHits, color: "text-green-400" },
              { label: "Live", value: tracking, color: "text-blue-400" },
              { label: "Total", value: excursions.length, color: "text-white" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-700/50 rounded p-1.5 text-center">
                <p className="text-[9px] text-slate-400 uppercase">{s.label}</p>
                <p className={`text-base font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
