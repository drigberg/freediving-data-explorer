import {
  Fragment,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { shortDateLabel } from "./colors";
import { formatDuration, getDiveStats } from "./diveStats";
import TagDialog from "./TagDialog";
import DisciplineDialog from "./DisciplineDialog";
import WeightDialog from "./WeightDialog";
import ExposureSuitDialog from "./ExposureSuitDialog";
import EditDialog from "./AddTagDialog";
import {
  disciplineAbbrev,
  disciplineDetailClass,
  disciplineTagClass,
} from "./disciplines";
import type { ExposureSuit, ProfilePoint } from "./parseData";
import { extractDateKey, formatExposureSuit } from "./parseData";
import {
  divePassesFilters,
  hasActiveFilters,
  type DiveFilterConfig,
} from "./filters";
import type { GroupingConfig, Tag } from "./grouping";

interface SidebarProps {
  seriesNames: string[];
  diveNumbers: number[];
  seriesData: ProfilePoint[][];
  disciplines: (string | undefined)[];
  weights: (number | undefined)[];
  exposureSuits: (ExposureSuit | undefined)[];
  archived?: boolean[];
  hiddenDives: Set<number>;
  activeDiveIndex: number | null;
  onDiveActivate: (index: number) => void;
  onToggleVisibility: (index: number) => void;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onDisciplinesAssign: (indices: number[], discipline: string) => void;
  onWeightAssign: (indices: number[], weightKg: number) => void;
  onExposureSuitAssign: (indices: number[], suit: ExposureSuit) => void;
  onArchiveDive: (index: number) => void;
  diveFilters: DiveFilterConfig;
  groupingConfig: GroupingConfig;
  diveListExpanded: boolean;
  onToggleDiveListExpanded: () => void;
  showArchivedDives: boolean;
  onShowArchivedDivesChange: (checked: boolean) => void;
}

type AssignMode =
  | { kind: "tag"; name: string }
  | { kind: "discipline"; value: string }
  | { kind: "weight"; value: number }
  | { kind: "exposureSuit"; value: ExposureSuit };

function assignModeDescription(mode: AssignMode): {
  action: string;
  label: string;
} {
  switch (mode.kind) {
    case "tag":
      return { action: "tag with", label: mode.name };
    case "discipline":
      return { action: "assign discipline", label: mode.value };
    case "weight":
      return { action: "assign weight", label: `${mode.value}kg` };
    case "exposureSuit":
      return {
        action: "assign exposure suit",
        label: formatExposureSuit(mode.value),
      };
  }
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PanelRightOpenIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
      <path d="m10 9 3 3-3 3" />
    </svg>
  );
}

function PanelRightCloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
      <path d="m14 9-3 3 3 3" />
    </svg>
  );
}

function formatDiveNumber(diveNumber: number): string {
  return diveNumber > 0 ? `#${diveNumber}` : "#?";
}

type DateGroup = { dateKey: string; dateLabel: string; indices: number[] };
type YearGroup = { year: string; dateGroups: DateGroup[] };

function groupIndicesByYearAndDate(
  indices: number[],
  seriesNames: string[],
): YearGroup[] {
  const yearGroups: YearGroup[] = [];

  for (const i of indices) {
    const dateKey = extractDateKey(seriesNames[i]) ?? "Unknown";
    const year = dateKey.slice(0, 4);
    let yearGroup = yearGroups[yearGroups.length - 1];

    if (yearGroup?.year !== year) {
      yearGroup = { year, dateGroups: [] };
      yearGroups.push(yearGroup);
    }

    let dateGroup = yearGroup.dateGroups[yearGroup.dateGroups.length - 1];
    if (dateGroup?.dateKey !== dateKey) {
      dateGroup = {
        dateKey,
        dateLabel: shortDateLabel(seriesNames[i]),
        indices: [],
      };
      yearGroup.dateGroups.push(dateGroup);
    }

    dateGroup.indices.push(i);
  }

  return yearGroups;
}

