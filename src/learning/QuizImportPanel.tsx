import { useRef, useState } from "react";
import { parseQuizCsv, type QuizImport, type ImportIssue } from "./quizImport";
export function QuizImportPanel({
  onPublish,
  existingQuizzes = [],
}: {
  existingQuizzes?: { id: string; title: string; latestRevision: number }[];
  onPublish: (
    title: string,
    quiz: QuizImport,
    operationId: string,
    targetQuiz?: string,
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [targetQuiz, setTargetQuiz] = useState("");
  const saving = useRef(false);
  const [quiz, setQuiz] = useState<QuizImport | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const operation = useRef(crypto.randomUUID());
  const fileVersion = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  async function load(file?: File) {
    const version = ++fileVersion.current;
    setQuiz(null);
    setIssues([]);
    setMessage("");
    operation.current = crypto.randomUUID();
    if (!file) return;
    if (file.size > 256 * 1024) {
      setIssues([
        { row: 0, column: "file", message: "Keep the quiz below 256 KB." },
      ]);
      return;
    }
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (version !== fileVersion.current) return;
      const result = parseQuizCsv(text);
      setQuiz(result.quiz);
      setIssues(result.issues);
      heading.current?.focus();
    } catch {
      if (version === fileVersion.current)
        setIssues([
          {
            row: 0,
            column: "file",
            message: "Choose a UTF-8 CSV exported from Google Sheets.",
          },
        ]);
    }
  }
  async function publish() {
    if (!quiz || saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      await onPublish(
        title.trim(),
        quiz,
        operation.current,
        targetQuiz || undefined,
      );
      setMessage("Quiz version saved. Add it to a plan week when ready.");
      setQuiz(null);
      if (!targetQuiz) setTitle("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The quiz was not saved. Retry with the same import.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="learning-import">
      <h2>Upload a quiz</h2>
      <p>
        Prepare it in Google Sheets, then choose File → Download →
        Comma-separated values (.csv).
      </p>
      <div className="learning-actions">
        <a href="./templates/repformed-quiz-blank.csv" download>
          Blank template
        </a>
        <a href="./templates/repformed-quiz-example.csv" download>
          Fictional example
        </a>
      </div>
      <label>
        Save as
        <select
          value={targetQuiz}
          disabled={busy}
          onChange={(e) => {
            const chosen = existingQuizzes.find((q) => q.id === e.target.value);
            setTargetQuiz(e.target.value);
            setTitle(chosen?.title || "");
            setMessage("");
            operation.current = crypto.randomUUID();
          }}
        >
          <option value="">New quiz</option>
          {existingQuizzes.map((q) => (
            <option key={q.id} value={q.id}>
              New version of {q.title} · latest {q.latestRevision}
            </option>
          ))}
        </select>
      </label>
      {targetQuiz && (
        <p>
          Earlier assignments, attempts and grades stay on their original
          version. Add the new version to future plan weeks explicitly.
        </p>
      )}
      <label>
        Quiz title
        <input
          value={title}
          maxLength={160}
          disabled={busy || !!targetQuiz}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => void load(e.target.files?.[0])}
        />
      </label>
      <p className="muted">
        Up to 100 questions · 256 KB. Answer keys remain private. Written
        answers need staff grading.
      </p>
      <h3 ref={heading} tabIndex={-1}>
        Import review
      </h3>
      {issues.length > 0 && (
        <div role="alert">
          <p>Nothing was published. Fix these cells and upload again.</p>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.row ? `Row ${issue.row}, ` : ""}
                {issue.column}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {quiz && (
        <>
          <p>
            {quiz.questions.length} questions · {quiz.totalPoints} points.
            Verify the answer key before saving.
          </p>
          <ol>
            {quiz.questions.map((q) => (
              <li key={q.id}>
                <strong>{q.question}</strong>
                <p>
                  {q.type.replaceAll("_", " ")} · {q.points} points
                </p>
                {q.options.length > 0 && (
                  <ul>
                    {q.options.map((option, i) => (
                      <li key={i}>
                        {String.fromCharCode(65 + i)}. {option}
                        {quiz.keys.find((k) => k.id === q.id)?.correct === i
                          ? " — correct answer"
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {q.type === "written" && <p>Staff graded</p>}
              </li>
            ))}
          </ol>
          <button
            disabled={busy || !title.trim()}
            onClick={() => void publish()}
          >
            {busy ? "Saving…" : "Save quiz version"}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              fileVersion.current++;
              setQuiz(null);
              setIssues([]);
            }}
          >
            Cancel import
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
