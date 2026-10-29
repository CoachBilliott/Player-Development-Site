import { useEffect, useRef, useState } from "react";
import {
  WeeklyNotificationService,
  type WeeklyNotificationWorkspace,
  type WeeklyRulePatch,
  type WeeklyRuleScope,
} from "./notificationRules";
import "./weeklyNotificationSettings.css";

type Selection = { scope: WeeklyRuleScope; packageId: string | null };
const same = (a: Selection, b: Selection) =>
  a.scope === b.scope && a.packageId === b.packageId;
export function WeeklyNotificationSettings({
  api,
  profile,
  athleteName,
  onBusyChange,
}: {
  api: WeeklyNotificationService;
  profile: string;
  athleteName: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [attempt, setAttempt] = useState(0),
    [data, setData] = useState<
      WeeklyNotificationWorkspace | null | undefined
    >(),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [selection, setSelection] = useState<Selection>({
    scope: "athlete",
    packageId: null,
  });
  useEffect(() => {
    if (!open) return;
    let active = true;
    void api
      .workspace(profile)
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setData(undefined);
          setError(
            e instanceof Error ? e.message : "Settings could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [api, profile, open, attempt]);
  function refresh() {
    setError("");
    setData(undefined);
    setAttempt((n) => n + 1);
  }
  return (
    <details
      className="weekly-notification-settings"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Weekly notification preferences</summary>
      <p>
        <strong>{athleteName}</strong> · in-app reminders and staff capacity
        warnings.
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" className="button secondary" onClick={refresh}>
            Retry weekly settings
          </button>
        </div>
      )}
      {open && data === undefined && !error && (
        <p role="status">Loading this athlete’s notification preferences…</p>
      )}
      {open && data === null && (
        <p role="status">
          Weekly preferences need the reviewed migration024. Existing delivery
          checks are still available; no weekly settings were changed.
        </p>
      )}
      {open && data && (
        <>
          <p className="weekly-effective">
            <strong>Effective Friday reminder:</strong>{" "}
            {data.effective.reminders_enabled
              ? `${data.effective.friday_time.length > 5 ? data.effective.friday_time.replace(/:00$/, "") : data.effective.friday_time} Central`
              : "Off"}
            . Warn staff below
            {` ${data.effective.low_ready_weeks} `}ready weeks. Routing:{" "}
            {data.effective.staff_routing === "owners_managers"
              ? "Owners and Managers only"
              : "assigned coach + Owners/Managers"}
            .
          </p>
          <p>
            {data.runtime.learning_enabled &&
            data.runtime.scheduler_enabled &&
            data.runtime.notices_enabled
              ? "Automatic notices are on. Saving does not send a message now."
              : "Automatic notices are off. Saving does not turn them on."}
          </p>
          <details className="weekly-preference-help">
            <summary>How inheritance works</summary>
            <p>
              Global → package → household → athlete. Siblings can use different
              notification defaults. This does not change training access,
              billing or plan pauses. Sunday release stays 00:00
              America/Chicago; Friday reminders cover unfinished work only.
              Missing-submission reminders are separate.
            </p>
          </details>
          <WeeklyRuleEditor
            key={`${profile}:${selection.scope}:${selection.packageId}:${attempt}`}
            api={api}
            profile={profile}
            data={data}
            selection={selection}
            onSelect={setSelection}
            onBusyChange={onBusyChange}
            onSaved={() => {
              setStatus(
                "Weekly preferences saved. No message was sent and scheduler settings were not changed.",
              );
              refresh();
            }}
          />
        </>
      )}
      {status && <p role="status">{status}</p>}
    </details>
  );
}
function WeeklyRuleEditor({
  api,
  profile,
  data,
  selection,
  onSelect,
  onSaved,
  onBusyChange,
}: {
  api: WeeklyNotificationService;
  profile: string;
  data: WeeklyNotificationWorkspace;
  selection: Selection;
  onSelect: (value: Selection) => void;
  onSaved: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const pkg = data.packages.find((p) => p.id === selection.packageId);
  const original =
    selection.scope === "package"
      ? pkg?.rules || {}
      : selection.scope === "client"
        ? data.client?.rules || {}
        : data.athlete?.rules || {};
  const version =
    selection.scope === "package"
      ? pkg?.version || 0
      : selection.scope === "client"
        ? data.client?.version || 0
        : data.athlete?.version || 0;
  const [patch, setPatch] = useState<WeeklyRulePatch>(original),
    [athletePackage, setAthletePackage] = useState(
      data.athlete?.package_id || "",
    ),
    [pending, setPending] = useState<Selection | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    alive = useRef(true),
    scopeControl = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const dirty =
    (["friday_time", "reminders_enabled", "low_ready_weeks"] as const).some(
      (key) => patch[key] !== original[key],
    ) ||
    (selection.scope === "athlete" &&
      athletePackage !== (data.athlete?.package_id || ""));
  const selectedPackage = data.packages.find(
    (p) =>
      p.id ===
      (selection.scope === "athlete"
        ? athletePackage || data.client?.package_id
        : data.client?.package_id),
  );
  const inherited =
    selection.scope === "package"
      ? data.global
      : selection.scope === "client"
        ? { ...data.global, ...selectedPackage?.rules }
        : { ...data.global, ...selectedPackage?.rules, ...data.client?.rules };
  const effective = { ...inherited, ...patch };
  function select(next: Selection) {
    if (same(next, selection)) return;
    if (dirty) setPending(next);
    else onSelect(next);
  }
  function override(key: keyof WeeklyRulePatch, checked: boolean) {
    setPatch((previous) => {
      const next = { ...previous };
      if (checked)
        Object.assign(next, {
          [key]:
            key === "friday_time"
              ? effective.friday_time.slice(0, 5)
              : effective[key],
        });
      else delete next[key];
      return next;
    });
  }
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await api.save(
        selection.scope,
        profile,
        selection.packageId,
        patch,
        version,
        athletePackage || null,
      );
      if (alive.current) onSaved();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "The change was not confirmed. Keep your draft and retry.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div className="weekly-rule-editor">
      <label>
        Change preferences for
        <select
          ref={scopeControl}
          disabled={busy}
          value={
            selection.scope === "package"
              ? `package:${selection.packageId}`
              : selection.scope
          }
          onChange={(e) =>
            select(
              e.target.value.startsWith("package:")
                ? { scope: "package", packageId: e.target.value.slice(8) }
                : { scope: e.target.value as WeeklyRuleScope, packageId: null },
            )
          }
        >
          <option value="athlete">This athlete only</option>
          <option value="client">This household</option>
          <optgroup label="Package defaults">
            {data.packages.map((p) => (
              <option key={p.id} value={`package:${p.id}`}>
                {p.title}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {pending && (
        <div role="region" aria-label="Unsaved weekly preferences">
          <p>Switching scope will discard the changes in this draft.</p>
          <div className="actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setPending(null);
                scopeControl.current?.focus();
              }}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => onSelect(pending)}
            >
              Discard draft and switch
            </button>
          </div>
        </div>
      )}
      {selection.scope === "client" && !data.client ? (
        <p>
          Choose household delivery package defaults above before setting
          household overrides. Athlete-only settings can still be configured.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {selection.scope === "package" && (
            <p>
              Changes apply wherever this package’s notification defaults are
              inherited.
            </p>
          )}
          {selection.scope === "client" && (
            <p>
              Applies to every athlete in this household unless they have an
              individual override.
            </p>
          )}
          {selection.scope === "athlete" && (
            <label>
              Notification package
              <select
                disabled={busy}
                value={athletePackage}
                onChange={(e) => setAthletePackage(e.target.value)}
              >
                <option value="">Inherit household</option>
                {data.packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <fieldset disabled={busy || !!pending}>
            <legend>
              {selection.scope === "package"
                ? "Package defaults"
                : selection.scope === "client"
                  ? "Household overrides"
                  : "Athlete overrides"}
            </legend>
            <p>Leave options unchecked to inherit.</p>
            <label className="weekly-override">
              <input
                type="checkbox"
                checked={"reminders_enabled" in patch}
                onChange={(e) =>
                  override("reminders_enabled", e.target.checked)
                }
              />
              Set reminder preference
            </label>
            <label>
              Friday reminder (in-app)
              <select
                disabled={!("reminders_enabled" in patch)}
                value={String(effective.reminders_enabled)}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    reminders_enabled: e.target.value === "true",
                  }))
                }
              >
                <option value="true">Enabled</option>
                <option value="false">Off</option>
              </select>
            </label>
            <label className="weekly-override">
              <input
                type="checkbox"
                checked={"friday_time" in patch}
                onChange={(e) => override("friday_time", e.target.checked)}
              />
              Set Friday time
            </label>
            <label>
              Friday time (Central)
              <input
                type="time"
                required
                disabled={!("friday_time" in patch)}
                value={effective.friday_time.slice(0, 5)}
                onChange={(e) =>
                  setPatch((p) => ({ ...p, friday_time: e.target.value }))
                }
              />
            </label>
            <label className="weekly-override">
              <input
                type="checkbox"
                checked={"low_ready_weeks" in patch}
                onChange={(e) => override("low_ready_weeks", e.target.checked)}
              />
              Set ready-week threshold
            </label>
            <label>
              Warn below (ready weeks)
              <input
                type="number"
                required
                min={1}
                max={8}
                disabled={!("low_ready_weeks" in patch)}
                value={effective.low_ready_weeks}
                onChange={(e) =>
                  setPatch((p) => ({
                    ...p,
                    low_ready_weeks: Number(e.target.value),
                  }))
                }
              />
            </label>
          </fieldset>
          {error && <p role="alert">{error} Your draft has been kept.</p>}
          <div className="actions">
            <button
              className="button"
              disabled={
                busy || !!pending || (selection.scope === "package" && !pkg)
              }
            >
              {busy ? "Saving weekly preferences…" : "Save weekly preferences"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setPatch(original);
                setAthletePackage(data.athlete?.package_id || "");
                setPending(null);
                setError("");
              }}
            >
              Cancel draft changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
