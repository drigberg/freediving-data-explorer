import { describe, expect, it } from "vitest";
import type { DiveData, ExposureSuit, ProfilePoint } from "../parseData";
import {
  defaultDiveFilters,
  diveFiltersEqual,
  divePassesFilters,
  filterOptionsFromData,
  filtersForPreset,
  hasActiveFilters,
  sliceDiveData,
  visibleDiveIndices,
  type DiveFilterConfig,
} from "../filters";

// ── Helpers ──

function vProfile(depth: number, duration: number, temp?: number): ProfilePoint[] {
  const half = duration / 2;
  const pts: ProfilePoint[] = [
    temp !== undefined ? [0, 0, temp] : [0, 0],
    temp !== undefined ? [half, -depth, temp] : [half, -depth],
    temp !== undefined ? [duration, 0, temp] : [duration, 0],
  ];
  return pts;
}

const suitA: ExposureSuit = { openCell: true, thicknessMm: 3 };
const suitB: ExposureSuit = { openCell: false, thicknessMm: 5 };

function makeDiveData(
  dives: {
    date: string;
    num: number;
    depth: number;
    duration: number;
    discipline?: string;
    weight?: number;
    exposureSuit?: ExposureSuit;
    temp?: number;
    tags?: string[];
  }[],
): DiveData {
  return {
    seriesNames: dives.map((d) => `${d.date} #${d.num}`),
    datetimes: dives.map((d) => `${d.date}T10:00:00Z`),
    diveNumbers: dives.map((d) => d.num),
    seriesData: dives.map((d) => vProfile(d.depth, d.duration, d.temp)),
    disciplines: dives.map((d) => d.discipline),
    weights: dives.map((d) => d.weight),
    exposureSuits: dives.map((d) => d.exposureSuit),
    tags: dives.map((d) => d.tags ?? []),
  };
}

const testData = makeDiveData([
  { date: "2026-01-10", num: 1, depth: 20, duration: 60, discipline: "CWT", weight: 2, exposureSuit: suitA, tags: ["Pool session"] },
  { date: "2026-01-10", num: 2, depth: 30, duration: 120, discipline: "CWT", weight: 2, exposureSuit: suitA, tags: ["Pool session", "Deep"] },
  { date: "2026-01-15", num: 3, depth: 15, duration: 40, discipline: "FIM", weight: 3, exposureSuit: suitB },
  { date: "2026-02-20", num: 4, depth: 40, duration: 90, discipline: "FIM", weight: 3, exposureSuit: suitB, tags: ["Deep"] },
  { date: "2026-03-05", num: 5, depth: 10, duration: 30 },
]);

// ── Tests ──

describe("defaultDiveFilters", () => {
  it("has no active filters by default", () => {
    const f = defaultDiveFilters();
    expect(hasActiveFilters(f)).toBe(false);
  });
});

describe("filtersForPreset", () => {
  it("merges partial into defaults", () => {
    const f = filtersForPreset({ disciplines: ["CWT"] });
    expect(f.disciplines).toEqual(["CWT"]);
    expect(f.weights).toEqual([]);
    expect(f.dateFrom).toBeNull();
  });

  it("returns defaults when no partial given", () => {
    expect(filtersForPreset()).toEqual(defaultDiveFilters());
  });
});

describe("diveFiltersEqual", () => {
  it("returns true for identical default filters", () => {
    expect(diveFiltersEqual(defaultDiveFilters(), defaultDiveFilters())).toBe(true);
  });

  it("returns false when disciplines differ", () => {
    const a = defaultDiveFilters();
    const b = { ...defaultDiveFilters(), disciplines: ["CWT"] };
    expect(diveFiltersEqual(a, b)).toBe(false);
  });

  it("is order-independent for array fields", () => {
    const a = { ...defaultDiveFilters(), disciplines: ["CWT", "FIM"] };
    const b = { ...defaultDiveFilters(), disciplines: ["FIM", "CWT"] };
    expect(diveFiltersEqual(a, b)).toBe(true);
  });
});

