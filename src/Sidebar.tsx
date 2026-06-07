import { Fragment, useState, useCallback, useRef, useMemo } from "react";
import { shortDateLabel } from "./colors";
import TagDialog from "./TagDialog";
import DisciplineDialog from "./DisciplineDialog";
import WeightDialog from "./WeightDialog";
import ExposureSuitDialog from "./ExposureSuitDialog";
import EditDialog from "./AddTagDialog";
import { disciplineAbbrev, isSafetyDynbDiscipline } from "./disciplines";
import type { ExposureSuit } from "./parseData";
import { extractDateKey, formatExposureSuit } from "./parseData";
import {
  divePassesFilters,
  hasActiveFilters,
  type DiveFilterConfig,
} from "./filters";
import type { Tag } from "./grouping";

interface SidebarProps {
  seriesNames: string[];
  seriesData: [number, number][][];
  disciplines: (string | undefined)[];
  weights: (number | undefined)[];
  exposureSuits: (ExposureSuit | undefined)[];
  hiddenDives: Set<number>;
  onToggleVisibility: (index: number) => void;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onDisciplinesAssign: (indices: number[], discipline: string) => void;
  onWeightAssign: (indices: number[], weightKg: number) => void;
  onExposureSuitAssign: (indices: number[], suit: ExposureSuit) => void;
  diveFilters: DiveFilterConfig;
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${String(s).padStart(2, "0")}s`;
}

type YearGroup = { year: string; indices: number[] };

function groupIndicesByYear(
  indices: number[],
  seriesNames: string[],
): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const i of indices) {
    const year = extractDateKey(seriesNames[i])?.slice(0, 4) ?? "Unknown";
    const last = groups[groups.length - 1];
    if (last?.year === year) {
      last.indices.push(i);
    } else {
      groups.push({ year, indices: [i] });
    }
  }
  return groups;
}

export default function Sidebar({
  seriesNames,
  seriesData,
  disciplines,
  weights,
  exposureSuits,
  hiddenDives,
  onToggleVisibility,
  tags,
  onTagsChange,
  onDisciplinesAssign,
  onWeightAssign,
  onExposureSuitAssign,
  diveFilters,
}: SidebarProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showDisciplineDialog, setShowDisciplineDialog] = useState(false);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showExposureSuitDialog, setShowExposureSuitDialog] = useState(false);
  const [expandedDives, setExpandedDives] = useState<Set<number>>(new Set());

  const toggleExpanded = useCallback((index: number) => {
    setExpandedDives((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

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
      includedGroups: groupIndicesByYear(included, seriesNames),
      excludedGroups: filtering
        ? groupIndicesByYear(excluded, seriesNames)
        : [],
    };
  }, [seriesNames, diveData, diveFilters]);

  const renderDiveEntry = (i: number, excluded: boolean) => {
    const name = seriesNames[i];
    const isHidden = hiddenDives.has(i);
    const isSelected = selection.has(i);
    const discipline = disciplines[i];
    const disciplineClass = discipline
      ? `dive-discipline${isSafetyDynbDiscipline(discipline) ? " safety-dynb-discipline" : ""}`
      : "";
    const mutedClass = excluded ? " filter-excluded" : "";

    if (inSelectMode) {
      return (
        <li
          key={i}
          className={`sidebar-dive-item tagging${mutedClass} ${isSelected ? "selected" : ""}`}
          onClick={(e) => handleSelectionClick(i, e.shiftKey)}
        >
          <span className="tag-checkbox">{isSelected ? "✓" : ""}</span>
          <span className="dive-name">{shortDateLabel(name)}</span>
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
    const points = seriesData[i];
    const maxDepth =
      points.length > 0 ? Math.min(...points.map(([, d]) => d)) : 0;
    const duration =
      points.length > 0 ? points[points.length - 1][0] - points[0][0] : 0;
    const weight = weights[i];
    const exposureSuit = exposureSuits[i];

    return (
      <li
        key={i}
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
            className="dive-name clickable"
            onClick={() => toggleExpanded(i)}
          >
            {shortDateLabel(name)}
          </span>
          {discipline && (
            <span className={disciplineClass}>
              {disciplineAbbrev(discipline)}
            </span>
          )}
          <span className="dive-chevron" onClick={() => toggleExpanded(i)}>
            <ChevronIcon open={isExpanded} />
          </span>
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
              <li
                className={`dive-detail-item${isSafetyDynbDiscipline(discipline) ? " safety-dynb-discipline" : ""}`}
              >
                Discipline: {discipline}
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
          </ul>
        )}
      </li>
    );
  };

  const renderYearGroups = (groups: YearGroup[], excluded: boolean) =>
    groups.map((group) => (
      <Fragment key={`${excluded ? "excluded-" : ""}${group.year}`}>
        <li
          className={`sidebar-year-header${excluded ? " filter-excluded" : ""}`}
        >
          {group.year}
        </li>
        {group.indices.map((i) => renderDiveEntry(i, excluded))}
      </Fragment>
    ));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Dives</h2>
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

      <ul className="sidebar-dive-list">
        {renderYearGroups(includedGroups, false)}
        {!inSelectMode && excludedGroups.length > 0 && (
          <>
            <li className="sidebar-excluded-divider">Excluded By Filters</li>
            {renderYearGroups(excludedGroups, true)}
          </>
        )}
      </ul>

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
