import { nextDiveNumberForDate } from "./manualDive";
import {
  normalizeProfilePoints,
  shiftProfileToZeroStart,
  type ProfilePoint,
} from "./parseData";
import type { DiveStore, StoredDive } from "./storage";

export interface DiveRegion {
  id: string;
  startIdx: number;
  endIdx: number;
  enabled: boolean;
}

export interface EditableProfileResult {
  profile: ProfilePoint[];
  leadingPadding: boolean;
  trailingPadding: boolean;
  leadingPaddingIndex: number;
  trailingPaddingIndex: number;
}

function isUnderwater(depth: number): boolean {
  return depth < 0;
}

function isSurface(depth: number): boolean {
  return depth === 0;
}

function copyPoint(point: ProfilePoint): ProfilePoint {
  return point[2] !== undefined
    ? [point[0], point[1], point[2]]
    : [point[0], point[1]];
}

function shiftPointTime(point: ProfilePoint, delta: number): ProfilePoint {
  return point[2] !== undefined
    ? [point[0] + delta, point[1], point[2]]
    : [point[0] + delta, point[1]];
}

function tempFromNeighbor(
  profile: ProfilePoint[],
  startIdx: number,
  direction: "forward" | "backward",
): number | undefined {
  if (direction === "forward") {
    for (let i = startIdx; i < profile.length; i++) {
      if (isUnderwater(profile[i][1]) && profile[i][2] !== undefined) {
        return profile[i][2];
      }
    }
  } else {
    for (let i = startIdx; i >= 0; i--) {
      if (isUnderwater(profile[i][1]) && profile[i][2] !== undefined) {
        return profile[i][2];
      }
    }
  }

  for (const point of profile) {
    if (point[2] !== undefined) return point[2];
  }
  return undefined;
}

export function hasUnderwaterPoints(profile: ProfilePoint[]): boolean {
  return profile.some((point) => isUnderwater(point[1]));
}

/** True when the profile can be trimmed or split (not already a normalized single dive). */
export function canTrimOrSplitProfile(profile: ProfilePoint[]): boolean {
  return getTrimSplitIssues(profile).length > 0;
}

export function getTrimSplitIssues(profile: ProfilePoint[]): string[] {
  if (profile.length === 0 || !hasUnderwaterPoints(profile)) {
    return [];
  }

  const issues: string[] = [];

  if (profile[0][1] !== 0) {
    issues.push("Profile does not start at the surface (depth 0)");
  }
  if (profile[profile.length - 1][1] !== 0) {
    issues.push("Profile does not end at the surface (depth 0)");
  }

  const regionCount = detectDiveRegions(profile).length;
  if (regionCount > 1) {
    issues.push(
      `${regionCount} separate underwater regions detected`
    );
  }

  return issues;
}

export interface SurfaceSection {
  startIdx: number;
  endIdx: number;
}

export function detectConsecutiveSurfaceSections(
  profile: ProfilePoint[],
): SurfaceSection[] {
  const sections: SurfaceSection[] = [];
  let index = 0;

  while (index < profile.length) {
    while (index < profile.length && profile[index][1] !== 0) {
      index++;
    }
    if (index >= profile.length) break;

    const startIdx = index;
    while (index < profile.length && profile[index][1] === 0) {
      index++;
    }
    sections.push({ startIdx, endIdx: index - 1 });
  }

  return sections;
}

export type EditDepthSegmentKind = "surface" | "enabled" | "disabled";

export type EditDepthLinePoint = [number, number] | null;

export interface EditDepthSeriesData {
  surface: EditDepthLinePoint[];
  enabled: EditDepthLinePoint[];
  disabled: EditDepthLinePoint[];
}

function classifyEditDepthPoint(
  index: number,
  profile: ProfilePoint[],
  regions: DiveRegion[],
): EditDepthSegmentKind {
  if (isSurface(profile[index][1])) {
    return "surface";
  }

  const region = regions.find(
    (candidate) =>
      index >= candidate.startIdx && index <= candidate.endIdx,
  );
  if (region && !region.enabled) {
    return "disabled";
  }
  return "enabled";
}

function startNewEditDepthSegment(target: EditDepthLinePoint[]): void {
  if (target.length > 0) {
    target.push(null);
  }
}

