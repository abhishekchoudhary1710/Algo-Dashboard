"use client";

import type {
  Strategies,
  SwingStrategy,
  DivergenceStrategy,
  PivotData,
  FirstCandle,
} from "@/lib/api";
import { postAPI } from "@/lib/api";

interface StrategyCardsProps {
  strategies: Strategies | null;
}

function formatTime(timeStr: string): string {
  if (!timeStr || timeStr === "None" || timeStr === "N/A") return "--";
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    const match = timeStr.match(/(\d{2}:\d{2})/);
    return match ? match[1] : timeStr.slice(0, 16);
  }
}

function PivotSection({
  pivots,
  label,
  type,
}: {
  pivots?: PivotData;
  label: string;
  type: "highs" | "lows";
}) {
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
      <div className="space-y-0.5 max-h-24 overflow-y-auto">
        {pivots.unbroken.map((p) => (
          <div key={p.pivot_number} className="flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-slate-300">P{p.pivot_number}</span>
            <span className="text-slate-400">
              {formatTime(p.time)} @ {p.price.toFixed(2)}
            </span>
          </div>
        ))}
        {pivots.broken.map((p) => (
          <div key={p.pivot_number} className="flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-slate-500 line-through">P{p.pivot_number}</span>
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

function FirstCandleSection({
  fc,
  direction,
}: {
  fc?: FirstCandle | null;
  direction: "bearish" | "bullish";
}) {
  if (!fc) return null;
  const breakPrice =
    direction === "bearish" ? fc.breakdown_price : fc.breakout_price;
  const breakLabel = direction === "bearish" ? "Breakdown" : "Breakout";
  return (
    <div className="mt-2 pt-2 border-t border-slate-700/50">
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            fc.broken ? "bg-red-500" : "bg-yellow-500"
          } flex-shrink-0`}
        />
        <span className="text-slate-400">
          1st Candle {direction === "bearish" ? "Low" : "High"}:{" "}
          {fc.price.toFixed(2)}
        </span>
        {fc.broken ? (
          <span className="text-red-400">
            {breakLabel}: {breakPrice?.toFixed(2)}
          </span>
        ) : (
          <span className="text-yellow-400">Unbroken</span>
        )}
      </div>
    </div>
  );
}

function SwingCard({
  name,
  strategy,
  strategyKey,
  accentColor,
}: {
  name: string;
  strategy: SwingStrategy;
  strategyKey: string;
  accentColor: string;
}) {
  const handleToggle = async () => {
    try {
      await postAPI("/api/strategy/toggle", {
        strategy: strategyKey,
        enabled: !strategy.active,
      });
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className={`bg-slate-800 rounded-xl p-3 border border-slate-700 border-l-2`}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-white">{name}</p>
        <button
          onClick={handleToggle}
          className={`w-2.5 h-2.5 rounded-full cursor-pointer ${
            strategy.active ? "bg-green-500" : "bg-slate-500"
          }`}
          title={strategy.active ? "Active (click to disable)" : "Inactive (click to enable)"}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-slate-400">
          D: <span className="text-slate-200">{strategy.D?.toFixed(2) || "--"}</span>
        </p>
        {strategy.H1 != null && (
          <p className="text-xs text-slate-400">
            H1: <span className="text-slate-200">{strategy.H1.toFixed(2)}</span>
            {strategy.L1 != null && (
              <>
                {" "}| L1: <span className="text-slate-200">{strategy.L1.toFixed(2)}</span>
              </>
            )}
          </p>
        )}
        {strategy.A != null && (
          <p className="text-xs text-slate-400">
            A: <span className="text-slate-200">{strategy.A.toFixed(2)}</span>
            {strategy.B != null && (
              <>
                {" "}| B: <span className="text-slate-200">{strategy.B.toFixed(2)}</span>
              </>
            )}
            {strategy.C != null && (
              <>
                {" "}| C: <span className="text-slate-200">{strategy.C.toFixed(2)}</span>
              </>
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

function DivergenceCard({
  name,
  strategy,
  strategyKey,
  direction,
  accentColor,
}: {
  name: string;
  strategy: DivergenceStrategy;
  strategyKey: string;
  direction: "bearish" | "bullish";
  accentColor: string;
}) {
  const pivotType = direction === "bearish" ? "highs" : "lows";
  const pivotLabel = direction === "bearish" ? "Pivot Highs" : "Pivot Lows";

  const handleToggle = async () => {
    try {
      await postAPI("/api/strategy/toggle", {
        strategy: strategyKey,
        enabled: !strategy.active,
      });
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="bg-slate-800 rounded-xl p-3 border border-slate-700 border-l-2"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-white">{name}</p>
        <button
          onClick={handleToggle}
          className={`w-2.5 h-2.5 rounded-full cursor-pointer ${
            strategy.active ? "bg-green-500 animate-pulse" : "bg-slate-500"
          }`}
          title={strategy.active ? "Active (click to disable)" : "Inactive (click to enable)"}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-slate-400">
          Active Divergences:{" "}
          <span
            className={
              strategy.active ? "text-yellow-400 font-medium" : "text-slate-200"
            }
          >
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
          </div>
        ))}
      </div>
      <PivotSection pivots={strategy.pivots} label={pivotLabel} type={pivotType} />
      <FirstCandleSection fc={strategy.first_candle} direction={direction} />
    </div>
  );
}

export default function StrategyCards({ strategies }: StrategyCardsProps) {
  if (!strategies) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <p className="text-xs text-slate-500">Waiting for strategy data...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <SwingCard
        name="Bull Swing"
        strategy={strategies.bullish_swing}
        strategyKey="bullish_swing"
        accentColor="#22c55e"
      />
      <SwingCard
        name="Bear Swing"
        strategy={strategies.bearish_swing}
        strategyKey="bearish_swing"
        accentColor="#ef4444"
      />
      <DivergenceCard
        name="Bull Divergence"
        strategy={strategies.bullish_divergence}
        strategyKey="bullish_divergence"
        direction="bullish"
        accentColor="#3b82f6"
      />
      <DivergenceCard
        name="Bear Divergence"
        strategy={strategies.bearish_divergence}
        strategyKey="bearish_divergence"
        direction="bearish"
        accentColor="#a855f7"
      />
    </div>
  );
}
