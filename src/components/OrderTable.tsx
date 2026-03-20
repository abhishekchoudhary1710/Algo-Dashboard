"use client";

import { useEffect, useState } from "react";
import { fetchAPI, Order, OrdersResponse, Trade, TradesHistoryResponse } from "@/lib/api";

const STRATEGY_LABELS: Record<string, string> = {
  bullish_swing: "Bull Swing",
  bearish_swing: "Bear Swing",
  bullish_divergence: "Bull Div",
  bearish_divergence: "Bear Div",
};
const STRATEGY_COLORS: Record<string, string> = {
  bullish_swing: "#22c55e",
  bearish_swing: "#ef4444",
  bullish_divergence: "#3b82f6",
  bearish_divergence: "#a855f7",
};

function deriveDirection(strategy: string): "LONG" | "SHORT" {
  const s = strategy.toLowerCase();
  return s.includes("bearish") || s.includes("bear") ? "SHORT" : "LONG";
}

function formatExitReason(reason: string | null): { label: string; cls: string } {
  if (!reason) return { label: "\u2014", cls: "text-slate-600" };
  const r = reason.toUpperCase();
  if (r.includes("TARGET")) return { label: "TARGET", cls: "text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded" };
  if (r.includes("OPT") && r.includes("SL")) return { label: "OPT SL", cls: "text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded" };
  if (r.includes("SPOT") && r.includes("SL")) return { label: "SPOT SL", cls: "text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded" };
  if (r.includes("SL")) return { label: "SL HIT", cls: "text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded" };
  if (r.includes("TIME") || r.includes("CLOSE")) return { label: "TIMEOUT", cls: "text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded" };
  return { label: reason, cls: "text-slate-500" };
}

