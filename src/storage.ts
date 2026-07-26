import { SAFETY_DYNB_DISCIPLINE } from "./disciplines";
import type { DiveData, ExposureSuit, ProfilePoint } from "./parseData";
import {
  parseUddfString,
  seriesNameFromDive,
  normalizeProfilePoints,
} from "./parseData";
import { parseFitArrayBuffer } from "./parseFit";
import type { Tag } from "./grouping";

export interface StoredDive {
  datetime: string;
  diveNumber: number;
  profile: ProfilePoint[];
  discipline?: string;
  weightKg?: number;
  exposureSuit?: ExposureSuit;
  tags?: string[];
  archived?: boolean;
}

export interface StoredTag {
  name: string;
  diveDatetimes: string[];
}

export interface DiveStore {
  dives: StoredDive[];
  tags?: StoredTag[];
}

const LOCAL_STORAGE_KEY = "freediving-dives-store";

export function emptyStore(): DiveStore {
  return { dives: [] };
}

// ── Migrations ──

/**
 * Converts legacy dive format (date/label → datetime/diveNumber)
 * and legacy tag format (diveDates → diveDatetimes).
 */
function migrateToNewDiveFormat(store: DiveStore): DiveStore {
  type LegacyDive = StoredDive & { date?: string; label?: string };
  type LegacyTag = StoredTag & { diveDates?: string[] };

  let diveChanged = false;
  const dives = (store.dives as LegacyDive[]).map((d): StoredDive => {
    if (!d.datetime && d.date) {
      diveChanged = true;
      const { date: _date, label: _label, ...rest } = d;
      return { ...rest, datetime: d.date + "T00:00:00Z", diveNumber: 0 };
    }
    return d as StoredDive;
  });

  let tagChanged = false;
  const tags = (store.tags ?? []).map((t): StoredTag => {
    const legacy = t as LegacyTag;
    if (legacy.diveDates && !legacy.diveDatetimes) {
      tagChanged = true;
      return {
        name: legacy.name,
        diveDatetimes: legacy.diveDates.map((d) => d + "T00:00:00Z"),
      };
    }
    return t as StoredTag;
  });

  if (!diveChanged && !tagChanged) return store;
  return { dives, tags };
}

/**
 * Converts legacy "Discipline:", "Weight:", "Safety:", "Exposure Suit:" tags
 * into properties on the StoredDive. Expects dives in the new format (datetime).
 */
function migrateLegacyTags(store: DiveStore): DiveStore {
  const legacyPrefixes = [
    "Discipline:",
    "Weight:",
    "Safety:",
    "Exposure Suit:",
  ];
  const legacyTags = store.tags?.filter((t) =>
    legacyPrefixes.some((p) => t.name.startsWith(p)),
  );
  if (legacyTags == null || legacyTags.length === 0) return store;

  const dives = store.dives.map((d) => ({ ...d }));
  const datetimeToIndex = new Map(dives.map((d, i) => [d.datetime, i]));

  for (const tag of legacyTags) {
    for (const datetime of tag.diveDatetimes) {
      const idx = datetimeToIndex.get(datetime);
      if (idx === undefined) continue;
      const dive = dives[idx];

      if (tag.name.startsWith("Discipline:") && !dive.discipline) {
        dives[idx] = {
          ...dive,
          discipline: tag.name.replace(/^Discipline:\s*/, ""),
        };
      } else if (
        tag.name.startsWith("Weight:") &&
        dive.weightKg === undefined
      ) {
        const match = tag.name.match(/^Weight:\s*([\d.]+)kg$/);
        if (match) {
          dives[idx] = { ...dive, weightKg: parseFloat(match[1]) };
        }
      } else if (tag.name.startsWith("Safety:") && !dive.discipline) {
        const value = tag.name.replace(/^Safety:\s*/, "");
        if (value === "Yes") {
          dives[idx] = { ...dive, discipline: SAFETY_DYNB_DISCIPLINE };
        }
      } else if (
        tag.name.startsWith("Exposure Suit:") &&
        dive.exposureSuit === undefined
      ) {
        const match = tag.name.match(
          /^Exposure Suit:\s*(Open Cell|Closed Cell),\s*([\d.]+)mm$/,
        );
        if (match) {
          dives[idx] = {
            ...dive,
            exposureSuit: {
              openCell: match[1] === "Open Cell",
              thicknessMm: parseFloat(match[2]),
            },
          };
        }
      }
    }
  }

  return {
    dives,
    tags: store.tags?.filter(
      (t) => !legacyPrefixes.some((p) => t.name.startsWith(p)),
    ),
  };
}

