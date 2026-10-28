import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { PACKAGE_PROPOSALS } from "./packageProposals";
import { STAFF_MAIL_STATUS } from "./staffNotifications";
const schema = z.array(
  z.object({
    id: z.string().uuid(),
    adult_name: z.string(),
    email: z.string(),
    package_interest: z.string(),
    created_at: z.string(),
    email_state: z.enum([
      "disabled",
      "queued",
      "processing",
      "retry",
      "accepted",
      "failed",
      "suppressed",
      "uncertain",
    ]),
    launch_choice: z.boolean().nullable().default(null),
    launch_choice_at: z.string().nullable().default(null),
    launch_notice_version: z.string().nullable().default(null),
    launch_requested_at: z.string().nullable().default(null),
    launch_requested_version: z.string().nullable().default(null),
  }),
);
export function InterestInbox({
  client,
  actor,
}: {
  client: SupabaseClient;
  actor: string;
}) {
  const [snapshot, setSnapshot] = useState<{
      actor: string;
      attempt: number;
      rows: z.infer<typeof schema>;
    } | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await client.rpc("interest_staff_inbox");
        if (error)
          throw new Error(
            "Interest requests could not be loaded. Please retry.",
          );
        const rows = schema.parse(data);
        if (active) {
          setSnapshot({ actor, rows, attempt: refresh });
          setError("");
        }
      } catch {
        if (active) {
          setSnapshot(null);
          setError("Interest requests could not be loaded. Please retry.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [client, actor, refresh]);
  const rows = snapshot?.actor === actor ? snapshot.rows : null;
  const loading =
    !error &&
    (!snapshot || snapshot.actor !== actor || snapshot.attempt !== refresh);
  return (
    <section
      className="panel"
      aria-label="Private package interest inbox"
      aria-busy={loading}
    >
      <h2>Package interest</h2>
      <p>
        Adult interest only—not accounts, enrollment or purchases. Most recent
        100 requests. Email status records staff alerts to Repformed@gmail.com,
        not messages to applicants.
      </p>
      <button
        className="button secondary"
        disabled={loading}
        onClick={() => {
          setError("");
          setRefresh((v) => v + 1);
        }}
      >
        Refresh interest requests
      </button>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading interest requests…</p>}
      {rows &&
        (!rows.length ? (
          <p>No interest requests recorded.</p>
        ) : (
          <ul className="delivery-list">
            {rows.map((r) => (
              <li key={r.id}>
                <strong>{r.adult_name || "Adult contact"}</strong>
                <p>{r.email}</p>
                <p>
                  {PACKAGE_PROPOSALS.find((p) => p.id === r.package_interest)
                    ?.name || "Not sure yet"}{" "}
                  · {new Date(r.created_at).toLocaleString()}
                </p>
                <p>
                  {r.email_state === "disabled"
                    ? "Staff email not enabled for this submission"
                    : STAFF_MAIL_STATUS[r.email_state]}
                </p>
                <p>
                  Launch-email preference:{" "}
                  {r.launch_choice === true
                    ? "requested on this submission"
                    : r.launch_choice === false
                      ? "not requested on this submission"
                      : "not recorded on this submission"}
                  .
                </p>
                {(r.launch_choice_at || r.launch_requested_at) && (
                  <details>
                    <summary>Launch preference record</summary>
                    {r.launch_choice_at && (
                      <p>
                        Choice recorded{" "}
                        {new Date(r.launch_choice_at).toLocaleString()} ·{" "}
                        {r.launch_notice_version}.
                      </p>
                    )}
                    {r.launch_requested_at && r.launch_choice !== true && (
                      <p>
                        A separate affirmative request was recorded{" "}
                        {new Date(r.launch_requested_at).toLocaleString()} ·{" "}
                        {r.launch_requested_version}. This submission adds no
                        permission and does not erase that history.
                      </p>
                    )}
                    <p>
                      Email ownership is not verified by this form. No launch
                      announcement is sent by this feature.
                    </p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
