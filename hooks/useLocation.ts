import * as Location from "expo-location";
import { useCallback } from "react";

import { useLocationStore } from "@/stores";

export function useLocation() {
  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);
  const setLocation = useLocationStore((s) => s.setLocation);
  const setIsSearching = useLocationStore((s) => s.setIsSearching);
  const setPermissionDenied = useLocationStore((s) => s.setPermissionDenied);
  const setErrorMessage = useLocationStore((s) => s.setErrorMessage);

  const findLocation = useCallback(async () => {
    setPermissionDenied(false);
    setErrorMessage(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPermissionDenied(true);
      return;
    }

    setIsSearching(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc.coords.latitude, loc.coords.longitude);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not get GPS position";
      setErrorMessage(message);
    } finally {
      setIsSearching(false);
    }
  }, [setLocation, setIsSearching, setPermissionDenied, setErrorMessage]);

  return { latitude, longitude, findLocation };
}
