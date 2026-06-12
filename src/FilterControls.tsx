import { disciplineAbbrev } from "./disciplines";
import type { DiveFilterConfig, DiveFilterOptions } from "./filters";
import { defaultDiveFilters, hasActiveFilters } from "./filters";

interface FilterControlsProps {
  filters: DiveFilterConfig;
  options: DiveFilterOptions;
  visibleCount: number;
  totalCount: number;
  onChange: (filters: DiveFilterConfig) => void;
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function parseNullableInt(value: string): number | null {
  if (value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function FilterChips({
  values,
  selected,
  onToggle,
  formatLabel,
}: {
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  formatLabel?: (value: string) => string;
}) {
  if (values.length === 0) return null;

  return (
    <div className="filter-chips">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className={selected.includes(value) ? "active" : ""}
          onClick={() => onToggle(value)}
        >
          {formatLabel ? formatLabel(value) : value}
        </button>
      ))}
    </div>
  );
}

export default function FilterControls({
  filters,
  options,
  visibleCount,
  totalCount,
  onChange,
}: FilterControlsProps) {
  const update = (patch: Partial<DiveFilterConfig>) =>
    onChange({ ...filters, ...patch });

  const active = hasActiveFilters(filters);

  return (
    <div className="filter-controls">
      <div className="filter-main">
        <div className="filter-row">
          <span className="grouping-label">Filter</span>
          {options.disciplines.length > 0 && (
            <>
              <span className="filter-sublabel">Discipline</span>
              <FilterChips
                values={options.disciplines}
                selected={filters.disciplines}
                onToggle={(discipline) =>
                  update({
                    disciplines: toggleValue(filters.disciplines, discipline),
                  })
                }
                formatLabel={disciplineAbbrev}
              />
            </>
          )}
          {options.weights.length > 0 && (
            <>
              <span className="filter-sublabel">Weight</span>
              <FilterChips
                values={options.weights.map(String)}
                selected={filters.weights.map(String)}
                onToggle={(weight) =>
                  update({
                    weights: toggleValue(filters.weights, Number(weight)),
                  })
                }
                formatLabel={(weight) => `${weight}kg`}
              />
            </>
          )}
          {options.exposureSuits.length > 0 && (
            <>
              <span className="filter-sublabel">Exposure suit</span>
              <FilterChips
                values={options.exposureSuits}
                selected={filters.exposureSuits}
                onToggle={(suit) =>
                  update({
                    exposureSuits: toggleValue(filters.exposureSuits, suit),
                  })
                }
              />
            </>
          )}
        </div>

        {(options.dateMin || options.dateMax) && (
          <div className="filter-row">
            <span className="filter-sublabel">Date</span>
            <input
              type="date"
              className="filter-date-input"
              min={options.dateMin || undefined}
              max={options.dateMax || undefined}
              value={filters.dateFrom ?? ""}
              onChange={(e) => update({ dateFrom: e.target.value || null })}
              aria-label="From date"
            />
            <span className="filter-date-separator">to</span>
            <input
              type="date"
              className="filter-date-input"
              min={options.dateMin || undefined}
              max={options.dateMax || undefined}
              value={filters.dateTo ?? ""}
              onChange={(e) => update({ dateTo: e.target.value || null })}
              aria-label="To date"
            />
          </div>
        )}

        <div className="filter-row">
          <span className="filter-sublabel">Duration (s)</span>
          <input
            type="number"
            className="filter-number-input"
            min={options.durationMin}
            max={options.durationMax}
            step={1}
            value={filters.duration.min ?? ""}
            onChange={(e) =>
              update({
                duration: {
                  ...filters.duration,
                  min: parseNullableInt(e.target.value),
                },
              })
            }
            aria-label="Minimum duration in seconds"
            placeholder="Min"
          />
          <span className="filter-date-separator">to</span>
          <input
            type="number"
            className="filter-number-input"
            min={options.durationMin}
            max={options.durationMax}
            step={1}
            value={filters.duration.max ?? ""}
            onChange={(e) =>
              update({
                duration: {
                  ...filters.duration,
                  max: parseNullableInt(e.target.value),
                },
              })
            }
            aria-label="Maximum duration in seconds"
            placeholder="Max"
          />
        </div>

        <div className="filter-row">
          <span className="filter-sublabel">Max depth (m)</span>
          <input
            type="number"
            className="filter-number-input"
            min={options.maxDepthMin}
            max={options.maxDepthMax}
            step={1}
            value={filters.maxDepth.min ?? ""}
            onChange={(e) =>
              update({
                maxDepth: {
                  ...filters.maxDepth,
                  min: parseNullableInt(e.target.value),
                },
              })
            }
            aria-label="Minimum max depth in meters"
            placeholder="Min"
          />
          <span className="filter-date-separator">to</span>
          <input
            type="number"
            className="filter-number-input"
            min={options.maxDepthMin}
            max={options.maxDepthMax}
            step={1}
            value={filters.maxDepth.max ?? ""}
            onChange={(e) =>
              update({
                maxDepth: {
                  ...filters.maxDepth,
                  max: parseNullableInt(e.target.value),
                },
              })
            }
            aria-label="Maximum max depth in meters"
            placeholder="Max"
          />
        </div>
      </div>

      <div className="filter-actions">
        <span className={`filter-count ${active ? "active" : ""}`}>
          {visibleCount} of {totalCount} dives
        </span>
        <button
          type="button"
          className="filter-clear-btn"
          disabled={!active}
          onClick={() => onChange(defaultDiveFilters())}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
