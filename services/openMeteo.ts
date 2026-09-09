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
  meteoswiss_icon_ch1_ensemble: "ICON CH1 1km",
} as const;

export type EnsembleModel = keyof typeof ENSEMBLE_MODELS;

export function isEnsembleModel(value: unknown): value is EnsembleModel {
  return typeof value === "string" && value in ENSEMBLE_MODELS;
}

export const FORECAST_DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 14] as const;

/** Longest horizon that currently returns a full control run (no trailing nulls). */
export const MODEL_MAX_DAYS: Record<EnsembleModel, number> = {
  ecmwf_ifs025: 14,
  gfs025: 10,
  icon_seamless: 7,
  /** Native CH1 ensemble is ~33 hours. */
  meteoswiss_icon_ch1_ensemble: 2,
};

export function clampForecastDays(days: number, model: EnsembleModel): number {
  const max = MODEL_MAX_DAYS[model];
  const allowed = FORECAST_DAY_OPTIONS.filter((d) => d <= max);
  if (allowed.length === 0) return FORECAST_DAY_OPTIONS[0];
  const safeDays = Number.isFinite(days) ? days : max;
  const capped = Math.min(safeDays, max);
  return allowed.reduce((best, d) => (d <= capped ? d : best), allowed[0]);
}

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
  time: number[];
  control: (number | null)[];
  members: (number | null)[][];
}

export interface CivilParts {
  year: number;
  month: number;
  date: number;
  day: number;
  hours: number;
}

/** Interpret a UNIX timestamp in the forecast location's timezone. */
export function civilParts(unixSeconds: number, utcOffsetSeconds: number): CivilParts {
  const d = new Date((unixSeconds + utcOffsetSeconds) * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    day: d.getUTCDay(),
    hours: d.getUTCHours(),
  };
}

/** High enough for WeatherNext (64) and ECMWF (50); missing keys are skipped. */
const MEMBER_COUNT = 64;

function parseUnixTimes(raw: (number | null)[] | undefined): number[] {
  if (!raw) return [];
  const out: number[] = [];
  for (const t of raw) {
    if (typeof t === "number" && Number.isFinite(t)) out.push(t);
  }
  return out;
}

function hasValueAt(
  control: (number | null)[],
  members: (number | null)[][],
  t: number
): boolean {
  if (control[t] != null) return true;
  for (const m of members) {
    if (m[t] != null) return true;
  }
  return false;
}

function collectMembers(
  hourly: Record<string, (number | null)[]>,
  variable: WeatherVariable
): (number | null)[][] {
  const members: (number | null)[][] = [];
  for (let i = 1; i <= MEMBER_COUNT; i++) {
    const key = `${variable}_member${String(i).padStart(2, "0")}`;
    const series = hourly[key];
    if (Array.isArray(series) && series.length > 0) members.push(series);
  }
  return members;
}

export function lastDataIndex(
  hourly: Record<string, (number | null)[]>,
  variable: WeatherVariable
): number {
  const control = hourly[variable] ?? [];
  const members = collectMembers(hourly, variable);
  const timeLen = (hourly.time ?? []).length;
  const seriesLen = Math.max(
    control.length,
    ...members.map((m) => m.length),
    0
  );
  const len = Math.min(timeLen > 0 ? timeLen : seriesLen, seriesLen);
  let last = -1;
  for (let t = 0; t < len; t++) {
    if (hasValueAt(control, members, t)) last = t;
  }
  return last;
}

/** Slice every hourly series to a shared length so all charts share the same time index. */
export function trimHourlyToSharedTail(
  hourly: Record<string, (number | null)[]>,
  variables: WeatherVariable[]
): Record<string, (number | null)[]> {
  if (variables.length === 0) return hourly;
  let last = -1;
  for (const v of variables) {
    last = Math.max(last, lastDataIndex(hourly, v));
  }
  const timeLen = (hourly.time ?? []).length;
  const length = last < 0 ? 0 : Math.min(last + 1, timeLen);
  if (length === timeLen) return hourly;
  const sliced: Record<string, (number | null)[]> = {};
  for (const [key, series] of Object.entries(hourly)) {
    sliced[key] = series.slice(0, length);
  }
  return sliced;
}

export function parseEnsembleSeries(
  hourly: Record<string, (number | null)[]>,
  variable: WeatherVariable
): EnsembleSeries {
  const time = parseUnixTimes(hourly.time);
  const control = hourly[variable] ?? [];
  const members = collectMembers(hourly, variable);
  return { time, control, members };
}

