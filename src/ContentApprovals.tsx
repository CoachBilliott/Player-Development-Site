import { useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { AssetPreview, Modal, Notice, Tag } from "./components";
import { MemberAccountPage } from "./MemberAccount";
import { isStaff } from "./roles";
import type { SharedState } from "./useSharedContent";
import type { Drill } from "./model";
import { staffHandoff } from "./staffHandoff";
const REVIEW_LABELS = {
  draft: "Draft",
  pending: "Awaiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
export function ContentApprovals({ shared }: { shared: SharedState }) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Drill | null>(null);
  const [decision, setDecision] = useState<
    "submit" | "approve" | "request_changes" | null
  >(null);
  const [note, setNote] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  if (
    !shared.signedIn ||
    !shared.accessReady ||
    shared.accessError ||
    !isStaff(shared.role)
  )
    return <MemberAccountPage shared={shared} />;
  const canApprove = shared.role === "owner" || shared.role === "manager";
  const rows = shared.resources.filter((d) => shared.canEditResource(d.id));
  const visible = rows.filter(
    (d) =>
      (filter === "all" || (d.reviewStage || "approved") === filter) &&
      d.title.toLowerCase().includes(query.toLowerCase()),
  );
  function next(drill: Drill, purpose: "workout" | "editor") {
    staffHandoff(shared.session!.user.id, drill.id, purpose);
    window.location.assign(
      purpose === "workout" ? "#workout-builder" : "#coach",
    );
  }
  return (
    <main className="page content-approvals">
      <div className="page-intro">
        <Tag>PRIVATE STAFF · CONTENT REVIEW</Tag>
        <h1 tabIndex={-1}>Ready for the next player.</h1>
        <p>
          Save a draft. Send it for review. Approved content can be published
          and assigned.
        </p>
        <a href="#coach" className="text-button">
          Upload or edit a drill <ArrowRight size={17} />
        </a>
      </div>
      <Notice>
        Staff approval records a release decision. Qualified coaching review,
        appropriate media rights and age suitability remain your responsibility.
        Keep pilot material illustrative until those reviews are complete.
      </Notice>
      <div className="review-library-tools">
        <label>
          Find a drill
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Review stage
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All stages</option>
            {Object.entries(REVIEW_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          disabled={busy || shared.checking}
          onClick={() => void shared.refresh()}
        >
          <RefreshCw size={16} />
          Refresh queue
        </button>
      </div>
      {(error || shared.error) && (
        <p className="form-error" role="alert">
          {error || shared.error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!shared.libraryReady && (
        <p role="status">Loading the private review queue…</p>
      )}
      {shared.libraryReady && !visible.length && (
        <p>
          No resources match this view. Upload a drill to start a shared draft.
        </p>
      )}
      <ul className="approval-list">
        {visible.map((drill) => {
          const stage = drill.reviewStage || "approved";
          return (
            <li className="panel" key={drill.id}>
              <Tag>{REVIEW_LABELS[stage]}</Tag>
              <h2>{drill.title}</h2>
              <p>
                {drill.minutes} planned minutes ·{" "}
                {drill.visibility === "member_only"
                  ? "Protected training"
                  : "Public sample after approval"}
              </p>
              {drill.reviewNotes && (
                <p className="coach-feedback">
                  <strong>Review note:</strong> {drill.reviewNotes}
                </p>
              )}
              <div className="actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setSelected(drill);
                    setDecision(null);
                    setError("");
                  }}
                >
                  Preview & review
                </button>
                {stage === "approved" && drill.visibility === "member_only" && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => next(drill, "workout")}
                  >
                    Build a workout with this drill <ArrowRight size={17} />
                  </button>
                )}
                {(stage === "draft" || stage === "changes_requested") && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => next(drill, "editor")}
                  >
                    Edit draft
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {selected && (
        <Modal
          title={selected.title}
          onClose={() => {
            if (!busy) {
              setSelected(null);
              setDecision(null);
            }
          }}
        >
          <Tag>
            {REVIEW_LABELS[selected.reviewStage || "approved"]} · VERSION{" "}
            {selected.backendVersion}
          </Tag>
          <AssetPreview drill={selected} />
          <p>{selected.lesson}</p>
          <p>
            <strong>Equipment:</strong> {selected.equipment}
          </p>
          <ol className="compact-steps">
            {selected.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p>
            <strong>Coaching cue:</strong> {selected.cue}
          </p>
          <p>
            Intended ages: {selected.ages.join(", ")} ·{" "}
            {selected.levels.join(", ")} ·{" "}
            {selected.positions.join(", ") || "All football positions"}
          </p>
          {!decision && (
            <div className="actions">
              {["draft", "changes_requested"].includes(
                selected.reviewStage || "approved",
              ) && (
                <button
                  className="button"
                  onClick={() => {
                    setDecision("submit");
                    setNote("");
                  }}
                >
                  Send for review
                </button>
              )}
              {canApprove && selected.reviewStage === "pending" && (
                <>
                  <button
                    className="button"
                    onClick={() => {
                      setDecision("approve");
                      setNote("");
                      setAck(false);
                    }}
                  >
                    Approve & publish
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setDecision("request_changes");
                      setNote("");
                    }}
                  >
                    Request changes
                  </button>
                </>
              )}
            </div>
          )}
          {decision && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (busy || (decision === "approve" && !ack)) return;
                setBusy(true);
                setError("");
                void shared
                  .service!.review(selected, decision, note)
                  .then(async () => {
                    await shared.refresh();
                    setSelected(null);
                    setDecision(null);
                    setMessage(
                      decision === "approve"
                        ? "Approved and published. Protected drills are ready to add to a workout."
                        : decision === "submit"
                          ? "Sent for Owner or Manager review. Members cannot see this draft."
                          : "Changes requested. The creator can revise and resubmit.",
                    );
                  })
                  .catch((e) =>
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Review could not be saved.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <label className="review-note-label">
                {decision === "request_changes"
                  ? "What needs to change?"
                  : "Review note (optional)"}
                <textarea
                  rows={3}
                  maxLength={2000}
                  required={decision === "request_changes"}
                  disabled={busy}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              {decision === "approve" && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    required
                    checked={ack}
                    disabled={busy}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  I reviewed the attachment, instructions, rights and intended
                  audience for release.
                </label>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <div className="actions">
                <button
                  className="button"
                  disabled={busy || (decision === "approve" && !ack)}
                >
                  {busy
                    ? "Saving…"
                    : decision === "approve"
                      ? "Confirm approval & publish"
                      : decision === "submit"
                        ? "Confirm send for review"
                        : "Confirm request changes"}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => setDecision(null)}
                >
                  Keep reviewing
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </main>
  );
}
