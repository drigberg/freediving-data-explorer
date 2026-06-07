import { useState } from "react";

interface WeightDialogProps {
  onApply: (weightKg: number) => void;
  onClose: () => void;
  onBack: () => void;
}

export default function WeightDialog({
  onApply,
  onClose,
  onBack,
}: WeightDialogProps) {
  const [weight, setWeight] = useState("");
  const parsed = parseFloat(weight);
  const canApply = !isNaN(parsed) && parsed >= 0;

  return (
    <div className="tag-dialog-overlay" onClick={onClose}>
      <div className="tag-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-back-btn" onClick={onBack}>
          Back
        </button>
        <h3>Assign Weight</h3>
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
          <button
            className="tag-create-btn"
            onClick={() => canApply && onApply(parsed)}
            disabled={!canApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
