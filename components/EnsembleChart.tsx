import { useState } from "react";
import { View } from "react-native";
import {
  CartesianChart,
  Line,
  AreaRange,
  useChartPressState,
} from "victory-native";
import {
  Circle,
  Line as SkiaLine,
  DashPathEffect,
  Text as SkiaText,
  vec,
  useFont,
} from "@shopify/react-native-skia";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import {
  type WeatherVariable,
  VARIABLE_LABELS,
  VARIABLE_UNITS,
  parseEnsembleSeries,
  computePercentiles,
  computeWindowProbability,
  detectTempAlerts,
  computeDailyRain,
} from "@/services/openMeteo";
import { useMemo } from "react";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";
import { useSettingsStore } from "@/stores";

interface EnsembleChartProps {
  hourly: Record<string, (number | null)[]>;
  variable: WeatherVariable;
}

const MAX_MEMBER_LINES = 20;

type ChartDatum = Record<string, number>;

function buildChartData(
  time: string[],
  control: (number | null)[],
  members: (number | null)[][],
  gustControl?: (number | null)[]
): { data: ChartDatum[]; yKeys: string[]; memberKeys: string[]; hasGusts: boolean } {
  const { low: p10, high: p90 } = computePercentiles(members, control, 0.1, 0.9);
  const { low: p25, high: p75 } = computePercentiles(members, control, 0.25, 0.75);
  const subset = members.slice(0, MAX_MEMBER_LINES);
  const hasGusts = !!gustControl && gustControl.length > 0;

  const memberKeys = subset.map((_, i) => `m${i}`);
  const yKeys = ["control", "p10", "p90", "p25", "p75", ...memberKeys];
  if (hasGusts) yKeys.push("gusts");

  const data: ChartDatum[] = new Array(time.length);
  for (let t = 0; t < time.length; t++) {
    const datum: ChartDatum = {
      idx: t,
      control: control[t] ?? 0,
      p10: p10[t] ?? 0,
      p90: p90[t] ?? 0,
      p25: p25[t] ?? 0,
      p75: p75[t] ?? 0,
    };
    for (let i = 0; i < subset.length; i++) {
      datum[memberKeys[i]] = subset[i][t] ?? 0;
    }
    if (hasGusts) {
      datum.gusts = gustControl![t] ?? 0;
    }
    data[t] = datum;
  }

  return { data, yKeys, memberKeys, hasGusts };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = DAY_NAMES[d.getDay()];
  const date = d.getDate();
  const h = d.getHours().toString().padStart(2, "0");
  return `${day} ${date}, ${h}:00`;
}

