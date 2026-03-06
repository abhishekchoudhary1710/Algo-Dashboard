"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  LiveSnapshot,
  Strategies,
  SwingStrategy,
  DivergenceStrategy,
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

function StrategyCard({
  name,
  strategy,
}: {
  name: string;
  strategy: SwingStrategy | DivergenceStrategy;
}) {
  const isSwing = "D" in strategy;

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
      {isSwing ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-400">
            D Point:{" "}
            <span className="text-slate-200">
              {(strategy as SwingStrategy).D?.toFixed(2) || "--"}
            </span>
          </p>
          {(strategy as SwingStrategy).pending_setup && (
            <div className="text-xs text-slate-400">
              <p>
                Entry:{" "}
                <span className="text-green-400">
                  {(strategy as SwingStrategy).pending_setup?.entry_price?.toFixed(2)}
                </span>
              </p>
              <p>
                SL:{" "}
                <span className="text-red-400">
                  {(strategy as SwingStrategy).pending_setup?.stop_loss?.toFixed(2)}
                </span>
              </p>
              <p>
                Target:{" "}
                <span className="text-blue-400">
                  {(strategy as SwingStrategy).pending_setup?.target?.toFixed(2)}
                </span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-slate-400">
            Active Divergences:{" "}
            <span className="text-slate-200">
              {(strategy as DivergenceStrategy).active_divergences.length}
            </span>
          </p>
          {(strategy as DivergenceStrategy).active_divergences
            .slice(0, 2)
            .map((d, i) => (
              <p key={i} className="text-xs text-slate-400">
                P{d.pivot_number}: {d.divergence_type}
              </p>
            ))}
        </div>
      )}
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
        // Reconnect after 3 seconds
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

      {/* Strategies */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
          Strategies
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StrategyCard name="Bullish Swing" strategy={strategies.bullish_swing} />
          <StrategyCard name="Bearish Swing" strategy={strategies.bearish_swing} />
          <StrategyCard name="Bullish Divergence" strategy={strategies.bullish_divergence} />
          <StrategyCard name="Bearish Divergence" strategy={strategies.bearish_divergence} />
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
    </div>
  );
}
