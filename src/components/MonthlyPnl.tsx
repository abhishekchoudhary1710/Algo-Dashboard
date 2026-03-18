"use client";

import { useEffect, useState } from "react";
import {
  fetchAPI,
  MonthlyPnlResponse,
  MonthlyTradesResponse,
  DailyTradePnl,
  DailyPnl,
} from "@/lib/api";

export default function MonthlyPnl() {
  const [tradeData, setTradeData] = useState<MonthlyTradesResponse | null>(null);
  const [orderData, setOrderData] = useState<MonthlyPnlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Try trades table first (has real PnL), fall back to orders
        const [trades, orders] = await Promise.allSettled([
          fetchAPI<MonthlyTradesResponse>("/api/trades/monthly"),
          fetchAPI<MonthlyPnlResponse>("/api/pnl/monthly"),
        ]);
        if (trades.status === "fulfilled" && trades.value.daily?.length > 0) {
          setTradeData(trades.value);
        }
        if (orders.status === "fulfilled") {
          setOrderData(orders.value);
        }
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
        <p className="text-slate-400 animate-pulse">Loading P&L data...</p>
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

  // Use trade-based PnL if available, otherwise show order-count view
  const hasTradeData = tradeData && tradeData.daily.length > 0;

  if (!hasTradeData && (!orderData || orderData.daily_pnl.length === 0)) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 border border-[#1e1e2e] text-center">
        <p className="text-slate-400">No trading data found</p>
        <p className="text-xs text-slate-500 mt-1">
          P&L data will appear after the bot places trades
        </p>
      </div>
    );
  }

  if (hasTradeData) {
    return <TradeBasedPnl data={tradeData!} />;
  }

  return <OrderBasedPnl data={orderData!} />;
}

