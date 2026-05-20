import * as Location from "expo-location";
import { useCallback } from "react";

import { useLocationStore } from "@/stores";

export function useLocation() {
  const { latitude, longitude, setLocation, setIsSearching } = useLocationStore();

  const findLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    setIsSearching(true);
    try {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords.latitude, loc.coords.longitude);
    } finally {
      setIsSearching(false);
    }
  }, [setLocation, setIsSearching]);

  const setManualLocation = useCallback(
    (lat: number, lon: number) => {
      setLocation(lat, lon);
    },
    [setLocation]
  );

  return { latitude, longitude, findLocation, setManualLocation };
}
