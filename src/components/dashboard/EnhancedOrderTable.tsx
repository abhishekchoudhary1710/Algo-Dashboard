"use client";

import type { Order } from "@/lib/api";

interface EnhancedOrderTableProps {
  orders: Order[];
}

function statusColor(status: string): string {
  switch (status) {
    case "COMPLETE":
      return "bg-green-900/50 text-green-400";
    case "PLACED":
      return "bg-yellow-900/50 text-yellow-400";
    case "FAILED":
    case "ERROR":
      return "bg-red-900/50 text-red-400";
    default:
      return "bg-slate-700 text-slate-300";
  }
}

function optionBadge(type: string): string {
  return type === "CE"
    ? "bg-green-900/30 text-green-400"
    : "bg-red-900/30 text-red-400";
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

export default function EnhancedOrderTable({ orders }: EnhancedOrderTableProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Orders</span>
        <span className="text-[10px] text-slate-500">{orders.length} today</span>
      </div>
      <div className="overflow-x-auto max-h-48 overflow-y-auto">
        {orders.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No orders today</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-700 sticky top-0 bg-slate-800">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Time</th>
                <th className="px-2 py-1.5 text-left font-medium">Strike</th>
                <th className="px-2 py-1.5 text-left font-medium">Type</th>
                <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                <th className="px-2 py-1.5 text-right font-medium">SL</th>
                <th className="px-2 py-1.5 text-right font-medium">Target</th>
                <th className="px-2 py-1.5 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30"
                >
                  <td className="px-2 py-1.5 text-slate-300 font-mono">
                    {formatTime(o.timestamp)}
                  </td>
                  <td className="px-2 py-1.5 text-slate-200 font-mono">
                    {o.strike}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] font-medium ${optionBadge(
                        o.option_type
                      )}`}
                    >
                      {o.option_type}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-300 font-mono">
                    {o.quantity}
                  </td>
                  <td className="px-2 py-1.5 text-right text-red-400 font-mono">
                    {o.stop_loss || "--"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-green-400 font-mono">
                    {o.target || "--"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(
                        o.status
                      )}`}
                    >
                      {o.status}
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
