"use client";

import type { RiskMetrics } from "@/lib/api";

const DAILY_RISK_LIMIT = 50000; // ₹50,000 default daily limit

interface RiskGaugeWidgetProps {
  metrics: RiskMetrics | null;
}

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export default function RiskGaugeWidget({ metrics }: RiskGaugeWidgetProps) {
  const totalRisk = metrics?.total_risk ?? 0;
  const pct = Math.min((totalRisk / DAILY_RISK_LIMIT) * 100, 100);

  const gaugeColor =
    pct >= 90 ? "#ef4444" : pct >= 70 ? "#f97316" : pct >= 50 ? "#eab308" : "#22c55e";

  const cx = 80, cy = 78, r = 55, stroke = 10;
  const START = -210, TOTAL = 240;
  const endDeg = START + (pct / 100) * TOTAL;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-700 flex-shrink-0">
        <span className="text-xs text-slate-400 font-medium">Daily Risk Gauge</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-2 gap-1">
        <svg width={160} height={120} viewBox="0 0 160 120">
          {/* Track */}
          <path
            d={describeArc(cx, cy, r, START, START + TOTAL)}
            fill="none"
            stroke="#1e293b"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Progress */}
          {pct > 0 && (
            <path
              d={describeArc(cx, cy, r, START, endDeg)}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          )}
          {/* Center text */}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fill="white"
            fontSize={20}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {pct.toFixed(0)}%
          </text>
          <text
            x={cx}
            y={cy + 11}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize={9}
          >
            ₹{(totalRisk / 1000).toFixed(1)}K of ₹{(DAILY_RISK_LIMIT / 1000).toFixed(0)}K
          </text>
        </svg>

        <div className="grid grid-cols-2 gap-2 w-full px-2 text-center">
          <div className="bg-slate-700/50 rounded p-1.5">
            <p className="text-[9px] text-slate-400 uppercase">Signals</p>
            <p className="text-sm font-bold text-white font-mono">
              {metrics?.total_signals ?? 0}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded p-1.5">
            <p className="text-[9px] text-slate-400 uppercase">Trades</p>
            <p className="text-sm font-bold text-white font-mono">
              {metrics?.total_trades ?? 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
