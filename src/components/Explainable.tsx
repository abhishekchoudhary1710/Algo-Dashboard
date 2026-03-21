"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { useExplainMode } from "@/contexts/ExplainModeContext";

interface ExplainableProps {
  title: string;
  explanation: string;
  children: ReactNode;
  inline?: boolean; // use span instead of div
}

export default function Explainable({ title, explanation, children, inline }: ExplainableProps) {
  const { enabled } = useExplainMode();
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close popup on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close when explain mode is turned off
  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  if (!enabled) {
    return <>{children}</>;
  }

  if (inline) {
    return (
      <span
        className={`relative cursor-help inline-block ${
          enabled
            ? "ring-1 ring-dashed ring-cyan-500/40 rounded hover:ring-cyan-400/70 transition-all"
            : ""
        }`}
        onClick={(e) => {
          if (!enabled) return;
          e.stopPropagation();
          e.preventDefault();
          setOpen(!open);
        }}
      >
        {children}
        {enabled && !open && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cyan-500 text-black text-[9px] font-bold rounded-full flex items-center justify-center z-20 pointer-events-none shadow-lg shadow-cyan-500/30">
            ?
          </span>
        )}
        {open && (
          <div
            ref={popupRef}
            className="absolute z-50 top-full left-0 mt-2 w-80 max-w-[90vw] bg-[#1a1a2e] border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/10 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-2 left-4 w-4 h-4 bg-[#1a1a2e] border-l border-t border-cyan-500/30 rotate-45" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {title}
                </h4>
                <button onClick={(e) => { e.stopPropagation(); setOpen(false); }} className="text-slate-500 hover:text-slate-300 text-xs p-0.5">✕</button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{explanation}</p>
            </div>
          </div>
        )}
      </span>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative cursor-help ${
        enabled
          ? "ring-1 ring-dashed ring-cyan-500/40 rounded hover:ring-cyan-400/70 transition-all"
          : ""
      }`}
      onClick={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        e.preventDefault();
        setOpen(!open);
      }}
    >
      {children}

      {/* Small ? indicator */}
      {enabled && !open && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cyan-500 text-black text-[9px] font-bold rounded-full flex items-center justify-center z-20 pointer-events-none shadow-lg shadow-cyan-500/30">
          ?
        </span>
      )}

      {/* Explanation popup */}
      {open && (
        <div
          ref={popupRef}
          className="absolute z-50 top-full left-0 mt-2 w-80 max-w-[90vw] bg-[#1a1a2e] border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/10 p-4 animate-in fade-in slide-in-from-top-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Arrow */}
          <div className="absolute -top-2 left-4 w-4 h-4 bg-[#1a1a2e] border-l border-t border-cyan-500/30 rotate-45" />

          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {title}
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-slate-500 hover:text-slate-300 text-xs p-0.5"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
