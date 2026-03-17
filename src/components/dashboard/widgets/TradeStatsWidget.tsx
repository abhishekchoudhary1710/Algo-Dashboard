"use client";

import type { TradeExcursion } from "@/lib/api";

interface TradeStatsWidgetProps {
  excursions: TradeExcursion[];
}

export default function TradeStatsWidget({ excursions }: TradeStatsWidgetProps) {
  const total = excursions.length;
  const slHits = excursions.filter((t) => t.option_sl_hit).length;
  const targetHits = excursions.filter((t) => t.option_target_hit).length;
  const tracking = excursions.filter((t) => t.status === "TRACKING").length;
  const positive = excursions.filter((t) => t.is_positive).length;

  const avgOptRR =
    total > 0
      ? (excursions.reduce((s, t) => s + t.option_rr_achieved, 0) / total).toFixed(2)
      : "0.00";
  const avgSpotRR =
    total > 0
      ? (excursions.reduce((s, t) => s + t.spot_rr_achieved, 0) / total).toFixed(2)
      : "0.00";

  const winRate = slHits + targetHits > 0
    ? ((targetHits / (targetHits + slHits)) * 100).toFixed(0)
    : "—";

  const stats = [
    { label: "Total Trades", value: total, color: "text-white" },
    { label: "Win Rate", value: winRate === "—" ? "—" : `${winRate}%`, color: winRate !== "—" && +winRate >= 50 ? "text-green-400" : "text-yellow-400" },
    { label: "SL Hits", value: slHits, color: "text-red-400" },
    { label: "Target Hits", value: targetHits, color: "text-green-400" },
    { label: "Live", value: tracking, color: "text-blue-400" },
    { label: "1:4+ Trades", value: positive, color: "text-yellow-400" },
    { label: "Avg Opt R:R", value: `${avgOptRR}x`, color: "text-purple-400" },
    { label: "Avg Spot R:R", value: `${avgSpotRR}x`, color: "text-cyan-400" },
  ];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-slate-400 font-medium">Trade Stats (Today)</span>
        <span className="text-[10px] text-slate-500">{total} trades</span>
      </div>
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-500">No trades today</p>
        </div>
      ) : (
        <div className="flex-1 p-2 grid grid-cols-2 gap-2 content-start overflow-y-auto">
          {stats.map((s) => (
            <div key={s.label} className="bg-slate-700/40 rounded p-2">
              <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">
                {s.label}
              </p>
              <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
