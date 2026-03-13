"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  LiveSnapshot,
  Strategies,
  SwingStrategy,
  DivergenceStrategy,
  PivotData,
  FirstCandle,
  postAPI,
} from "@/lib/api";
import { createWebSocket } from "@/lib/websocket";

function PriceCard({
  label,
  price,
  subLabel,
  subValue,
}: {
  label: string;
  price: number;
  subLabel?: string;
  subValue?: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">
        {price > 0 ? price.toFixed(2) : "--"}
      </p>
      {subLabel && (
        <p className="text-xs text-slate-400 mt-1">
          {subLabel}: <span className="text-slate-300">{subValue}</span>
        </p>
      )}
    </div>
  );
}

function StatusBadge({ running, killed }: { running: boolean; killed: boolean }) {
  if (killed) {
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-red-900 text-red-300 font-medium">
        KILLED
      </span>
    );
  }
  return (
    <span
      className={`px-2 py-1 text-xs rounded-full font-medium ${
        running
          ? "bg-green-900 text-green-300"
          : "bg-yellow-900 text-yellow-300"
      }`}
    >
      {running ? "RUNNING" : "STOPPED"}
    </span>
  );
}

function formatTime(timeStr: string): string {
  if (!timeStr || timeStr === "None" || timeStr === "N/A") return "--";
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    // Try to extract time from string like "2026-03-06 09:25:00+05:30"
    const match = timeStr.match(/(\d{2}:\d{2})/);
    return match ? match[1] : timeStr.slice(0, 16);
  }
}

