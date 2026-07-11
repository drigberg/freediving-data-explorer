import { describe, expect, it } from "vitest";
import type { ProfilePoint } from "../parseData";
import {
  buildSplitDives,
  bumpEndGap,
  bumpStartGap,
  canBumpEndRight,
  canBumpStartRight,
  canTrimOrSplitProfile,
  getTrimSplitIssues,
  datetimePlusSeconds,
  detectDiveRegions,
  detectConsecutiveSurfaceSections,
  buildEditDepthSeriesData,
  extractRegionProfiles,
  hasUnderwaterPoints,
  prepareEditableProfile,
  toggleRegionEnabled,
  regionToggleControl,
} from "../splitDive";
import { emptyStore, replaceDiveWithSplits, type DiveStore } from "../storage";

const multiRegionProfile: ProfilePoint[] = [
  [0, 0],
  [5, -5],
  [10, -8],
  [15, 0],
  [20, 0],
  [25, -3],
  [30, 0],
];

const singleRegionProfile: ProfilePoint[] = [
  [0, 0],
  [5, -5],
  [10, 0],
];

describe("hasUnderwaterPoints", () => {
  it("returns true when any point is below the surface", () => {
    expect(hasUnderwaterPoints(singleRegionProfile)).toBe(true);
  });

  it("returns false for a surface-only profile", () => {
    expect(hasUnderwaterPoints([[0, 0], [5, 0]])).toBe(false);
  });

  it("returns false for an empty profile", () => {
    expect(hasUnderwaterPoints([])).toBe(false);
  });
});

describe("canTrimOrSplitProfile", () => {
  it("is disabled for a normalized single-region dive", () => {
    const profile: ProfilePoint[] = [
      [0, 0],
      [5, -5],
      [10, 0],
    ];

    expect(canTrimOrSplitProfile(profile)).toBe(false);
  });

  it("is enabled when the first point is not at the surface", () => {
    const profile: ProfilePoint[] = [
      [0, -2],
      [5, -5],
      [10, 0],
    ];

    expect(canTrimOrSplitProfile(profile)).toBe(true);
  });

  it("is enabled when the last point is not at the surface", () => {
    const profile: ProfilePoint[] = [
      [0, 0],
      [5, -5],
      [10, -1],
    ];

    expect(canTrimOrSplitProfile(profile)).toBe(true);
  });

  it("is enabled when multiple underwater regions are detected", () => {
    expect(canTrimOrSplitProfile(multiRegionProfile)).toBe(true);
  });

  it("is disabled when there is no underwater data", () => {
    expect(canTrimOrSplitProfile([[0, 0], [5, 0]])).toBe(false);
  });

  it("is disabled for an empty profile", () => {
    expect(canTrimOrSplitProfile([])).toBe(false);
  });
});

describe("getTrimSplitIssues", () => {
  it("returns no issues for a normalized single-region dive", () => {
    expect(
      getTrimSplitIssues([
        [0, 0],
        [5, -5],
        [10, 0],
      ]),
    ).toEqual([]);
  });

  it("lists each detected issue", () => {
    const profile: ProfilePoint[] = [
      [0, -2],
      [5, -5],
      [10, -1],
    ];

    expect(getTrimSplitIssues(profile)).toEqual([
      "Profile does not start at the surface (depth 0)",
      "Profile does not end at the surface (depth 0)",
    ]);
  });

  it("reports multiple underwater regions", () => {
    expect(getTrimSplitIssues(multiRegionProfile)).toEqual([
      "2 separate underwater regions detected",
    ]);
  });

  it("returns no issues for an empty profile", () => {
    expect(getTrimSplitIssues([])).toEqual([]);
  });

  it("can report every issue type on one profile", () => {
    const profile: ProfilePoint[] = [
      [0, -2],
      [5, -5],
      [10, 0],
      [15, 0],
      [20, -3],
      [25, -1],
    ];

    expect(getTrimSplitIssues(profile)).toEqual([
      "Profile does not start at the surface (depth 0)",
      "Profile does not end at the surface (depth 0)",
      "2 separate underwater regions detected",
    ]);
  });
});

