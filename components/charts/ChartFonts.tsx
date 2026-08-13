import { createContext, useContext, type ReactNode } from "react";
import { useFont, type SkFont } from "@shopify/react-native-skia";

type ChartFonts = {
  axisFont: SkFont | null;
  alertFont: SkFont | null;
};

const ChartFontsContext = createContext<ChartFonts | null>(null);

export function ChartFontsProvider({ children }: { children: ReactNode }) {
  const axisFont = useFont(require("../../assets/fonts/SpaceMono-Regular.ttf"), 11);
  const alertFont = useFont(require("../../assets/fonts/SpaceMono-Regular.ttf"), 10);
  return (
    <ChartFontsContext.Provider value={{ axisFont, alertFont }}>
      {children}
    </ChartFontsContext.Provider>
  );
}

export function useChartFonts(): ChartFonts {
  const ctx = useContext(ChartFontsContext);
  if (!ctx) {
    throw new Error("useChartFonts must be used within ChartFontsProvider");
  }
  return ctx;
}
