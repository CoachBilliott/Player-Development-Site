import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, Search } from "lucide-react";
import { Workouts, type SavedWorkout } from "./workouts";
import type { StaffAthlete } from "./staffService";
import { AssignWorkout } from "./WorkoutBuilder";

/** Reuses the existing Owner-only profile RPC. Never changes the selected athlete. */
export function AthleteTrainingAssignment({
  client,
  athlete,
  onClose,
  onSaved,
  onBusyChange,
}: {
  client: SupabaseClient;
  athlete: StaffAthlete;
  onClose: () => void;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const api = useMemo(() => new Workouts(client), [client]);
  const [rows, setRows] = useState<SavedWorkout[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [query, setQuery] = useState(""),
    [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    void api
      .list()
      .then((r) => {
        if (active) {
          setRows(r);
          setLoading(false);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [api, retry]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const selected = rows.find((w) => w.id === choice),
    shown = rows.filter((w) =>
      w.title.toLowerCase().includes(query.trim().toLowerCase()),
    );
  function stageBusy(value: boolean) {
    setBusy(value);
    onBusyChange(value);
  }
  return (
    <section
      className="athlete-assignment-panel"
      aria-label={`Assign training to ${athlete.athlete_name}`}
    >
      <header>
        <div>
          <span className="eyebrow">THIS ATHLETE ONLY</span>
          <h3 ref={heading} tabIndex={-1}>
            Assign training to {athlete.athlete_name}
          </h3>
        </div>
        <button className="text-button" disabled={busy} onClick={onClose}>
          Cancel assignment
        </button>
      </header>
      <p>
        Current workout:{" "}
        <strong>{athlete.workout_title || "None assigned"}</strong>
      </p>
      {loading && !error && <p role="status">Loading reusable workouts…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className="button secondary"
            onClick={() => {
              setError("");
              setLoading(true);
              setRetry((n) => n + 1);
            }}
          >
            Retry workouts
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        (selected ? (
          <>
            <div className="workflow-selection">
              <div>
                <strong>{selected.title}</strong>
                <p>
                  {selected.resource_ids.length}{" "}
                  {selected.resource_ids.length === 1 ? "drill" : "drills"} ·
                  saved version {selected.version}
                </p>
              </div>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setChoice("");
                  requestAnimationFrame(() => heading.current?.focus());
                }}
              >
                <ArrowLeft size={16} /> Choose another workout
              </button>
            </div>
            <AssignWorkout
              key={`${athlete.athlete_id}:${selected.id}:${selected.version}`}
              service={api}
              workout={selected}
              dirty={false}
              fixedTarget={{
                account: athlete.client_id,
                profile: athlete.athlete_id!,
              }}
              embedded
              onSaved={onSaved}
              onBusyChange={stageBusy}
            />
          </>
        ) : (
          <>
            <label className="workflow-search">
              <Search size={17} />
              <span className="staff-sr-only">
                Find a workout for this athlete
              </span>
              <input
                type="search"
                aria-label="Find a workout for this athlete"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search saved workouts"
              />
            </label>
            <div className="workflow-bank">
              {shown.map((w) => (
                <button
                  key={w.id}
                  className="workflow-bank-row"
                  onClick={() => setChoice(w.id)}
                >
                  <span>
                    <strong>{w.title}</strong>
                    <small>
                      {w.resource_ids.length}{" "}
                      {w.resource_ids.length === 1 ? "drill" : "drills"} ·
                      version {w.version}
                    </small>
                  </span>
                  <span>Choose</span>
                </button>
              ))}
            </div>
            {!shown.length && (
              <p>
                {rows.length
                  ? "No workouts match. Try another search."
                  : "No saved workouts yet. Create one in Training, then return to this athlete."}
              </p>
            )}
            {!rows.length && (
              <a href="#training" className="text-button">
                Open the training bank
              </a>
            )}
          </>
        ))}
    </section>
  );
}
