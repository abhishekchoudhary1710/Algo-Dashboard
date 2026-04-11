"use client";

import { useEffect, useState, useRef } from "react";
import CandlestickChart from "@/components/dashboard/CandlestickChart";
import type { CandleUpdate, SignalEvent, WSMessage } from "@/lib/api";

// Use the Next.js /ws/* rewrite proxy — browser only needs port 3000.
const WS_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/live`
    : "ws://localhost:8000/ws/live";

export default function ChartPage() {
  const [connected, setConnected] = useState(false);
  const [currentCandle, setCurrentCandle] = useState<CandleUpdate | null>(null);
  const [signals, setSignals] = useState<SignalEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e) => {
        try {
          const msg: WSMessage = JSON.parse(e.data);
          if (msg.type === "candle") setCurrentCandle(msg.data);
          if (msg.type === "signal") setSignals((prev) => [...prev.slice(-99), msg.data]);
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="flex flex-col bg-[#0a0a0f] text-slate-200" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0">
        <h1 className="text-sm font-mono font-bold text-slate-200 tracking-widest uppercase">
          Live Chart
        </h1>
        <p className="text-xs text-slate-600 font-mono hidden sm:block">
          NIFTY · Real-time OHLC · Spot &amp; Futures &amp; Options
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
          <span className="text-[10px] font-mono text-slate-500">{connected ? "LIVE" : "DISCONNECTED"}</span>
        </div>
      </div>

      {/* Chart — fills remaining height */}
      <div className="flex-1 min-h-0 px-4 pb-4">
        <CandlestickChart
          currentCandle={currentCandle}
          signals={signals}
          connected={connected}
        />
      </div>
    </div>
  );
}
