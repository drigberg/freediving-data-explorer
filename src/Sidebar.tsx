import { useState, useCallback, useRef } from "react";
import { shortDateLabel } from "./colors";
import TagDialog from "./TagDialog";

interface Tag {
  name: string;
  diveIndices: Set<number>;
}

interface SidebarProps {
  seriesNames: string[];
  hiddenDives: Set<number>;
  onToggleVisibility: (index: number) => void;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function Sidebar({
  seriesNames,
  hiddenDives,
  onToggleVisibility,
}: SidebarProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [showTagDialog, setShowTagDialog] = useState(false);

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
        setTags((prev) => [...prev, { name, diveIndices: new Set() }]);
        setTaggingMode(name);
        setTagSelection(new Set());
      }
      setShowTagDialog(false);
    },
    [tags]
  );

  const handleSelectTag = useCallback((name: string) => {
    const tag = tags.find((t) => t.name === name);
    setTaggingMode(name);
    setTagSelection(new Set(tag?.diveIndices ?? []));
    setShowTagDialog(false);
  }, [tags]);

  const handleTagDone = useCallback(() => {
    if (!taggingMode) return;
    setTags((prev) =>
      prev.map((t) =>
        t.name === taggingMode ? { ...t, diveIndices: new Set(tagSelection) } : t
      )
    );
    setTaggingMode(null);
    setTagSelection(new Set());
    lastClickedRef.current = null;
  }, [taggingMode, tagSelection]);

  const handleTagCancel = useCallback(() => {
    setTaggingMode(null);
    setTagSelection(new Set());
    lastClickedRef.current = null;
  }, []);

  const handleTagClick = useCallback(
    (index: number, shiftKey: boolean) => {
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
    },
    []
  );

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

          if (taggingMode) {
            return (
              <li
                key={i}
                className={`sidebar-dive-item tagging ${isSelected ? "selected" : ""}`}
                onClick={(e) => handleTagClick(i, e.shiftKey)}
              >
                <span className="tag-checkbox">{isSelected ? "✓" : ""}</span>
                <span className="dive-name">{shortDateLabel(name)}</span>
              </li>
            );
          }

          return (
            <li key={i} className="sidebar-dive-item">
              <button
                className={`visibility-toggle ${isHidden ? "hidden-dive" : ""}`}
                onClick={() => onToggleVisibility(i)}
                title={isHidden ? "Show dive" : "Hide dive"}
              >
                <EyeIcon open={!isHidden} />
              </button>
              <span className="dive-name">{shortDateLabel(name)}</span>
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
