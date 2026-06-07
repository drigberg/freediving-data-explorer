import { disciplineAbbrev } from "./disciplines";
import type { DiveFilterConfig, DiveFilterOptions } from "./filters";
import { hasActiveFilters } from "./filters";

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
      </div>

      <div className="filter-actions">
        <span className={`filter-count ${active ? "active" : ""}`}>
          {visibleCount} of {totalCount} dives
        </span>
        <button
          type="button"
          className="filter-clear-btn"
          disabled={!active}
          onClick={() =>
            onChange({
              disciplines: [],
              weights: [],
              exposureSuits: [],
              dateFrom: null,
              dateTo: null,
            })
          }
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
