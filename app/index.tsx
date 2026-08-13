import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { ChartList } from "@/components/ChartList";
import { useLocation } from "@/hooks";
import { useLocationStore, useSettingsStore, useStoresHydrated } from "@/stores";
import { ENSEMBLE_MODELS } from "@/services/openMeteo";
import { Ionicons } from "@expo/vector-icons";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";

export default function ForecastScreen() {
  const router = useRouter();
  const hydrated = useStoresHydrated();
  const { latitude, longitude, findLocation } = useLocation();
  const isSearching = useLocationStore((s) => s.isSearching);
  const permissionDenied = useLocationStore((s) => s.permissionDenied);
  const errorMessage = useLocationStore((s) => s.errorMessage);
  const model = useSettingsStore((s) => s.model);
  const { isDark } = useResolvedColorScheme();

  const iconColor = isDark ? "#38bdf8" : "#0891b2";

  useEffect(() => {
    if (!hydrated) return;
    if (latitude == null || longitude == null) {
      findLocation();
    }
  }, [hydrated, latitude, longitude, findLocation]);

  const coordsLabel =
    latitude != null && longitude != null
      ? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
      : permissionDenied
        ? "Location denied"
        : errorMessage
          ? "Location failed"
          : "Locating\u2026";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-border">
        <View className="flex-1 mr-2">
          <Text variant="muted" className="text-xs">
            {ENSEMBLE_MODELS[model]} {"\u00B7"} {coordsLabel}
          </Text>
        </View>
        <View className="flex-row gap-1">
          <Button variant="ghost" size="icon" onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={20} color={iconColor} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onPress={findLocation}
            disabled={isSearching}
          >
            <Ionicons
              name={isSearching ? "hourglass-outline" : "locate-outline"}
              size={20}
              color={iconColor}
            />
          </Button>
          <Button variant="ghost" size="icon" onPress={() => router.push("/map")}>
            <Ionicons name="map-outline" size={20} color={iconColor} />
          </Button>
        </View>
      </View>

      <ChartList />
    </SafeAreaView>
  );
}
