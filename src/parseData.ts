import Papa from "papaparse";

export interface ExposureSuit {
  openCell: boolean;
  thicknessMm: number;
}

export function formatExposureSuit(suit: ExposureSuit): string {
  const cellType = suit.openCell ? "Open Cell" : "Closed Cell";
  return `${cellType}, ${suit.thicknessMm}mm`;
}

export interface DiveData {
  seriesNames: string[];
  seriesData: [number, number][][];
  disciplines: (string | undefined)[];
  weights: (number | undefined)[];
  safeties: (boolean | undefined)[];
  exposureSuits: (ExposureSuit | undefined)[];
}

const TIME_STEP = 2;

export function extractDateKey(seriesName: string): string | null {
  const match = seriesName.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function ensureTrailingZero(points: [number, number][]): [number, number][] {
  if (points.length > 0 && points[points.length - 1][1] !== 0) {
    return [...points, [points[points.length - 1][0] + TIME_STEP, 0]];
  }
  return points;
}

export function parseCsvString(csv: string): DiveData {
  const result = Papa.parse<Record<string, string | number | null>>(csv, {
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

  return {
    seriesNames,
    seriesData: seriesData.map(ensureTrailingZero),
    disciplines: seriesNames.map(() => undefined),
    weights: seriesNames.map(() => undefined),
    safeties: seriesNames.map(() => undefined),
    exposureSuits: seriesNames.map(() => undefined),
  };
}