export function buildEditDepthSeriesData(
  profile: ProfilePoint[],
  regions: DiveRegion[],
): EditDepthSeriesData {
  const surface: EditDepthLinePoint[] = [];
  const enabled: EditDepthLinePoint[] = [];
  const disabled: EditDepthLinePoint[] = [];

  let index = 0;
  while (index < profile.length) {
    const kind = classifyEditDepthPoint(index, profile, regions);
    const startIdx = index;
    while (
      index < profile.length &&
      classifyEditDepthPoint(index, profile, regions) === kind
    ) {
      index++;
    }
    const endIdx = index - 1;
    const target =
      kind === "surface" ? surface : kind === "disabled" ? disabled : enabled;

    startNewEditDepthSegment(target);

    if (kind !== "surface") {
      const previousIndex = startIdx - 1;
      if (previousIndex >= 0 && isSurface(profile[previousIndex][1])) {
        target.push([
          profile[previousIndex][0],
          profile[previousIndex][1],
        ]);
      }
    }

    for (let pointIndex = startIdx; pointIndex <= endIdx; pointIndex++) {
      target.push([profile[pointIndex][0], profile[pointIndex][1]]);
    }

    if (kind !== "surface") {
      const nextIndex = endIdx + 1;
      if (nextIndex < profile.length && isSurface(profile[nextIndex][1])) {
        target.push([profile[nextIndex][0], profile[nextIndex][1]]);
      }
    }
  }

  return { surface, enabled, disabled };
}

export function detectDiveRegions(profile: ProfilePoint[]): DiveRegion[] {
  const regions: DiveRegion[] = [];
  let index = 0;

  while (index < profile.length) {
    while (index < profile.length && !isUnderwater(profile[index][1])) {
      index++;
    }
    if (index >= profile.length) break;

    const coreStart = index;
    while (index < profile.length && isUnderwater(profile[index][1])) {
      index++;
    }
    const coreEnd = index - 1;

    let startIdx = coreStart;
    for (let j = coreStart; j >= 0; j--) {
      if (isSurface(profile[j][1])) {
        startIdx = j;
        break;
      }
    }

    let endIdx = coreEnd;
    for (let j = coreEnd; j < profile.length; j++) {
      if (isSurface(profile[j][1])) {
        endIdx = j;
        break;
      }
    }

    regions.push({
      id: `region-${regions.length}`,
      startIdx,
      endIdx,
      enabled: true,
    });
  }

  for (let i = 0; i < regions.length - 1; i++) {
    if (regions[i].endIdx === regions[i + 1].startIdx) {
      let nextStart = regions[i].endIdx + 1;
      while (nextStart < profile.length && !isSurface(profile[nextStart][1])) {
        nextStart++;
      }
      if (nextStart < profile.length) {
        regions[i + 1].startIdx = nextStart;
      }
    }
  }

  return regions;
}

export function prepareEditableProfile(
  profile: ProfilePoint[],
): EditableProfileResult {
  let working = profile.map(copyPoint);
  let leadingPadding = false;
  let trailingPadding = false;
  let leadingPaddingIndex = 0;
  let trailingPaddingIndex = Math.max(working.length - 1, 0);

  if (working.length > 0 && !isSurface(working[0][1])) {
    const temp = tempFromNeighbor(working, 0, "forward");
    const paddingPoint: ProfilePoint =
      temp !== undefined ? [0, 0, temp] : [0, 0];
    working = [paddingPoint, ...working];
    leadingPadding = true;
    leadingPaddingIndex = 0;
    trailingPaddingIndex = working.length - 1;
  }

  if (working.length > 0 && !isSurface(working[working.length - 1][1])) {
    const lastTime = working[working.length - 1][0];
    const temp = tempFromNeighbor(working, working.length - 1, "backward");
    const paddingPoint: ProfilePoint =
      temp !== undefined ? [lastTime + 1, 0, temp] : [lastTime + 1, 0];
    working = [...working, paddingPoint];
    trailingPadding = true;
    trailingPaddingIndex = working.length - 1;
  }

  return {
    profile: working,
    leadingPadding,
    trailingPadding,
    leadingPaddingIndex,
    trailingPaddingIndex,
  };
}

export function bumpStartGap(
  profile: ProfilePoint[],
  delta: number,
  leadingPaddingIndex = 0,
): ProfilePoint[] {
  return profile.map((point, index) =>
    index === leadingPaddingIndex ? copyPoint(point) : shiftPointTime(point, delta),
  );
}

