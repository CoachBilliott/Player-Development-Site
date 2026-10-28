import { FutureWeekOverride } from "./FutureWeekOverride";
import { PlanEligibility } from "./PlanEligibility";
import { LearningInbox } from "./LearningInbox";
import { useEffect, useRef, useState } from "react";
import type {
  LearningAthleteData,
  LearningCatalog,
  LearningRelease,
  LearningTransport,
  LearningQuiz,
  LearningAttempt,
} from "./api";
import { QuizRunner } from "./QuizRunner";
import "./learning.css";
const date = (s: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
export function LearningAthlete({
  api,
  profile,
  actor,
  staff = false,
  owner = false,
  onChanged,
  task,
  mode = "all",
}: {
  api: LearningTransport;
  profile: string;
  actor: string;
  staff?: boolean;
  owner?: boolean;
  onChanged?: () => void;
  task?: { kind: "plan" | "grading"; request: number };
  mode?: "all" | "today" | "library" | "progress";
}) {
  const [data, setData] = useState<LearningAthleteData | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<LearningRelease | null>(null),
    [activeQuiz, setActiveQuiz] = useState<LearningQuiz | null>(null),
    [catalog, setCatalog] = useState<LearningCatalog | null>(null),
    [plan, setPlan] = useState(""),
    [status, setStatus] = useState(""),
    [confirmation, setConfirmation] = useState<{
      id: string;
      version: number;
      action: "pause" | "resume" | "end" | "repeat";
      release?: string;
    } | null>(null);
  const lock = useRef(false),
    enrollId = useRef(crypto.randomUUID());
  useEffect(() => {
    let live = true;
    void api
      .athlete(profile)
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
          setSelected((old) =>
            task?.kind === "grading"
              ? d.enrollments
                  .flatMap((e) => e.releases)
                  .find((r) =>
                    r.attempts.some((a) => a.state === "needs_grading"),
                  ) || old
              : old
                ? d.enrollments
                    .flatMap((e) => e.releases)
                    .find((r) => r.id === old.id) || null
                : null,
          );
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, profile, refresh, task]);
  async function action(run: () => Promise<void>, message: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await run();
      setStatus(message);
      setRefresh((n) => n + 1);
      onChanged?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The change was not saved. Retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function plans() {
    setError("");
    try {
      setCatalog(await api.catalog());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plans could not be loaded.");
    }
  }
  const current = data?.enrollments.find((e) =>
    ["active", "paused", "finished"].includes(e.state),
  );
  return (
    <section className="learning-athlete" aria-label="Weekly learning plan">
      <a
        className="text-button"
        href={`${import.meta.env.BASE_URL}weekly-learning-help.html`}
      >
        Weekly plan help
      </a>
      <LearningInbox api={api} profile={profile} />
      {owner && (
        <PlanEligibility
          api={api}
          profile={profile}
          onSaved={() => {
            setRefresh((n) => n + 1);
            onChanged?.();
          }}
        />
      )}
      <header>
        <h2 tabIndex={-1}>
          {staff
            ? "Weekly plan"
            : mode === "today"
              ? "This week’s plan"
              : mode === "library"
                ? "Released library"
                : mode === "progress"
                  ? "Progress & grades"
                  : "Your weekly plan"}
        </h2>
        <p>
          Sunday at midnight, Central time. Released weeks stay in the library
          while access is active.
        </p>
      </header>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRefresh((n) => n + 1)}>Reload plan</button>
        </div>
      )}
      {!data && !error && <p role="status">Loading weekly plan…</p>}
      {data && !data.enrollments.length && (
        <p>No weekly plan is enrolled yet.</p>
      )}
      {owner && (!current || current.state === "ended") && (
        <>
          <button disabled={busy} onClick={() => void plans()}>
            Start a weekly plan
          </button>
          {catalog && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(
                  () => api.enroll(enrollId.current, profile, plan),
                  "Plan enrolled. Week 1 is scheduled for the next Sunday; approved orientation is available now.",
                );
              }}
            >
              <label>
                Reusable plan
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  required
                >
                  <option value="">Choose a plan</option>
                  {catalog.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · {p.weeks} weeks
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Requires separately verified active package eligibility. No
                payment or access grant happens here.
              </p>
              <button disabled={busy || !plan}>Confirm enrollment</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCatalog(null)}
              >
                Cancel
              </button>
            </form>
          )}
        </>
      )}
      {mode === "progress" && data && (
        <ProgressSummary
          data={data}
          onOpen={(r) => {
            setSelected(r);
            setActiveQuiz(null);
          }}
        />
      )}
      {mode === "today" && data && data.enrollments.length > 0 && !current && (
        <p>
          No running plan. Your released history is in{" "}
          <a href="#app-workouts">Library</a> and{" "}
          <a href="#app-progress">Progress</a>.
        </p>
      )}
      {(mode === "progress"
        ? []
        : mode === "today"
          ? data?.enrollments.filter((e) => e.id === current?.id)
          : data?.enrollments
      )?.map((e) => (
        <section key={e.id} className="learning-enrollment">
          <header>
            <h3>{e.title}</h3>
            <span>
              {e.state === "finished" ? "All planned weeks released" : e.state}
            </span>
          </header>
          {!e.access_active && (
            <p role="status">
              Training access is inactive. Recorded progress and grades remain
              in history.
            </p>
          )}
          {e.state === "active" && (
            <p>
              Next release: {date(e.next_release_at)} Central · Week{" "}
              {e.next_week}
            </p>
          )}
          {e.state === "paused" && (
            <p>Releases and unfinished-work reminders are paused.</p>
          )}
          {owner && e.state !== "ended" && (
            <div className="learning-actions">
              {e.state === "active" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    setConfirmation({
                      id: e.id,
                      version: e.version,
                      action: "pause",
                    })
                  }
                >
                  Pause plan
                </button>
              )}
              {e.state === "paused" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    setConfirmation({
                      id: e.id,
                      version: e.version,
                      action: "resume",
                    })
                  }
                >
                  Resume next Sunday
                </button>
              )}
              <button
                disabled={busy}
                onClick={() =>
                  setConfirmation({
                    id: e.id,
                    version: e.version,
                    action: "end",
                  })
                }
              >
                End enrollment
              </button>
            </div>
          )}
          {owner && ["active", "paused"].includes(e.state) && (
            <FutureWeekOverride
              api={api}
              enrollment={e.id}
              plan={e.plan_id}
              nextWeek={e.next_week}
              onSaved={() => {
                setRefresh((n) => n + 1);
                onChanged?.();
              }}
            />
          )}
          <div className="learning-release-list" aria-label="Released library">
            {(mode === "today" ? e.releases.slice(0, 1) : e.releases).map(
              (r, index) => (
                <article key={r.id}>
                  <div>
                    <span>
                      {index === 0 && e.state !== "ended"
                        ? "CURRENT WEEK"
                        : "LIBRARY"}{" "}
                      ·{" "}
                      {r.week_number === 0
                        ? "Orientation"
                        : `Week ${r.week_number}`}
                    </span>
                    <h4>{r.title}</h4>
                    <p>
                      Available {date(r.available_at)} Central ·{" "}
                      {r.done
                        ? "Work submitted / reported complete"
                        : "Work remaining"}
                    </p>
                    {r.content_blocked && (
                      <p>Content withdrawn by staff. History is retained.</p>
                    )}
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setSelected(r);
                      setActiveQuiz(null);
                    }}
                  >
                    Open week
                  </button>
                  {owner && e.state !== "paused" && e.state !== "ended" && (
                    <button
                      disabled={busy || !e.access_active || r.content_blocked}
                      onClick={() =>
                        setConfirmation({
                          id: e.id,
                          version: e.version,
                          action: "repeat",
                          release: r.id,
                        })
                      }
                    >
                      Repeat this week
                    </button>
                  )}
                </article>
              ),
            )}
          </div>
        </section>
      ))}
      {confirmation && (
        <div
          className="learning-confirm"
          role="region"
          aria-label="Confirm plan change"
        >
          <h3>Confirm {confirmation.action}</h3>
          <p>
            {confirmation.action === "end"
              ? "Future releases stop. Existing progress and grades are retained. Package access is a separate setting."
              : confirmation.action === "repeat"
                ? "Create a fresh copy of this week for another attempt. Earlier completion and grades remain in history. The next new week moves to next Sunday."
                : confirmation.action === "resume"
                  ? "The next unreleased week becomes due next Sunday, without releasing a backlog."
                  : "Future releases and Friday reminders stop until this plan resumes."}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await api.control(
                  confirmation.id,
                  confirmation.action,
                  confirmation.version,
                  confirmation.release,
                );
                setConfirmation(null);
              }, "Plan updated.")
            }
          >
            Confirm change
          </button>
          <button disabled={busy} onClick={() => setConfirmation(null)}>
            Cancel
          </button>
        </div>
      )}
      {selected && (
        <section className="learning-open-week" aria-label="Open plan week">
          {activeQuiz ? (
            <QuizRunner
              key={selected.id + activeQuiz.id}
              api={api}
              quiz={activeQuiz}
              releaseId={selected.id}
              draft={selected.attempts
                .filter(
                  (a) =>
                    a.quiz_version_id === activeQuiz.id &&
                    a.actor_id === actor &&
                    a.state === "draft",
                )
                .at(-1)}
              onClose={() => setActiveQuiz(null)}
              onSaved={() => {
                setRefresh((n) => n + 1);
                onChanged?.();
              }}
            />
          ) : (
            <>
              <button onClick={() => setSelected(null)}>Close week</button>
              <h3>{selected.title}</h3>
              {selected.content_blocked && (
                <p>Staff withdrew this content. Contact your coach.</p>
              )}
              {selected.resources.map((resource) => (
                <Lesson
                  key={resource.id}
                  api={api}
                  resource={resource}
                  completed={selected.completed_items.includes(resource.id)}
                  canComplete={!staff && !!data?.can_submit}
                  busy={busy}
                  onComplete={() =>
                    void action(
                      () => api.complete(selected.id, resource.id),
                      "Practice completion reported. This records participation, not technique assessment.",
                    )
                  }
                />
              ))}
              {data?.is_guardian &&
                selected.completion_reviews
                  .filter((c) => c.status === "pending_parent")
                  .map((c) => (
                    <article key={c.item_id}>
                      <p>
                        Practice report awaiting your review:{" "}
                        {selected.resources.find((r) => r.id === c.item_id)
                          ?.content.title || "Assigned lesson"}
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(
                            () =>
                              api.reviewCompletion(
                                selected.id,
                                c.item_id,
                                "approved",
                                c.version,
                              ),
                            "Practice report approved.",
                          )
                        }
                      >
                        Approve practice report
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(
                            () =>
                              api.reviewCompletion(
                                selected.id,
                                c.item_id,
                                "needs_repeat",
                                c.version,
                              ),
                            "Practice marked for another attempt.",
                          )
                        }
                      >
                        Practice again together
                      </button>
                    </article>
                  ))}
              {selected.quizzes.map((q) => (
                <article key={q.id} className="learning-quiz-card">
                  <h4>{q.title}</h4>
                  <p>
                    {q.questions.length
                      ? q.questions.length + " questions · "
                      : ""}
                    {q.total_points} points
                  </p>
                  {!staff && data?.can_submit && q.questions.length > 0 && (
                    <button onClick={() => setActiveQuiz(q)}>
                      {selected.attempts.some(
                        (a) =>
                          a.quiz_version_id === q.id &&
                          a.actor_id === actor &&
                          a.state === "draft",
                      )
                        ? "Continue quiz"
                        : selected.attempts.some(
                              (a) =>
                                a.quiz_version_id === q.id &&
                                a.actor_id === actor,
                            )
                          ? "Start another attempt"
                          : "Take quiz"}
                    </button>
                  )}
                  {selected.attempts
                    .filter((a) => a.quiz_version_id === q.id)
                    .map((a) => (
                      <AttemptHistory
                        key={a.id}
                        attempt={a}
                        quiz={q}
                        api={api}
                        staff={staff}
                        onSaved={() => {
                          setRefresh((n) => n + 1);
                          onChanged?.();
                        }}
                      />
                    ))}
                </article>
              ))}
            </>
          )}
        </section>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
