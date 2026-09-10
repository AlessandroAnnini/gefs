import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { CartesianChart } from "victory-native";
import { Text } from "@/components/ui/text";
import {
  X_DOMAIN_PAD,
  Y_AXIS_TICK_COUNT,
  type ChartDatum,
} from "./shared";
import { useChartSync, useTooltipPress } from "./ChartSync";
import { useChartFonts } from "./ChartFonts";
import { CalendarGrid, ChartCrosshairs, ChartOutsideAxes, EnsembleBands } from "./overlays";

type PointsMap = Record<string, any>;

interface ChartShellProps {
  title: string;
  data: ChartDatum[];
  yKeys: string[];
  yDom: [number, number];
  domainPadding: { top: number; bottom: number };
  initY: Record<string, number>;
  style: ViewStyle;
  memberKeys: string[];
  curveType?: "natural" | "linear";
  controlCurveType?: "natural" | "linear";
  gustPoints?: boolean;
  extra?: (args: { points: PointsMap; chartBounds: { top: number; bottom: number; left: number; right: number } }) => ReactNode;
  overlay?: ReactNode;
  tooltip?: ReactNode;
}

export function ChartShell({
  title,
  data,
  yKeys,
  yDom,
  domainPadding,
  initY,
  style,
  memberKeys,
  curveType = "linear",
  controlCurveType,
  gustPoints,
  extra,
  overlay,
  tooltip,
}: ChartShellProps) {
  const { colors, pad, xAxis, showYAxis, plotX, nowIdx, syncIdx } = useChartSync();
  const { axisFont } = useChartFonts();
  const { pressState, isActive } = useTooltipPress(initY);

  return (
    <View className="flex-1 w-full">
      <Text variant="small" className="text-center mt-2 mb-1 text-muted-foreground">
        {title}
      </Text>
      <View style={style}>
        <CartesianChart
          data={data}
          xKey="idx"
          yKeys={yKeys as any}
          padding={pad}
          domain={{ y: yDom }}
          domainPadding={{ ...domainPadding, ...X_DOMAIN_PAD }}
          chartPressState={pressState}
          xAxis={{ font: null, lineWidth: 0 }}
          renderOutside={({ chartBounds, yScale }) => (
            <ChartOutsideAxes
              yScale={yScale}
              chartBounds={chartBounds}
              axisFont={axisFont}
              xAxis={xAxis}
              colors={colors}
              showYAxis={showYAxis}
              plotX={plotX}
            />
          )}
          yAxis={[
            {
              font: null,
              tickCount: Y_AXIS_TICK_COUNT,
              labelPosition: "inset",
              labelOffset: 0,
              labelColor: colors.axis,
              lineColor: colors.gridMinor,
            },
          ]}
        >
          {({ points, chartBounds }) => (
            <>
              {extra?.({ points, chartBounds })}
              {plotX && (
                <CalendarGrid
                  tickValues={xAxis.tickValues}
                  midnightIndices={xAxis.midnightIndices}
                  chartBounds={chartBounds}
                  colors={colors}
                  plotX={plotX}
                />
              )}
              <EnsembleBands
                points={points}
                memberKeys={memberKeys}
                colors={colors}
                curveType={curveType}
                controlCurveType={controlCurveType}
                gustPoints={gustPoints ? points.gusts : undefined}
              />
              {plotX && (
                <ChartCrosshairs
                  chartBounds={chartBounds}
                  colors={colors}
                  nowIdx={nowIdx}
                  plotX={plotX}
                  isActive={isActive}
                  pressX={pressState.x.position}
                  pressY={pressState.y.control.position}
                  syncIdx={syncIdx}
                />
              )}
            </>
          )}
        </CartesianChart>
        {overlay}
        {tooltip}
      </View>
    </View>
  );
}
