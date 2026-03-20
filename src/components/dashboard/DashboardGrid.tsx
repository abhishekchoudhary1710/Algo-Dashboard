"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import { createTypedWebSocket } from "@/lib/websocket";
import type {
  TickData,
  CandleUpdate,
  SignalEvent,
  HeartbeatData,
  SignalsResponse,
  ExcursionsResponse,
  RiskMetrics,
  Strategies,
  TradeExcursion,
  EntrySide,
  SystemHealth,
} from "@/lib/api";

import TopBar from "./TopBar";
import BiasPanel from "./BiasPanel";
import ExecutionHealthPanel from "./ExecutionHealthPanel";
import PotentialTradesMonitor from "./PotentialTradesMonitor";
import SignalFeed from "./SignalFeed";
import TradeExcursionPanel from "./TradeExcursionPanel";
import StrategyPerformance from "./StrategyPerformance";

// ── Main component ──────────────────────────────────────────────────────────
export default function DashboardGrid() {
  const [connected, setConnected] = useState(false);
  const [tickData, setTickData] = useState<TickData | null>(null);
  const [, setCurrentCandle] = useState<CandleUpdate | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null);

  const [strategies, setStrategies] = useState<Strategies | null>(null);
  const [botRunning, setBotRunning] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  const [executionPaused, setExecutionPaused] = useState(false);
  const [entrySide, setEntrySide] = useState<EntrySide>("both");
  const [ordersCount, setOrdersCount] = useState(0);

  const [signals, setSignals] = useState<SignalEvent[]>([]);
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [excursions, setExcursions] = useState<TradeExcursion[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  const wsRef = useRef<{ close: () => void } | null>(null);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const signalAccRef = useRef<SignalEvent[]>([]);

  const fetchSignals = useCallback(async () => {
    try {
      const data = await fetchAPI<SignalsResponse>("/api/signals/history?count=100");
      setSignals(data.signals);
      signalAccRef.current = data.signals;
    } catch {}
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await fetchAPI<RiskMetrics>("/api/risk/metrics?days=30");
      setMetrics(data);
    } catch {}
  }, []);

  const fetchExcursions = useCallback(async () => {
    try {
      const data = await fetchAPI<ExcursionsResponse>("/api/excursions/today");
      setExcursions(data.trades);
    } catch {}
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await fetchAPI<SystemHealth>("/api/system/health");
      setHealth(data);
    } catch {}
  }, []);

  useEffect(() => {
    wsRef.current = createTypedWebSocket({
      onTick: (data) => setTickData(data),
      onCandle: (data) => setCurrentCandle(data),
      onSignal: (data) => {
        signalAccRef.current = [...signalAccRef.current, data].slice(-500);
        setSignals([...signalAccRef.current]);
      },
      onSnapshot: (data) => {
        setStrategies(data.strategies);
        setBotRunning(data.bot_running);
        setKillSwitch(data.kill_switch);
        if (data.entry_side) setEntrySide(data.entry_side);
        if (typeof data.execution_paused === "boolean") setExecutionPaused(data.execution_paused);
        setOrdersCount(data.today_orders_count);
      },
      onHeartbeat: (data) => setHeartbeat(data),
      onExcursion: (data) => setExcursions(data.trades),
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    });

    fetchSignals();
    fetchMetrics();
    fetchExcursions();
    fetchHealth();

    const intervals = [
      setInterval(fetchMetrics, 60000),
      setInterval(fetchExcursions, 5000),
      setInterval(fetchHealth, 10000),
    ];
    intervalsRef.current = intervals;

    return () => {
      wsRef.current?.close();
      intervals.forEach(clearInterval);
    };
  }, [fetchSignals, fetchMetrics, fetchExcursions, fetchHealth]);

  function handleBiasChange(side: EntrySide, paused: boolean) {
    setEntrySide(side);
    setExecutionPaused(paused);
  }

  // Loading state
  if (!tickData && !connected) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-slate-400 text-sm font-mono">Connecting to trading engine...</div>
          <p className="text-xs text-slate-600">Make sure the backend is running on port 8000</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 flex flex-col">
      {/* Top bar */}
      <TopBar
        tickData={tickData}
        heartbeat={heartbeat}
        connected={connected}
        botRunning={botRunning}
        killSwitch={killSwitch}
        ordersCount={ordersCount}
      />

      {/* ── Zone 1: Bias + Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-3 px-3 md:px-4 pt-3">
        <BiasPanel
          entrySide={entrySide}
          executionPaused={executionPaused}
          onBiasChange={handleBiasChange}
        />
        <ExecutionHealthPanel health={health} wsConnected={connected} />
      </div>

      {/* ── Zone 2: Potential Trades Monitor (full width) ── */}
      <div className="px-3 md:px-4 pt-3">
        <PotentialTradesMonitor strategies={strategies} />
      </div>

      {/* ── Zone 3: Performance + Excursion ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 md:px-4 pt-3">
        <StrategyPerformance metrics={metrics} />
        <TradeExcursionPanel excursions={excursions} />
      </div>

      {/* ── Zone 4: Signal Feed (full width) ── */}
      <div className="px-3 md:px-4 pt-3 pb-4 flex-1 min-h-0">
        <SignalFeed signals={signals} />
      </div>

      <div className="text-center text-[10px] text-slate-700 py-2 border-t border-[#1e1e2e]">
        Built by <span className="text-slate-500 font-medium">Abhishek Choudhary</span> — AI/ML Developer
      </div>
    </div>
  );
}
