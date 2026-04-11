"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useExplainMode } from "@/contexts/ExplainModeContext";

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
  const [open, setOpen] = useState(false);
  const { enabled: explainMode, toggle: toggleExplain } = useExplainMode();

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0d0d14] border-b border-[#1e1e2e] h-11 flex items-center px-3 gap-3">
        <button
          onClick={() => setOpen(!open)}
          className="text-slate-400 hover:text-white p-1"
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {open ? (
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            ) : (
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
            )}
          </svg>
        </button>
        <span className="text-sm font-bold text-slate-200 tracking-widest font-mono uppercase">AlgoTerminal</span>
      </div>

      {/* Overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static z-40 w-48 bg-[#0d0d14] border-r border-[#1e1e2e] flex flex-col min-h-screen
          transition-transform duration-200 top-11 md:top-0
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
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
                onClick={() => setOpen(false)}
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
        {/* Explain Mode Toggle */}
        <div className="px-2 pb-2">
          <button
            onClick={toggleExplain}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
              explainMode
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-lg shadow-cyan-500/10"
                : "text-slate-500 hover:bg-[#12121a] hover:text-slate-300 border border-transparent"
            }`}
          >
            <span className={`text-sm ${explainMode ? "text-cyan-400" : "text-slate-600"}`}>?</span>
            <span>Explain Mode</span>
            {explainMode && (
              <span className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-full animate-pulse">
                ON
              </span>
            )}
          </button>
        </div>

        <div className="p-4 border-t border-[#1e1e2e]">
          <p className="text-[10px] text-slate-600 font-mono">Abhishek Choudhary</p>
          <p className="text-[10px] text-slate-700 font-mono">AI/ML Developer</p>
        </div>
      </aside>
    </>
  );
}
