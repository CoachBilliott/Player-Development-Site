import {
  TrainingWorkspace,
  AssignTrainingWorkspace,
  IndividualTrainingAccess,
  StaffDeliveryWorkspace,
} from "../../src/StaffTraining";
import { WorkoutBuilder } from "../../src/WorkoutBuilder";
import { StaffSettingsWorkspace } from "../../src/Workspaces";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PrivateHeader,
  PrivateFooter,
  PrivateAccessMessage,
} from "../../src/PrivateShell";
import { MemberAccountPage } from "../../src/MemberAccount";
import {
  Workspace,
  AccessWorkspace,
  InterestWorkspace,
} from "../../src/Workspaces";
import { MobileTraining } from "../../src/MobileTraining";
import { isStaff, type AccountRole } from "../../src/roles";
import { previewShared } from "./fixtures";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "../../src/styles.css";
import "../../src/theme.css";
import "../../src/editorial.css";
import "../../src/repformed.css";
import "../../src/mobile.css";
import "./preview.css";

export function Preview() {
  const [role, setRole] = useState<AccountRole | null>(null);
  const [page, setPage] = useState(() => location.hash.slice(1) || "account");
  const [selection, setSelection] = useState({ userId: "", playerId: "" });
  useEffect(() => {
    const change = () => {
      setPage(location.hash.slice(1) || "account");
      window.scrollTo(0, 0);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("main h1")?.focus(),
      );
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const signOutPreview = useCallback(() => {
    setRole(null);
    window.location.assign("#account");
  }, []);
  const shared = useMemo(
    () => previewShared(role, signOutPreview),
    [role, signOutPreview],
  );
  return (
    <div className="experience website-layout is-private">
      <aside
        className="private-preview-controls"
        aria-label="Fictional design preview"
      >
        <div>
          <strong>DESIGN REVIEW · FICTIONAL DATA</strong>
          <p>
            No real sign-in, emails, uploads or account changes. Don’t enter
            real passwords.
          </p>
        </div>
        <label>
          Preview role
          <select
            value={role || "visitor"}
            onChange={(e) => {
              const r = e.target.value;
              setRole(r === "visitor" ? null : (r as AccountRole));
              setSelection({ userId: "", playerId: "" });
              const u = new URL(location.href);
              u.search = "";
              u.hash = r === "visitor" ? "account" : "workspace";
              history.replaceState(null, "", u);
              setPage(u.hash.slice(1));
            }}
          >
            <option value="visitor">Signed out · login</option>
            {["owner", "manager", "coach", "parent", "athlete"].map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </aside>
      <PrivateHeader shared={shared} page={page} />
      <div key={`${role}:${page}`}>
        {page === "account" ? (
          <MemberAccountPage shared={shared} />
        ) : page === "profiles" ? (
          <MemberAccountPage shared={shared} profiles />
        ) : page === "access" ? (
          <AccessWorkspace shared={shared} />
        ) : page === "training" ? (
          <TrainingWorkspace shared={shared} />
        ) : page === "training-assign" ? (
          <AssignTrainingWorkspace shared={shared} />
        ) : page === "training-access" ? (
          <IndividualTrainingAccess shared={shared} />
        ) : page === "workout-builder" ? (
          <WorkoutBuilder shared={shared} />
        ) : page === "staff-settings" ? (
          <StaffSettingsWorkspace shared={shared} />
        ) : page === "staff-delivery" ? (
          <StaffDeliveryWorkspace shared={shared} />
        ) : page === "interest" ? (
          <InterestWorkspace shared={shared} />
        ) : page === "workspace" && isStaff(role) ? (
          <Workspace shared={shared} />
        ) : role &&
          ["workspace", "app-workouts", "app-progress"].includes(page) ? (
          <MobileTraining
            shared={shared}
            screen={
              page === "app-progress"
                ? "progress"
                : page === "app-workouts"
                  ? "workouts"
                  : "today"
            }
            selection={selection}
            onSelect={setSelection}
          />
        ) : (
          <PrivateAccessMessage
            signedIn={Boolean(role)}
            title="This screen isn’t connected in this preview."
          >
            Use the role selector and navigation to review login, account
            settings, client service, profiles, roles, invitations and interest.
            Training tools, payments, real messages and account changes are not
            connected.{" "}
            <a href="https://repformed.com/">
              Open the unchanged public website.
            </a>
          </PrivateAccessMessage>
        )}
      </div>
      <PrivateFooter />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
