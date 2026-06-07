interface EditDialogProps {
  onAssignDiscipline: () => void;
  onAddTag: () => void;
  onClose: () => void;
}

export default function EditDialog({
  onAssignDiscipline,
  onAddTag,
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
            <button onClick={onAddTag}>Add tag</button>
          </li>
        </ul>
      </div>
    </div>
  );
}
