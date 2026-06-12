import {
  GROUPING_PRESETS,
  matchingGroupingPreset,
  type GroupingConfig,
  type GroupMode,
  type DateIntervalUnit,
  type TemperatureIncrement,
  type TemperatureMode,
  type DisplayMode,
  type RankCriterion,
  type AggregationMode,
} from "./grouping";

interface GroupingControlsProps {
  config: GroupingConfig;
  onChange: (config: GroupingConfig) => void;
}

function SegmentButtons<T extends string | number>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <div className="segment-buttons">
      {options.map((opt) => (
        <button
          key={String(opt)}
          className={value === opt ? "active" : ""}
          onClick={() => onChange(opt)}
        >
          {labels?.[opt] ?? String(opt)}
        </button>
      ))}
    </div>
  );
}

export default function GroupingControls({
  config,
  onChange,
}: GroupingControlsProps) {
  const update = (patch: Partial<GroupingConfig>) =>
    onChange({ ...config, ...patch });
  const activePreset = matchingGroupingPreset(config);

  return (
    <div className="grouping-controls">
      <div className="grouping-presets">
        <span className="grouping-label">Presets</span>
        <ul className="grouping-preset-list">
          {GROUPING_PRESETS.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                className={`preset-${preset.id}${activePreset?.id === preset.id ? " active" : ""}`}
                onClick={() => onChange(preset.config)}
              >
                {preset.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="grouping-manual">
        <div className="grouping-row">
          <span className="grouping-label">Group by</span>
          <SegmentButtons<GroupMode>
            options={[
              "none",
              "discipline",
              "dateInterval",
              "weight",
              "exposureSuit",
              "temperature",
            ]}
            value={config.groupMode}
            onChange={(groupMode) =>
              update({
                groupMode,
                ...(groupMode === "none" ? { aggregationMode: "none" } : {}),
              })
            }
            labels={{
              none: "None",
              dateInterval: "Date interval",
              discipline: "Discipline",
              weight: "Weight",
              exposureSuit: "Exposure suit",
              temperature: "Temperature",
            }}
          />
        </div>

        {config.groupMode === "dateInterval" && (
          <div className="grouping-row">
            <span className="grouping-label">Interval</span>
            <SegmentButtons<DateIntervalUnit>
              options={["month", "quarter", "year"]}
              value={config.dateIntervalUnit}
              onChange={(dateIntervalUnit) => update({ dateIntervalUnit })}
              labels={{ month: "Month", quarter: "Quarter", year: "Year" }}
            />
          </div>
        )}

        {config.groupMode === "temperature" && (
          <>
            <div className="grouping-row">
              <span className="grouping-label">Increment</span>
              <SegmentButtons<TemperatureIncrement>
                options={[1, 5, 10]}
                value={config.temperatureIncrement}
                onChange={(temperatureIncrement) =>
                  update({ temperatureIncrement })
                }
                labels={{ 1: "1°C", 5: "5°C", 10: "10°C" }}
              />
            </div>
            <div className="grouping-row">
              <span className="grouping-label">Mode</span>
              <SegmentButtons<TemperatureMode>
                options={["max", "min", "difference"]}
                value={config.temperatureMode}
                onChange={(temperatureMode) => update({ temperatureMode })}
                labels={{
                  max: "Max",
                  min: "Min",
                  difference: "Difference",
                }}
              />
            </div>
          </>
        )}

        {config.groupMode !== "none" && (
          <div className="grouping-row">
            <span className="grouping-label">Aggregation</span>
            <SegmentButtons<AggregationMode>
              options={["none", "distance", "duration"]}
              value={config.aggregationMode}
              onChange={(aggregationMode) => update({ aggregationMode })}
              labels={{
                none: "None",
                distance: "Distance",
                duration: "Duration",
              }}
            />
          </div>
        )}

        {config.groupMode !== "none" && config.aggregationMode === "none" && (
          <>
            <div className="grouping-row">
              <span className="grouping-label">Display</span>
              <SegmentButtons<DisplayMode>
                options={["average", "maximum"]}
                value={config.displayMode}
                onChange={(displayMode) => update({ displayMode })}
                labels={{ average: "Average", maximum: "Maximum" }}
              />
            </div>

            {config.displayMode === "maximum" && (
              <div className="grouping-row">
                <span className="grouping-label">Pick</span>
                <SegmentButtons<RankCriterion>
                  options={["longest", "deepest"]}
                  value={config.maximumCriterion}
                  onChange={(maximumCriterion) => update({ maximumCriterion })}
                  labels={{ longest: "Longest", deepest: "Deepest" }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
