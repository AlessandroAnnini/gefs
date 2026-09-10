import { useMemo } from "react";
import { View } from "react-native";
import { Path as SkiaPath } from "@shopify/react-native-skia";
import { Text } from "@/components/ui/text";
import { VARIABLE_LABELS, VARIABLE_UNITS } from "@/services/openMeteo";
import { ProbabilityBanner } from "./ProbabilityBanner";
import {
  type ChartProps,
  buildEnsembleData,
  PRESS_INIT_Y,
  formatTimeFromCivil,
  useSeriesData,
  xAtIndex,
  type PlotXRange,
} from "./shared";
import { useChartSync } from "./ChartSync";
import { ChartShell } from "./ChartShell";
import { ChartTooltip } from "./overlays";

export function PrecipitationChart({ variable }: ChartProps) {
  const { hourly, civils, colors, tooltipIdx, plotX } = useChartSync();
  const unit = VARIABLE_UNITS[variable];
  const { control, members } = useSeriesData(hourly, variable);

  const built = useMemo(() => buildEnsembleData(control, members), [control, members]);

  const cumulative = useMemo(() => {
    let sum = 0;
    return control.map((v) => {
      if (v != null) sum += v;
      return sum;
    });
  }, [control]);

  const maxCumul = cumulative.length > 0 ? cumulative[cumulative.length - 1] : 0;

  if (built.data.length === 0 || !built.yDom) return null;

  const inRange = tooltipIdx != null && tooltipIdx >= 0 && tooltipIdx < built.data.length;
  const tooltipValue = inRange && Number.isFinite(built.data[tooltipIdx].control)
    ? built.data[tooltipIdx].control
    : null;
  const tooltipCumul = inRange && tooltipIdx < cumulative.length
    ? Math.round(cumulative[tooltipIdx] * 10) / 10
    : null;
  const tooltipTime = inRange && tooltipIdx < civils.length
    ? formatTimeFromCivil(civils[tooltipIdx])
    : null;

  const cumulColor = colors.isDark
    ? "rgba(56,189,248,0.08)"
    : "rgba(8,145,178,0.06)";

  return (
    <View className="w-full">
      <ChartShell
        title={`${VARIABLE_LABELS[variable]} (${unit})`}
        data={built.data}
        yKeys={built.yKeys}
        yDom={built.yDom}
        domainPadding={{ top: 20, bottom: 0 }}
        initY={PRESS_INIT_Y}
        style={{ height: 230 }}
        memberKeys={built.memberKeys}
        extra={({ chartBounds }) => {
          const path =
            plotX && maxCumul > 0
              ? buildCumulativePath(cumulative, maxCumul, plotX, chartBounds.top, chartBounds.bottom)
              : "";
          return path ? <SkiaPath path={path} color={cumulColor} style="fill" /> : null;
        }}
        tooltip={
          inRange && tooltipValue != null && tooltipTime ? (
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
          ) : undefined
        }
      />
      <ProbabilityBanner control={control} members={members} />
    </View>
  );
}

function buildCumulativePath(
  cumulative: number[],
  maxCumul: number,
  plotX: PlotXRange,
  top: number,
  bottom: number
): string {
  const height = bottom - top;
  const { x0, x1, n } = plotX;
  const parts: string[] = [`M ${xAtIndex(x0, x1, 0, n)} ${bottom}`];
  for (let i = 0; i < cumulative.length; i++) {
    const y = bottom - (cumulative[i] / maxCumul) * height * 0.8;
    parts.push(`L ${xAtIndex(x0, x1, i, n)} ${y}`);
  }
  parts.push(`L ${xAtIndex(x0, x1, n - 1, n)} ${bottom} Z`);
  return parts.join(" ");
}
