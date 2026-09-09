import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import {
  downloadAndInstallUpdate,
  fetchLatestUpdate,
  getCachedUpdate,
  isNewerUpdate,
  type AvailableUpdate,
} from "@/services/appUpdate";
import { useSettingsStore, useStoresHydrated } from "@/stores";

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
let lastCheckAt = 0;

export function useAppUpdate(autoCheck: boolean) {
  const hydrated = useStoresHydrated();
  const snoozedUpdateVersionCode = useSettingsStore((s) => s.snoozedUpdateVersionCode);
  const setSnoozedUpdateVersionCode = useSettingsStore((s) => s.setSnoozedUpdateVersionCode);

  const [available, setAvailable] = useState<AvailableUpdate | null>(getCachedUpdate);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const visible =
    available != null &&
    isNewerUpdate(available) &&
    !(available.versionCode > 0 && available.versionCode === snoozedUpdateVersionCode);

  const check = useCallback(
    async (force: boolean) => {
      if (Platform.OS !== "android") return null;
      if (!force && Date.now() - lastCheckAt < CHECK_INTERVAL_MS) {
        const cached = getCachedUpdate();
        setAvailable(cached);
        return cached;
      }

      setChecking(true);
      setError(null);
      try {
        const update = await fetchLatestUpdate();
        lastCheckAt = Date.now();
        setAvailable(update);
        return update;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not check for updates."
        );
        return null;
      } finally {
        setChecking(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!autoCheck || !hydrated || Platform.OS !== "android") return;
    void check(false);
  }, [autoCheck, check, hydrated]);

  const snooze = useCallback(() => {
    if (available && available.versionCode > 0) {
      setSnoozedUpdateVersionCode(available.versionCode);
    }
  }, [available, setSnoozedUpdateVersionCode]);

  const install = useCallback(async () => {
    if (!available) return;
    setInstalling(true);
    setProgress(0);
    setError(null);
    try {
      await downloadAndInstallUpdate(available, setProgress);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not install the update."
      );
    } finally {
      setInstalling(false);
    }
  }, [available]);

  return {
    latest: available,
    banner: visible ? available : null,
    checking,
    installing,
    progress,
    error,
    check,
    snooze,
    install,
  };
}
