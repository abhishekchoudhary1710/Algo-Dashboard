"use client";

import { useEffect, useRef, useMemo } from "react";
import type { SignalEvent } from "@/lib/api";

interface SignalFeedProps {
  signals: SignalEvent[];
}

const STRATEGY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  bullish_swing:      { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "#22c55e" },
  bearish_swing:      { bg: "bg-red-500/10",     text: "text-red-400",     border: "#ef4444" },
  bullish_divergence: { bg: "bg-blue-500/10",    text: "text-blue-400",    border: "#3b82f6" },
  bearish_divergence: { bg: "bg-purple-500/10",  text: "text-purple-400",  border: "#a855f7" },
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

/** Dedup signals by timestamp+strategy+price combo */
function deduplicateSignals(signals: SignalEvent[]): SignalEvent[] {
  const seen = new Set<string>();
  return signals.filter((s) => {
    const key = `${s.timestamp}-${s.strategy}-${s.price}-${s.entry_price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function SignalFeed({ signals }: SignalFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const dedupedSignals = useMemo(() => deduplicateSignals(signals), [signals]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dedupedSignals]);

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-[#1e1e2e] flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Signal Feed</span>
        <span className="text-[10px] font-mono text-slate-600">{dedupedSignals.length} signals</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
        style={{ maxHeight: 300 }}
      >
        {dedupedSignals.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <div className="text-sm text-slate-600 font-mono">No signals yet</div>
          </div>
        ) : (
          [...dedupedSignals].reverse().slice(0, 50).map((s, i) => {
            const colors = STRATEGY_COLORS[s.strategy] || {
              bg: "bg-slate-800",
              text: "text-slate-400",
              border: "#64748b",
            };
            return (
              <div
                key={`${s.timestamp}-${s.strategy}-${i}`}
                className={`rounded-lg px-3 py-2 text-xs border-l-2 ${colors.bg}`}
                style={{ borderLeftColor: colors.border }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-slate-600 font-mono text-[10px]">
                    {formatTime(s.timestamp)}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${colors.text}`}
                  >
                    {strategyLabel(s.strategy)}
                  </span>
                  <span className="text-slate-600 text-[10px] uppercase font-mono">
                    {s.instrument}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-slate-400">
                    @{s.price.toFixed(2)}
                  </span>
                  <span className="text-emerald-400">
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
