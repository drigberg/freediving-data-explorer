import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));

export function readFixtureText(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

export function readFixtureArrayBuffer(name: string): ArrayBuffer {
  const bytes = readFileSync(path.join(fixturesDir, name));
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

export function makeImportableFile(
  name: string,
  contents: string | ArrayBuffer,
): {
  name: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
} {
  if (typeof contents === "string") {
    return {
      name,
      async text() {
        return contents;
      },
      async arrayBuffer() {
        return new TextEncoder().encode(contents).buffer;
      },
    };
  }

  return {
    name,
    async text() {
      return new TextDecoder().decode(contents);
    },
    async arrayBuffer() {
      const copy = new Uint8Array(contents.byteLength);
      copy.set(new Uint8Array(contents));
      return copy.buffer;
    },
  };
}
