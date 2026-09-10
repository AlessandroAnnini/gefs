import { useMemo } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  detectWeatherEvents,
  type WeatherEventType,
} from "@/services/openMeteo";
import { xAtIndex } from "./shared";
import { useChartSync } from "./ChartSync";

const ICON_SIZE = 17;

const EVENT_ICONS: Record<WeatherEventType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  hail: "weather-hail",
  thunder: "weather-lightning",
  freezing_rain: "weather-snowy-rainy",
  snow: "weather-snowy-heavy",
  gusts: "weather-windy",
};

const EVENT_LABELS: Record<WeatherEventType, string> = {
  hail: "Hail",
  thunder: "Thunder",
  freezing_rain: "Freezing rain",
  snow: "Snow",
  gusts: "Severe gusts",
};

function eventColor(type: WeatherEventType, isDark: boolean): string {
  switch (type) {
    case "hail":
    case "thunder":
      return isDark ? "#fbbf24" : "#d97706";
    case "freezing_rain":
      return isDark ? "#2dd4bf" : "#0f766e";
    case "snow":
      return isDark ? "#93c5fd" : "#3b82f6";
    case "gusts":
      return isDark ? "rgba(251,146,60,0.9)" : "rgba(234,88,12,0.8)";
  }
}

export function EventRail() {
  const { hourly, civils, plotX, colors, pad } = useChartSync();

  const events = useMemo(
    () => detectWeatherEvents(hourly, civils),
    [hourly, civils]
  );

  if (events.length === 0 || !plotX || plotX.n < 2) return null;

  const { x0, x1, n } = plotX;
  const colPx = (Math.max(x1 - x0, 1) / (n - 1)) * 6;
  const iconSize = Math.min(ICON_SIZE, Math.max(12, colPx - 2));
  const summary = events.map((e) => EVENT_LABELS[e.type]).join(", ");

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Events, 6 hours. ${summary}`}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: pad.top,
        height: iconSize + 4,
      }}
    >
      {events.map((event) => {
        const x = xAtIndex(x0, x1, event.idx, n);
        return (
          <View
            key={`${event.type}-${event.idx}`}
            style={{
              position: "absolute",
              left: x - iconSize / 2,
              top: 2,
              width: iconSize,
              height: iconSize,
            }}
          >
            <MaterialCommunityIcons
              name={EVENT_ICONS[event.type]}
              size={iconSize}
              color={eventColor(event.type, colors.isDark)}
            />
          </View>
        );
      })}
    </View>
  );
}
