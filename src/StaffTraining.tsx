import { LearningBankConnected } from "./learning/LearningBankConnected";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileUp, Plus, Search } from "lucide-react";
import { AssetPreview, Modal, Notice, Tag } from "./components";
import { MemberAccountPage } from "./MemberAccount";
import { PrivateAccessMessage } from "./PrivateShell";
import { isStaff } from "./roles";
import type { SharedState } from "./useSharedContent";
import type { Drill } from "./model";
import { Workouts, type SavedWorkout } from "./workouts";
import { AssignWorkout } from "./WorkoutBuilder";
import { TrainingAccess } from "./TrainingAccess";
import { StaffServiceDashboard } from "./StaffServiceDashboard";
import { staffHandoff } from "./staffHandoff";
import "./staffWorkflows.css";

import { StaffLink } from "./StaffLinks";
import { trainingUrl } from "./staffNavigation";
function unavailable(shared: SharedState) {
  return (
    !shared.signedIn ||
    !shared.service ||
    !shared.accessReady ||
    !!shared.accessError
  );
}
export function TrainingWorkspace({ shared }: { shared: SharedState }) {
  if (unavailable(shared)) return <MemberAccountPage shared={shared} />;
  if (!isStaff(shared.role))
    return (
      <PrivateAccessMessage signedIn title="Staff access is required.">
        Your assigned practice is in Today.
      </PrivateAccessMessage>
    );
  return (
    <TrainingHome
      key={`${shared.session!.user.id}:${shared.role}`}
      shared={shared}
    />
  );
}
function TrainingHome({ shared }: { shared: SharedState }) {
  const api = useMemo(
    () => new Workouts(shared.service!.client),
    [shared.service],
  );
  const [workouts, setWorkouts] = useState<SavedWorkout[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<"workouts" | "lessons" | "plans">(() =>
      new URLSearchParams(location.search).get("trainingView") === "lessons"
        ? "lessons"
        : "workouts",
    ),
    [query, setQuery] = useState(
      () => new URLSearchParams(location.search).get("trainingSearch") || "",
    );
  const [preview, setPreview] = useState<Drill | null>(null);
  useEffect(() => {
    let active = true;
    void api
      .list()
      .then((rows) => {
        if (active) {
          setWorkouts(rows);
          setLoading(false);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [api, attempt]);
  const resources = shared.resources.filter((d) =>
    shared.canEditResource(d.id),
  );
  const match = (value: string) =>
    value.toLowerCase().includes(query.trim().toLowerCase());
  const visible = workouts.filter((w) => match(w.title));
  const lessons = resources.filter((d) =>
    match([d.title, ...d.ages, ...d.positions, d.skill].join(" ")),
  );
  function bankQuery(value: string) {
    setQuery(value);
    history.replaceState(
      history.state,
      "",
      trainingUrl("training", { trainingSearch: value }),
    );
  }
  function bankView(value: "workouts" | "lessons" | "plans") {
    setView(value);
    setQuery("");
    history.replaceState(
      history.state,
      "",
      trainingUrl("training", { trainingView: value, trainingSearch: "" }),
    );
  }
  function openLesson(drill: Drill, purpose: "workout" | "editor") {
    staffHandoff(shared.session!.user.id, drill.id, purpose);
    history.pushState(
      null,
      "",
      trainingUrl(purpose === "workout" ? "workout-builder" : "coach", {
        trainingWorkout: "",
      }),
    );
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  if (view === "plans" && shared.learningPlansEnabled)
    return (
      <main className="page staff-workflow training-home">
        <button
          className="button secondary"
          onClick={() => bankView("workouts")}
        >
          Back to training bank
        </button>
        <LearningBankConnected shared={shared} />
      </main>
    );
  return (
    <main className="page staff-workflow training-home">
      <header className="workflow-intro">
        <div>
          <Tag>TRAINING</Tag>
          <h1 tabIndex={-1}>Your training bank.</h1>
          <p>Create once. Reuse a lesson or assemble a complete practice.</p>
        </div>
        <div className="actions">
          {shared.learningPlansEnabled && (
            <button className="button" onClick={() => bankView("plans")}>
              Weekly plans & quizzes
            </button>
          )}
          <a className="button" href="#coach">
            <FileUp size={18} /> Upload a lesson
          </a>
          <StaffLink
            route="workout-builder"
            values={{ trainingWorkout: "" }}
            className="button secondary"
          >
            <Plus size={18} /> New workout
          </StaffLink>
        </div>
      </header>
      <div className="workflow-library-tools">
        <div
          className="workflow-segments"
          role="group"
          aria-label="Training bank view"
        >
          <button
            aria-pressed={view === "workouts"}
            onClick={() => {
              bankView("workouts");
              setQuery("");
            }}
          >
            Workouts <span>{loading ? "…" : workouts.length}</span>
          </button>
          <button
            aria-pressed={view === "lessons"}
            onClick={() => {
              bankView("lessons");
              setQuery("");
            }}
          >
            Lessons <span>{shared.libraryReady ? resources.length : "…"}</span>
          </button>
        </div>
        <label className="workflow-search">
          <Search size={18} />
          <span className="staff-sr-only">Search training bank</span>
          <input
            type="search"
            aria-label="Search training bank"
            placeholder={
              view === "workouts"
                ? "Find a workout"
                : "Title, age, position or skill"
            }
            value={query}
            onChange={(e) => bankQuery(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={() => {
              setLoading(true);
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Retry training bank
          </button>
        </div>
      )}
      {view === "workouts" ? (
        <section aria-label="Reusable workouts">
          {loading && !error && <p role="status">Loading saved workouts…</p>}
          {!loading && !error && !visible.length && (
            <div className="workflow-empty">
              <h2>
                {workouts.length
                  ? "No workouts match."
                  : "Build your first workout."}
              </h2>
              <p>
                {workouts.length
                  ? "Try another name or clear the search."
                  : "Choose approved lessons, put the drills in order, then save the practice."}
              </p>
              {query ? (
                <button
                  className="button secondary"
                  onClick={() => bankQuery("")}
                >
                  Clear search
                </button>
              ) : (
                <a className="button" href="#workout-builder">
                  Create workout
                </a>
              )}
            </div>
          )}
          <div className="workflow-bank">
            {visible.map((w) => (
              <article key={w.id} className="workflow-bank-row">
                <div>
                  <h2>{w.title}</h2>
                  <p>
                    {w.resource_ids.length} drills · saved version {w.version}
                  </p>
                </div>
                <div className="actions">
                  <StaffLink
                    route="workout-builder"
                    values={{ trainingWorkout: w.id }}
                  >
                    Edit workout
                  </StaffLink>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section aria-label="Reusable lessons">
          {!shared.libraryReady && <p role="status">Loading your lessons…</p>}
          {shared.libraryReady && !lessons.length && (
            <div className="workflow-empty">
              <h2>
                {query ? "No lessons match." : "Your lessons will appear here."}
              </h2>
              <p>
                {query
                  ? "Try another search."
                  : "Upload a lesson, then complete the existing content-review process before using it in a workout."}
              </p>
              {query && (
                <button onClick={() => bankQuery("")}>Clear search</button>
              )}
            </div>
          )}
          <div className="workflow-bank">
            {lessons.map((d) => (
              <article key={d.id} className="workflow-bank-row">
                <div>
                  <h2>{d.title}</h2>
                  <p>
                    {d.ages.join(", ")} · {d.minutes} min ·{" "}
                    {d.reviewStage || "Review status unavailable"}
                  </p>
                </div>
                <div className="actions">
                  <button className="text-button" onClick={() => setPreview(d)}>
                    Preview {d.title}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => openLesson(d, "editor")}
                  >
                    Edit lesson
                  </button>
                  {d.visibility === "member_only" &&
                    d.reviewStage === "approved" && (
                      <button
                        className="button secondary"
                        onClick={() => openLesson(d, "workout")}
                      >
                        Use in a workout
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <details className="workflow-secondary">
        <summary>Assignment and publishing details</summary>
        <p>
          Open an athlete’s record to assign a saved workout. Future uploads and
          template edits do not update existing assignments automatically.
          Package-based weekly delivery is not connected.
        </p>
        {shared.role === "owner" ? (
          <a href="#training-access">Individual lesson & review permissions</a>
        ) : (
          <p>
            An Owner assigns workouts and manages individual lesson permissions.
          </p>
        )}
        <a href="#content-review">Open drafts & approvals</a>
      </details>
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)}>
          {preview.assetId ? (
            <AssetPreview drill={preview} />
          ) : (
            <Notice>No coaching demonstration is attached.</Notice>
          )}
          <ol>
            {preview.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p>Illustrative training pending qualified review.</p>
        </Modal>
      )}
    </main>
  );
}
export function AssignTrainingWorkspace({ shared }: { shared: SharedState }) {
  if (unavailable(shared)) return <MemberAccountPage shared={shared} />;
  if (shared.role !== "owner")
    return (
      <PrivateAccessMessage signedIn title="An Owner assigns workouts.">
        {isStaff(shared.role)
          ? "You can prepare lessons and workouts in Training. Coach-to-athlete responsibility stays in Athletes."
          : "Your assigned practice is in Today. Contact the team if training is missing."}
      </PrivateAccessMessage>
    );
  return <ChooseAssignment key={shared.session!.user.id} shared={shared} />;
}
function ChooseAssignment({ shared }: { shared: SharedState }) {
  const api = useMemo(
    () => new Workouts(shared.service!.client),
    [shared.service],
  );
  const [rows, setRows] = useState<SavedWorkout[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const read = () =>
    new URLSearchParams(location.search).get("trainingWorkout") || "";
  const [id, setId] = useState(read),
    [query, setQuery] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    void api
      .list()
      .then((r) => {
        if (active) {
          setRows(r);
          setLoading(false);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [api, attempt]);
  useEffect(() => {
    const back = () => {
      setId(read());
      requestAnimationFrame(() => heading.current?.focus());
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const selected = rows.find((w) => w.id === id);
  function choose(next: string) {
    setId(next);
    history.pushState(
      null,
      "",
      trainingUrl("training-assign", { trainingWorkout: next }),
    );
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <main className="page staff-workflow workflow-assignment">
      <a href="#training" className="text-button">
        <ArrowLeft size={16} /> Back to Training
      </a>
      <header className="workflow-intro">
        <div>
          <Tag>ASSIGN TRAINING</Tag>
          <h1 ref={heading} tabIndex={-1}>
            {selected ? "Who is this workout for?" : "Choose a saved workout."}
          </h1>
          <p>
            Assign the full practice in one action. The current athlete plan is
            shown before you confirm a replacement.
          </p>
        </div>
      </header>
      <ol className="workflow-steps" aria-label="Assignment steps">
        <li className={selected ? "done" : "current"}>1. Workout</li>
        <li className={selected ? "current" : ""}>2. Athlete</li>
        <li>3. Review & confirm</li>
      </ol>
      {loading && !error && <p role="status">Loading saved workouts…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            Retry workouts
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        (selected ? (
          <>
            <div className="workflow-selection">
              <div>
                <strong>{selected.title}</strong>
                <p>
                  {selected.resource_ids.length} ordered drills · version{" "}
                  {selected.version}
                </p>
              </div>
              <button className="text-button" onClick={() => choose("")}>
                Choose a different workout
              </button>
            </div>
            <AssignWorkout service={api} workout={selected} dirty={false} />
            <StaffLink route="training" className="text-button">
              Cancel assignment
            </StaffLink>
          </>
        ) : (
          <>
            <label className="workflow-search">
              Find a saved workout
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {id && (
              <p role="status">
                That saved workout is unavailable in your scope. Choose another.
              </p>
            )}
            <div className="workflow-bank">
              {rows
                .filter((w) =>
                  w.title.toLowerCase().includes(query.trim().toLowerCase()),
                )
                .map((w) => (
                  <button
                    key={w.id}
                    className="workflow-bank-row"
                    onClick={() => choose(w.id)}
                  >
                    <span>
                      <strong>{w.title}</strong>
                      <small>
                        {w.resource_ids.length} drills · version {w.version}
                      </small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
            </div>
            {!rows.length && (
              <div className="workflow-empty">
                <h2>No saved workout yet.</h2>
                <a href="#workout-builder" className="button">
                  Build your first workout
                </a>
              </div>
            )}
          </>
        ))}
    </main>
  );
}
export function IndividualTrainingAccess({ shared }: { shared: SharedState }) {
  if (unavailable(shared)) return <MemberAccountPage shared={shared} />;
  if (shared.role !== "owner")
    return (
      <PrivateAccessMessage signedIn title="Owner access is required.">
        Only an Owner manages individual lesson and review permissions.
      </PrivateAccessMessage>
    );
  return (
    <main className="page staff-workflow">
      <a className="text-button" href="#training">
        <ArrowLeft size={16} /> Back to Training
      </a>
      <header className="workflow-intro">
        <div>
          <Tag>INDIVIDUAL PERMISSIONS</Tag>
          <h1 tabIndex={-1}>Lesson & review access.</h1>
          <p>
            Use this for account-wide review permissions or selected lessons. To
            assign a complete practice, use Assign workout in Training.
          </p>
        </div>
      </header>
      <TrainingAccess shared={shared} />
    </main>
  );
}

export function StaffDeliveryWorkspace({ shared }: { shared: SharedState }) {
  if (unavailable(shared)) return <MemberAccountPage shared={shared} />;
  if (!isStaff(shared.role))
    return (
      <PrivateAccessMessage signedIn title="Staff access is required.">
        Your private notices are in your own training workspace.
      </PrivateAccessMessage>
    );
  return (
    <main className="page staff-workflow">
      <a href="#staff-settings" className="text-button">
        <ArrowLeft size={16} /> Staff & settings
      </a>
      <header className="workflow-intro">
        <div>
          <Tag>DELIVERY CHECKS</Tag>
          <h1 tabIndex={-1}>Keep delivery on track.</h1>
          <p>
            Review expected content and unresolved service items. Background
            delivery and reminder sending are not activated here.
          </p>
        </div>
      </header>
      <StaffServiceDashboard
        key={`${shared.session!.user.id}:${shared.role}`}
        client={shared.service!.client}
        actor={shared.session!.user.id}
        role={shared.role as "owner" | "manager" | "coach"}
        enabled={shared.staffRosterEnabled}
        monitoring={shared.deliveryMonitoringEnabled}
        operationalEmails={shared.staffNotificationEmailsEnabled}
        mode="settings"
      />
    </main>
  );
}