function fmtTime(ts: string | null): string {
  if (!ts) return "\u2014";
  try {
    return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch { return ts.slice(11, 19); }
}

// ── Today: order-level view ──────────────────────────────────────────────────

function TodayOrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="bg-[#12121a] rounded-xl p-8 border border-[#1e1e2e] text-center">
        <p className="text-slate-500 font-mono text-sm">No orders placed today</p>
        <p className="text-[10px] text-slate-700 mt-1">Orders appear here when trades are executed during market hours</p>
      </div>
    );
  }

  return (
    <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-[#1e1e2e] sticky top-0 bg-[#12121a]">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Time</th>
              <th className="text-left px-3 py-2 font-medium">Symbol</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-right px-3 py-2 font-medium">Strike</th>
              <th className="text-right px-3 py-2 font-medium">Qty</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Variety</th>
              <th className="text-right px-3 py-2 font-medium">SL</th>
              <th className="text-right px-3 py-2 font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, idx) => (
              <tr key={`${order.order_id}-${idx}`} className="border-b border-[#1e1e2e]/50 hover:bg-[#1a1a24]">
                <td className="px-3 py-1.5 font-mono text-slate-400 whitespace-nowrap">{order.timestamp}</td>
                <td className="px-3 py-1.5 text-slate-200 font-medium whitespace-nowrap">{order.symbol}</td>
                <td className="px-3 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    order.option_type === "CE" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                  }`}>{order.option_type}</span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-slate-400">{order.strike}</td>
                <td className="px-3 py-1.5 text-right font-mono text-slate-400">{order.quantity}</td>
                <td className="px-3 py-1.5 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    order.status === "PLACED" || order.status === "COMPLETE" ? "bg-emerald-500/10 text-emerald-400" :
                    order.status === "FAILED" || order.status === "ERROR" ? "bg-red-500/10 text-red-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>{order.status}</span>
                </td>
                <td className="px-3 py-1.5 text-slate-500">{order.variety}</td>
                <td className="px-3 py-1.5 text-right font-mono text-red-400">
                  {order.stop_loss && order.stop_loss !== "None" ? parseFloat(order.stop_loss).toFixed(2) : "--"}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-emerald-400">
                  {order.target && order.target !== "None" ? parseFloat(order.target).toFixed(2) : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-[#1e1e2e]">
        <p className="text-[10px] text-slate-600 font-mono">Total: {orders.length} orders</p>
      </div>
    </div>
  );
}

// ── History: trade-level view with full details ─────────────────────────────

function TradeHistoryTable({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="bg-[#12121a] rounded-xl p-8 border border-[#1e1e2e] text-center">
        <p className="text-slate-500 font-mono text-sm">No trades in the last 30 days</p>
      </div>
    );
  }

  const totalPnl = trades.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
  const wins = trades.filter(t => (t.realized_pnl ?? 0) > 0).length;
  const closed = trades.filter(t => t.status === "CLOSED").length;

  return (
    <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] overflow-hidden">
      {/* Summary bar */}
      <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center gap-6">
        <span className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">Trade History</span>
        <div className="flex gap-4 ml-auto text-xs">
          <div className="text-center">
            <span className="text-slate-600 text-[10px]">Trades</span>
            <span className="font-mono font-bold text-slate-200 ml-1">{trades.length}</span>
          </div>
          <div className="text-center">
            <span className="text-slate-600 text-[10px]">Win Rate</span>
            <span className="font-mono font-bold text-slate-200 ml-1">
              {closed > 0 ? `${Math.round((wins / closed) * 100)}%` : "\u2014"}
            </span>
          </div>
          <div className="text-center">
            <span className="text-slate-600 text-[10px]">Net PnL</span>
            <span className={`font-mono font-bold ml-1 ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] text-slate-600 uppercase tracking-wider border-b border-[#1e1e2e] sticky top-0 bg-[#12121a] z-10">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Entry</th>
              <th className="text-left px-3 py-2 font-medium">Strategy</th>
              <th className="text-left px-3 py-2 font-medium">Dir</th>
              <th className="text-left px-3 py-2 font-medium">Option</th>
              <th className="text-right px-3 py-2 font-medium">Strike</th>
              <th className="text-right px-3 py-2 font-medium">Qty</th>
              <th className="text-right px-3 py-2 font-medium">Entry &#8377;</th>
              <th className="text-right px-3 py-2 font-medium">Exit &#8377;</th>
              <th className="text-left px-3 py-2 font-medium">Exit Time</th>
              <th className="text-center px-3 py-2 font-medium">Reason</th>
              <th className="text-right px-3 py-2 font-medium">Max RR</th>
              <th className="text-right px-3 py-2 font-medium">PnL</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const color = STRATEGY_COLORS[t.strategy] || "#64748b";
              const dir = deriveDirection(t.strategy);
              const reason = formatExitReason(t.exit_reason);
              return (
                <tr key={`${t.trade_id}-${i}`} className="border-b border-[#1e1e2e]/50 hover:bg-[#1a1a24]">
                  <td className="px-3 py-1.5 font-mono text-slate-400 whitespace-nowrap">
                    {(t.entry_time || t.created_at || "").slice(0, 10)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">{fmtTime(t.entry_time)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-slate-300 whitespace-nowrap">{STRATEGY_LABELS[t.strategy] || t.strategy}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`font-bold text-[10px] tracking-wider px-1.5 py-0.5 rounded ${
                      dir === "LONG" ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                    }`}>{dir}</span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-400">{t.option_type || "\u2014"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-400">{t.strike ?? "\u2014"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-400">{t.quantity ?? "\u2014"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-300">{t.entry_price?.toFixed(2) ?? "\u2014"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-slate-300">{t.exit_price?.toFixed(2) ?? "\u2014"}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500 whitespace-nowrap">{fmtTime(t.exit_time)}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`text-[10px] font-bold tracking-wider ${reason.cls}`}>{reason.label}</span>
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${
                    (t.max_rr_achieved ?? 0) >= 1.5 ? "text-emerald-400" : (t.max_rr_achieved ?? 0) >= 1 ? "text-yellow-400" : "text-slate-300"
                  }`}>
                    {t.max_rr_achieved != null ? t.max_rr_achieved.toFixed(2) : "\u2014"}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono font-bold ${
                    (t.realized_pnl ?? 0) > 0 ? "text-emerald-400" : (t.realized_pnl ?? 0) < 0 ? "text-red-400" : "text-slate-500"
                  }`}>
                    {t.realized_pnl != null
                      ? `${t.realized_pnl > 0 ? "+" : ""}${t.realized_pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                      : "\u2014"}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                      t.status === "CLOSED" ? "text-slate-400 bg-slate-800" :
                      t.status === "OPEN" ? "text-blue-400 bg-blue-500/10" : "text-slate-600"
                    }`}>{t.status || "\u2014"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-[#1e1e2e]">
        <p className="text-[10px] text-slate-600 font-mono">Source: trades database · {trades.length} trades</p>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function OrderTable({ mode }: { mode: "today" | "history" }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    async function load() {
      try {
        if (mode === "today") {
          const data = await fetchAPI<OrdersResponse>("/api/orders/today");
          setOrders(data.orders);
        } else {
          // Use trades endpoint for richer data
          const data = await fetchAPI<TradesHistoryResponse>("/api/trades/history?days=30");
          if (data.error) setError(data.error);
          else setTrades(data.trades);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [mode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <p className="text-red-400 text-sm">{error}</p>
        <p className="text-[10px] text-slate-600 mt-1">Make sure the trading bot API is running</p>
      </div>
    );
  }

  if (mode === "today") {
    return <TodayOrdersTable orders={orders} />;
  }

  return <TradeHistoryTable trades={trades} />;
}
