import { describe, expect, it } from "vitest";
import {
  buildManualDiveProfile,
  createManualDive,
  datetimeFromDateAndTime,
  nextDiveNumberForDate,
  resolveManualDiveDatetime,
} from "../manualDive";
import type { ProfilePoint } from "../parseData";
import { addManualDiveToStore, emptyStore, type DiveStore } from "../storage";

const surfaceProfile: ProfilePoint[] = [[0, 0]];

describe("buildManualDiveProfile", () => {
  it("creates three points with surface temperature only", () => {
    const profile = buildManualDiveProfile({
      maxDepthM: 10,
      durationSec: 60,
      surfaceTempC: 19,
    });

    expect(profile).toEqual([
      [0, 0, 19],
      [30, -10, 19],
      [60, 0, 19],
    ]);
  });

  it("uses min temperature at the middle point when provided", () => {
    const profile = buildManualDiveProfile({
      maxDepthM: 8,
      durationSec: 40,
      surfaceTempC: 20,
      minTempC: 15,
    });

    expect(profile).toEqual([
      [0, 0, 20],
      [20, -8, 15],
      [40, 0, 20],
    ]);
  });
});

describe("datetimeFromDateAndTime", () => {
  it("combines date and time into an ISO datetime", () => {
    expect(datetimeFromDateAndTime("2026-03-01", "14:30")).toBe(
      "2026-03-01T14:30:00Z",
    );
  });

  it("defaults to noon when time is omitted", () => {
    expect(datetimeFromDateAndTime("2026-03-01")).toBe("2026-03-01T12:00:00Z");
    expect(datetimeFromDateAndTime("2026-03-01", "")).toBe(
      "2026-03-01T12:00:00Z",
    );
  });
});

describe("nextDiveNumberForDate", () => {
  it("returns 1 when no dives exist on that date", () => {
    expect(nextDiveNumberForDate(emptyStore(), "2026-03-01")).toBe(1);
  });

  it("returns one greater than the highest dive number on that date", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T10:00:00Z",
          diveNumber: 3,
          profile: surfaceProfile,
        },
        {
          datetime: "2026-03-01T11:00:00Z",
          diveNumber: 7,
          profile: surfaceProfile,
        },
        {
          datetime: "2026-03-02T10:00:00Z",
          diveNumber: 1,
          profile: surfaceProfile,
        },
      ],
      tags: [],
    };

    expect(nextDiveNumberForDate(store, "2026-03-01")).toBe(8);
    expect(nextDiveNumberForDate(store, "2026-03-02")).toBe(2);
  });
});

describe("createManualDive", () => {
  it("builds a stored dive with optional metadata", () => {
    const dive = createManualDive(emptyStore(), {
      date: "2026-03-01",
      time: "12:00",
      maxDepthM: 12,
      durationSec: 90,
      surfaceTempC: 18,
      minTempC: 14,
      discipline: "No-Fins",
      weightKg: 2,
      exposureSuit: { openCell: true, thicknessMm: 5 },
    });

    expect(dive.datetime).toBe("2026-03-01T12:00:00Z");
    expect(dive.diveNumber).toBe(1);
    expect(dive.discipline).toBe("No-Fins");
    expect(dive.weightKg).toBe(2);
    expect(dive.exposureSuit).toEqual({ openCell: true, thicknessMm: 5 });
    expect(dive.profile).toEqual([
      [0, 0, 18],
      [45, -12, 14],
      [90, 0, 18],
    ]);
  });

  it("builds a stored dive without a time", () => {
    const dive = createManualDive(emptyStore(), {
      date: "2026-03-01",
      maxDepthM: 6,
      durationSec: 48,
      surfaceTempC: 17,
    });

    expect(dive.datetime).toBe("2026-03-01T12:00:00Z");
  });

  it("builds a stored dive without a time", () => {
    const dive = createManualDive(emptyStore(), {
      date: "2026-03-01",
      maxDepthM: 6,
      durationSec: 48,
      surfaceTempC: 17,
    });

    expect(dive.datetime).toBe("2026-03-01T12:00:00Z");
  });

  it("uses one minute after the latest dive when noon is taken and no time is provided", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T10:00:00Z",
          diveNumber: 1,
          profile: surfaceProfile,
        },
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 2,
          profile: surfaceProfile,
        },
      ],
      tags: [],
    };

    const dive = createManualDive(store, {
      date: "2026-03-01",
      maxDepthM: 5,
      durationSec: 30,
      surfaceTempC: 20,
    });

    expect(dive.datetime).toBe("2026-03-01T12:01:00Z");
  });

  it("throws when the fallback time would fall on the next day", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile: surfaceProfile,
        },
        {
          datetime: "2026-03-01T23:59:00Z",
          diveNumber: 2,
          profile: surfaceProfile,
        },
      ],
      tags: [],
    };

    expect(() =>
      createManualDive(store, {
        date: "2026-03-01",
        maxDepthM: 5,
        durationSec: 30,
        surfaceTempC: 20,
      }),
    ).toThrow("No available time remaining on this date");
  });

  it("throws when a dive already exists at the same datetime", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 1,
          profile: surfaceProfile,
        },
      ],
      tags: [],
    };

    expect(() =>
      createManualDive(store, {
        date: "2026-03-01",
        time: "12:00",
        maxDepthM: 5,
        durationSec: 30,
        surfaceTempC: 20,
      }),
    ).toThrow("A dive already exists at this date and time");
  });
});

describe("resolveManualDiveDatetime", () => {
  it("returns noon when no time is provided and the slot is free", () => {
    expect(resolveManualDiveDatetime(emptyStore(), "2026-03-01")).toBe(
      "2026-03-01T12:00:00Z",
    );
  });

  it("returns one minute after the latest dive when noon is taken", () => {
    const store: DiveStore = {
      dives: [
        {
          datetime: "2026-03-01T14:30:00Z",
          diveNumber: 1,
          profile: surfaceProfile,
        },
        {
          datetime: "2026-03-01T12:00:00Z",
          diveNumber: 2,
          profile: surfaceProfile,
        },
      ],
      tags: [],
    };

    expect(resolveManualDiveDatetime(store, "2026-03-01")).toBe(
      "2026-03-01T14:31:00Z",
    );
  });
});

describe("addManualDiveToStore", () => {
  it("adds a manual dive to the store", () => {
    const dive = createManualDive(emptyStore(), {
      date: "2026-03-01",
      time: "09:15",
      maxDepthM: 6,
      durationSec: 48,
      surfaceTempC: 17,
    });

    const { store, added } = addManualDiveToStore(emptyStore(), dive);

    expect(added).toBe(1);
    expect(store.dives).toHaveLength(1);
    expect(store.dives[0].datetime).toBe("2026-03-01T09:15:00Z");
  });
});
