import { useMemo, useState } from "react";
import { Dimensions, View } from "react-native";
import { useRouter } from "expo-router";
import MapView from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useLocationStore, useSettingsStore } from "@/stores";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";

export default function MapScreen() {
  const router = useRouter();
  const { latitude, longitude, setLocation } = useLocationStore();
  const setIsLocationFromMap = useSettingsStore((s) => s.setIsLocationFromMap);

  const { isDark } = useResolvedColorScheme();
  const [center, setCenter] = useState({ latitude, longitude });

  const initialRegion = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    const latDelta = 2;
    return {
      latitude: latitude || 48.85,
      longitude: longitude || 2.35,
      latitudeDelta: latDelta,
      longitudeDelta: latDelta * (width / height),
    };
  }, []);

  const handleConfirm = () => {
    setLocation(center.latitude, center.longitude);
    setIsLocationFromMap(true);
    router.back();
  };

  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        mapType="standard"
        userInterfaceStyle={isDark ? "dark" : "light"}
        initialRegion={initialRegion}
        onRegionChange={(r) => setCenter({ latitude: r.latitude, longitude: r.longitude })}
        onRegionChangeComplete={(r) => setCenter({ latitude: r.latitude, longitude: r.longitude })}
      />

      {/* Fixed crosshair pin always at screen center */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons
          name="location-sharp"
          size={44}
          color="#dc2626"
          style={{ marginBottom: 44 }}
        />
      </View>

      <View className="absolute bottom-8 left-4 right-4">
        <View className="bg-card rounded-xl p-4 shadow-lg border border-border">
          <Text variant="muted" className="text-center mb-3">
            {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
          </Text>
          <Button onPress={handleConfirm}>
            <Text className="text-primary-foreground font-semibold">Use This Location</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
