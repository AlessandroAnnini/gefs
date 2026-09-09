import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { AreaRange, Line } from "victory-native";
import {
  Circle,
  Line as SkiaLine,
  DashPathEffect,
  vec,
} from "@shopify/react-native-skia";
import {
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import type { useChartColors } from "./shared";

type ChartColors = ReturnType<typeof useChartColors>;
type CurveType = "natural" | "linear";
type ChartBounds = { top: number; bottom: number; left: number; right: number };

const MIDNIGHT_STROKE = 0.7;

type PointsMap = Record<string, any>;

interface CalendarGridProps {
  tickValues: number[];
  midnightIndices: number[];
  xScale: (idx: number) => number;
  chartBounds: ChartBounds;
  colors: ChartColors;
}

export const CalendarGrid = memo(function CalendarGrid({
  tickValues,
  midnightIndices,
  xScale,
  chartBounds,
  colors,
}: CalendarGridProps) {
  const { top, bottom, left, right } = chartBounds;
  const midnight = new Set(midnightIndices);

  return (
    <>
      {tickValues.map((idx) => {
        const x = xScale(idx);
        if (!Number.isFinite(x) || x < left || x > right) return null;
        const isMidnight = midnight.has(idx);
        return (
          <SkiaLine
            key={`cal-${idx}`}
            p1={vec(x, top)}
            p2={vec(x, bottom)}
            color={isMidnight ? colors.gridMajor : colors.gridMinor}
            strokeWidth={isMidnight ? MIDNIGHT_STROKE : StyleSheet.hairlineWidth}
          />
        );
      })}
    </>
  );
});

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
  nowX: number | null;
  isActive: boolean;
  pressX: SharedValue<number>;
  pressY: SharedValue<number>;
  syncIdx: SharedValue<number>;
  dataLength: number;
}

export function ChartCrosshairs({
  chartBounds,
  colors,
  nowIdx,
  nowX,
  isActive,
  pressX,
  pressY,
  syncIdx,
  dataLength,
}: ChartCrosshairsProps) {
  const { top, bottom, left, right } = chartBounds;
  const n = dataLength;

  const activeP1 = useDerivedValue(() => vec(pressX.value, top));
  const activeP2 = useDerivedValue(() => vec(pressX.value, bottom));

  const followerP1 = useDerivedValue(() => {
    const idx = syncIdx.value;
    if (idx < 0 || n <= 1) return vec(-9999, top);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    const x = left + (clamped / (n - 1)) * (right - left);
    return vec(x, top);
  });
  const followerP2 = useDerivedValue(() => {
    const idx = syncIdx.value;
    if (idx < 0 || n <= 1) return vec(-9999, bottom);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    const x = left + (clamped / (n - 1)) * (right - left);
    return vec(x, bottom);
  });

  return (
    <>
      {nowIdx != null && nowX != null && (
        <SkiaLine
          p1={vec(nowX, top)}
          p2={vec(nowX, bottom)}
          color={colors.nowLine}
          strokeWidth={1}
        >
          <DashPathEffect intervals={[4, 3]} />
        </SkiaLine>
      )}
      {isActive && (
        <>
          <SkiaLine p1={activeP1} p2={activeP2} color={colors.crosshair} strokeWidth={1} />
          <Circle cx={pressX} cy={pressY} r={5} color={colors.control} />
        </>
      )}
      {!isActive && (
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
