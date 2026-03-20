"use client";

import { useState } from "react";
import { postAPI } from "@/lib/api";
import type { EntrySide } from "@/lib/api";

type BiasState = "both" | "long" | "short" | "pause";

interface BiasPanelProps {
  entrySide: EntrySide;
  executionPaused: boolean;
  onBiasChange: (side: EntrySide, paused: boolean) => void;
}

const BIAS_CONFIG: { key: BiasState; label: string; sublabel: string; bg: string; border: string; text: string }[] = [
  { key: "both",  label: "BOTH",  sublabel: "All directions", bg: "bg-emerald-600 hover:bg-emerald-500", border: "border-emerald-400", text: "text-white" },
  { key: "long",  label: "LONG",  sublabel: "CE only",        bg: "bg-blue-600 hover:bg-blue-500",      border: "border-blue-400",    text: "text-white" },
  { key: "short", label: "SHORT", sublabel: "PE only",        bg: "bg-orange-600 hover:bg-orange-500",  border: "border-orange-400",  text: "text-white" },
  { key: "pause", label: "PAUSE", sublabel: "Scan only",      bg: "bg-yellow-500 hover:bg-yellow-400",  border: "border-yellow-300",  text: "text-black" },
];

function currentBias(entrySide: EntrySide, paused: boolean): BiasState {
  if (paused) return "pause";
  if (entrySide === "long_only") return "long";
  if (entrySide === "short_only") return "short";
  return "both";
}

export default function BiasPanel({ entrySide, executionPaused, onBiasChange }: BiasPanelProps) {
  const [loading, setLoading] = useState(false);
  const active = currentBias(entrySide, executionPaused);

  async function handleSelect(key: BiasState) {
    if (key === active || loading) return;
    setLoading(true);
    try {
      if (key === "pause") {
        await postAPI("/api/execution-pause", { paused: true });
        onBiasChange(entrySide, true);
      } else {
        const sideMap: Record<string, EntrySide> = { both: "both", long: "long_only", short: "short_only" };
        const newSide = sideMap[key] as EntrySide;
        if (executionPaused) {
          await postAPI("/api/execution-pause", { paused: false });
        }
        await postAPI("/api/entry-side", { side: newSide });
        onBiasChange(newSide, false);
      }
    } catch (e) {
      console.error("Bias change failed", e);
    } finally {
      setLoading(false);
    }
  }

  const activeConfig = BIAS_CONFIG.find((c) => c.key === active)!;

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">Market Bias</span>
        {loading && <span className="text-xs text-slate-500 animate-pulse">updating...</span>}
      </div>

      {/* Active state display */}
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl sm:text-3xl font-mono font-bold ${active === "pause" ? "text-yellow-400" : active === "long" ? "text-blue-400" : active === "short" ? "text-orange-400" : "text-emerald-400"}`}>
          {activeConfig.label}
        </span>
        <span className="text-xs text-slate-500">{activeConfig.sublabel}</span>
        {active === "pause" && (
          <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-2 py-0.5 rounded-full animate-pulse">
            EXECUTION PAUSED
          </span>
        )}
      </div>

      {/* Toggle buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {BIAS_CONFIG.map((cfg) => {
          const isActive = cfg.key === active;
          return (
            <button
              key={cfg.key}
              onClick={() => handleSelect(cfg.key)}
              disabled={loading}
              className={`py-2 rounded-lg text-xs font-bold tracking-wider transition-all border ${
                isActive
                  ? `${cfg.bg} ${cfg.border} ${cfg.text} shadow-lg scale-105`
                  : "bg-[#1e1e2e] border-[#2a2a3e] text-slate-400 hover:text-slate-200 hover:bg-[#1a1a2e]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
