import { describe, expect, it } from "vitest";
import { parseFitArrayBuffer } from "../parseFit";
import { readFixtureArrayBuffer } from "./fixtures/loadFixture";

const FIT_FIXTURE = readFixtureArrayBuffer("overbetuwe-apnea.fit");

describe("parseFitArrayBuffer", () => {
  it("parses one dive per lap from a Garmin apnea FIT session", async () => {
    const dives = await parseFitArrayBuffer(FIT_FIXTURE);

    expect(dives).toHaveLength(3);
    expect(dives.map((dive) => dive.datetime)).toEqual([
      "2026-06-27T14:15:31.000Z",
      "2026-06-27T14:19:23.000Z",
      "2026-06-27T14:25:16.000Z",
    ]);
    expect(dives.map((dive) => dive.diveNumber)).toEqual([1, 2, 3]);
  });

  it("normalizes lap timestamps to ISO datetime strings", async () => {
    const dives = await parseFitArrayBuffer(FIT_FIXTURE);

    for (const dive of dives) {
      expect(typeof dive.datetime).toBe("string");
      expect(dive.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("maps depth to negative meters and includes temperature samples", async () => {
    const dives = await parseFitArrayBuffer(FIT_FIXTURE);
    const deepestPoint = dives[2].profile.reduce((current, point) =>
      point[1] < current[1] ? point : current,
    );

    expect(deepestPoint[1]).toBeCloseTo(-20.668, 2);
    expect(deepestPoint[2]).toBeDefined();
    expect(dives.every((dive) => dive.profile[0][0] === 0)).toBe(true);
  });

  it("throws when the FIT payload is invalid", async () => {
    const invalid = new TextEncoder().encode("not a fit file").buffer;
    await expect(parseFitArrayBuffer(invalid)).rejects.toThrow(
      /FIT file/i,
    );
  });
});
