import { View } from "react-native";
import { CartesianChart } from "victory-native";
import { Text as SkiaText } from "@shopify/react-native-skia";
import { Text } from "@/components/ui/text";
import {
  VARIABLE_LABELS,
  VARIABLE_UNITS,
  detectTempAlerts,
} from "@/services/openMeteo";
import { useMemo } from "react";
import { useSettingsStore } from "@/stores";
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

export function EnsembleLineChart({ hourly, variable, utcOffsetSeconds }: ChartProps) {
  const colors = useChartColors();
  const { axisFont, alertFont } = useChartFonts();
  const showYAxisUnits = useSettingsStore((s) => s.showYAxisUnits);
  const pad = chartPlotPadding(showYAxisUnits);
  const unit = VARIABLE_UNITS[variable];

  const { time, control, members } = useSeriesData(hourly, variable);

  const gustControl = useMemo(() => {
    if (variable !== "wind_speed_10m") return undefined;
    const raw = hourly["wind_gusts_10m"] as (number | null)[] | undefined;
    return raw?.slice(0, time.length);
  }, [hourly, variable, time.length]);

  const { data, yKeys, memberKeys, hasGusts } = useMemo(
    () => buildEnsembleData(control, members, gustControl),
    [control, members, gustControl]
  );

  const nowIdx = useMemo(() => findNowIndex(time), [time]);
  const xAxisConfig = useXAxisConfig(time, axisFont, colors, utcOffsetSeconds);

  const tempAlerts = useMemo(() => {
    if (variable !== "temperature_2m") return [];
    return detectTempAlerts(members, control, time, utcOffsetSeconds);
  }, [variable, members, control, time, utcOffsetSeconds]);

  const initY = useMemo(() => pressInitY(hasGusts), [hasGusts]);

  const { pressState, isActive } = useTooltipPress(initY);
  const { syncIdx } = useChartSync();
  const tooltipIdx = useSyncedTooltipIndex();

  if (data.length === 0) return null;

  const inRange = tooltipIdx != null && tooltipIdx >= 0 && tooltipIdx < data.length;
  const tooltipValue = inRange && Number.isFinite(data[tooltipIdx].control)
    ? data[tooltipIdx].control
    : null;
  const tooltipGust = inRange && hasGusts && Number.isFinite(data[tooltipIdx].gusts)
    ? data[tooltipIdx].gusts
    : null;
  const tooltipTime = inRange && tooltipIdx < time.length
    ? formatDateTime(time[tooltipIdx], utcOffsetSeconds)
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
          padding={pad}
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
              <EnsembleBands
                points={points}
                memberKeys={memberKeys}
                colors={colors}
                curveType="linear"
                controlCurveType="natural"
                gustPoints={hasGusts ? points.gusts : undefined}
              />
              {tempAlerts.map((a) => {
                const ax = xScale(a.idx);
                const color = a.type === "frost" ? colors.frost : colors.heat;
                const label = a.type === "frost" ? "0-" : "35+";
                return alertFont ? (
                  <SkiaText
                    key={`alert-${a.type}-${a.idx}`}
                    x={ax - 8}
                    y={chartBounds.bottom - 4}
                    text={label}
                    font={alertFont}
                    color={color}
                  />
                ) : null;
              })}
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
          )}
        </CartesianChart>

        {inRange && tooltipValue != null && tooltipTime && (
          <ChartTooltip
            time={tooltipTime}
            value={tooltipValue.toFixed(1)}
            unit={unit}
            extra={
              tooltipGust != null ? (
                <Text
                  style={{ color: colors.isDark ? "#fb923c" : "#ea580c" }}
                  className="font-bold text-xs"
                >
                  ↑{tooltipGust.toFixed(0)} {unit}
                </Text>
              ) : undefined
            }
          />
        )}
      </View>
    </View>
  );
}
