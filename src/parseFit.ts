import FitParser from "fit-file-parser";
import type { ParsedUddfDive, ProfilePoint } from "./parseData";
import { normalizeProfilePoints } from "./parseData";

interface FitRecord {
  elapsed_time?: number;
  depth?: number;
  temperature?: number;
}

interface FitLap {
  start_time?: string | Date;
  total_elapsed_time?: number;
  message_index?: { value?: number };
}

interface FitSession {
  start_time?: string | Date;
}

interface ParsedFitData {
  sessions?: FitSession[];
  laps?: FitLap[];
  records?: FitRecord[];
}

const FIT_PARSER_OPTIONS = {
  force: true,
  speedUnit: "m/s",
  lengthUnit: "m",
  temperatureUnit: "celsius",
  elapsedRecordField: true,
  mode: "list" as const,
};

/** FIT depth values are stored in millimeters. */
function depthMeters(rawDepth: number): number {
  return rawDepth / 1000;
}

function recordsToProfile(
  records: FitRecord[],
  lapStartElapsed: number,
): ProfilePoint[] {
  const profile: ProfilePoint[] = [];

  for (const record of records) {
    if (record.elapsed_time === undefined || record.depth === undefined) {
      continue;
    }

    const time = Math.round(record.elapsed_time - lapStartElapsed);
    const depth = -depthMeters(record.depth);
    if (isNaN(time) || isNaN(depth)) continue;

    if (record.temperature !== undefined) {
      const temp = Math.round(record.temperature * 10) / 10;
      profile.push([time, depth, temp]);
    } else {
      profile.push([time, depth]);
    }
  }

  if (profile.length === 0) return [];

  return normalizeProfilePoints(profile);
}

/** FIT timestamps may be ISO strings or Date objects depending on runtime. */
function fitTimestampToIso(value: string | Date | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function lapElapsedStart(
  lap: FitLap,
  sessionStartMs: number,
): number | null {
  const startTime = fitTimestampToIso(lap.start_time);
  if (!startTime) return null;
  const lapStartMs = new Date(startTime).getTime();
  if (isNaN(lapStartMs)) return null;
  return (lapStartMs - sessionStartMs) / 1000;
}

function divesFromLaps(
  laps: FitLap[],
  records: FitRecord[],
  sessionStartMs: number,
): ParsedUddfDive[] {
  const dives: ParsedUddfDive[] = [];

  for (let i = 0; i < laps.length; i++) {
    const lap = laps[i];
    const datetime = fitTimestampToIso(lap.start_time);
    const lapStartElapsed = lapElapsedStart(lap, sessionStartMs);
    if (lapStartElapsed === null || !datetime) continue;

    const nextLap = laps[i + 1];
    const lapEndElapsed = nextLap
      ? lapElapsedStart(nextLap, sessionStartMs)
      : lapStartElapsed + (lap.total_elapsed_time ?? 0);

    if (lapEndElapsed === null) continue;

    const lapRecords = records.filter(
      (record) =>
        record.elapsed_time !== undefined &&
        record.elapsed_time >= lapStartElapsed &&
        record.elapsed_time < lapEndElapsed,
    );

    const profile = recordsToProfile(lapRecords, lapStartElapsed);
    if (profile.length === 0) continue;

    const diveNumber =
      (lap.message_index?.value ?? i) + 1;

    dives.push({
      datetime,
      diveNumber,
      profile,
    });
  }

  return dives;
}

function diveFromSession(
  session: FitSession,
  records: FitRecord[],
): ParsedUddfDive | null {
  const datetime = fitTimestampToIso(session.start_time);
  if (!datetime || records.length === 0) return null;

  const sessionStartMs = new Date(datetime).getTime();
  if (isNaN(sessionStartMs)) return null;

  const firstElapsed = records[0].elapsed_time ?? 0;
  const profile = recordsToProfile(records, firstElapsed);
  if (profile.length === 0) return null;

  return {
    datetime,
    diveNumber: 1,
    profile,
  };
}

/**
 * Parse a Garmin/Polar/Suunto .FIT file and return one dive per lap
 * (or a single dive from the session when no laps are present).
 */
export async function parseFitArrayBuffer(
  buffer: ArrayBuffer,
): Promise<ParsedUddfDive[]> {
  const parser = new FitParser(FIT_PARSER_OPTIONS);

  let data: ParsedFitData;
  try {
    data = (await parser.parseAsync(buffer)) as ParsedFitData;
  } catch (error) {
    const message =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : "Failed to parse FIT file";
    throw new Error(message);
  }

  const records = data.records ?? [];
  if (records.length === 0) return [];

  const session = data.sessions?.[0];
  const sessionStart = fitTimestampToIso(session?.start_time);
  if (!sessionStart) return [];

  const sessionStartMs = new Date(sessionStart).getTime();
  if (isNaN(sessionStartMs)) return [];

  const laps = data.laps ?? [];
  if (laps.length > 0) {
    return divesFromLaps(laps, records, sessionStartMs);
  }

  const dive = diveFromSession(session ?? {}, records);
  return dive ? [dive] : [];
}
