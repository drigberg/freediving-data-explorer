import { useState } from "react";
import { DISCIPLINES, disciplineOptionClass } from "./disciplines";
import {
  canSubmitManualDiveForm,
  manualDiveInputFromForm,
  type ManualDiveInput,
  type WetsuitCellType,
} from "./manualDive";

interface ManualDiveDialogProps {
  onSubmit: (input: ManualDiveInput) => void;
  onClose: () => void;
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="tag-field-label">
      {children}
      <span className="required-mark" aria-hidden="true">
        *
      </span>
    </span>
  );
}

export default function ManualDiveDialog({
  onSubmit,
  onClose,
}: ManualDiveDialogProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxDepth, setMaxDepth] = useState("");
  const [duration, setDuration] = useState("");
  const [surfaceTemp, setSurfaceTemp] = useState("");
  const [minTemp, setMinTemp] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [weight, setWeight] = useState("");
  const [cellType, setCellType] = useState<WetsuitCellType>(null);
  const [suitThickness, setSuitThickness] = useState("");

  const formState = {
    date,
    time,
    maxDepth,
    duration,
    surfaceTemp,
    minTemp,
    discipline,
    weight,
    cellType,
    suitThickness,
  };

  const canSubmit = canSubmitManualDiveForm(formState);

  const handleSubmit = () => {
    const input = manualDiveInputFromForm(formState);
    if (!input) return;
    onSubmit(input);
  };

  return (
    <div className="tag-dialog-overlay" onClick={onClose}>
      <div
        className="tag-dialog manual-dive-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog-back-btn" onClick={onClose}>
          Cancel
        </button>
        <h3>Add Dive Manually</h3>
        <div className="tag-form manual-dive-form">
          <div className="tag-form-row">
            <RequiredLabel>Date</RequiredLabel>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="tag-form-row">
            <span className="tag-field-label">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="tag-form-row">
            <RequiredLabel>Max depth</RequiredLabel>
            <input
              type="number"
              placeholder="Depth"
              value={maxDepth}
              onChange={(e) => setMaxDepth(e.target.value)}
              step="0.1"
              min="0"
              required
            />
            <span className="tag-unit">m</span>
          </div>
          <div className="tag-form-row">
            <RequiredLabel>Duration</RequiredLabel>
            <input
              type="number"
              placeholder="Duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              step="1"
              min="0"
              required
            />
            <span className="tag-unit">s</span>
          </div>
          <div className="tag-form-row">
            <RequiredLabel>Surface temp</RequiredLabel>
            <input
              type="number"
              placeholder="Temp"
              value={surfaceTemp}
              onChange={(e) => setSurfaceTemp(e.target.value)}
              step="0.1"
              required
            />
            <span className="tag-unit">°C</span>
          </div>
          <div className="tag-form-row">
            <span className="tag-field-label">Min temp</span>
            <input
              type="number"
              placeholder="Min temp"
              value={minTemp}
              onChange={(e) => setMinTemp(e.target.value)}
              step="0.1"
            />
            <span className="tag-unit">°C</span>
          </div>
          <div className="tag-form-row manual-dive-discipline-row">
            <span className="tag-field-label">Discipline</span>
            <div className="manual-dive-discipline-options">
              <button
                type="button"
                className={`tag-option ${discipline === "" ? "active" : ""}`}
                onClick={() => setDiscipline("")}
              >
                None
              </button>
              {DISCIPLINES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`${disciplineOptionClass(d)}${discipline === d ? " active" : ""}`}
                  onClick={() => setDiscipline(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="tag-form-row">
            <span className="tag-field-label">Weight</span>
            <input
              type="number"
              placeholder="Weight"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              step="0.1"
              min="0"
            />
            <span className="tag-unit">kg</span>
          </div>
          <div className="tag-form-row">
            <span className="tag-field-label">Wetsuit type</span>
            <button
              type="button"
              className={`tag-option ${cellType === null ? "active" : ""}`}
              onClick={() => setCellType(null)}
            >
              None
            </button>
            <button
              type="button"
              className={`tag-option ${cellType === "open" ? "active" : ""}`}
              onClick={() => setCellType("open")}
            >
              Open Cell
            </button>
            <button
              type="button"
              className={`tag-option ${cellType === "closed" ? "active" : ""}`}
              onClick={() => setCellType("closed")}
            >
              Closed Cell
            </button>
          </div>
          <div className="tag-form-row">
            {cellType !== null ? (
              <RequiredLabel>Wetsuit thickness</RequiredLabel>
            ) : (
              <span className="tag-field-label tag-field-label--muted">
                Wetsuit thickness
              </span>
            )}
            <input
              type="number"
              placeholder="Thickness"
              value={suitThickness}
              onChange={(e) => setSuitThickness(e.target.value)}
              step="0.5"
              min="0"
              disabled={cellType === null}
            />
            <span className="tag-unit">mm</span>
          </div>
          <button
            type="button"
            className="tag-create-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Add Dive
          </button>
        </div>
      </div>
    </div>
  );
}
