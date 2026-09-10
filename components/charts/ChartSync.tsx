import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { useChartPressState } from "victory-native";
import { useAnimatedReaction, runOnJS, useSharedValue, type SharedValue } from "react-native-reanimated";
import {
  civilTimeline,
  parseUnixTimes,
  type CivilParts,
} from "@/services/openMeteo";
import { useSettingsStore } from "@/stores";
import {
  buildXAxisConfig,
  chartPlotPadding,
  findNowIndex,
  plotXFromLayout,
  useChartColors,
  type ChartColors,
  type PlotXRange,
  type XAxisBundle,
} from "./shared";

export type { PlotXRange };

type ChartSyncValue = {
  hourly: Record<string, (number | null)[]>;
  time: number[];
  civils: CivilParts[];
  xAxis: XAxisBundle;
  colors: ChartColors;
  nowIdx: number | null;
  showYAxis: boolean;
  pad: ReturnType<typeof chartPlotPadding>;
  syncIdx: SharedValue<number>;
  plotX: PlotXRange | null;
  tooltipIdx: number | null;
};

const ChartSyncContext = createContext<ChartSyncValue | null>(null);

export function ChartSyncProvider({
  hourly,
  utcOffsetSeconds,
  children,
}: {
  hourly: Record<string, (number | null)[]>;
  utcOffsetSeconds: number;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const showYAxis = useSettingsStore((s) => s.showYAxisLabels);
  const colors = useChartColors();
  const syncIdx = useSharedValue(-1);
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);

  const time = useMemo(() => parseUnixTimes(hourly.time), [hourly]);
  const civils = useMemo(
    () => civilTimeline(time, utcOffsetSeconds),
    [time, utcOffsetSeconds]
  );
  const xAxis = useMemo(() => buildXAxisConfig(time, civils), [time, civils]);
  const nowIdx = useMemo(() => findNowIndex(time), [time]);
  const pad = useMemo(() => chartPlotPadding(showYAxis), [showYAxis]);
  const plotX = useMemo(
    () => plotXFromLayout(width, time.length, showYAxis),
    [width, time.length, showYAxis]
  );

  useAnimatedReaction(
    () => {
      const v = syncIdx.value;
      return v < 0 ? -1 : Math.round(v);
    },
    (cur, prev) => {
      if (cur === prev) return;
      if (cur < 0) runOnJS(setTooltipIdx)(null);
      else runOnJS(setTooltipIdx)(cur);
    }
  );

  const value = useMemo(
    () => ({
      hourly,
      time,
      civils,
      xAxis,
      colors,
      nowIdx,
      showYAxis,
      pad,
      syncIdx,
      plotX,
      tooltipIdx,
    }),
    [
      hourly,
      time,
      civils,
      xAxis,
      colors,
      nowIdx,
      showYAxis,
      pad,
      syncIdx,
      plotX,
      tooltipIdx,
    ]
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <ChartSyncContext.Provider value={value}>{children}</ChartSyncContext.Provider>
    </View>
  );
}

export function useChartSync(): ChartSyncValue {
  const ctx = useContext(ChartSyncContext);
  if (!ctx) {
    throw new Error("useChartSync must be used within ChartSyncProvider");
  }
  return ctx;
}

export function useTooltipPress(initY: Record<string, number>) {
  const { syncIdx } = useChartSync();
  const { state: pressState, isActive } = useChartPressState({
    x: 0 as number,
    y: initY,
  });

  useAnimatedReaction(
    () => ({
      active: pressState.isActive.value,
      xVal: pressState.x.value.value as number,
    }),
    (cur, prev) => {
      if (cur.active) {
        syncIdx.value = cur.xVal;
      } else if (prev?.active) {
        syncIdx.value = -1;
      }
    }
  );

  return { pressState, isActive };
}
