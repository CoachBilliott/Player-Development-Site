import { useState } from "react";
import { sundayReleaseInstant } from "./releaseSchedule";

type Draft = { date: string; time: string; zone: string };
const empty: Draft = { date: "", time: "", zone: "" };
function readDraft(key: string): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(key) || "null");
    if (d && [d.date, d.time, d.zone].every((v) => typeof v === "string"))
      return d;
  } catch {
    /* Missing or unavailable local storage leaves an empty draft. */
  }
  return empty;
}
/** Owner planning only. No publication endpoint, timer, cron or access change. */
export function ReleaseSchedulePreview({ userId }: { userId: string }) {
  const key = `repformed.schedule-draft.${userId}`;
  const [draft, setDraft] = useState(() => readDraft(key));
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function edit(field: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setPreview("");
    setError("");
    setMessage("");
  }
  return (
    <section
      className="panel workspace-section"
      aria-label="Sunday release draft"
    >
      <h2>Plan the Sunday release</h2>
      <p>
        Choose a time zone and time, then preview an example Sunday. Saved
        drafts stay on this device. Nothing is scheduled, published or assigned.
      </p>
      <form
        className="member-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setMessage("");
          setPreview("");
          try {
            setPreview(
              sundayReleaseInstant(
                draft.date,
                draft.time,
                draft.zone.trim(),
              ).toISOString(),
            );
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Check the Sunday, time and time zone.",
            );
          }
        }}
      >
        <label>
          Example Sunday
          <input
            type="date"
            required
            value={draft.date}
            onChange={(e) => edit("date", e.target.value)}
          />
        </label>
        <label>
          Sunday release time
          <input
            type="time"
            required
            value={draft.time}
            onChange={(e) => edit("time", e.target.value)}
          />
        </label>
        <label>
          Business time zone
          <input
            required
            list="release-time-zones"
            placeholder="America/Chicago"
            value={draft.zone}
            onChange={(e) => edit("zone", e.target.value)}
          />
        </label>
        <datalist id="release-time-zones">
          <option value="America/Chicago" />
          <option value="America/New_York" />
          <option value="America/Denver" />
          <option value="America/Los_Angeles" />
          <option value="UTC" />
        </datalist>
        <div className="actions">
          <button className="button" type="submit">
            Preview Sunday release
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setDraft(readDraft(key));
              setPreview("");
              setError("");
              setMessage(
                "Unsaved schedule edits discarded. No schedule was activated.",
              );
            }}
          >
            Discard schedule edits
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {preview && (
        <div>
          <p role="status">
            Example release instant (UTC):{" "}
            <time dateTime={preview}>{preview}</time>. Preview only.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              try {
                localStorage.setItem(key, JSON.stringify(draft));
                setMessage(
                  "Schedule draft saved on this device. No schedule was activated.",
                );
                setError("");
              } catch {
                setError(
                  "This device could not save the draft. Keep these values and try again; no schedule was activated.",
                );
              }
            }}
          >
            Save schedule draft on this device
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
