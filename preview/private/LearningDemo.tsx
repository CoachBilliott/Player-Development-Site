import { useState } from "react";
import { StaffLearning } from "../../src/learning/StaffLearning";
import { LearningAthlete } from "../../src/learning/LearningAthlete";
import {
  learningSimulation,
  sampleActor,
  sampleProfiles,
} from "./learningSimulation";
export function LearningDemo() {
  const [role, setRole] = useState<
      "owner" | "parent" | "coach" | "other_coach"
    >("owner"),
    [profile, setProfile] = useState(sampleProfiles[0].id),
    [view, setView] = useState<"athlete" | "bank">("athlete"),
    [revision, setRevision] = useState(0);
  const [simulation, setSimulation] = useState(() =>
    learningSimulation("owner"),
  );
  function update() {
    setRevision((n) => n + 1);
  }
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
              const next = e.target.value as typeof role;
              setSimulation(learningSimulation(next, simulation.export()));
              setRole(next);
              setView("athlete");
            }}
          >
            <option value="owner">Owner</option>
            <option value="coach">Assigned coach</option>
            <option value="other_coach">Unassigned coach</option>
            <option value="parent">Parent / household</option>
          </select>
        </label>
        <label>
          Sample athlete
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {sampleProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {role === "owner" && (
          <>
            <button onClick={() => setView("athlete")}>Athlete plan</button>
            <button onClick={() => setView("bank")}>Training bank</button>
          </>
        )}
        <button
          onClick={() => {
            simulation.sunday();
            update();
          }}
        >
          Simulate next Sunday release
        </button>
        <button
          onClick={() => {
            simulation.friday();
            update();
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
            profiles={sampleProfiles}
            owner={role === "owner"}
            approver={role === "owner"}
          />
        ) : (
          <LearningAthlete
            api={simulation.api}
            profile={profile}
            actor={sampleActor}
            staff={role !== "parent"}
            owner={role === "owner"}
          />
        )}
      </div>
    </main>
  );
}