describe("detectConsecutiveSurfaceSections", () => {
  it("finds each maximal run of depth-zero points", () => {
    expect(detectConsecutiveSurfaceSections(multiRegionProfile)).toEqual([
      { startIdx: 0, endIdx: 0 },
      { startIdx: 3, endIdx: 4 },
      { startIdx: 6, endIdx: 6 },
    ]);
  });

  it("returns an empty list when there are no surface points", () => {
    const profile: ProfilePoint[] = [
      [0, -2],
      [5, -5],
      [10, -3],
    ];

    expect(detectConsecutiveSurfaceSections(profile)).toEqual([]);
  });
});

describe("buildEditDepthSeriesData", () => {
  it("puts consecutive surface points in the gray surface series", () => {
    const regions = detectDiveRegions(multiRegionProfile);
    const { surface, enabled } = buildEditDepthSeriesData(
      multiRegionProfile,
      regions,
    );

    expect(surface).toEqual([
      [0, 0],
      null,
      [15, 0],
      [20, 0],
      null,
      [30, 0],
    ]);
    expect(enabled).toEqual([
      [0, 0],
      [5, -5],
      [10, -8],
      [15, 0],
      null,
      [20, 0],
      [25, -3],
      [30, 0],
    ]);
  });

  it("routes disabled underwater points to the gray disabled series", () => {
    const regions = detectDiveRegions(multiRegionProfile).map((region, index) => ({
      ...region,
      enabled: index === 0,
    }));
    const { enabled, disabled } = buildEditDepthSeriesData(
      multiRegionProfile,
      regions,
    );

    expect(enabled).toEqual([
      [0, 0],
      [5, -5],
      [10, -8],
      [15, 0],
    ]);
    expect(disabled).toEqual([
      [20, 0],
      [25, -3],
      [30, 0],
    ]);
  });
});

describe("detectDiveRegions", () => {
  it("detects multiple underwater regions separated by surface gaps", () => {
    const regions = detectDiveRegions(multiRegionProfile);

    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({
      id: "region-0",
      startIdx: 0,
      endIdx: 3,
      enabled: true,
    });
    expect(regions[1]).toMatchObject({
      id: "region-1",
      startIdx: 4,
      endIdx: 6,
      enabled: true,
    });
  });

  it("detects a single region with surface bookends", () => {
    const regions = detectDiveRegions(singleRegionProfile);

    expect(regions).toEqual([
      {
        id: "region-0",
        startIdx: 0,
        endIdx: 2,
        enabled: true,
      },
    ]);
  });

  it("returns no regions when there is no underwater data", () => {
    expect(detectDiveRegions([[0, 0], [5, 0]])).toEqual([]);
  });
});

describe("prepareEditableProfile", () => {
  it("inserts leading and trailing surface padding with inherited temperature", () => {
    const profile: ProfilePoint[] = [
      [10, -5, 18],
      [20, -8, 16],
      [30, -2, 17],
    ];
    const prepared = prepareEditableProfile(profile);

    expect(prepared.leadingPadding).toBe(true);
    expect(prepared.trailingPadding).toBe(true);
    expect(prepared.leadingPaddingIndex).toBe(0);
    expect(prepared.trailingPaddingIndex).toBe(prepared.profile.length - 1);
    expect(prepared.profile[0]).toEqual([0, 0, 18]);
    expect(prepared.profile[prepared.profile.length - 1]).toEqual([31, 0, 17]);
    expect(prepared.profile[1]).toEqual([10, -5, 18]);
  });

  it("inserts only leading padding when the profile ends at the surface", () => {
    const profile: ProfilePoint[] = [
      [10, -5, 18],
      [20, 0, 18],
    ];
    const prepared = prepareEditableProfile(profile);

    expect(prepared).toMatchObject({
      leadingPadding: true,
      trailingPadding: false,
      leadingPaddingIndex: 0,
      trailingPaddingIndex: 2,
    });
    expect(prepared.profile).toEqual([
      [0, 0, 18],
      [10, -5, 18],
      [20, 0, 18],
    ]);
  });

  it("inserts only trailing padding when the profile starts at the surface", () => {
    const profile: ProfilePoint[] = [
      [0, 0, 18],
      [10, -5, 18],
    ];
    const prepared = prepareEditableProfile(profile);

    expect(prepared).toMatchObject({
      leadingPadding: false,
      trailingPadding: true,
      leadingPaddingIndex: 0,
      trailingPaddingIndex: 2,
    });
    expect(prepared.profile).toEqual([
      [0, 0, 18],
      [10, -5, 18],
      [11, 0, 18],
    ]);
  });

  it("does not insert padding when the profile already starts and ends at the surface", () => {
    const prepared = prepareEditableProfile(singleRegionProfile);

    expect(prepared).toMatchObject({
      leadingPadding: false,
      trailingPadding: false,
      leadingPaddingIndex: 0,
      trailingPaddingIndex: 2,
      profile: singleRegionProfile,
    });
  });
});

