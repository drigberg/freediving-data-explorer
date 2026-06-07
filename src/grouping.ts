import type { DiveData, ProfilePoint } from "./parseData";
import { formatExposureSuit } from "./parseData";

// ── Types ──

export type GroupMode =
  | "none"
  | "dateInterval"
  | "discipline"
  | "weight"
  | "exposureSuit";
export type DateIntervalUnit = "month" | "quarter" | "year";
export type DisplayMode = "average" | "maximum";
export type RankCriterion = "longest" | "deepest";

export interface GroupingConfig {
  groupMode: GroupMode;
  dateIntervalUnit: DateIntervalUnit;
  displayMode: DisplayMode;
  maximumCriterion: RankCriterion;
}

export interface Tag {
  name: string;
  diveIndices: Set<number>;
}

/** Chart-facing series: [time, depth] only (temperature stripped). */
export interface ProcessedSeries {
  label: string;
  data: [number, number][];
}

export interface ProcessedData {
  series: ProcessedSeries[];
}

export function defaultGroupingConfig(): GroupingConfig {
  return {
    groupMode: "none",
    dateIntervalUnit: "month",
    displayMode: "average",
    maximumCriterion: "longest",
  };
}

// ── Helpers ──

function parseDate(seriesName: string): Date | null {
  const match = seriesName.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
  );
}

/** Strip optional temperature from profile points for chart-only use. */
function stripTemp(pts: ProfilePoint[]): [number, number][] {
  return pts.map(([t, d]) => [t, d]);
}

function getDuration(points: ProfilePoint[]): number {
  if (points.length === 0) return 0;
  return points[points.length - 1][0] - points[0][0];
}

function getMaxDepth(points: ProfilePoint[]): number {
  if (points.length === 0) return 0;
  return Math.min(...points.map(([, d]) => d));
}

