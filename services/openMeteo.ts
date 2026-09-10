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
export const AUXILIARY_VARIABLES = [
  "weather_code",
  "snowfall",
  "rain",
  "wind_gusts_10m",
  /** Needed for freezing-rain pairing even when the temperature chart is hidden */
  "temperature_2m",
] as const;

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

export type ForecastErrorKind = "coverage" | "transient";

export class ForecastError extends Error {
  readonly kind: ForecastErrorKind;

  constructor(kind: ForecastErrorKind) {
    super(kind);
    this.name = "ForecastError";
    this.kind = kind;
  }
}

export function isForecastError(error: unknown): error is ForecastError {
  if (typeof error !== "object" || error == null) return false;
  const kind = (error as { kind?: unknown }).kind;
  return kind === "coverage" || kind === "transient";
}

export function isCoverageError(error: unknown): boolean {
  return isForecastError(error) && error.kind === "coverage";
}

const FETCH_TIMEOUT_MS = 30_000;
const COVERAGE_REASON = /no data|not available|for this location/i;

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isFiniteCoord(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function isCoverageReason(reason: unknown): boolean {
  return typeof reason === "string" && COVERAGE_REASON.test(reason);
}

function isCoverageBody(
  res: Response,
  body: EnsembleResponse & { error?: boolean; reason?: string }
): boolean {
  if (isCoverageReason(body.reason)) return true;
  if (
    res.ok &&
    (body.hourly == null ||
      !isFiniteCoord(body.latitude) ||
      !isFiniteCoord(body.longitude))
  ) {
    return true;
  }
  return false;
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

/** Control at [0], members at [1..64]. Cached per hourly object. */
type SeriesBank = ((number | null)[] | undefined)[];
const seriesBankCache = new WeakMap<object, Map<string, SeriesBank>>();

function seriesBank(
  hourly: Record<string, (number | null)[]>,
  name: string
): SeriesBank {
  let byName = seriesBankCache.get(hourly);
  if (!byName) {
    byName = new Map();
    seriesBankCache.set(hourly, byName);
  }
  let bank = byName.get(name);
  if (!bank) {
    bank = new Array(MEMBER_COUNT + 1);
    bank[0] = hourly[name];
    for (let i = 1; i <= MEMBER_COUNT; i++) {
      bank[i] = hourly[`${name}_member${String(i).padStart(2, "0")}`];
    }
    byName.set(name, bank);
  }
  return bank;
}

function finiteCell(series: (number | null)[] | undefined, t: number): number | null {
  const v = series?.[t];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function civilTimeline(time: number[], utcOffsetSeconds: number): CivilParts[] {
  return time.map((t) => civilParts(t, utcOffsetSeconds));
}

export function parseUnixTimes(raw: (number | null)[] | undefined): number[] {
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
  variable: string
): (number | null)[][] {
  const members: (number | null)[][] = [];
  const bank = seriesBank(hourly, variable);
  for (let i = 1; i <= MEMBER_COUNT; i++) {
    const series = bank[i];
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
  civils: CivilParts[]
): TempAlert[] {
  const alerts: TempAlert[] = [];
  const len = Math.min(control.length, civils.length);

  for (let t = 0; t < len; t++) {
    if (civils[t].hours % 6 !== 0) continue;

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

export const WEATHER_EVENT_TYPES = [
  "hail",
  "thunder",
  "freezing_rain",
  "snow",
  "gusts",
] as const;

export type WeatherEventType = (typeof WEATHER_EVENT_TYPES)[number];

export interface WeatherEvent {
  idx: number;
  type: WeatherEventType;
}

const EVENT_MEMBER_FRACTION = 0.25;
const SNOW_CM = 0.1;
const RAIN_MM = 0.1;
const GUST_KMH = 70;

function collectFinite(
  hourly: Record<string, (number | null)[]>,
  name: string,
  t: number
): number[] {
  const out: number[] = [];
  const bank = seriesBank(hourly, name);
  for (let i = 0; i <= MEMBER_COUNT; i++) {
    const v = finiteCell(bank[i], t);
    if (v != null) out.push(v);
  }
  return out;
}

function membersAgree(hits: number, n: number): boolean {
  return n > 0 && hits / n >= EVENT_MEMBER_FRACTION;
}

function isHailCode(code: number): boolean {
  return code === 96 || code === 99;
}

function isThunderCode(code: number): boolean {
  return code === 95 || isHailCode(code);
}

function isFreezingRainCode(code: number): boolean {
  return code === 66 || code === 67;
}

function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

const EVENT_PRIORITY: Record<WeatherEventType, number> = {
  hail: 0,
  thunder: 1,
  freezing_rain: 2,
  snow: 3,
  gusts: 4,
};

function betterEvent(a: WeatherEventType | null, b: WeatherEventType): WeatherEventType {
  if (a == null) return b;
  return EVENT_PRIORITY[b] < EVENT_PRIORITY[a] ? b : a;
}

function eventTypeAtHour(
  hourly: Record<string, (number | null)[]>,
  t: number,
  rainBank: SeriesBank,
  tempBank: SeriesBank
): WeatherEventType | null {
  const wmo = collectFinite(hourly, "weather_code", t).map((c) => Math.round(c));
  const snowAmt = collectFinite(hourly, "snowfall", t);
  const gustAmt = collectFinite(hourly, "wind_gusts_10m", t);

  let fzHits = 0;
  let fzN = 0;
  for (let i = 0; i <= MEMBER_COUNT; i++) {
    const r = finiteCell(rainBank[i], t);
    const c = finiteCell(tempBank[i], t);
    if (r == null || c == null) continue;
    fzN += 1;
    if (r > RAIN_MM && c <= 0) fzHits += 1;
  }

  if (membersAgree(wmo.filter(isHailCode).length, wmo.length)) return "hail";
  if (membersAgree(wmo.filter(isThunderCode).length, wmo.length)) return "thunder";
  if (
    membersAgree(wmo.filter(isFreezingRainCode).length, wmo.length) ||
    membersAgree(fzHits, fzN)
  ) {
    return "freezing_rain";
  }
  if (
    membersAgree(snowAmt.filter((v) => v > SNOW_CM).length, snowAmt.length) ||
    membersAgree(wmo.filter(isSnowCode).length, wmo.length)
  ) {
    return "snow";
  }
  if (membersAgree(gustAmt.filter((v) => v >= GUST_KMH).length, gustAmt.length)) return "gusts";
  return null;
}

/**
 * One icon per local 6-hour block (00–05, 06–11, …). A block fires when any
 * hour in it has ≥25% of finite members agreeing. Priority: hail > thunder >
 * freezing rain > snow > gusts. Icon sits on the 00/06/12/18 hour when present.
 */
export function detectWeatherEvents(
  hourly: Record<string, (number | null)[]>,
  civils: CivilParts[]
): WeatherEvent[] {
  if (civils.length === 0) return [];

  const rainBank = seriesBank(hourly, "rain");
  const tempBank = seriesBank(hourly, "temperature_2m");
  const blocks = new Map<string, number[]>();

  for (let t = 0; t < civils.length; t++) {
    const c = civils[t];
    const key = `${c.year}-${c.month}-${c.date}-${Math.floor(c.hours / 6)}`;
    const list = blocks.get(key);
    if (list) list.push(t);
    else blocks.set(key, [t]);
  }

  const events: WeatherEvent[] = [];
  for (const indices of blocks.values()) {
    let best: WeatherEventType | null = null;
    let placeIdx = indices[0];
    for (const t of indices) {
      if (civils[t].hours % 6 === 0) placeIdx = t;
      if (best === "hail") continue;
      const type = eventTypeAtHour(hourly, t, rainBank, tempBank);
      if (type) best = betterEvent(best, type);
    }
    if (best) events.push({ idx: placeIdx, type: best });
  }

  return events;
}

async function fetchEnsemble(
  lat: number,
  lon: number,
  variables: WeatherVariable[],
  model: EnsembleModel,
  days: number
): Promise<EnsembleResponse> {
  const allVars: string[] = [...variables];
  for (const extra of AUXILIARY_VARIABLES) {
    if (!allVars.includes(extra)) allVars.push(extra);
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
  let res: Response;
  let raw: string;
  try {
    res = await fetchWithTimeout(`${ENSEMBLE_BASE}?${params}`, FETCH_TIMEOUT_MS);
    raw = await res.text();
  } catch {
    throw new ForecastError("transient");
  }

  let body: EnsembleResponse & { error?: boolean; reason?: string };
  try {
    body = JSON.parse(raw) as EnsembleResponse & { error?: boolean; reason?: string };
  } catch {
    throw new ForecastError(/\bnan\b/i.test(raw) ? "coverage" : "transient");
  }

  if (isCoverageBody(res, body)) {
    throw new ForecastError("coverage");
  }
  if (!res.ok || body.error) {
    throw new ForecastError("transient");
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
    queryFn: () => fetchEnsemble(lat!, lon!, variables, model, clampedDays),
    enabled: lat != null && lon != null,
    retry: (failureCount, error) => !isCoverageError(error) && failureCount < 2,
    staleTime: 30 * 60 * 1000,
    refetchInterval: (query) =>
      isCoverageError(query.state.error) ? false : 60 * 60 * 1000,
  });
}
