import { memo, type ReactNode } from "react";
import { View } from "react-native";
import { AreaRange, Line } from "victory-native";
import {
  Circle,
  Group,
  Line as SkiaLine,
  Path as SkiaPath,
  Text as SkiaText,
  DashPathEffect,
  vec,
  type SkFont,
} from "@shopify/react-native-skia";
import {
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import {
  calendarVerticalGridPaths,
  formatYTick,
  xAtIndex,
  yTickLabelX,
  Y_AXIS_TICK_COUNT,
  type ChartColors,
  type PlotXRange,
  type XAxisBundle,
} from "./shared";

type CurveType = "natural" | "linear";
type ChartBounds = { top: number; bottom: number; left: number; right: number };

export const GRID_MINOR_STROKE = 1;
export const GRID_MAJOR_STROKE = 1.25;

type PointsMap = Record<string, any>;

interface CalendarGridProps {
  tickValues: number[];
  midnightIndices: number[];
  chartBounds: ChartBounds;
  colors: ChartColors;
  plotX: PlotXRange;
}

export const CalendarGrid = memo(function CalendarGrid({
  tickValues,
  midnightIndices,
  chartBounds,
  colors,
  plotX,
}: CalendarGridProps) {
  if (!plotX || plotX.n < 2) return null;
  const { major, minor } = calendarVerticalGridPaths(
    tickValues,
    midnightIndices,
    plotX,
    chartBounds.top,
    chartBounds.bottom
  );

  return (
    <Group>
      {minor !== "" && (
        <SkiaPath
          path={minor}
          color={colors.gridMinor}
          style="stroke"
          strokeWidth={GRID_MINOR_STROKE}
        />
      )}
      {major !== "" && (
        <SkiaPath
          path={major}
          color={colors.gridMajor}
          style="stroke"
          strokeWidth={GRID_MAJOR_STROKE}
        />
      )}
    </Group>
  );
});

interface CalendarDayLabelsProps {
  dayLabels: { idx: number; text: string }[];
  axisFont: SkFont | null;
  chartBounds: ChartBounds;
  colors: ChartColors;
  plotX: PlotXRange;
}

type YScale = ((v: number) => number) & { ticks?: (count: number) => number[] };

interface YAxisLabelsProps {
  ticks: number[];
  yScale: (v: number) => number;
  chartBounds: ChartBounds;
  font: SkFont;
  colors: ChartColors;
}

function YAxisLabels({ ticks, yScale, chartBounds, font, colors }: YAxisLabelsProps) {
  const { left, top, bottom } = chartBounds;
  const size = font.getSize();
  return (
    <Group>
      {ticks.map((tick) => {
        const text = formatYTick(tick);
        if (!text) return null;
        const tw = font.measureText(text).width;
        const y = Math.min(Math.max(yScale(tick) + size / 3, top + size), bottom - 2);
        if (!Number.isFinite(y) || !Number.isFinite(tw)) return null;
        return (
          <SkiaText
            key={`y-${tick}`}
            x={yTickLabelX(left, tw)}
            y={y}
            text={text}
            font={font}
            color={colors.axis}
          />
        );
      })}
    </Group>
  );
}

interface ChartOutsideAxesProps {
  axisFont: SkFont | null;
  yScale: YScale;
  chartBounds: ChartBounds;
  xAxis: XAxisBundle;
  colors: ChartColors;
  showYAxis: boolean;
  plotX: PlotXRange | null;
}

/** Day + Y labels sit outside Victory's plot clip so edge ticks stay visible. */
export function ChartOutsideAxes({
  axisFont,
  yScale,
  chartBounds,
  xAxis,
  colors,
  showYAxis,
  plotX,
}: ChartOutsideAxesProps) {
  const ticks = showYAxis && yScale.ticks ? yScale.ticks(Y_AXIS_TICK_COUNT) : [];
  return (
    <>
      {showYAxis && axisFont ? (
        <YAxisLabels
          ticks={ticks}
          yScale={yScale}
          chartBounds={chartBounds}
          font={axisFont}
          colors={colors}
        />
      ) : null}
      {plotX ? (
        <CalendarDayLabels
          dayLabels={xAxis.dayLabels}
          axisFont={axisFont}
          chartBounds={chartBounds}
          colors={colors}
          plotX={plotX}
        />
      ) : null}
    </>
  );
}

/** Drawn via CartesianChart renderOutside — children are clipped to the plot. */
export function CalendarDayLabels({
  dayLabels,
  axisFont,
  chartBounds,
  colors,
  plotX,
}: CalendarDayLabelsProps) {
  if (!axisFont || dayLabels.length === 0) return null;
  const { left, right, bottom } = chartBounds;
  const y = bottom + 2 + axisFont.getSize();

  return (
    <Group>
      {dayLabels.map(({ idx, text }) => {
        const x = xAtIndex(plotX.x0, plotX.x1, idx, plotX.n);
        const tw = axisFont.measureText(text).width;
        const tx = Math.min(Math.max(x - tw / 2, left), right - tw);
        if (!Number.isFinite(tx)) return null;
        return (
          <SkiaText
            key={`day-${idx}`}
            x={tx}
            y={y}
            text={text}
            font={axisFont}
            color={colors.axis}
          />
        );
      })}
    </Group>
  );
}

interface EnsembleBandsProps {
  points: PointsMap;
  memberKeys: string[];
  colors: ChartColors;
  /** Bands and member spaghetti */
  curveType: CurveType;
  /** Control / mean line */
  controlCurveType?: CurveType;
  gustPoints?: any;
}

export function EnsembleBands({
  points,
  memberKeys,
  colors,
  curveType,
  controlCurveType,
  gustPoints,
}: EnsembleBandsProps) {
  const controlCurve = controlCurveType ?? curveType;
  return (
    <>
      {points.p10 && points.p90 && (
        <AreaRange
          upperPoints={points.p90}
          lowerPoints={points.p10}
          color={colors.outerSpread}
          curveType={curveType}
        />
      )}
      {points.p25 && points.p75 && (
        <AreaRange
          upperPoints={points.p75}
          lowerPoints={points.p25}
          color={colors.innerSpread}
          curveType={curveType}
        />
      )}
      {memberKeys.map((key) =>
        points[key] ? (
          <Line
            key={key}
            points={points[key]}
            color={colors.member}
            strokeWidth={0.8}
            curveType={curveType}
          />
        ) : null
      )}
      {points.control && (
        <Line
          points={points.control}
          color={colors.control}
          strokeWidth={2.5}
          curveType={controlCurve}
        />
      )}
      {gustPoints && (
        <Line
          points={gustPoints}
          color={colors.gust}
          strokeWidth={1.5}
          curveType={curveType}
        />
      )}
    </>
  );
}

interface ChartCrosshairsProps {
  chartBounds: { top: number; bottom: number; left: number; right: number };
  colors: ChartColors;
  nowIdx: number | null;
  plotX: PlotXRange;
  isActive: boolean;
  pressX: SharedValue<number>;
  pressY: SharedValue<number>;
  syncIdx: SharedValue<number>;
}

export function ChartCrosshairs({
  chartBounds,
  colors,
  nowIdx,
  plotX,
  isActive,
  pressX,
  pressY,
  syncIdx,
}: ChartCrosshairsProps) {
  const { top, bottom } = chartBounds;
  const { x0, x1, n } = plotX;
  const ready = Number.isFinite(top) && Number.isFinite(bottom);
  const span = ready ? x1 - x0 : 0;
  const nowX = ready && nowIdx != null ? xAtIndex(x0, x1, nowIdx, n) : null;

  const activeP1 = useDerivedValue(() => vec(pressX.value, top));
  const activeP2 = useDerivedValue(() => vec(pressX.value, bottom));

  const followerP1 = useDerivedValue(() => {
    const idx = syncIdx.value;
    if (idx < 0 || n <= 1) return vec(-9999, top);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    const x = x0 + (clamped / (n - 1)) * span;
    return vec(x, top);
  });
  const followerP2 = useDerivedValue(() => {
    const idx = syncIdx.value;
    if (idx < 0 || n <= 1) return vec(-9999, bottom);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    const x = x0 + (clamped / (n - 1)) * span;
    return vec(x, bottom);
  });

  return (
    <>
      {ready && nowIdx != null && nowX != null && Number.isFinite(nowX) && (
        <SkiaLine
          p1={vec(nowX, top)}
          p2={vec(nowX, bottom)}
          color={colors.nowLine}
          strokeWidth={1}
        >
          <DashPathEffect intervals={[4, 3]} />
        </SkiaLine>
      )}
      {ready && isActive && (
        <>
          <SkiaLine p1={activeP1} p2={activeP2} color={colors.crosshair} strokeWidth={1} />
          <Circle cx={pressX} cy={pressY} r={5} color={colors.control} />
        </>
      )}
      {ready && !isActive && (
        <SkiaLine
          p1={followerP1}
          p2={followerP2}
          color={colors.crosshair}
          strokeWidth={1}
        />
      )}
    </>
  );
}

interface ChartTooltipProps {
  time: string;
  value: string;
  unit: string;
  extra?: ReactNode;
}

export function ChartTooltip({ time, value, unit, extra }: ChartTooltipProps) {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 8, left: 0, right: 0, alignItems: "center" }}
    >
      <View
        className="bg-card/90 border border-border rounded-lg px-3 py-1.5"
        style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}
      >
        <Text className="text-muted-foreground text-xs">{time}</Text>
        <Text className="text-primary font-bold text-xs">
          {value} {unit}
        </Text>
        {extra}
      </View>
    </View>
  );
}
