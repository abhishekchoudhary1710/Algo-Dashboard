import MonthlyPnl from "@/components/MonthlyPnl";

export default function PnlPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Profit & Loss</h2>
      <MonthlyPnl />
    </div>
  );
}
