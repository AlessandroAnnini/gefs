import { useMemo } from "react";
import { View } from "react-native";
import { Canvas, Path as SkiaPath, Line as SkiaLine, Text as SkiaText, vec } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { computeWindowProbability } from "@/services/openMeteo";
import { calendarVerticalGridPaths, xAtIndex, yTickLabelX } from "./shared";
import { useChartSync } from "./ChartSync";
import { useChartFonts } from "./ChartFonts";
import { GRID_MAJOR_STROKE, GRID_MINOR_STROKE } from "./overlays";

const BANNER_HEIGHT = 56;
const PLOT_TOP = 10;
const PLOT_BOTTOM = BANNER_HEIGHT - 8;

interface ProbabilityBannerProps {
  control: (number | null)[];
  members: (number | null)[][];
}

function yForProb(p: number): number {
  return PLOT_BOTTOM - p * (PLOT_BOTTOM - PLOT_TOP);
}

export function ProbabilityBanner({ control, members }: ProbabilityBannerProps) {
  const { colors, xAxis, plotX, syncIdx, showYAxis } = useChartSync();
  const { axisFont } = useChartFonts();

  const probability = useMemo(
    () => computeWindowProbability(members, control, 0.1, 12),
    [members, control]
  );

  const x0 = plotX?.x0 ?? 0;
  const x1 = plotX?.x1 ?? 0;
  const frameLeft = plotX?.frameLeft ?? x0;
  const frameRight = plotX?.frameRight ?? x1;
  const n = plotX?.n ?? probability.length;
  const span = x1 - x0;

  const syncP1 = useDerivedValue(() => {
    const idx = syncIdx.value;
    if (idx < 0 || n <= 1) return vec(-9999, PLOT_TOP);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    return vec(x0 + (clamped / (n - 1)) * span, PLOT_TOP);
  });
  const syncP2 = useDerivedValue(() => {
    const idx = syncIdx.value;
    if (idx < 0 || n <= 1) return vec(-9999, PLOT_BOTTOM);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    return vec(x0 + (clamped / (n - 1)) * span, PLOT_BOTTOM);
  });

  const { fillPath, strokePath } = useMemo(() => {
    if (probability.length === 0 || !plotX || n < 2) {
      return { fillPath: "", strokePath: "" };
    }
    const fp: string[] = [`M ${xAtIndex(x0, x1, 0, n)} ${PLOT_BOTTOM}`];
    const sp: string[] = [];
    for (let i = 0; i < probability.length; i++) {
      const x = xAtIndex(x0, x1, i, n);
      const y = yForProb(probability[i]);
      fp.push(`L ${x} ${y}`);
      sp.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }
    fp.push(`L ${xAtIndex(x0, x1, n - 1, n)} ${PLOT_BOTTOM} Z`);
    return { fillPath: fp.join(" "), strokePath: sp.join(" ") };
  }, [probability, plotX, x0, x1, n]);

  const { major: majorGridPath, minor: minorGridPath } = useMemo(() => {
    if (!plotX) return { major: "", minor: "" };
    return calendarVerticalGridPaths(
      xAxis.tickValues,
      xAxis.midnightIndices,
      plotX,
      PLOT_TOP,
      PLOT_BOTTOM
    );
  }, [plotX, xAxis.midnightIndices, xAxis.tickValues]);

  if (probability.length === 0 || !plotX) return null;

  const fillColor = colors.isDark
    ? "rgba(167,139,250,0.25)"
    : "rgba(124,58,237,0.18)";

  const ticks = [1, 0.5, 0];

  return (
    <View>
      <Text
        className="text-muted-foreground text-center"
        style={{ fontSize: 10, marginBottom: 2 }}
      >
        Rain probability (%) · 12h ≥0.1 mm
      </Text>
      <Canvas style={{ height: BANNER_HEIGHT, width: "100%" }}>
        {ticks.map((t) => (
          <SkiaLine
            key={`grid-${t}`}
            p1={vec(frameLeft, yForProb(t))}
            p2={vec(frameRight, yForProb(t))}
            color={colors.gridMinor}
            strokeWidth={1}
          />
        ))}
        <SkiaPath path={fillPath} color={fillColor} style="fill" />
        <SkiaPath
          path={strokePath}
          color={colors.probLine}
          style="stroke"
          strokeWidth={1}
        />
        {minorGridPath !== "" && (
          <SkiaPath
            path={minorGridPath}
            color={colors.gridMinor}
            style="stroke"
            strokeWidth={GRID_MINOR_STROKE}
          />
        )}
        {majorGridPath !== "" && (
          <SkiaPath
            path={majorGridPath}
            color={colors.gridMajor}
            style="stroke"
            strokeWidth={GRID_MAJOR_STROKE}
          />
        )}
        {showYAxis &&
          axisFont &&
          ticks.map((t) => {
            const text = String(Math.round(t * 100));
            const tw = axisFont.measureText(text).width;
            return (
              <SkiaText
                key={`lbl-${t}`}
                x={yTickLabelX(frameLeft, tw)}
                y={yForProb(t) + 4}
                text={text}
                font={axisFont}
                color={colors.axis}
              />
            );
          })}
        <SkiaLine
          p1={syncP1}
          p2={syncP2}
          color={colors.crosshair}
          strokeWidth={1}
        />
      </Canvas>
    </View>
  );
}
