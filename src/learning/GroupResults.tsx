import { useState } from "react";
import type { LearningTransport, LearningGroupResults } from "./api";
export function GroupResults({
  api,
  id,
  title,
}: {
  api: LearningTransport;
  id: string;
  title: string;
}) {
  const [rows, setRows] = useState<LearningGroupResults | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setRows(await api.groupResults(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Group results unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <button disabled={busy} onClick={() => void load()}>
        {busy ? "Loading…" : `View ${title} results`}
      </button>
      {error && <p role="alert">{error}</p>}
      {rows?.length === 0 && (
        <p>No athletes in this group are visible to your role.</p>
      )}
      {rows?.map((row) => (
        <details key={row.profile_id}>
          <summary>
            {row.name} · {row.completed_weeks} / {row.releases} released weeks
            reported complete
          </summary>
          {!row.quiz_attempts.length && <p>No quiz attempts observed.</p>}
          {row.quiz_attempts.map((a, i) => (
            <p key={i}>
              {a.quiz} · Week {a.week_number} ·{" "}
              {a.state === "graded"
                ? `${(a.objective_points || 0) + a.written_points} / ${a.total_points}`
                : a.state === "needs_grading"
                  ? "Awaiting written grade"
                  : "Saved draft"}
            </p>
          ))}
        </details>
      ))}
    </section>
  );
}
