import { describe, expect, it } from "vitest";
import {
  normalizeProfilePoints,
  parseUddfString,
  type ProfilePoint,
} from "../parseData";
import { readFixtureText } from "./fixtures/loadFixture";

const SAMPLE_UDDF = readFixtureText("sample.uddf");

describe("parseUddfString", () => {
  it("parses dive metadata and depth profile from UDDF XML", () => {
    const parsed = parseUddfString(SAMPLE_UDDF);
    expect(parsed).not.toBeNull();
    expect(parsed?.datetime).toBe("2026-01-15T10:30:00Z");
    expect(parsed?.diveNumber).toBe(42);
    expect(parsed?.profile.length).toBeGreaterThan(0);
    expect(parsed?.profile.some(([_, depth]) => depth < 0)).toBe(true);
  });

  it("converts depth to negative meters and kelvin temperature to celsius", () => {
    const parsed = parseUddfString(SAMPLE_UDDF);
    expect(parsed).not.toBeNull();

    const deepest = parsed!.profile.reduce((current, point) =>
      point[1] < current[1] ? point : current,
    );
    expect(deepest[1]).toBe(-5);
    expect(deepest[2]).toBe(10);
  });

  it("returns null for malformed XML", () => {
    expect(parseUddfString("<not>valid</xml")).toBeNull();
  });

  it("returns null when datetime is missing", () => {
    const xml = `
      <uddf>
        <informationbeforedive>
          <divenumber>1</divenumber>
        </informationbeforedive>
        <waypoint><divetime>0</divetime><depth>0</depth></waypoint>
      </uddf>
    `;
    expect(parseUddfString(xml)).toBeNull();
  });

  it("returns null when there are no waypoints", () => {
    const xml = `
      <uddf>
        <informationbeforedive>
          <datetime>2026-01-15T10:30:00Z</datetime>
        </informationbeforedive>
      </uddf>
    `;
    expect(parseUddfString(xml)).toBeNull();
  });
});

describe("normalizeProfilePoints", () => {
  it("trims leading and trailing surface points and starts at time 0", () => {
    const profile: ProfilePoint[] = [
      [0, 0],
      [5, 0],
      [10, -4],
      [20, 0],
      [25, 0],
    ];

    const normalized = normalizeProfilePoints(profile);
    expect(normalized[0]).toEqual([0, 0]);
    expect(normalized.some(([time, depth]) => time === 5 && depth === -4)).toBe(
      true,
    );
    expect(normalized[normalized.length - 1][1]).toBe(0);
  });
});
