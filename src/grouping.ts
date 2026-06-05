import type { DiveData } from "./parseData";

// ── Types ──

export type GroupMode = "none" | "dateInterval" | "n" | "percentile";
export type DateIntervalUnit = "month" | "quarter" | "year";
export type DisplayMode = "average" | "maximum";
export type RankCriterion = "longest" | "deepest";

export const PERCENTILE_VALUES = [2, 5, 10, 20, 25, 100 / 3, 50] as const;

export interface GroupingConfig {
  groupMode: GroupMode;
  dateIntervalUnit: DateIntervalUnit;
  nValue: number;
  percentileCriterion: RankCriterion;
  percentileValue: number;
  displayMode: DisplayMode;
  maximumCriterion: RankCriterion;
}

export interface ProcessedSeries {
  label: string;
  data: [number, number][];
}

export interface ProcessedData {
  series: ProcessedSeries[];
}

export function defaultGroupingConfig(totalSeries: number): GroupingConfig {
  return {
    groupMode: "none",
    dateIntervalUnit: "month",
    nValue: Math.min(3, totalSeries),
    percentileCriterion: "deepest",
    percentileValue: 50,
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
    parseInt(match[3], 10)
  );
}

function getDuration(points: [number, number][]): number {
  if (points.length === 0) return 0;
  return points[points.length - 1][0] - points[0][0];
}

function getMaxDepth(points: [number, number][]): number {
  if (points.length === 0) return 0;
  return Math.min(...points.map(([, d]) => d));
}

function dateIntervalKey(
  date: Date,
  unit: DateIntervalUnit
): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (unit) {
    case "month": {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[m]} ${y}`;
    }
    case "quarter":
      return `Q${Math.floor(m / 3) + 1} ${y}`;
    case "year":
      return `${y}`;
  }
}

/**
 * Linear interpolation: given sorted points, return depth at the given time.
 */
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

function groupByDateInterval(
  data: DiveData,
  unit: DateIntervalUnit
): Group[] {
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

function groupByN(data: DiveData, n: number): Group[] {
  const groups: Group[] = [];
  for (let start = 0; start < data.seriesNames.length; start += n) {
    const indices = [];
    for (let j = start; j < Math.min(start + n, data.seriesNames.length); j++) {
      indices.push(j);
    }
    const firstLabel = data.seriesNames[indices[0]].match(/^[\d-]+/)?.[0] ?? "";
    const lastLabel = data.seriesNames[indices[indices.length - 1]].match(/^[\d-]+/)?.[0] ?? "";
    const label = indices.length === 1 ? firstLabel : `${firstLabel} – ${lastLabel}`;
    groups.push({ label, indices });
  }
  return groups;
}

function groupByPercentile(
  data: DiveData,
  criterion: RankCriterion,
  percentile: number
): Group[] {
  const ranked = data.seriesNames.map((_, i) => ({
    index: i,
    value:
      criterion === "longest"
        ? getDuration(data.seriesData[i])
        : Math.abs(getMaxDepth(data.seriesData[i])),
  }));
  ranked.sort((a, b) => a.value - b.value);

  const numBuckets = Math.round(100 / percentile);
  const groups: Group[] = [];

  for (let b = 0; b < numBuckets; b++) {
    const lo = b / numBuckets;
    const hi = (b + 1) / numBuckets;
    const indices = ranked
      .filter((_, ri) => {
        const p = ri / ranked.length;
        return p >= lo && (b === numBuckets - 1 ? p <= hi : p < hi);
      })
      .map((r) => r.index)
      .sort((a, b) => a - b);

    if (indices.length > 0) {
      const pLo = Math.round(lo * 100);
      const pHi = Math.round(hi * 100);
      groups.push({
        label: `P${pLo}–${pHi} (${criterion})`,
        indices,
      });
    }
  }

  return groups;
}

// ── Coalescing functions ──

function coalesceAverage(
  seriesData: [number, number][][],
  indices: number[]
): [number, number][] {
  if (indices.length === 0) return [];
  if (indices.length === 1) return seriesData[indices[0]];

  const durations = indices.map((i) => getDuration(seriesData[i]));
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  if (avgDuration <= 0) return [[0, 0]];

  const step = 2;
  const numSteps = Math.round(avgDuration / step) + 1;
  const result: [number, number][] = [];

  for (let s = 0; s < numSteps; s++) {
    const t = s * step;
    let depthSum = 0;
    for (const idx of indices) {
      const points = seriesData[idx];
      const dur = getDuration(points);
      const normalizedT = dur > 0 ? (t / avgDuration) * dur : 0;
      depthSum += interpolateAt(points, normalizedT + points[0][0]);
    }
    result.push([t, depthSum / indices.length]);
  }

  return result;
}

function coalesceLongest(
  seriesData: [number, number][][],
  indices: number[]
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
  return { pickedIndex: best, data: seriesData[best] };
}

function coalesceDeepest(
  seriesData: [number, number][][],
  indices: number[]
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
  return { pickedIndex: best, data: seriesData[best] };
}

// ── Main processing ──

export function processData(
  data: DiveData,
  config: GroupingConfig
): ProcessedData {
  if (config.groupMode === "none") {
    return {
      series: data.seriesNames.map((name, i) => ({
        label: name,
        data: data.seriesData[i],
      })),
    };
  }

  let groups: Group[];
  switch (config.groupMode) {
    case "dateInterval":
      groups = groupByDateInterval(data, config.dateIntervalUnit);
      break;
    case "n":
      groups = groupByN(data, config.nValue);
      break;
    case "percentile":
      groups = groupByPercentile(
        data,
        config.percentileCriterion,
        config.percentileValue
      );
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

    return { label, data: seriesPoints };
  });

  return { series };
}
