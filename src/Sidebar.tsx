import { useState, useCallback, useRef, useMemo } from "react";
import { shortDateLabel } from "./colors";
import TagDialog from "./TagDialog";

import type { Tag } from "./grouping";

const DISCIPLINE_ABBREV: Record<string, string> = {
  "Free Immersion": "FI",
  "No-Fins": "CNF",
  "Bi-Fins": "CWTB",
  "Mono-Fin": "CWT",
};

interface SidebarProps {
  seriesNames: string[];
  seriesData: [number, number][][];
  hiddenDives: Set<number>;
  onToggleVisibility: (index: number) => void;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
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
  hiddenDives,
  onToggleVisibility,
  tags,
  onTagsChange,
}: SidebarProps) {
  const [showTagDialog, setShowTagDialog] = useState(false);
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
  const [tagSelection, setTagSelection] = useState<Set<number>>(new Set());
  const lastClickedRef = useRef<number | null>(null);

  const handleCreateTag = useCallback(
    (name: string) => {
      const existing = tags.find((t) => t.name === name);
      if (existing) {
        setTaggingMode(name);
        setTagSelection(new Set(existing.diveIndices));
      } else {
        onTagsChange([...tags, { name, diveIndices: new Set() }]);
        setTaggingMode(name);
        setTagSelection(new Set());
      }
      setShowTagDialog(false);
    },
    [tags, onTagsChange],
  );

  const handleSelectTag = useCallback(
    (name: string) => {
      const tag = tags.find((t) => t.name === name);
      setTaggingMode(name);
      setTagSelection(new Set(tag?.diveIndices ?? []));
      setShowTagDialog(false);
    },
    [tags],
  );

  const handleTagDone = useCallback(() => {
    if (!taggingMode) return;
    onTagsChange(
      tags.map((t) =>
        t.name === taggingMode
          ? { ...t, diveIndices: new Set(tagSelection) }
          : t,
      ),
    );
    setTaggingMode(null);
    setTagSelection(new Set());
    lastClickedRef.current = null;
  }, [taggingMode, tagSelection, tags, onTagsChange]);

  const handleTagCancel = useCallback(() => {
    setTaggingMode(null);
    setTagSelection(new Set());
    lastClickedRef.current = null;
  }, []);

  const tagsByDive = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const tag of tags) {
      if (tag.name.startsWith("Discipline:")) continue;
      for (const idx of tag.diveIndices) {
        if (!map.has(idx)) map.set(idx, []);
        map.get(idx)!.push(tag.name);
      }
    }
    return map;
  }, [tags]);

  const disciplineByDive = useMemo(() => {
    const map = new Map<number, { abbrev: string; name: string }>();
    for (const tag of tags) {
      const match = tag.name.match(/^Discipline:\s*(.+)$/);
      if (!match) continue;
      const abbrev = DISCIPLINE_ABBREV[match[1]];
      if (!abbrev) continue;
      for (const idx of tag.diveIndices) {
        map.set(idx, { abbrev, name: match[1] });
      }
    }
    return map;
  }, [tags]);

  const handleTagClick = useCallback((index: number, shiftKey: boolean) => {
    setTagSelection((prev) => {
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
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Dives</h2>
        <button
          className="sidebar-add-tag"
          onClick={() => setShowTagDialog(true)}
          disabled={taggingMode !== null}
        >
          + Add tag
        </button>
      </div>

      {taggingMode && (
        <div className="sidebar-tag-banner">
          <span>
            Select dives to tag with <strong>{taggingMode}</strong>
          </span>
          <div className="sidebar-tag-actions">
            <button className="tag-action-btn done" onClick={handleTagDone}>
              Done
            </button>
            <button className="tag-action-btn cancel" onClick={handleTagCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="sidebar-dive-list">
        {[...seriesNames.keys()].reverse().map((i) => {
          const name = seriesNames[i];
          const isHidden = hiddenDives.has(i);
          const isSelected = tagSelection.has(i);

          const discipline = disciplineByDive.get(i);

          if (taggingMode) {
            return (
              <li
                key={i}
                className={`sidebar-dive-item tagging ${isSelected ? "selected" : ""}`}
                onClick={(e) => handleTagClick(i, e.shiftKey)}
              >
                <span className="tag-checkbox">{isSelected ? "✓" : ""}</span>
                <span className="dive-name">{shortDateLabel(name)}</span>
                {discipline && (
                  <span className="dive-discipline">{discipline.abbrev}</span>
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
                  <span className="dive-discipline">{discipline.abbrev}</span>
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

      {showTagDialog && (
        <TagDialog
          existingTags={tags.map((t) => ({
            name: t.name,
            count: t.diveIndices.size,
          }))}
          onCreateTag={handleCreateTag}
          onSelectTag={handleSelectTag}
          onClose={() => setShowTagDialog(false)}
        />
      )}
    </aside>
  );
}
