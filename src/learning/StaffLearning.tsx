import { GroupResults } from "./GroupResults";
import { LearningInbox } from "./LearningInbox";
import { useEffect, useRef, useState } from "react";
import type { LearningTransport, LearningCatalog } from "./api";
import { QuizImportPanel } from "./QuizImportPanel";
import { PACKAGE_PROPOSALS } from "../packageProposals";
import "./learning.css";
type Profile = { id: string; name: string };
export function StaffLearning({
  api,
  resources,
  profiles = [],
  owner = false,
  approver = false,
}: {
  api: LearningTransport;
  resources: { id: string; title: string }[];
  profiles?: Profile[];
  owner?: boolean;
  approver?: boolean;
}) {
  const [tab, setTab] = useState<"plans" | "quizzes" | "groups">("plans"),
    [catalog, setCatalog] = useState<LearningCatalog | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    void api
      .catalog()
      .then((c) => {
        if (live) {
          setCatalog(c);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, refresh]);
  async function action(run: () => Promise<void>, message: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await run();
      setStatus(message);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The change was not saved. Retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="learning-staff">
      <h2>Weekly plans & quizzes</h2>
      <LearningInbox api={api} />
      {owner && catalog && (
        <LearningRules
          api={api}
          catalog={catalog}
          onSaved={() => setRefresh((n) => n + 1)}
        />
      )}
      <p>
        Build approved weeks ahead of time. Enroll an athlete from their
        profile; releases then follow their own plan sequence.
      </p>
      <div
        className="learning-actions"
        role="group"
        aria-label="Learning bank view"
      >
        {(["plans", "quizzes", "groups"] as const).map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === "plans"
              ? "Plans"
              : t === "quizzes"
                ? "Quiz uploads"
                : "Groups"}
          </button>
        ))}
      </div>
      {!catalog && !error && <p role="status">Loading learning bank…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRefresh((n) => n + 1)}>
            Reload learning bank
          </button>
        </div>
      )}
      {status && <p role="status">{status}</p>}
      {catalog && tab === "quizzes" && (
        <>
          <QuizImportPanel
            onPublish={async (title, q, operation) => {
              await api.importQuiz(title, q, operation);
              setRefresh((n) => n + 1);
            }}
          />
          <h3>Saved quiz versions</h3>
          {!catalog.quizzes.length && <p>No quizzes uploaded yet.</p>}
          {catalog.quizzes.map((q) => (
            <details key={q.id}>
              <summary>
                {q.title} · version {q.revision} · {q.total_points} points
              </summary>
              <p>
                {q.questions.length} questions. Saved versions cannot be edited;
                upload a new version for future weeks.
              </p>
            </details>
          ))}
        </>
      )}
      {catalog && tab === "plans" && (
        <PlanBank
          catalog={catalog}
          resources={resources}
          busy={busy}
          approver={approver}
          action={action}
          api={api}
        />
      )}
      {catalog && tab === "groups" && (
        <GroupBank
          api={api}
          catalog={catalog}
          profiles={profiles}
          owner={owner}
          busy={busy}
          action={action}
        />
      )}
    </section>
  );
}
function PlanBank({
  catalog,
  resources,
  busy,
  approver,
  api,
  action,
}: {
  catalog: LearningCatalog;
  resources: { id: string; title: string }[];
  busy: boolean;
  approver: boolean;
  api: LearningTransport;
  action: (run: () => Promise<void>, message: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false),
    [title, setTitle] = useState(""),
    [weeks, setWeeks] = useState(8),
    [packages, setPackages] = useState<string[]>([]),
    [selected, setSelected] = useState(""),
    [week, setWeek] = useState(1),
    [weekTitle, setWeekTitle] = useState(""),
    [lessons, setLessons] = useState<string[]>([]),
    [quizzes, setQuizzes] = useState<string[]>([]);
  const planId = useRef(crypto.randomUUID()),
    weekId = useRef(crypto.randomUUID());
  const plan = catalog.plans.find((p) => p.id === selected);
  function toggle(value: string, values: string[], set: (v: string[]) => void) {
    set(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
    weekId.current = crypto.randomUUID();
  }
  return (
    <>
      <button disabled={busy} onClick={() => setCreating(true)}>
        New reusable plan
      </button>
      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await api.createPlan(
                planId.current,
                title,
                weeks,
                packages,
                [],
                [],
              );
              setCreating(false);
              setTitle("");
              planId.current = crypto.randomUUID();
            }, "Reusable plan saved. Add its weeks before enrollment.");
          }}
        >
          <label>
            Plan name
            <input
              value={title}
              required
              maxLength={160}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Number of weekly releases
            <input
              type="number"
              min={1}
              max={104}
              value={weeks}
              required
              disabled={busy}
              onChange={(e) => setWeeks(Number(e.target.value))}
            />
          </label>
          <fieldset disabled={busy}>
            <legend>
              Eligible package IDs (proposed packages; not proof of payment)
            </legend>
            {PACKAGE_PROPOSALS.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={packages.includes(p.id)}
                  onChange={() => toggle(p.id, packages, setPackages)}
                />
                {p.name}
              </label>
            ))}
          </fieldset>
          <p>
            Content must still match the athlete. Age/position targeting can be
            specified through the plan configuration before rollout.
          </p>
          <button disabled={busy}>Save plan</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCreating(false)}
          >
            Cancel
          </button>
        </form>
      )}
      <label>
        Open plan
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setWeek(1);
            setLessons([]);
            setQuizzes([]);
            weekId.current = crypto.randomUUID();
          }}
        >
          <option value="">Choose a reusable plan</option>
          {catalog.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.weeks} weeks
            </option>
          ))}
        </select>
      </label>
      {!catalog.plans.length && <p>No reusable plans saved yet.</p>}
      {plan && (
        <>
          <h3>{plan.title}</h3>
          <p>
            Orientation is week 0 (optional). Week 1 starts the next Sunday.
            Each saved week is a new immutable version; existing releases and
            grades never change.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await api.saveWeek(
                  weekId.current,
                  plan.id,
                  week,
                  weekTitle,
                  lessons,
                  quizzes,
                );
                weekId.current = crypto.randomUUID();
                setLessons([]);
                setQuizzes([]);
                setWeekTitle("");
              }, "Week version saved as a draft. Approval is required before release.");
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Week number
                <input
                  type="number"
                  min={0}
                  max={plan.weeks}
                  required
                  value={week}
                  onChange={(e) => {
                    setWeek(Number(e.target.value));
                    weekId.current = crypto.randomUUID();
                  }}
                />
              </label>
              <label>
                Week title
                <input
                  maxLength={160}
                  required
                  value={weekTitle}
                  onChange={(e) => {
                    setWeekTitle(e.target.value);
                    weekId.current = crypto.randomUUID();
                  }}
                />
              </label>
              <fieldset>
                <legend>Lessons / drills</legend>
                {resources.length ? (
                  resources.map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={lessons.includes(r.id)}
                        onChange={() => toggle(r.id, lessons, setLessons)}
                      />
                      {r.title}
                    </label>
                  ))
                ) : (
                  <p>Upload lessons in the training bank first.</p>
                )}
              </fieldset>
              <fieldset>
                <legend>Uploaded quiz versions</legend>
                {catalog.quizzes.map((q) => (
                  <label key={q.id}>
                    <input
                      type="checkbox"
                      checked={quizzes.includes(q.id)}
                      onChange={() => toggle(q.id, quizzes, setQuizzes)}
                    />
                    {q.title} · version {q.revision}
                  </label>
                ))}
              </fieldset>
              <button disabled={!lessons.length && !quizzes.length}>
                Save week draft
              </button>
            </fieldset>
          </form>
          <h4>Week readiness</h4>
          {plan.weeks_content.map((w) => (
            <article key={w.id} className="learning-week-status">
              <div>
                <strong>
                  {w.week_number === 0
                    ? "Orientation"
                    : `Week ${w.week_number}`}{" "}
                  · {w.title}
                </strong>
                <p>
                  Version {w.revision} ·{" "}
                  {w.retracted_at
                    ? "Withdrawn"
                    : w.ready
                      ? "Approved & ready"
                      : w.approved_at
                        ? "Blocked: lesson version or media changed"
                        : "Draft, not released"}
                </p>
              </div>
              {approver && !w.approved_at && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () => api.approveWeek(w.id),
                      "Week approved. Only complete approved uploads can release.",
                    )
                  }
                >
                  Approve week
                </button>
              )}
            </article>
          ))}
        </>
      )}
    </>
  );
}
function GroupBank({
  api,
  catalog,
  profiles,
  owner,
  busy,
  action,
}: {
  api: LearningTransport;
  catalog: LearningCatalog;
  profiles: Profile[];
  owner: boolean;
  busy: boolean;
  action: (run: () => Promise<void>, message: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState(""),
    [plan, setPlan] = useState(""),
    [confirm, setConfirm] = useState(false);
  const groupId = useRef(crypto.randomUUID()),
    operation = useRef(crypto.randomUUID());
  return (
    <>
      <h3>Athlete groups</h3>
      <p>
        Group enrollment starts each athlete at their own week 1. Individual
        histories and overrides stay separate.
      </p>
      {!owner && (
        <p>
          Only Owners manage enrollment groups. Your roster remains limited to
          the athletes you may serve.
        </p>
      )}
      {catalog.cohorts.map((c) => (
        <p key={c.id}>
          {c.title} · {c.profiles.length} visible athletes
        </p>
      ))}
      {catalog.cohorts.map((c) => (
        <GroupResults key={c.id} api={api} id={c.id} title={c.title} />
      ))}
      {owner && (
        <>
          <details>
            <summary>Create a group</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await api.saveCohort(groupId.current, title, selected);
                  groupId.current = crypto.randomUUID();
                  setTitle("");
                  setSelected([]);
                }, "Group saved. No athlete was enrolled yet.");
              }}
            >
              <label>
                Group name
                <input
                  required
                  maxLength={100}
                  value={title}
                  disabled={busy}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Find athletes
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <fieldset disabled={busy}>
                <legend>Group athletes · {selected.length} selected</legend>
                {profiles
                  .filter((p) =>
                    p.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <label key={p.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(p.id)}
                        onChange={() =>
                          setSelected((s) =>
                            s.includes(p.id)
                              ? s.filter((x) => x !== p.id)
                              : [...s, p.id],
                          )
                        }
                      />
                      {p.name}
                    </label>
                  ))}
              </fieldset>
              <button disabled={busy || !selected.length}>Save group</button>
            </form>
          </details>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConfirm(true);
            }}
          >
            <label>
              Group
              <select
                required
                value={group}
                disabled={busy}
                onChange={(e) => {
                  setGroup(e.target.value);
                  operation.current = crypto.randomUUID();
                  setConfirm(false);
                }}
              >
                <option value="">Choose a group</option>
                {catalog.cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · {c.profiles.length} athletes
                  </option>
                ))}
              </select>
            </label>
            <label>
              Plan
              <select
                required
                value={plan}
                disabled={busy}
                onChange={(e) => {
                  setPlan(e.target.value);
                  operation.current = crypto.randomUUID();
                  setConfirm(false);
                }}
              >
                <option value="">Choose a plan</option>
                {catalog.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>Review group enrollment</button>
          </form>
          {confirm && (
            <section aria-label="Confirm group enrollment">
              <p>
                Enroll{" "}
                {catalog.cohorts.find((c) => c.id === group)?.profiles.length}{" "}
                athletes into {catalog.plans.find((p) => p.id === plan)?.title}?
                Everyone must have verified active eligibility and no running
                plan. If any athlete is ineligible, nobody is enrolled. Current
                plans are never overwritten.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await api.enrollCohort(group, plan, operation.current);
                    setConfirm(false);
                  }, "Group enrolled. Each athlete has a separate weekly sequence.")
                }
              >
                Confirm group enrollment
              </button>
              <button disabled={busy} onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}

function LearningRules({
  api,
  catalog,
  onSaved,
}: {
  api: LearningTransport;
  catalog: LearningCatalog;
  onSaved: () => void;
}) {
  const [clock, setClock] = useState(catalog.rules.friday_time.slice(0, 5)),
    [threshold, setThreshold] = useState(catalog.rules.low_ready_weeks),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.configureRules(clock, threshold);
      setStatus(
        "Delivery rule defaults saved. This does not enable the scheduler or email.",
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rules were not saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Owner: weekly delivery rules</summary>
      <p>
        Releases: Sunday at 00:00 America/Chicago, automatically adjusted for
        daylight saving. Reminders: Friday, in-app only for unfinished work.
        17:00 is an initial default.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Friday reminder time · Central
          <input
            type="time"
            required
            value={clock}
            disabled={busy}
            onChange={(e) => setClock(e.target.value)}
          />
        </label>
        <label>
          Alert staff below this many ready weeks
          <input
            type="number"
            min={1}
            max={8}
            required
            value={threshold}
            disabled={busy}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <button disabled={busy}>Save rule defaults</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </details>
  );
}
