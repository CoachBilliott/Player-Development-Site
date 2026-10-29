import { WeeklyNotificationSettings } from "./learning/WeeklyNotificationSettings";
import { WeeklyNotificationService } from "./learning/notificationRules";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DeliveryService,
  type DeliveryWorkspace,
  type DeliveryQueue,
  type ContentNotice,
} from "./delivery";
import {
  draftDeliveryRule,
  localDeliveryInstant,
  type DeliveryRule,
} from "./deliveryRules";
import type { StaffAthlete } from "./staffService";
import "./delivery.css";
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function stamp(v: string | null, zone?: string) {
  return v
    ? new Date(v).toLocaleString(
        undefined,
        zone ? { timeZone: zone } : undefined,
      )
    : "Not observed";
}
function RuleFields({
  value,
  base,
  onChange,
  partial = false,
}: {
  value: Partial<DeliveryRule>;
  base: DeliveryRule;
  onChange: (v: Partial<DeliveryRule>) => void;
  partial?: boolean;
}) {
  const merged = { ...base, ...value };
  const field = (
    key: keyof DeliveryRule,
    label: string,
    control: React.ReactNode,
  ) => (
    <div className="delivery-field" key={key}>
      {partial && (
        <label className="delivery-check">
          <input
            type="checkbox"
            checked={key in value}
            onChange={(e) => {
              const next = { ...value };
              if (e.target.checked) Object.assign(next, { [key]: merged[key] });
              else delete next[key];
              onChange(next);
            }}
          />
          Override {label.toLowerCase()}
        </label>
      )}
      <label>
        {label}
        {control}
      </label>
    </div>
  );
  const disabled = (key: keyof DeliveryRule) => partial && !(key in value);
  const set = (key: keyof DeliveryRule, v: unknown) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="delivery-rule-grid">
      {field(
        "weekday",
        "Due day",
        <select
          disabled={disabled("weekday")}
          value={merged.weekday}
          onChange={(e) => set("weekday", +e.target.value)}
        >
          {days.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>,
      )}
      {field(
        "time",
        "Local due time",
        <input
          disabled={disabled("time")}
          type="time"
          required
          value={merged.time}
          onChange={(e) => set("time", e.target.value)}
        />,
      )}
      {field(
        "timezone",
        "Time zone",
        <input
          disabled={disabled("timezone")}
          required
          placeholder="America/Chicago"
          value={merged.timezone}
          onChange={(e) => set("timezone", e.target.value)}
        />,
      )}
      {field(
        "grace_minutes",
        "Grace minutes",
        <input
          disabled={disabled("grace_minutes")}
          type="number"
          min={0}
          max={10080}
          required
          value={merged.grace_minutes}
          onChange={(e) => set("grace_minutes", +e.target.value)}
        />,
      )}
      {field(
        "escalation_minutes",
        "Escalate after grace (minutes; 0 = off)",
        <input
          disabled={disabled("escalation_minutes")}
          type="number"
          min={0}
          max={10080}
          required
          value={merged.escalation_minutes}
          onChange={(e) => set("escalation_minutes", +e.target.value)}
        />,
      )}
      {field(
        "routing",
        "Staff alert routing",
        <select
          disabled={disabled("routing")}
          value={merged.routing}
          onChange={(e) => set("routing", e.target.value)}
        >
          <option value="assigned_coach">
            Assigned service coach; staff fallback
          </option>
          <option value="owners_managers">Owners and Managers only</option>
        </select>,
      )}
      {(
        [
          ["notify_training", "Training-ready in-app notice"],
          ["notify_reviews", "Review-ready in-app notice"],
        ] as const
      ).map(([key, label]) =>
        field(
          key,
          label,
          <select
            disabled={disabled(key)}
            value={String(merged[key])}
            onChange={(e) => set(key, e.target.value === "true")}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>,
        ),
      )}
    </div>
  );
}
export function DeliveryMonitor({
  client,
  actor,
  role,
  profiles,
  weeklyEnabled = false,
}: {
  client: SupabaseClient;
  actor: string;
  role: "owner" | "manager" | "coach";
  profiles: StaffAthlete[];
  weeklyEnabled?: boolean;
}) {
  const api = useMemo(() => new DeliveryService(client), [client]);
  const weeklyApi = useMemo(
    () => new WeeklyNotificationService(client),
    [client],
  );
  const [profile, setProfile] = useState(
      profiles.find((p) => p.athlete_id)?.athlete_id || "",
    ),
    [loaded, setLoaded] = useState<{
      key: string;
      value: DeliveryWorkspace | null;
    }>({ key: "", value: null }),
    [queue, setQueue] = useState<DeliveryQueue>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [pkg, setPkg] = useState(""),
    [title, setTitle] = useState(""),
    [rule, setRule] = useState<Partial<DeliveryRule>>(draftDeliveryRule),
    [clientPkg, setClientPkg] = useState(""),
    [clientPatch, setClientPatch] = useState<Partial<DeliveryRule>>({}),
    [athletePatch, setAthletePatch] = useState<Partial<DeliveryRule>>({}),
    [clientState, setClientState] = useState("active"),
    [athleteState, setAthleteState] = useState("active"),
    [date, setDate] = useState(""),
    [cycle, setCycle] = useState("");
  const newPackage = useRef({ id: crypto.randomUUID() }),
    lock = useRef(false),
    draftPlan = useRef<{ key: string; id: string } | null>(null);
  const loadKey = `${actor}:${role}:${profile}`;
  const data = loaded.key === loadKey ? loaded.value : null;
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.queue(),
      profile ? api.workspace(profile) : Promise.resolve(null),
    ])
      .then(([q, d]) => {
        if (!active) return;
        setQueue(q);
        setLoaded({ key: loadKey, value: d });
        setError("");
        setClientPkg(d?.client?.package_id || "");
        setClientPatch(d?.client?.overrides || {});
        setAthletePatch(d?.athlete?.overrides || {});
        setClientState(d?.client?.state || "active");
        setAthleteState(d?.athlete?.state || "active");
        setPkg(d?.client?.package_id || "");
        const p = d?.packages.find((p) => p.id === d.client?.package_id);
        setTitle(p?.title || "");
        setRule(p?.rule || draftDeliveryRule);
      })
      .catch((e) => {
        if (active) {
          setLoaded({ key: loadKey, value: null });
          setQueue([]);
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [api, profile, attempt, actor, role, loadKey]);
  async function act(fn: () => Promise<void>, success: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
      setAttempt((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const athlete = profiles.find((p) => p.athlete_id === profile),
    selected = data?.packages.find((p) => p.id === pkg),
    base =
      data?.packages.find((p) => p.id === clientPkg)?.rule || draftDeliveryRule;
  return (
    <section
      className="panel delivery-workspace"
      aria-label="Delivery monitoring"
    >
      <h2>Delivery & notifications</h2>
      <p>
        <strong>Manual checks only.</strong> This queue does not run a
        scheduler, send client emails or activate device push. Overdue delivery
        alerts stay with staff; operational staff email attempts are tracked
        separately.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <h3>Staff overdue queue</h3>
      {queue.length ? (
        <ul className="delivery-list">
          {queue.map((q) => (
            <li key={q.id}>
              <strong>
                {q.athlete_name} · {q.cycle_key}
              </strong>
              <p>
                Due {stamp(q.due_at, q.timezone)} · {q.timezone} · {q.state}
                {q.escalated_at ? " · escalated to Owners/Managers" : ""}
              </p>
              <p>
                Last manual check: {stamp(q.last_checked_at)}.{" "}
                {q.available_now
                  ? "Accessible now; recheck to resolve."
                  : "Expected training was not accessible at the last check."}
              </p>
              <button
                className="button secondary"
                onClick={() => setProfile(q.profile_id)}
              >
                View delivery rule
              </button>
              {q.state === "open" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => api.acknowledge(q.id),
                      "Staff alert acknowledged. No external notification sent.",
                    )
                  }
                >
                  Acknowledge alert
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No unresolved delivery alerts in your scope. This is not proof all
          clients have received training; checks must be configured and run.
        </p>
      )}
      <label>
        Athlete delivery settings
        <select
          disabled={busy}
          value={profile}
          onChange={(e) => {
            setProfile(e.target.value);
            setMessage("");
          }}
        >
          <option value="">Choose an athlete</option>
          {profiles
            .filter((p) => p.athlete_id)
            .map((p) => (
              <option key={p.athlete_id} value={p.athlete_id!}>
                {p.athlete_name}
              </option>
            ))}
        </select>
      </label>
      {data && (
        <>
          <p>
            {weeklyEnabled && "Manual delivery-check deadline: "}
            {data.effective_rule
              ? `${days[data.effective_rule.weekday]} at ${data.effective_rule.time} · ${data.effective_rule.timezone} · ${data.effective_rule.grace_minutes} minutes grace`
              : "No package delivery default linked yet."}
          </p>
          <button
            className="button"
            disabled={busy || !data.enabled}
            onClick={() =>
              void act(
                () => api.evaluate(profile),
                "Manual check finished. In-app records updated where eligible; email remains disabled.",
              )
            }
          >
            Check this athlete now
          </button>
          {!data.enabled && (
            <p>Monitoring activation is disabled in the backend.</p>
          )}
          <p>
            Package default → client override → athlete override. Existing
            checks retain their rule snapshot; edits affect new checks.
            Pauses/cancellations take effect on existing checks too.
          </p>
          {role === "owner" && weeklyEnabled && profile && (
            <WeeklyNotificationSettings
              key={`${actor}:${profile}`}
              api={weeklyApi}
              profile={profile}
              athleteName={athlete?.athlete_name || "Selected athlete"}
              onBusyChange={(value) => {
                lock.current = value;
                setBusy(value);
              }}
            />
          )}
          {role === "owner" && (
            <>
              <details>
                <summary>Package delivery defaults</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const id = pkg || newPackage.current.id;
                    void act(
                      () =>
                        api.savePackage(
                          id,
                          title,
                          rule,
                          selected?.version || 0,
                        ),
                      "Package delivery defaults saved. No price or paid access was created.",
                    );
                  }}
                >
                  <label>
                    Package draft
                    <select
                      value={pkg}
                      onChange={(e) => {
                        setPkg(e.target.value);
                        const p = data.packages.find(
                          (p) => p.id === e.target.value,
                        );
                        setTitle(p?.title || "");
                        setRule(p?.rule || draftDeliveryRule);
                      }}
                    >
                      <option value="">Create a draft package rule</option>
                      {data.packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} · v{p.version}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Draft package name
                    <input
                      required
                      maxLength={80}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <RuleFields
                    value={rule}
                    base={draftDeliveryRule}
                    onChange={setRule}
                  />
                  <button className="button" disabled={busy}>
                    Save package defaults
                  </button>
                </form>
              </details>
              <details>
                <summary>Client overrides · applies to family siblings</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(
                      () =>
                        api.saveOverride(
                          profile,
                          "client",
                          clientPkg,
                          clientPatch,
                          clientState,
                          data.client?.version || 0,
                        ),
                      "Client settings saved. Paid access and content release are unchanged.",
                    );
                  }}
                >
                  <label>
                    Client package rule
                    <select
                      required
                      value={clientPkg}
                      onChange={(e) => setClientPkg(e.target.value)}
                    >
                      <option value="">Choose package defaults</option>
                      {data.packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Client service monitoring state
                    <select
                      value={clientState}
                      onChange={(e) => setClientState(e.target.value)}
                    >
                      {["active", "paused", "cancelled"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <RuleFields
                    partial
                    value={clientPatch}
                    base={base}
                    onChange={setClientPatch}
                  />
                  <button className="button" disabled={busy}>
                    Save client overrides
                  </button>
                </form>
              </details>
              <details>
                <summary>Athlete overrides · this athlete only</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(
                      () =>
                        api.saveOverride(
                          profile,
                          "athlete",
                          null,
                          athletePatch,
                          athleteState,
                          data.athlete?.version || 0,
                        ),
                      "Athlete settings saved. No automatic delivery or billing change.",
                    );
                  }}
                >
                  <label>
                    Athlete service monitoring state
                    <select
                      value={athleteState}
                      onChange={(e) => setAthleteState(e.target.value)}
                    >
                      {["active", "paused", "cancelled"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <RuleFields
                    partial
                    value={athletePatch}
                    base={{ ...base, ...clientPatch }}
                    onChange={setAthletePatch}
                  />
                  <button className="button" disabled={busy}>
                    Save athlete overrides
                  </button>
                </form>
              </details>
              <details>
                <summary>Plan a manual delivery check</summary>
                <p>
                  This records an expectation for the exact assigned
                  workout/content version. It does not upload, assign, hide or
                  release training.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!data.effective_rule || !athlete?.workout_id) return;
                    void act(async () => {
                      const boundary = localDeliveryInstant(
                        date,
                        data.effective_rule!,
                      ).toISOString();
                      const key = JSON.stringify([
                        profile,
                        cycle,
                        date,
                        athlete.workout_id,
                        athlete.workout_version,
                        boundary,
                      ]);
                      if (draftPlan.current?.key !== key)
                        draftPlan.current = { key, id: crypto.randomUUID() };
                      await api.plan(
                        draftPlan.current.id,
                        profile,
                        cycle,
                        athlete.workout_id!,
                        athlete.workout_version!,
                        date,
                        boundary,
                      );
                    }, "Expectation saved. A manual check is still required; no release job was scheduled.");
                  }}
                >
                  <label>
                    Cycle label
                    <input
                      required
                      maxLength={80}
                      placeholder="Week of November 1"
                      value={cycle}
                      onChange={(e) => setCycle(e.target.value)}
                    />
                  </label>
                  <label>
                    Expected delivery date
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <p>
                    Current plan:{" "}
                    {athlete?.workout_title || "Assign a saved workout first"}.
                    Notice boundary uses the due time; future checks cannot
                    create early content-ready notices.
                  </p>
                  <button
                    className="button"
                    disabled={
                      busy || !data.effective_rule || !athlete?.workout_id
                    }
                  >
                    Save delivery expectation
                  </button>
                </form>
              </details>
            </>
          )}
          <h3>Expected training</h3>
          {data.checks.length ? (
            <ul className="delivery-list">
              {data.checks.map((c) => (
                <li key={c.id}>
                  <strong>
                    {c.cycle_key} · {c.state}
                  </strong>
                  <p>
                    Due {stamp(c.due_at, c.rule_snapshot.timezone)} ·{" "}
                    {c.rule_snapshot.timezone}.{" "}
                    {c.available_now
                      ? "Accessible when checked now"
                      : "Not confirmed accessible now"}
                    .
                  </p>
                  <p>
                    First observed accessible:{" "}
                    {stamp(c.first_observed_available_at)}. Last manual check:{" "}
                    {stamp(c.last_checked_at)}.
                  </p>
                  {role === "owner" && c.state === "active" && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () => api.checkState(c.id, "cancelled", c.state),
                          "Delivery expectation cancelled. Recheck to resolve any recorded alert.",
                        )
                      }
                    >
                      Cancel this expectation
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No delivery expectations recorded for this athlete.</p>
          )}
          <details>
            <summary>Missing-submission reminders · separate event</summary>
            <p>
              Disabled. Decide what submission is expected and the cadence
              before activation. A missing athlete upload is not the same as
              staff failing to deliver training. A draft cadence can be stored
              for review, but no reminder is generated.
            </p>
            {role === "owner" && (
              <>
                <label>
                  Expected submission (draft)
                  <input
                    maxLength={200}
                    value={athletePatch.submission_expectation || ""}
                    onChange={(e) => {
                      const next = { ...athletePatch };
                      if (e.target.value)
                        next.submission_expectation = e.target.value;
                      else delete next.submission_expectation;
                      setAthletePatch(next);
                    }}
                  />
                </label>
                <label>
                  Draft reminder cadence (hours)
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={athletePatch.submission_cadence_hours ?? ""}
                    onChange={(e) => {
                      const next = { ...athletePatch };
                      if (e.target.value)
                        next.submission_cadence_hours = +e.target.value;
                      else delete next.submission_cadence_hours;
                      setAthletePatch(next);
                    }}
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () =>
                        api.saveOverride(
                          profile,
                          "athlete",
                          null,
                          { ...athletePatch, submission_reminders: false },
                          athleteState,
                          data.athlete?.version || 0,
                        ),
                      "Reminder draft saved; reminders remain disabled and nothing was sent.",
                    )
                  }
                >
                  Save reminder draft
                </button>
              </>
            )}
          </details>
        </>
      )}
    </section>
  );
}
export function ContentInbox({
  client,
  actor,
}: {
  client: SupabaseClient;
  actor: string;
}) {
  const api = useMemo(() => new DeliveryService(client), [client]);

  const [loaded, setLoaded] = useState<{
      actor: string;
      items: ContentNotice[];
    }>({ actor: "", items: [] }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const items = loaded.actor === actor ? loaded.items : [];
  useEffect(() => {
    let active = true;
    void api
      .inbox()
      .then((v) => {
        if (active) {
          setLoaded({ actor, items: v });
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, actor, attempt]);
  return (
    <section
      className="panel delivery-inbox"
      aria-label="Your content notifications"
    >
      <h2>Your updates</h2>
      <p>
        Private in-app notices · {items.filter((n) => !n.read_at).length} unread
      </p>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => setAttempt((n) => n + 1)}
      >
        Refresh updates
      </button>
      {error && <p role="alert">{error}</p>}
      {!items.length && !error && <p>No content updates recorded yet.</p>}
      <ul className="delivery-list">
        {items.map((n) => (
          <li key={n.id}>
            <strong>
              {n.kind === "training_ready"
                ? "Training is ready"
                : "Your review feedback is ready"}
            </strong>
            <p>For {n.athlete_name || "your athlete"}</p>
            <p>
              {n.read_at ? "Read" : "Unread"} · observed {stamp(n.observed_at)}{" "}
              · Email disabled
            </p>
            <p>
              {n.available_now
                ? "Open your workspace and choose the athlete to view it."
                : "Access has changed since this notice. Check your workspace or contact staff."}
            </p>
            {!n.read_at && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  try {
                    await api.read(n.id);
                    setAttempt((v) => v + 1);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                Mark as read
              </button>
            )}
            <a className="text-button" href="#workspace">
              Go to my workspace
            </a>
          </li>
        ))}
      </ul>
      <p className="member-fineprint">
        Notices contain no private media links. Device push and automatic email
        delivery are not active.
      </p>
    </section>
  );
}
