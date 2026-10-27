import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  StaffService,
  type ServiceRoster,
  type StaffAthlete,
} from "./staffService";
import { Modal, Tag } from "./components";
import { reviewDate, SERVICE_LABELS } from "./reviewServices";
import "./staffService.css";
function observed(value?: string | null) {
  return value ? reviewDate(value) : "Not observed";
}
export function StaffServiceDashboard({
  client,
  role,
  actor,
  enabled,
}: {
  client: SupabaseClient;
  role: "owner" | "manager" | "coach";
  actor: string;
  enabled: boolean;
}) {
  const api = useMemo(() => new StaffService(client), [client]);
  const [data, setData] = useState<ServiceRoster | null>(null),
    [current, setCurrent] = useState<StaffAthlete | null>(null),
    [target, setTarget] = useState(() => {
      const id = new URLSearchParams(window.location.search).get(
        "serviceAthlete",
      );
      return id && /^[0-9a-f-]{36}$/i.test(id) ? id : "";
    }),
    [coach, setCoach] = useState(""),
    [error, setError] = useState(""),
    [detailError, setDetailError] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0),
    [filter, setFilter] = useState("all");
  const lock = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void api
      .roster()
      .then((v) => {
        if (active) {
          setData(v);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setData(null);
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [api, enabled, attempt, actor, role]);
  useEffect(() => {
    if (!enabled || !target) return;
    let active = true;
    void api
      .athlete(target)
      .then((v) => {
        if (active) {
          setCurrent(v);
          setCoach(v.coach_id || "");
          setDetailError("");
        }
      })
      .catch((e) => {
        if (active) {
          setCurrent(null);
          setDetailError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [api, target, attempt, actor, role, enabled]);
  function open(id: string) {
    setCurrent(null);
    setDetailError("");
    setTarget(id);
    const u = new URL(window.location.href);
    u.searchParams.set("serviceAthlete", id);
    history.replaceState(null, "", u);
  }
  function close() {
    setTarget("");
    setCurrent(null);
    setDetailError("");
    const u = new URL(window.location.href);
    u.searchParams.delete("serviceAthlete");
    history.replaceState(null, "", u);
  }
  const rows = (data?.rows || []).filter(
    (r) =>
      filter === "all" ||
      (filter === "overdue" && !!r.overdue_reviews) ||
      (filter === "unassigned" && !r.coach_id) ||
      (filter === "blocked" && (!r.media_ready || !r.eligible_access)),
  );
  if (!enabled)
    return (
      <section className="panel staff-service">
        <h2>Client service</h2>
        <p>
          The client-service dashboard is prepared for release review. Its
          production migration and rollout switch have not been enabled.
        </p>
      </section>
    );
  return (
    <section
      className="panel staff-service"
      aria-label="Client service dashboard"
    >
      <header className="staff-service-heading">
        <div>
          <Tag>
            PRIVATE ·{" "}
            {role === "coach"
              ? "YOUR ASSIGNED ATHLETES"
              : "REPFORMED CLIENT SERVICE"}
          </Tag>
          <h2>
            {role === "coach"
              ? "Your athletes. Their next step."
              : "Every client. A clear next step."}
          </h2>
          <p>
            {role === "coach"
              ? "Your athlete roster and assigned review tasks. Linked client details are limited."
              : "Clients, athlete assignments and service follow-up in one workspace."}
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setAttempt((n) => n + 1)}
        >
          Refresh client service
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <p role="status">Loading your client service roster…</p>
      )}
      {data && (
        <>
          <div className="staff-service-counts">
            <span>
              <strong>{new Set(data.rows.map((r) => r.client_id)).size}</strong>{" "}
              clients
            </span>
            <span>
              <strong>{data.rows.filter((r) => r.athlete_id).length}</strong>{" "}
              athletes
            </span>
            <span>
              <strong>
                {data.rows.reduce((n, r) => n + (r.overdue_reviews || 0), 0)}
              </strong>{" "}
              overdue reviews
            </span>
          </div>
          <label className="staff-service-filter">
            Show service records
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All in your scope</option>
              <option value="overdue">Overdue reviews</option>
              <option value="unassigned">No service coach</option>
              <option value="blocked">Training needs attention</option>
            </select>
          </label>
          {!rows.length ? (
            <p className="staff-service-empty">
              {data.rows.length
                ? "No records match this filter."
                : role === "coach"
                  ? "No athletes assigned to you yet. Individual clip-review tasks remain in Reviews."
                  : "No client athlete profiles yet. New client setup will appear here."}
            </p>
          ) : (
            <table className="staff-service-table">
              <thead>
                <tr>
                  <th>Client / payment</th>
                  <th>Athlete</th>
                  <th>Access / training</th>
                  <th>Release</th>
                  <th>Observed activity</th>
                  <th>Service / next action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, n) => (
                  <tr key={r.athlete_id || `${r.client_id}:${n}`}>
                    <td data-label="Client / payment">
                      <strong>{r.client_label}</strong>
                      <small>Purchase: not recorded</small>
                    </td>
                    <td data-label="Athlete">
                      <strong>
                        {r.athlete_name || "Athlete setup pending"}
                      </strong>
                      <small className="staff-mobile-client">
                        {r.client_label} · Purchase not recorded
                      </small>
                      <small>
                        {r.age_group}
                        {r.position && ` · ${r.position}`}
                      </small>
                      {r.athlete_id && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => open(r.athlete_id!)}
                        >
                          Open {r.athlete_name} service
                        </button>
                      )}
                    </td>
                    <td data-label="Access / training">
                      <strong>
                        {r.workout_id ? r.workout_title : "No saved workout"}
                      </strong>
                      <small>
                        {r.eligible_access
                          ? "Manual training access"
                          : "Access needs assignment or review"}
                      </small>
                      <small>
                        {r.media_ready
                          ? "Media received"
                          : "Upload/readiness not complete"}
                      </small>
                    </td>
                    <td data-label="Release">
                      <strong>
                        {r.eligible_access && r.media_ready
                          ? "Available now"
                          : "Needs attention"}
                      </strong>
                      <small>Scheduled release: not active</small>
                      <small>First available: not recorded</small>
                    </td>
                    <td data-label="Observed activity">
                      <small>Opened: {observed(r.last_opened_at)}</small>
                      <small>
                        Practice saved: {observed(r.last_practice_saved_at)}
                      </small>
                      <small>
                        Reported complete: {observed(r.last_completion_at)}
                      </small>
                    </td>
                    <td data-label="Service / next action">
                      <strong
                        className={r.overdue_reviews ? "service-overdue" : ""}
                      >
                        {r.next_action}
                      </strong>
                      <small>
                        Coach:{" "}
                        {role === "coach" && r.coach_id === actor
                          ? "You"
                          : r.coach_label || "Unassigned"}
                      </small>
                      <small>
                        {r.pending_reviews || 0} pending ·{" "}
                        {r.overdue_reviews || 0} overdue ·{" "}
                        {r.blocked_reviews || 0} blocked
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="member-fineprint">
            Purchases, payment periods, release scheduling, first-available
            timestamps, open events and email delivery are not recorded by this
            dashboard yet. Available training is not proof it was opened;
            reported completion is participation, not a technique assessment.
            Private video access remains separately assigned.
          </p>
        </>
      )}
      {target && (
        <Modal
          title={
            current
              ? `${current.athlete_name} · service record`
              : "Athlete service access"
          }
          onClose={() => {
            if (!busy) close();
          }}
        >
          {detailError && <p role="alert">{detailError}</p>}
          {!current && !detailError && (
            <p role="status">Loading authorized athlete details…</p>
          )}
          {current && (
            <>
              <Tag>
                {current.age_group} · {current.position}
              </Tag>
              <p>{current.client_label}</p>
              <p>
                Experience: {current.experience} · Goal: {current.goal}
              </p>
              <h3>Next action</h3>
              <p className={current.overdue_reviews ? "service-overdue" : ""}>
                {current.next_action}
              </p>
              <details>
                <summary>Purchase and access details</summary>
                <p>
                  No connected purchase/payment record. No provider reference,
                  package version, entitlement period or monthly-review usage
                  has been recorded. This does not mean the customer never paid
                  elsewhere.
                </p>
                <p>
                  Current training access:{" "}
                  {current.eligible_access
                    ? "manual eligible assignment"
                    : "inactive or awaiting content/assignment review"}
                  . Assignment updated:{" "}
                  {observed(current.assignment_updated_at)}.
                </p>
              </details>
              <h3>Assigned training</h3>
              <p>
                {current.workout_title || "No saved workout assigned"} · Version{" "}
                {current.workout_version || "not recorded"}
              </p>
              <ol>
                {current.resources.map((d) => (
                  <li key={d.id}>
                    <strong>{d.title}</strong> · v{d.version} · {d.minutes} min
                    <p>
                      {d.review_stage} ·{" "}
                      {d.upload_received
                        ? "Upload received"
                        : "Media receipt not confirmed"}{" "}
                      · Reviewer {d.reviewed_by?.slice(0, 8) || "not recorded"}{" "}
                      · {observed(d.reviewed_at)}
                    </p>
                  </li>
                ))}
              </ol>
              <h3>Service follow-up</h3>
              <details>
                <summary>Release and observed activity</summary>
                <p>
                  Scheduled release: not active. First available timestamp: not
                  recorded.
                </p>
                <p>
                  Opened: {observed(current.last_opened_at)}. Practice saved:{" "}
                  {observed(current.last_practice_saved_at)}. Reported complete:{" "}
                  {observed(current.last_completion_at)}.
                </p>
              </details>
              <p>
                {current.review_scope === "assigned_only"
                  ? "Your assigned review tasks only"
                  : "All review tasks for this athlete"}
              </p>
              {current.review_tasks.length ? (
                <ul>
                  {current.review_tasks.map((s) => (
                    <li key={s.id}>
                      {s.drill_title} · {SERVICE_LABELS[s.state]} ·{" "}
                      {s.due_at
                        ? `Target ${reviewDate(s.due_at)}`
                        : "Clock not started"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No review tasks observed in your scope.</p>
              )}
              <p>
                Email delivery: no delivery record. Activity opened:{" "}
                {observed(current.last_opened_at)}. Reported complete:{" "}
                {observed(current.last_completion_at)}.
              </p>
              {role === "owner" && (
                <div className="staff-service-coach">
                  <label>
                    Responsible service coach
                    <select
                      value={coach}
                      disabled={busy}
                      onChange={(e) => setCoach(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {data?.coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    This changes roster responsibility only. Existing
                    private-video assignments, account roles and billing stay
                    unchanged.
                  </p>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={async () => {
                      if (lock.current) return;
                      lock.current = true;
                      setBusy(true);
                      setDetailError("");
                      try {
                        await api.assign(
                          current.athlete_id!,
                          coach || null,
                          current.coach_version || 0,
                        );
                        setCurrent(await api.athlete(current.athlete_id!));
                        setAttempt((n) => n + 1);
                      } catch (e) {
                        setDetailError((e as Error).message);
                      } finally {
                        lock.current = false;
                        setBusy(false);
                      }
                    }}
                  >
                    Save service coach
                  </button>
                </div>
              )}
            </>
          )}
          <button className="button secondary" disabled={busy} onClick={close}>
            Back to client service
          </button>
        </Modal>
      )}
    </section>
  );
}
