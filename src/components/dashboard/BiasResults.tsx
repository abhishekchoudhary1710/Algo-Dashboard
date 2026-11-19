"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BiasResultsResponse, BiasTrade, DayBias } from "@/lib/bias-results";

const biasNames: Record<DayBias, string> = {
  LONG: "Bullish", SHORT: "Bearish", BOTH: "Both directions", NONE: "Unmarked",
};
const money = (value: number | null | undefined) => value == null ? "—" :
  `${value < 0 ? "−" : value > 0 ? "+" : ""}₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pnlClass = (value: number) => value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-slate-400";
const panel = "rounded-xl border border-[#252536] bg-[#12121a]";
const input = "rounded-md border border-[#303044] bg-[#0d0d14] px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500";

function BiasBadge({ bias }: { bias: DayBias | null }) {
  const color = bias === "LONG" ? "bg-emerald-500/15 text-emerald-300" :
    bias === "SHORT" ? "bg-red-500/15 text-red-300" : bias === "BOTH" ? "bg-sky-500/15 text-sky-300" : "bg-slate-700/30 text-slate-400";
  return <span className={`rounded px-2 py-1 text-[10px] whitespace-nowrap ${color}`}>{biasNames[bias ?? "NONE"]}</span>;
}

function Execution({ trade }: { trade: BiasTrade }) {
  const text = trade.execution_group === "paper" ? "Paper" :
    trade.execution_group === "rejected" ? "Rejected · hypothetical" :
    trade.execution_group === "live" ? "Live fill" : trade.execution_status;
  return <span className={trade.execution_group === "rejected" ? "text-amber-300" : "text-slate-400"}>{text}</span>;
}

function EquityCurve({ points }: { points: { time: string; pnl: number }[] }) {
  if (!points.length) return <p className="py-8 text-center text-sm text-slate-500">No closed trades in this selection.</p>;
  const values = [0, ...points.map(p => p.pnl)];
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const coordinates = values.map((v, i) => `${30 + i * 920 / Math.max(values.length - 1, 1)},${155 - (v - min) * 130 / range}`).join(" ");
  const zero = 155 - (0 - min) * 130 / range;
  return <div>
    <svg viewBox="0 0 980 185" className="w-full" role="img" aria-label="Cumulative gross P&L at closed-trade exits">
      <line x1="30" x2="950" y1={zero} y2={zero} stroke="#475569" strokeDasharray="4 4" />
      <polyline points={coordinates} fill="none" stroke={points[points.length - 1].pnl >= 0 ? "#34d399" : "#f87171"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <text x="30" y="15" fill="#94a3b8" fontSize="11">{money(max)}</text>
      <text x="30" y="180" fill="#94a3b8" fontSize="11">{points[0].time.slice(0, 10)}</text>
      <text x="950" y="180" textAnchor="end" fill="#94a3b8" fontSize="11">{points[points.length - 1].time.slice(0, 10)} · {money(points[points.length - 1].pnl)}</text>
    </svg>
  </div>;
}

export default function BiasResults({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<"aligned" | "all">("aligned");
  const [bias, setBias] = useState<DayBias | "ALL">("ALL");
  const [execution, setExecution] = useState("all");
  const [history, setHistory] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tradeLimit, setTradeLimit] = useState("");
  const [entryFrom, setEntryFrom] = useState("");
  const [entryBefore, setEntryBefore] = useState("");
  const [day, setDay] = useState("");
  const [data, setData] = useState<BiasResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let request = 0;
    setData(null); setLoading(true); setDay("");
    if (tradeLimit && (!Number.isInteger(Number(tradeLimit)) || Number(tradeLimit) < 1 || Number(tradeLimit) > 1000)) {
      setError("Enter a whole number from 1 to 1000, or leave trades per day blank for all trades.");
      setLoading(false);
      return () => controller.abort();
    }
    const load = async () => {
      const current = ++request;
      const q = new URLSearchParams({ mode, bias, execution, history });
      if (from) q.set("date_from", from);
      if (to) q.set("date_to", to);
      if (tradeLimit) q.set("first_n_per_day", tradeLimit);
      if (entryFrom) q.set("entry_from", entryFrom);
      if (entryBefore) q.set("entry_before", entryBefore);
      try {
        const response = await fetch(`/backend/api/bias/results?${q}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          const failure = await response.json().catch(() => null);
          throw new Error(typeof failure?.detail === "string" ? failure.detail : "Could not load bias results. Please check the filters and retry.");
        }
        const result: BiasResultsResponse = await response.json();
        if (!controller.signal.aborted && request === current) { setData(result); setError(null); }
      } catch (e) {
        if (!controller.signal.aborted && request === current) setError(e instanceof Error ? e.message : "Could not load results.");
      } finally {
        if (!controller.signal.aborted && request === current) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [mode, bias, execution, history, from, to, tradeLimit, entryFrom, entryBefore]);

  const summary = data?.summary;
  const trades = data?.trades.filter(t => !day || t.date === day) ?? [];
  const exportTrades = () => {
    const fields: (keyof BiasTrade)[] = ["date", "day_bias", "trade_id", "option_type", "strike", "quantity", "status", "entry_price", "exit_price", "realized_pnl", "execution_group", "historical"];
    const csv = [fields.join(","), ...trades.map(t => fields.map(f => JSON.stringify(t[f] ?? "")).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `bias-results-${mode}${day ? `-${day}` : ""}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <section className={`${compact ? `${panel} p-4` : "space-y-5"}`} aria-label="Saved daily bias results">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div><h2 className={`${compact ? "text-sm" : "text-xl"} font-semibold text-slate-100`}>Results by your daily bias</h2>
        <p className="mt-1 text-xs text-slate-500">Bullish → CE · Bearish → PE · Both → either direction</p></div>
      {compact ? <Link href="/bias-results" className="text-xs text-emerald-400 hover:underline">View daily results →</Link> :
        <span className="rounded border border-amber-700/40 px-3 py-1 text-[11px] text-amber-300">Recorded outcomes · gross P&amp;L</span>}
    </div>

    {!compact && <div className={`${panel} p-4 space-y-4`}>
      <div className="flex flex-wrap gap-2">
        {([['aligned', 'Matches my bias'], ['all', 'All recorded trades']] as const).map(([key, label]) => <button key={key} onClick={() => setMode(key)} aria-pressed={mode === key}
          className={`rounded-md border px-4 py-2 text-xs ${mode === key ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>{label}</button>)}
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="space-y-1 text-xs text-slate-500"><span className="block">Day bias</span><select aria-label="Day bias" className={input} value={bias} onChange={e => setBias(e.target.value as DayBias | "ALL")}>
          <option value="ALL">All biases</option>{Object.entries(biasNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label className="space-y-1 text-xs text-slate-500"><span className="block">Execution</span><select aria-label="Execution" className={input} value={execution} onChange={e => setExecution(e.target.value)}>
          <option value="all">All recorded outcomes</option><option value="paper">Paper fills</option><option value="rejected">Rejected / hypothetical</option><option value="live">Live fills</option>
        </select></label>
        <label className="space-y-1 text-xs text-slate-500"><span className="block">History</span><select aria-label="History" className={input} value={history} onChange={e => setHistory(e.target.value)}>
          <option value="all">Full history</option><option value="forward">Without historical backfills</option><option value="historical">Historical restatements</option>
        </select></label>
        <label className="space-y-1 text-xs text-slate-500"><span className="block">From</span><input aria-label="From date" type="date" value={from} max={to || undefined} className={input} onChange={e => setFrom(e.target.value)} /></label>
        <label className="space-y-1 text-xs text-slate-500"><span className="block">To</span><input aria-label="To date" type="date" value={to} min={from || undefined} className={input} onChange={e => setTo(e.target.value)} /></label>
      </div>
      <div className="flex flex-wrap gap-3 items-end border-t border-[#252536] pt-4">
        <label className="space-y-1 text-xs text-slate-500"><span className="block">First trades per day</span><input aria-label="First trades per day" type="number" min="1" max="1000" step="1" inputMode="numeric" placeholder="All trades" value={tradeLimit} className={`${input} w-36`} onChange={e => setTradeLimit(e.target.value)} /></label>
        <label className="space-y-1 text-xs text-slate-500"><span className="block">Entry from (IST)</span><input aria-label="Entry from (IST)" type="time" value={entryFrom} className={input} onChange={e => setEntryFrom(e.target.value)} /></label>
        <label className="space-y-1 text-xs text-slate-500"><span className="block">Entry before (IST)</span><input aria-label="Entry before (IST)" type="time" value={entryBefore} className={input} onChange={e => setEntryBefore(e.target.value)} /></label>
        <button type="button" onClick={() => { setEntryFrom(""); setEntryBefore("12:30"); }} className="rounded-md border border-emerald-500/40 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/10">Before 12:30</button>
        {(entryFrom || entryBefore) && <button type="button" onClick={() => { setEntryFrom(""); setEntryBefore(""); }} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200">All times</button>}
        {tradeLimit && <button type="button" onClick={() => setTradeLimit("")} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200">All trades per day</button>}
      </div>
      <p className="text-xs text-slate-500">{mode === 'aligned' ? 'Shows recorded trades matching your saved bias, across PLAN and SHADOW streams.' : 'Shows every recorded trade, including trades against your bias.'} {tradeLimit ? `Keeps the first ${tradeLimit} matching trade${tradeLimit === '1' ? '' : 's'} per day, earliest entry first.` : 'Leave the trade count blank to include all matching trades.'} Time filters apply before the daily limit. Entry start is included; the cutoff is excluded. All times are IST.</p>
    </div>}

    {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>}
    {loading && <p role="status" className="py-4 text-sm text-slate-500">Loading saved bias results…</p>}
    {data && <>
      <div className={`grid grid-cols-2 ${compact ? 'lg:grid-cols-4' : 'lg:grid-cols-6'} gap-3`}>
        {[
          { label: 'Closed trades', value: String(summary?.closed), color: '' },
          { label: 'Win rate', value: summary?.win_pct == null ? '—' : `${summary.win_pct}%`, color: '' },
          { label: 'Gross P&L', value: money(summary?.pnl), color: pnlClass(summary?.pnl ?? 0) },
          { label: 'Profit factor', value: summary?.profit_factor?.toFixed(2) ?? '—', color: '' },
          ...(!compact ? [{ label: 'Max closed-trade drawdown', value: `₹${summary?.max_drawdown.toLocaleString('en-IN')}`, color: 'text-red-300' },
            { label: 'Average per closed trade', value: money(summary?.avg_pnl), color: pnlClass(summary?.avg_pnl ?? 0) }] : []),
        ].map(card => <div key={card.label} className={`${compact ? 'bg-[#0d0d14] rounded-lg' : panel} p-3`}><p className="text-[10px] text-slate-500 uppercase tracking-wide">{card.label}</p><p className={`mt-2 font-mono text-lg font-semibold ${card.color || 'text-slate-200'}`}>{card.value}</p></div>)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        {data.by_bias.map(row => <button key={row.bias} disabled={compact} onClick={() => setBias(row.bias)} className={`${compact ? 'border border-[#252536] rounded-lg' : panel} text-left p-3 disabled:cursor-default hover:border-slate-600`}>
          <BiasBadge bias={row.bias} /><span className={`block mt-3 font-mono font-semibold ${pnlClass(row.pnl)}`}>{money(row.pnl)}</span>
          <span className="block mt-1 text-[11px] text-slate-500">{row.closed} closed · {row.win_pct == null ? '—' : `${row.win_pct}%`} wins</span>
        </button>)}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{data.coverage.labelled_days}/{data.coverage.recorded_days} recorded trade days labelled · {summary?.virtual} virtual records · {summary?.rejected} rejected outcomes · {summary?.open} unresolved. P&amp;L excludes fees and open trades.</p>

      {!compact && <>
        <div className={`${panel} p-4`}><h3 className="text-sm text-slate-300 mb-2">Cumulative gross P&amp;L</h3><EquityCurve points={data.summary.equity} /></div>
        <div className={`${panel} overflow-x-auto`}><table className="w-full text-xs text-left"><caption className="text-left p-4 font-semibold text-slate-300">Monthly results</caption>
          <thead className="text-slate-500 border-y border-[#252536]"><tr>{['Month', 'Closed', 'Wins', 'Losses', 'Win rate', 'Gross P&L'].map(h => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>{data.monthly.map(row => <tr key={row.month} className="border-b border-[#252536]/60 text-slate-300"><td className="p-3">{row.month}</td><td className="p-3">{row.closed}</td><td className="p-3">{row.winners}</td><td className="p-3">{row.losers}</td><td className="p-3">{row.win_pct ?? '—'}%</td><td className={`p-3 font-mono ${pnlClass(row.pnl)}`}>{money(row.pnl)}</td></tr>)}</tbody>
        </table>{!data.monthly.length && <p className="p-5 text-sm text-slate-500">No closed trades match these filters.</p>}</div>
        <div className={`${panel} overflow-x-auto max-h-[440px]`}><table className="w-full text-xs text-left"><caption className="text-left p-4 font-semibold text-slate-300">Daily results — select a date to inspect its trades</caption>
          <thead className="text-slate-500 border-y border-[#252536]"><tr>{['Date', 'Your bias', 'Closed', 'Wins / losses', 'CE P&L', 'PE P&L', 'Gross P&L', 'Off-bias trades'].map(h => <th key={h} className="p-3 font-normal whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{data.daily.map(row => <tr key={row.date} className={`border-b border-[#252536]/60 ${day === row.date ? 'bg-emerald-500/5' : ''}`}>
            <td className="p-3"><button onClick={() => setDay(day === row.date ? '' : row.date)} className="text-emerald-300 underline underline-offset-4 whitespace-nowrap">{row.date}</button></td><td className="p-3"><BiasBadge bias={row.day_bias} /></td><td className="p-3 text-slate-300">{row.closed}</td><td className="p-3 text-slate-400">{row.winners} / {row.losers}</td><td className={`p-3 whitespace-nowrap ${pnlClass(row.ce_pnl)}`}>{money(row.ce_pnl)}</td><td className={`p-3 whitespace-nowrap ${pnlClass(row.pe_pnl)}`}>{money(row.pe_pnl)}</td><td className={`p-3 font-mono whitespace-nowrap ${pnlClass(row.pnl)}`}>{money(row.pnl)}</td><td className="p-3 text-slate-500">{row.off_bias_trades}</td>
          </tr>)}</tbody></table></div>
        <div className={`${panel} overflow-hidden`}>
          <div className="flex flex-wrap gap-3 items-center justify-between p-4"><h3 className="text-sm font-semibold text-slate-300">Trades{day ? ` · ${day}` : ''} <span className="text-slate-600">({trades.length})</span></h3><div className="flex gap-3">{day && <button onClick={() => setDay('')} className="text-xs text-slate-400 hover:text-slate-200">Show all dates</button>}<button onClick={exportTrades} className="text-xs text-emerald-400 hover:underline">Export CSV</button></div></div>
          <div className="overflow-auto max-h-[560px]"><table className="w-full text-xs text-left"><thead className="text-slate-500 border-y border-[#252536]"><tr>{['Entry', 'Your bias', 'Contract', 'Qty', 'Method', 'Execution', 'Exit', 'Gross P&L', 'History'].map(h => <th key={h} className="p-3 font-normal whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{trades.map(t => <tr key={t.trade_id} className="border-b border-[#252536]/60 text-slate-300"><td className="p-3 whitespace-nowrap"><Link href={`/trades/${encodeURIComponent(t.trade_id)}/chart`} className="hover:text-emerald-300" title="Open trade chart">{t.entry_time.slice(0,16)}</Link></td><td className="p-3"><BiasBadge bias={t.day_bias} /></td><td className="p-3 whitespace-nowrap">{t.strike} {t.option_type}{!t.aligned && <span className="ml-2 text-[10px] text-amber-400">off bias</span>}</td><td className="p-3">{t.quantity}</td><td className="p-3 whitespace-nowrap">{t.entry_method?.replaceAll('_', ' ') ?? '—'}</td><td className="p-3 whitespace-nowrap"><Execution trade={t} /></td><td className="p-3 whitespace-nowrap text-slate-500">{t.exit_reason ?? t.status}</td><td className={`p-3 font-mono whitespace-nowrap ${pnlClass(t.realized_pnl ?? 0)}`}>{t.status === 'CLOSED' ? money(t.realized_pnl) : '—'}</td><td className="p-3 text-slate-500 whitespace-nowrap">{t.historical ? 'Restated' : 'Recorded'}</td></tr>)}</tbody>
          </table>{!trades.length && <p className="p-5 text-sm text-slate-500">No trades match this selection.</p>}</div>
        </div>
        <p className="text-[11px] text-slate-500">{data.coverage.excluded_plan_copies} duplicate PLAN copies excluded. Historical restatements and rejected-order tracking are hypothetical results. Matching a hindsight bias label does not establish live profitability.</p>
      </>}
    </>}
  </section>;
}
