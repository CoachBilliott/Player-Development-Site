import { useRef, useState } from "react";
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
type Props = {
  onPublish: (drill: Drill, file: File) => Promise<void>;
  onUpdate?: (drill: Drill, file?: File) => Promise<void>;
  onRemove?: (drill: Drill) => Promise<void>;
  resources?: Drill[];
  lockedIds?: string[];
  scope?: "local" | "shared";
};
export function Admin({
  onPublish,
  onUpdate,
  onRemove,
  resources = [],
  lockedIds = [],
  scope = "local",
}: Props) {
  const shared = scope === "shared";
  const [editing, setEditing] = useState<Drill | null>(null);
  const [pendingEdit, setPendingEdit] = useState<Drill | null>(null);
  const [removing, setRemoving] = useState<Drill | null>(null);
  const [savedEdit, setSavedEdit] = useState(false);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
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
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
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
    equipment: editing?.equipment || "See uploaded practice instructions",
    lesson: `Coach-created ${shared ? "shared" : "local"} demo content. Illustrative and pending qualified review.`,
    steps: instructions
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    cue: "Take your time and pause whenever needed.",
    kind: "movement",
    source: shared ? "shared" : "local",
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
  function reset() {
    setEditing(null);
    setDraftId(crypto.randomUUID());
    setFile(undefined);
    setTitle("");
    setInstructions("");
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
    setEditing(resource);
    setFile(undefined);
    setTitle(resource.title);
    setInstructions(resource.steps.join("\n"));
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
      setSavedEdit(Boolean(editing));
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
  return (
    <main className="page narrow">
      <div className="page-intro">
        <Tag>CONTENT STUDIO · {shared ? "SHARED SAMPLE LIBRARY" : "DEMO"}</Tag>
        <h1 tabIndex={-1}>Coach content studio</h1>
        <p>
          Add a practice resource, choose who it fits, and see the match before
          you publish.
        </p>
      </div>
      {shared ? (
        <Notice>
          <strong>Shared sample publishing.</strong> Changes reach visitors to
          this website after refresh. Only approved coach accounts can publish.
          Use original or licensed, fictional sample content only. This does not
          create player accounts or sync practice history. Save drafts before
          leaving this screen.
        </Notice>
      ) : (
        <Notice>
          <strong>Only in this browser.</strong> Files and published drills stay
          on this device in browser storage. They are not shared with your
          partner or uploaded to a server. Clearing site data removes them.
          Unsaved drafts are lost if you leave this screen or refresh. This is
          an unrestricted demo editor, not production admin security. Use
          original or licensed, fictional sample content only.
        </Notice>
      )}
      {published && (
        <div className="success" role="status">
          <Check size={22} />
          <div>
            <strong>
              {savedEdit
                ? "Resource changes saved."
                : shared
                  ? "Published to the shared sample library."
                  : "Published to your local demo library."}
            </strong>
            <p>
              Find your drill in the <a href="#library">drill library</a>.
              {shared
                ? "Refresh another device to see the shared update."
                : "It will remain here after refresh on this browser."}
            </p>
          </div>
        </div>
      )}
      <div className="studio-steps">
        <span className={!review ? "active" : ""}>
          01 <b>Create</b>
        </span>
        <span className={review ? "active" : ""}>
          02 <b>Preview & publish</b>
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
          <ol className="instruction-list">
            {draft.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
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
            {shared ? "to website visitors" : "locally"}. It does not certify
            its safety, accuracy, or coaching quality. Qualified content review
            is required before real training use.
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
            setError("");
            setReview(true);
          }}
        >
          <h2>
            {editing ? "Edit a practice resource" : "Build a practice resource"}
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
                setFile(message ? undefined : selected);
                if (message) e.target.value = "";
                setPublished(false);
              }}
            />
          </label>
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
              <select value={goal} onChange={(e) => setGoal(e.target.value)}>
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
            children’s information and is appropriate, noncontact illustrative
            content pending qualified review.
          </label>
          <p className="form-error" role="alert">
            {error}
          </p>
          <div className="actions">
            <button className="button" type="submit">
              Preview matches <ArrowRight size={18} />
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setCancel(true)}
            >
              {editing ? "Cancel edits" : "Discard draft"}
            </button>
          </div>
          {cancel && (
            <div
              className="discard-box"
              role="group"
              aria-label="Confirm discard"
            >
              <p>Discard the file and all unsaved resource details?</p>
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
        </form>
      )}
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
