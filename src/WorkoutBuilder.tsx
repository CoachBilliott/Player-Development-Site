import { StaffLink } from "./StaffLinks";
import { takeStaffHandoff } from "./staffHandoff";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { AssetPreview, Modal, Notice, Tag } from "./components";
import { MemberAccountPage } from "./MemberAccount";
import { isStaff, listAccess, type AccessMember } from "./roles";
import { PROFILES, type Drill } from "./model";
import type { SharedState } from "./useSharedContent";
import {
  Workouts,
  workoutCoverage,
  workoutIssue,
  type SavedWorkout,
  type WorkoutAssignment,
  type AssignmentProfile,
} from "./workouts";

export function WorkoutBuilder({ shared }: { shared: SharedState }) {
  if (
    !shared.signedIn ||
    !shared.service ||
    !shared.accessReady ||
    shared.accessError
  )
    return <MemberAccountPage shared={shared} />;
  if (!isStaff(shared.role))
    return (
      <main className="page narrow">
        <h1 tabIndex={-1}>Staff access is required.</h1>
        <a href="#workspace" className="button">
          My training
        </a>
      </main>
    );
  return <Builder key={shared.session!.user.id} shared={shared} />;
}
function Builder({ shared }: { shared: SharedState }) {
  const service = useMemo(
    () => new Workouts(shared.service!.client),
    [shared.service],
  );
  const [initialWorkout] = useState(
    () => new URLSearchParams(location.search).get("trainingWorkout") || "",
  );
  const [saved, setSaved] = useState<SavedWorkout[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [id, setId] = useState<string>(() => crypto.randomUUID()),
    [version, setVersion] = useState(0);
  const [title, setTitle] = useState(""),
    [summary, setSummary] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [query, setQuery] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(false);
  const [snapshot, setSnapshot] = useState(JSON.stringify(["", "", []]));
  const [pending, setPending] = useState<SavedWorkout | "new" | null>(null),
    [removing, setRemoving] = useState<SavedWorkout | null>(null);
  const [incomingId, setIncomingId] = useState(() =>
    takeStaffHandoff(shared.session!.user.id, "workout", false),
  );
  const incomingApplied = useRef(false);
  const lock = useRef(false);
  const resources = shared.resources.filter(
    (d) =>
      d.visibility === "member_only" &&
      d.source === "shared" &&
      (d.reviewStage === undefined || d.reviewStage === "approved"),
  );
  const incoming = resources.find((d) => d.id === incomingId);
  useEffect(() => {
    if (!incomingId || !shared.libraryReady) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || incomingApplied.current) return;
      incomingApplied.current = true;
      takeStaffHandoff(shared.session!.user.id, "workout");
      if (!incoming) {
        setError(
          "This drill needs approval or is no longer available. Review the content queue first.",
        );
        return;
      }
      setIds([incoming.id]);
      setTitle(`${incoming.title} practice`.slice(0, 90));
    });
    return () => {
      active = false;
    };
  }, [incomingId, incoming, shared.libraryReady, shared.session]);

  const items = ids.map((key) => resources.find((d) => d.id === key));
  const dirty = snapshot !== JSON.stringify([title, summary, ids]);
  const selected = saved.find((w) => w.id === id && w.version === version);
  const issue = workoutIssue(ids, resources);
  const audience = workoutCoverage(items.filter((d): d is Drill => !!d));
  useEffect(() => {
    let active = true;
    void service
      .list()
      .then((rows) => {
        if (active) {
          setSaved(rows);
          setReady(true);
          const chosen = rows.find((w) => w.id === initialWorkout);
          if (chosen) {
            setId(chosen.id);
            setVersion(chosen.version);
            setTitle(chosen.title);
            setSummary(chosen.summary);
            setIds(chosen.resource_ids);
            setSnapshot(
              JSON.stringify([
                chosen.title,
                chosen.summary,
                chosen.resource_ids,
              ]),
            );
          } else if (initialWorkout)
            setError(
              "That workout is unavailable. Choose a saved workout in your scope.",
            );
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [service, initialWorkout]);
  function open(workout: SavedWorkout | "new") {
    const next = workout === "new" ? null : workout;
    setId(next?.id || crypto.randomUUID());
    setVersion(next?.version || 0);
    setTitle(next?.title || "");
    setSummary(next?.summary || "");
    setIds(next?.resource_ids || []);
    setSnapshot(
      JSON.stringify([
        next?.title || "",
        next?.summary || "",
        next?.resource_ids || [],
      ]),
    );
    setPending(null);
    setError("");
    setMessage("");
    setQuery("");
  }
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
        e instanceof Error
          ? e.message
          : "The change was not confirmed. Keep your draft and retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function move(index: number, direction: number) {
    setIds((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  return (
    <main className="page workout-builder">
      <div className="page-intro">
        <Tag>PRIVATE STAFF · WORKOUT BUILDER</Tag>
        <h1 tabIndex={-1}>Build a complete workout.</h1>
        <p>
          Choose protected drills, arrange the practice order, then preview and
          save.
        </p>
        <a className="text-button" href="#training">
          <ArrowLeft size={17} /> Back to Training
        </a>
      </div>
      {incoming && (
        <section className="notice">
          <strong>New approved drill: {incoming.title}</strong>
          <p>
            {ids.includes(incoming.id)
              ? "This drill is in the open workout. You can also open a saved workout and add it there."
              : "Add this drill to the open workout, then preview and save."}
          </p>
          <div className="actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy || ids.includes(incoming.id) || ids.length >= 12}
              onClick={() => setIds((current) => [...current, incoming.id])}
            >
              Add to this workout
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setIncomingId(null)}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}
      {shared.error && (
        <p className="form-error" role="alert">
          {shared.error}
        </p>
      )}
      <div className="builder-layout">
        <aside className="panel builder-saved" aria-label="Saved workouts">
          <h2>Saved workouts</h2>
          <button
            className="button"
            disabled={busy}
            onClick={() => (dirty ? setPending("new") : open("new"))}
          >
            <Plus size={17} /> New workout
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                setSaved(await service.list());
                setReady(true);
                await shared.refresh();
                setMessage(
                  "Saved workouts refreshed. Your open draft is unchanged.",
                );
              })
            }
          >
            <RefreshCw size={16} /> Refresh saved workouts
          </button>
          {!ready && !error && <p role="status">Loading saved workouts…</p>}
          {ready && !saved.length && (
            <p>
              No saved workouts yet. Add your first protected drills to begin.
            </p>
          )}
          <ul>
            {saved.map((w) => (
              <li key={w.id}>
                <button
                  className="builder-workout-choice"
                  data-workout-id={w.id}
                  aria-pressed={id === w.id}
                  disabled={busy}
                  onClick={() => (dirty ? setPending(w) : open(w))}
                >
                  <strong>{w.title}</strong>
                  <small>
                    {w.resource_ids.length} drills · version {w.version}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="panel builder-editor" aria-label="Workout details">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (!title.trim()) {
                setError("Give this workout a name.");
                return;
              }
              if (issue) {
                setError(issue);
                return;
              }
              setPreview(true);
            }}
          >
            <fieldset className="builder-fields" disabled={busy}>
              <label>
                Workout name
                <input
                  required
                  maxLength={90}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this training session"
                />
              </label>
              <label>
                Workout introduction
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Explain the focus and any preparation the player needs."
                />
              </label>
              <h2>Practice order</h2>
              {!ids.length && (
                <p>
                  Add a drill below. The athlete will follow the order you
                  choose here.
                </p>
              )}
              <ol
                className="builder-drill-order"
                aria-label="Selected drill order"
              >
                {ids.map((key, n) => {
                  const d = resources.find((entry) => entry.id === key);
                  return (
                    <li key={key}>
                      <div className="builder-drill-name">
                        <span>{n + 1}</span>
                        <div>
                          <strong>{d?.title || "Unavailable drill"}</strong>
                          <small>
                            {d
                              ? `${d.minutes} planned minutes · ${d.skill}`
                              : "Remove this drill or refresh the library before saving."}
                          </small>
                        </div>
                      </div>
                      <div className="builder-order-actions">
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Move ${d?.title || "unavailable drill"} up`}
                          disabled={n === 0}
                          onClick={() => move(n, -1)}
                        >
                          <ArrowUp size={18} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Move ${d?.title || "unavailable drill"} down`}
                          disabled={n === ids.length - 1}
                          onClick={() => move(n, 1)}
                        >
                          <ArrowDown size={18} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Remove ${d?.title || "unavailable drill"} from workout`}
                          onClick={() =>
                            setIds((current) =>
                              current.filter((v) => v !== key),
                            )
                          }
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="builder-summary">
                <strong>
                  {ids.length} drills ·{" "}
                  {items.reduce((sum, d) => sum + (d?.minutes || 0), 0)} planned
                  minutes
                </strong>
                <p>
                  {ids.length
                    ? `Shared ages: ${audience.ages.join(", ") || "none"} · Levels: ${audience.levels.join(", ") || "none"}`
                    : "Choose up to 12 drills and 60 planned minutes."}
                </p>
              </div>
              <label>
                Find a protected drill
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title or skill"
                />
              </label>
              {!shared.libraryReady && (
                <p role="status">Loading protected drills…</p>
              )}
              {shared.libraryReady && !resources.length && (
                <Notice>
                  <a href="#coach">Upload and publish a protected drill</a>{" "}
                  before building a workout. Public demo samples stay separate.
                </Notice>
              )}
              <ul
                className="builder-resource-list"
                aria-label="Available protected drills"
              >
                {resources
                  .filter(
                    (d) =>
                      !ids.includes(d.id) &&
                      `${d.title} ${d.skill}`
                        .toLowerCase()
                        .includes(query.trim().toLowerCase()),
                  )
                  .map((d) => (
                    <li key={d.id}>
                      <div>
                        <strong>{d.title}</strong>
                        <small>
                          {d.minutes} min · {d.ages.join(", ")} · {d.skill}
                        </small>
                      </div>
                      <button
                        className="button secondary"
                        type="button"
                        disabled={ids.length >= 12}
                        aria-label={`Add ${d.title} to workout`}
                        onClick={() =>
                          setIds((current) =>
                            current.includes(d.id)
                              ? current
                              : [...current, d.id],
                          )
                        }
                      >
                        <Plus size={17} /> Add
                      </button>
                    </li>
                  ))}
              </ul>
              {resources.length > 0 &&
                !resources.some(
                  (d) =>
                    !ids.includes(d.id) &&
                    `${d.title} ${d.skill}`
                      .toLowerCase()
                      .includes(query.trim().toLowerCase()),
                ) && <p>No remaining drills match this search.</p>}
              {ids.length > 0 && issue && (
                <p className="form-error" role="status">
                  {issue}
                </p>
              )}
              {error && !preview && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="success">
                  {message}
                </p>
              )}
              <div className="actions">
                <button
                  className="button"
                  type="submit"
                  disabled={!ready || !shared.libraryReady}
                >
                  Preview workout <ArrowRight size={18} />
                </button>
                {selected && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setRemoving(selected)}
                  >
                    Remove saved workout
                  </button>
                )}
              </div>
              <p className="member-fineprint">
                Unsaved workout edits stay on this screen. Saving a template
                does not assign or charge anyone. Existing assignments keep
                their saved version until an Owner explicitly replaces them.
              </p>
            </fieldset>
          </form>
          {selected && shared.role === "owner" && (
            <div className="workflow-assignment-entry">
              <h2>Ready to use this practice?</h2>
              <p>
                Open an athlete’s record to assign this saved workout. Saving a
                template does not replace anyone’s current plan.
              </p>
              <StaffLink route="workspace" className="button">
                {new URLSearchParams(location.search).has("serviceAthlete")
                  ? "Return to athlete"
                  : "Choose an athlete"}
                <ArrowRight size={18} />
              </StaffLink>
            </div>
          )}
        </section>
      </div>
      <Notice>
        Noncontact illustrative training awaits qualified coaching review.
        Planned duration and completion describe practice participation, not
        athletic improvement. Junior access and billing remain closed.
      </Notice>
      {preview && issue && (
        <Modal
          title="The workout needs an update"
          onClose={() => setPreview(false)}
        >
          <p role="alert">{issue}</p>
          <button
            className="button secondary"
            onClick={() => setPreview(false)}
          >
            Back to workout editing
          </button>
        </Modal>
      )}
      {preview && !issue && (
        <WorkoutPreview
          items={items as Drill[]}
          title={title.trim()}
          summary={summary.trim()}
          busy={busy}
          error={error}
          onClose={() => {
            if (!busy) setPreview(false);
          }}
          onSave={() =>
            void act(async () => {
              if (issue) throw new Error(issue);
              const result = await service.save(
                id,
                title,
                summary,
                ids,
                version,
              );
              setSaved((current) => [
                result,
                ...current.filter((w) => w.id !== result.id),
              ]);
              setVersion(result.version);
              setSnapshot(JSON.stringify([title, summary, ids]));
              setPreview(false);
              setMessage(
                "Workout saved. An Owner can now assign this complete session.",
              );
            })
          }
        />
      )}
      {pending && (
        <Modal
          title="Leave these unsaved workout edits?"
          onClose={() => setPending(null)}
        >
          <p>
            Your unsaved edits will be discarded. Saved templates and
            assignments stay unchanged.
          </p>
          <div className="actions">
            <button className="button" onClick={() => open(pending)}>
              Discard edits and continue
            </button>
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Keep editing workout
            </button>
          </div>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Remove this saved workout?"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <p>
            Remove “{removing.title}” and its current account assignments?
            Uploaded drills and existing practice history stay saved. Accounts
            keep any separately granted loose-drill access.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await service.remove(removing);
                  setSaved((current) =>
                    current.filter((w) => w.id !== removing.id),
                  );
                  setRemoving(null);
                  open("new");
                  setMessage(
                    "Workout removed. Existing practice history is unchanged.",
                  );
                })
              }
            >
              Yes, remove workout
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Keep saved workout
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
function WorkoutPreview({
  items,
  title,
  summary,
  busy,
  error,
  onClose,
  onSave,
}: {
  items: Drill[];
  title: string;
  summary: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  return (
    <Modal title={`Preview: ${title}`} onClose={onClose}>
      <Tag>STAFF PREVIEW · NO PRACTICE RECORDED</Tag>
      <p>{summary}</p>
      <p>
        {items.length} drills · {items.reduce((sum, d) => sum + d.minutes, 0)}{" "}
        planned minutes
      </p>
      <ol className="workout-outline" aria-label="Preview workout order">
        {items.map((d, n) => (
          <li key={d.id}>
            <span>{n + 1}</span>
            <strong>{d.title}</strong>
          </li>
        ))}
      </ol>
      <section className="simple-drill">
        <h3>{item.title}</h3>
        <AssetPreview key={item.id} drill={item} />
        <p>{item.lesson}</p>
        <p>
          <strong>You need:</strong> {item.equipment}
        </p>
        <ol className="instruction-list">
          {item.steps.map((s, n) => (
            <li key={n}>{s}</li>
          ))}
        </ol>
        <p className="coaching-cue">
          <strong>Remember:</strong> {item.cue}
        </p>
      </section>
      <div className="actions">
        <button
          className="button secondary"
          disabled={busy || index === 0}
          onClick={() => setIndex((n) => n - 1)}
        >
          Previous preview drill
        </button>
        <button
          className="button secondary"
          disabled={busy || index === items.length - 1}
          onClick={() => setIndex((n) => n + 1)}
        >
          Next preview drill
        </button>
      </div>
      <h3>Matching fictional examples</h3>
      <p>
        {PROFILES.filter((p) =>
          items.every(
            (d) =>
              d.ages.includes(p.age) &&
              d.levels.includes(p.level) &&
              (!d.positions.length || d.positions.includes(p.position)),
          ),
        )
          .map((p) => p.name)
          .join(", ") ||
          "No built-in sample matches; the shared audience still needs qualified review."}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="button" disabled={busy} onClick={onSave}>
          {busy ? "Saving workout…" : "Save workout"}
          <Check size={18} />
        </button>
        <button className="text-button" disabled={busy} onClick={onClose}>
          Back to workout editing
        </button>
      </div>
    </Modal>
  );
}
export function AssignWorkout({
  service,
  workout,
  dirty,
  fixedTarget,
  embedded = false,
  onSaved,
  onBusyChange,
}: {
  service: Workouts;
  workout: SavedWorkout;
  dirty: boolean;
  fixedTarget?: { account: string; profile: string };
  embedded?: boolean;
  onSaved?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [members, setMembers] = useState<AccessMember[]>([]),
    [account, setAccount] = useState(
      () =>
        fixedTarget?.account ||
        new URLSearchParams(location.search).get("trainingAccount") ||
        "",
    ),
    [profiles, setProfiles] = useState<AssignmentProfile[]>([]),
    [profilesLoaded, setProfilesLoaded] = useState(false),
    [profile, setProfile] = useState(
      () =>
        fixedTarget?.profile ||
        new URLSearchParams(location.search).get("trainingAthlete") ||
        "",
    ),
    [assignment, setAssignment] = useState<WorkoutAssignment | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState<"assign" | "remove" | null>(null),
    [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const fixedProfile = fixedTarget?.profile || "",
    fixed = !!fixedTarget;
  const Confirmation = embedded ? InlineAssignmentConfirmation : Modal;
  useEffect(() => {
    let active = true;
    if (fixed) return;
    void listAccess(service.client, "")
      .then((rows) => {
        if (active) setMembers(rows);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [service, fixed]);
  useEffect(() => {
    let active = true;
    if (account)
      void service
        .profiles(account)
        .then((rows) => {
          if (!active) return;
          setProfiles(rows);
          setProfilesLoaded(true);
          if (fixedProfile) {
            setProfile(
              rows.some((p) => p.id === fixedProfile) ? fixedProfile : "",
            );
            if (!rows.some((p) => p.id === fixedProfile))
              setError(
                "This athlete is no longer available in the selected account. Reload the athlete record.",
              );
          } else
            setProfile((current) =>
              rows.some((p) => p.id === current)
                ? current
                : rows.length === 1
                  ? rows[0].id
                  : "",
            );
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [account, service, retry, fixedProfile]);
  useEffect(() => {
    let active = true;
    if (account && profile)
      void service
        .assignment(account, profile)
        .then((value) => {
          if (active) setAssignment(value);
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [account, profile, service, retry]);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The assignment was not confirmed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <section
      className="workout-assignment"
      aria-label="Assign complete workout"
    >
      {!fixed && (
        <>
          <h2>Assign this workout</h2>
          <p>
            Choose the athlete who will follow this workout. Siblings can have
            different plans. Every drill must match the selected athlete. This
            does not change video-review permissions or start a subscription.
          </p>
        </>
      )}
      {dirty && (
        <Notice>
          Save or discard your template edits before assigning. Assignment uses
          the saved version.
        </Notice>
      )}
      {!fixed && (
        <label>
          Assign to customer account
          <select
            value={account}
            disabled={
              busy ||
              dirty ||
              (fixed && (!profilesLoaded || profile !== fixedProfile))
            }
            onChange={(e) => {
              setAssignment(null);
              setProfiles([]);
              setProfilesLoaded(false);
              setProfile("");
              setConfirm(null);
              setError("");
              setMessage("");
              setAccount(e.target.value);
            }}
          >
            <option value="">Choose a verified customer</option>
            {members
              .filter(
                (m) => m.email_verified && m.adult_setup && !isStaff(m.role),
              )
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.email}
                </option>
              ))}
          </select>
        </label>
      )}
      {!fixed && account && profiles.length > 0 && (
        <label>
          Assign to athlete
          <select
            value={profile}
            disabled={
              busy ||
              dirty ||
              (fixed && (!profilesLoaded || profile !== fixedProfile))
            }
            onChange={(e) => {
              setProfile(e.target.value);
              setAssignment(null);
              setConfirm(null);
              setMessage("");
              setError("");
            }}
          >
            <option value="">Choose an athlete</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname} · {p.age_group} · {p.position}
              </option>
            ))}
          </select>
        </label>
      )}
      {account && !profile && !error && (
        <p role="status">
          {!profilesLoaded
            ? "Loading private athletes…"
            : profiles.length
              ? "Choose an athlete to view their current assignment."
              : "No athletes loaded. Add a private athlete profile before assigning, or reload the customer."}
        </p>
      )}
      {profile && !assignment && !error && (
        <p role="status">Loading current workout assignment…</p>
      )}
      {assignment && (
        <>
          <p>
            Current workout:{" "}
            <strong>
              {assignment.workout_id ? assignment.workout_title : "None"}
            </strong>
          </p>
          <div className="actions">
            <button
              className="button"
              disabled={
                busy ||
                dirty ||
                (fixed && (!profilesLoaded || profile !== fixedProfile))
              }
              onClick={() =>
                void act(async () => {
                  if (fixed && (!profilesLoaded || profile !== fixedProfile))
                    throw new Error(
                      "Reload this athlete before assigning. No account-wide fallback will be used.",
                    );
                  if (
                    !(await service.preview(
                      workout,
                      account,
                      fixed ? fixedProfile : profile,
                    ))
                  )
                    throw new Error(
                      "No eligible athlete matches every drill for this selection. Existing training access is unchanged.",
                    );
                  setConfirm("assign");
                })
              }
            >
              Preview assignment
            </button>
            {assignment.workout_id && (
              <button
                className="text-button"
                disabled={
                  busy ||
                  dirty ||
                  (fixed && (!profilesLoaded || profile !== fixedProfile))
                }
                onClick={() => setConfirm("remove")}
              >
                Remove current assignment
              </button>
            )}
          </div>
        </>
      )}
      {error && !confirm && (
        <>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setAssignment(null);
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            Reload current assignment
          </button>
        </>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {confirm && assignment && (
        <Confirmation
          title={
            confirm === "assign"
              ? "Assign this complete workout?"
              : "Remove the current workout assignment?"
          }
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p>{members.find((m) => m.user_id === account)?.email}</p>
          <p>
            Athlete:{" "}
            <strong>{profiles.find((p) => p.id === profile)?.nickname}</strong>
          </p>
          <p>
            {confirm === "assign"
              ? `${workout.title} · version ${workout.version} · ${workout.resource_ids.length} ordered drills`
              : assignment.workout_title}
          </p>
          <p>
            {confirm === "assign"
              ? "This replaces only this athlete's current saved workout. Sibling plans stay unchanged. Every drill remains in its saved order."
              : "Separately granted loose-drill access and practice history stay unchanged."}{" "}
            No payment or video-review change will be made.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button"
              disabled={
                busy ||
                dirty ||
                (fixed && (!profilesLoaded || profile !== fixedProfile))
              }
              onClick={() =>
                void act(async () => {
                  const result = await service.assign(
                    confirm === "assign" ? workout : null,
                    account,
                    assignment.version,
                    fixed ? fixedProfile : profile,
                  );
                  setAssignment(result);
                  setConfirm(null);
                  onSaved?.();
                  setMessage(
                    result.workout_id
                      ? "Complete workout assigned. The athlete can refresh training to begin."
                      : "Workout assignment removed. Existing history and separate access are unchanged.",
                  );
                })
              }
            >
              {busy
                ? "Saving assignment…"
                : confirm === "assign"
                  ? "Confirm workout assignment"
                  : "Confirm removal of assignment"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Keep current assignment
            </button>
          </div>
        </Confirmation>
      )}
    </section>
  );
}

function InlineAssignmentConfirmation({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    ref.current?.focus();
    return () => {
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <section
      ref={ref}
      role="region"
      aria-label={title}
      tabIndex={-1}
      className="inline-assignment-confirm"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <h3>{title}</h3>
      {children}
    </section>
  );
}
