import { StaffLink } from "./StaffLinks";
import { StaffNotificationPanel } from "./StaffNotificationPanel";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  StaffService,
  type ServiceRoster,
  type StaffAthlete,
} from "./staffService";
import { Modal, Tag } from "./components";
import { reviewDate, SERVICE_LABELS } from "./reviewServices";
import {
  serviceAction,
  serviceRows,
  serviceState,
  STATE_LABELS,
} from "./staffServiceView";
import { DeliveryMonitor } from "./DeliveryWorkspace";
import "./staffService.css";
function observed(value?: string | null) {
  return value ? reviewDate(value) : "Not observed";
}
function urlTarget() {
  const id = new URLSearchParams(location.search).get("serviceAthlete");
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : "";
}
export function StaffServiceDashboard({
  client,
  role,
  actor,
  enabled,
  monitoring = false,
  operationalEmails = false,
  preview = false,
  mode = "roster",
}: {
  client: SupabaseClient;
  role: "owner" | "manager" | "coach";
  actor: string;
  enabled: boolean;
  monitoring?: boolean;
  operationalEmails?: boolean;
  preview?: boolean;
  mode?: "roster" | "settings";
}) {
  const api = useMemo(() => new StaffService(client), [client]);
  const [data, setData] = useState<ServiceRoster | null>(null),
    [current, setCurrent] = useState<StaffAthlete | null>(null),
    [target, setTarget] = useState(urlTarget),
    [coach, setCoach] = useState(""),
    [error, setError] = useState(""),
    [detailError, setDetailError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [attempt, setAttempt] = useState(0),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [assignmentNotice, setAssignmentNotice] = useState("");
  const lock = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!target) returnFocus.current?.focus({ preventScroll: true });
  }, [target]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void api
      .roster()
      .then((v) => {
        if (active) {
          setData(v);
          setError("");
          setRefreshing(false);
        }
      })
      .catch((e) => {
        if (active) {
          setData(null);
          setError(e.message);
          setRefreshing(false);
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
  useEffect(() => {
    function back() {
      setCurrent(null);
      setDetailError("");
      setAssignmentNotice("");
      setTarget(urlTarget());
    }
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  function open(id: string) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setCurrent(null);
    setDetailError("");
    setAssignmentNotice("");
    setTarget(id);
    const u = new URL(location.href);
    u.searchParams.set("serviceAthlete", id);
    history.pushState({ repformedServiceDetail: true }, "", u);
  }
  function close() {
    if (history.state?.repformedServiceDetail) {
      history.back();
      return;
    }
    setTarget("");
    setCurrent(null);
    setDetailError("");
    setAssignmentNotice("");
    const u = new URL(location.href);
    u.searchParams.delete("serviceAthlete");
    history.replaceState(null, "", u);
  }
  const rows = serviceRows(data?.rows || [], query, filter),
    total = data?.rows.length || 0;
  const counts = {
    overdue: (data?.rows || []).filter((r) => serviceState(r) === "overdue")
      .length,
    attention: (data?.rows || []).filter((r) => serviceState(r) === "attention")
      .length,
    ready: (data?.rows || []).filter((r) => serviceState(r) === "ready").length,
  };
  function resetFilters() {
    setQuery("");
    setFilter("all");
  }
  if (!enabled)
    return (
      <section className="panel staff-service">
        <h2>Client service</h2>
        <p>
          The dashboard is prepared for release review. Its production migration
          and rollout switch are not enabled.
        </p>
      </section>
    );
  if (mode === "settings")
    return (
      <section className="staff-service" aria-label="Staff delivery settings">
        {error && <p role="alert">{error}</p>}
        {!data && !error && <p role="status">Loading delivery settings…</p>}
        {monitoring && data && (
          <DeliveryMonitor
            key={`${actor}:${role}`}
            client={client}
            actor={actor}
            role={role}
            profiles={data.rows}
          />
        )}{" "}
        {operationalEmails && (
          <details className="workflow-secondary">
            <summary>Staff email status</summary>
            <StaffNotificationPanel
              key={`staff-email:${actor}:${role}`}
              client={client}
              actor={actor}
            />
          </details>
        )}
        {!monitoring && !operationalEmails && (
          <p>Delivery monitoring is not enabled for this connection.</p>
        )}
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
            {role === "coach" ? "YOUR ASSIGNED ATHLETES" : "CLIENT SERVICE"}
          </Tag>
          <h2>Athlete roster</h2>
          <p>
            {data
              ? `${data.rows.filter((r) => r.athlete_id).length} athletes · ${new Set(data.rows.map((r) => r.client_id)).size} clients`
              : "Loading your scope"}
            {role === "coach" ? " · assigned to you" : " · all clients"}
          </p>
        </div>
        <button
          className="button secondary staff-refresh"
          aria-label="Refresh client service"
          disabled={busy || refreshing}
          onClick={() => {
            setRefreshing(true);
            setAttempt((n) => n + 1);
          }}
        >
          <RefreshCw size={16} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <p role="status">Loading your client service roster…</p>
      )}
      {data && (
        <>
          <div
            className="staff-service-counts"
            aria-label="Service status filters"
          >
            {(
              [
                ["all", "All records", total],
                ["overdue", "Overdue", counts.overdue],
                ["blocked", "Needs attention", counts.attention],
                ["ready", "Ready to train", counts.ready],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                className={`staff-count ${value}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                <strong>{count}</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="staff-service-tools">
            <label className="staff-search">
              Search athletes or clients
              <span>
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Name, client, coach or position"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </span>
            </label>
            <label className="staff-service-filter">
              Show service records
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All records</option>
                <option value="overdue">Overdue reviews</option>
                <option value="blocked">Needs attention</option>
                <option value="ready">Ready to train</option>
                <option value="unassigned">No service coach</option>
              </select>
            </label>
            {(query || filter !== "all") && (
              <button
                className="text-button staff-clear"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            )}
          </div>
          <p className="staff-result-count" role="status">
            Showing {rows.length} of {total} records
            {query.trim() ? ` for “${query.trim()}”` : ""}
          </p>
          {!rows.length ? (
            <div className="staff-service-empty">
              {data.rows.length ? (
                <>
                  <h3>No matching athletes.</h3>
                  <p>Try another name or reset your search and filters.</p>
                  <button className="button secondary" onClick={resetFilters}>
                    Reset search and filters
                  </button>
                </>
              ) : (
                <p>
                  {role === "coach"
                    ? "No athletes assigned to you yet. Individual clip-review tasks remain in Reviews."
                    : "No client athlete profiles yet. New client setup will appear here."}
                </p>
              )}
            </div>
          ) : (
            <table className="staff-service-table">
              <caption className="staff-sr-only">
                Athlete roster, ordered by service priority
              </caption>
              <thead>
                <tr>
                  <th>Athlete</th>
                  <th>Training</th>
                  <th>Service coach</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, n) => {
                  const state = serviceState(r),
                    action = serviceAction(r, role);
                  return (
                    <tr key={r.athlete_id || `${r.client_id}:${n}`}>
                      <td className="staff-athlete-cell">
                        <div className="staff-identity">
                          <span className="staff-avatar" aria-hidden="true">
                            {(r.athlete_name || "?")
                              .replace("Fictional ", "")
                              .slice(0, 1)}
                          </span>
                          <div>
                            <strong>
                              {r.athlete_name || "Athlete setup pending"}
                            </strong>
                            <small>
                              {r.age_group}
                              {r.position && ` · ${r.position}`}
                            </small>
                          </div>
                        </div>
                        <small className="staff-client-label">
                          {r.client_label}
                        </small>
                        <span className={`staff-state ${state}`}>
                          {state === "ready" ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <AlertCircle size={13} />
                          )}{" "}
                          {STATE_LABELS[state]}
                        </span>
                      </td>
                      <td data-label="Training">
                        <strong>
                          {r.workout_id
                            ? r.workout_title
                            : "No training assigned"}
                        </strong>
                        <small>
                          {!r.workout_id
                            ? "A saved plan is needed"
                            : !r.eligible_access
                              ? "Access or content needs review"
                              : !r.media_ready
                                ? "Upload incomplete"
                                : "Approved training available"}
                        </small>
                        {r.last_completion_at && (
                          <small>
                            Practice reported {observed(r.last_completion_at)}
                          </small>
                        )}
                      </td>
                      <td data-label="Service coach">
                        <strong>
                          {role === "coach" && r.coach_id === actor
                            ? "You"
                            : r.coach_label || "Unassigned"}
                        </strong>
                        <small>
                          {r.overdue_reviews
                            ? `${r.overdue_reviews} review overdue`
                            : r.pending_reviews
                              ? `${r.pending_reviews} review${r.pending_reviews === 1 ? "" : "s"} pending`
                              : "No pending reviews"}
                        </small>
                      </td>
                      <td className="staff-action-cell">
                        {r.athlete_id ? (
                          <button
                            className={`button ${state === "overdue" ? "" : "secondary"} staff-primary-action`}
                            aria-label={`${action} for ${r.athlete_name}`}
                            onClick={() => open(r.athlete_id!)}
                          >
                            {action}
                            <ArrowRight size={16} />
                          </button>
                        ) : (
                          <span>Awaiting private profile setup</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!preview && (
            <details className="staff-tracking-details">
              <summary>About these service records</summary>
              <p>
                Training availability is not proof it was opened. Reports record
                participation, not technique assessment. Purchases, payment
                periods, scheduled release, first-available history, open events
                and email delivery are not tracked here. Private video access
                stays separately assigned.
              </p>
            </details>
          )}
        </>
      )}
      {(monitoring || operationalEmails) && (
        <div className="staff-secondary-work">
          <a href="#staff-delivery" className="text-button">
            Delivery checks & settings <ArrowRight size={16} />
          </a>
        </div>
      )}
      {target && (
        <Modal
          title={
            current
              ? current.athlete_name || "Athlete service record"
              : "Athlete service access"
          }
          onClose={() => {
            if (!busy) close();
          }}
        >
          <div className="staff-detail">
            {detailError && <p role="alert">{detailError}</p>}
            {!current && !detailError && (
              <p role="status">Loading authorized athlete details…</p>
            )}
            {current && (
              <>
                <div className="staff-detail-meta">
                  <span className={`staff-state ${serviceState(current)}`}>
                    {STATE_LABELS[serviceState(current)]}
                  </span>
                  <span>
                    {current.age_group} · {current.position}
                  </span>
                </div>
                <p className="staff-detail-client">{current.client_label}</p>
                <section
                  className="staff-next-step"
                  aria-label="Next service action"
                >
                  <span className="tag">NEXT STEP</span>
                  <h3>{current.next_action}</h3>
                  <div className="actions">
                    {role === "owner" && current.athlete_id && (
                      <StaffLink
                        route="training-assign"
                        values={{
                          trainingAccount: current.client_id,
                          trainingAthlete: current.athlete_id,
                          trainingWorkout: "",
                        }}
                        className="button"
                      >
                        Assign workout <ArrowRight size={16} />
                      </StaffLink>
                    )}
                    {(current.pending_reviews || 0) > 0 && (
                      <a href="#video-reviews" className="button secondary">
                        Open review queue
                      </a>
                    )}
                  </div>
                  {preview && (
                    <p>
                      {!current.coach_id && role !== "coach"
                        ? "Choose a sample service coach below. This changes fictional data in this browser only."
                        : "Review the sample status below. Real uploads, coaching feedback and training assignment are not connected in this preview."}
                    </p>
                  )}
                </section>
                {role !== "coach" ? (
                  <details
                    className="staff-detail-group"
                    open={!current.coach_id}
                  >
                    <summary>
                      Service coach{" "}
                      <span>{current.coach_label || "Unassigned"}</span>
                    </summary>
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
                        {preview
                          ? "Sample roster responsibility only. Private-review assignments remain separate."
                          : "Roster responsibility only. Private-review assignments, roles and billing are unchanged."}
                      </p>
                      <button
                        className="button"
                        disabled={busy || coach === (current.coach_id || "")}
                        onClick={async () => {
                          if (lock.current) return;
                          lock.current = true;
                          setBusy(true);
                          setDetailError("");
                          setAssignmentNotice("");
                          try {
                            await api.assign(
                              current.athlete_id!,
                              coach || null,
                              current.coach_version || 0,
                            );
                            setCurrent(await api.athlete(current.athlete_id!));
                            setAttempt((n) => n + 1);
                            setAssignmentNotice(
                              preview
                                ? "Sample service coach updated in this browser only."
                                : "Service coach assignment saved.",
                            );
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
                      {assignmentNotice && (
                        <p role="status">{assignmentNotice}</p>
                      )}
                    </div>
                  </details>
                ) : (
                  <p className="staff-detail-owner-note">
                    Service coach: {current.coach_label || "Unassigned"}. An
                    Owner or Manager manages roster responsibility.
                  </p>
                )}
                <details
                  open={!!current.pending_reviews}
                  className="staff-detail-group"
                >
                  <summary>
                    Review tasks{" "}
                    <span>{current.pending_reviews || 0} pending</span>
                  </summary>
                  <p>
                    {current.review_scope === "assigned_only"
                      ? "Your assigned review tasks only"
                      : "Review tasks for this athlete"}
                  </p>
                  {current.review_tasks.length ? (
                    <ul className="staff-review-list">
                      {current.review_tasks.map((s) => (
                        <li key={s.id}>
                          <strong>{s.drill_title}</strong>
                          <span>
                            {SERVICE_LABELS[s.state]} ·{" "}
                            {s.due_at
                              ? `Target ${reviewDate(s.due_at)}`
                              : "Clock not started"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No review tasks observed in your scope.</p>
                  )}
                  {!preview && (
                    <a className="text-button" href="#video-reviews">
                      Open service desk & reviews <ArrowRight size={16} />
                    </a>
                  )}
                </details>
                <details
                  className="staff-detail-group"
                  open={
                    !current.workout_id ||
                    !current.eligible_access ||
                    !current.media_ready
                  }
                >
                  <summary>
                    Training plan <span>{current.resources.length} drills</span>
                  </summary>
                  <p>
                    <strong>
                      {current.workout_title || "No saved workout assigned"}
                    </strong>
                  </p>
                  <p>
                    Version {current.workout_version || "not recorded"} ·{" "}
                    {current.eligible_access && current.media_ready
                      ? "Available now"
                      : "Needs assignment, review or upload"}
                  </p>
                  <ol>
                    {current.resources.map((d) => (
                      <li key={d.id}>
                        <strong>{d.title}</strong> · {d.minutes} min
                        <small>
                          v{d.version} · {d.review_stage} ·{" "}
                          {d.upload_received
                            ? "Upload received"
                            : "Media receipt not confirmed"}
                        </small>
                      </li>
                    ))}
                  </ol>
                  <p>
                    Experience: {current.experience} · Goal: {current.goal}
                  </p>
                </details>
                <details className="staff-detail-group">
                  <summary>Practice & release details</summary>
                  <p>Activity opened: {observed(current.last_opened_at)}.</p>
                  <p>
                    Practice saved: {observed(current.last_practice_saved_at)}.
                  </p>
                  <p>
                    Reported complete: {observed(current.last_completion_at)}.
                  </p>
                  <p>
                    Scheduled release: not active. First available timestamp:
                    not recorded. Completion is reported participation, not a
                    technique assessment.
                  </p>
                </details>
                <details className="staff-detail-group">
                  <summary>Purchase and access details</summary>
                  <p>
                    No connected purchase/payment record. Package entitlements
                    and email delivery are not tracked here.
                  </p>
                  <p>
                    Training access:{" "}
                    {current.eligible_access
                      ? "manual eligible assignment"
                      : "needs assignment or content review"}
                    . Assignment updated{" "}
                    {observed(current.assignment_updated_at)}.
                  </p>
                </details>
              </>
            )}
            <div className="staff-detail-footer">
              <button
                className="button secondary"
                disabled={busy}
                onClick={close}
              >
                Back to client service
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
