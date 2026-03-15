"use client";

import type { RiskMetrics } from "@/lib/api";

interface RiskMetricsPanelProps {
  metrics: RiskMetrics | null;
}

function MetricCard({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold font-mono mt-1 ${color || "text-white"}`}>
        {value}
        {suffix && <span className="text-xs text-slate-400 ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}

export default function RiskMetricsPanel({ metrics }: RiskMetricsPanelProps) {
  if (!metrics) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <p className="text-xs text-slate-500">Loading risk metrics...</p>
      </div>
    );
  }

  const winColor =
    metrics.win_rate >= 60
      ? "text-green-400"
      : metrics.win_rate >= 40
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
      <p className="text-xs text-slate-400 font-medium mb-2">Risk Metrics (30d)</p>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label="Win Rate"
          value={`${metrics.win_rate}`}
          suffix="%"
          color={winColor}
        />
        <MetricCard
          label="Total Trades"
          value={`${metrics.total_trades}`}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${metrics.max_drawdown}`}
          suffix="%"
          color="text-red-400"
        />
        <MetricCard
          label="Avg R:R"
          value={`${metrics.avg_risk_reward}`}
          color={metrics.avg_risk_reward >= 2 ? "text-green-400" : "text-yellow-400"}
        />
        <MetricCard
          label="Sharpe"
          value={metrics.sharpe_proxy !== null ? `${metrics.sharpe_proxy}` : "N/A"}
          color={
            metrics.sharpe_proxy === null
              ? "text-slate-500"
              : metrics.sharpe_proxy >= 1
              ? "text-green-400"
              : "text-yellow-400"
          }
        />
        <MetricCard
          label="Total Risk"
          value={`${(metrics.total_risk / 1000).toFixed(1)}`}
          suffix="K"
        />
      </div>
    </div>
  );
}
