import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
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
    } | null>(null),
    [review, setReview] = useState<{
      workout: AthleteWorkout;
      decision: "approved" | "needs_repeat";
    } | null>(null);
  const [available, setAvailable] = useState<Drill[]>([]);
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
      ])
        .then(([value, items]) => {
          if (!stopped) {
            setState(value);
            setAvailable(items);
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
  }, [service, player, demo]);
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
    const [next, items] = await Promise.all([
      service.load(player),
      demo
        ? Promise.resolve(DRILLS)
        : service.plan
          ? service.plan(player)
          : Promise.resolve([]),
    ]);
    setState(next);
    setAvailable(items);
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
  const plan = planFor(profile, available);
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
          <h2>
            {player.nickname}’s{" "}
            {view === "today"
              ? "next session"
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
            <div className="family-plan">
              <h3>
                {demo
                  ? "Next illustrative session"
                  : plan.length
                    ? "Your assigned workout"
                    : "Your workouts start here"}
              </h3>
              {!demo && !plan.length && (
                <p>
                  No matching workouts have been assigned yet. Your coach can
                  upload a drill and an Owner can add it to your account.
                </p>
              )}
              <p>{plan.map((d) => d.title).join(" · ")}</p>
              <p>
                <Clock3 size={16} />{" "}
                {plan.reduce((sum, d) => sum + d.minutes, 0)} planned minutes ·{" "}
                {plan[0]?.equipment}
              </p>
              <button
                className="button"
                disabled={
                  busy || !state.can_record || !plan.length || !!session
                }
                onClick={() =>
                  setSession({
                    id: crypto.randomUUID(),
                    drills: plan.map((d) => d.id),
                    items: plan,
                  })
                }
              >
                {state.is_parent
                  ? "Guide and record practice"
                  : demo
                    ? "Start sample workout"
                    : "Start workout"}
                <ArrowRight size={18} />
              </button>
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

              <p>
                Matched to age {player.age_group},{" "}
                {player.experience.toLowerCase()},{" "}
                {player.position.toLowerCase()} and {player.goal.toLowerCase()}.
              </p>
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
                    <h4>{workout.titles.join(" · ")}</h4>
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
      {session && (
        <GuidedWorkout
          key={session.id}
          demo={demo}
          items={session.items}
          profile={profile}
          drills={session.drills}
          busy={busy}
          error={error}
          onCancel={() => setSession(null)}
          onComplete={() =>
            void act(async () => {
              await service.report(player, session.id, session.drills);
              setSession(null);
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
  busy: boolean;
  error: string;
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
  profile,
  busy,
  error,
  onCancel,
  onComplete,
}: {
  items: Drill[];
  profile: Profile;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0),
    [ready, setReady] = useState(false),
    [ack, setAck] = useState(false),
    [cancel, setCancel] = useState(false);
  const lastTap = useRef(0);
  const drill = items[index];
  return (
    <Modal
      title={ready ? drill.title : "Ready to practice?"}
      onClose={() => {
        if (!busy) setCancel(true);
      }}
    >
      {!ready ? (
        <>
          <p>
            {profile.name} · {items.length} drills ·{" "}
            {items.reduce((n, d) => n + d.minutes, 0)} planned minutes
          </p>
          <Notice>
            Noncontact training. Use a clear practice space and appropriate
            supervision. Content awaits qualified coaching review. Unfinished
            practice is not saved on refresh.
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
            disabled={!ack}
            onClick={() => setReady(true)}
          >
            Begin workout <ArrowRight size={18} />
          </button>
        </>
      ) : (
        <div className="simple-drill">
          <Tag>
            DRILL {index + 1} / {items.length} · {drill.minutes} MIN
          </Tag>
          {drill.assetId ? (
            <AssetPreview drill={drill} />
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
          <button
            className="button full"
            disabled={busy}
            onClick={() => {
              const now = Date.now();
              if (now - lastTap.current < 650) return;
              lastTap.current = now;
              if (index < items.length - 1) setIndex((n) => n + 1);
              else onComplete();
            }}
          >
            {busy
              ? "Saving practice…"
              : index < items.length - 1
                ? "Complete drill · Next"
                : "Finish workout"}
            <Check size={18} />
          </button>
          <p className="member-fineprint">
            Complete a drill after practicing it. Watching a demonstration alone
            does not record practice.
          </p>
        </div>
      )}
      {!cancel ? (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => setCancel(true)}
        >
          End workout
        </button>
      ) : (
        <div className="discard-box">
          <p>Leave without recording this unfinished workout?</p>
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
