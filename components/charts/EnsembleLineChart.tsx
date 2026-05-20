import { View } from "react-native";
import { CartesianChart, Line, AreaRange } from "victory-native";
import {
  Circle,
  Line as SkiaLine,
  DashPathEffect,
  Text as SkiaText,
  vec,
} from "@shopify/react-native-skia";
import { Text } from "@/components/ui/text";
import {
  VARIABLE_LABELS,
  VARIABLE_UNITS,
  computePercentiles,
  detectTempAlerts,
} from "@/services/openMeteo";
import { useMemo } from "react";
import { useSettingsStore } from "@/stores";
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

function buildLineData(
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
    if (hasGusts) {
      datum.gusts = gustControl![t] ?? 0;
    }
    data[t] = datum;
  }

  return { data, yKeys, memberKeys, hasGusts };
}

export function EnsembleLineChart({ hourly, variable }: ChartProps) {
  const colors = useChartColors();
  const { axisFont, alertFont } = useChartFonts();
  const showYAxisUnits = useSettingsStore((s) => s.showYAxisUnits);
  const unit = VARIABLE_UNITS[variable];

  const { time, control, members } = useSeriesData(hourly, variable);

  const gustControl = useMemo(() => {
    if (variable !== "wind_speed_10m") return undefined;
    return hourly["wind_gusts_10m"] as (number | null)[] | undefined;
  }, [hourly, variable]);

  const { data, yKeys, memberKeys, hasGusts } = useMemo(
    () => buildLineData(control, members, gustControl),
    [control, members, gustControl]
  );

  const nowIdx = useMemo(() => findNowIndex(time), [time]);
  const xAxisConfig = useXAxisConfig(time, axisFont, colors);

  const tempAlerts = useMemo(() => {
    if (variable !== "temperature_2m") return [];
    return detectTempAlerts(members, control, time);
  }, [variable, members, control, time]);

  const pressInitY = useMemo(() => {
    const y: Record<string, number> = {
      control: 0, p10: 0, p90: 0, p25: 0, p75: 0,
    };
    for (const k of memberKeys) y[k] = 0;
    if (hasGusts) y.gusts = 0;
    return y;
  }, [memberKeys, hasGusts]);

  const { pressState, isActive, tooltip } = useTooltipPress(pressInitY);

  if (data.length === 0) return null;

  const tooltipIdx = tooltip?.idx ?? -1;
  const inRange = tooltipIdx >= 0 && tooltipIdx < data.length;
  const tooltipValue = inRange ? data[tooltipIdx].control : null;
  const tooltipGust = inRange && hasGusts ? data[tooltipIdx].gusts : null;
  const tooltipTime = inRange && tooltipIdx < time.length
    ? formatDateTime(time[tooltipIdx])
    : null;

  const chartTitle = hasGusts
    ? `${VARIABLE_LABELS[variable]} & Gusts (${unit})`
    : `${VARIABLE_LABELS[variable]} (${unit})`;

  return (
    <View className="flex-1">
      <Text variant="small" className="text-center mt-2 mb-1 text-muted-foreground">
        {chartTitle}
      </Text>
      <View style={{ flex: 1, minHeight: 250 }}>
        <CartesianChart
          data={data}
          xKey="idx"
          yKeys={yKeys as any}
          padding={{ left: showYAxisUnits ? 28 : 24, right: 8, top: 8, bottom: 22 }}
          domainPadding={{ top: 20, bottom: 20 }}
          chartPressState={pressState}
          xAxis={xAxisConfig}
          yAxis={[
            {
              font: showYAxisUnits ? axisFont : null,
              tickCount: 5,
              labelColor: colors.axis,
              lineColor: colors.grid,
              labelOffset: 2,
              formatYLabel: (val: any) => `${Math.round(val as number)}${unit}`,
            },
          ]}
        >
          {({ points, chartBounds, xScale }) => (
            <>
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
              {points.control && (
                <Line
                  points={points.control}
                  color={colors.control}
                  strokeWidth={2.5}
                  curveType="natural"
                />
              )}
              {hasGusts && points.gusts && (
                <Line
                  points={points.gusts}
                  color={colors.gust}
                  strokeWidth={1.5}
                  curveType="natural"
                />
              )}
              {tempAlerts.map((a) => {
                const ax = xScale(a.idx);
                const color = a.type === "frost" ? colors.frost : colors.heat;
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
          )}
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
              {tooltipGust != null && (
                <Text
                  style={{ color: colors.isDark ? "#fb923c" : "#ea580c" }}
                  className="font-bold text-xs"
                >
                  ↑{tooltipGust.toFixed(0)} {unit}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
