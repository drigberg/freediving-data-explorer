export interface ExposureSuit {
  openCell: boolean;
  thicknessMm: number;
}

export function formatExposureSuit(suit: ExposureSuit): string {
  const cellType = suit.openCell ? "Open Cell" : "Closed Cell";
  return `${cellType}, ${suit.thicknessMm}mm`;
}

// Profile point: [timeSeconds, depthMeters (negative), temperatureCelsius?]
export type ProfilePoint = [number, number, number?];

export interface DiveData {
  seriesNames: string[];
  datetimes: string[];
  diveNumbers: number[];
  seriesData: ProfilePoint[][];
  disciplines: (string | undefined)[];
  weights: (number | undefined)[];
  exposureSuits: (ExposureSuit | undefined)[];
}

/** Derive a display-friendly series name from a dive's datetime + diveNumber. */
export function seriesNameFromDive(datetime: string, diveNumber: number): string {
  return `${datetime.slice(0, 10)} #${diveNumber}`;
}

/** Extract the YYYY-MM-DD date portion from a series name (e.g. "2026-02-07 #47"). */
export function extractDateKey(seriesName: string): string | null {
  const match = seriesName.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function getEl(parent: Element | Document, tag: string): Element | null {
  return parent.getElementsByTagName(tag)[0] ?? null;
}

function getText(parent: Element | Document, tag: string): string | null {
  return getEl(parent, tag)?.textContent?.trim() ?? null;
}

function ensureTrailingZero(points: ProfilePoint[]): ProfilePoint[] {
  if (points.length > 0 && points[points.length - 1][1] !== 0) {
    return [...points, [points[points.length - 1][0] + 2, 0]];
  }
  return points;
}

export interface ParsedUddfDive {
  datetime: string;
  diveNumber: number;
  profile: ProfilePoint[];
}

/**
 * Parse a single UDDF XML file string and return the dive's metadata + profile.
 * Returns null if the XML is malformed or the required fields are missing.
 */
export function parseUddfString(xml: string): ParsedUddfDive | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  if (doc.querySelector("parsererror")) return null;

  const infoBefore = getEl(doc, "informationbeforedive");
  if (!infoBefore) return null;

  const datetime = getText(infoBefore, "datetime");
  if (!datetime) return null;

  const diveNumberStr = getText(infoBefore, "divenumber");
  const diveNumber = diveNumberStr ? parseInt(diveNumberStr, 10) : 0;

  const waypoints = doc.getElementsByTagName("waypoint");
  const profile: ProfilePoint[] = [];

  for (const wp of waypoints) {
    const depthStr = getText(wp, "depth");
    const timeStr = getText(wp, "divetime");
    if (depthStr === null || timeStr === null) continue;

    const depth = -parseFloat(depthStr);
    const time = parseInt(timeStr, 10);
    if (isNaN(depth) || isNaN(time)) continue;

    const tempStr = getText(wp, "temperature");
    if (tempStr !== null) {
      const kelvin = parseFloat(tempStr);
      const celsius = Math.round((kelvin - 273.15) * 10) / 10;
      profile.push([time, depth, celsius]);
    } else {
      profile.push([time, depth]);
    }
  }

  if (profile.length === 0) return null;

  return {
    datetime,
    diveNumber,
    profile: ensureTrailingZero(profile),
  };
}
