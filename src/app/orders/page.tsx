"use client";

import { useState } from "react";
import OrderTable from "@/components/OrderTable";

export default function OrdersPage() {
  const [mode, setMode] = useState<"today" | "history">("today");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-mono font-bold tracking-widest uppercase text-slate-200">Orders</h2>
        <div className="flex gap-1 bg-[#12121a] border border-[#1e1e2e] rounded-lg p-1">
          <button
            onClick={() => setMode("today")}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold tracking-wider transition-colors ${
              mode === "today"
                ? "bg-emerald-600 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setMode("history")}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold tracking-wider transition-colors ${
              mode === "history"
                ? "bg-emerald-600 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            History (30d)
          </button>
        </div>
      </div>
      <OrderTable mode={mode} />
    </div>
  );
}
