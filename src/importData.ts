import { parseStoreFromJson } from "./storage";
import type { DiveStore } from "./storage";

export interface ImportableJsonFile {
  name: string;
  text(): Promise<string>;
}

function isJsonFile(name: string): boolean {
  return name.toLowerCase().endsWith(".json");
}

/**
 * Import a data.json file (exported DiveStore) and replace the current store.
 */
export async function importDataFile(file: ImportableJsonFile): Promise<DiveStore> {
  if (!isJsonFile(file.name)) {
    throw new Error("Expected a .json file");
  }

  const text = await file.text();
  return parseStoreFromJson(text);
}
