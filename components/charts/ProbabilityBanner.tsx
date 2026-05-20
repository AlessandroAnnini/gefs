import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Canvas, Path as SkiaPath } from "@shopify/react-native-skia";
import { Text } from "@/components/ui/text";
import { computeWindowProbability } from "@/services/openMeteo";
import { useMemo } from "react";
import {
  type ChartProps,
  useChartColors,
  useSeriesData,
} from "./shared";

const BANNER_HEIGHT = 44;

interface ProbabilityBannerProps extends ChartProps {
  chartBounds: { left: number; right: number } | null;
}

export function ProbabilityBanner({ hourly, variable, chartBounds }: ProbabilityBannerProps) {
  const colors = useChartColors();
  const { time, control, members } = useSeriesData(hourly, variable);
  const [width, setWidth] = useState(0);

  const probability = useMemo(
    () => computeWindowProbability(members, control, 0.1, 12),
    [members, control]
  );

  const maxProb = useMemo(() => {
    let m = 0;
    for (const p of probability) if (p > m) m = p;
    return m;
  }, [probability]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (probability.length === 0 || maxProb === 0 || !chartBounds) return null;

  const fillColor = colors.isDark
    ? "rgba(167,139,250,0.25)"
    : "rgba(124,58,237,0.18)";

  const plotLeft = chartBounds.left;
  const plotRight = chartBounds.right;
  const plotWidth = plotRight - plotLeft;

  const xScale = (i: number) =>
    plotLeft + (i / Math.max(probability.length - 1, 1)) * plotWidth;

  let fillPath = "";
  let strokePath = "";
  if (width > 0 && probability.length > 0) {
    const fp: string[] = [`M ${xScale(0)} ${BANNER_HEIGHT}`];
    const sp: string[] = [];
    for (let i = 0; i < probability.length; i++) {
      const x = xScale(i);
      const y = BANNER_HEIGHT - probability[i] * (BANNER_HEIGHT - 6);
      fp.push(`L ${x} ${y}`);
      sp.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }
    fp.push(`L ${xScale(probability.length - 1)} ${BANNER_HEIGHT} Z`);
    fillPath = fp.join(" ");
    strokePath = sp.join(" ");
  }

  return (
    <View onLayout={onLayout}>
      <Text
        className="text-muted-foreground text-center"
        style={{ fontSize: 10, marginBottom: 2 }}
      >
        Rain probability
      </Text>
      {width > 0 && (
        <Canvas style={{ height: BANNER_HEIGHT, width: "100%" }}>
          <SkiaPath path={fillPath} color={fillColor} style="fill" />
          <SkiaPath
            path={strokePath}
            color={colors.probLine}
            style="stroke"
            strokeWidth={1}
          />
        </Canvas>
      )}
    </View>
  );
}
