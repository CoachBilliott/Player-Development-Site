import { LearningAthlete } from "./learning/LearningAthlete";
import { LearningApi } from "./learning/api";
import { learningDate } from "./learning/schedule";
import { StaffLink } from "./StaffLinks";
import { AthleteTrainingAssignment } from "./AthleteTrainingAssignment";
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
  type RosterCursor,
} from "./staffService";
import { Modal, Tag } from "./components";
import { reviewDate, SERVICE_LABELS } from "./reviewServices";
import {
  serviceAction,
  serviceRows,
  serviceState,
  serviceLabel,
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
  learningEnabled = false,
  preview = false,
  mode = "roster",
}: {
  client: SupabaseClient;
  role: "owner" | "manager" | "coach";
  actor: string;
  enabled: boolean;
  monitoring?: boolean;
  operationalEmails?: boolean;
  learningEnabled?: boolean;
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
  const [assigning, setAssigning] = useState(false),
    [assignmentBusy, setAssignmentBusy] = useState(false);
  const learning = useMemo(
    () => new LearningApi(client, setAssignmentBusy),
    [client],
  );
  const [ageFilter, setAgeFilter] = useState(""),
    [positionFilter, setPositionFilter] = useState(""),
    [coachFilter, setCoachFilter] = useState("");
  const [cursor, setCursor] = useState<RosterCursor | null>(null),
    [previousCursors, setPreviousCursors] = useState<(RosterCursor | null)[]>(
      [],
    );
  const [requestFilters, setRequestFilters] = useState({
    query: "",
    filter: "all",
    age: "",
    position: "",
    coach: "",
  });
  const [learningTask, setLearningTask] = useState<
    { kind: "plan" | "grading"; request: number } | undefined
  >();
  const weeklyPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setRequestFilters({
          query,
          filter,
          age: ageFilter,
          position: positionFilter,
          coach: coachFilter,
        }),
      250,
    );
    return () => clearTimeout(timer);
  }, [query, filter, ageFilter, positionFilter, coachFilter]);
  function changeFilter(change: () => void) {
    change();
    if (learningEnabled) {
      setCursor(null);
      setPreviousCursors([]);
      setRefreshing(true);
    }
  }
  const activeFilters = learningEnabled ? requestFilters : null;
  const searchPending =
    learningEnabled &&
    (query !== requestFilters.query ||
      filter !== requestFilters.filter ||
      ageFilter !== requestFilters.age ||
      positionFilter !== requestFilters.position ||
      coachFilter !== requestFilters.coach);
  function reloadLearning() {
    setCursor(null);
    setPreviousCursors([]);
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }
  const assignButton = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!target) returnFocus.current?.focus({ preventScroll: true });
  }, [target]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const request = learningEnabled
      ? api.page(activeFilters!, cursor)
      : api.roster();
    void request
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
  }, [
    api,
    enabled,
    attempt,
    actor,
    role,
    learningEnabled,
    activeFilters,
    cursor,
  ]);
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
      setAssigning(false);
      setCurrent(null);
      setDetailError("");
      setAssignmentNotice("");
      setTarget(urlTarget());
    }
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  function open(id: string) {
    setLearningTask(undefined);
    setAssigning(false);
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
    setLearningTask(undefined);
    setAssigning(false);
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
  const scopedRows = (data?.rows || []).filter(
    (r) =>
      (!ageFilter || r.age_group === ageFilter) &&
      (!positionFilter || r.position === positionFilter) &&
      (!coachFilter ||
        (coachFilter === "none" ? !r.coach_id : r.coach_id === coachFilter)),
  );
  const rows = learningEnabled
      ? data?.rows || []
      : serviceRows(scopedRows, query, filter),
    total = data?.page?.total ?? data?.rows.length ?? 0;
  const coachChoices = learningEnabled
    ? (data?.coaches || []).map((c) => [c.id, c.label] as const)
    : [
        ...new Map(
          (data?.rows || []).flatMap((r) =>
            r.coach_id
              ? [[r.coach_id, r.coach_label || "Assigned coach"] as const]
              : [],
          ),
        ).entries(),
      ];
  const counts = data?.page?.counts || {
    overdue: (data?.rows || []).filter((r) => serviceState(r) === "overdue")
      .length,
    attention: (data?.rows || []).filter((r) => serviceState(r) === "attention")
      .length,
    ready: (data?.rows || []).filter((r) => serviceState(r) === "ready").length,
  };
  function resetFilters() {
    if (learningEnabled) {
      setCursor(null);
      setPreviousCursors([]);
      setRefreshing(true);
    }
    setQuery("");
    setFilter("all");
    setAgeFilter("");
    setPositionFilter("");
    setCoachFilter("");
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
              ? `${data.page?.athletes ?? data.rows.filter((r) => r.athlete_id).length} athletes · ${data.page?.clients ?? new Set(data.rows.map((r) => r.client_id)).size} clients`
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
                onClick={() => changeFilter(() => setFilter(value))}
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
                  onChange={(e) => changeFilter(() => setQuery(e.target.value))}
                />
              </span>
            </label>
            <label className="staff-service-filter">
              Show service records
              <select
                value={filter}
                onChange={(e) => changeFilter(() => setFilter(e.target.value))}
              >
                <option value="all">All records</option>
                <option value="overdue">Overdue reviews</option>
                <option value="blocked">Needs attention</option>
                <option value="ready">Ready to train</option>
                <option value="unassigned">No service coach</option>
              </select>
            </label>
            {(query ||
              filter !== "all" ||
              ageFilter ||
              positionFilter ||
              coachFilter) && (
              <button
                className="text-button staff-clear"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            )}
          </div>
          <details className="staff-more-filters">
            <summary>Filter by age, position or coach</summary>
            <div className="staff-service-tools">
              <label>
                Age group
                <select
                  aria-label="Age group"
                  value={ageFilter}
                  onChange={(e) =>
                    changeFilter(() => setAgeFilter(e.target.value))
                  }
                >
                  <option value="">All age groups</option>
                  {(
                    data.page?.ages.slice() || [
                      ...new Set(
                        data.rows
                          .map((r) => r.age_group)
                          .filter((x): x is string => !!x),
                      ),
                    ]
                  )
                    .sort()
                    .map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                </select>
              </label>
              <label>
                Football position
                <select
                  aria-label="Football position"
                  value={positionFilter}
                  onChange={(e) =>
                    changeFilter(() => setPositionFilter(e.target.value))
                  }
                >
                  <option value="">All positions</option>
                  {(
                    data.page?.positions.slice() || [
                      ...new Set(
                        data.rows
                          .map((r) => r.position)
                          .filter((x): x is string => !!x),
                      ),
                    ]
                  )
                    .sort()
                    .map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                </select>
              </label>
              <label>
                Responsible coach
                <select
                  aria-label="Responsible coach"
                  value={coachFilter}
                  onChange={(e) =>
                    changeFilter(() => setCoachFilter(e.target.value))
                  }
                >
                  <option value="">All in your scope</option>
                  <option value="none">No coach assigned</option>
                  {coachChoices.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <p className="staff-result-count" role="status">
            {searchPending || refreshing ? (
              "Updating roster…"
            ) : (
              <>
                Showing {rows.length} of {data.page?.matched ?? total} records
                {learningEnabled && ` · page ${previousCursors.length + 1}`}
              </>
            )}
            {query.trim() ? ` for “${query.trim()}”` : ""}
          </p>
          {!rows.length ? (
            <div className="staff-service-empty">
              {(data.page ? data.page.clients > 0 : data.rows.length > 0) ? (
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
                          {serviceLabel(r)}
                        </span>
                      </td>
                      <td data-label="Training">
                        {r.learning ? (
                          <>
                            <strong>
                              {r.learning.title || "No weekly plan"}
                            </strong>
                            <small>
                              {r.learning.current_title
                                ? `Week ${r.learning.current_week}: ${r.learning.current_title}`
                                : "No week released yet"}
                            </small>
                            {r.learning.next_release_at && (
                              <small>
                                Next: {learningDate(r.learning.next_release_at)}{" "}
                                Central
                              </small>
                            )}
                            <small>
                              {r.learning.enrollment_state === "finished"
                                ? "All planned weeks released"
                                : `${r.learning.ready_weeks} approved next weeks ready`}
                            </small>
                            {r.learning.last_reported_at && (
                              <small>
                                Work reported{" "}
                                {observed(r.learning.last_reported_at)}
                              </small>
                            )}
                          </>
                        ) : (
                          <>
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
                                Practice reported{" "}
                                {observed(r.last_completion_at)}
                              </small>
                            )}
                          </>
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
                            disabled={refreshing || searchPending}
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
          {learningEnabled && data.page && (
            <nav
              className="staff-roster-pages"
              aria-label="Athlete roster pages"
            >
              <button
                className="button secondary"
                disabled={
                  !previousCursors.length || refreshing || searchPending
                }
                onClick={() => {
                  const previous = previousCursors.at(-1) || null;
                  setPreviousCursors((c) => c.slice(0, -1));
                  setCursor(previous);
                  setRefreshing(true);
                }}
              >
                Previous page
              </button>
              <span>Page {previousCursors.length + 1}</span>
              <button
                className="button secondary"
                disabled={!data.page.next_cursor || refreshing || searchPending}
                onClick={() => {
                  setPreviousCursors((c) => [...c, cursor]);
                  setCursor(data.page!.next_cursor);
                  setRefreshing(true);
                }}
              >
                Next page
              </button>
            </nav>
          )}
          {!preview && (
            <details className="staff-tracking-details">
              <summary>About these service records</summary>
              <p>
                {learningEnabled
                  ? "Weekly status comes from enrollment, approved releases, submissions and grades. Availability is not proof it was opened; completion is reported participation, not technique assessment. Package eligibility is manually verified, not proof of payment. Private video review access remains separate."
                  : "Training availability is not proof it was opened. Reports record participation, not technique assessment. Purchases, payment periods, scheduled release, first-available history, open events and email delivery are not tracked here. Private video access stays separately assigned."}
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
            if (!busy && !assignmentBusy) close();
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
                    {serviceLabel(current)}
                  </span>
                  <span>
                    {current.age_group} · {current.position}
                  </span>
                </div>
                <p className="staff-detail-client">{current.client_label}</p>
                <p className="staff-detail-plan">
                  Current training:{" "}
                  <strong>
                    {current.learning
                      ? current.learning.title || "No weekly plan"
                      : current.workout_title || "No workout assigned"}
                  </strong>
                </p>
                <section
                  className="staff-next-step"
                  aria-label="Next service action"
                >
                  <span className="tag">NEXT STEP</span>
                  <h3>{current.next_action}</h3>
                  <div className="actions">
                    {learningEnabled && (
                      <button
                        className="button"
                        onClick={() => {
                          setLearningTask({
                            kind: current.learning?.pending_grades
                              ? "grading"
                              : "plan",
                            request: Date.now(),
                          });
                          weeklyPanel.current
                            ?.querySelector<HTMLElement>("h2")
                            ?.focus();
                          weeklyPanel.current?.scrollIntoView({
                            block: "start",
                            behavior: "smooth",
                          });
                        }}
                      >
                        {current.learning?.pending_grades
                          ? "Open quiz grades"
                          : "Open plan controls"}
                      </button>
                    )}
                    {!learningEnabled &&
                      role === "owner" &&
                      current.athlete_id && (
                        <button
                          ref={assignButton}
                          className="button"
                          disabled={assignmentBusy}
                          onClick={() => setAssigning(true)}
                        >
                          Assign training <ArrowRight size={16} />
                        </button>
                      )}
                    {(current.pending_reviews || 0) > 0 && (
                      <StaffLink
                        route="video-reviews"
                        className="button secondary"
                      >
                        Open review queue
                      </StaffLink>
                    )}
                  </div>
                  {preview && (
                    <p>
                      {!current.coach_id && role !== "coach"
                        ? "Choose a sample service coach below. This changes fictional data in this browser only."
                        : learningEnabled
                          ? "Weekly changes affect fictional records in this browser only. No real uploads or messages are sent."
                          : "Review the sample status below. Real uploads, coaching feedback and training assignment are not connected in this preview."}
                    </p>
                  )}
                </section>
                {learningEnabled && current.athlete_id && (
                  <div ref={weeklyPanel}>
                    <LearningAthlete
                      key={current.athlete_id + ":learning"}
                      api={learning}
                      profile={current.athlete_id}
                      actor={actor}
                      staff
                      owner={role === "owner"}
                      onChanged={reloadLearning}
                      task={learningTask}
                    />
                  </div>
                )}
                {assignmentNotice && <p role="status">{assignmentNotice}</p>}
                {learningEnabled && !preview && role === "owner" && (
                  <details className="staff-detail-group">
                    <summary>
                      Advanced: legacy single-workout assignment
                    </summary>
                    <p>
                      This separate control changes the older single workout
                      only. It does not replace weekly enrollment, released
                      weeks or grades.
                    </p>
                    <button
                      ref={assignButton}
                      className="button secondary"
                      onClick={() => setAssigning(true)}
                      disabled={assignmentBusy}
                    >
                      Open legacy assignment
                    </button>
                  </details>
                )}
                {assigning && current.athlete_id && role === "owner" && (
                  <AthleteTrainingAssignment
                    key={current.athlete_id}
                    client={client}
                    athlete={current}
                    onBusyChange={setAssignmentBusy}
                    onClose={() => {
                      if (!assignmentBusy) {
                        setAssigning(false);
                        requestAnimationFrame(() =>
                          assignButton.current?.focus(),
                        );
                      }
                    }}
                    onSaved={() => {
                      setAssigning(false);
                      setAssignmentNotice(
                        "Workout assignment saved for this athlete. Sibling plans are unchanged.",
                      );
                      setAttempt((n) => n + 1);
                      requestAnimationFrame(() =>
                        assignButton.current?.focus(),
                      );
                    }}
                  />
                )}
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
                          disabled={busy || assignmentBusy}
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
                    <StaffLink route="video-reviews">
                      Open service desk & reviews <ArrowRight size={16} />
                    </StaffLink>
                  )}
                </details>
                <details
                  className="staff-detail-group"
                  open={
                    !learningEnabled &&
                    (!current.workout_id ||
                      !current.eligible_access ||
                      !current.media_ready)
                  }
                >
                  <summary>
                    {learningEnabled
                      ? "Legacy single workout"
                      : "Training plan"}{" "}
                    <span>{current.resources.length} drills</span>
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
                    {current.learning
                      ? `Times in Central: weekly scheduled: ${learningDate(current.learning.scheduled_at)}. Actually available: ${learningDate(current.learning.available_at)}. Most recent work reported: ${learningDate(current.learning.last_reported_at)}. Participation is not a technique assessment.`
                      : "Scheduled release: not active. First available timestamp: not recorded. Completion is reported participation, not a technique assessment."}
                  </p>
                </details>
                <details className="staff-detail-group">
                  <summary>Purchase and access details</summary>
                  <p>
                    {learningEnabled
                      ? "No connected purchase/payment record. Weekly eligibility is manually verified with a time window in plan controls; it is not a purchase receipt. Email delivery remains separate."
                      : "No connected purchase/payment record. Package entitlements and email delivery are not tracked here."}
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
                disabled={busy || assignmentBusy}
                onClick={close}
              >
                Back to athletes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
