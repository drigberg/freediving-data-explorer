export const DISCIPLINES = [
  "Free Immersion",
  "No-Fins",
  "Bi-Fins",
  "Mono-Fin",
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_ABBREV: Record<string, string> = {
  "Free Immersion": "FI",
  "No-Fins": "CNF",
  "Bi-Fins": "CWTB",
  "Mono-Fin": "CWT",
};

export function disciplineAbbrev(discipline: string): string {
  return DISCIPLINE_ABBREV[discipline] ?? discipline;
}