export default function Sidebar({
  seriesNames,
  diveNumbers,
  seriesData,
  disciplines,
  weights,
  exposureSuits,
  archived,
  hiddenDives,
  activeDiveIndex,
  onDiveActivate,
  onToggleVisibility,
  tags,
  onTagsChange,
  onDisciplinesAssign,
  onWeightAssign,
  onExposureSuitAssign,
  onArchiveDive,
  diveFilters,
  groupingConfig,
  diveListExpanded,
  onToggleDiveListExpanded,
  showArchivedDives,
  onShowArchivedDivesChange,
}: SidebarProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showDisciplineDialog, setShowDisciplineDialog] = useState(false);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showExposureSuitDialog, setShowExposureSuitDialog] = useState(false);
  const [expandedDives, setExpandedDives] = useState<Set<number>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const diveListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeDiveIndex == null) return;
    if (diveListExpanded || groupingConfig.groupMode !== "none") return;

    const dateKey = extractDateKey(seriesNames[activeDiveIndex]);
    if (dateKey) {
      setCollapsedDates((prev) => {
        if (!prev.has(dateKey)) return prev;
        const next = new Set(prev);
        next.delete(dateKey);
        return next;
      });
    }

    setExpandedDives((prev) => new Set(prev).add(activeDiveIndex));

    const timeoutId = window.setTimeout(() => {
      requestAnimationFrame(() => {
        diveListRef.current
          ?.querySelector(`[data-dive-index="${activeDiveIndex}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeDiveIndex,
    diveListExpanded,
    groupingConfig.groupMode,
    seriesNames,
  ]);

  const toggleDateCollapsed = useCallback((dateKey: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback(
    (index: number) => {
      if (!expandedDives.has(index)) {
        onDiveActivate(index);
      }
      setExpandedDives((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    },
    [expandedDives, onDiveActivate],
  );

  const [assignMode, setAssignMode] = useState<AssignMode | null>(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const lastClickedRef = useRef<number | null>(null);

  const inSelectMode = assignMode !== null;

  const startAssignMode = useCallback((mode: AssignMode) => {
    setAssignMode(mode);
    setSelection(new Set());
    lastClickedRef.current = null;
  }, []);

  const handleCreateTag = useCallback(
    (name: string) => {
      const existing = tags.find((t) => t.name === name);
      if (existing) {
        startAssignMode({ kind: "tag", name });
        setSelection(new Set(existing.diveIndices));
      } else {
        onTagsChange([...tags, { name, diveIndices: new Set() }]);
        startAssignMode({ kind: "tag", name });
      }
      setShowTagDialog(false);
    },
    [tags, onTagsChange, startAssignMode],
  );

  const handleSelectTag = useCallback(
    (name: string) => {
      const tag = tags.find((t) => t.name === name);
      startAssignMode({ kind: "tag", name });
      setSelection(new Set(tag?.diveIndices ?? []));
      setShowTagDialog(false);
    },
    [tags, startAssignMode],
  );

  const handleDone = useCallback(() => {
    if (!assignMode) return;

    const indices = [...selection];
    switch (assignMode.kind) {
      case "tag":
        onTagsChange(
          tags.map((t) =>
            t.name === assignMode.name
              ? { ...t, diveIndices: new Set(selection) }
              : t,
          ),
        );
        break;
      case "discipline":
        onDisciplinesAssign(indices, assignMode.value);
        break;
      case "weight":
        onWeightAssign(indices, assignMode.value);
        break;
      case "exposureSuit":
        onExposureSuitAssign(indices, assignMode.value);
        break;
    }

    setAssignMode(null);
    setSelection(new Set());
    lastClickedRef.current = null;
  }, [
    assignMode,
    selection,
    tags,
    onTagsChange,
    onDisciplinesAssign,
    onWeightAssign,
    onExposureSuitAssign,
  ]);

  const handleCancel = useCallback(() => {
    setAssignMode(null);
    setSelection(new Set());
    lastClickedRef.current = null;
  }, []);

  const tagsByDive = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const tag of tags) {
      for (const idx of tag.diveIndices) {
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(tag.name);
      }
    }
    return map;
  }, [tags]);

  const handleSelectionClick = useCallback(
    (index: number, shiftKey: boolean) => {
      setSelection((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClickedRef.current !== null) {
          const from = Math.min(lastClickedRef.current, index);
          const to = Math.max(lastClickedRef.current, index);
          for (let i = from; i <= to; i++) {
            next.add(i);
          }
        } else {
          if (next.has(index)) {
            next.delete(index);
          } else {
            next.add(index);
          }
        }
        lastClickedRef.current = index;
        return next;
      });
    },
    [],
  );

  const backToEdit = useCallback(() => {
    setShowEditDialog(true);
  }, []);

  const diveData = useMemo(
    () => ({
      seriesNames,
      datetimes: [] as string[],
      diveNumbers: [] as number[],
      seriesData,
      disciplines,
      weights,
      exposureSuits,
    }),
    [seriesNames, seriesData, disciplines, weights, exposureSuits],
  );

  const { includedGroups, excludedGroups } = useMemo(() => {
    const filtering = hasActiveFilters(diveFilters);
    const included: number[] = [];
    const excluded: number[] = [];

    for (const i of [...seriesNames.keys()].reverse()) {
      if (divePassesFilters(diveData, i, diveFilters)) {
        included.push(i);
      } else if (filtering) {
        excluded.push(i);
      }
    }

    return {
      includedGroups: groupIndicesByYearAndDate(included, seriesNames),
      excludedGroups: filtering
        ? groupIndicesByYearAndDate(excluded, seriesNames)
        : [],
    };
  }, [seriesNames, diveData, diveFilters]);

  const renderDiveEntry = (i: number, excluded: boolean) => {
    const isHidden = hiddenDives.has(i);
    const isSelected = selection.has(i);
    const discipline = disciplines[i];
    const disciplineClass = discipline ? disciplineTagClass(discipline) : "";
    const mutedClass = excluded ? " filter-excluded" : "";
    const points = seriesData[i];
    const { maxDepth, duration, maxTemp, minTemp } = getDiveStats(points);
    const summary = `${formatDiveNumber(diveNumbers[i])} (${maxDepth.toFixed(1)}m)`;

    if (inSelectMode) {
      return (
        <li
          key={i}
          data-dive-index={i}
          className={`sidebar-dive-item tagging${mutedClass} ${isSelected ? "selected" : ""}`}
          onClick={(e) => handleSelectionClick(i, e.shiftKey)}
        >
          <span className="tag-checkbox">{isSelected ? "✓" : ""}</span>
          <span className="dive-summary">{summary}</span>
          {discipline && (
            <span className={disciplineClass}>
              {disciplineAbbrev(discipline)}
            </span>
          )}
        </li>
      );
    }

    const diveTags = tagsByDive.get(i) ?? [];
    const isExpanded = expandedDives.has(i);
    const weight = weights[i];
    const exposureSuit = exposureSuits[i];

    return (
      <li
        key={i}
        data-dive-index={i}
        className={`sidebar-dive-entry${mutedClass} ${isExpanded ? "expanded" : ""}`}
      >
        <div className={`sidebar-dive-item${mutedClass}`}>
          <button
            className={`visibility-toggle ${isHidden ? "hidden-dive" : ""}`}
            onClick={() => onToggleVisibility(i)}
            title={isHidden ? "Show dive" : "Hide dive"}
          >
            <EyeIcon open={!isHidden} />
          </button>
          <span
            className="dive-summary clickable"
            onClick={() => toggleExpanded(i)}
          >
            {summary}
          </span>
          <div className="dive-item-right">
            {discipline && (
              <span className={disciplineClass}>
                {disciplineAbbrev(discipline)}
              </span>
            )}
            <span className="dive-chevron" onClick={() => toggleExpanded(i)}>
              <ChevronIcon open={isExpanded} />
            </span>
          </div>
        </div>
        {isExpanded && (
          <ul className="dive-details">
            <li className="dive-detail-item">
              Max depth: {maxDepth.toFixed(1)}m
            </li>
            <li className="dive-detail-item">
              Duration: {formatDuration(duration)}
            </li>
            {discipline && (
              <li className={disciplineDetailClass(discipline)}>
                Discipline: {discipline}
              </li>
            )}
            {maxTemp !== undefined && (
              <li className="dive-detail-item">
                Max temperature: {maxTemp.toFixed(1)}°C
              </li>
            )}
            {minTemp !== undefined && (
              <li className="dive-detail-item">
                Min temperature: {minTemp.toFixed(1)}°C
              </li>
            )}
            {weight !== undefined && (
              <li className="dive-detail-item">Weight: {weight}kg</li>
            )}
            {exposureSuit && (
              <li className="dive-detail-item">
                Exposure Suit: {formatExposureSuit(exposureSuit)}
              </li>
            )}
            {diveTags.map((tagName) => (
              <li key={tagName} className="dive-detail-item">
                {tagName}
              </li>
            ))}
            <li className="dive-detail-actions">
              <button
                type="button"
                className="dive-archive-btn"
                onClick={() => onArchiveDive(i)}
              >
                Archive
              </button>
            </li>
          </ul>
        )}
      </li>
    );
  };

  const flattenGroupIndices = useCallback(
    (groups: YearGroup[]) =>
      groups.flatMap((group) =>
        group.dateGroups.flatMap((dateGroup) => dateGroup.indices),
      ),
    [],
  );

  const includedIndices = useMemo(
    () => flattenGroupIndices(includedGroups),
    [flattenGroupIndices, includedGroups],
  );

  const excludedIndices = useMemo(
    () => flattenGroupIndices(excludedGroups),
    [excludedGroups, flattenGroupIndices],
  );

  useEffect(() => {
    if (activeDiveIndex == null || !diveListExpanded) return;

    const timeoutId = window.setTimeout(() => {
      requestAnimationFrame(() => {
        diveListRef.current
          ?.querySelector(`[data-dive-index="${activeDiveIndex}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeDiveIndex, diveListExpanded]);

  const renderDiveTableRow = (i: number, excluded: boolean) => {
    const isHidden = hiddenDives.has(i);
    const isSelected = selection.has(i);
    const isActive = activeDiveIndex === i;
    const isArchived = archived?.[i] === true;
    const discipline = disciplines[i];
    const disciplineClass = discipline ? disciplineTagClass(discipline) : "";
    const mutedClass = excluded ? " filter-excluded" : "";
    const points = seriesData[i];
    const { maxDepth, duration, maxTemp, minTemp } = getDiveStats(points);
    const weight = weights[i];
    const exposureSuit = exposureSuits[i];
    const diveTags = tagsByDive.get(i) ?? [];
    const dateLabel = shortDateLabel(seriesNames[i]);
    if (inSelectMode) {
      return (
        <tr
          key={i}
          data-dive-index={i}
          className={`sidebar-dive-table-row tagging${mutedClass}${isArchived ? " archived" : ""} ${isSelected ? "selected" : ""}`}
          onClick={(e) => handleSelectionClick(i, e.shiftKey)}
        >
          <td className="sidebar-dive-table-checkbox">
            <span className="tag-checkbox">{isSelected ? "✓" : ""}</span>
          </td>
          <td>{formatDiveNumber(diveNumbers[i])}</td>
          <td>{dateLabel}</td>
          <td>
            {discipline ? (
              <span className={disciplineClass}>
                {disciplineAbbrev(discipline)}
              </span>
            ) : (
              "—"
            )}
          </td>
          <td>{Math.abs(maxDepth).toFixed(1)}m</td>
          <td>{formatDuration(duration)}</td>
          <td>{maxTemp !== undefined ? `${maxTemp.toFixed(1)}°C` : "—"}</td>
          <td>{minTemp !== undefined ? `${minTemp.toFixed(1)}°C` : "—"}</td>
          <td>{weight !== undefined ? `${weight}kg` : "—"}</td>
          <td>{exposureSuit ? formatExposureSuit(exposureSuit) : "—"}</td>
          <td>{diveTags.length > 0 ? diveTags.join(", ") : "—"}</td>
        </tr>
      );
    }

    return (
      <tr
        key={i}
        data-dive-index={i}
        className={`sidebar-dive-table-row${mutedClass}${isActive ? " active" : ""}${isHidden ? " hidden-dive-row" : ""}${isArchived ? " archived" : ""}`}
        onClick={() => onDiveActivate(i)}
      >
        <td className="sidebar-dive-table-visibility">
          {isArchived ? (
            <span className="archived-marker" title="Archived">
              A
            </span>
          ) : (
            <button
              type="button"
              className={`visibility-toggle ${isHidden ? "hidden-dive" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(i);
              }}
              title={isHidden ? "Show dive" : "Hide dive"}
            >
              <EyeIcon open={!isHidden} />
            </button>
          )}
        </td>
        <td>{formatDiveNumber(diveNumbers[i])}</td>
        <td>{dateLabel}</td>
        <td>
          {discipline ? (
            <span className={disciplineClass}>
              {disciplineAbbrev(discipline)}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td>{Math.abs(maxDepth).toFixed(1)}m</td>
        <td>{formatDuration(duration)}</td>
        <td>{maxTemp !== undefined ? `${maxTemp.toFixed(1)}°C` : "—"}</td>
        <td>{minTemp !== undefined ? `${minTemp.toFixed(1)}°C` : "—"}</td>
        <td>{weight !== undefined ? `${weight}kg` : "—"}</td>
        <td>{exposureSuit ? formatExposureSuit(exposureSuit) : "—"}</td>
        <td>{diveTags.length > 0 ? diveTags.join(", ") : "—"}</td>
      </tr>
    );
  };

  const renderDiveTable = () => (
    <div className="sidebar-dive-table-wrap">
      <table className="sidebar-dive-table">
        <thead>
          <tr>
            <th aria-label={inSelectMode ? "Select" : "Visibility"} />
            <th>Dive</th>
            <th>Date</th>
            <th>Discipline</th>
            <th>Depth</th>
            <th>Duration</th>
            <th>Max °C</th>
            <th>Min °C</th>
            <th>Weight</th>
            <th>Suit</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {includedIndices.map((i) => renderDiveTableRow(i, false))}
          {!inSelectMode && excludedIndices.length > 0 && (
            <tr className="sidebar-dive-table-divider">
              <td colSpan={11}>Excluded By Filters</td>
            </tr>
          )}
          {!inSelectMode &&
            excludedIndices.map((i) => renderDiveTableRow(i, true))}
        </tbody>
      </table>
    </div>
  );

  const renderYearGroups = (groups: YearGroup[], excluded: boolean) =>
    groups.map((group) => (
      <Fragment key={`${excluded ? "excluded-" : ""}${group.year}`}>
        <li
          className={`sidebar-year-header${excluded ? " filter-excluded" : ""}`}
        >
          {group.year}
        </li>
        {group.dateGroups.map((dateGroup) => {
          const collapseKey = `${excluded ? "excluded:" : ""}${dateGroup.dateKey}`;
          const isCollapsed = collapsedDates.has(collapseKey);

          return (
            <Fragment
              key={`${excluded ? "excluded-" : ""}${dateGroup.dateKey}`}
            >
              <li
                className={`sidebar-date-header clickable${excluded ? " filter-excluded" : ""}${isCollapsed ? " collapsed" : ""}`}
                onClick={() => toggleDateCollapsed(collapseKey)}
              >
                <span className="sidebar-date-label">
                  {dateGroup.dateLabel}
                </span>
                <span className="date-toggle-label">
                  {isCollapsed ? "show" : "hide"}
                </span>
              </li>
              {!isCollapsed &&
                dateGroup.indices.map((i) => renderDiveEntry(i, excluded))}
            </Fragment>
          );
        })}
      </Fragment>
    ));

  return (
    <aside className={`sidebar${diveListExpanded ? " sidebar--expanded" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-title">
          <h2>Dives</h2>
          <button
            type="button"
            className="sidebar-expand-btn"
            onClick={onToggleDiveListExpanded}
            disabled={inSelectMode}
            title={
              diveListExpanded
                ? "Collapse dive list"
                : "Expand dive details list"
            }
            aria-label={
              diveListExpanded
                ? "Collapse dive list"
                : "Expand dive details list"
            }
          >
            {diveListExpanded ? (
              <PanelRightCloseIcon />
            ) : (
              <PanelRightOpenIcon />
            )}
          </button>
          {diveListExpanded && (
            <div className="filter-chips sidebar-header-chips">
              <button
                type="button"
                className={showArchivedDives ? "active" : ""}
                onClick={() => onShowArchivedDivesChange(!showArchivedDives)}
                disabled={inSelectMode}
              >
                Show Archived
              </button>
            </div>
          )}
        </div>
        <button
          className="sidebar-header-btn"
          onClick={() => setShowEditDialog(true)}
          disabled={inSelectMode}
        >
          Add Tag
        </button>
      </div>

      {assignMode && (
        <div className="sidebar-tag-banner">
          <span>
            Select dives to {assignModeDescription(assignMode).action}{" "}
            <strong>{assignModeDescription(assignMode).label}</strong>
          </span>
          <div className="sidebar-tag-actions">
            <button className="tag-action-btn done" onClick={handleDone}>
              Done
            </button>
            <button className="tag-action-btn cancel" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-content" ref={diveListRef}>
        {diveListExpanded ? (
          renderDiveTable()
        ) : (
          <ul className="sidebar-dive-list">
            {renderYearGroups(includedGroups, false)}
            {!inSelectMode && excludedGroups.length > 0 && (
              <>
                <li className="sidebar-excluded-divider">
                  Excluded By Filters
                </li>
                {renderYearGroups(excludedGroups, true)}
              </>
            )}
          </ul>
        )}
      </div>

      {showEditDialog && (
        <EditDialog
          onAssignDiscipline={() => {
            setShowEditDialog(false);
            setShowDisciplineDialog(true);
          }}
          onAssignWeight={() => {
            setShowEditDialog(false);
            setShowWeightDialog(true);
          }}
          onAssignExposureSuit={() => {
            setShowEditDialog(false);
            setShowExposureSuitDialog(true);
          }}
          onOther={() => {
            setShowEditDialog(false);
            setShowTagDialog(true);
          }}
          onClose={() => setShowEditDialog(false)}
        />
      )}

      {showTagDialog && (
        <TagDialog
          existingTags={tags.map((t) => ({
            name: t.name,
            count: t.diveIndices.size,
          }))}
          onCreateTag={handleCreateTag}
          onSelectTag={handleSelectTag}
          onClose={() => setShowTagDialog(false)}
          onBack={() => {
            setShowTagDialog(false);
            backToEdit();
          }}
        />
      )}

      {showDisciplineDialog && (
        <DisciplineDialog
          onSelect={(discipline) => {
            startAssignMode({ kind: "discipline", value: discipline });
            setShowDisciplineDialog(false);
          }}
          onClose={() => setShowDisciplineDialog(false)}
          onBack={() => {
            setShowDisciplineDialog(false);
            backToEdit();
          }}
        />
      )}

      {showWeightDialog && (
        <WeightDialog
          onApply={(weightKg) => {
            startAssignMode({ kind: "weight", value: weightKg });
            setShowWeightDialog(false);
          }}
          onClose={() => setShowWeightDialog(false)}
          onBack={() => {
            setShowWeightDialog(false);
            backToEdit();
          }}
        />
      )}

      {showExposureSuitDialog && (
        <ExposureSuitDialog
          onApply={(suit) => {
            startAssignMode({ kind: "exposureSuit", value: suit });
            setShowExposureSuitDialog(false);
          }}
          onClose={() => setShowExposureSuitDialog(false)}
          onBack={() => {
            setShowExposureSuitDialog(false);
            backToEdit();
          }}
        />
      )}
    </aside>
  );
}
