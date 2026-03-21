"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ExplainModeContextType {
  enabled: boolean;
  toggle: () => void;
}

const ExplainModeContext = createContext<ExplainModeContextType>({
  enabled: false,
  toggle: () => {},
});

export function ExplainModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  return (
    <ExplainModeContext.Provider value={{ enabled, toggle: () => setEnabled((v) => !v) }}>
      {children}
    </ExplainModeContext.Provider>
  );
}

export function useExplainMode() {
  return useContext(ExplainModeContext);
}