export function bumpEndGap(
  profile: ProfilePoint[],
  delta: number,
  trailingPaddingIndex: number,
): ProfilePoint[] {
  return profile.map((point, index) =>
    index === trailingPaddingIndex ? copyPoint(point) : shiftPointTime(point, delta),
  );
}

export function canBumpStartRight(
  profile: ProfilePoint[],
  leadingPaddingIndex = 0,
): boolean {
  const nextIndex = leadingPaddingIndex + 1;
  if (nextIndex >= profile.length) return false;
  return (
    profile[nextIndex][0] - profile[leadingPaddingIndex][0] > 1
  );
}

export function canBumpEndRight(
  profile: ProfilePoint[],
  trailingPaddingIndex: number,
): boolean {
  const previousIndex = trailingPaddingIndex - 1;
  if (previousIndex < 0) return false;
  return (
    profile[trailingPaddingIndex][0] - profile[previousIndex][0] > 1
  );
}

export function toggleRegionEnabled(
  regions: DiveRegion[],
  id: string,
): DiveRegion[] | null {
  const target = regions.find((region) => region.id === id);
  if (!target) return null;

  if (target.enabled && regions.filter((region) => region.enabled).length <= 1) {
    return null;
  }

  return regions.map((region) =>
    region.id === id ? { ...region, enabled: !region.enabled } : region,
  );
}

export function regionToggleControl(
  region: DiveRegion,
  regions: DiveRegion[],
): { label: "keep" | "discard"; clickable: boolean } {
  if (!region.enabled) {
    return { label: "keep", clickable: true };
  }

  const enabledCount = regions.filter((candidate) => candidate.enabled).length;
  if (enabledCount <= 1) {
    return { label: "keep", clickable: false };
  }

  return { label: "discard", clickable: true };
}

export function extractRegionProfiles(
  profile: ProfilePoint[],
  regions: DiveRegion[],
): ProfilePoint[][] {
  return regions
    .filter((region) => region.enabled)
    .map((region) =>
      profile
        .slice(region.startIdx, region.endIdx + 1)
        .map(copyPoint),
    );
}

export function datetimePlusSeconds(isoDatetime: string, seconds: number): string {
  const date = new Date(isoDatetime);
  date.setUTCSeconds(date.getUTCSeconds() + Math.round(seconds));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const secs = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${secs}Z`;
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

function resolveSplitDatetime(
  store: DiveStore,
  proposedDatetime: string,
  usedDatetimes: Set<string>,
): string {
  let datetime = proposedDatetime;
  const allDatetimes = new Set([
    ...store.dives.map((dive) => dive.datetime),
    ...usedDatetimes,
  ]);

  while (allDatetimes.has(datetime)) {
    datetime = addOneMinuteToIsoDatetime(datetime);
  }

  return datetime;
}

export function buildSplitDives(
  originalDive: StoredDive,
  regionProfiles: ProfilePoint[][],
  store: DiveStore,
): StoredDive[] {
  const storeWithoutOriginal: DiveStore = {
    ...store,
    dives: store.dives.filter((dive) => dive.datetime !== originalDive.datetime),
  };
  const usedDatetimes = new Set<string>();
  const result: StoredDive[] = [];

  for (const regionProfile of regionProfiles) {
    const offsetSeconds = regionProfile[0][0];
    const proposedDatetime = datetimePlusSeconds(
      originalDive.datetime,
      offsetSeconds,
    );
    const datetime = resolveSplitDatetime(
      storeWithoutOriginal,
      proposedDatetime,
      usedDatetimes,
    );
    usedDatetimes.add(datetime);

    const date = datetime.slice(0, 10);
    const diveNumber = nextDiveNumberForDate(
      { ...storeWithoutOriginal, dives: [...storeWithoutOriginal.dives, ...result] },
      date,
    );

    const dive: StoredDive = {
      datetime,
      diveNumber,
      profile: normalizeProfilePoints(shiftProfileToZeroStart(regionProfile)),
    };

    if (originalDive.discipline) dive.discipline = originalDive.discipline;
    if (originalDive.weightKg !== undefined) dive.weightKg = originalDive.weightKg;
    if (originalDive.exposureSuit) dive.exposureSuit = originalDive.exposureSuit;
    if (originalDive.archived) dive.archived = originalDive.archived;

    result.push(dive);
  }

  return result.sort((a, b) => a.datetime.localeCompare(b.datetime));
}
