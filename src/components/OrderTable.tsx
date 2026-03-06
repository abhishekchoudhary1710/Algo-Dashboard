"use client";

import { useEffect, useState } from "react";
import { fetchAPI, Order, OrdersResponse } from "@/lib/api";

export default function OrderTable({ mode }: { mode: "today" | "history" }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const endpoint =
      mode === "today" ? "/api/orders/today" : "/api/orders/history?days=30";

    async function load() {
      try {
        const data = await fetchAPI<OrdersResponse>(endpoint);
        setOrders(data.orders);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    }

    load();
    // Refresh every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [mode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-slate-400">Loading orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400 text-sm">{error}</p>
        <p className="text-xs text-slate-500 mt-1">
          Make sure the trading bot API is running
        </p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
        <p className="text-slate-400">No orders found</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left">
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Time
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Symbol
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Type
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Strike
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Qty
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Status
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Variety
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                SL
              </th>
              <th className="px-4 py-3 text-xs text-slate-400 font-medium">
                Target
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, idx) => (
              <tr
                key={`${order.order_id}-${idx}`}
                className="border-b border-slate-700/50 hover:bg-slate-700/30"
              >
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                  {order.timestamp}
                </td>
                <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                  {order.symbol}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      order.option_type === "CE"
                        ? "bg-green-900 text-green-300"
                        : "bg-red-900 text-red-300"
                    }`}
                  >
                    {order.option_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{order.strike}</td>
                <td className="px-4 py-3 text-slate-300">{order.quantity}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      order.status === "PLACED" || order.status === "COMPLETE"
                        ? "bg-green-900 text-green-300"
                        : order.status === "FAILED" || order.status === "ERROR"
                        ? "bg-red-900 text-red-300"
                        : "bg-yellow-900 text-yellow-300"
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">{order.variety}</td>
                <td className="px-4 py-3 text-red-400">
                  {order.stop_loss && order.stop_loss !== "None"
                    ? parseFloat(order.stop_loss).toFixed(2)
                    : "--"}
                </td>
                <td className="px-4 py-3 text-green-400">
                  {order.target && order.target !== "None"
                    ? parseFloat(order.target).toFixed(2)
                    : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          Total: {orders.length} orders
        </p>
      </div>
    </div>
  );
}
