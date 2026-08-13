import { View } from "react-native";
import { CartesianChart } from "victory-native";
import { Path as SkiaPath } from "@shopify/react-native-skia";
import { Text } from "@/components/ui/text";
import {
  VARIABLE_LABELS,
  VARIABLE_UNITS,
  computeDailyRain,
} from "@/services/openMeteo";
import { useMemo, useState } from "react";
import { useSettingsStore } from "@/stores";
import { ProbabilityBanner } from "./ProbabilityBanner";
import {
  type ChartProps,
  buildEnsembleData,
  pressInitY,
  formatDateTime,
  findNowIndex,
  useChartColors,
  useChartFonts,
  useSeriesData,
  useXAxisConfig,
  useTooltipPress,
  useSyncedTooltipIndex,
  chartPlotPadding,
} from "./shared";
import { useChartSync } from "./ChartSync";
import { ChartCrosshairs, ChartTooltip, EnsembleBands } from "./overlays";

export function PrecipitationChart({ hourly, variable, utcOffsetSeconds }: ChartProps) {
  const colors = useChartColors();
  const { axisFont } = useChartFonts();
  const showYAxisUnits = useSettingsStore((s) => s.showYAxisUnits);
  const unit = VARIABLE_UNITS[variable];
  const pad = chartPlotPadding(showYAxisUnits);

  const { time, control, members } = useSeriesData(hourly, variable);

  const { data, yKeys, memberKeys } = useMemo(
    () => buildEnsembleData(control, members),
    [control, members]
  );

  const cumulative = useMemo(() => {
    let sum = 0;
    return control.map((v) => {
      if (v != null) sum += v;
      return sum;
    });
  }, [control]);

  const maxCumul = cumulative.length > 0 ? cumulative[cumulative.length - 1] : 0;

  const dailyRain = useMemo(
    () => computeDailyRain(members, control, time, utcOffsetSeconds),
    [members, control, time, utcOffsetSeconds]
  );

  const nowIdx = useMemo(() => findNowIndex(time), [time]);
  const xAxisConfig = useXAxisConfig(time, axisFont, colors, utcOffsetSeconds);

  const initY = useMemo(() => pressInitY(false), []);

  const { pressState, isActive } = useTooltipPress(initY);
  const { syncIdx } = useChartSync();
  const tooltipIdx = useSyncedTooltipIndex();

  const [plotWidth, setPlotWidth] = useState(0);

  if (data.length === 0) return null;

  const inRange = tooltipIdx != null && tooltipIdx >= 0 && tooltipIdx < data.length;
  const tooltipValue = inRange && Number.isFinite(data[tooltipIdx].control)
    ? data[tooltipIdx].control
    : null;
  const tooltipCumul = inRange && tooltipIdx < cumulative.length
    ? Math.round(cumulative[tooltipIdx] * 10) / 10
    : null;
  const tooltipTime = inRange && tooltipIdx < time.length
    ? formatDateTime(time[tooltipIdx], utcOffsetSeconds)
    : null;

  const cumulColor = colors.isDark
    ? "rgba(56,189,248,0.08)"
    : "rgba(8,145,178,0.06)";

  const plotBounds =
    plotWidth > 0
      ? { left: pad.left, right: plotWidth - pad.right }
      : null;

  return (
    <View className="flex-1">
      <Text variant="small" className="text-center mt-2 mb-1 text-muted-foreground">
        {VARIABLE_LABELS[variable]} ({unit})
      </Text>
      <View
        style={{ flex: 1, minHeight: dailyRain.length > 0 ? 200 : 230 }}
        onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
      >
        <CartesianChart
          data={data}
          xKey="idx"
          yKeys={yKeys as any}
          padding={pad}
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
            const cumulPath = maxCumul > 0
              ? buildCumulativePath(cumulative, maxCumul, xScale, chartBounds.top, chartBounds.bottom)
              : null;

            return (
              <>
                {cumulPath && (
                  <SkiaPath path={cumulPath} color={cumulColor} style="fill" />
                )}
                <EnsembleBands
                  points={points}
                  memberKeys={memberKeys}
                  colors={colors}
                  curveType="linear"
                />
                <ChartCrosshairs
                  chartBounds={chartBounds}
                  colors={colors}
                  nowIdx={nowIdx}
                  nowX={nowIdx != null ? xScale(nowIdx) : null}
                  isActive={isActive}
                  pressX={pressState.x.position}
                  pressY={pressState.y.control.position}
                  syncIdx={syncIdx}
                  dataLength={data.length}
                />
              </>
            );
          }}
        </CartesianChart>

        {inRange && tooltipValue != null && tooltipTime && (
          <ChartTooltip
            time={tooltipTime}
            value={tooltipValue.toFixed(1)}
            unit={unit}
            extra={
              tooltipCumul != null ? (
                <Text className="text-muted-foreground text-xs">
                  Σ{tooltipCumul}mm
                </Text>
              ) : undefined
            }
          />
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
        control={control}
        members={members}
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
