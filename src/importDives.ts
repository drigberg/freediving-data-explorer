import type { DiveStore } from "./storage";
import { mergeFitIntoStore, mergeUddfIntoStore } from "./storage";

export interface ImportableFile {
  name: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function isFitFile(name: string): boolean {
  return name.toLowerCase().endsWith(".fit");
}

/**
 * Import one dive log file (.uddf or .fit) into the store.
 */
export async function importDiveFile(
  store: DiveStore,
  file: ImportableFile,
): Promise<{ store: DiveStore; added: number }> {
  if (isFitFile(file.name)) {
    const buffer = await file.arrayBuffer();
    return mergeFitIntoStore(store, buffer);
  }

  const text = await file.text();
  return mergeUddfIntoStore(store, text);
}

/**
 * Import multiple dive log files into the store.
 */
export async function importDiveFiles(
  store: DiveStore,
  files: ImportableFile[],
): Promise<{ store: DiveStore; added: number }> {
  let current = store;
  let totalAdded = 0;

  for (const file of files) {
    const { store: merged, added } = await importDiveFile(current, file);
    current = merged;
    totalAdded += added;
  }

  return { store: current, added: totalAdded };
}
