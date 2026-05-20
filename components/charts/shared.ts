import { useState, useMemo } from "react";
import { useFont } from "@shopify/react-native-skia";
import { useChartPressState } from "victory-native";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";
import { useSettingsStore } from "@/stores";
import {
  type WeatherVariable,
  VARIABLE_UNITS,
  parseEnsembleSeries,
} from "@/services/openMeteo";

export type ChartDatum = Record<string, number>;

export interface ChartProps {
  hourly: Record<string, (number | null)[]>;
  variable: WeatherVariable;
}

export interface TooltipState {
  idx: number;
  xPos: number;
  yPos: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = DAY_NAMES[d.getDay()];
  const date = d.getDate();
  const h = d.getHours().toString().padStart(2, "0");
  return `${day} ${date}, ${h}:00`;
}

export function findNowIndex(time: string[]): number | null {
  if (time.length === 0) return null;
  const now = Date.now();
  const first = new Date(time[0]).getTime();
  const last = new Date(time[time.length - 1]).getTime();
  if (now < first || now > last) return null;

  for (let i = 0; i < time.length - 1; i++) {
    const t0 = new Date(time[i]).getTime();
    const t1 = new Date(time[i + 1]).getTime();
    if (now >= t0 && now <= t1) {
      return i + (now - t0) / (t1 - t0);
    }
  }
  return null;
}

export function useChartColors() {
  const { isDark } = useResolvedColorScheme();
  return useMemo(
    () => ({
      isDark,
      control: isDark ? "#38bdf8" : "#0891b2",
      member: isDark ? "rgba(56,189,248,0.15)" : "rgba(8,145,178,0.18)",
      outerSpread: isDark ? "rgba(56,189,248,0.12)" : "rgba(8,145,178,0.10)",
      innerSpread: isDark ? "rgba(56,189,248,0.25)" : "rgba(8,145,178,0.20)",
      axis: isDark ? "#94a3b8" : "#64748b",
      grid: isDark ? "#334155" : "#e2e8f0",
      crosshair: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
      nowLine: isDark ? "rgba(250,204,21,0.35)" : "rgba(202,138,4,0.35)",
      gust: isDark ? "rgba(251,146,60,0.7)" : "rgba(234,88,12,0.6)",
      frost: "rgba(96,165,250,0.9)",
      heat: "rgba(248,113,113,0.9)",
      probLine: isDark ? "#a78bfa" : "#7c3aed",
      probFill: isDark ? "rgba(167,139,250,0.10)" : "rgba(124,58,237,0.08)",
      probAxis: isDark ? "#a78bfa" : "#7c3aed",
      barRange: isDark ? "rgba(56,189,248,0.15)" : "rgba(8,145,178,0.12)",
    }),
    [isDark]
  );
}

export function useChartFonts() {
  const axisFont = useFont(require("../../assets/fonts/SpaceMono-Regular.ttf"), 11);
  const alertFont = useFont(require("../../assets/fonts/SpaceMono-Regular.ttf"), 10);
  return { axisFont, alertFont };
}

export function useSeriesData(
  hourly: Record<string, (number | null)[]>,
  variable: WeatherVariable
) {
  return useMemo(
    () => parseEnsembleSeries(hourly, variable),
    [hourly, variable]
  );
}

export function useXAxisConfig(
  time: string[],
  axisFont: ReturnType<typeof useFont>,
  colors: ReturnType<typeof useChartColors>
) {
  return useMemo(
    () => ({
      font: axisFont,
      tickCount: 5,
      labelColor: colors.axis,
      lineColor: colors.grid,
      labelOffset: 4,
      formatXLabel: (val: any) => {
        const i = Math.round(val as number);
        if (i < 0 || i >= time.length) return "";
        const d = new Date(time[i]);
        if (d.getHours() !== 0 && d.getHours() !== 12) return "";
        return formatDayLabel(time[i]);
      },
    }),
    [time, axisFont, colors.axis, colors.grid]
  );
}

export function useTooltipPress(initY: Record<string, number>) {
  const { state: pressState, isActive } = useChartPressState({
    x: 0 as number,
    y: initY,
  });

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useAnimatedReaction(
    () => ({
      active: pressState.isActive.value,
      xVal: pressState.x.value.value,
      xPos: pressState.x.position.value,
      yPos: pressState.y.control.position.value,
    }),
    (cur) => {
      if (cur.active) {
        runOnJS(setTooltip)({
          idx: Math.round(cur.xVal as number),
          xPos: cur.xPos,
          yPos: cur.yPos,
        });
      } else {
        runOnJS(setTooltip)(null);
      }
    }
  );

  return { pressState, isActive, tooltip };
}
