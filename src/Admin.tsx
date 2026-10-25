import { appSurface } from "./mobile";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileUp, Users } from "lucide-react";
import {
  AGES,
  GOALS,
  LEVELS,
  POSITIONS,
  PROFILES,
  matches,
  type Drill,
} from "./model";
import { AssetPreview, Modal, Notice, Tag } from "./components";
import { validateFile } from "./storage";
import {
  deleteStaffDraft,
  loadStaffDraft,
  saveStaffDraft,
  type StaffDraft,
} from "./staffDrafts";
type Props = {
  onPublish: (drill: Drill, file: File) => Promise<void>;
  onUpdate?: (drill: Drill, file?: File) => Promise<void>;
  onRemove?: (drill: Drill) => Promise<void>;
  resources?: Drill[];
  lockedIds?: string[];
  scope?: "local" | "shared";
  draftOwnerId?: string;
  onBusyChange?: (busy: boolean) => void;
};
export function Admin({
  onPublish,
  onUpdate,
  onRemove,
  resources = [],
  lockedIds = [],
  scope = "local",
  draftOwnerId,
  onBusyChange,
}: Props) {
  const shared = scope === "shared";
  const [editing, setEditing] = useState<Drill | null>(null);
  const [pendingEdit, setPendingEdit] = useState<Drill | null>(null);
  const [removing, setRemoving] = useState<Drill | null>(null);
  const [savedEdit, setSavedEdit] = useState(false);
  const [visibility, setVisibility] = useState<"member_only" | "public_sample">(
    "member_only",
  );
  const [savedVisibility, setSavedVisibility] = useState<
    "member_only" | "public_sample"
  >("member_only");
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [equipment, setEquipment] = useState("");
  const [lesson, setLesson] = useState("");
  const [cue, setCue] = useState("");
  const [savedDraft, setSavedDraft] = useState<StaffDraft | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftProblem, setDraftProblem] = useState("");
  const [draftChecked, setDraftChecked] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmSavedRemoval, setConfirmSavedRemoval] = useState(false);
  const [confirmDraftReplacement, setConfirmDraftReplacement] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<{
    data: string;
    file: File;
  } | null>(null);
  const [ages, setAges] = useState<string[]>(["8–12"]);
  const [levels, setLevels] = useState<string[]>([LEVELS[0]]);
  const [position, setPosition] = useState("");
  const [goal, setGoal] = useState<string>(GOALS[0]);
  const [minutes, setMinutes] = useState(4);
  const [permission, setPermission] = useState(false);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(false);
  const [cancel, setCancel] = useState(false);
  const hasFile = Boolean(file || editing?.assetId);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (!shared || !draftOwnerId) return;
    let active = true;
    void loadStaffDraft(draftOwnerId)
      .then((value) => {
        if (active) setSavedDraft(value);
      })
      .catch((e: Error) => {
        if (active) setDraftProblem(e.message);
      })
      .finally(() => {
        if (active) setDraftChecked(true);
      });
    return () => {
      active = false;
    };
  }, [draftOwnerId, shared]);
  const toggle = (v: string, list: string[], set: (v: string[]) => void) =>
    set(list.includes(v) ? list.filter((a) => a !== v) : [...list, v]);
  const draft: Drill = {
    id: editing?.id || draftId,
    sport: "football",
    title: title.trim(),
    skill: goal as Drill["skill"],
    ages: ages as Drill["ages"],
    positions: position ? [position as Drill["positions"][number]] : [],
    levels: levels as Drill["levels"],
    minutes,
    equipment: equipment.trim() || "See uploaded practice instructions",
    lesson:
      lesson.trim() ||
      `Coach-created ${shared ? "shared" : "local"} content. Illustrative and pending qualified review.`,
    steps: instructions
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    cue: cue.trim() || "Take your time and pause whenever needed.",
    kind: editing?.kind || "movement",
    source: shared ? "shared" : "local",
    visibility: shared ? visibility : "public_sample",
    ...(editing
      ? {
          assetId: editing.assetId,
          assetType: editing.assetType,
          assetName: editing.assetName,
          assetUrl: editing.assetUrl,
          backendVersion: editing.backendVersion,
        }
      : {}),
  };
  async function keepDraft(replace = false) {
    if (locked.current || !draftOwnerId || !file || editing) return;
    if (savedDraft && savedDraft.drill.id !== draft.id && !replace) {
      setConfirmDraftReplacement(true);
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 20) {
      setDraftProblem("Set planned minutes between 1 and 20 before saving.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setSavingDraft(true);
    setDraftProblem("");
    try {
      const value = await saveStaffDraft(draftOwnerId, draft, file);
      setSavedDraft(value);
      setSavedSnapshot({ data: JSON.stringify(draft), file });
      setDraftMessage(
        "Draft saved on this device. Nothing has been published.",
      );
      setConfirmDraftReplacement(false);
    } catch (e) {
      setDraftProblem(
        e instanceof Error
          ? e.message
          : "Could not save the draft. Keep this screen open and try again.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
      setSavingDraft(false);
    }
  }
  async function discardSavedDraft() {
    if (!draftOwnerId || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await deleteStaffDraft(draftOwnerId);
      setSavedDraft(null);
      setSavedSnapshot(null);
      setDraftProblem("");
      setDraftMessage(
        "Saved device draft removed. Published resources are unchanged.",
      );
      setConfirmSavedRemoval(false);
    } catch (e) {
      setDraftProblem(
        e instanceof Error
          ? e.message
          : "Could not remove the draft. Try again.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function resumeDraft(value: StaffDraft) {
    setEditing(null);
    setDraftId(value.drill.id);
    setFile(value.file);
    setTitle(value.drill.title);
    setInstructions(value.drill.steps.join("\n"));
    setEquipment(value.drill.equipment);
    setLesson(value.drill.lesson);
    setCue(value.drill.cue);
    setAges(value.drill.ages);
    setLevels(value.drill.levels);
    setPosition(value.drill.positions[0] || "");
    setGoal(value.drill.skill);
    setMinutes(value.drill.minutes);
    setVisibility(value.drill.visibility || "member_only");
    setPermission(false);
    setReview(false);
    setPublished(false);
    setSavedSnapshot({ data: JSON.stringify(value.drill), file: value.file });
    setDraftMessage(
      "Device draft restored. Review the content rights again before publishing.",
    );
  }
  function reset() {
    setVisibility("member_only");
    setEditing(null);
    setDraftId(crypto.randomUUID());
    setFile(undefined);
    setTitle("");
    setInstructions("");
    setEquipment("");
    setLesson("");
    setCue("");
    setSavedSnapshot(null);
    setDraftMessage("");
    setAges(["8–12"]);
    setLevels([LEVELS[0]]);
    setPosition("");
    setGoal(GOALS[0]);
    setMinutes(4);
    setPermission(false);
    setReview(false);
    setCancel(false);
    setError("");
    if (input.current) input.current.value = "";
  }
  function edit(resource: Drill) {
    setVisibility(resource.visibility || "public_sample");
    setEditing(resource);
    setFile(undefined);
    setTitle(resource.title);
    setInstructions(resource.steps.join("\n"));
    setEquipment(resource.equipment);
    setLesson(resource.lesson);
    setCue(resource.cue);
    setAges(resource.ages);
    setLevels(resource.levels);
    setPosition(resource.positions[0] || "");
    setGoal(resource.skill);
    setMinutes(resource.minutes);
    setPermission(false);
    setReview(false);
    setPublished(false);
    setError("");
    setPendingEdit(null);
    if (input.current) input.current.value = "";
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function remove(resource: Drill) {
    if (locked.current || !onRemove) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await onRemove(resource);
      setPublished(false);
      setRemoving(null);
      if (editing?.id === resource.id) reset();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not remove the resource. Try again.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function publish() {
    if (locked.current || (!file && !editing)) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      if (editing && onUpdate) await onUpdate(draft, file);
      else if (file) await onPublish(draft, file);
      else return;
      if (!editing && draftOwnerId && savedDraft?.drill.id === draft.id) {
        try {
          await deleteStaffDraft(draftOwnerId, draft.id);
          setSavedDraft(null);
        } catch {
          setDraftProblem(
            "Published successfully, but the old device draft could not be removed. Remove it before starting another upload.",
          );
        }
      }
      setSavedEdit(Boolean(editing));
      setSavedVisibility(visibility);
      reset();
      setPublished(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Publishing failed. Your draft is still available.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const uploadGuidance = (
    <>
      <details className="upload-help panel">
        <summary>How uploads work</summary>
        <ol>
          <li>
            <strong>Choose your file.</strong> On your phone, select a short
            video from Photos or a file from Files. Nothing is published yet.
          </li>
          <li>
            <strong>Add the workout.</strong> Give it a title, write one
            practice step per line, then choose the ages, position, level and
            skill it fits.
          </li>
          <li>
            <strong>Preview, then publish.</strong> Check the attachment,
            instructions and matching fictional players. You can go back and
            change anything.
          </li>
        </ol>
        <p>
          {shared
            ? "New shared uploads default to protected staff review. Only resources explicitly marked Public demo sample appear for free in the demo. Paid-package access is not active."
            : "This is a practice upload. To share with your partner, choose Shared website and sign in with a staff account."}
        </p>
        <p>
          Use MP4 or WebM for video, or PNG, JPEG, WebP, PDF or TXT. Maximum 12
          MB per file. Trim or export longer phone videos as a smaller MP4
          first; MOV/HEVC files need conversion. Uploading does not convert or
          compress video.
        </p>
      </details>
      <details className="upload-policy" open={!appSurface()}>
        <summary>Publishing rules & device storage</summary>
        {shared ? (
          <Notice>
            <strong>Staff publishing.</strong> Choose protected content or a
            free public demo sample. Only approved staff accounts can publish.
            Use original or licensed, fictional sample content only. This does
            not create player accounts. New uploads can be explicitly saved as a
            device draft. They do not sync to your partner and are cleared on
            sign-out or when you clear site data.
          </Notice>
        ) : (
          <Notice>
            <strong>Only in this browser.</strong> Your partner cannot see these
            files or drills. Clearing browser data removes them; leaving or
            refreshing loses unpublished drafts. Use original or licensed,
            fictional sample content only.
          </Notice>
        )}
      </details>
    </>
  );
  return (
    <main className="page narrow">
      <div className="page-intro">
        <Tag>
          CONTENT STUDIO · {shared ? "SHARED TRAINING" : "LOCAL PRACTICE"}
        </Tag>
        <h1 tabIndex={-1}>Coach content studio</h1>
        <p>Choose a file. Add the workout details. Preview and publish.</p>
      </div>
      {!appSurface() && uploadGuidance}
      {shared && draftOwnerId && (
        <section className="device-draft" aria-label="Device draft">
          {savedDraft && !file && !editing && (
            <>
              <h2>Pick up where you left off</h2>
              <p>
                <strong>{savedDraft.drill.title || savedDraft.filename}</strong>{" "}
                · saved {new Date(savedDraft.savedAt).toLocaleString()}
              </p>
              <div className="actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => resumeDraft(savedDraft)}
                >
                  Continue saved draft
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setConfirmSavedRemoval(true)}
                >
                  Remove saved draft
                </button>
              </div>
            </>
          )}
          {draftMessage && (
            <p role="status">
              {draftMessage}
              {savedSnapshot && JSON.stringify(draft) !== savedSnapshot.data
                ? " New changes are not saved yet."
                : ""}
            </p>
          )}
          {draftProblem && (
            <p role="alert" className="form-error">
              {draftProblem}
            </p>
          )}
          {draftProblem && !savedDraft && !file && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setConfirmSavedRemoval(true)}
            >
              Remove unreadable device draft
            </button>
          )}
        </section>
      )}
      {confirmSavedRemoval && (
        <Modal
          title="Remove this saved device draft?"
          onClose={() => {
            if (!busy) setConfirmSavedRemoval(false);
          }}
        >
          <p>
            This removes the saved file and details from this device. Published
            resources are unchanged.
          </p>
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void discardSavedDraft()}
            >
              Yes, remove saved draft
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirmSavedRemoval(false)}
            >
              Keep saved draft
            </button>
          </div>
          {draftProblem && (
            <p className="form-error" role="alert">
              {draftProblem}
            </p>
          )}
        </Modal>
      )}
      {confirmDraftReplacement && (
        <Modal
          title="Replace the saved device draft?"
          onClose={() => {
            if (!busy) setConfirmDraftReplacement(false);
          }}
        >
          <p>
            One new-upload draft can be kept on this device for your account.
            Replace “{savedDraft?.drill.title || savedDraft?.filename}” with the
            current file and details?
          </p>
          <div className="actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => void keepDraft(true)}
            >
              Replace saved draft
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirmDraftReplacement(false)}
            >
              Keep existing saved draft
            </button>
          </div>
          {draftProblem && (
            <p className="form-error" role="alert">
              {draftProblem}
            </p>
          )}
        </Modal>
      )}
      {published && (
        <div className="success" role="status">
          <Check size={22} />
          <div>
            <strong>
              {savedEdit
                ? "Resource changes saved."
                : shared
                  ? savedVisibility === "member_only"
                    ? "Saved to the protected training library."
                    : "Published to the shared sample library."
                  : "Published to your local demo library."}
            </strong>
            <p>
              Find your resource in the{" "}
              <a
                href={
                  shared && savedVisibility === "member_only"
                    ? "#member-library"
                    : "#library"
                }
              >
                {shared && savedVisibility === "member_only"
                  ? "staff content library"
                  : "demo drill library"}
              </a>
              .
              {shared
                ? savedVisibility === "member_only"
                  ? "An Owner can assign protected resources to verified pilot accounts through Workouts & video review access. No subscription is started."
                  : "Refresh another device to see the shared update."
                : "It will remain here after refresh on this browser."}
            </p>
          </div>
        </div>
      )}
      <div className="studio-steps upload-steps" aria-label="Upload steps">
        <span
          className={!hasFile && !review ? "active" : ""}
          aria-current={!hasFile && !review ? "step" : undefined}
        >
          01 <b>Choose file</b>
        </span>
        <span
          className={hasFile && !review ? "active" : ""}
          aria-current={hasFile && !review ? "step" : undefined}
        >
          02 <b>Workout details</b>
        </span>
        <span
          className={review ? "active" : ""}
          aria-current={review ? "step" : undefined}
        >
          03 <b>Preview & publish</b>
        </span>
      </div>
      {editing && (
        <div className="editing-notice" role="status">
          Editing: <strong>{editing.title}</strong>. Keep the existing file or
          choose a replacement.
        </div>
      )}
      {review ? (
        <section className="panel studio">
          <button
            className="text-button"
            onClick={() => setReview(false)}
            disabled={busy}
          >
            <ArrowLeft size={17} /> Back to editing
          </button>
          <h2>{draft.title}</h2>
          <p className="upload-destination">
            {shared
              ? visibility === "member_only"
                ? "Destination: protected training library · staff review only"
                : "Destination: shared website · free public demo sample"
              : "Destination: this browser only · practice upload"}
          </p>
          <p>
            {draft.minutes} minute practice · {draft.skill} ·{" "}
            {draft.ages.join(", ")}
          </p>
          {file ? (
            <AssetPreview file={file} />
          ) : editing?.assetId ? (
            <AssetPreview drill={editing} />
          ) : null}
          <h3>Practice instructions</h3>
          <p>{draft.lesson}</p>
          <p>
            <strong>You need:</strong> {draft.equipment}
          </p>
          <ol className="instruction-list">
            {draft.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="coaching-cue">
            <strong>Remember:</strong> {draft.cue}
          </p>
          <h3>
            <Users size={20} /> Matching fictional players
          </h3>
          <p>
            Matches use age, position, experience, and the player’s primary
            goal.
          </p>
          <div className="match-list">
            {PROFILES.filter((p) => matches(draft, p)).map((p) => (
              <div key={p.id}>
                <span className="avatar small">{p.name[0]}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.age} · {p.position}
                  </small>
                </span>
                <Check size={18} />
              </div>
            ))}
          </div>
          {!PROFILES.some((p) => matches(draft, p)) && (
            <Notice>
              No sample profile matches all four selections. You can edit the
              audience or publish for a different fictional profile created in
              onboarding.
            </Notice>
          )}
          <Notice>
            Publishing makes this illustrative resource available{" "}
            {shared
              ? visibility === "member_only"
                ? "to authorized staff for review only"
                : "to website visitors as a free sample"
              : "locally"}
            . It does not certify its safety, accuracy, or coaching quality.
            Qualified content review is required before real training use.
          </Notice>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="button"
            onClick={() => void publish()}
            disabled={busy}
          >
            {busy
              ? "Saving…"
              : editing
                ? "Save resource changes"
                : shared
                  ? "Publish to shared library"
                  : "Publish to demo library"}{" "}
            <ArrowRight size={18} />
          </button>
        </section>
      ) : (
        <form
          className="panel studio"
          onSubmit={(e) => {
            e.preventDefault();
            if (!file && !editing?.assetId) {
              setError("Choose a sample file first.");
              return;
            }
            if (!ages.length || !levels.length) {
              setError("Select at least one age group and experience level.");
              return;
            }
            if (draft.steps.length === 0) {
              setError("Add at least one practice step.");
              return;
            }
            if (!draft.title) {
              setError("Give this resource a title.");
              return;
            }
            if (draft.steps.length > 100) {
              setError("Use no more than 100 practice steps.");
              return;
            }
            setError("");
            setReview(true);
          }}
        >
          <fieldset className="studio-fields" disabled={busy}>
            <h2>
              {editing
                ? "Edit a practice resource"
                : hasFile
                  ? "Add your workout details"
                  : "Start with your video or file"}
            </h2>
            <label className="upload-zone">
              <FileUp size={30} />
              <strong>
                {file
                  ? file.name
                  : editing?.assetName
                    ? `Current file: ${editing.assetName}`
                    : "Choose a video or file"}
              </strong>
              <span>MP4, WebM, PNG, JPEG, WebP, PDF or TXT · up to 12 MB</span>
              <input
                ref={input}
                aria-label="Choose a video or file"
                type="file"
                accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,application/pdf,text/plain"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (!selected) return;
                  const message = validateFile(selected);
                  setError(message);
                  if (!message) {
                    setFile(selected);
                    if (!title.trim())
                      setTitle(
                        selected.name
                          .replace(/\.[^.]+$/, "")
                          .replace(/[-_]+/g, " ")
                          .slice(0, 90),
                      );
                  } else e.target.value = "";
                  setPublished(false);
                }}
              />
            </label>
            {!hasFile && (
              <p className="upload-hint">
                Tap Choose a video or file to open your phone’s picker. Your
                workout fields appear after you choose a supported file. Nothing
                uploads until you publish.
              </p>
            )}
            {hasFile && (
              <>
                <p className="upload-hint">
                  {file
                    ? `${file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`} selected`
                    : "Your current attachment is kept unless you choose a replacement."}{" "}
                  ·{" "}
                  {shared
                    ? "Save a device draft below if you want to finish later."
                    : "Draft stays on this screen until you publish."}
                </p>
                <label>
                  Resource title
                  <input
                    required
                    maxLength={90}
                    placeholder="e.g. Find your first step"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  What this drill trains
                  <textarea
                    rows={2}
                    maxLength={2000}
                    placeholder="Explain the skill and purpose in one or two clear sentences."
                    value={lesson}
                    onChange={(e) => setLesson(e.target.value)}
                  />
                </label>
                <label>
                  Equipment and practice space
                  <input
                    maxLength={500}
                    placeholder="List the equipment and space needed for this activity."
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                  />
                </label>
                <label>
                  Step-by-step instructions
                  <textarea
                    required
                    rows={5}
                    maxLength={4000}
                    placeholder={
                      "One clear step per line.\nUse age-appropriate, noncontact sample activities."
                    }
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </label>
                <label>
                  Main coaching cue
                  <input
                    maxLength={500}
                    placeholder="The one thing to remember while practicing."
                    value={cue}
                    onChange={(e) => setCue(e.target.value)}
                  />
                </label>
                {shared && (
                  <label>
                    Content access
                    <select
                      value={visibility}
                      onChange={(e) =>
                        setVisibility(e.target.value as typeof visibility)
                      }
                    >
                      <option value="member_only">
                        Protected training — staff review only
                      </option>
                      <option value="public_sample">
                        Public demo sample — free for everyone
                      </option>
                    </select>
                    <span className="upload-hint">
                      Protected is the default. Member package access is not
                      active yet; this choice does not start a subscription.
                    </span>
                  </label>
                )}
                <div
                  className="audience-shortcuts"
                  role="group"
                  aria-label="Quick audience selections"
                >
                  <strong>Quick start: choose a sample audience</strong>
                  <p>
                    Sets ages, position, experience and skill. Check each choice
                    fits your content before publishing.
                  </p>
                  <div className="actions">
                    {PROFILES.map((profile) => (
                      <button
                        className="button secondary"
                        type="button"
                        key={profile.id}
                        onClick={() => {
                          setAges([profile.age]);
                          setPosition(profile.position);
                          setLevels([profile.level]);
                          setGoal(profile.goal);
                        }}
                      >
                        {profile.name} · {profile.age}
                      </button>
                    ))}
                  </div>
                </div>
                <fieldset>
                  <legend>
                    Intended ages <span>Choose at least one</span>
                  </legend>
                  <div className="chips">
                    {AGES.map((a) => (
                      <label
                        className={`check-chip ${ages.includes(a) ? "selected" : ""}`}
                        key={a}
                      >
                        <input
                          type="checkbox"
                          checked={ages.includes(a)}
                          onChange={() => toggle(a, ages, setAges)}
                        />
                        {a === "18+" ? "18+ & adults" : `Ages ${a}`}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>
                    Experience <span>Choose at least one</span>
                  </legend>
                  <div className="chips">
                    {LEVELS.map((l) => (
                      <label
                        className={`check-chip ${levels.includes(l) ? "selected" : ""}`}
                        key={l}
                      >
                        <input
                          type="checkbox"
                          checked={levels.includes(l)}
                          onChange={() => toggle(l, levels, setLevels)}
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="form-grid">
                  <label>
                    Position
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    >
                      <option value="">All positions</option>
                      {POSITIONS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Primary goal / skill
                    <select
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                    >
                      {GOALS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Practice duration (minutes)
                    <input
                      type="number"
                      min={1}
                      max={20}
                      required
                      value={minutes}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                    />
                  </label>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    required
                    checked={permission}
                    onChange={(e) => setPermission(e.target.checked)}
                  />{" "}
                  I have the rights to this sample content. It contains no real
                  children’s information and is appropriate, noncontact
                  illustrative content pending qualified review.
                </label>
                <p className="form-error" role="alert">
                  {error}
                </p>
                <div className="actions">
                  <button className="button" type="submit">
                    Preview matches <ArrowRight size={18} />
                  </button>
                  {shared && draftOwnerId && !editing && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={
                        busy ||
                        !draftChecked ||
                        (savedSnapshot?.data === JSON.stringify(draft) &&
                          savedSnapshot.file === file)
                      }
                      onClick={() => void keepDraft()}
                    >
                      {savingDraft
                        ? "Saving device draft…"
                        : "Save draft on this device"}
                    </button>
                  )}
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setCancel(true)}
                  >
                    {editing ? "Cancel edits" : "Discard draft"}
                  </button>
                </div>
                {shared && !editing && (
                  <p className="upload-hint">
                    Device drafts keep this file and text on this device only.
                    Save again after changes. Nothing is uploaded until Publish.
                  </p>
                )}
              </>
            )}
            {!hasFile && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {cancel && (
              <div
                className="discard-box"
                role="group"
                aria-label="Confirm discard"
              >
                <p>
                  Discard the file and all unsaved resource details?{" "}
                  {savedDraft &&
                    "Your explicitly saved device draft remains available."}
                </p>
                <button className="button danger" type="button" onClick={reset}>
                  Yes, discard draft
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setCancel(false)}
                >
                  Keep editing
                </button>
              </div>
            )}
          </fieldset>
        </form>
      )}
      {appSurface() && uploadGuidance}
      {resources.length > 0 && (
        <section className="panel content-manager">
          <h2>{shared ? "Shared resources" : "Your uploaded resources"}</h2>
          <p>
            {shared
              ? "Edit a resource or remove it from the shared library."
              : "Edit or remove content saved in this browser."}{" "}
            Resources used by your active session are locked until you finish or
            end it.
          </p>
          <ul className="resource-manager-list">
            {resources.map((resource) => (
              <li key={resource.id}>
                <div>
                  <strong>{resource.title}</strong>
                  <small>
                    {resource.assetName} · {resource.minutes} min
                  </small>
                </div>
                <div className="actions">
                  {onUpdate && (
                    <button
                      className="button secondary"
                      disabled={busy || lockedIds.includes(resource.id)}
                      aria-label={`Edit ${resource.title}`}
                      onClick={() => {
                        if (title || instructions || file || editing)
                          setPendingEdit(resource);
                        else edit(resource);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  {onRemove && (
                    <button
                      className="text-button"
                      disabled={busy || lockedIds.includes(resource.id)}
                      aria-label={`Remove ${resource.title}`}
                      onClick={() => {
                        setError("");
                        setRemoving(resource);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pendingEdit && (
        <Modal
          title="Discard this draft to edit another resource?"
          onClose={() => setPendingEdit(null)}
        >
          <p>
            Your unsaved changes will be discarded. Published resources will
            stay unchanged.
          </p>
          <div className="actions">
            <button className="button" onClick={() => edit(pendingEdit)}>
              Discard draft and edit
            </button>
            <button
              className="button secondary"
              onClick={() => setPendingEdit(null)}
            >
              Keep current draft
            </button>
          </div>
        </Modal>
      )}
      {removing && (
        <Modal
          title="Remove this resource?"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <p>
            Remove “{removing.title}”{" "}
            {shared
              ? "from the shared library for all visitors"
              : "and its attachment from this browser"}
            ? Existing practice history stays saved.
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
              onClick={() => void remove(removing)}
            >
              {busy ? "Removing…" : "Yes, remove resource"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Keep resource
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
