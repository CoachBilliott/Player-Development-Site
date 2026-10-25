import {
  PracticeResumes,
  resumeItems,
  type PracticeResume,
} from "./practiceResume";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { DRILLS } from "./data";
import { planFor, type Profile, type Drill } from "./model";
import type { PrivatePlayer } from "./accounts";
import {
  WORKOUT_LABELS,
  type FamilyService,
  type FamilyState,
  type AthleteWorkout,
} from "./family";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AthleteVideoReview } from "./VideoReview";
import { AssetPreview, Field, Modal, Notice, Tag } from "./components";
import { orderedWorkoutPlan, type AthleteAssignment } from "./workouts";
export function AthleteTraining({
  player,
  service,
  client,
  demo = false,
  onConnectionChange,
  junior = false,
  view = "all",
}: {
  player: PrivatePlayer;
  service: FamilyService;
  client?: SupabaseClient;
  demo?: boolean;
  onConnectionChange?: () => Promise<void>;
  junior?: boolean;
  view?: "all" | "today" | "workouts" | "progress";
}) {
  const [state, setState] = useState<FamilyState | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [permission, setPermission] = useState<boolean | null>(null),
    [code, setCode] = useState(""),
    [copyStatus, setCopyStatus] = useState(""),
    [remove, setRemove] = useState(false),
    [session, setSession] = useState<{
      id: string;
      drills: string[];
      items: Drill[];
      assignment?: AthleteAssignment;
      initialIndex?: number;
    } | null>(null),
    [review, setReview] = useState<{
      workout: AthleteWorkout;
      decision: "approved" | "needs_repeat";
    } | null>(null);
  const [available, setAvailable] = useState<Drill[]>([]);
  const resumes = useMemo(
    () => (client && !demo ? new PracticeResumes(client) : null),
    [client, demo],
  );
  const [savedPractice, setSavedPractice] = useState<PracticeResume | null>(
    null,
  );
  const [discardSaved, setDiscardSaved] = useState(false);
  const savedPracticeRef = useRef<PracticeResume | null>(null);
  const activeResumeVersion = useRef(0);

  const lock = useRef(false);
  useEffect(() => {
    let stopped = false;
    const refresh = () =>
      void Promise.all([
        service.load(player),
        demo
          ? Promise.resolve(DRILLS)
          : service.plan
            ? service.plan(player)
            : Promise.resolve([]),
        resumes ? resumes.load(player.id) : Promise.resolve(null),
      ])
        .then(([value, items, paused]) => {
          if (!stopped) {
            setState(value);
            setAvailable(items);
            setSavedPractice(paused);
            savedPracticeRef.current = paused;
            setError("");
          }
        })
        .catch((e: Error) => {
          if (!stopped) {
            setState(null);
            setAvailable([]);
            setError(e.message);
          }
        });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      stopped = true;
      window.removeEventListener("focus", refresh);
    };
  }, [service, player, demo, resumes]);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not be completed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    const [next, items, paused] = await Promise.all([
      service.load(player),
      demo
        ? Promise.resolve(DRILLS)
        : service.plan
          ? service.plan(player)
          : Promise.resolve([]),
      resumes ? resumes.load(player.id) : Promise.resolve(null),
    ]);
    setState(next);
    setAvailable(items);
    setSavedPractice(paused);
    savedPracticeRef.current = paused;
  }
  async function savePosition(index: number) {
    if (!resumes || !session) return;
    const paused = await resumes.save(
      player.id,
      session.id,
      session.items,
      index,
      activeResumeVersion.current,
      session.assignment,
    );
    activeResumeVersion.current = paused.version;
    savedPracticeRef.current = paused;
    setSavedPractice(paused);
  }
  async function discardActive() {
    if (
      resumes &&
      session &&
      activeResumeVersion.current > 0 &&
      savedPracticeRef.current
    ) {
      await resumes.discard(player.id, {
        ...savedPracticeRef.current,
        session_id: session.id,
        version: activeResumeVersion.current,
      });
      savedPracticeRef.current = null;
      setSavedPractice(null);
    }
    setSession(null);
  }
  const profile: Profile = {
    id: player.id,
    name: player.nickname,
    age: player.age_group,
    position: player.position,
    level: player.experience,
    goal: player.goal,
    guardian: player.age_group !== "18+",
  };
  const assigned = !demo ? state?.assigned_workout : null;
  const plan = assigned?.eligible
    ? orderedWorkoutPlan(assigned, available, profile)
    : planFor(profile, available);
  return (
    <section
      className="family-training panel member-panel"
      aria-label={`${player.nickname} training and permissions`}
    >
      <div className="family-training-heading">
        <div>
          {view !== "today" && (
            <Tag>
              {state?.is_family ? "FAMILY ATHLETE" : "INDIVIDUAL ATHLETE"}
            </Tag>
          )}
          <h2
            aria-label={
              view === "today" ? `${player.nickname}’s next session` : undefined
            }
          >
            {view !== "today" && `${player.nickname}’s `}
            {view === "today"
              ? "Next session"
              : view === "progress"
                ? "practice history"
                : "workouts"}
          </h2>
          {view !== "today" && (
            <p>
              {junior
                ? "Your next practice, one step at a time. Your parent reviews what you report."
                : "One athlete. Their own plan and history."}
            </p>
          )}
        </div>
        <button
          className="button secondary"
          aria-label="Refresh workout history"
          disabled={busy || !!session}
          onClick={() => void act(refresh)}
        >
          {view === "today" ? (
            <RefreshCw size={18} />
          ) : (
            "Refresh workout history"
          )}
        </button>
      </div>
      {error && permission === null && !review && !remove && !session && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!state ? (
        <p role="status">
          {error
            ? "Reconnect to load this athlete’s history."
            : "Loading athlete controls…"}
        </p>
      ) : (
        <>
          {state.is_parent && view === "all" && (
            <div className="family-permission">
              <ShieldCheck size={24} />
              <div>
                <h3>Athlete permission</h3>
                <p>
                  <strong>
                    {state.self_recording_allowed
                      ? "Athlete may record workouts"
                      : "Parent-managed workouts"}
                  </strong>
                </p>
                <p>
                  {state.self_recording_allowed
                    ? "A linked Athlete account may submit completed practice. You still review every submission."
                    : "You lead and record practice. This athlete cannot submit workouts independently."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy || !!session}
                  onClick={() => setPermission(!state.self_recording_allowed)}
                >
                  {state.self_recording_allowed
                    ? "Turn self-recording off"
                    : "Allow athlete self-recording"}
                </button>
                <div className="actions family-link-actions">
                  <button
                    className="text-button"
                    disabled={
                      busy ||
                      !state.self_recording_allowed ||
                      !state.child_access_ready ||
                      state.has_link ||
                      demo
                    }
                    onClick={() =>
                      void act(async () =>
                        setCode(await service.invite(player)),
                      )
                    }
                  >
                    Create private athlete access code
                  </button>
                  {state.has_link && (
                    <button
                      className="text-button"
                      disabled={busy || demo}
                      onClick={() => setRemove(true)}
                    >
                      Remove athlete account access
                    </button>
                  )}
                </div>
                {!state.child_access_ready && (
                  <small>
                    Real child logins remain closed until verified consent and
                    enrollment setup are complete. You can explore the full flow
                    with fictional athletes in the family demo.
                  </small>
                )}
                <p className="member-fineprint">
                  Permission to use the app does not replace age-appropriate
                  adult supervision. Each athlete needs their own connection;
                  siblings do not share a login or history.
                </p>
              </div>
            </div>
          )}
          {!state.is_parent && state.is_family && (
            <Notice>
              {state.self_recording_allowed
                ? "Your parent allows you to record practice. Completed workouts are sent to your parent for review."
                : "Your parent is managing workout recording. You can view your history; ask your parent to record practice with you."}
            </Notice>
          )}
          {view !== "progress" && (
            <div className={`family-plan${plan.length ? " has-session" : ""}`}>
              <h3>
                {demo
                  ? "Next illustrative session"
                  : plan.length
                    ? "Your assigned workout"
                    : "Your workouts start here"}
              </h3>
              {assigned?.eligible && (
                <>
                  <h4 className="assigned-workout-title">{assigned.title}</h4>
                  {assigned.summary && <p>{assigned.summary}</p>}
                </>
              )}
              {assigned && !assigned.eligible && (
                <Notice>
                  The saved workout does not currently match this athlete or
                  needs a content update. Any separately assigned matching
                  drills remain below.
                </Notice>
              )}
              {assigned?.eligible && !plan.length && (
                <Notice>
                  The workout changed while loading. Refresh training before
                  starting so every drill stays in its saved order.
                </Notice>
              )}
              {!demo && !plan.length && (
                <p>
                  No matching workouts have been assigned yet. Your coach can
                  upload a drill and an Owner can add it to your account.
                </p>
              )}
              {plan.length > 0 && (view !== "today" || !assigned?.eligible) && (
                <p className="session-drill-preview">
                  {plan.map((d) => d.title).join(" · ")}
                </p>
              )}
              {plan.length > 0 && (
                <p className="session-equipment">
                  <Clock3 size={16} />{" "}
                  {plan.reduce((sum, d) => sum + d.minutes, 0)} planned minutes
                  ·{" "}
                  {Array.from(new Set(plan.map((d) => d.equipment))).join(
                    " · ",
                  )}
                </p>
              )}
              <button
                className="button"
                disabled={
                  busy || !state.can_record || !plan.length || !!session
                }
                onClick={() => {
                  const pausedItems = savedPractice
                    ? resumeItems(savedPractice, available, assigned)
                    : null;
                  if (savedPractice && !pausedItems) {
                    setError(
                      "Saved practice no longer matches this workout. Refresh training before continuing.",
                    );
                    return;
                  }
                  activeResumeVersion.current = savedPractice?.version || 0;
                  const items = pausedItems || plan;
                  setSession({
                    id: savedPractice?.session_id || crypto.randomUUID(),
                    drills: items.map((d) => d.id),
                    items,
                    assignment: assigned?.eligible ? assigned : undefined,
                    initialIndex: savedPractice?.current_index || 0,
                  });
                }}
              >
                {savedPractice
                  ? "Resume workout"
                  : state.is_parent
                    ? "Guide and record practice"
                    : demo
                      ? "Start sample workout"
                      : "Start workout"}
                <ArrowRight size={18} />
              </button>
              {savedPractice && (
                <div className="saved-practice-note">
                  <p>
                    Saved at drill {savedPractice.current_index + 1} of{" "}
                    {savedPractice.resource_ids.length}. No completed practice
                    has been recorded.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || !!session}
                    onClick={() => setDiscardSaved(true)}
                  >
                    Discard saved practice
                  </button>
                </div>
              )}
              {view === "workouts" && (
                <ol className="app-session-drills">
                  {plan.map((drill) => (
                    <li key={drill.id}>
                      <strong>{drill.title}</strong>
                      <span>
                        {drill.minutes} planned minutes · {drill.equipment}
                      </span>
                      <p>{drill.lesson}</p>
                    </li>
                  ))}
                </ol>
              )}

              {plan.length > 0 && (
                <details className="session-fit" open={view !== "today"}>
                  <summary>Why this session?</summary>
                  <p>
                    Matched to age {player.age_group},{" "}
                    {player.experience.toLowerCase()},{" "}
                    {player.position.toLowerCase()} and{" "}
                    {player.goal.toLowerCase()}.
                  </p>
                </details>
              )}
              {!state.can_record && (
                <p className="member-fineprint">
                  Independent recording is unavailable for this account, or
                  enrollment is still closed.
                </p>
              )}
            </div>
          )}
          {message && view !== "all" && view !== "progress" && (
            <a className="button secondary" href="#app-progress">
              View practice history <ArrowRight size={17} />
            </a>
          )}
          {(view === "all" || view === "progress") && (
            <div className="family-history">
              <h3>Practice history</h3>
              <div className="family-counts">
                <span>
                  <strong>{state.workouts.length}</strong> reported
                </span>
                {state.is_family && (
                  <>
                    <span>
                      <strong>
                        {
                          state.workouts.filter(
                            (w) => w.status === "pending_parent",
                          ).length
                        }
                      </strong>{" "}
                      awaiting review
                    </span>
                    <span>
                      <strong>
                        {
                          state.workouts.filter((w) => w.status === "approved")
                            .length
                        }
                      </strong>{" "}
                      parent approved
                    </span>
                  </>
                )}
              </div>
              {!state.workouts.length ? (
                <p>No workouts recorded for this athlete yet.</p>
              ) : (
                state.workouts.map((workout) => (
                  <article className="family-workout" key={workout.id}>
                    <Tag>{WORKOUT_LABELS[workout.status]}</Tag>
                    <h4>
                      {workout.workout_title || workout.titles.join(" · ")}
                    </h4>
                    {workout.workout_title && (
                      <p>{workout.titles.join(" · ")}</p>
                    )}
                    <p>
                      {new Date(workout.created_at).toLocaleDateString()} ·{" "}
                      {workout.minutes} planned minutes
                    </p>
                    {state.is_parent && workout.status === "pending_parent" && (
                      <div className="actions">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            setReview({ workout, decision: "approved" })
                          }
                        >
                          Approve workout
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            setReview({ workout, decision: "needs_repeat" })
                          }
                        >
                          Ask to practice again
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          )}
          {!state.is_parent &&
            state.is_family &&
            player.age_group === "18+" &&
            !state.guardian_managed &&
            view === "all" &&
            !demo && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setRemove(true)}
              >
                Leave family athlete connection
              </button>
            )}
        </>
      )}
      {client && !demo && state && (
        <AthleteVideoReview client={client} player={player} drills={plan} />
      )}
      <Notice>
        {state?.is_family
          ? "Practice is self-reported; a parent approval records their review, not proof of improved athletic ability."
          : "Practice is self-reported, not proof of improved athletic ability."}{" "}
        {demo
          ? "Sample activities are illustrative, noncontact and pending qualified coaching review."
          : "Training activities are noncontact and pending qualified coaching review."}
      </Notice>
      {permission !== null && state && (
        <Modal
          title={
            permission
              ? "Allow independent workout recording?"
              : "Return to parent-managed workouts?"
          }
          onClose={() => {
            if (!busy) setPermission(null);
          }}
        >
          <p>
            {permission
              ? `${player.nickname} may use their separately linked Athlete account to report practice. You remain responsible for reviewing submissions.`
              : "The athlete will no longer be able to submit workouts independently. Existing history and pending reviews stay saved."}
          </p>
          <p>Permission applies only to {player.nickname}.</p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await service.permission(
                    player,
                    permission,
                    state.permission_version,
                  );
                  setPermission(null);
                  await refresh();
                  setMessage("Athlete permission saved.");
                })
              }
            >
              Save athlete permission
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPermission(null)}
            >
              Keep current permission
            </button>
          </div>
        </Modal>
      )}
      {review && (
        <Modal
          title={
            review.decision === "approved"
              ? "Approve this reported workout?"
              : "Ask to practice again?"
          }
          onClose={() => {
            if (!busy) setReview(null);
          }}
        >
          <p>{review.workout.titles.join(" · ")}</p>
          <p>
            {review.decision === "approved"
              ? "Confirm you reviewed this athlete’s reported practice. This does not certify athletic improvement."
              : "Keep the record and mark this session for another practice together."}
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await service.review(
                    review.workout.id,
                    review.decision,
                    review.workout.version,
                  );
                  setReview(null);
                  await refresh();
                  setMessage("Parent review saved.");
                })
              }
            >
              Confirm parent review
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Cancel review
            </button>
          </div>
        </Modal>
      )}
      {!!code && (
        <Modal title="Private athlete access code" onClose={() => setCode("")}>
          <p>
            Share this one-time code privately with this individual athlete. It
            expires in one hour. They must sign in to their own verified Athlete
            account and accept the family connection. Existing history stays
            with this family profile.
          </p>
          <label>
            One-time access code
            <textarea readOnly value={code} rows={3} />
          </label>
          <p>Do not post this code publicly or share it with a sibling.</p>
          <p role="status">{copyStatus}</p>
          <div className="actions">
            <button
              className="button"
              onClick={() => {
                if (!navigator.clipboard) {
                  setCopyStatus("Select the code above and copy it manually.");
                  return;
                }
                void navigator.clipboard
                  .writeText(code)
                  .then(() => setCopyStatus("Access code copied."))
                  .catch(() =>
                    setCopyStatus(
                      "Select the code above and copy it manually.",
                    ),
                  );
              }}
            >
              Copy access code
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setCode("");
                setCopyStatus("");
              }}
            >
              Close access code
            </button>
          </div>
        </Modal>
      )}
      {remove && (
        <Modal
          title="Remove this athlete connection?"
          onClose={() => {
            if (!busy) setRemove(false);
          }}
        >
          <p>
            The linked athlete loses access to this family profile. The family’s
            existing practice history remains with the parent. A new private
            code is required to connect again.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await service.remove(player);
                  setRemove(false);
                  if (onConnectionChange) await onConnectionChange();
                  else await refresh();
                })
              }
            >
              Remove athlete connection
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemove(false)}
            >
              Keep connection
            </button>
          </div>
        </Modal>
      )}
      {discardSaved && savedPractice && resumes && (
        <Modal
          title="Discard saved practice?"
          onClose={() => {
            if (!busy) setDiscardSaved(false);
          }}
        >
          <p>
            This removes only the unfinished place for {player.nickname}.
            Completed practice history stays saved.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await resumes.discard(player.id, savedPractice);
                  setSavedPractice(null);
                  savedPracticeRef.current = null;
                  setDiscardSaved(false);
                })
              }
            >
              Discard saved practice permanently
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDiscardSaved(false)}
            >
              Keep saved practice
            </button>
          </div>
        </Modal>
      )}
      {session && (
        <GuidedWorkout
          key={session.id}
          demo={demo}
          items={session.items}
          profile={profile}
          drills={session.drills}
          workoutTitle={session.assignment?.title}
          busy={busy}
          error={error}
          initialIndex={session.initialIndex}
          onSavePosition={resumes ? savePosition : undefined}
          onPause={resumes ? () => setSession(null) : undefined}
          onDiscard={resumes ? discardActive : undefined}
          onCancel={() => setSession(null)}
          onComplete={() =>
            void act(async () => {
              await service.report(
                player,
                session.id,
                session.drills,
                session.assignment,
              );
              setSession(null);
              savedPracticeRef.current = null;
              setSavedPractice(null);
              await refresh();
              setMessage(
                state?.is_family && !state.is_parent
                  ? "Workout reported. Awaiting parent review."
                  : "Practice recorded for this athlete.",
              );
            })
          }
        />
      )}
    </section>
  );
}
function DemoGuidedWorkout({
  profile,
  drills,
  busy,
  error,
  onCancel,
  onComplete,
}: {
  profile: Profile;
  drills: string[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0),
    [practice, setPractice] = useState(false),
    [checked, setChecked] = useState(false),
    [ready, setReady] = useState(false),
    [cancel, setCancel] = useState(false);
  const drill = DRILLS.find((d) => d.id === drills[index])!;
  return (
    <Modal
      title={`${profile.name}’s guided practice`}
      onClose={() => {
        if (!busy) setCancel(true);
      }}
    >
      {!ready ? (
        <>
          <Notice>
            Illustrative noncontact practice. Review instructions first; keep
            the activity age-appropriate, with adult supervision especially for
            younger players. Pause whenever needed. This is not medical advice.
            Unfinished practice is not saved on refresh; only submitted reports
            are recorded.
          </Notice>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            I understand this is a sample activity and have reviewed the
            practice space and supervision needed.
          </label>
          <button
            className="button"
            disabled={!checked}
            onClick={() => {
              setReady(true);
              setChecked(false);
            }}
          >
            Begin sample practice
          </button>
        </>
      ) : (
        <>
          <Tag>
            DRILL {index + 1} OF {drills.length}
          </Tag>
          <h3>{drill.title}</h3>
          <Field kind={drill.kind} />
          <p>{drill.lesson}</p>
          <p>
            <strong>Equipment:</strong> {drill.equipment}
          </p>
          {!practice ? (
            <button className="button" onClick={() => setPractice(true)}>
              Show workout steps
            </button>
          ) : (
            <>
              <ol className="instruction-list">
                {drill.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <p className="coaching-cue">Coaching cue: {drill.cue}</p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                The practice steps were completed, not just viewed.
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button
                className="button"
                disabled={!checked || busy}
                onClick={() => {
                  if (index + 1 < drills.length) {
                    setIndex(index + 1);
                    setPractice(false);
                    setChecked(false);
                  } else onComplete();
                }}
              >
                {busy
                  ? "Submitting…"
                  : index + 1 < drills.length
                    ? "Next workout drill"
                    : "Submit reported workout"}
                <Check size={17} />
              </button>
            </>
          )}
        </>
      )}
      {!cancel ? (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => setCancel(true)}
        >
          End without recording
        </button>
      ) : (
        <div className="discard-box">
          <p>End this unfinished practice? No completion will be recorded.</p>
          <div className="actions">
            <button className="button secondary" onClick={onCancel}>
              Discard unfinished workout
            </button>
            <button className="text-button" onClick={() => setCancel(false)}>
              Keep practicing
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function GuidedWorkout(props: {
  demo: boolean;
  items: Drill[];
  profile: Profile;
  drills: string[];
  workoutTitle?: string;
  busy: boolean;
  error: string;
  initialIndex?: number;
  onSavePosition?: (index: number) => Promise<void>;
  onPause?: () => void;
  onDiscard?: () => Promise<void>;
  onCancel: () => void;
  onComplete: () => void;
}) {
  return props.demo ? (
    <DemoGuidedWorkout {...props} />
  ) : (
    <SimpleWorkout {...props} />
  );
}
function SimpleWorkout({
  items,
  workoutTitle,
  profile,
  busy,
  error,
  onCancel,
  onComplete,
  initialIndex = 0,
  onSavePosition,
  onPause,
  onDiscard,
}: {
  items: Drill[];
  workoutTitle?: string;
  profile: Profile;
  busy: boolean;
  error: string;
  initialIndex?: number;
  onSavePosition?: (index: number) => Promise<void>;
  onPause?: () => void;
  onDiscard?: () => Promise<void>;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(initialIndex),
    [ready, setReady] = useState(false),
    [ack, setAck] = useState(false),
    [cancel, setCancel] = useState(false);
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState("");
  const working = busy || saving;
  async function moveTo(next: number, begin = false) {
    if (working) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSavePosition?.(next);
      if (begin) setReady(true);
      else setIndex(next);
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? e.message
          : "Your place could not be saved. Retry when connected.",
      );
    } finally {
      setSaving(false);
    }
  }
  const lastTap = useRef(0);
  const drillHeading = useRef<HTMLHeadingElement>(null);
  const drill = items[index];
  useEffect(() => {
    if (ready) drillHeading.current?.focus({ preventScroll: true });
  }, [index, ready]);
  return (
    <Modal
      title={ready ? "Guided practice" : "Ready to practice?"}
      onClose={() => {
        if (!working) setCancel(true);
      }}
    >
      {!ready ? (
        <>
          {workoutTitle && <h3>{workoutTitle}</h3>}
          <p>
            {profile.name} · {items.length} drills ·{" "}
            {items.reduce((n, d) => n + d.minutes, 0)} planned minutes
          </p>
          <ol className="workout-outline" aria-label="Workout order">
            {items.map((item, n) => (
              <li key={item.id}>
                <span>{n + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.minutes} planned minutes · {item.equipment}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <Notice>
            Noncontact training. Use a clear practice space and appropriate
            supervision. Content awaits qualified coaching review. Your place is
            saved after each drill when connected. Finishing is required to
            record practice.
          </Notice>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />{" "}
            I have reviewed the practice space, instructions and supervision
            needed.
          </label>
          <button
            className="button full"
            disabled={!ack || working}
            onClick={() => void moveTo(index, true)}
          >
            {saving
              ? "Saving your place…"
              : initialIndex > 0
                ? "Resume practice"
                : "Begin workout"}{" "}
            <ArrowRight size={18} />
          </button>
        </>
      ) : (
        <div className="simple-drill">
          <div className="drill-position" role="status" aria-live="polite">
            <Tag>
              DRILL {index + 1} / {items.length} · {drill.minutes} MIN
            </Tag>
            <span>
              {index === items.length - 1
                ? "Final drill"
                : `${items.length - index - 1} more after this`}
            </span>
          </div>
          <progress
            className="workout-progress"
            aria-label="Current drill position"
            value={index + 1}
            max={items.length}
          />
          <h3 className="drill-focus-title" ref={drillHeading} tabIndex={-1}>
            {drill.title}
          </h3>
          {drill.assetId ? (
            <AssetPreview key={drill.id} drill={drill} />
          ) : (
            <Notice>
              No demonstration is attached to this drill. Follow the written
              instructions.
            </Notice>
          )}
          <p className="drill-summary">{drill.lesson}</p>
          <p className="drill-equipment">
            <strong>You need:</strong> {drill.equipment}
          </p>
          <h4 className="practice-heading">Your practice steps</h4>
          <ol className="instruction-list compact-steps">
            {drill.steps.map((step, n) => (
              <li key={n}>{step}</li>
            ))}
          </ol>
          <p className="coaching-cue">
            <strong>Remember:</strong> {drill.cue}
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="drill-finish-bar">
            {items[index + 1] && (
              <p className="next-drill">
                <span>UP NEXT</span>
                <strong>{items[index + 1].title}</strong>
              </p>
            )}
            <button
              className="button full"
              disabled={working}
              onClick={() => {
                const now = Date.now();
                if (now - lastTap.current < 650) {
                  drillHeading.current?.focus({ preventScroll: true });
                  return;
                }
                lastTap.current = now;
                if (index < items.length - 1) {
                  void moveTo(index + 1);
                  drillHeading.current
                    ?.closest("dialog")
                    ?.scrollTo({ top: 0, behavior: "instant" });
                } else {
                  if (!onSavePosition) {
                    onComplete();
                    return;
                  }
                  setSaving(true);
                  setSaveError("");
                  void onSavePosition(index)
                    .then(onComplete)
                    .catch((e) =>
                      setSaveError(
                        e instanceof Error
                          ? e.message
                          : "Saved practice could not be checked.",
                      ),
                    )
                    .finally(() => setSaving(false));
                }
              }}
            >
              {working
                ? "Saving practice…"
                : index < items.length - 1
                  ? "Complete drill · Next"
                  : "Finish workout"}
              <Check size={18} />
            </button>
            <p className="member-fineprint">
              Complete a drill after practicing it. Watching a demonstration
              alone does not record practice.
            </p>
            {index > 0 && (
              <button
                className="text-button"
                disabled={working}
                onClick={() => {
                  const now = Date.now();
                  if (now - lastTap.current < 650) {
                    drillHeading.current?.focus({ preventScroll: true });
                    return;
                  }
                  lastTap.current = now;
                  void moveTo(index - 1);
                  drillHeading.current
                    ?.closest("dialog")
                    ?.scrollTo({ top: 0, behavior: "instant" });
                }}
              >
                <ArrowLeft size={17} /> Previous drill
              </button>
            )}
          </div>
        </div>
      )}
      {saveError && (
        <p role="alert" className="form-error">
          {saveError}
        </p>
      )}
      {onPause && ready && (
        <button
          className="button secondary full"
          disabled={working}
          onClick={onPause}
        >
          Save & leave workout
        </button>
      )}
      {!cancel ? (
        <button
          className="text-button"
          disabled={working}
          onClick={() => setCancel(true)}
        >
          End workout
        </button>
      ) : (
        <div className="discard-box">
          <p>Leave without recording this unfinished workout?</p>
          <div className="actions">
            <button
              className="button secondary"
              disabled={working}
              onClick={() => {
                if (!onDiscard) {
                  onCancel();
                  return;
                }
                setSaving(true);
                setSaveError("");
                void onDiscard()
                  .catch((e) =>
                    setSaveError(
                      e instanceof Error
                        ? e.message
                        : "Could not discard practice.",
                    ),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              Discard unfinished workout
            </button>
            <button className="text-button" onClick={() => setCancel(false)}>
              Keep practicing
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
