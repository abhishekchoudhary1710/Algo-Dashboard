"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import { createTypedWebSocket } from "@/lib/websocket";
import type {
  TickData,
  CandleUpdate,
  SignalEvent,
  HeartbeatData,
  OrdersResponse,
  EntriesResponse,
  SignalsResponse,
  ExcursionsResponse,
  RiskMetrics,
  Strategies,
  Order,
  EntrySignal,
  TradeExcursion,
} from "@/lib/api";

import TopBar from "./TopBar";
import CandlestickChart from "./CandlestickChart";
import ExposureCurve from "./ExposureCurve";
import RiskMetricsPanel from "./RiskMetricsPanel";
import StrategyCards from "./StrategyCards";
import SignalFeed from "./SignalFeed";
import EnhancedOrderTable from "./EnhancedOrderTable";
import EntrySignalsTable from "./EntrySignalsTable";
import TradeExcursionPanel from "./TradeExcursionPanel";
import StrategyPerformance from "./StrategyPerformance";
import SystemControls from "./SystemControls";

export default function DashboardGrid() {
  // WS state
  const [connected, setConnected] = useState(false);
  const [tickData, setTickData] = useState<TickData | null>(null);
  const [currentCandle, setCurrentCandle] = useState<CandleUpdate | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null);

  // Snapshot state (from WS every 5s)
  const [strategies, setStrategies] = useState<Strategies | null>(null);
  const [botRunning, setBotRunning] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  const [ordersCount, setOrdersCount] = useState(0);
  const [candles, setCandles] = useState<{
    spot_1m: number;
    spot_5m: number;
    fut_1m: number;
    fut_5m: number;
  } | null>(null);

  // Polled state
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<EntrySignal[]>([]);
  const [signals, setSignals] = useState<SignalEvent[]>([]);
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [excursions, setExcursions] = useState<TradeExcursion[]>([]);

  // Refs for cleanup
  const wsRef = useRef<{ close: () => void } | null>(null);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  // WS signal accumulator (push-based)
  const signalAccRef = useRef<SignalEvent[]>([]);

  // Fetch functions
  const fetchOrders = useCallback(async () => {
    try {
      const data = await fetchAPI<OrdersResponse>("/api/orders/today");
      setOrders(data.orders);
    } catch {
      // Ignore
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await fetchAPI<EntriesResponse>("/api/entries/today");
      setEntries(data.entries);
    } catch {
      // Ignore
    }
  }, []);

  const fetchSignals = useCallback(async () => {
    try {
      const data = await fetchAPI<SignalsResponse>("/api/signals/history?count=100");
      setSignals(data.signals);
      signalAccRef.current = data.signals;
    } catch {
      // Ignore
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await fetchAPI<RiskMetrics>("/api/risk/metrics?days=30");
      setMetrics(data);
    } catch {
      // Ignore
    }
  }, []);

  const fetchExcursions = useCallback(async () => {
    try {
      const data = await fetchAPI<ExcursionsResponse>("/api/excursions/today");
      setExcursions(data.trades);
    } catch {
      // Ignore
    }
  }, []);

  // Setup WS + polling
  useEffect(() => {
    // Connect typed WebSocket
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
        setOrdersCount(data.today_orders_count);
        setCandles(data.candles);
      },
      onHeartbeat: (data) => setHeartbeat(data),
      onExcursion: (data) => setExcursions(data.trades),
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    });

    // Initial fetches
    fetchOrders();
    fetchEntries();
    fetchSignals();
    fetchMetrics();
    fetchExcursions();

    // Polling intervals
    const intervals = [
      setInterval(fetchOrders, 5000),
      setInterval(fetchEntries, 5000),
      setInterval(fetchMetrics, 60000),
      setInterval(fetchExcursions, 5000),
    ];
    intervalsRef.current = intervals;

    return () => {
      wsRef.current?.close();
      intervals.forEach(clearInterval);
    };
  }, [fetchOrders, fetchEntries, fetchSignals, fetchMetrics, fetchExcursions]);

  // Loading state
  if (!tickData && !connected) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0e17]">
        <div className="text-center">
          <div className="animate-pulse text-slate-400 text-lg">
            Connecting to bot...
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Make sure the trading bot is running
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-200">
      {/* Top Bar */}
      <TopBar
        tickData={tickData}
        heartbeat={heartbeat}
        connected={connected}
        botRunning={botRunning}
        killSwitch={killSwitch}
        ordersCount={ordersCount}
      />

      {/* Main Grid */}
      <div className="p-3 grid grid-cols-[1fr_1fr_340px] grid-rows-[auto_auto_auto] gap-3">
        {/* Row 1: Chart (span 2) + Signal Feed */}
        <div className="col-span-2">
          <CandlestickChart
            currentCandle={currentCandle}
            signals={signals}
            connected={connected}
          />
        </div>
        <div className="row-span-2">
          <SignalFeed signals={signals} />
        </div>

        {/* Row 2: Exposure Curve + Risk Metrics */}
        <div>
          <ExposureCurve entries={entries} />
        </div>
        <div>
          <RiskMetricsPanel metrics={metrics} />
        </div>

        {/* Row 3: Strategies + Orders/Entries + Controls/Performance */}
        <div>
          <StrategyCards strategies={strategies} />
        </div>
        <div className="space-y-3">
          <TradeExcursionPanel excursions={excursions} />
          <EnhancedOrderTable orders={orders} excursions={excursions} />
          <EntrySignalsTable entries={entries} />
        </div>
        <div className="space-y-3">
          <SystemControls
            killSwitch={killSwitch}
            candles={candles}
            heartbeat={heartbeat}
          />
          <StrategyPerformance metrics={metrics} />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-600 py-2 border-t border-slate-800">
        Built by{" "}
        <span className="text-slate-400 font-medium">Abhishek Choudhary</span>{" "}
        -- AI/ML Developer
      </div>
    </div>
  );
}
