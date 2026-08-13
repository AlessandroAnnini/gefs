import { useEffect, useState } from "react";

import { useLocationStore } from "./locationStore";
import { useSettingsStore } from "./settingsStore";

export { useSettingsStore } from "./settingsStore";
export { useLocationStore } from "./locationStore";

export function useStoresHydrated(): boolean {
  const [hydrated, setHydrated] = useState(
    () => useSettingsStore.persist.hasHydrated() && useLocationStore.persist.hasHydrated()
  );

  useEffect(() => {
    const check = () => {
      if (useSettingsStore.persist.hasHydrated() && useLocationStore.persist.hasHydrated()) {
        setHydrated(true);
      }
    };
    const unsubSettings = useSettingsStore.persist.onFinishHydration(check);
    const unsubLocation = useLocationStore.persist.onFinishHydration(check);
    check();
    return () => {
      unsubSettings();
      unsubLocation();
    };
  }, []);

  return hydrated;
}
