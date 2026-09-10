import { useMemo } from "react";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";
import {
  type CivilParts,
  type WeatherVariable,
  parseEnsembleSeries,
  computeBands,
} from "@/services/openMeteo";

export type ChartDatum = Record<string, number>;

export interface ChartProps {
  variable: WeatherVariable;
}

export const CHART_PAD = {
  leftWithLabels: 36,
  left: 24,
  right: 8,
} as const;

export const Y_AXIS_TICK_COUNT = 4;
export const Y_LABEL_GAP = 4;

/** Inset the first/last hours so edge day labels are not flush with the frame. */
export const X_DOMAIN_PAD = { left: 22, right: 16 } as const;

/** Pixel x for a (possibly fractional) time index between Victory xScale(0) and xScale(n-1). */
export function xAtIndex(x0: number, x1: number, idx: number, n: number): number {
  if (n <= 1) return x0;
  return x0 + (idx / (n - 1)) * (x1 - x0);
}

/** Finite y extent for Victory — NaN in the series makes yScale() undefined and crashes Skia. */
export function yDomain(series: ((number | null | undefined)[] | undefined)[]): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    if (!s) continue;
    for (const v of s) {
      if (typeof v === "number" && Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  if (min === Infinity) return null;
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    return [min - pad, max + pad];
  }
  return [min, max];
}

export function chartPlotPadding(showYAxis: boolean) {
  return {
    left: showYAxis ? CHART_PAD.leftWithLabels : CHART_PAD.left,
    right: CHART_PAD.right,
    top: 8,
    bottom: 22,
  };
}

export function yTickLabelX(frameLeft: number, textWidth: number): number {
  return frameLeft - Y_LABEL_GAP - textWidth;
}

export type PlotXRange = {
  x0: number;
  x1: number;
  n: number;
  frameLeft: number;
  frameRight: number;
};

/** Vertical 12h / midnight grid as two Skia path strings (charts + rain-probability banner). */
export function calendarVerticalGridPaths(
  tickValues: number[],
  midnightIndices: number[],
  plotX: PlotXRange,
  top: number,
  bottom: number
): { major: string; minor: string } {
  if (plotX.n < 2) return { major: "", minor: "" };
  const mid = new Set(midnightIndices);
  const major: string[] = [];
  const minor: string[] = [];
  for (const idx of tickValues) {
    const x = xAtIndex(plotX.x0, plotX.x1, idx, plotX.n);
    if (!Number.isFinite(x) || x < plotX.x0 || x > plotX.x1) continue;
    const seg = `M ${x} ${top} L ${x} ${bottom}`;
    (mid.has(idx) ? major : minor).push(seg);
  }
  return { major: major.join(" "), minor: minor.join(" ") };
}

/** Matches Victory with inset Y-axis, font null, and X_DOMAIN_PAD. */
export function plotXFromLayout(
  width: number,
  n: number,
  showYAxis: boolean
): PlotXRange | null {
  if (width <= 0 || n < 2) return null;
  const pad = chartPlotPadding(showYAxis);
  const frameLeft = pad.left;
  const frameRight = width - pad.right;
  if (frameRight - frameLeft < X_DOMAIN_PAD.left + X_DOMAIN_PAD.right + 8) return null;
  return {
    x0: frameLeft + X_DOMAIN_PAD.left,
    x1: frameRight - X_DOMAIN_PAD.right,
    n,
    frameLeft,
    frameRight,
  };
}

/** Numeric ticks only — the unit lives in the chart title. */
export function formatYTick(val: number): string {
  if (!Number.isFinite(val)) return "";
  if (val !== 0 && Math.abs(val) < 2) {
    const t = Math.round(val * 10) / 10;
    return Object.is(t, -0) ? "0" : String(t);
  }
  const r = Math.round(val);
  return Object.is(r, -0) ? "0" : String(r);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_MEMBER_LINES = 8;

export function chartValue(v: number | null | undefined): number {
  return v == null ? Number.NaN : v;
}

export function formatDayFromCivil(p: CivilParts): string {
  return `${DAY_NAMES[p.day]} ${p.date}`;
}

export function formatTimeFromCivil(p: CivilParts): string {
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
): {
  data: ChartDatum[];
  yKeys: string[];
  memberKeys: string[];
  hasGusts: boolean;
  yDom: [number, number] | null;
} {
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

  return {
    data,
    yKeys,
    memberKeys,
    hasGusts,
    yDom: yDomain([control, ...members, gustControl]),
  };
}

/** Press tracking keys only — members are visual-only. */
export const PRESS_INIT_Y: Record<string, number> = {
  control: 0,
  p10: 0,
  p90: 0,
  p25: 0,
  p75: 0,
};

export function pressInitY(hasGusts = false): Record<string, number> {
  return hasGusts ? { ...PRESS_INIT_Y, gusts: 0 } : PRESS_INIT_Y;
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
      gridMinor: isDark ? "rgba(148,163,184,0.22)" : "rgba(15,23,42,0.10)",
      gridMajor: isDark ? "rgba(148,163,184,0.36)" : "rgba(15,23,42,0.16)",
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

export type ChartColors = ReturnType<typeof useChartColors>;

export function useSeriesData(
  hourly: Record<string, (number | null)[]>,
  variable: WeatherVariable
) {
  return useMemo(
    () => parseEnsembleSeries(hourly, variable),
    [hourly, variable]
  );
}

const LONG_HORIZON_SECONDS = 7.5 * 24 * 3600;

export function xAxisTickStep(time: number[]): 12 | 24 {
  if (time.length < 2) return 12;
  return time[time.length - 1] - time[0] <= LONG_HORIZON_SECONDS ? 12 : 24;
}

export function timeTickIndices(civils: CivilParts[], stepHours: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < civils.length; i++) {
    if (civils[i].hours % stepHours === 0) indices.push(i);
  }
  return indices;
}

export function midnightTickIndices(civils: CivilParts[], tickValues: number[]): number[] {
  return tickValues.filter((i) => civils[i].hours === 0);
}

export function dayStartIndices(civils: CivilParts[]): number[] {
  const indices: number[] = [];
  let prevKey = "";
  for (let i = 0; i < civils.length; i++) {
    const p = civils[i];
    const key = `${p.year}-${p.month}-${p.date}`;
    if (key !== prevKey) {
      indices.push(i);
      prevKey = key;
    }
  }
  return indices;
}

/** ≤5 days: every day. 7–10: every other. 14: every third. */
export function dayLabelStride(dayCount: number): number {
  if (dayCount <= 5) return 1;
  if (dayCount <= 10) return 2;
  return 3;
}

export function thinDayLabelIndices(indices: number[]): number[] {
  const stride = dayLabelStride(indices.length);
  if (stride <= 1) return indices;
  return indices.filter((_, i) => i % stride === 0);
}

export type XAxisBundle = {
  tickValues: number[];
  midnightIndices: number[];
  dayLabels: { idx: number; text: string }[];
};

export function buildXAxisConfig(time: number[], civils: CivilParts[]): XAxisBundle {
  const step = xAxisTickStep(time);
  const tickValues = timeTickIndices(civils, step);
  const midnightIndices = midnightTickIndices(civils, tickValues);
  const labelIndices = thinDayLabelIndices(dayStartIndices(civils));
  return {
    tickValues,
    midnightIndices,
    dayLabels: labelIndices.map((i) => ({
      idx: i,
      text: formatDayFromCivil(civils[i]),
    })),
  };
}
