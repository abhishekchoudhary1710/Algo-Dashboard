import MonthlyPnl from "@/components/MonthlyPnl";

export default function PnlPage() {
  return (
    <div className="space-y-4 p-3 md:p-6">
      <h2 className="text-lg font-mono font-bold tracking-widest uppercase text-slate-200">Profit & Loss</h2>
      <MonthlyPnl />
    </div>
  );
}