/** One sort per timestep for the standard ensemble bands. */
export function computeBands(
  members: (number | null)[][],
  control: (number | null)[]
): {
  p10: (number | null)[];
  p25: (number | null)[];
  p75: (number | null)[];
  p90: (number | null)[];
} {
  const len = control.length;
  const p10: (number | null)[] = new Array(len);
  const p25: (number | null)[] = new Array(len);
  const p75: (number | null)[] = new Array(len);
  const p90: (number | null)[] = new Array(len);

  for (let t = 0; t < len; t++) {
    const vals: number[] = [];
    if (control[t] != null) vals.push(control[t]!);
    for (const m of members) {
      if (m[t] != null) vals.push(m[t]!);
    }
    if (vals.length === 0) {
      p10[t] = p25[t] = p75[t] = p90[t] = null;
      continue;
    }
    vals.sort((a, b) => a - b);
    const last = vals.length - 1;
    p10[t] = vals[Math.floor(0.1 * last)];
    p25[t] = vals[Math.floor(0.25 * last)];
    p75[t] = vals[Math.ceil(0.75 * last)];
    p90[t] = vals[Math.ceil(0.9 * last)];
  }

  return { p10, p25, p75, p90 };
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

    const controlHits = exceedsInWindow(control, threshold, t, end);
    if (controlHits !== null) {
      total++;
      if (controlHits) membersExceeding++;
    }

    for (const m of members) {
      const hasData = exceedsInWindow(m, threshold, t, end);
      if (hasData !== null) {
        total++;
        if (hasData) membersExceeding++;
      }
    }

    result[t] = total > 0 ? membersExceeding / total : 0;
  }

  return result;
}

function exceedsInWindow(
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
 * Samples every 6 hours (location local time) to avoid clutter.
 */
export function detectTempAlerts(
  members: (number | null)[][],
  control: (number | null)[],
  time: number[],
  utcOffsetSeconds: number
): TempAlert[] {
  const alerts: TempAlert[] = [];
  const len = control.length;

  for (let t = 0; t < len; t++) {
    if (civilParts(time[t], utcOffsetSeconds).hours % 6 !== 0) continue;

    let minVal = control[t] ?? Infinity;
    let maxVal = control[t] ?? -Infinity;
    for (const m of members) {
      if (m[t] != null) {
        minVal = Math.min(minVal, m[t]!);
        maxVal = Math.max(maxVal, m[t]!);
      }
    }

    if (minVal === Infinity) continue;
    if (minVal < 0) alerts.push({ idx: t, type: "frost" });
    if (maxVal > 35) alerts.push({ idx: t, type: "heat" });
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
 * Groups by the forecast location's calendar day. Null hours are skipped.
 */
export function computeDailyRain(
  members: (number | null)[][],
  control: (number | null)[],
  time: number[],
  utcOffsetSeconds: number
): DailyRain[] {
  if (time.length === 0) return [];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const allSeries = [control, ...members];

  const dayKeys: string[] = [];
  const dayLabels: string[] = [];
  const hourToDay: number[] = new Array(time.length);

  for (let t = 0; t < time.length; t++) {
    const p = civilParts(time[t], utcOffsetSeconds);
    const key = `${p.year}-${p.month}-${p.date}`;
    let idx = dayKeys.indexOf(key);
    if (idx === -1) {
      idx = dayKeys.length;
      dayKeys.push(key);
      dayLabels.push(`${dayNames[p.day]} ${p.date}`);
    }
    hourToDay[t] = idx;
  }

  const numDays = dayKeys.length;
  const dailyTotalsPerMember: number[][] = [];

  for (const series of allSeries) {
    const sums = new Array(numDays).fill(0);
    for (let t = 0; t < time.length; t++) {
      if (series[t] != null) sums[hourToDay[t]] += series[t]!;
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
  const allVars: string[] = [...variables];
  if (variables.includes("wind_speed_10m")) {
    for (const extra of AUXILIARY_VARIABLES) {
      if (!allVars.includes(extra)) allVars.push(extra);
    }
  }
  const forecastDays = clampForecastDays(days, model);
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: allVars.join(","),
    models: model,
    forecast_days: forecastDays.toString(),
    timezone: "auto",
    timeformat: "unixtime",
  });
  const res = await fetch(`${ENSEMBLE_BASE}?${params}`);
  let body: EnsembleResponse & { error?: boolean; reason?: string };
  try {
    body = await res.json();
  } catch {
    throw new Error(`Open-Meteo API error: ${res.status}`);
  }
  if (!res.ok || body.error) {
    throw new Error(body.reason ?? `Open-Meteo API error: ${res.status}`);
  }
  return body;
}

export function useEnsembleData(
  lat: number | null,
  lon: number | null,
  variables: WeatherVariable[],
  model: EnsembleModel = "ecmwf_ifs025",
  days: number = 7
) {
  const variablesKey = variables.slice().sort().join(",");
  const clampedDays = clampForecastDays(days, model);
  return useQuery({
    queryKey: [
      "ensemble",
      lat?.toFixed(4) ?? "none",
      lon?.toFixed(4) ?? "none",
      model,
      clampedDays,
      variablesKey,
    ],
    queryFn: () => fetchEnsemble(lat!, lon!, variables, model, days),
    enabled: lat != null && lon != null,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });
}
