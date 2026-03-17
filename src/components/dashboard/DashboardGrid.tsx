"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { GridLayout, useContainerWidth, type LayoutItem, type Layout } from "react-grid-layout";
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
  EntrySide,
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
import EquityCurveWidget from "./widgets/EquityCurveWidget";
import RRDistributionWidget from "./widgets/RRDistributionWidget";
import RiskGaugeWidget from "./widgets/RiskGaugeWidget";
import TradeStatsWidget from "./widgets/TradeStatsWidget";
import TimeHeatmapWidget from "./widgets/TimeHeatmapWidget";

// GridLayout requires explicit width — use useContainerWidth hook

// ── Layout persistence ──────────────────────────────────────────────────────
const LAYOUT_KEY = "algo-dashboard-layout-v2";

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "chart",       x: 0, y: 0,  w: 8, h: 9,  minW: 4, minH: 5  },
  { i: "signals",     x: 8, y: 0,  w: 4, h: 15, minW: 2, minH: 6  },
  { i: "exposure",    x: 0, y: 9,  w: 4, h: 6,  minW: 3, minH: 4  },
  { i: "riskmetrics", x: 4, y: 9,  w: 4, h: 6,  minW: 3, minH: 4  },
  { i: "strategies",  x: 0, y: 15, w: 4, h: 12, minW: 3, minH: 6  },
  { i: "excursion",   x: 4, y: 15, w: 4, h: 8,  minW: 3, minH: 5  },
  { i: "orders",      x: 4, y: 23, w: 4, h: 8,  minW: 3, minH: 4  },
  { i: "entries",     x: 4, y: 31, w: 4, h: 6,  minW: 3, minH: 4  },
  { i: "controls",    x: 8, y: 15, w: 4, h: 9,  minW: 2, minH: 6  },
  { i: "performance", x: 8, y: 24, w: 4, h: 6,  minW: 2, minH: 4  },
  { i: "equity",      x: 0, y: 27, w: 6, h: 7,  minW: 3, minH: 4  },
  { i: "rrdist",      x: 6, y: 27, w: 6, h: 7,  minW: 3, minH: 4  },
  { i: "tradestats",  x: 0, y: 34, w: 4, h: 8,  minW: 3, minH: 5  },
  { i: "heatmap",     x: 4, y: 37, w: 4, h: 8,  minW: 3, minH: 5  },
  { i: "riskgauge",   x: 8, y: 30, w: 4, h: 8,  minW: 2, minH: 6  },
];

function loadLayout(): LayoutItem[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const saved: LayoutItem[] = JSON.parse(raw);
      // Merge: keep saved positions but add any new widgets from DEFAULT_LAYOUT
      const savedIds = new Set(saved.map((l) => l.i));
      const extra = DEFAULT_LAYOUT.filter((l) => !savedIds.has(l.i));
      return [...saved, ...extra];
    }
  } catch {}
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: LayoutItem[]) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {}
}

