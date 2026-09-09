import { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Canvas, Path as SkiaPath, Line as SkiaLine, Text as SkiaText, vec } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { computeWindowProbability } from "@/services/openMeteo";
import { useSettingsStore } from "@/stores";
import { useChartColors, useChartFonts } from "./shared";
import { useChartSync } from "./ChartSync";

const BANNER_HEIGHT = 56;
const PLOT_TOP = 10;
const PLOT_BOTTOM = BANNER_HEIGHT - 8;

interface ProbabilityBannerProps {
  control: (number | null)[];
  members: (number | null)[][];
  chartBounds: { left: number; right: number } | null;
}

function yForProb(p: number): number {
  return PLOT_BOTTOM - p * (PLOT_BOTTOM - PLOT_TOP);
}

export function ProbabilityBanner({ control, members, chartBounds }: ProbabilityBannerProps) {
  const colors = useChartColors();
  const { axisFont } = useChartFonts();
  const showYAxisUnits = useSettingsStore((s) => s.showYAxisUnits);
  const { syncIdx } = useChartSync();
  const [width, setWidth] = useState(0);

  const probability = useMemo(
    () => computeWindowProbability(members, control, 0.1, 12),
    [members, control]
  );

  const plotLeft = chartBounds?.left ?? 0;
  const plotRight = chartBounds?.right ?? 0;
  const n = probability.length;

  const syncP1 = useDerivedValue(() => {
    const idx = syncIdx.value;
    if (idx < 0 || n <= 1) return vec(-9999, PLOT_TOP);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    const x = plotLeft + (clamped / (n - 1)) * (plotRight - plotLeft);
    return vec(x, PLOT_TOP);
  });
  const syncP2 = useDerivedValue(() => {
    const idx = syncIdx.value;
    if (idx < 0 || n <= 1) return vec(-9999, PLOT_BOTTOM);
    const clamped = Math.min(Math.max(idx, 0), n - 1);
    const x = plotLeft + (clamped / (n - 1)) * (plotRight - plotLeft);
    return vec(x, PLOT_BOTTOM);
  });

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (probability.length === 0 || !chartBounds) return null;

  const fillColor = colors.isDark
    ? "rgba(167,139,250,0.25)"
    : "rgba(124,58,237,0.18)";

  const plotWidth = plotRight - plotLeft;

  const xScale = (i: number) =>
    plotLeft + (i / Math.max(probability.length - 1, 1)) * plotWidth;

  let fillPath = "";
  let strokePath = "";
  if (width > 0 && probability.length > 0) {
    const fp: string[] = [`M ${xScale(0)} ${PLOT_BOTTOM}`];
    const sp: string[] = [];
    for (let i = 0; i < probability.length; i++) {
      const x = xScale(i);
      const y = yForProb(probability[i]);
      fp.push(`L ${x} ${y}`);
      sp.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }
    fp.push(`L ${xScale(probability.length - 1)} ${PLOT_BOTTOM} Z`);
    fillPath = fp.join(" ");
    strokePath = sp.join(" ");
  }

  const ticks = [1, 0.5, 0];
  const tickLabel = (t: number) => `${Math.round(t * 100)}%`;

  return (
    <View onLayout={onLayout}>
      <Text
        className="text-muted-foreground text-center"
        style={{ fontSize: 10, marginBottom: 2 }}
      >
        Rain probability (12h, ≥0.1 mm)
      </Text>
      {width > 0 && (
        <Canvas style={{ height: BANNER_HEIGHT, width: "100%" }}>
          {ticks.map((t) => (
            <SkiaLine
              key={`grid-${t}`}
              p1={vec(plotLeft, yForProb(t))}
              p2={vec(plotRight, yForProb(t))}
              color={colors.grid}
              strokeWidth={0.5}
            />
          ))}
          <SkiaPath path={fillPath} color={fillColor} style="fill" />
          <SkiaPath
            path={strokePath}
            color={colors.probLine}
            style="stroke"
            strokeWidth={1}
          />
          {showYAxisUnits &&
            axisFont &&
            ticks.map((t) => (
              <SkiaText
                key={`lbl-${t}`}
                x={4}
                y={yForProb(t) + 4}
                text={tickLabel(t)}
                font={axisFont}
                color={colors.axis}
              />
            ))}
          <SkiaLine
            p1={syncP1}
            p2={syncP2}
            color={colors.crosshair}
            strokeWidth={1}
          />
        </Canvas>
      )}
    </View>
  );
}
