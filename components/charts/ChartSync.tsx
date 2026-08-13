import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

type ChartSyncValue = {
  /** Fractional time index while syncing; -1 when inactive. */
  syncIdx: SharedValue<number>;
};

const ChartSyncContext = createContext<ChartSyncValue | null>(null);

export function ChartSyncProvider({ children }: { children: ReactNode }) {
  const syncIdx = useSharedValue(-1);
  const value = useMemo(() => ({ syncIdx }), [syncIdx]);
  return (
    <ChartSyncContext.Provider value={value}>{children}</ChartSyncContext.Provider>
  );
}

export function useChartSync(): ChartSyncValue {
  const ctx = useContext(ChartSyncContext);
  if (!ctx) {
    throw new Error("useChartSync must be used within ChartSyncProvider");
  }
  return ctx;
}
