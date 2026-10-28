import { useState } from "react";
import type { LearningCatalog, LearningTransport } from "./api";
export function FutureWeekOverride({
  api,
  enrollment,
  plan,
  nextWeek,
  onSaved,
}: {
  api: LearningTransport;
  enrollment: string;
  plan: string;
  nextWeek: number;
  onSaved: () => void;
}) {
  const [catalog, setCatalog] = useState<LearningCatalog | null>(null),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  async function load() {
    setBusy(true);
    try {
      setCatalog(await api.catalog());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Future versions unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const week = catalog?.plans
      .find((p) => p.id === plan)
      ?.weeks_content.find((w) => w.id === selected);
    if (!week || busy) return;
    setBusy(true);
    try {
      await api.override(enrollment, week.week_number, week.id);
      setStatus(
        `Week ${week.week_number} will use version ${week.revision} for this athlete. Released history is unchanged.`,
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override was not saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Owner: adjust an upcoming week</summary>
      <button disabled={busy} onClick={() => void load()}>
        Load approved future versions
      </button>
      {catalog && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            Individual week override
            <select
              required
              value={selected}
              disabled={busy}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose approved version</option>
              {catalog.plans
                .find((p) => p.id === plan)
                ?.weeks_content.filter(
                  (w) => w.week_number >= nextWeek && w.ready,
                )
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    Week {w.week_number} · {w.title} · version {w.revision}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={busy || !selected}>
            Apply to this athlete only
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
    </details>
  );
}
