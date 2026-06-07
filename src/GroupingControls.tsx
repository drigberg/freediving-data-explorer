import type {
  GroupingConfig,
  GroupMode,
  DateIntervalUnit,
  DisplayMode,
  RankCriterion,
} from "./grouping";
import { PERCENTILE_VALUES } from "./grouping";

interface GroupingControlsProps {
  config: GroupingConfig;
  totalSeries: number;
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

function percentileLabel(value: number): string {
  if (value === 100 / 3) return "33⅓%";
  return `${Math.round(value)}%`;
}

export default function GroupingControls({
  config,
  totalSeries,
  onChange,
}: GroupingControlsProps) {
  const update = (patch: Partial<GroupingConfig>) =>
    onChange({ ...config, ...patch });

  const percentileIndex = PERCENTILE_VALUES.indexOf(
    PERCENTILE_VALUES.find((v) => Math.abs(v - config.percentileValue) < 0.01) ??
      PERCENTILE_VALUES[PERCENTILE_VALUES.length - 1]
  );

  return (
    <div className="grouping-controls">
      <div className="grouping-row">
        <span className="grouping-label">Group by</span>
        <SegmentButtons<GroupMode>
          options={["none", "dateInterval", "n", "percentile", "discipline"]}
          value={config.groupMode}
          onChange={(groupMode) => update({ groupMode })}
          labels={{
            none: "None",
            dateInterval: "Date interval",
            n: "N",
            percentile: "Percentile",
            discipline: "Discipline",
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

      {config.groupMode === "n" && (
        <div className="grouping-row">
          <span className="grouping-label">N = {config.nValue}</span>
          <input
            type="range"
            min={1}
            max={totalSeries}
            value={config.nValue}
            onChange={(e) => update({ nValue: Number(e.target.value) })}
            className="grouping-slider"
          />
        </div>
      )}

      {config.groupMode === "percentile" && (
        <>
          <div className="grouping-row">
            <span className="grouping-label">Rank by</span>
            <SegmentButtons<RankCriterion>
              options={["longest", "deepest"]}
              value={config.percentileCriterion}
              onChange={(percentileCriterion) => update({ percentileCriterion })}
              labels={{ longest: "Longest", deepest: "Deepest" }}
            />
          </div>
          <div className="grouping-row">
            <span className="grouping-label">
              Bucket: {percentileLabel(config.percentileValue)}
            </span>
            <input
              type="range"
              min={0}
              max={PERCENTILE_VALUES.length - 1}
              value={percentileIndex}
              onChange={(e) =>
                update({
                  percentileValue: PERCENTILE_VALUES[Number(e.target.value)],
                })
              }
              className="grouping-slider"
            />
          </div>
        </>
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
