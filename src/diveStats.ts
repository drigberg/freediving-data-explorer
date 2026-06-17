import type { ProfilePoint } from "./parseData";

export interface DiveStats {
  maxDepth: number;
  duration: number;
  maxTemp?: number;
  minTemp?: number;
}

export function getDiveStats(points: ProfilePoint[]): DiveStats {
  const maxDepth =
    points.length > 0 ? Math.min(...points.map(([, d]) => d)) : 0;
  const duration =
    points.length > 0 ? points[points.length - 1][0] - points[0][0] : 0;
  const temps = points
    .map(([, , t]) => t)
    .filter((t): t is number => t !== undefined);

  return {
    maxDepth,
    duration,
    maxTemp: temps.length > 0 ? Math.max(...temps) : undefined,
    minTemp: temps.length > 0 ? Math.min(...temps) : undefined,
  };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m${String(s).padStart(2, "0")}s`;
}

/** Vertical velocity in m/s; positive = ascending, negative = descending. */
export function computeVelocitySeries(
  points: ProfilePoint[],
): [number, number][] {
  if (points.length < 2) return [];

  const result: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    const [t0, d0] = points[i - 1];
    const [t1, d1] = points[i];
    const dt = t1 - t0;
    if (dt <= 0) continue;
    result.push([t1, (d1 - d0) / dt]);
  }

  return result;
}
