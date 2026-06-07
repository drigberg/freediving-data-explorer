interface EditDialogProps {
  onAssignDiscipline: () => void;
  onAssignWeight: () => void;
  onAssignSafety: () => void;
  onAssignExposureSuit: () => void;
  onOther: () => void;
  onClose: () => void;
}

export default function EditDialog({
  onAssignDiscipline,
  onAssignWeight,
  onAssignSafety,
  onAssignExposureSuit,
  onOther,
  onClose,
}: EditDialogProps) {
  return (
    <div className="tag-dialog-overlay" onClick={onClose}>
      <div className="tag-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Add Tag</h3>
        <ul className="tag-dialog-list">
          <li>
            <button onClick={onAssignDiscipline}>Discipline</button>
          </li>
          <li>
            <button onClick={onAssignWeight}>Weight</button>
          </li>
          <li>
            <button onClick={onAssignSafety}>Safety</button>
          </li>
          <li>
            <button onClick={onAssignExposureSuit}>Exposure Suit</button>
          </li>
          <li>
            <button onClick={onOther}>Other</button>
          </li>
        </ul>
      </div>
    </div>
  );
}
