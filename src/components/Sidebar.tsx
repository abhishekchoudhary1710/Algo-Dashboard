"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "▣" },
  { href: "/chart", label: "Chart", icon: "▲" },
  { href: "/trades", label: "Trades", icon: "≡" },
  { href: "/orders", label: "Orders", icon: "◈" },
  { href: "/pnl", label: "P&L", icon: "₹" },
  { href: "/backtest", label: "Backtest", icon: "↺" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 bg-[#0d0d14] border-r border-[#1e1e2e] flex flex-col min-h-screen">
      <div className="p-4 border-b border-[#1e1e2e]">
        <h1 className="text-sm font-bold tracking-widest text-slate-200 font-mono uppercase">AlgoTerminal</h1>
        <p className="text-[10px] text-slate-600 mt-0.5 font-mono">NIFTY · NSE · NFO</p>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-xs font-mono transition-colors ${
                isActive
                  ? "bg-[#1e1e2e] text-emerald-400 border border-[#2a2a3e]"
                  : "text-slate-500 hover:bg-[#12121a] hover:text-slate-300"
              }`}
            >
              <span className={`text-sm ${isActive ? "text-emerald-400" : "text-slate-600"}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[#1e1e2e]">
        <p className="text-[10px] text-slate-600 font-mono">Abhishek Choudhary</p>
        <p className="text-[10px] text-slate-700 font-mono">AI/ML Developer</p>
      </div>
    </aside>
  );
}
