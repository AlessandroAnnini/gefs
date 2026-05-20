import { View } from "react-native";
import { CartesianChart, Line, AreaRange } from "victory-native";
import {
  Circle,
  Line as SkiaLine,
  Path as SkiaPath,
  DashPathEffect,
  vec,
} from "@shopify/react-native-skia";
import { Text } from "@/components/ui/text";
import {
  VARIABLE_LABELS,
  VARIABLE_UNITS,
  computePercentiles,
  computeDailyRain,
} from "@/services/openMeteo";
import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useSettingsStore } from "@/stores";
import { ProbabilityBanner } from "./ProbabilityBanner";
import {
  type ChartProps,
  type ChartDatum,
  formatDateTime,
  findNowIndex,
  useChartColors,
  useChartFonts,
  useSeriesData,
  useXAxisConfig,
  useTooltipPress,
} from "./shared";

const MAX_MEMBER_LINES = 20;

function buildPrecipLineData(
  control: (number | null)[],
  members: (number | null)[][]
) {
  const { low: p10, high: p90 } = computePercentiles(members, control, 0.1, 0.9);
  const { low: p25, high: p75 } = computePercentiles(members, control, 0.25, 0.75);
  const subset = members.slice(0, MAX_MEMBER_LINES);
  const memberKeys = subset.map((_, i) => `m${i}`);
  const yKeys = ["control", "p10", "p90", "p25", "p75", ...memberKeys];

  const data: ChartDatum[] = new Array(control.length);
  for (let t = 0; t < control.length; t++) {
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
    data[t] = datum;
  }

  return { data, yKeys, memberKeys };
}

