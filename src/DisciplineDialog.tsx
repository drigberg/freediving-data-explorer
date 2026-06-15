import { DISCIPLINES, disciplineOptionClass } from "./disciplines";

interface DisciplineDialogProps {
  onSelect: (discipline: string) => void;
  onClose: () => void;
  onBack: () => void;
}

export default function DisciplineDialog({
  onSelect,
  onClose,
  onBack,
}: DisciplineDialogProps) {
  return (
    <div className="tag-dialog-overlay" onClick={onClose}>
      <div className="tag-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-back-btn" onClick={onBack}>
          Back
        </button>
        <h3>Select Discipline</h3>
        <div className="tag-form">
          <div className="tag-form-row discipline-options">
            {DISCIPLINES.map((d) => (
              <button
                key={d}
                className={disciplineOptionClass(d)}
                onClick={() => onSelect(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
