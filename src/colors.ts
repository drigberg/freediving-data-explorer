const HUE_START = 30; // orange
const HUE_END = 180; // cyan

function seriesHue(index: number, total: number): number {
  return total <= 1
    ? HUE_END
    : HUE_START + (index / (total - 1)) * (HUE_END - HUE_START);
}

export function getSeriesColor(index: number, total: number): string {
  return `hsl(${seriesHue(index, total)}, 100%, 50%)`;
}

export function getSeriesColorRgba(
  index: number,
  total: number,
  alpha: number,
): string {
  return `hsla(${seriesHue(index, total)}, 100%, 50%, ${alpha})`;
}

/**
 * Computes opacity based on distance from the active series index.
 * Active series = 1.0, farthest series = 0.2 (minimum).
 */
export function getSeriesOpacity(
  index: number,
  activeIndex: number,
  total: number,
): number {
  if (total <= 1) return 1.0;
  const distance = Math.abs(index - activeIndex);
  const stepSize = Math.min(0.1, 0.8 / (total - 1));
  return Math.max(0.2, 1.0 - distance * stepSize);
}

/**
 * Extracts the short date label from a series name like
 * "YYYY-MM-DD (Water temp: 19C [indoor])" -> "Feb 7".
 */
export function shortDateLabel(seriesName: string): string {
  const match = seriesName.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return seriesName;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  return `${months[monthIdx]} ${day}`;
}

export function shortDiveLabel(seriesName: string, diveNumber: number): string {
  const date = shortDateLabel(seriesName);
  if (diveNumber > 0) return `${date} #${diveNumber}`;
  return date;
}
