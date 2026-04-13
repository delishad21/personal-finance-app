"use client";

import { createContext, useContext, useMemo, useState } from "react";

export interface HeaderConfig {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backHref?: string;
}

interface HeaderContextValue {
  headerConfig: HeaderConfig | null;
  setHeaderConfig: (config: HeaderConfig | null) => void;
}

const HeaderContext = createContext<HeaderContextValue | null>(null);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null);

  const value = useMemo(
    () => ({
      headerConfig,
      setHeaderConfig,
    }),
    [headerConfig],
  );

  return (
    <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>
  );
}

export function useHeaderConfig() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error("useHeaderConfig must be used within HeaderProvider");
  }
  return context;
}
