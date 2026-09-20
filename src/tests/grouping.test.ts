import { describe, expect, it } from "vitest";
import type { DiveData, ExposureSuit, ProfilePoint } from "../parseData";
import {
  defaultGroupingConfig,
  groupingConfigsEqual,
  matchingGroupingPreset,
  processData,
  resolvePresetFilters,
  GROUPING_PRESETS,
  type GroupingConfig,
} from "../grouping";
import { defaultDiveFilters } from "../filters";

// ── Helpers ──

/** Simple V-shaped profile: surface → depth → surface. */
function vProfile(
  depthMeters: number,
  durationSeconds: number,
  temp?: number,
): ProfilePoint[] {
  const half = durationSeconds / 2;
  const pts: ProfilePoint[] = [
    temp !== undefined ? [0, 0, temp] : [0, 0],
    temp !== undefined ? [half, -depthMeters, temp] : [half, -depthMeters],
    temp !== undefined ? [durationSeconds, 0, temp] : [durationSeconds, 0],
  ];
  return pts;
}

function vProfileWithTempRange(
  depthMeters: number,
  durationSeconds: number,
  surfaceTemp: number,
  bottomTemp: number,
): ProfilePoint[] {
  const half = durationSeconds / 2;
  return [
    [0, 0, surfaceTemp],
    [half, -depthMeters, bottomTemp],
    [durationSeconds, 0, surfaceTemp],
  ];
}

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
    surfaceTemp?: number;
    bottomTemp?: number;
    tags?: string[];
  }[],
): DiveData {
  return {
    seriesNames: dives.map((d) => `${d.date} #${d.num}`),
    datetimes: dives.map((d) => `${d.date}T10:00:00Z`),
    diveNumbers: dives.map((d) => d.num),
    seriesData: dives.map((d) =>
      d.surfaceTemp !== undefined && d.bottomTemp !== undefined
        ? vProfileWithTempRange(d.depth, d.duration, d.surfaceTemp, d.bottomTemp)
        : vProfile(d.depth, d.duration, d.temp),
    ),
    disciplines: dives.map((d) => d.discipline),
    weights: dives.map((d) => d.weight),
    exposureSuits: dives.map((d) => d.exposureSuit),
    tags: dives.map((d) => d.tags ?? []),
  };
}

// ── Tests ──

describe("defaultGroupingConfig", () => {
  it("returns sensible defaults", () => {
    const cfg = defaultGroupingConfig();
    expect(cfg.viewMode).toBe("diveProfile");
    expect(cfg.groupMode).toBe("none");
    expect(cfg.aggregationMode).toBe("none");
    expect(cfg.displayMode).toBe("maximum");
    expect(cfg.maximumCriterion).toBe("deepest");
  });
});

describe("groupingConfigsEqual", () => {
  it("returns true for identical configs", () => {
    const a = defaultGroupingConfig();
    const b = defaultGroupingConfig();
    expect(groupingConfigsEqual(a, b)).toBe(true);
  });

  it("returns false when one field differs", () => {
    const a = defaultGroupingConfig();
    const b = { ...defaultGroupingConfig(), groupMode: "discipline" as const };
    expect(groupingConfigsEqual(a, b)).toBe(false);
  });
});

describe("matchingGroupingPreset", () => {
  it("matches the personal-bests preset", () => {
    const preset = GROUPING_PRESETS.find((p) => p.id === "personal-bests")!;
    const filters = resolvePresetFilters(preset.filters, ["CWT", "FIM", "Safety DYNB"]);
    const match = matchingGroupingPreset(preset.config, filters, ["CWT", "FIM", "Safety DYNB"]);
    expect(match).toBeDefined();
    expect(match!.id).toBe("personal-bests");
  });

  it("returns undefined for default config with default filters", () => {
    const match = matchingGroupingPreset(
      defaultGroupingConfig(),
      defaultDiveFilters(),
      [],
    );
    expect(match).toBeUndefined();
  });
});

