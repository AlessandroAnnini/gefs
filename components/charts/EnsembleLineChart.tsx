import { useMemo } from "react";
import { Text as SkiaText } from "@shopify/react-native-skia";
import { Text } from "@/components/ui/text";
import {
  VARIABLE_LABELS,
  VARIABLE_UNITS,
  detectTempAlerts,
} from "@/services/openMeteo";
import {
  type ChartProps,
  buildEnsembleData,
  pressInitY,
  formatTimeFromCivil,
  useSeriesData,
  xAtIndex,
} from "./shared";
import { useChartSync } from "./ChartSync";
import { useChartFonts } from "./ChartFonts";
import { ChartShell } from "./ChartShell";
import { EventRail } from "./EventRail";
import { ChartTooltip } from "./overlays";

export function EnsembleLineChart({ variable }: ChartProps) {
  const { hourly, civils, colors, tooltipIdx, plotX } = useChartSync();
  const { alertFont } = useChartFonts();
  const unit = VARIABLE_UNITS[variable];
  const { control, members } = useSeriesData(hourly, variable);

  const gustControl = useMemo(() => {
    if (variable !== "wind_speed_10m") return undefined;
    const raw = hourly["wind_gusts_10m"] as (number | null)[] | undefined;
    return raw?.slice(0, control.length);
  }, [hourly, variable, control.length]);

  const built = useMemo(
    () => buildEnsembleData(control, members, gustControl),
    [control, members, gustControl]
  );

  const tempAlerts = useMemo(() => {
    if (variable !== "temperature_2m") return [];
    return detectTempAlerts(members, control, civils);
  }, [variable, members, control, civils]);

  const initY = useMemo(() => pressInitY(built.hasGusts), [built.hasGusts]);

  if (built.data.length === 0 || !built.yDom) return null;

  const inRange = tooltipIdx != null && tooltipIdx >= 0 && tooltipIdx < built.data.length;
  const tooltipValue = inRange && Number.isFinite(built.data[tooltipIdx].control)
    ? built.data[tooltipIdx].control
    : null;
  const tooltipGust = inRange && built.hasGusts && Number.isFinite(built.data[tooltipIdx].gusts)
    ? built.data[tooltipIdx].gusts
    : null;
  const tooltipTime = inRange && tooltipIdx < civils.length
    ? formatTimeFromCivil(civils[tooltipIdx])
    : null;

  const title = built.hasGusts
    ? `${VARIABLE_LABELS[variable]} & Gusts (${unit})`
    : `${VARIABLE_LABELS[variable]} (${unit})`;

  return (
    <ChartShell
      title={title}
      data={built.data}
      yKeys={built.yKeys}
      yDom={built.yDom}
      domainPadding={{ top: variable === "temperature_2m" ? 40 : 20, bottom: 20 }}
      initY={initY}
      style={{ flex: 1, minHeight: 250 }}
      memberKeys={built.memberKeys}
      curveType="linear"
      controlCurveType="natural"
      gustPoints={built.hasGusts}
      overlay={variable === "temperature_2m" ? <EventRail /> : undefined}
      extra={({ chartBounds }) =>
        plotX && alertFont
          ? tempAlerts.map((a) => {
              const ax = xAtIndex(plotX.x0, plotX.x1, a.idx, plotX.n);
              const color = a.type === "frost" ? colors.frost : colors.heat;
              return (
                <SkiaText
                  key={`alert-${a.type}-${a.idx}`}
                  x={ax - 8}
                  y={chartBounds.bottom - 4}
                  text={a.type === "frost" ? "0-" : "35+"}
                  font={alertFont}
                  color={color}
                />
              );
            })
          : null
      }
      tooltip={
        inRange && tooltipValue != null && tooltipTime ? (
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
        ) : undefined
      }
    />
  );
}