describe("hasActiveFilters", () => {
  it("returns true for discipline filter", () => {
    expect(hasActiveFilters({ ...defaultDiveFilters(), disciplines: ["CWT"] })).toBe(true);
  });

  it("returns true for date filter", () => {
    expect(hasActiveFilters({ ...defaultDiveFilters(), dateFrom: "2026-01-01" })).toBe(true);
  });

  it("returns true for depth range", () => {
    expect(
      hasActiveFilters({ ...defaultDiveFilters(), maxDepth: { min: 10, max: null } }),
    ).toBe(true);
  });

  it("returns true for duration range", () => {
    expect(
      hasActiveFilters({ ...defaultDiveFilters(), duration: { min: null, max: 120 } }),
    ).toBe(true);
  });
});

describe("divePassesFilters", () => {
  it("passes all dives with default filters", () => {
    const filters = defaultDiveFilters();
    for (let i = 0; i < testData.seriesNames.length; i++) {
      expect(divePassesFilters(testData, i, filters)).toBe(true);
    }
  });

  it("filters by discipline", () => {
    const filters: DiveFilterConfig = { ...defaultDiveFilters(), disciplines: ["CWT"] };
    expect(divePassesFilters(testData, 0, filters)).toBe(true); // CWT
    expect(divePassesFilters(testData, 1, filters)).toBe(true); // CWT
    expect(divePassesFilters(testData, 2, filters)).toBe(false); // FIM
    expect(divePassesFilters(testData, 4, filters)).toBe(false); // undefined
  });

  it("filters by weight", () => {
    const filters: DiveFilterConfig = { ...defaultDiveFilters(), weights: [3] };
    expect(divePassesFilters(testData, 0, filters)).toBe(false); // 2kg
    expect(divePassesFilters(testData, 2, filters)).toBe(true); // 3kg
    expect(divePassesFilters(testData, 4, filters)).toBe(false); // undefined
  });

  it("filters by exposure suit", () => {
    const filters: DiveFilterConfig = {
      ...defaultDiveFilters(),
      exposureSuits: ["Open Cell, 3mm"],
    };
    expect(divePassesFilters(testData, 0, filters)).toBe(true); // suitA
    expect(divePassesFilters(testData, 2, filters)).toBe(false); // suitB
    expect(divePassesFilters(testData, 4, filters)).toBe(false); // undefined
  });

  it("filters by tags", () => {
    const filters: DiveFilterConfig = { ...defaultDiveFilters(), tags: ["Deep"] };
    expect(divePassesFilters(testData, 0, filters)).toBe(false);
    expect(divePassesFilters(testData, 1, filters)).toBe(true); // has "Deep"
    expect(divePassesFilters(testData, 3, filters)).toBe(true); // has "Deep"
    expect(divePassesFilters(testData, 4, filters)).toBe(false);
  });

  it("filters by date range", () => {
    const filters: DiveFilterConfig = {
      ...defaultDiveFilters(),
      dateFrom: "2026-01-15",
      dateTo: "2026-02-28",
    };
    expect(divePassesFilters(testData, 0, filters)).toBe(false); // Jan 10
    expect(divePassesFilters(testData, 2, filters)).toBe(true); // Jan 15
    expect(divePassesFilters(testData, 3, filters)).toBe(true); // Feb 20
    expect(divePassesFilters(testData, 4, filters)).toBe(false); // Mar 5
  });

  it("filters by max depth range", () => {
    const filters: DiveFilterConfig = {
      ...defaultDiveFilters(),
      maxDepth: { min: 20, max: 35 },
    };
    expect(divePassesFilters(testData, 0, filters)).toBe(true); // 20m
    expect(divePassesFilters(testData, 1, filters)).toBe(true); // 30m
    expect(divePassesFilters(testData, 2, filters)).toBe(false); // 15m
    expect(divePassesFilters(testData, 3, filters)).toBe(false); // 40m
  });

  it("filters by duration range", () => {
    const filters: DiveFilterConfig = {
      ...defaultDiveFilters(),
      duration: { min: 50, max: 100 },
    };
    expect(divePassesFilters(testData, 0, filters)).toBe(true); // 60s
    expect(divePassesFilters(testData, 1, filters)).toBe(false); // 120s
    expect(divePassesFilters(testData, 2, filters)).toBe(false); // 40s
    expect(divePassesFilters(testData, 3, filters)).toBe(true); // 90s
  });

  it("combines multiple filters", () => {
    const filters: DiveFilterConfig = {
      ...defaultDiveFilters(),
      disciplines: ["CWT"],
      maxDepth: { min: 25, max: null },
    };
    expect(divePassesFilters(testData, 0, filters)).toBe(false); // CWT but 20m
    expect(divePassesFilters(testData, 1, filters)).toBe(true); // CWT and 30m
    expect(divePassesFilters(testData, 2, filters)).toBe(false); // FIM
  });
});

