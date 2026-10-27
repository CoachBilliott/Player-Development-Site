import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StaffServiceDashboard } from "../../src/StaffServiceDashboard";
import { Logo } from "../../src/components";
import { coachA, coachB, sampleRows, sampleNextAction, uid } from "./data";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "../../src/styles.css";
import "../../src/theme.css";
import "../../src/editorial.css";
import "../../src/repformed.css";
import "./preview.css";
type Role = "owner" | "manager" | "coach";
export function Preview() {
  const [role, setRole] = useState<Role>("owner"),
    [revision, setRevision] = useState(0);
  const rows = useRef(sampleRows());
  const client = useMemo(
    () =>
      ({
        async rpc(name: string, body: Record<string, unknown> = {}) {
          const allowed = (r: ReturnType<typeof sampleRows>[number]) =>
            role !== "coach" || r.coach_id === coachA;
          const view = (r: ReturnType<typeof sampleRows>[number]) =>
            role === "coach"
              ? {
                  ...r,
                  next_action: sampleNextAction(r),
                  client_label: `Client ${r.client_id.slice(0, 8)}`,
                  review_scope: "assigned_only",
                }
              : { ...r, next_action: sampleNextAction(r) };
          if (name === "staff_client_service_roster")
            return {
              data: {
                source: "account_backend",
                scope:
                  role === "coach"
                    ? "assigned_athletes"
                    : "all_repformed_clients",
                rows: rows.current.filter(allowed).map(view),
                coaches:
                  role === "owner"
                    ? [
                        { id: coachA, label: "Fictional Coach Alex" },
                        { id: coachB, label: "Fictional Coach Blair" },
                      ]
                    : [],
              },
              error: null,
            };
          const row = rows.current.find(
            (r) => r.athlete_id === body.target_profile,
          );
          if (!row || !allowed(row))
            return {
              data: null,
              error: { message: "Outside fictional roster" },
            };
          if (name === "staff_athlete_service")
            return { data: view(row), error: null };
          if (
            name === "assign_athlete_service_coach" &&
            role === "owner" &&
            row.coach_version === body.expected_version
          ) {
            row.coach_id = body.coach as string | null;
            row.coach_version = (row.coach_version || 0) + 1;
            row.coach_label =
              row.coach_id === coachA
                ? "Fictional Coach Alex"
                : row.coach_id === coachB
                  ? "Fictional Coach Blair"
                  : null;
            return { data: null, error: null };
          }
          return {
            data: null,
            error: { message: "Not available in this preview" },
          };
        },
      }) as unknown as SupabaseClient,
    [role],
  );
  function clearDetail() {
    const u = new URL(location.href);
    u.searchParams.delete("serviceAthlete");
    history.replaceState(null, "", u);
  }
  return (
    <div className="experience">
      <header className="preview-header">
        <Logo href="https://repformed.com/" />
        <a href="https://repformed.com/">
          Main website <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </header>
      <main className="page preview-main">
        <div className="preview-banner" role="note">
          <strong>INTERACTIVE PREVIEW · FICTIONAL ADULTS ONLY</strong>
          <span>Changes stay in this browser.</span>
        </div>
        <div className="preview-topline">
          <div>
            <p className="preview-eyebrow">REPFORMED WORKSPACE</p>
            <h1>Client service.</h1>
            <p>See who's ready and what needs attention.</p>
          </div>
          <div className="preview-controls">
            <label>
              View as
              <select
                value={role}
                onChange={(e) => {
                  clearDetail();
                  setRole(e.target.value as Role);
                }}
              >
                <option value="owner">Owner · all clients</option>
                <option value="manager">Manager · all clients</option>
                <option value="coach">Coach Alex · assigned athletes</option>
              </select>
            </label>
            <button
              className="button secondary"
              onClick={() => {
                rows.current = sampleRows();
                clearDetail();
                setRevision((n) => n + 1);
              }}
            >
              Reset fictional data
            </button>
          </div>
        </div>
        <StaffServiceDashboard
          key={`${role}:${revision}`}
          client={client}
          role={role}
          actor={role === "coach" ? coachA : uid(1)}
          enabled
          preview
        />
        <details className="preview-about">
          <summary>About this preview & what's connected</summary>
          <p>
            All profiles and activity are fictional. Role switching simulates
            access; it does not sign you into an account. Search, filters,
            service details and sample coach changes work in this browser.
            Refresh or reset restores the samples.
          </p>
          <p>
            Real uploads, coaching feedback, training assignment, payments,
            notifications and client records are not connected. No athletic
            ability, actual delivery or payment is verified. The production
            website and TestFlight app are unchanged.
          </p>
        </details>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
