"use client";

import { useState, useEffect } from "react";
import { postAPI, fetchAPI } from "@/lib/api";
import type { HeartbeatData, DbHealth } from "@/lib/api";

interface SystemControlsProps {
  killSwitch: boolean;
  candles: {
    spot_1m: number;
    spot_5m: number;
    fut_1m: number;
    fut_5m: number;
  } | null;
  heartbeat: HeartbeatData | null;
}

function CandleBar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((count / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-mono">{count}</span>
      </div>
      <div className="w-full bg-slate-700/50 rounded-full h-1.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function SystemControls({
  killSwitch,
  candles,
  heartbeat,
}: SystemControlsProps) {
  const [loading, setLoading] = useState(false);

  const handleKill = async () => {
    if (!confirm("Stop all trading?")) return;
    setLoading(true);
    try {
      await postAPI("/api/kill");
    } catch {
      alert("Failed to activate kill switch");
    }
    setLoading(false);
  };

  const handleResume = async () => {
    if (!confirm("Resume trading?")) return;
    setLoading(true);
    try {
      await postAPI("/api/resume");
    } catch {
      alert("Failed to resume");
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 space-y-3">
      <p className="text-xs text-slate-400 font-medium">System Controls</p>

      {/* Kill / Resume */}
      <div className="flex gap-2">
        {killSwitch ? (
          <button
            onClick={handleResume}
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            Resume Trading
          </button>
        ) : (
          <button
            onClick={handleKill}
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            {loading ? "Stopping..." : "Kill Switch"}
          </button>
        )}
      </div>

      {/* Feed Health */}
      {heartbeat && (
        <div className="text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Feed</span>
            <span
              className={
                heartbeat.feed_alive ? "text-green-400" : "text-red-400"
              }
            >
              {heartbeat.feed_alive ? "ALIVE" : "DEAD"}
            </span>
          </div>
        </div>
      )}

      {/* Candle Bars */}
      {candles && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase">Candle Counts</p>
          <CandleBar label="Spot 1m" count={candles.spot_1m} max={375} color="#06b6d4" />
          <CandleBar label="Spot 5m" count={candles.spot_5m} max={75} color="#3b82f6" />
          <CandleBar label="Fut 1m" count={candles.fut_1m} max={375} color="#22c55e" />
          <CandleBar label="Fut 5m" count={candles.fut_5m} max={75} color="#a855f7" />
        </div>
      )}
    </div>
  );
}
