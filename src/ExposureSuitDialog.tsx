import { useState } from "react";
import type { ExposureSuit } from "./parseData";

interface ExposureSuitDialogProps {
  onApply: (suit: ExposureSuit) => void;
  onClose: () => void;
  onBack: () => void;
}

export default function ExposureSuitDialog({
  onApply,
  onClose,
  onBack,
}: ExposureSuitDialogProps) {
  const [openCell, setOpenCell] = useState(false);
  const [thickness, setThickness] = useState("");
  const parsed = parseFloat(thickness);
  const canApply = !isNaN(parsed) && parsed >= 0;

  return (
    <div className="tag-dialog-overlay" onClick={onClose}>
      <div className="tag-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-back-btn" onClick={onBack}>
          Back
        </button>
        <h3>Select Exposure Suit</h3>
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
          <button
            className="tag-create-btn"
            onClick={() =>
              canApply && onApply({ openCell, thicknessMm: parsed })
            }
            disabled={!canApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
