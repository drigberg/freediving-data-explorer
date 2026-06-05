import Papa from "papaparse";
import csvRaw from "../dive_profiles.csv?raw";

export interface DiveData {
  seriesNames: string[];
  seriesData: [number, number][][];
}

export function parseDiveData(): DiveData {
  const result = Papa.parse<Record<string, string | number | null>>(csvRaw, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  const headers = result.meta.fields ?? [];
  const timeHeader = headers[0];
  const seriesNames = headers.slice(1);

  const seriesData: [number, number][][] = seriesNames.map(() => []);

  for (const row of result.data) {
    const time = row[timeHeader];
    if (typeof time !== "number") continue;

    for (let i = 0; i < seriesNames.length; i++) {
      const depth = row[seriesNames[i]];
      if (typeof depth === "number") {
        seriesData[i].push([time, depth]);
      }
    }
  }

  return { seriesNames, seriesData };
}
