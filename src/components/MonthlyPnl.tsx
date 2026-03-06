"use client";

import { useEffect, useState } from "react";
import { fetchAPI, MonthlyPnlResponse, DailyPnl } from "@/lib/api";

export default function MonthlyPnl() {
  const [data, setData] = useState<MonthlyPnlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchAPI<MonthlyPnlResponse>("/api/pnl/monthly");
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load P&L data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-slate-400">Loading P&L data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.daily_pnl.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
        <p className="text-slate-400">No trading data found</p>
        <p className="text-xs text-slate-500 mt-1">
          P&L data will appear after the bot places orders
        </p>
      </div>
    );
  }

  // Find the max trades for bar chart scaling
  const maxTrades = Math.max(...data.daily_pnl.map((d) => d.trades), 1);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Total Trading Days
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {data.daily_pnl.length}
          </p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Total Trades
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {data.total_trades}
          </p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Avg Trades / Day
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {data.daily_pnl.length > 0
              ? (data.total_trades / data.daily_pnl.length).toFixed(1)
              : "0"}
          </p>
        </div>
      </div>

      {/* Daily Bar Chart */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Trades by Day
        </h3>
        <div className="flex items-end gap-1 h-40">
          {data.daily_pnl.map((day: DailyPnl) => {
            const height = (day.trades / maxTrades) * 100;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-1 group relative"
              >
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition-colors min-h-[4px]"
                  style={{ height: `${height}%` }}
                />
                <p className="text-[10px] text-slate-500 rotate-45 origin-left whitespace-nowrap">
                  {day.date.slice(5)}
                </p>
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {day.date}: {day.trades} trades
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left">
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Date
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Trades
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {data.daily_pnl
              .slice()
              .reverse()
              .map((day: DailyPnl) => (
                <tr
                  key={day.date}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30"
                >
                  <td className="px-4 py-3 text-slate-300">{day.date}</td>
                  <td className="px-4 py-3 text-white font-medium">
                    {day.trades}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {day.orders
                      .slice(0, 3)
                      .map((o) => `${o.option_type} ${o.strike}`)
                      .join(", ")}
                    {day.orders.length > 3 && ` +${day.orders.length - 3} more`}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
