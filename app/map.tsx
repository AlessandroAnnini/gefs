import { useMemo, useState } from "react";
import { Dimensions, View } from "react-native";
import { useRouter } from "expo-router";
import MapView from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useLocationStore } from "@/stores";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";

const FALLBACK_LAT = 48.85;
const FALLBACK_LON = 2.35;

export default function MapScreen() {
  const router = useRouter();
  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);
  const setLocation = useLocationStore((s) => s.setLocation);

  const { isDark } = useResolvedColorScheme();
  const [center, setCenter] = useState({
    latitude: latitude ?? FALLBACK_LAT,
    longitude: longitude ?? FALLBACK_LON,
  });

  const initialRegion = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    const latDelta = 2;
    return {
      latitude: latitude ?? FALLBACK_LAT,
      longitude: longitude ?? FALLBACK_LON,
      latitudeDelta: latDelta,
      longitudeDelta: latDelta * (width / height),
    };
  }, [latitude, longitude]);

  const handleConfirm = () => {
    setLocation(center.latitude, center.longitude);
    router.back();
  };

  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        mapType="standard"
        userInterfaceStyle={isDark ? "dark" : "light"}
        initialRegion={initialRegion}
        onRegionChangeComplete={(r) =>
          setCenter({ latitude: r.latitude, longitude: r.longitude })
        }
      />

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
