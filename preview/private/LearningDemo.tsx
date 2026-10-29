import { useCallback, useMemo, useState } from "react";
import { StaffLearning } from "../../src/learning/StaffLearning";
import { LearningAthlete } from "../../src/learning/LearningAthlete";
import { StaffServiceDashboard } from "../../src/StaffServiceDashboard";
import { StaffService, type RosterCursor } from "../../src/staffService";
import {
  learningSimulation,
  sampleActor,
  sampleProfiles,
  rosterProfiles,
  type SimulationRole,
} from "./learningSimulation";
import { learningBridge } from "./learningBridge";
export function LearningDemo() {
  const [role, setRole] = useState<SimulationRole>("owner"),
    [profile, setProfile] = useState(sampleProfiles[0].id),
    [view, setView] = useState<"athlete" | "bank" | "roster">("roster"),
    [revision, setRevision] = useState(0);
  const [simulation, setSimulation] = useState(() =>
    learningSimulation("owner"),
  );
  const client = useMemo(
    () => learningBridge(simulation, role),
    [simulation, role],
  );
  const staffApi = useMemo(() => new StaffService(client), [client]);
  const loadProfiles = useCallback(
    async (query: string, cursor: RosterCursor | null) => {
      const page = await staffApi.page(
        { query, filter: "all", age: "", position: "", coach: "" },
        cursor,
        25,
      );
      return {
        rows: page.rows
          .filter((row) => row.athlete_id)
          .map((row) => ({ id: row.athlete_id!, name: row.athlete_name! })),
        next_cursor: page.page!.next_cursor,
      };
    },
    [staffApi],
  );
  const staff = role !== "parent";
  return (
    <main className="page staff-workflow">
      <header className="workflow-intro">
        <div>
          <h1 tabIndex={-1}>Weekly learning walkthrough</h1>
          <p>
            SIMULATION · Fictional adults only. Saves, grades and clock changes
            stay in this browser. No real accounts, media, email or scheduler.
          </p>
        </div>
        <a className="button secondary" href="#workspace">
          Back to workspace preview
        </a>
      </header>
      <div className="learning-actions learning-demo-controls">
        <label>
          Sample role
          <select
            value={role}
            onChange={(e) => {
              const next = e.target.value as SimulationRole;
              setSimulation(learningSimulation(next, simulation.export()));
              setRole(next);
              setProfile(sampleProfiles[0].id);
              setView(next === "parent" ? "athlete" : "roster");
            }}
          >
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="coach">Assigned coach</option>
            <option value="other_coach">Unassigned coach</option>
            <option value="parent">Parent / household</option>
          </select>
        </label>
        <label>
          Sample athlete
          <select
            value={profile}
            onChange={(e) => {
              setProfile(e.target.value);
              setView("athlete");
            }}
          >
            {(role === "parent"
              ? sampleProfiles
              : role === "coach"
                ? rosterProfiles.filter(
                    (p) =>
                      simulation.export().assignments[p.id] === sampleActor,
                  )
                : role === "other_coach"
                  ? []
                  : rosterProfiles
            ).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {staff && (
          <>
            <button onClick={() => setView("roster")}>Athlete roster</button>
            <button onClick={() => setView("bank")}>Training bank</button>
          </>
        )}
        <button onClick={() => setView("athlete")}>Athlete plan</button>
        <button
          onClick={() => {
            simulation.sunday();
            setRevision((n) => n + 1);
          }}
        >
          Simulate next Sunday release
        </button>
        <button
          onClick={() => {
            simulation.friday();
            setRevision((n) => n + 1);
          }}
        >
          Simulate Friday reminder
        </button>
        <button
          onClick={() => {
            setSimulation(learningSimulation(role));
            setRevision((n) => n + 1);
          }}
        >
          Reset samples
        </button>
      </div>
      <div key={`${role}:${profile}:${view}:${revision}`}>
        {view === "bank" ? (
          <StaffLearning
            api={simulation.api}
            resources={[]}
            profiles={rosterProfiles}
            loadProfiles={loadProfiles}
            onOpenAthlete={(id) => {
              setProfile(id);
              setView("athlete");
            }}
            owner={role === "owner"}
            approver={role === "owner" || role === "manager"}
          />
        ) : view === "roster" && staff ? (
          <StaffServiceDashboard
            client={client}
            role={role === "other_coach" ? "coach" : role}
            actor={sampleActor}
            enabled
            learningEnabled
            preview
          />
        ) : (
          <LearningAthlete
            api={simulation.api}
            profile={profile}
            actor={sampleActor}
            staff={staff}
            owner={role === "owner"}
          />
        )}
      </div>
    </main>
  );
}
