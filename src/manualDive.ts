import type { ExposureSuit, ProfilePoint } from "./parseData";
import { normalizeProfilePoints } from "./parseData";
import type { DiveStore, StoredDive } from "./storage";

export type WetsuitCellType = "open" | "closed" | null;

export interface ManualDiveInput {
  date: string;
  time?: string;
  maxDepthM: number;
  durationSec: number;
  surfaceTempC: number;
  minTempC?: number;
  discipline?: string;
  weightKg?: number;
  exposureSuit?: ExposureSuit;
}

export interface ManualDiveFormState {
  date: string;
  time: string;
  maxDepth: string;
  duration: string;
  surfaceTemp: string;
  minTemp: string;
  discipline: string;
  weight: string;
  cellType: WetsuitCellType;
  suitThickness: string;
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseNonNegativeNumber(value: string): number | undefined {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) return undefined;
  return parsed;
}

export function canSubmitManualDiveForm(state: ManualDiveFormState): boolean {
  const parsedMaxDepth = parsePositiveNumber(state.maxDepth);
  const parsedDuration = parsePositiveNumber(state.duration);
  const parsedSurfaceTemp = parseFloat(state.surfaceTemp);
  const hasSurfaceTemp = !isNaN(parsedSurfaceTemp);
  const parsedMinTemp =
    state.minTemp.trim() === "" ? undefined : parseFloat(state.minTemp);
  const hasValidMinTemp =
    parsedMinTemp === undefined || !isNaN(parsedMinTemp);
  const parsedSuitThickness =
    state.suitThickness.trim() === ""
      ? undefined
      : parseNonNegativeNumber(state.suitThickness);
  const hasValidExposureSuit =
    state.cellType === null || parsedSuitThickness !== undefined;

  return (
    state.date !== "" &&
    parsedMaxDepth !== undefined &&
    parsedDuration !== undefined &&
    hasSurfaceTemp &&
    hasValidMinTemp &&
    hasValidExposureSuit
  );
}

export function manualDiveInputFromForm(
  state: ManualDiveFormState,
): ManualDiveInput | null {
  if (!canSubmitManualDiveForm(state)) return null;

  const parsedMaxDepth = parsePositiveNumber(state.maxDepth)!;
  const parsedDuration = parsePositiveNumber(state.duration)!;
  const parsedSurfaceTemp = parseFloat(state.surfaceTemp);
  const parsedMinTemp =
    state.minTemp.trim() === "" ? undefined : parseFloat(state.minTemp);
  const parsedWeight =
    state.weight.trim() === "" ? undefined : parseNonNegativeNumber(state.weight);
  const parsedSuitThickness =
    state.suitThickness.trim() === ""
      ? undefined
      : parseNonNegativeNumber(state.suitThickness);

  const input: ManualDiveInput = {
    date: state.date,
    maxDepthM: parsedMaxDepth,
    durationSec: parsedDuration,
    surfaceTempC: parsedSurfaceTemp,
  };

  if (state.time.trim() !== "") input.time = state.time;
  if (parsedMinTemp !== undefined && !isNaN(parsedMinTemp)) {
    input.minTempC = parsedMinTemp;
  }
  if (state.discipline) input.discipline = state.discipline;
  if (parsedWeight !== undefined) input.weightKg = parsedWeight;
  if (state.cellType !== null && parsedSuitThickness !== undefined) {
    input.exposureSuit = {
      openCell: state.cellType === "open",
      thicknessMm: parsedSuitThickness,
    };
  }

  return input;
}

export function datetimeFromDateAndTime(date: string, time?: string): string {
  const timePart = time && time.trim() !== "" ? time : "12:00";
  return `${date}T${timePart}:00Z`;
}

const DEFAULT_MANUAL_DIVE_TIME = "12:00";

function hasProvidedTime(time?: string): boolean {
  return time !== undefined && time.trim() !== "";
}

function divesOnDate(store: DiveStore, date: string): StoredDive[] {
  return store.dives.filter((d) => d.datetime.startsWith(date));
}

function latestDiveDatetimeOnDate(
  store: DiveStore,
  date: string,
): string | null {
  const sameDay = divesOnDate(store, date);
  if (sameDay.length === 0) return null;
  return [...sameDay.map((d) => d.datetime)].sort().at(-1)!;
}

function addOneMinuteToIsoDatetime(isoDatetime: string): string {
  const date = new Date(isoDatetime);
  date.setUTCMinutes(date.getUTCMinutes() + 1);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:00Z`;
}

export function resolveManualDiveDatetime(
  store: DiveStore,
  date: string,
  time?: string,
): string {
  if (hasProvidedTime(time)) {
    const datetime = datetimeFromDateAndTime(date, time);
    if (store.dives.some((d) => d.datetime === datetime)) {
      throw new Error("A dive already exists at this date and time");
    }
    return datetime;
  }

  const defaultDatetime = datetimeFromDateAndTime(date, DEFAULT_MANUAL_DIVE_TIME);
  if (!store.dives.some((d) => d.datetime === defaultDatetime)) {
    return defaultDatetime;
  }

  const latestDatetime = latestDiveDatetimeOnDate(store, date);
  if (!latestDatetime) {
    return defaultDatetime;
  }

  const fallbackDatetime = addOneMinuteToIsoDatetime(latestDatetime);
  if (fallbackDatetime.slice(0, 10) !== date) {
    throw new Error("No available time remaining on this date");
  }

  if (store.dives.some((d) => d.datetime === fallbackDatetime)) {
    throw new Error("A dive already exists at this date and time");
  }

  return fallbackDatetime;
}

export function buildManualDiveProfile(input: {
  maxDepthM: number;
  durationSec: number;
  surfaceTempC: number;
  minTempC?: number;
}): ProfilePoint[] {
  const { maxDepthM, durationSec, surfaceTempC, minTempC } = input;
  const maxDepth = -maxDepthM;
  const midTime = durationSec / 2;
  const midTemp = minTempC !== undefined ? minTempC : surfaceTempC;

  return normalizeProfilePoints([
    [0, 0, surfaceTempC],
    [midTime, maxDepth, midTemp],
    [durationSec, 0, surfaceTempC],
  ]);
}

export function nextDiveNumberForDate(store: DiveStore, date: string): number {
  const sameDay = store.dives.filter((d) => d.datetime.startsWith(date));
  if (sameDay.length === 0) return 1;
  return Math.max(...sameDay.map((d) => d.diveNumber)) + 1;
}

export function createManualDive(
  store: DiveStore,
  input: ManualDiveInput,
): StoredDive {
  const datetime = resolveManualDiveDatetime(store, input.date, input.time);

  const dive: StoredDive = {
    datetime,
    diveNumber: nextDiveNumberForDate(store, input.date),
    profile: buildManualDiveProfile({
      maxDepthM: input.maxDepthM,
      durationSec: input.durationSec,
      surfaceTempC: input.surfaceTempC,
      minTempC: input.minTempC,
    }),
  };

  if (input.discipline) dive.discipline = input.discipline;
  if (input.weightKg !== undefined) dive.weightKg = input.weightKg;
  if (input.exposureSuit) dive.exposureSuit = input.exposureSuit;

  return dive;
}
