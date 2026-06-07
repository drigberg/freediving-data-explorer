import { useState } from "react";

interface TagDialogProps {
  existingTags: { name: string; count: number }[];
  onCreateTag: (name: string) => void;
  onSelectTag: (name: string) => void;
  onClose: () => void;
  onBack: () => void;
}

export default function TagDialog({
  existingTags,
  onCreateTag,
  onSelectTag,
  onClose,
  onBack,
}: TagDialogProps) {
  const [tagText, setTagText] = useState("");
  const tagName = tagText.trim();
  const canCreate = tagName.length > 0;

  function handleCreate() {
    if (canCreate) onCreateTag(tagName);
  }

  return (
    <div className="tag-dialog-overlay" onClick={onClose}>
      <div className="tag-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-back-btn" onClick={onBack}>
          Back
        </button>
        <h3>Add Tag</h3>

        <div className="tag-form">
          <div className="tag-dialog-input">
            <input
              type="text"
              placeholder="Tag name..."
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) handleCreate();
              }}
              autoFocus
            />
          </div>
        </div>

        <button
          className="tag-create-btn"
          onClick={handleCreate}
          disabled={!canCreate}
        >
          {existingTags.some((tag) => tag.name === tagName)
            ? "Select"
            : "Create"}{" "}
          {tagName ? `"${tagName}"` : ""}
        </button>

        {existingTags.length > 0 && (
          <>
            <div className="tag-dialog-divider">or select existing</div>
            <ul className="tag-dialog-list">
              {existingTags.map((tag) => (
                <li key={tag.name}>
                  <button onClick={() => onSelectTag(tag.name)}>
                    {tag.name}
                    <span className="tag-count">{tag.count} dives</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
