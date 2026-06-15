export const SAFETY_DYNB_DISCIPLINE = "Safety (DYNB)";

export const DISCIPLINES = [
  "Free Immersion",
  "No-Fins",
  "Bi-Fins",
  "Mono-Fin",
  "Variable Weight",
  SAFETY_DYNB_DISCIPLINE,
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_ABBREV: Record<string, string> = {
  "Free Immersion": "FI",
  "No-Fins": "CNF",
  "Bi-Fins": "CWTB",
  "Mono-Fin": "CWT",
  "Variable Weight": "VWT",
  [SAFETY_DYNB_DISCIPLINE]: "SAFETY",
};

const DISCIPLINE_CSS_SLUG: Record<string, string> = {
  "Free Immersion": "fi",
  "No-Fins": "cnf",
  "Bi-Fins": "cwtb",
  "Mono-Fin": "cwt",
  "Variable Weight": "vwt",
  [SAFETY_DYNB_DISCIPLINE]: "safety-dynb",
};

export function disciplineAbbrev(discipline: string): string {
  return DISCIPLINE_ABBREV[discipline] ?? discipline;
}

export function isSafetyDynbDiscipline(discipline: string): boolean {
  return discipline === SAFETY_DYNB_DISCIPLINE;
}

export function disciplineTagClass(discipline: string): string {
  const slug = DISCIPLINE_CSS_SLUG[discipline];
  if (!slug) return "dive-discipline";
  if (slug === "safety-dynb") return "dive-discipline safety-dynb-discipline";
  return `dive-discipline discipline-${slug}`;
}

export function disciplineDetailClass(discipline: string): string {
  const slug = DISCIPLINE_CSS_SLUG[discipline];
  if (!slug) return "dive-detail-item";
  if (slug === "safety-dynb") return "dive-detail-item safety-dynb-discipline";
  return `dive-detail-item discipline-${slug}`;
}

export function disciplineOptionClass(discipline: string): string {
  const slug = DISCIPLINE_CSS_SLUG[discipline];
  if (!slug) return "tag-option";
  if (slug === "safety-dynb") return "tag-option safety-dynb-option";
  return `tag-option discipline-${slug}`;
}

export function disciplineFilterChipClass(discipline: string): string {
  const slug = DISCIPLINE_CSS_SLUG[discipline];
  if (!slug) return "";
  if (slug === "safety-dynb") return "discipline-safety-dynb";
  return `discipline-${slug}`;
}

export function sortDisciplinesForFilter(disciplines: string[]): string[] {
  const other = disciplines.filter((d) => !isSafetyDynbDiscipline(d));
  const safety = disciplines.filter((d) => isSafetyDynbDiscipline(d));
  return [...other, ...safety];
}
