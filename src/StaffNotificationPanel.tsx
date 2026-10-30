import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  StaffNotifications,
  STAFF_MAIL_STATUS,
  type StaffMailState,
} from "./staffNotifications";
export function StaffNotificationPanel({
  client,
  actor,
}: {
  client: SupabaseClient;
  actor: string;
}) {
  const api = useMemo(() => new StaffNotifications(client), [client]);
  const [loaded, setLoaded] = useState<{
      actor: string;
      value: StaffMailState;
    } | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const state = loaded?.actor === actor ? loaded.value : null;
  useEffect(() => {
    let active = true;
    void api
      .load()
      .then((value) => {
        if (active) {
          setLoaded({ actor, value });
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setLoaded(null);
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [api, actor, attempt]);
  return (
    <section className="panel" aria-label="Staff operational email status">
      <h2>Staff email alerts</h2>
      <p>
        Operational staff alerts only. Client training and review updates stay
        in-app. Account sign-in and password-reset emails are separate.
      </p>
      <button
        className="button secondary"
        onClick={() => setAttempt((v) => v + 1)}
      >
        Refresh staff email status
      </button>
      {error && <p role="alert">{error}</p>}
      {state && (
        <>
          <p>
            <strong>
              {state.email_enabled
                ? "Staff dispatch enabled in the database"
                : "Staff email dispatch disabled"}
              .
            </strong>{" "}
            Provider acceptance does not confirm inbox delivery. No recurring
            reminders are enabled.
          </p>
          <p>
            New-signup alerts mean saved adult interest submissions only.
            Current recipient: <strong>{state.recipient_label}</strong>.
            Owner/Manager email routing is not active.
          </p>
          <p>
            {state.inapp_observation_enabled
              ? "In-app content observation enabled; worker invocation is still required."
              : "Automatic in-app observation disabled; existing manual checks remain available."}{" "}
            This does not activate a scheduler or device push.
          </p>
          <h3>Delivery attempts in your scope</h3>
          {!state.jobs.length ? (
            <p>
              No operational email attempts recorded. This does not prove all
              client services were delivered.
            </p>
          ) : (
            <ul className="delivery-list">
              {state.jobs.map((j) => (
                <li key={j.id}>
                  <strong>
                    {j.kind === "interest_received"
                      ? "New package interest"
                      : j.kind === "training_overdue"
                        ? "Overdue training delivery"
                        : "Overdue coaching review"}{" "}
                    · {j.athlete_name}
                  </strong>
                  <p>
                    {STAFF_MAIL_STATUS[j.state]} · {j.attempts} attempt
                    {j.attempts === 1 ? "" : "s"}
                  </p>
                  <p>
                    Target: {new Date(j.due_at).toLocaleString("en-US")}. Last
                    update: {new Date(j.updated_at).toLocaleString("en-US")}.
                  </p>
                  {j.code && <p>Result: {j.code.replaceAll("_", " ")}</p>}
                  {j.provider_id && (
                    <small>Provider reference: {j.provider_id}</small>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
