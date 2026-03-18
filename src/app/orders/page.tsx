"use client";

import { useState } from "react";
import OrderTable from "@/components/OrderTable";

export default function OrdersPage() {
  const [mode, setMode] = useState<"today" | "history">("today");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Orders</h2>
        <div className="flex gap-1 bg-[#12121a] border border-[#1e1e2e] rounded-lg p-1">
          <button
            onClick={() => setMode("today")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              mode === "today"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setMode("history")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              mode === "history"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
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