/**
 * Moves top-level store tags onto each dive's `tags` array and drops `store.tags`.
 */
function migrateTopLevelTagsToDives(store: DiveStore): DiveStore {
  const storedTags = store.tags;
  if (storedTags == null || storedTags.length === 0) return store;

  const datetimeToIndex = new Map(
    store.dives.map((d, i) => [d.datetime, i]),
  );
  const diveTags = store.dives.map((d) => [...(d.tags ?? [])]);

  for (const tag of storedTags) {
    for (const datetime of tag.diveDatetimes) {
      const idx = datetimeToIndex.get(datetime);
      if (idx === undefined) continue;
      const names = diveTags[idx];
      if (!names.includes(tag.name)) {
        names.push(tag.name);
      }
    }
  }

  const dives = store.dives.map((d, i) => ({
    ...d,
    tags: diveTags[i].sort(),
  }));

  const { tags: _removed, ...rest } = store;
  return { ...rest, dives };
}

function profilePointsEqual(
  a: ProfilePoint[],
  b: ProfilePoint[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (p, i) =>
      p[0] === b[i][0] &&
      p[1] === b[i][1] &&
      (p[2] ?? undefined) === (b[i][2] ?? undefined),
  );
}

function normalizeDiveProfiles(store: DiveStore): {
  store: DiveStore;
  changed: boolean;
} {
  let changed = false;
  const dives = store.dives.map((d) => {
    const normalized = normalizeProfilePoints(d.profile);
    if (profilePointsEqual(d.profile, normalized)) return d;
    changed = true;
    return { ...d, profile: normalized };
  });
  return {
    store: changed ? { ...store, dives } : store,
    changed,
  };
}

/** Migrates the old `safety: boolean` field to discipline "Safety (DYNB)". */
function migrateSafetyProperty(store: DiveStore): DiveStore {
  let changed = false;
  const dives = store.dives.map((d) => {
    const safety = (d as StoredDive & { safety?: boolean }).safety;
    if (safety === undefined) return d;
    changed = true;
    const { safety: _removed, ...rest } = d as StoredDive & {
      safety?: boolean;
    };
    if (safety) {
      return { ...rest, discipline: SAFETY_DYNB_DISCIPLINE };
    }
    return rest;
  });
  return changed ? { ...store, dives } : store;
}

// ── Core store ↔ DiveData conversion ──

export function activeDives(store: DiveStore): StoredDive[] {
  return sortedDives(store, false);
}

function sortedDives(
  store: DiveStore,
  includeArchived: boolean,
): StoredDive[] {
  return [...store.dives]
    .filter((d) => includeArchived || !d.archived)
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

export function diveDataFromStore(
  store: DiveStore,
  options: { includeArchived?: boolean } = {},
): DiveData {
  const sorted = sortedDives(store, options.includeArchived ?? false);
  return {
    seriesNames: sorted.map((d) =>
      seriesNameFromDive(d.datetime, d.diveNumber),
    ),
    datetimes: sorted.map((d) => d.datetime),
    diveNumbers: sorted.map((d) => d.diveNumber),
    seriesData: sorted.map((d) => d.profile),
    disciplines: sorted.map((d) => d.discipline),
    weights: sorted.map((d) => d.weightKg),
    exposureSuits: sorted.map((d) => d.exposureSuit),
    tags: sorted.map((d) => d.tags ?? []),
    archived: sorted.map((d) => d.archived === true),
  };
}

// ── Tags ──

export function tagsFromStore(
  store: DiveStore,
  options: { includeArchived?: boolean } = {},
): Tag[] {
  const dives = sortedDives(store, options.includeArchived ?? false);
  const byName = new Map<string, Set<number>>();
  dives.forEach((d, i) => {
    for (const name of d.tags ?? []) {
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name)!.add(i);
    }
  });
  return [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, diveIndices]) => ({ name, diveIndices }));
}

