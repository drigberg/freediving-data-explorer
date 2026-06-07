interface SafetyDialogProps {
  onSelect: (safety: boolean) => void;
  onClose: () => void;
  onBack: () => void;
}

export default function SafetyDialog({
  onSelect,
  onClose,
  onBack,
}: SafetyDialogProps) {
  return (
    <div className="tag-dialog-overlay" onClick={onClose}>
      <div className="tag-dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-back-btn" onClick={onBack}>
          Back
        </button>
        <h3>Safety Dive?</h3>
        <div className="tag-form">
          <div className="tag-form-row">
            <button className="tag-option" onClick={() => onSelect(true)}>
              Yes
            </button>
            <button className="tag-option" onClick={() => onSelect(false)}>
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