function PivotSection({ pivots, label, type }: { pivots?: PivotData; label: string; type: "highs" | "lows" }) {
  if (!pivots || pivots.total === 0) {
    return (
      <div className="mt-2">
        <p className="text-xs text-slate-500">No {label.toLowerCase()} detected</p>
      </div>
    );
  }

  const breakLabel = type === "highs" ? "Breakout" : "Breakdown";

  return (
    <div className="mt-2">
      <p className="text-xs text-slate-400 font-medium mb-1">
        {label} ({pivots.total} total)
      </p>
      <div className="space-y-0.5 max-h-32 overflow-y-auto">
        {pivots.unbroken.map((p) => (
          <div key={p.pivot_number} className="flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-slate-300">
              P{p.pivot_number}
            </span>
            <span className="text-slate-400">
              {formatTime(p.time)} @ {p.price.toFixed(2)}
            </span>
          </div>
        ))}
        {pivots.broken.map((p) => (
          <div key={p.pivot_number} className="flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-slate-500 line-through">
              P{p.pivot_number}
            </span>
            <span className="text-slate-500">
              {formatTime(p.time)} @ {p.price.toFixed(2)}
            </span>
            <span className="text-red-400 text-[10px]">
              {breakLabel}: {(p.breakout_price || p.breakdown_price || 0).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FirstCandleSection({ fc, direction }: { fc?: FirstCandle | null; direction: "bearish" | "bullish" }) {
  if (!fc) return null;
  const breakPrice = direction === "bearish" ? fc.breakdown_price : fc.breakout_price;
  const breakLabel = direction === "bearish" ? "Breakdown" : "Breakout";

  return (
    <div className="mt-2 pt-2 border-t border-slate-700/50">
      <div className="flex items-center gap-1.5 text-xs">
        <span className={`w-1.5 h-1.5 rounded-full ${fc.broken ? "bg-red-500" : "bg-yellow-500"} flex-shrink-0`} />
        <span className="text-slate-400">
          1st Candle {direction === "bearish" ? "Low" : "High"}: {fc.price.toFixed(2)}
        </span>
        {fc.broken ? (
          <span className="text-red-400">{breakLabel}: {breakPrice?.toFixed(2)}</span>
        ) : (
          <span className="text-yellow-400">Unbroken</span>
        )}
      </div>
    </div>
  );
}

function EntrySetupsSection({ setups }: { setups?: Record<string, string> | string }) {
  if (!setups) return null;
  if (typeof setups === "string") {
    if (!setups || setups.includes("No active")) return null;
    return (
      <div className="mt-2 pt-2 border-t border-slate-700/50">
        <p className="text-xs text-slate-400 font-medium mb-1">Entry Setups</p>
        <pre className="text-[10px] text-slate-300 whitespace-pre-wrap">{setups}</pre>
      </div>
    );
  }

  const activeSetups = Object.entries(setups).filter(
    ([, v]) => v && !v.toLowerCase().includes("no active")
  );

  if (activeSetups.length === 0) return null;

  const managerLabels: Record<string, string> = {
    green_candle: "Green Candle",
    red_candle: "Red Candle",
    pullback: "Pullback",
    mother_child: "Mother-Child",
    three_top: "3-Top",
    three_bottom: "3-Bottom",
  };

  return (
    <div className="mt-2 pt-2 border-t border-slate-700/50">
      <p className="text-xs text-slate-400 font-medium mb-1">Entry Setups</p>
      <div className="space-y-1">
        {activeSetups.map(([key, value]) => (
          <div key={key}>
            <span className="text-[10px] text-blue-400 font-medium">
              {managerLabels[key] || key}:
            </span>
            <pre className="text-[10px] text-slate-300 whitespace-pre-wrap ml-1">{value}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function DivergenceCard({
  name,
  strategy,
  direction,
}: {
  name: string;
  strategy: DivergenceStrategy;
  direction: "bearish" | "bullish";
}) {
  const pivotType = direction === "bearish" ? "highs" : "lows";
  const pivotLabel = direction === "bearish" ? "Pivot Highs" : "Pivot Lows";

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-white">{name}</p>
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            strategy.active ? "bg-green-500 animate-pulse" : "bg-slate-500"
          }`}
        />
      </div>

      {/* Active Divergences */}
      <div className="space-y-1">
        <p className="text-xs text-slate-400">
          Active Divergences:{" "}
          <span className={strategy.active ? "text-yellow-400 font-medium" : "text-slate-200"}>
            {strategy.active_divergences.length}
          </span>
        </p>
        {strategy.active_divergences.map((d, i) => (
          <div key={i} className="bg-slate-700/50 rounded px-2 py-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 font-medium">P{d.pivot_number}</span>
              <span className="text-slate-300">{d.divergence_type}</span>
            </div>
            <div className="flex gap-2 mt-0.5 text-[10px]">
              <span className={d.spot_broken ? "text-green-400" : "text-slate-500"}>
                Spot: {d.spot_broken ? "Broken" : "Pending"}
              </span>
              <span className={d.fut_broken ? "text-green-400" : "text-slate-500"}>
                Fut: {d.fut_broken ? "Broken" : "Pending"}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Candle: {formatTime(d.candle_time)}
            </div>
          </div>
        ))}
      </div>

      {/* Pivot Data */}
      <PivotSection pivots={strategy.pivots} label={pivotLabel} type={pivotType} />

      {/* First Candle */}
      <FirstCandleSection fc={strategy.first_candle} direction={direction} />

      {/* Entry Setups */}
      <EntrySetupsSection setups={strategy.entry_setups} />
    </div>
  );
}

function SwingCard({
  name,
  strategy,
}: {
  name: string;
  strategy: SwingStrategy;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-white">{name}</p>
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            strategy.active ? "bg-green-500" : "bg-slate-500"
          }`}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-slate-400">
          D Point:{" "}
          <span className="text-slate-200">
            {strategy.D?.toFixed(2) || "--"}
          </span>
        </p>
        {strategy.H1 != null && (
          <p className="text-xs text-slate-400">
            H1: <span className="text-slate-200">{strategy.H1.toFixed(2)}</span>
            {strategy.L1 != null && (
              <> | L1: <span className="text-slate-200">{strategy.L1.toFixed(2)}</span></>
            )}
          </p>
        )}
        {strategy.A != null && (
          <p className="text-xs text-slate-400">
            A: <span className="text-slate-200">{strategy.A.toFixed(2)}</span>
            {strategy.B != null && (
              <> | B: <span className="text-slate-200">{strategy.B.toFixed(2)}</span></>
            )}
            {strategy.C != null && (
              <> | C: <span className="text-slate-200">{strategy.C.toFixed(2)}</span></>
            )}
          </p>
        )}
        {strategy.pending_setup && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-400">
            <p>
              Entry:{" "}
              <span className="text-green-400">
                {strategy.pending_setup.entry_price?.toFixed(2)}
              </span>
            </p>
            <p>
              SL:{" "}
              <span className="text-red-400">
                {strategy.pending_setup.stop_loss?.toFixed(2)}
              </span>
            </p>
            <p>
              Target:{" "}
              <span className="text-blue-400">
                {strategy.pending_setup.target?.toFixed(2)}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveDashboard() {
  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [killing, setKilling] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWs = useCallback(() => {
    wsRef.current = createWebSocket(
      (snapshot) => {
        setData(snapshot);
        setConnected(true);
      },
      () => setConnected(false),
      () => {
        setConnected(false);
        setTimeout(connectWs, 3000);
      }
    );
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWs]);

  const handleKillSwitch = async () => {
    if (!confirm("Are you sure you want to STOP all trading?")) return;
    setKilling(true);
    try {
      await postAPI("/api/kill");
    } catch {
      alert("Failed to activate kill switch");
    }
    setKilling(false);
  };

  const handleResume = async () => {
    if (!confirm("Resume trading?")) return;
    try {
      await postAPI("/api/resume");
    } catch {
      alert("Failed to resume trading");
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-pulse text-slate-400 text-lg">
            {connected ? "Loading..." : "Connecting to bot..."}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Make sure the trading bot is running
          </p>
        </div>
      </div>
    );
  }

  const strategies = data.strategies as Strategies;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">Live Dashboard</h2>
          <StatusBadge running={data.bot_running} killed={data.kill_switch} />
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
        </div>
        <div className="flex gap-2">
          {data.kill_switch ? (
            <button
              onClick={handleResume}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Resume Trading
            </button>
          ) : (
            <button
              onClick={handleKillSwitch}
              disabled={killing}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {killing ? "Stopping..." : "Kill Switch"}
            </button>
          )}
        </div>
      </div>

      {/* Prices */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PriceCard
          label="NIFTY Spot"
          price={data.prices.spot_ltp}
          subLabel="Ticks"
          subValue={data.tick_count.toLocaleString()}
        />
        <PriceCard
          label="NIFTY Futures"
          price={data.prices.fut_ltp}
          subLabel="Premium"
          subValue={
            data.prices.premium > 0
              ? `+${data.prices.premium.toFixed(2)}`
              : data.prices.premium.toFixed(2)
          }
        />
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wide">
            Today&apos;s Activity
          </p>
          <div className="mt-2 space-y-1">
            <p className="text-sm text-slate-300">
              Orders: <span className="text-white font-medium">{data.today_orders_count}</span>
            </p>
            <p className="text-sm text-slate-300">
              Signals: <span className="text-white font-medium">{data.today_signals_count}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Swing Strategies */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
          Swing Strategies
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SwingCard name="Bullish Swing" strategy={strategies.bullish_swing} />
          <SwingCard name="Bearish Swing" strategy={strategies.bearish_swing} />
        </div>
      </div>

      {/* Divergence Strategies */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
          Divergence Strategies
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DivergenceCard
            name="Bullish Divergence"
            strategy={strategies.bullish_divergence}
            direction="bullish"
          />
          <DivergenceCard
            name="Bearish Divergence"
            strategy={strategies.bearish_divergence}
            direction="bearish"
          />
        </div>
      </div>

      {/* Candle Counts */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
          Candle Data
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400">Spot 1m</p>
            <p className="text-lg font-bold text-white">{data.candles.spot_1m}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Spot 5m</p>
            <p className="text-lg font-bold text-white">{data.candles.spot_5m}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Futures 1m</p>
            <p className="text-lg font-bold text-white">{data.candles.fut_1m}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Futures 5m</p>
            <p className="text-lg font-bold text-white">{data.candles.fut_5m}</p>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-xs text-slate-500 flex justify-between">
        <span>
          Started: {data.bot_start_time || "--"}
        </span>
        <span>
          Last tick: {data.last_tick_time || "--"}
        </span>
      </div>

      {/* Author Credit */}
      <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-800">
        Built by <span className="text-slate-400 font-medium">Abhishek Choudhary</span> — AI/ML Developer
      </div>
    </div>
  );
}