export function applyTagsToStore(
  store: DiveStore,
  tags: Tag[],
  options: { includeArchived?: boolean } = {},
): DiveStore {
  const dives = sortedDives(store, options.includeArchived ?? false);
  const datetimeToTags = new Map<string, string[]>(
    dives.map((d) => [d.datetime, [] as string[]]),
  );
  for (const t of tags) {
    for (const i of t.diveIndices) {
      const datetime = dives[i]?.datetime;
      if (!datetime) continue;
      datetimeToTags.get(datetime)!.push(t.name);
    }
  }
  for (const [datetime, names] of datetimeToTags) {
    datetimeToTags.set(datetime, [...new Set(names)].sort());
  }
  return {
    ...store,
    dives: store.dives.map((d) => {
      const names = datetimeToTags.get(d.datetime);
      if (names === undefined) return d;
      return { ...d, tags: names };
    }),
  };
}

// ── Updaters ──

function datetimesFromIndices(
  store: DiveStore,
  diveIndices: number[],
): Set<string> {
  const data = diveDataFromStore(store);
  return new Set(
    diveIndices
      .map((i) => data.datetimes[i])
      .filter((dt): dt is string => dt !== undefined),
  );
}

export function setDiveDisciplines(
  store: DiveStore,
  diveIndices: number[],
  discipline: string,
): DiveStore {
  const datetimesToUpdate = datetimesFromIndices(store, diveIndices);
  if (datetimesToUpdate.size === 0) return store;
  return {
    ...store,
    dives: store.dives.map((d) =>
      datetimesToUpdate.has(d.datetime) ? { ...d, discipline } : d,
    ),
  };
}

export function setDiveWeights(
  store: DiveStore,
  diveIndices: number[],
  weightKg: number,
): DiveStore {
  const datetimesToUpdate = datetimesFromIndices(store, diveIndices);
  if (datetimesToUpdate.size === 0) return store;
  return {
    ...store,
    dives: store.dives.map((d) =>
      datetimesToUpdate.has(d.datetime) ? { ...d, weightKg } : d,
    ),
  };
}

export function setDiveExposureSuits(
  store: DiveStore,
  diveIndices: number[],
  exposureSuit: ExposureSuit,
): DiveStore {
  const datetimesToUpdate = datetimesFromIndices(store, diveIndices);
  if (datetimesToUpdate.size === 0) return store;
  return {
    ...store,
    dives: store.dives.map((d) =>
      datetimesToUpdate.has(d.datetime) ? { ...d, exposureSuit } : d,
    ),
  };
}

export function archiveDives(
  store: DiveStore,
  diveIndices: number[],
): DiveStore {
  return archiveDivesByDatetime(store, datetimesFromIndices(store, diveIndices));
}

export function archiveDivesByDatetime(
  store: DiveStore,
  datetimes: Iterable<string>,
): DiveStore {
  const datetimesToUpdate = new Set(datetimes);
  if (datetimesToUpdate.size === 0) return store;
  return {
    ...store,
    dives: store.dives.map((d) =>
      datetimesToUpdate.has(d.datetime) ? { ...d, archived: true } : d,
    ),
  };
}

export function restoreDivesByDatetime(
  store: DiveStore,
  datetimes: Iterable<string>,
): DiveStore {
  const datetimesToUpdate = new Set(datetimes);
  if (datetimesToUpdate.size === 0) return store;
  return {
    ...store,
    dives: store.dives.map((d) =>
      datetimesToUpdate.has(d.datetime) ? { ...d, archived: false } : d,
    ),
  };
}

// ── Import ──

function mergeParsedDivesIntoStore(
  store: DiveStore,
  parsedDives: { datetime: string; diveNumber: number; profile: ProfilePoint[] }[],
): { store: DiveStore; added: number } {
  if (parsedDives.length === 0) return { store, added: 0 };

  const existingDatetimes = new Set(store.dives.map((d) => d.datetime));
  const newDives: StoredDive[] = [];

  for (const parsed of parsedDives) {
    if (existingDatetimes.has(parsed.datetime)) continue;
    existingDatetimes.add(parsed.datetime);
    newDives.push({
      datetime: parsed.datetime,
      diveNumber: parsed.diveNumber,
      profile: parsed.profile,
    });
  }

  if (newDives.length === 0) return { store, added: 0 };

  const dives = [...store.dives, ...newDives].sort((a, b) =>
    a.datetime.localeCompare(b.datetime),
  );

  return {
    store: { dives },
    added: newDives.length,
  };
}