function dateIntervalKey(date: Date, unit: DateIntervalUnit): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (unit) {
    case "month": {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${months[m]} ${y}`;
    }
    case "quarter":
      return `Q${Math.floor(m / 3) + 1} ${y}`;
    case "year":
      return `${y}`;
  }
}

/** Linear interpolation on stripped [time, depth] points. */
function interpolateAt(points: [number, number][], t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0][0]) return points[0][1];
  if (t >= points[points.length - 1][0]) return points[points.length - 1][1];

  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [t0, d0] = points[i - 1];
      const [t1, d1] = points[i];
      const frac = (t - t0) / (t1 - t0);
      return d0 + frac * (d1 - d0);
    }
  }
  return points[points.length - 1][1];
}

// ── Grouping functions ──

type Group = { label: string; indices: number[] };

function groupByNone(data: DiveData): Group[] {
  return data.seriesNames.map((name, i) => ({
    label: name,
    indices: [i],
  }));
}

function groupByDateInterval(data: DiveData, unit: DateIntervalUnit): Group[] {
  const buckets = new Map<string, number[]>();
  const bucketOrder: string[] = [];

  for (let i = 0; i < data.seriesNames.length; i++) {
    const date = parseDate(data.seriesNames[i]);
    const key = date ? dateIntervalKey(date, unit) : "Unknown";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      bucketOrder.push(key);
    }
    buckets.get(key)!.push(i);
  }

  return bucketOrder.map((key) => ({
    label: key,
    indices: buckets.get(key)!,
  }));
}

function groupByProperty(
  data: DiveData,
  getKey: (i: number) => string | undefined,
  sortKeys: (keys: string[]) => string[],
): Group[] {
  const buckets = new Map<string, number[]>();

  for (let i = 0; i < data.seriesNames.length; i++) {
    const key = getKey(i);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(i);
  }

  const unknown: number[] = [];
  for (let i = 0; i < data.seriesNames.length; i++) {
    if (!getKey(i)) unknown.push(i);
  }
  if (unknown.length > 0) buckets.set("(Unknown)", unknown);

  const keys = sortKeys([...buckets.keys()]);
  return keys
    .filter((key) => buckets.get(key)!.length > 0)
    .map((key) => ({
      label: key,
      indices: buckets.get(key)!.sort((a, b) => a - b),
    }));
}

function groupByDiscipline(data: DiveData): Group[] {
  return groupByProperty(
    data,
    (i) => data.disciplines[i],
    (keys) => {
      const unknown = keys.filter((k) => k === "(Unknown)");
      const known = keys.filter((k) => k !== "(Unknown)");
      return [...known, ...unknown];
    },
  );
}

function groupByWeight(data: DiveData): Group[] {
  return groupByProperty(
    data,
    (i) => {
      const weight = data.weights[i];
      return weight !== undefined ? `${weight}kg` : undefined;
    },
    (keys) => {
      const unknown = keys.filter((k) => k === "(Unknown)");
      const known = keys
        .filter((k) => k !== "(Unknown)")
        .sort((a, b) => parseFloat(a) - parseFloat(b));
      return [...known, ...unknown];
    },
  );
}

function groupByExposureSuit(data: DiveData): Group[] {
  return groupByProperty(
    data,
    (i) => {
      const suit = data.exposureSuits[i];
      return suit ? formatExposureSuit(suit) : undefined;
    },
    (keys) => {
      const unknown = keys.filter((k) => k === "(Unknown)");
      const known = keys.filter((k) => k !== "(Unknown)").sort();
      return [...known, ...unknown];
    },
  );
}

// ── Coalescing functions ──

function coalesceAverage(
  seriesData: ProfilePoint[][],
  indices: number[],
): [number, number][] {
  if (indices.length === 0) return [];
  if (indices.length === 1) return stripTemp(seriesData[indices[0]]);

  const stripped = indices.map((i) => stripTemp(seriesData[i]));
  const durations = stripped.map(getDuration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  if (avgDuration <= 0) return [[0, 0]];

  const step = 2;
  const numSteps = Math.round(avgDuration / step) + 1;
  const result: [number, number][] = [];

  for (let s = 0; s < numSteps; s++) {
    const t = s * step;
    let depthSum = 0;
    for (let k = 0; k < stripped.length; k++) {
      const points = stripped[k];
      const dur = durations[k];
      const normalizedT = dur > 0 ? (t / avgDuration) * dur : 0;
      depthSum += interpolateAt(points, normalizedT + points[0][0]);
    }
    result.push([t, Math.round((depthSum / stripped.length) * 10) / 10]);
  }

  return result;
}

function coalesceLongest(
  seriesData: ProfilePoint[][],
  indices: number[],
): { pickedIndex: number; data: [number, number][] } {
  let best = indices[0];
  let bestDur = getDuration(seriesData[indices[0]]);
  for (const i of indices) {
    const d = getDuration(seriesData[i]);
    if (d > bestDur) {
      bestDur = d;
      best = i;
    }
  }
  return { pickedIndex: best, data: stripTemp(seriesData[best]) };
}

function coalesceDeepest(
  seriesData: ProfilePoint[][],
  indices: number[],
): { pickedIndex: number; data: [number, number][] } {
  let best = indices[0];
  let bestDepth = getMaxDepth(seriesData[indices[0]]);
  for (const i of indices) {
    const d = getMaxDepth(seriesData[i]);
    if (d < bestDepth) {
      bestDepth = d;
      best = i;
    }
  }
  return { pickedIndex: best, data: stripTemp(seriesData[best]) };
}

function ensureTrailingZero(points: [number, number][]): [number, number][] {
  if (points.length > 0 && points[points.length - 1][1] !== 0) {
    return [...points, [points[points.length - 1][0] + 2, 0]];
  }
  return points;
}

// ── Main processing ──

export function processData(
  data: DiveData,
  config: GroupingConfig,
): ProcessedData {
  if (config.groupMode === "none") {
    return {
      series: data.seriesNames.map((name, i) => ({
        label: name,
        data: stripTemp(data.seriesData[i]),
      })),
    };
  }

  let groups: Group[];
  switch (config.groupMode) {
    case "dateInterval":
      groups = groupByDateInterval(data, config.dateIntervalUnit);
      break;
    case "discipline":
      groups = groupByDiscipline(data);
      break;
    case "weight":
      groups = groupByWeight(data);
      break;
    case "exposureSuit":
      groups = groupByExposureSuit(data);
      break;
    default:
      groups = groupByNone(data);
  }

  const series: ProcessedSeries[] = groups.map((group) => {
    let seriesPoints: [number, number][];
    let label = group.label;

    if (config.displayMode === "average") {
      seriesPoints = coalesceAverage(data.seriesData, group.indices);
    } else {
      const result =
        config.maximumCriterion === "longest"
          ? coalesceLongest(data.seriesData, group.indices)
          : coalesceDeepest(data.seriesData, group.indices);
      seriesPoints = result.data;
      const pickedName = data.seriesNames[result.pickedIndex];
      const dateMatch = pickedName.match(/^[\d-]+/)?.[0] ?? "";
      label = `${group.label} [${dateMatch}]`;
    }

    return { label, data: ensureTrailingZero(seriesPoints) };
  });

  return { series };
}