describe("processData – groupMode: none", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, discipline: "CWT" },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, discipline: "FIM" },
    { date: "2026-01-11", num: 3, depth: 15, duration: 40 },
  ]);

  it("produces one series per dive in line mode", () => {
    const cfg = defaultGroupingConfig();
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("line");
    expect(result.series).toHaveLength(3);
    expect(result.series[0].primaryDiveIndex).toBe(0);
    expect(result.series[1].primaryDiveIndex).toBe(1);
    expect(result.series[2].primaryDiveIndex).toBe(2);
  });

  it("each series contains only its own dive index", () => {
    const cfg = defaultGroupingConfig();
    const result = processData(data, cfg);
    result.series.forEach((s, i) => {
      expect(s.diveIndices).toEqual([i]);
    });
  });
});

describe("processData – groupMode: discipline", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, discipline: "CWT" },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, discipline: "CWT" },
    { date: "2026-01-11", num: 3, depth: 25, duration: 50, discipline: "FIM" },
    { date: "2026-01-12", num: 4, depth: 10, duration: 30 },
  ]);

  it("groups dives by discipline with deepest-maximum mode", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "discipline",
      displayMode: "maximum",
      maximumCriterion: "deepest",
    };
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("line");
    // CWT, FIM, (Unknown)
    expect(result.series).toHaveLength(3);

    const cwt = result.series.find((s) => s.label === "CWT")!;
    expect(cwt).toBeDefined();
    // dive #2 is deepest CWT (30m)
    expect(cwt.primaryDiveIndex).toBe(1);
    expect(cwt.diveIndices).toEqual([0, 1]);

    const fim = result.series.find((s) => s.label === "FIM")!;
    expect(fim.primaryDiveIndex).toBe(2);
  });

  it("picks longest dive when criterion is 'longest'", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "discipline",
      displayMode: "maximum",
      maximumCriterion: "longest",
    };
    const result = processData(data, cfg);
    const cwt = result.series.find((s) => s.label === "CWT")!;
    // dive #2 is longest CWT (80s)
    expect(cwt.primaryDiveIndex).toBe(1);
  });

  it("produces averaged profile in average mode", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "discipline",
      displayMode: "average",
    };
    const result = processData(data, cfg);
    const cwt = result.series.find((s) => s.label === "CWT")!;
    expect(cwt).toBeDefined();
    // Average of two dives should have intermediate depth values
    const minDepth = Math.min(...cwt.data.map(([, d]) => d));
    expect(minDepth).toBeLessThan(0);
  });
});

describe("processData – groupMode: dateInterval", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, discipline: "CWT" },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, discipline: "CWT" },
    { date: "2026-02-15", num: 3, depth: 25, duration: 50, discipline: "FIM" },
  ]);

  it("groups by month", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "dateInterval",
      dateIntervalUnit: "month",
      displayMode: "maximum",
      maximumCriterion: "deepest",
    };
    const result = processData(data, cfg);
    expect(result.series).toHaveLength(2);
    expect(result.series[0].label).toContain("Jan");
    expect(result.series[1].label).toContain("Feb");
  });

  it("groups by day", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "dateInterval",
      dateIntervalUnit: "day",
      displayMode: "maximum",
      maximumCriterion: "deepest",
    };
    const result = processData(data, cfg);
    // 2 distinct days
    expect(result.series).toHaveLength(2);
    // Jan 10 has 2 dives, deepest is 30m (index 1)
    expect(result.series[0].diveIndices).toEqual([0, 1]);
    expect(result.series[0].primaryDiveIndex).toBe(1);
  });
});

describe("processData – groupMode: weight", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, weight: 2 },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, weight: 2 },
    { date: "2026-01-11", num: 3, depth: 25, duration: 50, weight: 3 },
    { date: "2026-01-12", num: 4, depth: 10, duration: 30 },
  ]);

  it("groups by weight with unknowns last", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "weight",
    };
    const result = processData(data, cfg);
    expect(result.series).toHaveLength(3);
    expect(result.series[0].label).toBe("2kg");
    expect(result.series[1].label).toBe("3kg");
    expect(result.series[2].label).toBe("(Unknown)");
  });
});

describe("processData – groupMode: exposureSuit", () => {
  const suitA: ExposureSuit = { openCell: true, thicknessMm: 3 };
  const suitB: ExposureSuit = { openCell: false, thicknessMm: 5 };

  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, exposureSuit: suitA },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, exposureSuit: suitB },
    { date: "2026-01-11", num: 3, depth: 25, duration: 50, exposureSuit: suitA },
  ]);

  it("groups by formatted suit label", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "exposureSuit",
    };
    const result = processData(data, cfg);
    expect(result.series).toHaveLength(2);
    const labels = result.series.map((s) => s.label);
    expect(labels).toContain("Open Cell, 3mm");
    expect(labels).toContain("Closed Cell, 5mm");
  });
});

