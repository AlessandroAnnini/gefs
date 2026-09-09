import { useMemo, useState } from "react";
import { Dimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useLocationStore } from "@/stores";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";
import { hasGoogleMapsApiKey } from "@/lib/googleMaps";

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

  if (!hasGoogleMapsApiKey()) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="flex-1 justify-center px-6">
          <Text variant="h4" className="text-center mb-2">
            Map unavailable
          </Text>
          <Text variant="muted" className="text-center mb-6">
            This build has no Google Maps API key. Rebuild with GOOGLE_MAPS_API_KEY
            in .env, or add that repository secret before a release.
          </Text>
          <Button onPress={() => router.back()}>
            <Text className="text-primary-foreground font-semibold">Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

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