/** Real PnL view — from trades table */
function TradeBasedPnl({ data }: { data: MonthlyTradesResponse }) {
  const maxPnl = Math.max(...data.daily.map((d) => Math.abs(d.total_pnl)), 1);

  // Cumulative PnL for equity curve
  let cumPnl = 0;
  const cumData = data.daily.map((d) => {
    cumPnl += d.total_pnl;
    return { ...d, cumPnl };
  });
  const maxCum = Math.max(...cumData.map((d) => Math.abs(d.cumPnl)), 1);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Trading Days" value={data.total_days} />
        <SummaryCard label="Total Trades" value={data.total_trades} />
        <SummaryCard
          label="Total P&L"
          value={`${data.total_pnl > 0 ? "+" : ""}${data.total_pnl.toFixed(2)}`}
          color={data.total_pnl > 0 ? "text-green-400" : data.total_pnl < 0 ? "text-red-400" : "text-white"}
        />
        <SummaryCard
          label="Win Rate"
          value={`${data.overall_win_rate}%`}
          color={data.overall_win_rate >= 60 ? "text-green-400" : data.overall_win_rate >= 40 ? "text-yellow-400" : "text-red-400"}
        />
        <SummaryCard
          label="Avg P&L / Day"
          value={data.total_days > 0 ? (data.total_pnl / data.total_days).toFixed(2) : "0"}
          color={data.total_pnl >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Equity Curve */}
      <div className="bg-[#12121a] rounded-xl p-4 border border-[#1e1e2e]">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Equity Curve (Cumulative P&L)
        </h3>
        <div className="flex items-end gap-1 h-32 relative">
          {/* Zero line */}
          <div className="absolute left-0 right-0 border-t border-dashed border-slate-600" style={{ bottom: "50%" }} />
          {cumData.map((day) => {
            const normalized = (day.cumPnl / maxCum) * 50;
            const isPositive = day.cumPnl >= 0;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center group relative"
                style={{ height: "100%", maxWidth: 60 }}
              >
                <div className="w-full h-full relative">
                  <div
                    className={`absolute left-1 right-1 rounded-sm ${
                      isPositive ? "bg-emerald-500/60" : "bg-red-500/60"
                    }`}
                    style={
                      isPositive
                        ? { bottom: "50%", height: `${Math.max(Math.abs(normalized), 2)}%` }
                        : { top: "50%", height: `${Math.max(Math.abs(normalized), 2)}%` }
                    }
                  />
                </div>
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#1e1e2e] text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {day.date}: {day.cumPnl > 0 ? "+" : ""}{day.cumPnl.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily P&L Bar Chart */}
      <div className="bg-[#12121a] rounded-xl p-4 border border-[#1e1e2e]">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">
          Daily P&L
        </h3>
        <div className="flex items-end gap-1 h-32 relative">
          <div className="absolute left-0 right-0 border-t border-dashed border-slate-600" style={{ bottom: "50%" }} />
          {data.daily.map((day) => {
            const normalized = (day.total_pnl / maxPnl) * 50;
            const isPositive = day.total_pnl >= 0;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center group relative"
                style={{ height: "100%", maxWidth: 60 }}
              >
                <div className="w-full h-full relative">
                  <div
                    className={`absolute left-1 right-1 rounded-sm transition-colors ${
                      isPositive
                        ? "bg-emerald-500 hover:bg-emerald-400"
                        : "bg-red-500 hover:bg-red-400"
                    }`}
                    style={
                      isPositive
                        ? { bottom: "50%", height: `${Math.max(Math.abs(normalized), 2)}%` }
                        : { top: "50%", height: `${Math.max(Math.abs(normalized), 2)}%` }
                    }
                  />
                </div>
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#1e1e2e] text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {day.date}: {day.total_pnl > 0 ? "+" : ""}{day.total_pnl.toFixed(2)} ({day.winners}W / {day.losers}L)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e] text-left">
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">Date</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">Trades</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">W / L</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">Win Rate</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {data.daily
              .slice()
              .reverse()
              .map((day: DailyTradePnl) => (
                <tr
                  key={day.date}
                  className={`border-b border-[#1e1e2e]/50 hover:bg-slate-700/30 ${
                    day.total_pnl > 0
                      ? "bg-green-500/5"
                      : day.total_pnl < 0
                      ? "bg-red-500/5"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-slate-300 font-mono">{day.date}</td>
                  <td className="px-4 py-3 text-white font-medium">{day.total_trades}</td>
                  <td className="px-4 py-3">
                    <span className="text-green-400">{day.winners}</span>
                    <span className="text-slate-500"> / </span>
                    <span className="text-red-400">{day.losers}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        day.win_rate >= 60
                          ? "bg-green-500/20 text-green-400"
                          : day.win_rate >= 40
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {day.win_rate}%
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-medium ${
                      day.total_pnl > 0
                        ? "text-green-400"
                        : day.total_pnl < 0
                        ? "text-red-400"
                        : "text-slate-400"
                    }`}
                  >
                    {day.total_pnl > 0 ? "+" : ""}
                    {day.total_pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Fallback: order-count view (no PnL data) */
function OrderBasedPnl({ data }: { data: MonthlyPnlResponse }) {
  const maxTrades = Math.max(...data.daily_pnl.map((d) => d.trades), 1);

  return (
    <div className="space-y-6">
      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
        <p className="text-yellow-400 text-xs">
          Showing order counts only. Real P&L will appear once trades are tracked in the database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Trading Days" value={data.daily_pnl.length} />
        <SummaryCard label="Total Trades" value={data.total_trades} />
        <SummaryCard
          label="Avg / Day"
          value={data.daily_pnl.length > 0
            ? (data.total_trades / data.daily_pnl.length).toFixed(1)
            : "0"}
        />
      </div>

      <div className="bg-[#12121a] rounded-xl p-4 border border-[#1e1e2e]">
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
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {day.date}: {day.trades} trades
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e] text-left">
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">Date</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">Trades</th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {data.daily_pnl
              .slice()
              .reverse()
              .map((day: DailyPnl) => (
                <tr key={day.date} className="border-b border-[#1e1e2e]/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-300">{day.date}</td>
                  <td className="px-4 py-3 text-white font-medium">{day.trades}</td>
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

function SummaryCard({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-[#12121a] rounded-xl p-4 border border-[#1e1e2e]">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