function Lesson({
  api,
  resource,
  completed,
  canComplete,
  busy,
  onComplete,
}: {
  api: LearningTransport;
  resource: LearningRelease["resources"][number];
  completed: boolean;
  canComplete: boolean;
  busy: boolean;
  onComplete: () => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const { content } = resource;
  async function open() {
    setLoading(true);
    setError("");
    try {
      setUrl(await api.media(resource.asset_path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Media unavailable.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <article className="learning-lesson">
      <h4>{content.title}</h4>
      {!url && (
        <button disabled={loading} onClick={() => void open()}>
          {loading ? "Loading media…" : "Open lesson media"}
        </button>
      )}
      {url &&
        (resource.asset_type.startsWith("video/") ? (
          <video controls playsInline preload="metadata" src={url} />
        ) : resource.asset_type.startsWith("image/") ? (
          <img src={url} alt={content.title} />
        ) : (
          <a href={url} target="_blank" rel="noreferrer">
            Open lesson document
          </a>
        ))}
      {error && <p role="alert">{error}</p>}
      <p>{content.lesson}</p>
      <p>
        {content.minutes ? `${content.minutes} minutes · ` : ""}
        {content.equipment}
      </p>
      {content.steps && (
        <ol>
          {content.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
      {content.cue && (
        <p>
          <strong>Coaching cue:</strong> {content.cue}
        </p>
      )}
      {canComplete && (
        <button disabled={busy || completed} onClick={onComplete}>
          {completed ? "Practice reported complete" : "Mark practice complete"}
        </button>
      )}
    </article>
  );
}
function AttemptHistory({
  attempt,
  quiz,
  api,
  staff,
  onSaved,
}: {
  attempt: LearningAttempt;
  quiz: LearningQuiz;
  api: LearningTransport;
  staff: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [marks, setMarks] = useState<Record<string, number>>({}),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const latest = attempt.grades.at(-1);
  const total =
    (attempt.objective_points || 0) +
    Object.values(latest?.points || {}).reduce((sum, n) => sum + n, 0);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.grade(attempt.id, marks, feedback, latest?.revision || 0);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grade not saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="learning-attempt">
      <summary>
        {attempt.state === "draft"
          ? "Saved draft"
          : attempt.state === "needs_grading"
            ? "Submitted · awaiting written grade"
            : `Score ${total} / ${quiz.total_points}`}
        {attempt.submitted_at ? " · " + date(attempt.submitted_at) : ""}
      </summary>
      {quiz.questions.map((q) => (
        <div key={q.id}>
          <strong>{q.question}</strong>
          <p>
            {typeof attempt.answers[q.id] === "number"
              ? q.options[Number(attempt.answers[q.id])]
              : String(attempt.answers[q.id] || "No answer saved")}
          </p>
        </div>
      ))}
      {attempt.grades.map((g) => (
        <div key={g.revision}>
          <p>
            Grade revision {g.revision} · {date(g.graded_at)} Central
          </p>
          <p>{g.feedback}</p>
        </div>
      ))}
      {staff &&
        attempt.state !== "draft" &&
        quiz.questions.some((q) => q.type === "written") && (
          <button
            onClick={() => {
              setMarks(latest?.points || {});
              setFeedback(latest?.feedback || "");
              setEditing(true);
            }}
          >
            Grade written answers
          </button>
        )}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {quiz.questions
            .filter((q) => q.type === "written")
            .map((q) => (
              <label key={q.id}>
                {q.question} · points / {q.points}
                <input
                  type="number"
                  min={0}
                  max={q.points}
                  step="0.5"
                  required
                  value={marks[q.id] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setMarks((m) => ({ ...m, [q.id]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
          <label>
            Feedback
            <textarea
              maxLength={4000}
              value={feedback}
              disabled={busy}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </label>
          <button disabled={busy}>Save grade revision</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}

function ProgressSummary({
  data,
  onOpen,
}: {
  data: LearningAthleteData;
  onOpen: (release: LearningRelease) => void;
}) {
  const releases = data.enrollments.flatMap((e) => e.releases),
    attempts = releases.flatMap((r) => r.attempts),
    submitted = attempts.filter((a) => a.submitted_at),
    pending = attempts.filter((a) => a.state === "needs_grading");
  return (
    <section aria-label="Learning progress">
      <p>
        {releases.filter((r) => r.done).length} of {releases.length} released
        weeks submitted / reported complete · {submitted.length} quiz
        submissions · {pending.length} awaiting written grading
      </p>
      <p>
        These records track participation and quiz results, not athletic
        ability.
      </p>
      {!releases.length && <p>No released learning history yet.</p>}
      {releases.map((r) => (
        <article key={r.id} className="learning-quiz-card">
          <h3>{r.title}</h3>
          {!r.attempts.length && <p>No quiz attempts observed.</p>}
          {r.attempts.map((a) => {
            const q = r.quizzes.find((q) => q.id === a.quiz_version_id);
            const marks = a.grades.at(-1)?.points || {};
            const score =
              (a.objective_points || 0) +
              Object.values(marks).reduce((n, v) => n + v, 0);
            return (
              <p key={a.id}>
                {q?.title || "Assigned quiz"}:{" "}
                {a.state === "draft"
                  ? "Draft saved"
                  : a.state === "needs_grading"
                    ? "Submitted · awaiting written grade"
                    : `${score} / ${q?.total_points ?? "—"}`}
              </p>
            );
          })}
          {r.completion_reviews.filter((c) => c.status === "pending_parent")
            .length > 0 && (
            <p>
              Practice reports awaiting parent review:{" "}
              {
                r.completion_reviews.filter(
                  (c) => c.status === "pending_parent",
                ).length
              }
            </p>
          )}
          <button onClick={() => onOpen(r)}>Open history for {r.title}</button>
        </article>
      ))}
    </section>
  );
}
