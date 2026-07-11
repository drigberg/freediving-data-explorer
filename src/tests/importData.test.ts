import { describe, expect, it } from "vitest";
import { importDataFile } from "../importData";
import { emptyStore, parseStoreFromJson } from "../storage";
import {
  makeImportableFile,
  readFixtureText,
} from "./fixtures/loadFixture";

const SAMPLE_STORE = readFixtureText("sample-store.json");

describe("parseStoreFromJson", () => {
  it("parses a valid exported store", () => {
    const store = parseStoreFromJson(SAMPLE_STORE);

    expect(store.dives).toHaveLength(1);
    expect(store.dives[0].datetime).toBe("2026-01-15T10:30:00Z");
    expect(store.dives[0].diveNumber).toBe(1);
    expect(store.dives[0].discipline).toBe("Free Immersion");
    expect(store.tags).toHaveLength(1);
    expect(store.tags[0].name).toBe("Pool session");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStoreFromJson("{not json")).toThrow("Invalid JSON");
  });

  it("throws when dives or tags are missing", () => {
    expect(() => parseStoreFromJson('{"dives":[]}')).toThrow(
      "Invalid data.json format",
    );
    expect(() => parseStoreFromJson('{"tags":[]}')).toThrow(
      "Invalid data.json format",
    );
  });

  it("throws when a dive is missing required fields", () => {
    expect(() =>
      parseStoreFromJson(
        JSON.stringify({
          dives: [{ datetime: "2026-01-15T10:30:00Z" }],
          tags: [],
        }),
      ),
    ).toThrow("Invalid data.json format");
  });

  it("migrates legacy date/label dives", () => {
    const store = parseStoreFromJson(
      JSON.stringify({
        dives: [
          {
            date: "2026-01-15",
            label: "42",
            profile: [[0, 0], [10, -5]],
          },
        ],
        tags: [],
      }),
    );

    expect(store.dives[0].datetime).toBe("2026-01-15T00:00:00Z");
    expect(store.dives[0].diveNumber).toBe(0);
  });

  it("parses an empty store", () => {
    const store = parseStoreFromJson(JSON.stringify(emptyStore()));

    expect(store.dives).toHaveLength(0);
    expect(store.tags).toHaveLength(0);
  });
});

describe("importDataFile", () => {
  it("reads a .json file and returns a prepared store", async () => {
    const file = makeImportableFile("data.json", SAMPLE_STORE);
    const store = await importDataFile(file);

    expect(store.dives).toHaveLength(1);
    expect(store.tags).toHaveLength(1);
  });

  it("rejects non-.json files", async () => {
    const file = makeImportableFile("data.txt", SAMPLE_STORE);

    await expect(importDataFile(file)).rejects.toThrow("Expected a .json file");
  });
});
