import { useState } from "react";

type TagCategory = "weight" | "safety" | "exposureSuit" | "other";

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
  const [category, setCategory] = useState<TagCategory | null>(null);

  const [weight, setWeight] = useState("");
  const [safety, setSafety] = useState(true);
  const [openCell, setOpenCell] = useState(false);
  const [thickness, setThickness] = useState("");
  const [otherText, setOtherText] = useState("");

  function buildTagName(): string | null {
    switch (category) {
      case "weight": {
        const w = parseFloat(weight);
        return isNaN(w) ? null : `Weight: ${w}kg`;
      }
      case "safety":
        return `Safety: ${safety ? "Yes" : "No"}`;
      case "exposureSuit": {
        const t = parseFloat(thickness);
        const cellType = openCell ? "Open Cell" : "Closed Cell";
        return isNaN(t) ? null : `Exposure Suit: ${cellType}, ${t}mm`;
      }
      case "other":
        return otherText.trim() || null;
      default:
        return null;
    }
  }

  function handleCreate() {
    const name = buildTagName();
    if (name) onCreateTag(name);
  }

  const tagName = buildTagName();
  const canCreate = tagName !== null;

  const categories: { id: TagCategory; label: string }[] = [
    { id: "weight", label: "Weight" },
    { id: "safety", label: "Safety" },
    { id: "exposureSuit", label: "Exposure Suit" },
    { id: "other", label: "Other" },
  ];

  return (
    <div className="tag-dialog-overlay" onClick={onClose}>
      <div className="tag-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-back-btn" onClick={onBack}>
          Back
        </button>
        <h3>Add Tag</h3>

        <div className="tag-category-picker">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={category === cat.id ? "active" : ""}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {category === "weight" && (
          <div className="tag-form">
            <div className="tag-form-row">
              <input
                type="number"
                placeholder="Weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                step="0.1"
                min="0"
                autoFocus
              />
              <span className="tag-unit">kg</span>
            </div>
          </div>
        )}

        {category === "safety" && (
          <div className="tag-form">
            <div className="tag-form-row">
              <button
                className={`tag-option ${safety ? "active" : ""}`}
                onClick={() => setSafety(true)}
              >
                Yes
              </button>
              <button
                className={`tag-option ${!safety ? "active" : ""}`}
                onClick={() => setSafety(false)}
              >
                No
              </button>
            </div>
          </div>
        )}

        {category === "exposureSuit" && (
          <div className="tag-form">
            <div className="tag-form-row">
              <span className="tag-field-label">Cell type</span>
              <button
                className={`tag-option ${openCell ? "active" : ""}`}
                onClick={() => setOpenCell(true)}
              >
                Open Cell
              </button>
              <button
                className={`tag-option ${!openCell ? "active" : ""}`}
                onClick={() => setOpenCell(false)}
              >
                Closed Cell
              </button>
            </div>
            <div className="tag-form-row">
              <span className="tag-field-label">Thickness</span>
              <input
                type="number"
                placeholder="Thickness"
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                step="0.5"
                min="0"
                autoFocus
              />
              <span className="tag-unit">mm</span>
            </div>
          </div>
        )}

        {category === "other" && (
          <div className="tag-form">
            <div className="tag-dialog-input">
              <input
                type="text"
                placeholder="Tag name..."
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCreate) handleCreate();
                }}
                autoFocus
              />
            </div>
          </div>
        )}

        {category && (
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
        )}

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
