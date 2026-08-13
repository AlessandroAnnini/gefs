import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  clampForecastDays,
  type EnsembleModel,
  type WeatherVariable,
} from "@/services/openMeteo";

interface SettingsState {
  model: EnsembleModel;
  forecastDays: number;
  variables: WeatherVariable[];
  colorScheme: "system" | "light" | "dark";
  showYAxisUnits: boolean;
  setModel: (model: EnsembleModel) => void;
  setForecastDays: (days: number) => void;
  setVariables: (variables: WeatherVariable[]) => void;
  setColorScheme: (scheme: "system" | "light" | "dark") => void;
  setShowYAxisUnits: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      model: "ecmwf_ifs025",
      forecastDays: 7,
      variables: ["temperature_2m", "precipitation", "pressure_msl", "wind_speed_10m"],
      colorScheme: "system",
      showYAxisUnits: true,
      setModel: (model) =>
        set((s) => ({
          model,
          forecastDays: clampForecastDays(s.forecastDays, model),
        })),
      setForecastDays: (days) =>
        set((s) => ({ forecastDays: clampForecastDays(days, s.model) })),
      setVariables: (variables) => set({ variables }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setShowYAxisUnits: (showYAxisUnits) => set({ showYAxisUnits }),
    }),
    {
      name: "gefs-settings",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted) => {
        const s = { ...(persisted as Record<string, unknown>) };
        delete s.isLocationFromMap;
        const model = (s.model as EnsembleModel) ?? "ecmwf_ifs025";
        s.forecastDays = clampForecastDays((s.forecastDays as number) ?? 7, model);
        return s as unknown as SettingsState;
      },
    }
  )
);
