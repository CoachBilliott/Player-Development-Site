import { useEffect, useRef, useState } from "react";
import type { LearningAttempt, LearningQuiz, LearningTransport } from "./api";
export function QuizRunner({
  api,
  quiz,
  releaseId,
  draft,
  onClose,
  onSaved,
}: {
  api: LearningTransport;
  quiz: LearningQuiz;
  releaseId: string;
  draft?: LearningAttempt;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [answers, setAnswers] = useState<LearningAttempt["answers"]>(
    draft?.answers || {},
  );
  const [version, setVersion] = useState(draft?.version || 0);
  const id = useRef(draft?.id || crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  async function save(submit: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await api.saveAttempt(
        id.current,
        releaseId,
        quiz.id,
        answers,
        submit,
        version,
      );
      setVersion(saved.version);
      setDirty(false);
      setStatus(
        submit
          ? saved.state === "needs_grading"
            ? "Submitted. Written answers are awaiting staff grading."
            : `Submitted. Score: ${saved.objective_points} / ${quiz.total_points}.`
          : "Draft saved. You can return to it later.",
      );
      if (submit) setSubmitted(true);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your answers were not saved. Retry without leaving.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function answer(q: string, value: string | number) {
    setAnswers((old) => ({ ...old, [q]: value }));
    setDirty(true);
    setStatus("");
  }
  return (
    <section className="learning-quiz" aria-label="Quiz questions">
      <button
        disabled={busy}
        onClick={() => (dirty ? setConfirmLeave(true) : onClose())}
      >
        Back to this week
      </button>
      <h2 ref={title} tabIndex={-1}>
        {quiz.title}
      </h2>
      <p>
        {quiz.questions.length} questions · {quiz.total_points} points. Save a
        draft to continue later.
      </p>
      {confirmLeave && (
        <div role="alert">
          <p>These changes have not been saved.</p>
          <button
            onClick={() => {
              setConfirmLeave(false);
              void save(false);
            }}
          >
            Save draft
          </button>
          <button onClick={onClose}>Discard changes and leave</button>
          <button onClick={() => setConfirmLeave(false)}>Keep answering</button>
        </div>
      )}
      <form
        hidden={submitted}
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <fieldset disabled={busy}>
          {quiz.questions.map((q, index) => (
            <fieldset key={q.id} className="learning-question">
              <legend>
                {index + 1}. {q.question}{" "}
                <span>
                  ({q.points} {q.points === 1 ? "point" : "points"})
                </span>
              </legend>
              {q.type === "written" ? (
                <label>
                  Your answer
                  <textarea
                    maxLength={2000}
                    value={String(answers[q.id] || "")}
                    required
                    onChange={(e) => answer(q.id, e.target.value)}
                  />
                </label>
              ) : (
                q.options.map((option, i) => (
                  <label key={i} className="learning-choice">
                    <input
                      type="radio"
                      name={q.id}
                      value={i}
                      checked={answers[q.id] === i}
                      required
                      onChange={() => answer(q.id, i)}
                    />
                    {option}
                  </label>
                ))
              )}
            </fieldset>
          ))}
          <div className="learning-actions">
            <button type="button" onClick={() => void save(false)}>
              Save draft
            </button>
            <button type="submit">{busy ? "Saving…" : "Submit answers"}</button>
          </div>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