// ── Drag-handle wrapper ─────────────────────────────────────────────────────
function Widget({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      {/* Slim drag handle strip */}
      <div className="drag-handle flex-shrink-0 h-2.5 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-slate-700/60 rounded-t-xl transition-colors">
        <div className="w-8 h-0.5 bg-slate-600 rounded" />
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function DashboardGrid() {
  const { width: containerWidth, containerRef: gridContainerRef } = useContainerWidth({ initialWidth: 1200 });

  const [connected, setConnected] = useState(false);
  const [tickData, setTickData] = useState<TickData | null>(null);
  const [currentCandle, setCurrentCandle] = useState<CandleUpdate | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null);

  const [strategies, setStrategies] = useState<Strategies | null>(null);
  const [botRunning, setBotRunning] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  const [entrySide, setEntrySide] = useState<EntrySide>("both");
  const [ordersCount, setOrdersCount] = useState(0);
  const [candles, setCandles] = useState<{
    spot_1m: number; spot_5m: number; fut_1m: number; fut_5m: number;
  } | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<EntrySignal[]>([]);
  const [signals, setSignals] = useState<SignalEvent[]>([]);
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [excursions, setExcursions] = useState<TradeExcursion[]>([]);

  const [layout, setLayout] = useState<LayoutItem[]>(loadLayout);

  const wsRef = useRef<{ close: () => void } | null>(null);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const signalAccRef = useRef<SignalEvent[]>([]);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await fetchAPI<OrdersResponse>("/api/orders/today");
      setOrders(data.orders);
    } catch {}
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await fetchAPI<EntriesResponse>("/api/entries/today");
      setEntries(data.entries);
    } catch {}
  }, []);

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
        setOrdersCount(data.today_orders_count);
        setCandles(data.candles);
      },
      onHeartbeat: (data) => setHeartbeat(data),
      onExcursion: (data) => setExcursions(data.trades),
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    });

    fetchOrders(); fetchEntries(); fetchSignals(); fetchMetrics(); fetchExcursions();

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

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    const mutable = [...newLayout];
    setLayout(mutable);
    saveLayout(mutable);
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }, []);

  if (!tickData && !connected) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0e17]">
        <div className="text-center">
          <div className="animate-pulse text-slate-400 text-lg">Connecting to bot...</div>
          <p className="text-xs text-slate-500 mt-2">Make sure the trading bot is running</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-200">
      <TopBar
        tickData={tickData}
        heartbeat={heartbeat}
        connected={connected}
        botRunning={botRunning}
        killSwitch={killSwitch}
        ordersCount={ordersCount}
      />

      {/* Toolbar: reset layout */}
      <div className="px-3 pt-1 pb-0.5 flex justify-end gap-2">
        <span className="text-[10px] text-slate-600 self-center">
          Drag handle ▬ to move · resize from corner
        </span>
        <button
          onClick={resetLayout}
          className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500 transition-colors"
        >
          Reset Layout
        </button>
      </div>

      <div ref={gridContainerRef as React.RefObject<HTMLDivElement>}>
      <GridLayout
        className="layout"
        layout={layout}
        width={containerWidth || 1200}
        gridConfig={{
          cols: 12,
          rowHeight: 50,
          margin: [8, 8] as const,
          containerPadding: [12, 4] as const,
        }}
        dragConfig={{
          enabled: true,
          handle: ".drag-handle",
        }}
        resizeConfig={{
          enabled: true,
          handles: ["se", "sw", "ne", "nw"] as const,
        }}
        onLayoutChange={handleLayoutChange}
      >
        <div key="chart">
          <Widget>
            <CandlestickChart currentCandle={currentCandle} signals={signals} connected={connected} />
          </Widget>
        </div>

        <div key="signals">
          <Widget>
            <SignalFeed signals={signals} />
          </Widget>
        </div>

        <div key="exposure">
          <Widget>
            <ExposureCurve entries={entries} />
          </Widget>
        </div>

        <div key="riskmetrics">
          <Widget>
            <RiskMetricsPanel metrics={metrics} />
          </Widget>
        </div>

        <div key="strategies">
          <Widget>
            <StrategyCards strategies={strategies} />
          </Widget>
        </div>

        <div key="excursion">
          <Widget>
            <TradeExcursionPanel excursions={excursions} />
          </Widget>
        </div>

        <div key="orders">
          <Widget>
            <EnhancedOrderTable orders={orders} excursions={excursions} />
          </Widget>
        </div>

        <div key="entries">
          <Widget>
            <EntrySignalsTable entries={entries} />
          </Widget>
        </div>

        <div key="controls">
          <Widget>
            <SystemControls
              killSwitch={killSwitch}
              entrySide={entrySide}
              onEntrySideChange={setEntrySide}
              candles={candles}
              heartbeat={heartbeat}
            />
          </Widget>
        </div>

        <div key="performance">
          <Widget>
            <StrategyPerformance metrics={metrics} />
          </Widget>
        </div>

        <div key="equity">
          <Widget>
            <EquityCurveWidget excursions={excursions} />
          </Widget>
        </div>

        <div key="rrdist">
          <Widget>
            <RRDistributionWidget excursions={excursions} />
          </Widget>
        </div>

        <div key="tradestats">
          <Widget>
            <TradeStatsWidget excursions={excursions} />
          </Widget>
        </div>

        <div key="heatmap">
          <Widget>
            <TimeHeatmapWidget entries={entries} />
          </Widget>
        </div>

        <div key="riskgauge">
          <Widget>
            <RiskGaugeWidget metrics={metrics} />
          </Widget>
        </div>
      </GridLayout>
      </div>

      <div className="text-center text-xs text-slate-600 py-2 border-t border-slate-800">
        Built by <span className="text-slate-400 font-medium">Abhishek Choudhary</span> — AI/ML Developer
      </div>
    </div>
  );
}