describe("processData – groupMode: temperature", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, surfaceTemp: 22, bottomTemp: 18 },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, surfaceTemp: 28, bottomTemp: 20 },
    { date: "2026-01-11", num: 3, depth: 25, duration: 50, surfaceTemp: 15, bottomTemp: 12 },
  ]);

  it("groups by max temperature in 5° buckets", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "temperature",
      temperatureIncrement: 5,
      temperatureMode: "max",
    };
    const result = processData(data, cfg);
    expect(result.series.length).toBeGreaterThanOrEqual(2);
    // Labels should contain °C
    result.series.forEach((s) => {
      expect(s.label).toContain("°C");
    });
  });

  it("groups by temperature difference", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "temperature",
      temperatureIncrement: 5,
      temperatureMode: "difference",
    };
    const result = processData(data, cfg);
    expect(result.series.length).toBeGreaterThanOrEqual(1);
  });
});

describe("processData – aggregation", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, discipline: "CWT" },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, discipline: "CWT" },
    { date: "2026-01-11", num: 3, depth: 25, duration: 50, discipline: "FIM" },
  ]);

  it("produces bar chart for distance aggregation by discipline", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "discipline",
      aggregationMode: "distance",
    };
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("bar");
    expect(result.aggregationMetric).toBe("distance");
    expect(result.series).toHaveLength(2);

    const cwt = result.series.find((s) => s.label === "CWT")!;
    // 20m + 30m = 50m, ×2 for round trip = 100m
    expect(cwt.aggregationValue).toBe(100);

    const fim = result.series.find((s) => s.label === "FIM")!;
    // 25m ×2 = 50m
    expect(fim.aggregationValue).toBe(50);
  });

  it("produces bar chart for duration aggregation by discipline", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      groupMode: "discipline",
      aggregationMode: "duration",
    };
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("bar");
    expect(result.aggregationMetric).toBe("duration");

    const cwt = result.series.find((s) => s.label === "CWT")!;
    // 60 + 80 = 140s
    expect(cwt.aggregationValue).toBe(140);

    const fim = result.series.find((s) => s.label === "FIM")!;
    expect(fim.aggregationValue).toBe(50);
  });
});

describe("processData – timeline view", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, discipline: "CWT" },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, discipline: "FIM" },
    { date: "2026-02-15", num: 3, depth: 25, duration: 100, discipline: "CWT" },
  ]);

  it("produces timeline chart mode with categories", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      dateIntervalUnit: "month",
      displayMode: "maximum",
      maximumCriterion: "deepest",
    };
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("timeline");
    expect(result.timelineMetric).toBe("depth");
    expect(result.timelineCategories).toBeDefined();
    expect(result.timelineCategories!.length).toBe(2);
  });

  it("groups by discipline in timeline view", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      groupMode: "discipline",
      dateIntervalUnit: "month",
      displayMode: "maximum",
      maximumCriterion: "deepest",
    };
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("timeline");
    expect(result.series.length).toBe(2);
    const labels = result.series.map((s) => s.label);
    expect(labels).toContain("CWT");
    expect(labels).toContain("FIM");
  });

  it("uses duration metric when criterion is longest", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      dateIntervalUnit: "month",
      displayMode: "maximum",
      maximumCriterion: "longest",
    };
    const result = processData(data, cfg);
    expect(result.timelineMetric).toBe("duration");
  });
});

describe("processData – empty data", () => {
  const emptyData: DiveData = {
    seriesNames: [],
    datetimes: [],
    diveNumbers: [],
    seriesData: [],
    disciplines: [],
    weights: [],
    exposureSuits: [],
  };

  it("returns empty series for empty data", () => {
    const cfg = defaultGroupingConfig();
    const result = processData(emptyData, cfg);
    expect(result.series).toHaveLength(0);
  });
});