describe("bumpStartGap", () => {
  it("shifts all points except the inserted leading zero", () => {
    const profile: ProfilePoint[] = [
      [0, 0],
      [2, -5],
      [4, 0],
    ];
    const bumped = bumpStartGap(profile, 1, 0);

    expect(bumped).toEqual([
      [0, 0],
      [3, -5],
      [5, 0],
    ]);
  });

  it("disables right-arrow shrink when the start gap is 1 second", () => {
    const profile: ProfilePoint[] = [
      [0, 0],
      [1, -5],
      [4, 0],
    ];

    expect(canBumpStartRight(profile, 0)).toBe(false);
    expect(canBumpStartRight(bumpStartGap(profile, 1, 0), 0)).toBe(true);
  });

  it("preserves temperature when shifting non-padding points", () => {
    const profile: ProfilePoint[] = [
      [0, 0, 20],
      [2, -5, 16],
      [4, 0, 20],
    ];

    expect(bumpStartGap(profile, 2, 0)).toEqual([
      [0, 0, 20],
      [4, -5, 16],
      [6, 0, 20],
    ]);
  });
});

describe("bumpEndGap", () => {
  it("shifts all points except the inserted trailing zero", () => {
    const profile: ProfilePoint[] = [
      [0, 0],
      [2, -5],
      [4, 0],
    ];
    const bumped = bumpEndGap(profile, -1, 2);

    expect(bumped).toEqual([
      [-1, 0],
      [1, -5],
      [4, 0],
    ]);
  });

  it("disables right-arrow shrink when the end gap is 1 second", () => {
    const profile: ProfilePoint[] = [
      [0, 0],
      [3, -5],
      [4, 0],
    ];

    expect(canBumpEndRight(profile, 2)).toBe(false);
    expect(canBumpEndRight(bumpEndGap(profile, -1, 2), 2)).toBe(true);
  });

  it("returns false when there is no point before the trailing padding", () => {
    expect(canBumpEndRight([[0, 0]], 0)).toBe(false);
  });
});

describe("regionToggleControl", () => {
  it("shows keep for disabled regions", () => {
    const regions = detectDiveRegions(multiRegionProfile).map((region, index) => ({
      ...region,
      enabled: index === 0,
    }));

    expect(regionToggleControl(regions[1], regions)).toEqual({
      label: "keep",
      clickable: true,
    });
  });

  it("shows discard for enabled regions that can be removed", () => {
    const regions = detectDiveRegions(multiRegionProfile);

    expect(regionToggleControl(regions[0], regions)).toEqual({
      label: "discard",
      clickable: true,
    });
  });

  it("shows a non-clickable keep for the last enabled region", () => {
    const regions = detectDiveRegions(multiRegionProfile).map((region, index) => ({
      ...region,
      enabled: index === 0,
    }));

    expect(regionToggleControl(regions[0], regions)).toEqual({
      label: "keep",
      clickable: false,
    });
  });
});

