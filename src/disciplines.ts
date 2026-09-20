export const SAFETY_CWTB_DISCIPLINE = "Safety (CWTB)";

export const DISCIPLINES = [
  "Free Immersion",
  "No-Fins",
  "Bi-Fins",
  "Mono-Fin",
  "Variable Weight",
  SAFETY_CWTB_DISCIPLINE,
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_ABBREV: Record<string, string> = {
  "Free Immersion": "FI",
  "No-Fins": "CNF",
  "Bi-Fins": "CWTB",
  "Mono-Fin": "CWT",
  "Variable Weight": "VWT",
  [SAFETY_CWTB_DISCIPLINE]: "SAFETY",
};

const DISCIPLINE_CSS_SLUG: Record<string, string> = {
  "Free Immersion": "fi",
  "No-Fins": "cnf",
  "Bi-Fins": "cwtb",
  "Mono-Fin": "cwt",
  "Variable Weight": "vwt",
  [SAFETY_CWTB_DISCIPLINE]: "safety-cwtb",
};

export const DISCIPLINE_COLORS: Record<string, string> = {
  "Free Immersion": "#a371f7",
  "No-Fins": "#3fb950",
  "Bi-Fins": "#58a6ff",
  "Mono-Fin": "#56d4dd",
  "Variable Weight": "#f778ba",
  [SAFETY_CWTB_DISCIPLINE]: "#e3b341",
};

export const UNKNOWN_DISCIPLINE_COLOR = "#8b949e";

export function getDisciplineColor(discipline: string | undefined): string {
  if (!discipline) return UNKNOWN_DISCIPLINE_COLOR;
  return DISCIPLINE_COLORS[discipline] ?? UNKNOWN_DISCIPLINE_COLOR;
}

export function disciplineAbbrev(discipline: string): string {
  return DISCIPLINE_ABBREV[discipline] ?? discipline;
}

export function isSafetyCwtbDiscipline(discipline: string): boolean {
  return discipline === SAFETY_CWTB_DISCIPLINE;
}

export function disciplineTagClass(discipline: string): string {
  const slug = DISCIPLINE_CSS_SLUG[discipline];
  if (!slug) return "dive-discipline";
  if (slug === "safety-cwtb") return "dive-discipline safety-cwtb-discipline";
  return `dive-discipline discipline-${slug}`;
}

export function disciplineDetailClass(discipline: string): string {
  const slug = DISCIPLINE_CSS_SLUG[discipline];
  if (!slug) return "dive-detail-item";
  if (slug === "safety-cwtb") return "dive-detail-item safety-cwtb-discipline";
  return `dive-detail-item discipline-${slug}`;
}

export function disciplineOptionClass(discipline: string): string {
  const slug = DISCIPLINE_CSS_SLUG[discipline];
  if (!slug) return "tag-option";
  if (slug === "safety-cwtb") return "tag-option safety-cwtb-option";
  return `tag-option discipline-${slug}`;
}

export function disciplineFilterChipClass(discipline: string): string {
  const slug = DISCIPLINE_CSS_SLUG[discipline];
  if (!slug) return "";
  if (slug === "safety-cwtb") return "discipline-safety-cwtb";
  return `discipline-${slug}`;
}

export function sortDisciplinesForFilter(disciplines: string[]): string[] {
  const other = disciplines.filter((d) => !isSafetyCwtbDiscipline(d));
  const safety = disciplines.filter((d) => isSafetyCwtbDiscipline(d));
  return [...other, ...safety];
}
