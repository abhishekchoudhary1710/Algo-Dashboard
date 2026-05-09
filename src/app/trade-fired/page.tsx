"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import type { TradeFiredBlock, TradeFiredResponse } from "@/lib/api";

const STRATEGY_COLORS: Record<string, string> = {
  bullish_swing: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  bearish_swing: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  bullish_divergence: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  bearish_divergence: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  bullish_divergence_futures: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  bearish_divergence_futures: "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

function labelKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_");
}

function strategyClass(label: string): string {
  const key = labelKey(label);
  for (const [k, v] of Object.entries(STRATEGY_COLORS)) {
    if (key.includes(k)) return v;
  }
  if (key.includes("bull")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (key.includes("bear")) return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-slate-600/30 text-slate-300 border-slate-500/30";
}

function StatusPill({ status, broker_error }: { status: string | null; broker_error: string | null }) {
  if (!status) return null;
  const ok = status === "PLACED" || status === "COMPLETE" || status === "OK";
  const cls = ok
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : "bg-red-500/15 text-red-300 border-red-500/30";
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}
      title={broker_error || undefined}
    >
      {status}
    </span>
  );
}

function StructureGrid({ structure }: { structure: Record<string, string> }) {
  const points = ["H1", "L1", "A", "B", "C", "D"] as const;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
      {points.map((p) => {
        const v = structure[p];
        const missing = !v || v.includes("not in log");
        return (
          <div
            key={p}
            className={`px-2 py-1 rounded border text-[11px] font-mono ${
              missing
                ? "bg-slate-900/50 border-slate-800 text-slate-600"
                : "bg-slate-900/80 border-slate-700 text-slate-200"
            }`}
          >
            <span className="text-slate-400 mr-1">{p}:</span>
            {v || "—"}
          </div>
        );
      })}
    </div>
  );
}