describe("filterOptionsFromData", () => {
  it("extracts all unique disciplines", () => {
    const opts = filterOptionsFromData(testData);
    expect(opts.disciplines).toContain("CWT");
    expect(opts.disciplines).toContain("FIM");
  });

  it("extracts weight values sorted", () => {
    const opts = filterOptionsFromData(testData);
    expect(opts.weights).toEqual([2, 3]);
  });

  it("extracts formatted exposure suits", () => {
    const opts = filterOptionsFromData(testData);
    expect(opts.exposureSuits).toContain("Open Cell, 3mm");
    expect(opts.exposureSuits).toContain("Closed Cell, 5mm");
  });

  it("extracts date range", () => {
    const opts = filterOptionsFromData(testData);
    expect(opts.dateMin).toBe("2026-01-10");
    expect(opts.dateMax).toBe("2026-03-05");
  });

  it("extracts depth and duration ranges", () => {
    const opts = filterOptionsFromData(testData);
    expect(opts.maxDepthMin).toBeLessThanOrEqual(10);
    expect(opts.maxDepthMax).toBeGreaterThanOrEqual(40);
    expect(opts.durationMin).toBeLessThanOrEqual(30);
    expect(opts.durationMax).toBeGreaterThanOrEqual(120);
  });
});

describe("sliceDiveData", () => {
  it("extracts a subset of dives by index", () => {
    const sliced = sliceDiveData(testData, [1, 3]);
    expect(sliced.seriesNames).toHaveLength(2);
    expect(sliced.seriesNames[0]).toBe("2026-01-10 #2");
    expect(sliced.seriesNames[1]).toBe("2026-02-20 #4");
    expect(sliced.disciplines).toEqual(["CWT", "FIM"]);
    expect(sliced.weights).toEqual([2, 3]);
    expect(sliced.tags![0]).toEqual(["Pool session", "Deep"]);
    expect(sliced.tags![1]).toEqual(["Deep"]);
  });

  it("returns empty data for empty indices", () => {
    const sliced = sliceDiveData(testData, []);
    expect(sliced.seriesNames).toHaveLength(0);
  });
});

describe("visibleDiveIndices", () => {
  it("returns all indices with no hidden and no filters", () => {
    const indices = visibleDiveIndices(testData, new Set(), defaultDiveFilters());
    expect(indices).toEqual([0, 1, 2, 3, 4]);
  });

  it("excludes hidden dives", () => {
    const indices = visibleDiveIndices(testData, new Set([1, 3]), defaultDiveFilters());
    expect(indices).toEqual([0, 2, 4]);
  });

  it("excludes filtered dives", () => {
    const filters: DiveFilterConfig = { ...defaultDiveFilters(), disciplines: ["FIM"] };
    const indices = visibleDiveIndices(testData, new Set(), filters);
    expect(indices).toEqual([2, 3]);
  });

  it("combines hidden and filtered", () => {
    const filters: DiveFilterConfig = { ...defaultDiveFilters(), disciplines: ["CWT", "FIM"] };
    const indices = visibleDiveIndices(testData, new Set([0]), filters);
    expect(indices).toEqual([1, 2, 3]);
  });
});

describe("filterOptionsFromData – empty data", () => {
  const emptyData: DiveData = {
    seriesNames: [],
    datetimes: [],
    diveNumbers: [],
    seriesData: [],
    disciplines: [],
    weights: [],
    exposureSuits: [],
  };

  it("returns zeroed ranges for empty data", () => {
    const opts = filterOptionsFromData(emptyData);
    expect(opts.disciplines).toEqual([]);
    expect(opts.weights).toEqual([]);
    expect(opts.durationMin).toBe(0);
    expect(opts.durationMax).toBe(0);
    expect(opts.maxDepthMin).toBe(0);
    expect(opts.maxDepthMax).toBe(0);
  });
});