describe("toggleRegionEnabled", () => {
  it("rejects disabling the last enabled region", () => {
    const regions = detectDiveRegions(multiRegionProfile);
    const onlyFirstEnabled = regions.map((region, index) => ({
      ...region,
      enabled: index === 0,
    }));

    expect(
      toggleRegionEnabled(onlyFirstEnabled, onlyFirstEnabled[0].id),
    ).toBeNull();
  });

  it("toggles a region when another enabled region remains", () => {
    const regions = detectDiveRegions(multiRegionProfile);
    const toggled = toggleRegionEnabled(regions, regions[0].id);

    expect(toggled).not.toBeNull();
    expect(toggled?.[0].enabled).toBe(false);
    expect(toggled?.[1].enabled).toBe(true);
  });

  it("re-enables a previously disabled region", () => {
    const regions = detectDiveRegions(multiRegionProfile).map((region, index) => ({
      ...region,
      enabled: index === 0,
    }));
    const reEnabled = toggleRegionEnabled(regions, regions[1].id);

    expect(reEnabled).not.toBeNull();
    expect(reEnabled?.[0].enabled).toBe(true);
    expect(reEnabled?.[1].enabled).toBe(true);
  });

  it("returns null for an unknown region id", () => {
    const regions = detectDiveRegions(multiRegionProfile);

    expect(toggleRegionEnabled(regions, "missing-region")).toBeNull();
  });
});

describe("extractRegionProfiles", () => {
  it("returns only enabled region slices", () => {
    const regions = detectDiveRegions(multiRegionProfile).map((region, index) => ({
      ...region,
      enabled: index === 0,
    }));

    expect(extractRegionProfiles(multiRegionProfile, regions)).toEqual([
      [
        [0, 0],
        [5, -5],
        [10, -8],
        [15, 0],
      ],
    ]);
  });

  it("returns copies that do not mutate the source profile", () => {
    const profile: ProfilePoint[] = [
      [0, 0, 19],
      [5, -5, 16],
      [10, 0, 19],
    ];
    const regions = detectDiveRegions(profile);
    const extracted = extractRegionProfiles(profile, regions);

    extracted[0][1][1] = -99;
    expect(profile[1][1]).toBe(-5);
  });
});

describe("datetimePlusSeconds", () => {
  it("offsets an ISO datetime by whole seconds", () => {
    expect(datetimePlusSeconds("2026-03-01T12:00:00Z", 20)).toBe(
      "2026-03-01T12:00:20Z",
    );
  });

  it("carries overflow into the next minute", () => {
    expect(datetimePlusSeconds("2026-03-01T12:00:50Z", 15)).toBe(
      "2026-03-01T12:01:05Z",
    );
  });
});

describe("buildSplitDives", () => {
  it("offsets datetime by region start and copies metadata", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 2,
          profile: multiRegionProfile,
          discipline: "CWT",
          weightKg: 6,
        },
      ],
      tags: [],
    };
    const original = store.dives[0];
    const regionProfiles = extractRegionProfiles(
      multiRegionProfile,
      detectDiveRegions(multiRegionProfile),
    );
    const newDives = buildSplitDives(original, regionProfiles, store);

    expect(newDives).toHaveLength(2);
    expect(newDives[0].datetime).toBe(
      datetimePlusSeconds(original.datetime, 0),
    );
    expect(newDives[1].datetime).toBe(
      datetimePlusSeconds(original.datetime, 20),
    );
    expect(newDives[0].profile[0]).toEqual([0, 0]);
    expect(newDives[1].profile[0]).toEqual([0, 0]);
    expect(newDives[0].discipline).toBe("CWT");
    expect(newDives[0].weightKg).toBe(6);
    expect(newDives[0].diveNumber).toBe(1);
    expect(newDives[1].diveNumber).toBe(2);
  });

  it("replaces the original dive with one trimmed dive for a single region", () => {
    const profile: ProfilePoint[] = [
      [0, 0],
      [5, -5],
      [10, 0],
    ];
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile,
        },
      ],
      tags: [],
    };
    const original = store.dives[0];
    const regionProfiles = extractRegionProfiles(
      profile,
      detectDiveRegions(profile),
    );
    const newDives = buildSplitDives(original, regionProfiles, store);
    const { store: updated } = replaceDiveWithSplits(
      store,
      original.datetime,
      newDives,
    );

    expect(newDives).toHaveLength(1);
    expect(updated.dives).toHaveLength(1);
    expect(updated.dives[0].profile).toEqual([
      [0, 0],
      [5, -5],
      [10, 0],
    ]);
  });

  it("shifts region profiles to start at time zero", () => {
    const profile: ProfilePoint[] = [
      [10, 0],
      [15, -5],
      [20, 0],
    ];
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile,
        },
      ],
      tags: [],
    };
    const original = store.dives[0];
    const regionProfiles = extractRegionProfiles(
      profile,
      detectDiveRegions(profile),
    );
    const [trimmed] = buildSplitDives(original, regionProfiles, store);

    expect(trimmed.profile).toEqual([
      [0, 0],
      [5, -5],
      [10, 0],
    ]);
    expect(trimmed.datetime).toBe("2026-03-01T12:00:10Z");
  });

  it("bumps datetime by one minute when the proposed time already exists", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile: multiRegionProfile,
        },
        {
          datetime: "2026-03-01T12:00:20Z",
          diveNumber: 2,
          profile: singleRegionProfile,
        },
      ],
      tags: [],
    };
    const original = store.dives[0];
    const regionProfiles = extractRegionProfiles(
      multiRegionProfile,
      detectDiveRegions(multiRegionProfile),
    );
    const newDives = buildSplitDives(original, regionProfiles, store);

    expect(newDives[1].datetime).toBe("2026-03-01T12:01:00Z");
  });

  it("copies optional dive metadata onto each new dive", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile: multiRegionProfile,
          discipline: "CWT",
          weightKg: 6,
          exposureSuit: { openCell: true, thicknessMm: 5 },
          archived: true,
        },
      ],
      tags: [],
    };
    const original = store.dives[0];
    const regionProfiles = extractRegionProfiles(
      multiRegionProfile,
      detectDiveRegions(multiRegionProfile),
    );
    const newDives = buildSplitDives(original, regionProfiles, store);

    for (const dive of newDives) {
      expect(dive).toMatchObject({
        discipline: "CWT",
        weightKg: 6,
        exposureSuit: { openCell: true, thicknessMm: 5 },
        archived: true,
      });
    }
  });
});

