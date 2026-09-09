import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  clampForecastDays,
  isEnsembleModel,
  WEATHER_VARIABLES,
  type EnsembleModel,
  type WeatherVariable,
} from "@/services/openMeteo";

const COLOR_SCHEMES = ["system", "light", "dark"] as const;
const DEFAULT_VARIABLES: WeatherVariable[] = [
  "temperature_2m",
  "precipitation",
  "pressure_msl",
  "wind_speed_10m",
];

function isColorScheme(value: unknown): value is (typeof COLOR_SCHEMES)[number] {
  return (COLOR_SCHEMES as readonly string[]).includes(value as string);
}

function sanitizeVariables(value: unknown): WeatherVariable[] {
  if (!Array.isArray(value)) return DEFAULT_VARIABLES;
  const next = value.filter((item): item is WeatherVariable =>
    (WEATHER_VARIABLES as readonly string[]).includes(item as string)
  );
  return next.length > 0 ? next : DEFAULT_VARIABLES;
}

interface SettingsState {
  model: EnsembleModel;
  forecastDays: number;
  variables: WeatherVariable[];
  colorScheme: "system" | "light" | "dark";
  showYAxisUnits: boolean;
  snoozedUpdateId: string | null;
  setModel: (model: EnsembleModel) => void;
  setForecastDays: (days: number) => void;
  setVariables: (variables: WeatherVariable[]) => void;
  setColorScheme: (scheme: "system" | "light" | "dark") => void;
  setShowYAxisUnits: (v: boolean) => void;
  setSnoozedUpdateId: (id: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      model: "ecmwf_ifs025",
      forecastDays: 7,
      variables: DEFAULT_VARIABLES,
      colorScheme: "system",
      showYAxisUnits: true,
      snoozedUpdateId: null,
      setModel: (model) =>
        set((s) => ({
          model,
          forecastDays: clampForecastDays(s.forecastDays, model),
        })),
      setForecastDays: (days) =>
        set((s) => ({ forecastDays: clampForecastDays(days, s.model) })),
      setVariables: (variables) => set({ variables: sanitizeVariables(variables) }),
      setColorScheme: (colorScheme) =>
        set({ colorScheme: isColorScheme(colorScheme) ? colorScheme : "system" }),
      setShowYAxisUnits: (showYAxisUnits) => set({ showYAxisUnits }),
      setSnoozedUpdateId: (snoozedUpdateId) => set({ snoozedUpdateId }),
    }),
    {
      name: "gefs-settings",
      version: 5,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted) => {
        const s = { ...(persisted as Record<string, unknown>) };
        delete s.isLocationFromMap;
        const model = isEnsembleModel(s.model) ? s.model : "ecmwf_ifs025";
        s.model = model;
        s.forecastDays = clampForecastDays((s.forecastDays as number) ?? 7, model);
        s.variables = sanitizeVariables(s.variables);
        s.colorScheme = isColorScheme(s.colorScheme) ? s.colorScheme : "system";
        if (typeof s.snoozedUpdateId !== "string") {
          const legacy = s.snoozedUpdateVersionCode;
          s.snoozedUpdateId =
            typeof legacy === "number" && legacy > 0 ? `c:${legacy}` : null;
        }
        delete s.snoozedUpdateVersionCode;
        return s as unknown as SettingsState;
      },
    }
  )
);