export function PrecipitationChart({ hourly, variable }: ChartProps) {
  const colors = useChartColors();
  const { axisFont } = useChartFonts();
  const showYAxisUnits = useSettingsStore((s) => s.showYAxisUnits);
  const unit = VARIABLE_UNITS[variable];

  const { time, control, members } = useSeriesData(hourly, variable);

  const { data, yKeys, memberKeys } = useMemo(
    () => buildPrecipLineData(control, members),
    [control, members]
  );

  const cumulative = useMemo(() => {
    let sum = 0;
    return control.map((v) => {
      sum += v ?? 0;
      return sum;
    });
  }, [control]);

  const maxCumul = cumulative.length > 0 ? cumulative[cumulative.length - 1] : 0;

  const dailyRain = useMemo(
    () => computeDailyRain(members, control, time),
    [members, control, time]
  );

  const nowIdx = useMemo(() => findNowIndex(time), [time]);
  const xAxisConfig = useXAxisConfig(time, axisFont, colors);

  const pressInitY = useMemo(() => {
    const y: Record<string, number> = {
      control: 0, p10: 0, p90: 0, p25: 0, p75: 0,
    };
    for (const k of memberKeys) y[k] = 0;
    return y;
  }, [memberKeys]);

  const { pressState, isActive, tooltip } = useTooltipPress(pressInitY);

  const [plotBounds, setPlotBounds] = useState<{ left: number; right: number } | null>(null);
  const boundsRef = useRef<{ left: number; right: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const captureBounds = useCallback((left: number, right: number) => {
    const prev = boundsRef.current;
    if (prev && prev.left === left && prev.right === right) return;
    boundsRef.current = { left, right };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setPlotBounds(boundsRef.current);
      });
    }
  }, []);

  if (data.length === 0) return null;

  const tooltipIdx = tooltip?.idx ?? -1;
  const inRange = tooltipIdx >= 0 && tooltipIdx < data.length;
  const tooltipValue = inRange ? data[tooltipIdx].control : null;
  const tooltipCumul = inRange && tooltipIdx < cumulative.length
    ? Math.round(cumulative[tooltipIdx] * 10) / 10
    : null;
  const tooltipTime = inRange && tooltipIdx < time.length
    ? formatDateTime(time[tooltipIdx])
    : null;

  const cumulColor = colors.isDark
    ? "rgba(56,189,248,0.08)"
    : "rgba(8,145,178,0.06)";

  return (
    <View className="flex-1">
      <Text variant="small" className="text-center mt-2 mb-1 text-muted-foreground">
        {VARIABLE_LABELS[variable]} ({unit})
      </Text>
      <View style={{ flex: 1, minHeight: dailyRain.length > 0 ? 200 : 230 }}>
        <CartesianChart
          data={data}
          xKey="idx"
          yKeys={yKeys as any}
          padding={{ left: showYAxisUnits ? 32 : 24, right: 8, top: 8, bottom: 22 }}
          domainPadding={{ top: 20, bottom: 0 }}
          chartPressState={pressState}
          xAxis={xAxisConfig}
          yAxis={[
            {
              font: showYAxisUnits ? axisFont : null,
              tickCount: 4,
              labelColor: colors.axis,
              lineColor: colors.grid,
              labelOffset: 2,
              formatYLabel: (val: any) => {
                const v = val as number;
                return v < 2 && v !== 0
                  ? `${v.toFixed(1)}${unit}`
                  : `${Math.round(v)}${unit}`;
              },
            },
          ]}
        >
          {({ points, chartBounds, xScale }) => {
            captureBounds(chartBounds.left, chartBounds.right);
            const cumulPath = maxCumul > 0
              ? buildCumulativePath(cumulative, maxCumul, xScale, chartBounds.top, chartBounds.bottom)
              : null;

            return (
              <>
                {/* Cumulative area fill (background) */}
                {cumulPath && (
                  <SkiaPath path={cumulPath} color={cumulColor} style="fill" />
                )}

                {/* Confidence bands */}
                {points.p10 && points.p90 && (
                  <AreaRange
                    upperPoints={points.p90}
                    lowerPoints={points.p10}
                    color={colors.outerSpread}
                    curveType="natural"
                  />
                )}
                {points.p25 && points.p75 && (
                  <AreaRange
                    upperPoints={points.p75}
                    lowerPoints={points.p25}
                    color={colors.innerSpread}
                    curveType="natural"
                  />
                )}

                {/* Ensemble member lines */}
                {memberKeys.map((key) =>
                  points[key] ? (
                    <Line
                      key={key}
                      points={points[key]}
                      color={colors.member}
                      strokeWidth={0.8}
                      curveType="natural"
                    />
                  ) : null
                )}

                {/* Control line */}
                {points.control && (
                  <Line
                    points={points.control}
                    color={colors.control}
                    strokeWidth={2.5}
                    curveType="natural"
                  />
                )}

                {/* Now marker */}
                {nowIdx != null && (
                  <SkiaLine
                    p1={vec(xScale(nowIdx), chartBounds.top)}
                    p2={vec(xScale(nowIdx), chartBounds.bottom)}
                    color={colors.nowLine}
                    strokeWidth={1}
                  >
                    <DashPathEffect intervals={[4, 3]} />
                  </SkiaLine>
                )}

                {/* Touch crosshair */}
                {isActive && (
                  <>
                    <SkiaLine
                      p1={vec(pressState.x.position.value, chartBounds.top)}
                      p2={vec(pressState.x.position.value, chartBounds.bottom)}
                      color={colors.crosshair}
                      strokeWidth={1}
                    />
                    <Circle
                      cx={pressState.x.position.value}
                      cy={pressState.y.control.position.value}
                      r={5}
                      color={colors.control}
                    />
                  </>
                )}
              </>
            );
          }}
        </CartesianChart>

        {tooltip && tooltipValue != null && tooltipTime && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 8, left: 0, right: 0, alignItems: "center" }}
          >
            <View
              className="bg-card/90 border border-border rounded-lg px-3 py-1.5"
              style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}
            >
              <Text className="text-muted-foreground text-xs">{tooltipTime}</Text>
              <Text className="text-primary font-bold text-xs">
                {tooltipValue.toFixed(1)} {unit}
              </Text>
              {tooltipCumul != null && (
                <Text className="text-muted-foreground text-xs">
                  Σ{tooltipCumul}mm
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
            const medianColor =
              d.median > 10
                ? colors.isDark ? "#60a5fa" : "#2563eb"
                : hasRain
                  ? colors.isDark ? "#94a3b8" : "#64748b"
                  : colors.isDark ? "#475569" : "#cbd5e1";
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

      <ProbabilityBanner
        hourly={hourly}
        variable={variable}
        chartBounds={plotBounds}
      />
    </View>
  );
}

function buildCumulativePath(
  cumulative: number[],
  maxCumul: number,
  xScale: (idx: number) => number,
  top: number,
  bottom: number
): string {
  const height = bottom - top;
  const parts: string[] = [];

  const firstX = xScale(0);
  parts.push(`M ${firstX} ${bottom}`);

  for (let i = 0; i < cumulative.length; i++) {
    const x = xScale(i);
    const ratio = cumulative[i] / maxCumul;
    const y = bottom - ratio * height * 0.8;
    parts.push(`L ${x} ${y}`);
  }

  const lastX = xScale(cumulative.length - 1);
  parts.push(`L ${lastX} ${bottom} Z`);

  return parts.join(" ");
}
