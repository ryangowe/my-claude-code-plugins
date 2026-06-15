interface SubmitFloatProps {
  pending: number;
  onSubmit: () => void;
}

export function SubmitFloat({ pending, onSubmit }: SubmitFloatProps) {
  return (
    <div className="submit-float">
      <div className="status-pill">
        <span className={`pulse-dot ${pending > 0 ? "active" : "done"}`} />
        {pending > 0 ? `${pending} unresolved` : "All resolved"}
      </div>
      <button id="submit-btn" onClick={onSubmit}>
        Submit review
      </button>
    </div>
  );
}
