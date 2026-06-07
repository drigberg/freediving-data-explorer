export const SAFETY_DYNB_DISCIPLINE = "Safety (DYNB)";

export const DISCIPLINES = [
  "Free Immersion",
  "No-Fins",
  "Bi-Fins",
  "Mono-Fin",
  SAFETY_DYNB_DISCIPLINE,
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_ABBREV: Record<string, string> = {
  "Free Immersion": "FI",
  "No-Fins": "CNF",
  "Bi-Fins": "CWTB",
  "Mono-Fin": "CWT",
  [SAFETY_DYNB_DISCIPLINE]: "SAFETY",
};

export function disciplineAbbrev(discipline: string): string {
  return DISCIPLINE_ABBREV[discipline] ?? discipline;
}

export function isSafetyDynbDiscipline(discipline: string): boolean {
  return discipline === SAFETY_DYNB_DISCIPLINE;
}

export function sortDisciplinesForFilter(disciplines: string[]): string[] {
  const other = disciplines.filter((d) => !isSafetyDynbDiscipline(d));
  const safety = disciplines.filter((d) => isSafetyDynbDiscipline(d));
  return [...other, ...safety];
}