function findNowIndex(time: string[]): number | null {
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

function getProbColor(p: number): string {
  if (p < 0.3) return "rgba(34,197,94,0.85)";
  if (p < 0.6) return "rgba(234,179,8,0.85)";
  return "rgba(239,68,68,0.85)";
}

interface ProbBadge {
  idx: number;
  pct: number;
}

function sampleProbBadges(
  members: (number | null)[][],
  control: (number | null)[],
  time: string[],
  hoursInterval: number,
  windowHours: number
): ProbBadge[] {
  const badges: ProbBadge[] = [];
  if (time.length === 0) return badges;

  const prob = computeWindowProbability(members, control, 0.1, windowHours);
  const startH = new Date(time[0]).getTime();
  const intervalMs = hoursInterval * 3600_000;

  for (let i = 0; i < time.length; i++) {
    const t = new Date(time[i]).getTime();
    const elapsed = t - startH;
    if (elapsed > 0 && elapsed % intervalMs < 3600_000) {
      const pct = Math.round(prob[i] * 100);
      if (pct > 0) {
        badges.push({ idx: i, pct });
      }
    }
  }
  return badges;
}

export function EnsembleChart({ hourly, variable }: EnsembleChartProps) {
  const axisFont = useFont(require("../assets/fonts/SpaceMono-Regular.ttf"), 11);
  const badgeFont = useFont(require("../assets/fonts/SpaceMono-Regular.ttf"), 9);
  const alertFont = useFont(require("../assets/fonts/SpaceMono-Regular.ttf"), 10);
  const { isDark } = useResolvedColorScheme();
  const showYAxisUnits = useSettingsStore((s) => s.showYAxisUnits);
  const unit = VARIABLE_UNITS[variable];

  const { time, control, members } = useMemo(
    () => parseEnsembleSeries(hourly, variable),
    [hourly, variable]
  );

  const gustControl = useMemo(() => {
    if (variable !== "wind_speed_10m") return undefined;
    return hourly["wind_gusts_10m"] as (number | null)[] | undefined;
  }, [hourly, variable]);

  const { data, yKeys, memberKeys, hasGusts } = useMemo(
    () => buildChartData(time, control, members, gustControl),
    [time, control, members, gustControl]
  );

  const nowIdx = useMemo(() => findNowIndex(time), [time]);

  const probBadges = useMemo(() => {
    if (variable !== "precipitation") return [];
    return sampleProbBadges(members, control, time, 12, 12);
  }, [variable, members, control, time]);

  const tempAlerts = useMemo(() => {
    if (variable !== "temperature_2m") return [];
    return detectTempAlerts(members, control, time);
  }, [variable, members, control, time]);

  const dailyRain = useMemo(() => {
    if (variable !== "precipitation") return [];
    return computeDailyRain(members, control, time);
  }, [variable, members, control, time]);

  const pressInitY = useMemo(() => {
    const y: Record<string, number> = {
      control: 0, p10: 0, p90: 0, p25: 0, p75: 0,
    };
    for (const k of memberKeys) y[k] = 0;
    if (hasGusts) y.gusts = 0;
    return y;
  }, [memberKeys, hasGusts]);

  const { state: pressState, isActive } = useChartPressState({
    x: 0 as number,
    y: pressInitY,
  });

  const [tooltip, setTooltip] = useState<{
    idx: number;
    xPos: number;
    yPos: number;
  } | null>(null);

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

  const memberColor = isDark
    ? "rgba(56,189,248,0.15)"
    : "rgba(8,145,178,0.18)";
  const controlColor = isDark ? "#38bdf8" : "#0891b2";
  const outerSpreadColor = isDark
    ? "rgba(56,189,248,0.12)"
    : "rgba(8,145,178,0.10)";
  const innerSpreadColor = isDark
    ? "rgba(56,189,248,0.25)"
    : "rgba(8,145,178,0.20)";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const crosshairColor = isDark
    ? "rgba(255,255,255,0.4)"
    : "rgba(0,0,0,0.3)";
  const nowLineColor = isDark
    ? "rgba(250,204,21,0.35)"
    : "rgba(202,138,4,0.35)";
  const gustColor = isDark
    ? "rgba(251,146,60,0.7)"
    : "rgba(234,88,12,0.6)";
  const frostColor = "rgba(96,165,250,0.9)";
  const heatColor = "rgba(248,113,113,0.9)";

  if (data.length === 0) return null;

  const tooltipValue =
    tooltip && tooltip.idx >= 0 && tooltip.idx < data.length
      ? data[tooltip.idx].control
      : null;
  const tooltipGust =
    tooltip && hasGusts && tooltip.idx >= 0 && tooltip.idx < data.length
      ? data[tooltip.idx].gusts
      : null;
  const tooltipTime =
    tooltip && tooltip.idx >= 0 && tooltip.idx < time.length
      ? formatDateTime(time[tooltip.idx])
      : null;

  const chartTitle = hasGusts
    ? `${VARIABLE_LABELS[variable]} & Gusts (${unit})`
    : `${VARIABLE_LABELS[variable]} (${unit})`;

  return (
    <View className="flex-1">
      <Text
        variant="small"
        className="text-center mt-2 mb-1 text-muted-foreground"
      >
        {chartTitle}
      </Text>
      <View style={{ flex: 1, minHeight: dailyRain.length > 0 ? 220 : 250 }}>
        <CartesianChart
          data={data}
          xKey="idx"
          yKeys={yKeys as any}
          padding={{ left: showYAxisUnits ? 28 : 24, right: 8, top: 8, bottom: 22 }}
          domainPadding={{ top: 20, bottom: 20 }}
          chartPressState={pressState}
          xAxis={{
            font: axisFont,
            tickCount: 5,
            labelColor: axisColor,
            lineColor: gridColor,
            labelOffset: 4,
            formatXLabel: (val) => {
              const i = Math.round(val as number);
              if (i < 0 || i >= time.length) return "";
              const d = new Date(time[i]);
              if (d.getHours() !== 0 && d.getHours() !== 12) return "";
              return formatDayLabel(time[i]);
            },
          }}
          yAxis={[
            {
              font: showYAxisUnits ? axisFont : null,
              tickCount: 5,
              labelColor: axisColor,
              lineColor: gridColor,
              labelOffset: 2,
              formatYLabel: (val: any) => `${Math.round(val as number)}${unit}`,
            },
          ]}
        >
          {({ points, chartBounds, xScale }) => (
            <>
              {/* Outer confidence band: P10-P90 */}
              {points.p10 && points.p90 && (
                <AreaRange
                  upperPoints={points.p90}
                  lowerPoints={points.p10}
                  color={outerSpreadColor}
                  curveType="natural"
                />
              )}
              {/* Inner confidence band: P25-P75 */}
              {points.p25 && points.p75 && (
                <AreaRange
                  upperPoints={points.p75}
                  lowerPoints={points.p25}
                  color={innerSpreadColor}
                  curveType="natural"
                />
              )}
              {/* Ensemble member lines */}
              {memberKeys.map((key) =>
                points[key] ? (
                  <Line
                    key={key}
                    points={points[key]}
                    color={memberColor}
                    strokeWidth={0.8}
                    curveType="natural"
                  />
                ) : null
              )}
              {/* Control run */}
              {points.control && (
                <Line
                  points={points.control}
                  color={controlColor}
                  strokeWidth={2.5}
                  curveType="natural"
                />
              )}
              {/* Wind gust overlay */}
              {hasGusts && points.gusts && (
                <Line
                  points={points.gusts}
                  color={gustColor}
                  strokeWidth={1.5}
                  curveType="natural"
                />
              )}
              {/* Frost/heat alert markers */}
              {tempAlerts.map((a) => {
                const ax = xScale(a.idx);
                const color = a.type === "frost" ? frostColor : heatColor;
                const label = a.type === "frost" ? "0-" : "35+";
                return alertFont ? (
                  <SkiaText
                    key={`alert-${a.idx}`}
                    x={ax - 8}
                    y={chartBounds.bottom - 4}
                    text={label}
                    font={alertFont}
                    color={color}
                  />
                ) : null;
              })}
              {/* "Now" time marker */}
              {nowIdx != null && (
                <SkiaLine
                  p1={vec(xScale(nowIdx), chartBounds.top)}
                  p2={vec(xScale(nowIdx), chartBounds.bottom)}
                  color={nowLineColor}
                  strokeWidth={1}
                >
                  <DashPathEffect intervals={[4, 3]} />
                </SkiaLine>
              )}
              {/* Probability badges for precipitation */}
              {probBadges.map((b) => {
                const bx = xScale(b.idx);
                const label = `${b.pct}%`;
                return badgeFont ? (
                  <SkiaText
                    key={b.idx}
                    x={bx - 10}
                    y={chartBounds.top + 12}
                    text={label}
                    font={badgeFont}
                    color={getProbColor(b.pct / 100)}
                  />
                ) : null;
              })}
              {/* Touch crosshair */}
              {isActive && (
                <>
                  <SkiaLine
                    p1={vec(
                      pressState.x.position.value,
                      chartBounds.top
                    )}
                    p2={vec(
                      pressState.x.position.value,
                      chartBounds.bottom
                    )}
                    color={crosshairColor}
                    strokeWidth={1}
                  />
                  <Circle
                    cx={pressState.x.position.value}
                    cy={pressState.y.control.position.value}
                    r={5}
                    color={controlColor}
                  />
                </>
              )}
            </>
          )}
        </CartesianChart>

        {tooltip && tooltipValue != null && tooltipTime && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 8,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <View
              className="bg-card/90 border border-border rounded-lg px-3 py-1.5"
              style={{ flexDirection: "row", gap: 8 }}
            >
              <Text className="text-muted-foreground text-xs">
                {tooltipTime}
              </Text>
              <Text className="text-primary font-bold text-xs">
                {tooltipValue.toFixed(1)} {unit}
              </Text>
              {tooltipGust != null && (
                <Text style={{ color: isDark ? "#fb923c" : "#ea580c" }} className="font-bold text-xs">
                  ↑{tooltipGust.toFixed(0)} {unit}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
      {dailyRain.length > 0 && (
        <View className="flex-row justify-around px-2 pb-1">
          {dailyRain.map((d) => {
            const hasRain = d.median >= 0.1;
            const hasSpread = d.p90 - d.p10 >= 0.2;
            const medianColor = d.median > 10 ? (isDark ? "#60a5fa" : "#2563eb") :
                                hasRain ? (isDark ? "#94a3b8" : "#64748b") :
                                isDark ? "#475569" : "#cbd5e1";
            return (
              <View key={d.label} className="items-center">
                <Text className="text-muted-foreground" style={{ fontSize: 9 }}>
                  {d.label}
                </Text>
                <Text className="font-bold" style={{ fontSize: 10, color: medianColor }}>
                  {hasRain ? `${d.median}` : "0"}mm
                </Text>
                {hasSpread && (
                  <Text className="text-muted-foreground" style={{ fontSize: 8 }}>
                    {d.p10}-{d.p90}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
