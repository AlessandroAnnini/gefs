import { useQuery } from "@tanstack/react-query";

const ENSEMBLE_BASE = "https://ensemble-api.open-meteo.com/v1/ensemble";

export const WEATHER_VARIABLES = [
  "temperature_2m",
  "precipitation",
  "pressure_msl",
  "wind_speed_10m",
] as const;

export type WeatherVariable = (typeof WEATHER_VARIABLES)[number];

export const VARIABLE_LABELS: Record<WeatherVariable, string> = {
  temperature_2m: "Temperature 2m",
  precipitation: "Precipitation",
  pressure_msl: "Sea Level Pressure",
  wind_speed_10m: "Wind Speed 10m",
};

export const VARIABLE_UNITS: Record<WeatherVariable, string> = {
  temperature_2m: "°C",
  precipitation: "mm",
  pressure_msl: "hPa",
  wind_speed_10m: "km/h",
};

/** Extra variables fetched alongside user-selected ones but not rendered as standalone charts */
export const AUXILIARY_VARIABLES = ["wind_gusts_10m"] as const;

export const ENSEMBLE_MODELS = {
  ecmwf_ifs025: "ECMWF IFS 0.25°",
  gfs025: "GFS 0.25°",
  icon_seamless: "ICON Seamless",
} as const;

export type EnsembleModel = keyof typeof ENSEMBLE_MODELS;

export interface EnsembleResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  elevation: number;
  hourly_units: Record<string, string>;
  hourly: Record<string, (number | null)[]>;
}

export interface EnsembleSeries {
  time: string[];
  control: (number | null)[];
  members: (number | null)[][];
}

const MEMBER_COUNT = 50;

export function parseEnsembleSeries(
  hourly: Record<string, (number | null)[]>,
  variable: WeatherVariable
): EnsembleSeries {
  const time = hourly.time as unknown as string[];
  const control = hourly[variable] ?? [];
  const members: (number | null)[][] = [];

  for (let i = 1; i <= MEMBER_COUNT; i++) {
    const key = `${variable}_member${String(i).padStart(2, "0")}`;
    if (hourly[key]) {
      members.push(hourly[key]);
    }
  }

  return { time, control, members };
}

export function computePercentiles(
  members: (number | null)[][],
  control: (number | null)[],
  pLow = 0.1,
  pHigh = 0.9
): { low: (number | null)[]; high: (number | null)[] } {
  const len = control.length;
  const low: (number | null)[] = new Array(len);
  const high: (number | null)[] = new Array(len);

  for (let t = 0; t < len; t++) {
    const vals: number[] = [];
    if (control[t] != null) vals.push(control[t]!);
    for (const m of members) {
      if (m[t] != null) vals.push(m[t]!);
    }
    if (vals.length === 0) {
      low[t] = null;
      high[t] = null;
      continue;
    }
    vals.sort((a, b) => a - b);
    low[t] = vals[Math.floor(pLow * (vals.length - 1))];
    high[t] = vals[Math.ceil(pHigh * (vals.length - 1))];
  }

  return { low, high };
}

/**
 * Compute the fraction of ensemble members that produce any value >= threshold
 * within a rolling window. This answers "what % chance of rain in the next N hours"
 * rather than "what % chance of rain at this exact hour."
 */
export function computeWindowProbability(
  members: (number | null)[][],
  control: (number | null)[],
  threshold: number,
  windowSize: number
): number[] {
  const len = control.length;
  const result: number[] = new Array(len).fill(0);

  for (let t = 0; t < len; t++) {
    const end = Math.min(t + windowSize, len);
    let total = 0;
    let membersExceeding = 0;

    const controlHits = controlExceedsInWindow(control, threshold, t, end);
    if (controlHits !== null) {
      total++;
      if (controlHits) membersExceeding++;
    }

    for (const m of members) {
      const hasData = memberExceedsInWindow(m, threshold, t, end);
      if (hasData !== null) {
        total++;
        if (hasData) membersExceeding++;
      }
    }

    result[t] = total > 0 ? membersExceeding / total : 0;
  }

  return result;
}

function controlExceedsInWindow(
  arr: (number | null)[],
  threshold: number,
  start: number,
  end: number
): boolean | null {
  let hasData = false;
  for (let i = start; i < end; i++) {
    if (arr[i] != null) {
      hasData = true;
      if (arr[i]! >= threshold) return true;
    }
  }
  return hasData ? false : null;
}