describe("processData – heatmap view (scatter)", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, discipline: "CWT" },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, discipline: "FIM" },
    { date: "2026-02-15", num: 3, depth: 25, duration: 100, discipline: "CWT" },
  ]);

  it("produces heatmap chart mode with scatter display", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      heatmapMetric: "depth",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("heatmap");
    expect(result.heatmapMetric).toBe("depth");
    expect(result.heatmapDisplayMode).toBe("scatter");
  });

  it("does not interpolate — one data point per dive", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      heatmapMetric: "depth",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(data, cfg);
    expect(result.series[0].data.length).toBe(3);
    expect(result.heatmapCategories!.length).toBe(3);
  });

  it("produces a single series containing all original dive indices", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      heatmapMetric: "depth",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(data, cfg);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].diveIndices).toEqual([0, 1, 2]);
    expect(result.series[0].label).toBe("All dives");
  });

  it("first and last data points match original dive values (depth)", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      heatmapMetric: "depth",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(data, cfg);
    const points = result.series[0].data;
    expect(points[0][1]).toBe(20);
    expect(points[points.length - 1][1]).toBe(25);
  });

  it("first and last data points match original dive values (duration)", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      heatmapMetric: "duration",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(data, cfg);
    const points = result.series[0].data;
    expect(points[0][1]).toBe(60);
    expect(points[points.length - 1][1]).toBe(100);
  });

  it("interpolated values stay within the range of neighboring dives", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      heatmapMetric: "depth",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(data, cfg);
    const values = result.series[0].data.map(([, v]) => v);
    const min = Math.min(20, 25, 30);
    const max = Math.max(20, 25, 30);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
  });
});

describe("processData – heatmap view (density)", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60 },
    { date: "2026-01-10", num: 2, depth: 20, duration: 60 },
    { date: "2026-01-11", num: 3, depth: 30, duration: 80 },
    { date: "2026-01-12", num: 4, depth: 40, duration: 120 },
  ]);

  it("produces heatmap chart mode with heatmap display", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "heatmap",
      heatmapMetric: "depth",
      heatmapDisplayMode: "heatmap",
    };
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("heatmap");
    expect(result.heatmapDisplayMode).toBe("heatmap");
  });

  it("interpolates to at least 20k data points", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "heatmap",
      heatmapMetric: "depth",
      heatmapDisplayMode: "heatmap",
    };
    const result = processData(data, cfg);
    expect(result.series[0].data.length).toBeGreaterThanOrEqual(20_000);
  });
});

describe("processData – heatmap ignores grouping/aggregation", () => {
  const data = makeDiveData([
    { date: "2026-01-10", num: 1, depth: 20, duration: 60, discipline: "CWT" },
    { date: "2026-01-10", num: 2, depth: 30, duration: 80, discipline: "FIM" },
  ]);

  it("ignores groupMode and still produces one series", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      groupMode: "discipline",
      aggregationMode: "distance",
      heatmapMetric: "depth",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(data, cfg);
    expect(result.chartMode).toBe("heatmap");
    expect(result.series).toHaveLength(1);
    expect(result.series[0].diveIndices).toEqual([0, 1]);
  });
});

describe("processData – heatmap with empty data", () => {
  const emptyData: DiveData = {
    seriesNames: [],
    datetimes: [],
    diveNumbers: [],
    seriesData: [],
    disciplines: [],
    weights: [],
    exposureSuits: [],
  };

  it("returns empty categories and a single empty series", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      heatmapMetric: "depth",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(emptyData, cfg);
    expect(result.chartMode).toBe("heatmap");
    expect(result.heatmapCategories).toEqual([]);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].data).toHaveLength(0);
  });
});

describe("processData – heatmap with single dive", () => {
  const data = makeDiveData([
    { date: "2026-03-01", num: 1, depth: 15, duration: 45 },
  ]);

  it("produces exactly one data point", () => {
    const cfg: GroupingConfig = {
      ...defaultGroupingConfig(),
      viewMode: "timeline",
      timelineVariant: "multiPoint",
      heatmapMetric: "depth",
      heatmapDisplayMode: "scatter",
    };
    const result = processData(data, cfg);
    expect(result.series[0].data).toHaveLength(1);
    expect(result.series[0].data[0]).toEqual([0, 15]);
    expect(result.heatmapCategories).toEqual(["2026-03-01 #1"]);
  });
});