function BlockCard({ block }: { block: TradeFiredBlock }) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const stratCls = strategyClass(block.label);
  const dirCE = block.option_type === "CE";

  return (
    <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-[#181822] transition flex flex-wrap items-center gap-3"
      >
        <span className="text-slate-500 text-xs">{expanded ? "▼" : "▶"}</span>
        <span className="font-mono text-xs text-slate-300">
          {block.timestamp || "—"}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${stratCls}`}>
          {block.label || "Unknown"}
        </span>
        {block.historical && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
            HISTORICAL
          </span>
        )}
        {block.symbol && (
          <span className="font-mono text-xs text-slate-200">
            {block.symbol}
          </span>
        )}
        {block.option_type && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              dirCE ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"
            }`}
          >
            {block.option_type}
          </span>
        )}
        {block.qty != null && (
          <span className="text-xs text-slate-400 font-mono">qty {block.qty}</span>
        )}
        {block.entry_method && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
            {block.entry_method}
          </span>
        )}
        {block.pivot && (
          <span className="text-[10px] text-slate-400">pivot {block.pivot}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <StatusPill status={block.status} broker_error={block.broker_error} />
          <span className="text-[10px] text-slate-500 font-mono">
            {block.order_id || ""}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-[#1e1e2e]">
          {/* Top facts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Fact label="Order ID" value={block.order_id} mono />
            <Fact label="Timestamp" value={block.timestamp} mono />
            <Fact label="Strike" value={block.strike?.toString() ?? null} mono />
            <Fact label="Qty" value={block.qty?.toString() ?? null} mono />
            <Fact label="Entry" value={block.entry?.toFixed(2) ?? null} mono />
            <Fact label="SL" value={block.sl?.toFixed(2) ?? null} mono />
            <Fact label="Target" value={block.target?.toFixed(2) ?? null} mono />
            <Fact label="Status" value={block.status} />
          </div>

          {Object.keys(block.structure).length > 0 && (
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1.5">
                📐 Price Structure
              </div>
              <StructureGrid structure={block.structure} />
            </div>
          )}

          {(block.div_type || block.pivot_candle || block.pivot) && (
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1.5">
                📍 Divergence
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <Fact label="Pivot" value={block.pivot} mono />
                <Fact label="Pivot Candle" value={block.pivot_candle} mono />
                <Fact label="Type" value={block.div_type} />
              </div>
            </div>
          )}

          {block.broker_error && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              <span className="text-red-400 font-medium">Broker error: </span>
              {block.broker_error}
            </div>
          )}

          {/* Sections (skip ones already rendered above) */}
          <div className="space-y-3">
            {block.sections
              .filter((s) => {
                const t = s.title;
                return (
                  !t.startsWith("🆔") &&
                  !t.startsWith("⏰") &&
                  !t.startsWith("📦") &&
                  !t.startsWith("📊 CSV") &&
                  !t.startsWith("❌") &&
                  !t.startsWith("📐 Price Structure") &&
                  !t.startsWith("📍 Divergence") &&
                  t !== "Header"
                );
              })
              .map((s, i) => (
                <div key={i}>
                  <div className="text-[11px] text-slate-300 mb-1 font-medium">
                    {s.title}
                  </div>
                  {s.lines.length > 0 && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded px-3 py-2 space-y-0.5">
                      {s.lines.map((ln, j) => (
                        <div
                          key={j}
                          className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap"
                        >
                          {ln}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div>
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="text-[11px] text-slate-500 hover:text-slate-300"
            >
              {showRaw ? "Hide" : "Show"} raw log block
            </button>
            {showRaw && (
              <pre className="mt-2 text-[11px] font-mono text-slate-400 bg-black/40 border border-slate-800 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                {block.raw}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded px-2 py-1.5">
      <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div
        className={`text-xs ${mono ? "font-mono" : ""} ${
          value ? "text-slate-200" : "text-slate-600"
        }`}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export default function TradeFiredPage() {
  const [data, setData] = useState<TradeFiredBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"all" | "live" | "historical">("all");
  const [search, setSearch] = useState("");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetchAPI<TradeFiredResponse>(
        `/api/trade-fired?source=${source}&limit=2000`
      );
      setData(res.blocks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trade-fired logs");
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const strategies = useMemo(() => {
    const s = new Set<string>();
    data.forEach((b) => b.label && s.add(b.label));
    return Array.from(s).sort();
  }, [data]);

  const methods = useMemo(() => {
    const s = new Set<string>();
    data.forEach((b) => b.entry_method && s.add(b.entry_method));
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((b) => {
      if (strategyFilter !== "all" && b.label !== strategyFilter) return false;
      if (methodFilter !== "all" && b.entry_method !== methodFilter) return false;
      if (!q) return true;
      const blob = [
        b.order_id,
        b.symbol,
        b.label,
        b.entry_method,
        b.div_type,
        b.timestamp,
        b.option_type,
        b.broker_error,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [data, search, strategyFilter, methodFilter]);

  const counts = useMemo(() => {
    const live = data.filter((b) => b.source === "live").length;
    const hist = data.filter((b) => b.source === "historical").length;
    const fired = data.filter((b) => b.status === "PLACED" || b.status === "COMPLETE").length;
    const failed = data.filter((b) => b.status === "FAILED").length;
    return { live, hist, fired, failed };
  }, [data]);

  return (
    <div className="p-3 md:p-6 space-y-4 bg-[#0a0e17] min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white">Trade Debug Log</h1>
          <p className="text-xs text-slate-500">
            Why each trade fired — pattern, structure, option selection
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">
            {counts.live} live · {counts.hist} historical · {counts.fired} placed · {counts.failed} failed
          </span>
          <button
            onClick={load}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbol, order id, type ..."
          className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as typeof source)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="all">All sources</option>
          <option value="live">Live only</option>
          <option value="historical">Historical only</option>
        </select>
        <select
          value={strategyFilter}
          onChange={(e) => setStrategyFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="all">All strategies</option>
          {strategies.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="all">All methods</option>
          {methods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {filtered.length} / {data.length}
        </span>
      </div>

      {loading && (
        <p className="text-slate-500 text-sm animate-pulse">Loading trade-fired logs...</p>
      )}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((b, i) => (
          <BlockCard key={`${b.order_id || "no-id"}-${b.timestamp || i}-${i}`} block={b} />
        ))}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-12">
            No trade-fired blocks match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
