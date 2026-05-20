import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { EnsembleModel, WeatherVariable } from "@/services/openMeteo";

interface SettingsState {
  model: EnsembleModel;
  forecastDays: number;
  variables: WeatherVariable[];
  colorScheme: "system" | "light" | "dark";
  isLocationFromMap: boolean;
  showYAxisUnits: boolean;
  setModel: (model: EnsembleModel) => void;
  setForecastDays: (days: number) => void;
  setVariables: (variables: WeatherVariable[]) => void;
  setColorScheme: (scheme: "system" | "light" | "dark") => void;
  setIsLocationFromMap: (v: boolean) => void;
  setShowYAxisUnits: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      model: "ecmwf_ifs025",
      forecastDays: 7,
      variables: ["temperature_2m", "precipitation", "pressure_msl", "wind_speed_10m"],
      colorScheme: "system",
      isLocationFromMap: false,
      showYAxisUnits: true,
      setModel: (model) => set({ model }),
      setForecastDays: (forecastDays) => set({ forecastDays }),
      setVariables: (variables) => set({ variables }),
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setIsLocationFromMap: (isLocationFromMap) => set({ isLocationFromMap }),
      setShowYAxisUnits: (showYAxisUnits) => set({ showYAxisUnits }),
    }),
    {
      name: "gefs-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
