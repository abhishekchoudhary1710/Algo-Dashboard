"use client";

import type { TradeExcursion } from "@/lib/api";

interface TradeExcursionPanelProps {
  excursions: TradeExcursion[];
}

function rrColor(rr: number): string {
  if (rr >= 4.0) return "text-green-400";
  if (rr >= 1.0) return "text-yellow-400";
  return "text-red-400";
}

function rrBgColor(rr: number): string {
  if (rr >= 4.0) return "bg-green-900/30";
  if (rr >= 1.0) return "bg-yellow-900/30";
  return "bg-red-900/30";
}

function strategyBadge(strategy: string): string {
  const s = strategy.toLowerCase();
  if (s.includes("bullish")) return "bg-green-900/30 text-green-400";
  if (s.includes("bearish")) return "bg-red-900/30 text-red-400";
  return "bg-blue-900/30 text-blue-400";
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

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

function statusBadge(status: string): string {
  switch (status) {
    case "TRACKING":
      return "bg-blue-900/50 text-blue-400";
    case "OPTION_SL_HIT":
      return "bg-red-900/50 text-red-400";
    case "OPTION_TARGET_HIT":
      return "bg-green-900/50 text-green-400";
    case "CLOSED":
      return "bg-slate-700 text-slate-300";
    default:
      return "bg-slate-700 text-slate-300";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "TRACKING":
      return "LIVE";
    case "OPTION_SL_HIT":
      return "SL HIT";
    case "OPTION_TARGET_HIT":
      return "TGT HIT";
    case "CLOSED":
      return "CLOSED";
    default:
      return status;
  }
}

export default function TradeExcursionPanel({
  excursions,
}: TradeExcursionPanelProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">
          Trade Excursions
        </span>
        <span className="text-[10px] text-slate-500">
          {excursions.length} trade{excursions.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        {excursions.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            No active trades
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-700 sticky top-0 bg-slate-800">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Time</th>
                <th className="px-2 py-1.5 text-left font-medium">Option</th>
                <th className="px-2 py-1.5 text-left font-medium">Strategy</th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Duration
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Spot R:R
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Opt R:R
                </th>
                <th className="px-2 py-1.5 text-center font-medium">
                  Spot SL
                </th>
                <th className="px-2 py-1.5 text-center font-medium">
                  Opt SL
                </th>
                <th className="px-2 py-1.5 text-center font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {excursions.map((t) => (
                <tr
                  key={t.order_id}
                  className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${
                    t.is_positive
                      ? "ring-1 ring-inset ring-green-500/30 bg-green-900/10"
                      : ""
                  }`}
                >
                  <td className="px-2 py-1.5 text-slate-300 font-mono">
                    {formatTime(t.timestamp)}
                  </td>
                  <td className="px-2 py-1.5 text-slate-200 font-mono text-[10px]">
                    {t.option_display_name}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] font-medium ${strategyBadge(
                        t.strategy
                      )}`}
                    >
                      {t.strategy}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-400 font-mono">
                    {formatDuration(t.duration_seconds)}
                  </td>
                  {/* Spot R:R */}
                  <td className="px-2 py-1.5 text-right">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-bold ${rrColor(
                        t.spot_rr_achieved
                      )} ${rrBgColor(t.spot_rr_achieved)}`}
                    >
                      {t.spot_rr_achieved.toFixed(1)}x
                    </span>
                  </td>
                  {/* Option R:R */}
                  <td className="px-2 py-1.5 text-right">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-bold ${rrColor(
                        t.option_rr_achieved
                      )} ${rrBgColor(t.option_rr_achieved)}`}
                    >
                      {t.option_rr_achieved.toFixed(1)}x
                    </span>
                  </td>
                  {/* Spot SL Hit */}
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className={`text-[10px] font-medium ${
                        t.spot_sl_hit ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {t.spot_sl_hit ? "Yes" : "No"}
                    </span>
                  </td>
                  {/* Option SL Hit */}
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className={`text-[10px] font-medium ${
                        t.option_sl_hit ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {t.option_sl_hit ? "Yes" : "No"}
                    </span>
                  </td>
                  {/* Status */}
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge(
                        t.status
                      )}`}
                    >
                      {statusLabel(t.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
