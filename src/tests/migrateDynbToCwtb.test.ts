import { describe, expect, it } from "vitest";
import { prepareStore, type DiveStore, type StoredDive } from "../storage";

function makeDive(overrides: Partial<StoredDive> = {}): StoredDive {
  return {
    datetime: "2026-01-01T10:00:00",
    diveNumber: 1,
    profile: [
      [0, 0],
      [10, -5],
      [20, 0],
    ],
    ...overrides,
  };
}

function makeStore(dives: StoredDive[]): DiveStore {
  return { dives };
}

describe("migrateDynbToCwtb (via prepareStore)", () => {
  it('renames "Safety (DYNB)" to "Safety (CWTB)"', () => {
    const store = makeStore([
      makeDive({ discipline: "Safety (DYNB)", diveNumber: 1 }),
    ]);
    const { store: migrated } = prepareStore(store);
    expect(migrated.dives[0].discipline).toBe("Safety (CWTB)");
  });

  it("leaves other disciplines unchanged", () => {
    const store = makeStore([
      makeDive({ discipline: "FIM", diveNumber: 1 }),
      makeDive({ discipline: "CWT", diveNumber: 2 }),
      makeDive({ discipline: "Safety (CWTB)", diveNumber: 3 }),
    ]);
    const { store: migrated } = prepareStore(store);
    expect(migrated.dives[0].discipline).toBe("FIM");
    expect(migrated.dives[1].discipline).toBe("CWT");
    expect(migrated.dives[2].discipline).toBe("Safety (CWTB)");
  });

  it("handles a mix of DYNB and other disciplines", () => {
    const store = makeStore([
      makeDive({ discipline: "Safety (DYNB)", diveNumber: 1 }),
      makeDive({ discipline: "FIM", diveNumber: 2 }),
      makeDive({ discipline: "Safety (DYNB)", diveNumber: 3 }),
    ]);
    const { store: migrated } = prepareStore(store);
    expect(migrated.dives[0].discipline).toBe("Safety (CWTB)");
    expect(migrated.dives[1].discipline).toBe("FIM");
    expect(migrated.dives[2].discipline).toBe("Safety (CWTB)");
  });

  it("leaves dives without a discipline unchanged", () => {
    const store = makeStore([makeDive({ diveNumber: 1 })]);
    const { store: migrated } = prepareStore(store);
    expect(migrated.dives[0].discipline).toBeUndefined();
  });
});
