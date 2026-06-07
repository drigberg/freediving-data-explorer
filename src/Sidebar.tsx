import { useState, useCallback, useRef, useMemo } from "react";
import { shortDateLabel } from "./colors";
import TagDialog from "./TagDialog";
import DisciplineDialog from "./DisciplineDialog";
import EditDialog from "./AddTagDialog";
import { disciplineAbbrev } from "./disciplines";
import type { Tag } from "./grouping";

interface SidebarProps {
  seriesNames: string[];
  seriesData: [number, number][][];
  disciplines: (string | undefined)[];
  hiddenDives: Set<number>;
  onToggleVisibility: (index: number) => void;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onDisciplinesAssign: (indices: number[], discipline: string) => void;
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

export default function Sidebar({
  seriesNames,
  seriesData,
  disciplines,
  hiddenDives,
  onToggleVisibility,
  tags,
  onTagsChange,
  onDisciplinesAssign,
}: SidebarProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showDisciplineDialog, setShowDisciplineDialog] = useState(false);
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

  const [taggingMode, setTaggingMode] = useState<string | null>(null);
  const [disciplineAssignMode, setDisciplineAssignMode] = useState<
    string | null
  >(null);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const lastClickedRef = useRef<number | null>(null);

  const inSelectMode = taggingMode !== null || disciplineAssignMode !== null;

  const handleCreateTag = useCallback(
    (name: string) => {
      const existing = tags.find((t) => t.name === name);
      if (existing) {
        setTaggingMode(name);
        setSelection(new Set(existing.diveIndices));
      } else {
        onTagsChange([...tags, { name, diveIndices: new Set() }]);
        setTaggingMode(name);
        setSelection(new Set());
      }
      setShowTagDialog(false);
    },
    [tags, onTagsChange],
  );

  const handleSelectTag = useCallback(
    (name: string) => {
      const tag = tags.find((t) => t.name === name);
      setTaggingMode(name);
      setSelection(new Set(tag?.diveIndices ?? []));
      setShowTagDialog(false);
    },
    [tags],
  );

  const handleSelectDiscipline = useCallback((discipline: string) => {
    setDisciplineAssignMode(discipline);
    setSelection(new Set());
    setShowDisciplineDialog(false);
    lastClickedRef.current = null;
  }, []);

  const handleDone = useCallback(() => {
    if (taggingMode) {
      onTagsChange(
        tags.map((t) =>
          t.name === taggingMode
            ? { ...t, diveIndices: new Set(selection) }
            : t,
        ),
      );
      setTaggingMode(null);
    } else if (disciplineAssignMode) {
      onDisciplinesAssign([...selection], disciplineAssignMode);
      setDisciplineAssignMode(null);
    }
    setSelection(new Set());
    lastClickedRef.current = null;
  }, [
    taggingMode,
    disciplineAssignMode,
    selection,
    tags,
    onTagsChange,
    onDisciplinesAssign,
  ]);

  const handleCancel = useCallback(() => {
    setTaggingMode(null);
    setDisciplineAssignMode(null);
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

      {taggingMode && (
        <div className="sidebar-tag-banner">
          <span>
            Select dives to tag with <strong>{taggingMode}</strong>
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

      {disciplineAssignMode && (
        <div className="sidebar-tag-banner">
          <span>
            Select dives to assign discipline{" "}
            <strong>{disciplineAssignMode}</strong>
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
        {[...seriesNames.keys()].reverse().map((i) => {
          const name = seriesNames[i];
          const isHidden = hiddenDives.has(i);
          const isSelected = selection.has(i);
          const discipline = disciplines[i];

          if (inSelectMode) {
            return (
              <li
                key={i}
                className={`sidebar-dive-item tagging ${isSelected ? "selected" : ""}`}
                onClick={(e) => handleSelectionClick(i, e.shiftKey)}
              >
                <span className="tag-checkbox">{isSelected ? "✓" : ""}</span>
                <span className="dive-name">{shortDateLabel(name)}</span>
                {discipline && (
                  <span className="dive-discipline">
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

          return (
            <li
              key={i}
              className={`sidebar-dive-entry ${isExpanded ? "expanded" : ""}`}
            >
              <div className="sidebar-dive-item">
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
                  <span className="dive-discipline">
                    {disciplineAbbrev(discipline)}
                  </span>
                )}
                <span
                  className="dive-chevron"
                  onClick={() => toggleExpanded(i)}
                >
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
                    <li className="dive-detail-item">
                      Discipline: {discipline}
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
        })}
      </ul>

      {showEditDialog && (
        <EditDialog
          onAssignDiscipline={() => {
            setShowEditDialog(false);
            setShowDisciplineDialog(true);
          }}
          onAddTag={() => {
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
            setShowEditDialog(true);
          }}
        />
      )}

      {showDisciplineDialog && (
        <DisciplineDialog
          onSelect={handleSelectDiscipline}
          onClose={() => setShowDisciplineDialog(false)}
          onBack={() => {
            setShowDisciplineDialog(false);
            setShowEditDialog(true);
          }}
        />
      )}
    </aside>
  );
}