describe("replaceDiveWithSplits", () => {
  it("removes the original dive, inserts new dives, and remaps tag datetimes", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile: multiRegionProfile,
        },
      ],
      tags: [
        {
          name: "Pool day",
          diveDatetimes: ["2026-03-01T12:00:00Z"],
        },
      ],
    };
    const original = store.dives[0];
    const regionProfiles = extractRegionProfiles(
      multiRegionProfile,
      detectDiveRegions(multiRegionProfile),
    );
    const newDives = buildSplitDives(original, regionProfiles, emptyStore());
    const { store: updated, newDatetimes } = replaceDiveWithSplits(
      store,
      original.datetime,
      newDives,
    );

    expect(updated.dives.map((dive) => dive.datetime)).toEqual(
      newDives.map((dive) => dive.datetime).sort(),
    );
    expect(updated.dives).toHaveLength(2);
    expect(updated.tags[0].diveDatetimes).toEqual(newDatetimes);
  });

  it("leaves tags alone when they do not reference the original dive", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile: multiRegionProfile,
        },
      ],
      tags: [
        {
          name: "Other day",
          diveDatetimes: ["2026-03-02T12:00:00Z"],
        },
      ],
    };
    const original = store.dives[0];
    const regionProfiles = extractRegionProfiles(
      multiRegionProfile,
      detectDiveRegions(multiRegionProfile),
    );
    const newDives = buildSplitDives(original, regionProfiles, emptyStore());
    const { store: updated } = replaceDiveWithSplits(
      store,
      original.datetime,
      newDives,
    );

    expect(updated.tags[0].diveDatetimes).toEqual(["2026-03-02T12:00:00Z"]);
  });

  it("sorts the merged dives by datetime", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile: multiRegionProfile,
        },
        {
          datetime: "2026-03-01T13:00:00Z",
          diveNumber: 2,
          profile: singleRegionProfile,
        },
      ],
      tags: [],
    };
    const original = store.dives[0];
    const regionProfiles = extractRegionProfiles(
      multiRegionProfile,
      detectDiveRegions(multiRegionProfile),
    );
    const newDives = buildSplitDives(original, regionProfiles, store);
    const { store: updated } = replaceDiveWithSplits(
      store,
      original.datetime,
      newDives,
    );

    expect(updated.dives.map((dive) => dive.datetime)).toEqual([
      "2026-03-01T12:00:00Z",
      "2026-03-01T12:00:20Z",
      "2026-03-01T13:00:00Z",
    ]);
  });
});
