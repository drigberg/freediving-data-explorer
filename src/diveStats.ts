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
