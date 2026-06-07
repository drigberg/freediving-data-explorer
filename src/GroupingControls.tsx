import type {
  GroupingConfig,
  GroupMode,
  DateIntervalUnit,
  DisplayMode,
  RankCriterion,
} from "./grouping";

interface GroupingControlsProps {
  config: GroupingConfig;
  onChange: (config: GroupingConfig) => void;
}

function SegmentButtons<T extends string>({
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
          key={opt}
          className={value === opt ? "active" : ""}
          onClick={() => onChange(opt)}
        >
          {labels?.[opt] ?? opt}
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

  return (
    <div className="grouping-controls">
      <div className="grouping-row">
        <span className="grouping-label">Group by</span>
        <SegmentButtons<GroupMode>
          options={[
            "none",
            "discipline",
            "dateInterval",
            "weight",
            "exposureSuit",
          ]}
          value={config.groupMode}
          onChange={(groupMode) => update({ groupMode })}
          labels={{
            none: "None",
            dateInterval: "Date interval",
            discipline: "Discipline",
            weight: "Weight",
            exposureSuit: "Exposure suit",
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

      {config.groupMode !== "none" && (
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
  );
}
