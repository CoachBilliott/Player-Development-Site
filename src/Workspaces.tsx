import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, FileUp, LockKeyhole } from "lucide-react";
import { Tag, Notice, Modal, AssetPreview } from "./components";
import { isStaff } from "./roles";
import type { SharedState } from "./useSharedContent";
import { MemberAccountPage } from "./MemberAccount";
import { IndividualTrainingAccess } from "./StaffTraining";
import { AccountAccess } from "./AccountAccess";
import { ReleaseSchedulePreview } from "./ReleaseSchedulePreview";
import { StaffServiceDashboard } from "./StaffServiceDashboard";
import type { Drill } from "./model";
import { OwnerAccountInvitations } from "./AccountInvitations";
import { InterestInbox } from "./InterestInbox";
import { PrivateAccessMessage } from "./PrivateShell";

function StaffDashboard({
  role,
  shared,
}: {
  role: "owner" | "manager" | "coach";
  shared: SharedState;
}) {
  return (
    <main className="page staff-workflow athletes-workspace">
      <header className="workflow-intro">
        <div>
          <Tag>ATHLETES</Tag>
          <h1 tabIndex={-1}>
            {role === "coach" ? "Your athletes." : "Athletes."}
          </h1>
          <p>
            {role === "coach"
              ? "Your assigned athletes and the next thing they need."
              : "Find an athlete, check their plan and take the next action."}
          </p>
        </div>
      </header>
      <StaffServiceDashboard
        key={`${shared.session!.user.id}:${role}`}
        client={shared.service!.client}
        actor={shared.session!.user.id}
        role={role}
        enabled={shared.staffRosterEnabled}
        monitoring={shared.deliveryMonitoringEnabled}
        operationalEmails={shared.staffNotificationEmailsEnabled}
        learningEnabled={shared.learningPlansEnabled}
      />
    </main>
  );
}
function Gate({
  title = "Sign in to open your workspace.",
}: {
  title?: string;
}) {
  return (
    <main className="page narrow workspace-page">
      <div className="workspace-hero">
        <LockKeyhole size={30} />
        <h1 tabIndex={-1}>{title}</h1>
        <p>
          Sign in with your account to open your private workspace. Your account
          level determines which tools are available.
        </p>
        <div className="actions">
          <a className="button" href="#account">
            Member sign-in <ArrowRight size={18} />
          </a>
          <a className="button secondary" href="#demo">
            Try the demo
          </a>
        </div>
      </div>
    </main>
  );
}
export function Workspace({ shared }: { shared: SharedState }) {
  if (shared.loading)
    return (
      <main className="page">
        <h1 tabIndex={-1}>Opening your workspace…</h1>
      </main>
    );
  if (!shared.signedIn) return <Gate />;
  if (isStaff(shared.role))
    return (
      <StaffDashboard
        key={shared.session!.user.id}
        role={shared.role as "owner" | "manager" | "coach"}
        shared={shared}
      />
    );
  return <MemberAccountPage shared={shared} workspace />;
}
export function AccessWorkspace({ shared }: { shared: SharedState }) {
  const readSection = () => {
    const value = new URLSearchParams(location.search).get("accessSection");
    return value === "invites" || value === "training" ? value : "roles";
  };
  const [section, setSection] = useState(readSection);
  useEffect(() => {
    const back = () => setSection(readSection());
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const selected =
    section === "invites" && !shared.accountLifecycleEnabled
      ? "roles"
      : section;
  if (shared.role !== "owner")
    return (
      <PrivateAccessMessage
        signedIn={shared.signedIn}
        title="Owner access is required."
      >
        Account roles and training entitlements are managed by an Owner. Athlete
        coach assignments are available to Owners and Managers in Athletes.
      </PrivateAccessMessage>
    );
  if (selected === "training")
    return <IndividualTrainingAccess shared={shared} />;
  return (
    <main className="page workspace-page">
      <div className="workspace-hero">
        <Tag>OWNER ADMINISTRATION</Tag>
        <h1 tabIndex={-1}>Staff & settings.</h1>
        <p>
          Invite staff or manage an existing account. Athlete training is
          managed in Training; your own sign-in details stay in Account.
        </p>
      </div>
      <div
        className="workspace-tabs"
        role="group"
        aria-label="Team access sections"
      >
        {[
          ["roles", "Accounts & roles"],
          ...(shared.accountLifecycleEnabled
            ? [["invites", "Invite staff"]]
            : []),
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={selected === id}
            onClick={() => {
              setSection(id as typeof section);
              const u = new URL(location.href);
              u.searchParams.set("accessSection", id);
              history.pushState({ repformedAccessSection: id }, "", u);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {selected === "roles" && (
        <>
          <AccountAccess shared={shared} manage />
          <details className="workflow-secondary">
            <summary>Platform tools</summary>
            <a href="#staff-delivery">Delivery checks & rules</a>
            <a href="#launch">Launch checklist & release preview</a>
            <a href="#training-access">Individual training permissions</a>
          </details>
        </>
      )}
      {selected === "invites" && shared.accountLifecycleEnabled && (
        <OwnerAccountInvitations
          key={shared.session?.user.id}
          shared={shared}
        />
      )}
    </main>
  );
}
export function InterestWorkspace({ shared }: { shared: SharedState }) {
  if (!shared.signedIn || !shared.accessReady || shared.accessError)
    return <MemberAccountPage shared={shared} />;
  if (shared.role !== "owner" && shared.role !== "manager")
    return (
      <PrivateAccessMessage signedIn title="Staff interest inbox.">
        Only Owners and Managers can view adult interest requests. Your own
        dashboard remains available.
      </PrivateAccessMessage>
    );
  return (
    <main className="page workspace-page">
      <div className="workspace-hero">
        <Tag>OWNER & MANAGER WORKSPACE</Tag>
        <h1 tabIndex={-1}>Package interest.</h1>
        <p>
          Review adult requests and their launch-email preference. Interest is
          separate from enrollment and payment.
        </p>
      </div>
      {shared.interestEndpoint && shared.service && shared.session ? (
        <InterestInbox
          key={shared.session.user.id}
          client={shared.service.client}
          actor={shared.session.user.id}
        />
      ) : (
        <Notice>The interest inbox is not enabled for this connection.</Notice>
      )}
    </main>
  );
}
export function WorkspaceLibrary({ shared }: { shared: SharedState }) {
  const [selected, setSelected] = useState<Drill | null>(null);
  if (!shared.signedIn) return <Gate />;
  const staff = isStaff(shared.role);
  const resources = staff
    ? shared.resources.filter((d) => shared.canEditResource(d.id))
    : [];
  return (
    <main className="page workspace-page">
      <div className="workspace-hero">
        <Tag>PRIVATE · {staff ? "STAFF CONTENT" : "MEMBER TRAINING"}</Tag>
        <h1 tabIndex={-1}>
          {staff ? "Your content library." : "Your assigned training."}
        </h1>
        <p>
          {staff
            ? "Review the resources your account can manage. Protected content is kept out of the public demo."
            : "Open your private workspace to follow the workouts approved for your account."}
        </p>
      </div>
      {staff ? (
        <>
          <a href="#coach" className="button">
            Upload & manage content <FileUp size={18} />
          </a>
          <button
            className="button secondary"
            disabled={shared.checking}
            onClick={() => {
              setSelected(null);
              void shared.refresh();
            }}
          >
            {shared.checking ? "Refreshing…" : "Refresh content library"}
          </button>
          {shared.error && (
            <p role="alert" className="form-error">
              {shared.error}
            </p>
          )}
          <div className="view-grid">
            {resources.map((d) => (
              <article className="panel workspace-section" key={d.id}>
                <Tag>
                  {d.visibility === "member_only"
                    ? "PROTECTED · STAFF REVIEW"
                    : "PUBLIC DEMO SAMPLE"}
                </Tag>
                <h2>{d.title}</h2>
                <p>
                  {d.ages.join(", ")} · {d.minutes} planned minutes
                </p>
                <button
                  className="button secondary"
                  onClick={() => setSelected(d)}
                >
                  Preview {d.title}
                </button>
              </article>
            ))}
          </div>
          {!shared.libraryReady && (
            <p role="status">Loading accessible resources…</p>
          )}
          {shared.libraryReady && !resources.length && (
            <Notice>
              No accessible training resources yet. Add an original sample in
              the content studio.
            </Notice>
          )}
        </>
      ) : (
        <section className="panel membership-lock">
          <LockKeyhole size={32} />
          <h2>Continue in your private workspace.</h2>
          <p>
            Owner-approved training is available through your workspace when a
            matching workout has been assigned. Choose the family athlete first
            to see their eligible practice.
          </p>
          <a className="button" href="#workspace">
            {shared.role === "parent" ? "Open My family" : "Open My training"}{" "}
            <ArrowRight size={17} />
          </a>
          <p>
            Packages and payments are not active. Assigned access does not
            charge you or start a subscription. If no workout appears, contact
            the team about your training access.
          </p>
          <a className="text-button" href="#contact">
            Contact the team
          </a>
        </section>
      )}
      {selected && staff && shared.canEditResource(selected.id) && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          {selected.assetId && <AssetPreview drill={selected} />}
          <ol>
            {selected.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <Notice>Illustrative training pending qualified review.</Notice>
        </Modal>
      )}
    </main>
  );
}
export function LaunchReadiness({ shared }: { shared?: SharedState }) {
  if (!isStaff(shared?.role || null))
    return <Gate title="Staff access is required." />;
  return (
    <main className="page workspace-page">
      <div className="workspace-hero">
        <Tag>PRIVATE STAFF SPACE · LAUNCH READINESS</Tag>
        <h1 tabIndex={-1}>A clear path to opening day.</h1>
        <p>
          The views are connected. These launch requirements remain open; no
          checkout, prices or junior enrollment are activated here.
        </p>
      </div>
      <div className="view-grid">
        {[
          [
            "Packages",
            "Packages being finalized · billing inactive",
            "The four proposed packages are priced in USD per athlete. One guardian account can manage multiple athletes. Each subscribed Elite athlete would have two monthly reviews, with up to three minutes of footage per review and a target of three business days, not guaranteed. Billing periods, rollover, refunds, storage and retention remain undecided; no payments or review credits are active. Grouped reviews require separate migration and release verification before activation.",
          ],
          [
            "Recurring billing",
            "Not connected",
            "Connect a payment provider, test renewals, cancellation, failed payments and paid entitlements.",
          ],
          [
            "Junior access",
            "Closed pending review",
            "Complete verified parental consent, privacy, support and age-transition workflows before real child access.",
          ],
          [
            "Content review",
            "Qualified review required",
            "Review age suitability, coaching instructions, media rights and physical-device video playback.",
          ],
          [
            "Invitation and recovery email",
            "Delivery acceptance required",
            "Configure the dedicated sender securely, then verify invitation, expired-link recovery and password reset on both actual phones. A contact Gmail link does not configure automatic email.",
          ],
          [
            "Phone acceptance",
            "Actual devices required",
            "Verify installation/update, sign-in, selected-athlete persistence, camera/library video, private playback, review return and interrupted uploads. Browser and simulator checks are separate evidence.",
          ],
          [
            "Family workout scope",
            "Per-athlete draft · migration pending",
            "The review branch supports separate sibling plans with eligibility checked for each athlete. Migration 012 and the updated website/app need release review before this becomes available live. Existing defaults and parent controls are preserved.",
          ],
          [
            "Sunday release schedule",
            "Not activated",
            "Choose the business time zone and Sunday release time. The schedule preview handles clock changes but does not approve, publish or assign training.",
          ],
        ].map(([title, status, body]) => (
          <section className="panel workspace-section" key={title}>
            <ClipboardCheck size={24} />
            <h2>{title}</h2>
            <Tag>{status}</Tag>
            <p>{body}</p>
          </section>
        ))}
      </div>
      {shared?.role === "owner" && shared.session?.user.id && (
        <ReleaseSchedulePreview
          key={shared.session.user.id}
          userId={shared.session.user.id}
        />
      )}
      <a href="#workspace" className="button secondary">
        Back to overview
      </a>
    </main>
  );
}

export function StaffSettingsWorkspace({ shared }: { shared: SharedState }) {
  if (!shared.signedIn || !shared.accessReady || shared.accessError)
    return <MemberAccountPage shared={shared} />;
  if (!isStaff(shared.role))
    return (
      <PrivateAccessMessage signedIn title="Staff access is required.">
        Personal settings are in Account.
      </PrivateAccessMessage>
    );
  if (shared.role === "owner") return <AccessWorkspace shared={shared} />;
  return (
    <main className="page staff-workflow">
      <header className="workflow-intro">
        <div>
          <Tag>STAFF & SETTINGS</Tag>
          <h1 tabIndex={-1}>Your staff settings.</h1>
          <p>
            Your role and daily tools are already connected. An Owner manages
            staff invitations, account roles and platform permissions.
          </p>
        </div>
      </header>
      <div className="workflow-bank">
        <a className="workflow-bank-row" href="#staff-delivery">
          <span>
            <strong>Delivery checks</strong>
            <small>
              Expected training and staff alert status in your scope
            </small>
          </span>
          <ArrowRight size={18} />
        </a>
        <a className="workflow-bank-row" href="#account">
          <span>
            <strong>Personal account</strong>
            <small>Password, sign out and privacy preferences</small>
          </span>
          <ArrowRight size={18} />
        </a>
        <a className="workflow-bank-row" href="#contact">
          <span>
            <strong>Get help</strong>
            <small>Contact Repformed about your access</small>
          </span>
          <ArrowRight size={18} />
        </a>
      </div>
    </main>
  );
}
