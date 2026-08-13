import { useMemo, useState } from "react";
import type { SkFont } from "@shopify/react-native-skia";
import { useChartPressState } from "victory-native";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";
import {
  type WeatherVariable,
  parseEnsembleSeries,
  civilParts,
  computeBands,
} from "@/services/openMeteo";
import { useChartSync } from "./ChartSync";

export type ChartDatum = Record<string, number>;

export interface ChartProps {
  hourly: Record<string, (number | null)[]>;
  variable: WeatherVariable;
  utcOffsetSeconds: number;
}

export const CHART_PAD = {
  leftWithUnits: 40,
  left: 24,
  right: 8,
} as const;

export function chartPlotPadding(showYAxisUnits: boolean) {
  return {
    left: showYAxisUnits ? CHART_PAD.leftWithUnits : CHART_PAD.left,
    right: CHART_PAD.right,
    top: 8,
    bottom: 22,
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_MEMBER_LINES = 8;

export function chartValue(v: number | null | undefined): number {
  return v == null ? Number.NaN : v;
}

export function formatDayLabel(unixSeconds: number, utcOffsetSeconds: number): string {
  const p = civilParts(unixSeconds, utcOffsetSeconds);
  return `${DAY_NAMES[p.day]} ${p.date}`;
}

export function formatDateTime(unixSeconds: number, utcOffsetSeconds: number): string {
  const p = civilParts(unixSeconds, utcOffsetSeconds);
  const h = p.hours.toString().padStart(2, "0");
  return `${DAY_NAMES[p.day]} ${p.date}, ${h}:00`;
}

export function findNowIndex(time: number[]): number | null {
  if (time.length === 0) return null;
  const now = Date.now() / 1000;
  if (now < time[0] || now > time[time.length - 1]) return null;

  for (let i = 0; i < time.length - 1; i++) {
    if (now >= time[i] && now <= time[i + 1]) {
      const span = time[i + 1] - time[i];
      return span === 0 ? i : i + (now - time[i]) / span;
    }
  }
  return null;
}

export function buildEnsembleData(
  control: (number | null)[],
  members: (number | null)[][],
  gustControl?: (number | null)[]
): { data: ChartDatum[]; yKeys: string[]; memberKeys: string[]; hasGusts: boolean } {
  const { p10, p25, p75, p90 } = computeBands(members, control);
  const subset = members.slice(0, MAX_MEMBER_LINES);
  const hasGusts = !!gustControl && gustControl.length > 0;

  const memberKeys = subset.map((_, i) => `m${i}`);
  const yKeys = ["control", "p10", "p90", "p25", "p75", ...memberKeys];
  if (hasGusts) yKeys.push("gusts");

  const data: ChartDatum[] = new Array(control.length);
  for (let t = 0; t < control.length; t++) {
    const datum: ChartDatum = {
      idx: t,
      control: chartValue(control[t]),
      p10: chartValue(p10[t]),
      p90: chartValue(p90[t]),
      p25: chartValue(p25[t]),
      p75: chartValue(p75[t]),
    };
    for (let i = 0; i < subset.length; i++) {
      datum[memberKeys[i]] = chartValue(subset[i][t]);
    }
    if (hasGusts) {
      datum.gusts = chartValue(gustControl![t]);
    }
    data[t] = datum;
  }

  return { data, yKeys, memberKeys, hasGusts };
}

/** Press tracking keys only — members are visual-only. */
export function pressInitY(hasGusts = false): Record<string, number> {
  const y: Record<string, number> = {
    control: 0,
    p10: 0,
    p90: 0,
    p25: 0,
    p75: 0,
  };
  if (hasGusts) y.gusts = 0;
  return y;
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
    }),
    [isDark]
  );
}

export { useChartFonts } from "./ChartFonts";

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
  time: number[],
  axisFont: SkFont | null,
  colors: ReturnType<typeof useChartColors>,
  utcOffsetSeconds: number
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
        const hours = civilParts(time[i], utcOffsetSeconds).hours;
        if (hours !== 0 && hours !== 12) return "";
        return formatDayLabel(time[i], utcOffsetSeconds);
      },
    }),
    [time, axisFont, colors.axis, colors.grid, utcOffsetSeconds]
  );
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

/** Rounded sync index for tooltip text; updates only when the hour changes. */
export function useSyncedTooltipIndex(): number | null {
  const { syncIdx } = useChartSync();
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);

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

  return tooltipIdx;
}