export function mergeUddfIntoStore(
  store: DiveStore,
  xml: string,
): { store: DiveStore; added: number } {
  const parsed = parseUddfString(xml);
  if (!parsed) return { store, added: 0 };
  return mergeParsedDivesIntoStore(store, [parsed]);
}

export async function mergeFitIntoStore(
  store: DiveStore,
  buffer: ArrayBuffer,
): Promise<{ store: DiveStore; added: number }> {
  const parsedDives = await parseFitArrayBuffer(buffer);
  return mergeParsedDivesIntoStore(store, parsedDives);
}

export function replaceDiveWithSplits(
  store: DiveStore,
  originalDatetime: string,
  newDives: StoredDive[],
): { store: DiveStore; newDatetimes: string[] } {
  const dives = store.dives.filter((dive) => dive.datetime !== originalDatetime);
  const newDatetimes = newDives.map((dive) => dive.datetime).sort();

  const original = store.dives.find((d) => d.datetime === originalDatetime);
  const inheritedTags = original?.tags ?? [];
  const splitDives = newDives.map((d) => ({
    ...d,
    tags: [...inheritedTags],
  }));

  const merged = [...dives, ...splitDives].sort((a, b) =>
    a.datetime.localeCompare(b.datetime),
  );

  return {
    store: { dives: merged },
    newDatetimes,
  };
}

export function addManualDiveToStore(
  store: DiveStore,
  dive: StoredDive,
): { store: DiveStore; added: number } {
  if (store.dives.some((d) => d.datetime === dive.datetime)) {
    return { store, added: 0 };
  }

  const dives = [...store.dives, dive].sort((a, b) =>
    a.datetime.localeCompare(b.datetime),
  );

  return {
    store: { dives },
    added: 1,
  };
}

// ── Import data.json ──

function isValidDiveEntry(d: unknown): boolean {
  if (!d || typeof d !== "object") return false;
  const dive = d as Record<string, unknown>;
  if (!Array.isArray(dive.profile)) return false;
  if (dive.tags !== undefined) {
    if (
      !Array.isArray(dive.tags) ||
      !dive.tags.every((t) => typeof t === "string")
    ) {
      return false;
    }
  }
  if (
    typeof dive.datetime === "string" &&
    typeof dive.diveNumber === "number"
  ) {
    return true;
  }
  return typeof dive.date === "string";
}

function isValidTagEntry(t: unknown): boolean {
  if (!t || typeof t !== "object") return false;
  return typeof (t as Record<string, unknown>).name === "string";
}

function isDiveStore(value: unknown): value is DiveStore {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.dives)) return false;
  if (v.tags !== undefined) {
    if (!Array.isArray(v.tags) || !v.tags.every(isValidTagEntry)) return false;
  }
  return v.dives.every(isValidDiveEntry);
}

/** Runs migrations and profile normalization on a store. */
export function prepareStore(store: DiveStore): {
  store: DiveStore;
  profilesTrimmed: boolean;
} {
  const { store: trimmed, changed: profilesTrimmed } = normalizeDiveProfiles(
    migrateTopLevelTagsToDives(
      migrateSafetyProperty(migrateLegacyTags(migrateToNewDiveFormat(store))),
    ),
  );
  return { store: trimmed, profilesTrimmed };
}

export function parseStoreFromJson(json: string): DiveStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!isDiveStore(parsed)) {
    throw new Error("Invalid data.json format");
  }
  return prepareStore(parsed).store;
}

// ── Persistence ──

function readFromLocalStorage(): DiveStore | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiveStore;
  } catch {
    return null;
  }
}

function writeToLocalStorage(store: DiveStore): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
}

export async function loadStore(): Promise<DiveStore> {
  const store = readFromLocalStorage() ?? emptyStore();
  const { store: migrated } = prepareStore(store);
  writeToLocalStorage(migrated);
  return migrated;
}

export async function saveStore(store: DiveStore): Promise<void> {
  writeToLocalStorage(store);
}

export function deleteStoredData(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function downloadStoreAsJson(
  store: DiveStore,
  filename = "data.json",
): void {
  const blob = new Blob([JSON.stringify(store, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