function memberExceedsInWindow(
  arr: (number | null)[],
  threshold: number,
  start: number,
  end: number
): boolean | null {
  let hasData = false;
  for (let i = start; i < end; i++) {
    if (arr[i] != null) {
      hasData = true;
      if (arr[i]! >= threshold) return true;
    }
  }
  return hasData ? false : null;
}

export interface TempAlert {
  idx: number;
  type: "frost" | "heat";
}

/**
 * Find timesteps where any ensemble member crosses frost (<0°C) or heat (>35°C) thresholds.
 * Samples every 6 hours to avoid clutter.
 */
export function detectTempAlerts(
  members: (number | null)[][],
  control: (number | null)[],
  time: string[]
): TempAlert[] {
  const alerts: TempAlert[] = [];
  const len = control.length;

  for (let t = 0; t < len; t++) {
    const d = new Date(time[t]);
    if (d.getHours() % 6 !== 0) continue;

    let minVal = control[t] ?? Infinity;
    let maxVal = control[t] ?? -Infinity;
    for (const m of members) {
      if (m[t] != null) {
        minVal = Math.min(minVal, m[t]!);
        maxVal = Math.max(maxVal, m[t]!);
      }
    }

    if (minVal < 0) alerts.push({ idx: t, type: "frost" });
    else if (maxVal > 35) alerts.push({ idx: t, type: "heat" });
  }
  return alerts;
}

export interface DailyRain {
  label: string;
  median: number;
  p10: number;
  p90: number;
}

/**
 * Sum hourly precipitation into daily totals across all ensemble members,
 * then return the median, P10, and P90 of daily totals.
 * Groups by local calendar day.
 */
export function computeDailyRain(
  members: (number | null)[][],
  control: (number | null)[],
  time: string[]
): DailyRain[] {
  if (time.length === 0) return [];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const allSeries = [control, ...members];

  const dayKeys: string[] = [];
  const dayLabels: string[] = [];
  const hourToDay: number[] = new Array(time.length);

  for (let t = 0; t < time.length; t++) {
    const d = new Date(time[t]);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let idx = dayKeys.indexOf(key);
    if (idx === -1) {
      idx = dayKeys.length;
      dayKeys.push(key);
      dayLabels.push(`${dayNames[d.getDay()]} ${d.getDate()}`);
    }
    hourToDay[t] = idx;
  }

  const numDays = dayKeys.length;
  const dailyTotalsPerMember: number[][] = [];

  for (const series of allSeries) {
    const sums = new Array(numDays).fill(0);
    for (let t = 0; t < time.length; t++) {
      sums[hourToDay[t]] += series[t] ?? 0;
    }
    dailyTotalsPerMember.push(sums);
  }

  const result: DailyRain[] = [];
  for (let d = 0; d < numDays; d++) {
    const vals = dailyTotalsPerMember.map((s) => s[d]).sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)];
    const lo = vals[Math.floor(0.1 * (vals.length - 1))];
    const hi = vals[Math.ceil(0.9 * (vals.length - 1))];
    result.push({
      label: dayLabels[d],
      median: Math.round(median * 10) / 10,
      p10: Math.round(lo * 10) / 10,
      p90: Math.round(hi * 10) / 10,
    });
  }

  return result;
}

async function fetchEnsemble(
  lat: number,
  lon: number,
  variables: WeatherVariable[],
  model: EnsembleModel,
  days: number
): Promise<EnsembleResponse> {
  const allVars = [...variables];
  if (variables.includes("wind_speed_10m") && !allVars.includes("wind_gusts_10m" as any)) {
    allVars.push("wind_gusts_10m" as any);
  }
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: allVars.join(","),
    models: model,
    forecast_days: days.toString(),
  });
  const res = await fetch(`${ENSEMBLE_BASE}?${params}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`);
  }
  return res.json();
}

export function useEnsembleData(
  lat: number,
  lon: number,
  variables: WeatherVariable[],
  model: EnsembleModel = "ecmwf_ifs025",
  days: number = 7
) {
  const variablesKey = variables.slice().sort().join(",");
  return useQuery({
    queryKey: ["ensemble", lat.toFixed(4), lon.toFixed(4), model, days, variablesKey],
    queryFn: () => fetchEnsemble(lat, lon, variables, model, days),
    enabled: lat !== 0 || lon !== 0,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });
}
