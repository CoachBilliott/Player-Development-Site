import { trainingUrl } from "../staffNavigation";
import { useEffect, useState } from "react";
import type { LearningNotice, LearningTransport } from "./api";
const labels = {
  content_ready: "New weekly content is available.",
  friday_incomplete: "There is unfinished work in this week’s plan.",
  low_content: "Fewer than the configured ready weeks remain.",
  no_content: "The next required week is not ready.",
};
export function LearningInbox({
  api,
  profile,
  staff = false,
  onOpenAthlete,
}: {
  api: LearningTransport;
  profile?: string;
  staff?: boolean;
  onOpenAthlete?: (profile: string) => void;
}) {
  const [notices, setNotices] = useState<LearningNotice[] | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let live = true;
    void api
      .inbox()
      .then((n) => {
        if (live) {
          setNotices(n);
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
  async function read(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await api.readNotice(id);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notice could not be updated.");
    } finally {
      setBusy("");
    }
  }
  const rows = notices?.filter((n) => !profile || n.profile_id === profile);
  return (
    <section aria-label="Plan notifications">
      <h3>Plan notices</h3>
      {!notices && !error && <p role="status">Loading notices…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setRefresh((n) => n + 1)}>
            Retry notices
          </button>
        </p>
      )}
      {rows?.length === 0 && <p>No active plan notices.</p>}
      {rows?.map((n) => (
        <article key={n.id}>
          {n.athlete_name && <strong>{n.athlete_name}</strong>}
          <p>
            {!n.read && <strong>Unread · </strong>}
            {labels[n.category]}
          </p>
          {staff && (
            <a
              className="button secondary"
              href={trainingUrl("workspace", { serviceAthlete: n.profile_id })}
              onClick={(e) => {
                if (onOpenAthlete) {
                  e.preventDefault();
                  onOpenAthlete(n.profile_id);
                }
              }}
            >
              Open {n.athlete_name || "affected athlete"}
            </a>
          )}
          {staff && n.next_due_at && (
            <p>
              Next release:{" "}
              {new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Chicago",
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(n.next_due_at))}{" "}
              Central
            </p>
          )}
          {!n.read && (
            <button disabled={!!busy} onClick={() => void read(n.id)}>
              Mark read
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
