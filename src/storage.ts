import { SAFETY_DYNB_DISCIPLINE } from "./disciplines";
import type { DiveData, ExposureSuit } from "./parseData";
import { extractDateKey, parseCsvString } from "./parseData";
import type { Tag } from "./grouping";

export interface StoredDive {
  date: string;
  label: string;
  profile: [number, number][];
  discipline?: string;
  weightKg?: number;
  exposureSuit?: ExposureSuit;
}

export interface StoredTag {
  name: string;
  diveDates: string[];
}

export interface DiveStore {
  dives: StoredDive[];
  tags: StoredTag[];
}

const API_URL = "/api/dives";
const LOCAL_STORAGE_KEY = "freediving-dives-store";

export function emptyStore(): DiveStore {
  return { dives: [], tags: [] };
}

function migrateLegacyTags(store: DiveStore): DiveStore {
  const legacyPrefixes = [
    "Discipline:",
    "Weight:",
    "Safety:",
    "Exposure Suit:",
  ];
  const legacyTags = store.tags.filter((t) =>
    legacyPrefixes.some((p) => t.name.startsWith(p)),
  );
  if (legacyTags.length === 0) return store;

  const dives = store.dives.map((d) => ({ ...d }));
  const dateToIndex = new Map(dives.map((d, i) => [d.date, i]));

  for (const tag of legacyTags) {
    for (const date of tag.diveDates) {
      const idx = dateToIndex.get(date);
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
    tags: store.tags.filter(
      (t) => !legacyPrefixes.some((p) => t.name.startsWith(p)),
    ),
  };
}

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

export function diveDataFromStore(store: DiveStore): DiveData {
  const sorted = [...store.dives].sort((a, b) => a.date.localeCompare(b.date));
  return {
    seriesNames: sorted.map((d) => d.label),
    seriesData: sorted.map((d) => d.profile),
    disciplines: sorted.map((d) => d.discipline),
    weights: sorted.map((d) => d.weightKg),
    exposureSuits: sorted.map((d) => d.exposureSuit),
  };
}

export function storeFromDiveData(data: DiveData, tags: Tag[] = []): DiveStore {
  const dives: StoredDive[] = data.seriesNames.map((label, i) => ({
    date: extractDateKey(label) ?? label,
    label,
    profile: data.seriesData[i],
  }));
  dives.sort((a, b) => a.date.localeCompare(b.date));
  return {
    dives,
    tags: tagsToStored(tags, dives),
  };
}

export function tagsFromStored(
  stored: StoredTag[],
  dives: StoredDive[],
): Tag[] {
  const dateToIndex = new Map(dives.map((d, i) => [d.date, i]));
  return stored.map((t) => ({
    name: t.name,
    diveIndices: new Set(
      t.diveDates
        .map((date) => dateToIndex.get(date))
        .filter((i): i is number => i !== undefined),
    ),
  }));
}

export function tagsToStored(tags: Tag[], dives: StoredDive[]): StoredTag[] {
  const indexToDate = dives.map((d) => d.date);
  return tags.map((t) => ({
    name: t.name,
    diveDates: [...t.diveIndices]
      .map((i) => indexToDate[i])
      .filter((d): d is string => d !== undefined)
      .sort(),
  }));
}

export function mergeCsvIntoStore(
  store: DiveStore,
  csv: string,
): { store: DiveStore; added: number } {
  const imported = parseCsvString(csv);
  const existingDates = new Set(store.dives.map((d) => d.date));
  const newDives: StoredDive[] = [];

  for (let i = 0; i < imported.seriesNames.length; i++) {
    const label = imported.seriesNames[i];
    const date = extractDateKey(label);
    if (!date || existingDates.has(date)) continue;
    existingDates.add(date);
    newDives.push({
      date,
      label,
      profile: imported.seriesData[i],
    });
  }

  const dives = [...store.dives, ...newDives].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return {
    store: { dives, tags: store.tags },
    added: newDives.length,
  };
}

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
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store, null, 2));
}

export async function loadStore(): Promise<DiveStore> {
  let store: DiveStore | null = null;

  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      store = (await res.json()) as DiveStore;
    }
  } catch {
    // API unavailable (e.g. static hosting) — fall back to localStorage
  }

  if (!store) {
    store = readFromLocalStorage() ?? emptyStore();
  }

  const hadLegacyTags = store.tags.some((t) =>
    ["Discipline:", "Weight:", "Safety:", "Exposure Suit:"].some((p) =>
      t.name.startsWith(p),
    ),
  );
  const migrated = migrateSafetyProperty(migrateLegacyTags(store));
  writeToLocalStorage(migrated);

  if (hadLegacyTags) {
    try {
      await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(migrated, null, 2),
      });
    } catch {
      // localStorage only
    }
  }

  return migrated;
}

function datesFromIndices(
  store: DiveStore,
  diveIndices: number[],
): Set<string> {
  const data = diveDataFromStore(store);
  return new Set(
    diveIndices
      .map((i) => extractDateKey(data.seriesNames[i]))
      .filter((d): d is string => d !== null),
  );
}

export function setDiveDisciplines(
  store: DiveStore,
  diveIndices: number[],
  discipline: string,
): DiveStore {
  const datesToUpdate = datesFromIndices(store, diveIndices);
  if (datesToUpdate.size === 0) return store;

  return {
    ...store,
    dives: store.dives.map((d) =>
      datesToUpdate.has(d.date) ? { ...d, discipline } : d,
    ),
  };
}

export function setDiveWeights(
  store: DiveStore,
  diveIndices: number[],
  weightKg: number,
): DiveStore {
  const datesToUpdate = datesFromIndices(store, diveIndices);
  if (datesToUpdate.size === 0) return store;

  return {
    ...store,
    dives: store.dives.map((d) =>
      datesToUpdate.has(d.date) ? { ...d, weightKg } : d,
    ),
  };
}

export function setDiveExposureSuits(
  store: DiveStore,
  diveIndices: number[],
  exposureSuit: ExposureSuit,
): DiveStore {
  const datesToUpdate = datesFromIndices(store, diveIndices);
  if (datesToUpdate.size === 0) return store;

  return {
    ...store,
    dives: store.dives.map((d) =>
      datesToUpdate.has(d.date) ? { ...d, exposureSuit } : d,
    ),
  };
}

export async function saveStore(store: DiveStore): Promise<void> {
  writeToLocalStorage(store);

  try {
    await fetch(API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store, null, 2),
    });
  } catch {
    // Persisted to localStorage only
  }
}
