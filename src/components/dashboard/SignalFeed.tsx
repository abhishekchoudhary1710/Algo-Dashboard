"use client";

import { useEffect, useRef } from "react";
import type { SignalEvent } from "@/lib/api";

interface SignalFeedProps {
  signals: SignalEvent[];
}

const STRATEGY_COLORS: Record<string, { bg: string; text: string }> = {
  bullish_swing: { bg: "bg-green-900/40", text: "text-green-400" },
  bearish_swing: { bg: "bg-red-900/40", text: "text-red-400" },
  bullish_divergence: { bg: "bg-blue-900/40", text: "text-blue-400" },
  bearish_divergence: { bg: "bg-purple-900/40", text: "text-purple-400" },
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return ts.slice(11, 19);
  }
}

function strategyLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SignalFeed({ signals }: SignalFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [signals]);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Signal Feed</span>
        <span className="text-[10px] text-slate-500">{signals.length} signals</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
        style={{ maxHeight: 360 }}
      >
        {signals.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No signals yet</p>
        ) : (
          [...signals].reverse().slice(0, 50).map((s, i) => {
            const colors = STRATEGY_COLORS[s.strategy] || {
              bg: "bg-slate-700",
              text: "text-slate-300",
            };
            return (
              <div
                key={i}
                className={`rounded px-2 py-1.5 text-xs border-l-2 ${colors.bg}`}
                style={{
                  borderLeftColor:
                    s.strategy.includes("bullish") ? "#22c55e" : "#ef4444",
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-slate-500 font-mono text-[10px]">
                    {formatTime(s.timestamp)}
                  </span>
                  <span
                    className={`px-1 py-0.5 rounded text-[9px] font-medium ${colors.text} ${colors.bg}`}
                  >
                    {strategyLabel(s.strategy)}
                  </span>
                  <span className="text-slate-500 text-[10px] uppercase">
                    {s.instrument}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-slate-300">
                    @{s.price.toFixed(2)}
                  </span>
                  <span className="text-green-400">
                    E: {s.entry_price.toFixed(2)}
                  </span>
                  <span className="text-red-400">
                    SL: {s.stop_loss.toFixed(2)}
                  </span>
                  <span className="text-blue-400">
                    T: {s.target.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
