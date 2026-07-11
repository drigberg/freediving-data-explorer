import { describe, expect, it } from "vitest";
import { importDiveFile, importDiveFiles } from "../importDives";
import {
  emptyStore,
  mergeFitIntoStore,
  mergeUddfIntoStore,
} from "../storage";
import {
  makeImportableFile,
  readFixtureArrayBuffer,
  readFixtureText,
} from "./fixtures/loadFixture";

const SAMPLE_UDDF = readFixtureText("sample.uddf");
const FIT_FIXTURE = readFixtureArrayBuffer("overbetuwe-apnea.fit");

describe("mergeUddfIntoStore", () => {
  it("adds a parsed UDDF dive to the store", () => {
    const { store, added } = mergeUddfIntoStore(emptyStore(), SAMPLE_UDDF);

    expect(added).toBe(1);
    expect(store.dives).toHaveLength(1);
    expect(store.dives[0].datetime).toBe("2026-01-15T10:30:00Z");
    expect(store.dives[0].diveNumber).toBe(42);
    expect(store.dives[0].profile.length).toBeGreaterThan(0);
  });

  it("deduplicates dives by datetime", () => {
    const first = mergeUddfIntoStore(emptyStore(), SAMPLE_UDDF);
    const second = mergeUddfIntoStore(first.store, SAMPLE_UDDF);

    expect(second.added).toBe(0);
    expect(second.store.dives).toHaveLength(1);
  });

  it("ignores invalid UDDF without changing the store", () => {
    const { store, added } = mergeUddfIntoStore(emptyStore(), "<invalid");

    expect(added).toBe(0);
    expect(store.dives).toHaveLength(0);
  });
});

describe("mergeFitIntoStore", () => {
  it("adds all dives from a multi-lap FIT session", async () => {
    const { store, added } = await mergeFitIntoStore(emptyStore(), FIT_FIXTURE);

    expect(added).toBe(3);
    expect(store.dives).toHaveLength(3);
    expect(store.dives.map((dive) => dive.datetime)).toEqual([
      "2026-06-27T14:15:31.000Z",
      "2026-06-27T14:19:23.000Z",
      "2026-06-27T14:25:16.000Z",
    ]);
  });

  it("deduplicates FIT dives by datetime on re-import", async () => {
    const first = await mergeFitIntoStore(emptyStore(), FIT_FIXTURE);
    const second = await mergeFitIntoStore(first.store, FIT_FIXTURE);

    expect(second.added).toBe(0);
    expect(second.store.dives).toHaveLength(3);
  });
});

describe("importDiveFiles", () => {
  it("routes files by extension and accumulates additions", async () => {
    const uddfFile = makeImportableFile("session.uddf", SAMPLE_UDDF);
    const fitFile = makeImportableFile("session.fit", FIT_FIXTURE);

    const { store, added } = await importDiveFiles(emptyStore(), [
      uddfFile,
      fitFile,
    ]);

    expect(added).toBe(4);
    expect(store.dives).toHaveLength(4);
  });

  it("imports FIT files with uppercase extensions", async () => {
    const fitFile = makeImportableFile("session.FIT", FIT_FIXTURE);
    const { added } = await importDiveFile(emptyStore(), fitFile);

    expect(added).toBe(3);
  });

  it("treats non-.fit files as UDDF XML", async () => {
    const uddfFile = makeImportableFile("log.uddf", SAMPLE_UDDF);
    const { added } = await importDiveFile(emptyStore(), uddfFile);

    expect(added).toBe(1);
  });
});
