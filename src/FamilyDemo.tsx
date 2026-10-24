import { useMemo, useState } from "react";
import { z } from "zod";
import { PROFILES } from "./model";
import { DRILLS } from "./data";
import { playerSchema } from "./accounts";
import { workoutSchema, type FamilyService, type FamilyState } from "./family";
import { AthleteTraining } from "./FamilyTraining";
import { Notice, Tag } from "./components";
const owner = "00000000-0000-4000-8000-000000000001";
const individual = "00000000-0000-4000-8000-000000000002";
const actor = "00000000-0000-4000-8000-000000000003";
const key = "pd-family-demo-v1";
const samples = PROFILES.map((p, i) =>
  playerSchema.parse({
    id: `00000000-0000-4000-8000-${String(10 + i).padStart(12, "0")}`,
    owner_id: p.guardian ? owner : individual,
    nickname: p.name,
    age_group: p.age,
    sport: "football",
    position: p.position,
    experience: p.level,
    goal: p.goal,
    guardian_confirmed: p.guardian,
    version: 1,
  }),
);
const schema = z.object({
  added: z.boolean(),
  permissions: z.record(
    z.string(),
    z.object({ allowed: z.boolean(), version: z.number().int().nonnegative() }),
  ),
  workouts: z.array(workoutSchema),
});
type DemoState = z.infer<typeof schema>;
const empty: DemoState = { added: false, permissions: {}, workouts: [] };
function read(): DemoState {
  try {
    return schema.parse(
      JSON.parse(localStorage.getItem(key) || JSON.stringify(empty)),
    );
  } catch {
    return empty;
  }
}
export function FamilyDemo({
  initialView = "parent",
  focused = false,
}: {
  initialView?: "parent" | "athlete" | "individual";
  focused?: boolean;
}) {
  const [revision, setRevision] = useState(0),
    [view, setView] = useState<"parent" | "athlete" | "individual">(
      initialView,
    ),
    [selected, setSelected] = useState(
      samples[
        initialView === "individual" ? 3 : initialView === "athlete" ? 2 : 0
      ].id,
    ),
    [warning, setWarning] = useState("");
  const data = useMemo(() => {
    void revision;
    return read();
  }, [revision]);
  const familyPlayers = samples.filter(
    (p, i) => p.age_group !== "18+" && (i !== 1 || data.added),
  );
  const available =
    view === "individual"
      ? [samples[3]]
      : view === "athlete"
        ? [familyPlayers.find((p) => p.id === selected) || familyPlayers[0]]
        : familyPlayers;
  const player = available.find((p) => p.id === selected) || available[0];
  const service = useMemo<FamilyService>(() => {
    function save(next: DemoState) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setRevision((old) => old + 1);
      } catch {
        setWarning(
          "Demo changes could not be saved. Allow browser storage to try the persistent family demo.",
        );
        throw new Error(
          "Demo storage is unavailable; no saved record was changed.",
        );
      }
    }
    return {
      async load(p) {
        const state = read(),
          permission = state.permissions[p.id] || {
            allowed: false,
            version: 0,
          };
        const family = p.age_group !== "18+";
        return {
          guardian_managed: family,
          is_family: family,
          is_parent: view === "parent",
          can_record:
            view === "parent" || view === "individual" || permission.allowed,
          self_recording_allowed: permission.allowed,
          permission_version: permission.version,
          has_link: family,
          child_access_ready: true,
          workouts: state.workouts.filter((w) => w.profile_id === p.id),
        } satisfies FamilyState;
      },
      async permission(p, allowed, version) {
        if (view !== "parent")
          throw new Error("Only the parent can change permission.");
        const state = read(),
          current = state.permissions[p.id] || { allowed: false, version: 0 };
        if (current.version !== version)
          throw new Error("Permission changed. Refresh the history.");
        save({
          ...state,
          permissions: {
            ...state.permissions,
            [p.id]: { allowed, version: version + 1 },
          },
        });
      },
      async report(p, id, drills) {
        const state = read();
        if (view === "athlete" && !state.permissions[p.id]?.allowed)
          throw new Error("The parent has paused independent recording.");
        if (state.workouts.some((w) => w.id === id)) return;
        const selectedDrills = drills.map((d) =>
          DRILLS.find((x) => x.id === d)!,
        );
        save({
          ...state,
          workouts: [
            {
              id,
              profile_id: p.id,
              reported_by:
                view === "parent"
                  ? owner
                  : view === "individual"
                    ? individual
                    : actor,
              drill_ids: drills,
              titles: selectedDrills.map((d) => d.title),
              minutes: selectedDrills.reduce(
                (total, d) => total + d.minutes,
                0,
              ),
              status:
                view === "parent"
                  ? "approved"
                  : view === "individual"
                    ? "self_reported"
                    : "pending_parent",
              created_at: new Date().toISOString(),
              reviewed_by: view === "parent" ? owner : null,
              reviewed_at: view === "parent" ? new Date().toISOString() : null,
              version: 1,
            },
            ...state.workouts,
          ],
        });
      },
      async review(id, decision, version) {
        if (view !== "parent") throw new Error("Only the parent can review.");
        const state = read(),
          workout = state.workouts.find((w) => w.id === id);
        if (
          !workout ||
          workout.version !== version ||
          workout.status !== "pending_parent"
        )
          throw new Error("This workout was already reviewed. Refresh.");
        save({
          ...state,
          workouts: state.workouts.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status: decision,
                  reviewed_by: owner,
                  reviewed_at: new Date().toISOString(),
                  version: w.version + 1,
                }
              : w,
          ),
        });
      },
      async invite() {
        throw new Error(
          "No real account connections are created in the family demo.",
        );
      },
      async remove() {
        throw new Error("Demo identities are fictional.");
      },
    };
  }, [view]);
  function changeView(next: typeof view) {
    setView(next);
    if (next === "individual") setSelected(samples[3].id);
    else if (selected === samples[3].id) setSelected(samples[0].id);
  }
  return (
    <main
      className={`page member-page family-demo ${focused && view === "athlete" ? "junior-workspace" : ""}`}
    >
      <div className="member-heading">
        <Tag>FICTIONAL FAMILY DEMO</Tag>
        <h1 tabIndex={-1}>
          {focused ? (
            view === "parent" ? (
              "Your family. Their next step."
            ) : view === "individual" ? (
              "Your training. Your next step."
            ) : (
              "Ready for your next practice?"
            )
          ) : (
            <>
              One athlete.
              <br />A parent in control.
            </>
          )}
        </h1>
        <p>
          {focused
            ? view === "parent"
              ? "Manage the fictional family roster, choose who may record practice, and review their reports."
              : view === "individual"
                ? "Meet Morgan, a fictional adult athlete. Try a session and track self-reported practice."
                : "Hi Casey. Your parent chooses when you can record practice. Ask them to review your workout when you finish."
            : "Try separate athlete profiles, parent permissions and workout review. Every person here is fictional."}
        </p>
      </div>
      <Notice>
        These demo switches simulate family roles. No real child account is
        created. Changes stay in this browser and do not connect to real
        profiles.
      </Notice>
      {warning && (
        <p className="form-error" role="alert">
          {warning}
        </p>
      )}
      {!focused && (
        <div
          className="scene-tabs family-view-tabs"
          role="group"
          aria-label="Family demo view"
        >
          <button
            aria-pressed={view === "parent"}
            onClick={() => changeView("parent")}
          >
            Parent view
          </button>
          <button
            aria-pressed={view === "athlete"}
            onClick={() => changeView("athlete")}
          >
            Athlete view
          </button>
          <button
            aria-pressed={view === "individual"}
            onClick={() => changeView("individual")}
          >
            Individual athlete
          </button>
        </div>
      )}
      {focused && view === "athlete" && (
        <Notice>
          Ask your parent to allow recording for Casey in the{" "}
          <a href="#demo-parent">Parent demo</a>, then return here. Each athlete
          sees only their own practice. Real junior logins remain closed.
        </Notice>
      )}
      <div
        className="family-athlete-picker"
        role="group"
        aria-label="Fictional athletes"
      >
        {available.map((p) => (
          <button
            key={p.id}
            className={
              p.id === player.id
                ? "family-athlete-choice selected"
                : "family-athlete-choice"
            }
            aria-pressed={p.id === player.id}
            onClick={() => setSelected(p.id)}
          >
            <strong>{p.nickname}</strong>
            <span>
              Age {p.age_group} · {p.position}
            </span>
          </button>
        ))}
        {view === "parent" && !data.added && (
          <button
            className="button secondary"
            onClick={() => {
              try {
                localStorage.setItem(
                  key,
                  JSON.stringify({ ...read(), added: true }),
                );
                setRevision((old) => old + 1);
                setSelected(samples[1].id);
              } catch {
                setWarning("Demo storage is unavailable.");
              }
            }}
          >
            Add fictional athlete Jordan
          </button>
        )}
      </div>
      <AthleteTraining
        key={`${view}-${player.id}`}
        player={player}
        service={service}
        demo
        junior={focused && view === "athlete"}
      />
      <a className="text-button" href="#account">
        Open real member access
      </a>
    </main>
  );
}
