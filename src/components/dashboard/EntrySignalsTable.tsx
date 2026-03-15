"use client";

import type { EntrySignal } from "@/lib/api";

interface EntrySignalsTableProps {
  entries: EntrySignal[];
}

const STRATEGY_BADGE: Record<string, string> = {
  bullish_swing: "bg-green-900/40 text-green-400",
  bearish_swing: "bg-red-900/40 text-red-400",
  bullish_divergence: "bg-blue-900/40 text-blue-400",
  bearish_divergence: "bg-purple-900/40 text-purple-400",
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    const match = ts.match(/(\d{2}:\d{2})/);
    return match ? match[1] : ts;
  }
}

export default function EntrySignalsTable({ entries }: EntrySignalsTableProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Entry Signals</span>
        <span className="text-[10px] text-slate-500">{entries.length} today</span>
      </div>
      <div className="overflow-x-auto max-h-48 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No signals today</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-700 sticky top-0 bg-slate-800">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Time</th>
                <th className="px-2 py-1.5 text-left font-medium">Strategy</th>
                <th className="px-2 py-1.5 text-right font-medium">Entry</th>
                <th className="px-2 py-1.5 text-right font-medium">SL</th>
                <th className="px-2 py-1.5 text-right font-medium">Target</th>
                <th className="px-2 py-1.5 text-right font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const badge = STRATEGY_BADGE[e.strategy] || "bg-slate-700 text-slate-300";
                return (
                  <tr
                    key={i}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30"
                  >
                    <td className="px-2 py-1.5 text-slate-300 font-mono">
                      {formatTime(e.timestamp)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${badge}`}>
                        {e.strategy.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-200 font-mono">
                      {Number(e.entry_price).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-red-400 font-mono">
                      {Number(e.stop_loss).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-green-400 font-mono">
                      {Number(e.target).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-yellow-400 font-mono">
                      {Number(e.risk).toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
