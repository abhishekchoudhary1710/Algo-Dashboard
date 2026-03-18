"use client";

import { useState } from "react";
import CandlestickChart from "@/components/dashboard/CandlestickChart";
import type { CandleUpdate, SignalEvent } from "@/lib/api";

export default function ChartPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-4">
      <div className="mb-4">
        <h1 className="text-lg font-mono font-bold text-slate-200 tracking-widest uppercase">Live Chart</h1>
        <p className="text-xs text-slate-600 font-mono">NIFTY · Real-time OHLC · Spot & Futures</p>
      </div>
      <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl" style={{ height: "calc(100vh - 120px)" }}>
        <CandlestickChart currentCandle={null} signals={[]} connected={false} />
      </div>
    </div>
  );
}
