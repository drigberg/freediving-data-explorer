import type { DiveData } from "./parseData";
import { extractDateKey, formatExposureSuit } from "./parseData";

export interface DiveFilterConfig {
  disciplines: string[];
  weights: number[];
  exposureSuits: string[];
  safeties: boolean[];
  dateFrom: string | null;
  dateTo: string | null;
}

export interface DiveFilterOptions {
  disciplines: string[];
  weights: number[];
  exposureSuits: string[];
  safeties: boolean[];
  dateMin: string;
  dateMax: string;
}

function isSafetyDiveYes(safety: boolean | undefined): boolean {
  return safety === true;
}

function isSafetyDiveNo(safety: boolean | undefined): boolean {
  return !isSafetyDiveYes(safety);
}

export function defaultDiveFilters(): DiveFilterConfig {
  return {
    disciplines: [],
    weights: [],
    exposureSuits: [],
    safeties: [],
    dateFrom: null,
    dateTo: null,
  };
}

export function filterOptionsFromData(data: DiveData): DiveFilterOptions {
  const disciplineSet = new Set<string>();
  const weightSet = new Set<number>();
  const exposureSuitSet = new Set<string>();
  let hasSafetyYes = false;
  let hasSafetyNo = false;
  let dateMin = "";
  let dateMax = "";

  for (let i = 0; i < data.seriesNames.length; i++) {
    const discipline = data.disciplines[i];
    if (discipline) disciplineSet.add(discipline);

    const weight = data.weights[i];
    if (weight !== undefined) weightSet.add(weight);

    const suit = data.exposureSuits[i];
    if (suit) exposureSuitSet.add(formatExposureSuit(suit));

    const safety = data.safeties[i];
    if (isSafetyDiveYes(safety)) hasSafetyYes = true;
    if (isSafetyDiveNo(safety)) hasSafetyNo = true;

    const date = extractDateKey(data.seriesNames[i]);
    if (date) {
      if (!dateMin || date < dateMin) dateMin = date;
      if (!dateMax || date > dateMax) dateMax = date;
    }
  }

  return {
    disciplines: [...disciplineSet],
    weights: [...weightSet].sort((a, b) => a - b),
    exposureSuits: [...exposureSuitSet].sort(),
    safeties: [
      ...(hasSafetyYes ? [true] : []),
      ...(hasSafetyNo ? [false] : []),
    ],
    dateMin,
    dateMax,
  };
}

export function hasActiveFilters(filters: DiveFilterConfig): boolean {
  return (
    filters.disciplines.length > 0 ||
    filters.weights.length > 0 ||
    filters.exposureSuits.length > 0 ||
    filters.safeties.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null
  );
}

export function divePassesFilters(
  data: DiveData,
  index: number,
  filters: DiveFilterConfig
): boolean {
  if (filters.disciplines.length > 0) {
    const discipline = data.disciplines[index];
    if (!discipline || !filters.disciplines.includes(discipline)) {
      return false;
    }
  }

  if (filters.weights.length > 0) {
    const weight = data.weights[index];
    if (weight === undefined || !filters.weights.includes(weight)) {
      return false;
    }
  }

  if (filters.exposureSuits.length > 0) {
    const suit = data.exposureSuits[index];
    if (!suit || !filters.exposureSuits.includes(formatExposureSuit(suit))) {
      return false;
    }
  }

  if (filters.safeties.length > 0) {
    const safety = data.safeties[index];
    const matches =
      (filters.safeties.includes(true) && isSafetyDiveYes(safety)) ||
      (filters.safeties.includes(false) && isSafetyDiveNo(safety));
    if (!matches) return false;
  }

  const date = extractDateKey(data.seriesNames[index]);
  if (filters.dateFrom) {
    if (!date || date < filters.dateFrom) return false;
  }
  if (filters.dateTo) {
    if (!date || date > filters.dateTo) return false;
  }

  return true;
}

export function sliceDiveData(data: DiveData, indices: number[]): DiveData {
  return {
    seriesNames: indices.map((i) => data.seriesNames[i]),
    seriesData: indices.map((i) => data.seriesData[i]),
    disciplines: indices.map((i) => data.disciplines[i]),
    weights: indices.map((i) => data.weights[i]),
    safeties: indices.map((i) => data.safeties[i]),
    exposureSuits: indices.map((i) => data.exposureSuits[i]),
  };
}

export function visibleDiveIndices(
  data: DiveData,
  hiddenDives: Set<number>,
  filters: DiveFilterConfig
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < data.seriesNames.length; i++) {
    if (!hiddenDives.has(i) && divePassesFilters(data, i, filters)) {
      indices.push(i);
    }
  }
  return indices;
}
