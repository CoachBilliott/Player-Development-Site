import { useState, type ComponentProps } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  FileUp,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Tag, Notice, Modal, AssetPreview } from "./components";
import { ROLE_LABELS, type AccountRole, isStaff } from "./roles";
import { PREVIEW_VIEWS, VIEW_LABELS, type PreviewView } from "./views";
import type { SharedState } from "./useSharedContent";
import { MemberAccountPage } from "./MemberAccount";
import { AccountAccess } from "./AccountAccess";
import { FamilyDemo } from "./FamilyDemo";
import { Admin } from "./Admin";
import type { Drill } from "./model";

const descriptions: Record<PreviewView, string> = {
  owner:
    "Run the platform. Manage staff access and review content, with launch settings in one place.",
  manager:
    "Keep training content organized and ready. Manage resources across the coaching team.",
  coach:
    "Build clear practices. Upload, preview and maintain your own resources.",
  parent:
    "One family roster. Separate training, permissions and parent review for every athlete.",
  athlete:
    "Your own training space. Follow your session and keep an honest practice history.",
  junior:
    "A simpler screen for younger athletes. One next practice, with their parent in control.",
};
export function DemoHub() {
  return (
    <main className="page view-hub">
      <div className="workspace-hero">
        <Tag>FICTIONAL DEMO · NO SIGN-IN</Tag>
        <h1 tabIndex={-1}>
          One platform.
          <br />
          <span className="electric-text">A space for everyone.</span>
        </h1>
        <p>
          Take a look from each side. These are working sample views, with
          fictional people and browser-only demo changes.
        </p>
        <div className="actions">
          <a className="button" href="#onboarding">
            Try a guided workout <ArrowRight size={18} />
          </a>
          <a className="button secondary" href="#home">
            See the public website
          </a>
        </div>
      </div>
      <div className="view-grid">
        {PREVIEW_VIEWS.map((view, i) => (
          <a
            className={`view-card view-${view}`}
            href={`#demo-${view}`}
            key={view}
          >
            <span className="view-number">0{i + 1}</span>
            <h2>{VIEW_LABELS[view]}</h2>
            <p>{descriptions[view]}</p>
            <span className="view-open">
              Open sample view <ArrowRight size={18} />
            </span>
          </a>
        ))}
      </div>
      <Notice>
        Previewing Owner or Manager here does not grant real permissions. Sign
        in to open your actual workspace. Real junior enrollment, subscriptions
        and payments remain closed.
      </Notice>
    </main>
  );
}
function PreviewBar({ view }: { view: PreviewView }) {
  return (
    <div className="page preview-bar">
      <a href="#demo">← All demo views</a>
      <span>
        <ShieldCheck size={16} />
        Fictional {VIEW_LABELS[view]} preview · local changes only
      </span>
      <a href="#workspace">
        Open my real workspace <ArrowRight size={15} />
      </a>
    </div>
  );
}
function WorkspaceLink({
  href,
  title,
  children,
  icon = "content",
}: {
  href: string;
  title: string;
  children: React.ReactNode;
  icon?: "content" | "access" | "library";
}) {
  const Icon =
    icon === "access" ? Users : icon === "library" ? BookOpen : FileUp;
  return (
    <a href={href} className="workspace-action">
      <Icon size={25} />
      <h2>{title}</h2>
      <p>{children}</p>
      <span>
        Open <ArrowRight size={17} />
      </span>
    </a>
  );
}
function StaffDashboard({
  role,
  resources,
  demo = false,
  pending = false,
}: {
  role: "owner" | "manager" | "coach";
  resources: Drill[];
  demo?: boolean;
  pending?: boolean;
}) {
  const root = demo ? "#demo-coach" : "#coach";
  return (
    <main className={`page workspace-page workspace-${role}`}>
      <div className="workspace-hero">
        <Tag>
          {demo ? "FICTIONAL PREVIEW" : "PRIVATE WORKSPACE"} ·{" "}
          {ROLE_LABELS[role]}
        </Tag>
        <h1 tabIndex={-1}>
          {role === "owner"
            ? "Your platform. Your playbook."
            : role === "manager"
              ? "Keep the team moving."
              : "Build the next great practice."}
        </h1>
        <p>{descriptions[role]}</p>
        <div className="actions">
          <a className="button" href={root}>
            Upload a workout <FileUp size={18} />
          </a>
          {!demo && (
            <a className="button secondary" href="#account">
              Account settings & sign-out
            </a>
          )}
        </div>
      </div>
      <div className="workspace-metrics">
        <div>
          <strong>{pending ? "…" : resources.length}</strong>
          <span>
            {demo
              ? "Local demo resources"
              : role === "coach"
                ? "Your training resources"
                : "Accessible training resources"}
          </span>
        </div>
        <div>
          <strong>
            {pending
              ? "…"
              : resources.filter((d) => d.visibility === "member_only").length}
          </strong>
          <span>Protected for staff review</span>
        </div>
        <div>
          <strong>Not active</strong>
          <span>Subscriptions & payments</span>
        </div>
      </div>
      <div className="workspace-actions">
        <WorkspaceLink
          href={root}
          title={
            role === "coach" ? "Your content studio" : "Upload & manage content"
          }
        >
          Choose a file, add instructions and audience, then preview before
          publishing.
        </WorkspaceLink>
        {role === "owner" ? (
          <WorkspaceLink
            href={demo ? "#demo-owner-access" : "#access"}
            title="Staff & account access"
            icon="access"
          >
            Assign the five account levels. Family data stays private, including
            from staff.
          </WorkspaceLink>
        ) : (
          <WorkspaceLink
            href={demo ? "#demo-coach" : "#member-library"}
            title={
              role === "manager"
                ? "Team content library"
                : "Your content library"
            }
            icon="library"
          >
            {role === "manager"
              ? "Review resources across the team."
              : "Edit your own resources and keep instructions up to date."}
          </WorkspaceLink>
        )}
        <WorkspaceLink
          href={demo ? "#demo-launch" : "#launch"}
          title="Launch readiness"
          icon="library"
        >
          See what is still needed for packages, payments, reviewed training and
          junior enrollment.
        </WorkspaceLink>
      </div>
      <section className="panel workspace-section">
        <h2>
          {role === "coach" ? "Your publishing checklist" : "Content overview"}
        </h2>
        <p>
          New uploads default to protected staff review. Choose Public demo
          sample only for content you intend to share for free.
        </p>
        <ol className="workspace-checklist">
          <li>
            <Check size={18} /> Choose original or licensed sample media.
          </li>
          <li>
            <Check size={18} /> Match age, position, experience and skill.
          </li>
          <li>
            <Check size={18} /> Check visibility and preview before publishing.
          </li>
        </ol>
        <p className="member-fineprint">
          No revenue figures, member totals or coaching outcomes are invented.
          Counts above come from the resources this view can access.
        </p>
      </section>
      {demo && (
        <Notice>
          This is a fictional role preview, not a staff login. It uses the same
          local practice editor as the public upload demo. Real permissions are
          enforced by the backend.
        </Notice>
      )}
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
          Your account level controls your workspace. A demo role selector
          cannot grant real access.
        </p>
        <div className="actions">
          <a className="button" href="#account">
            Member sign-in <ArrowRight size={18} />
          </a>
          <a className="button secondary" href="#demo">
            Explore the demo views
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
        resources={shared.resources.filter((d) => shared.canEditResource(d.id))}
        pending={!shared.libraryReady}
      />
    );
  return <MemberAccountPage shared={shared} workspace />;
}
export function AccessWorkspace({ shared }: { shared: SharedState }) {
  if (shared.role !== "owner")
    return <Gate title="Owner access is required." />;
  return (
    <main className="page workspace-page">
      <div className="workspace-hero">
        <Tag>PRIVATE · OWNER</Tag>
        <h1 tabIndex={-1}>The right access. For every role.</h1>
        <p>
          Assign levels to verified existing adult accounts. Staff access does
          not unlock private family profiles.
        </p>
      </div>
      <AccountAccess shared={shared} />
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
          {staff ? "Your content library." : "Your package. Your training."}
        </h1>
        <p>
          {staff
            ? "Review the resources your account can manage. Protected content is kept out of the public demo."
            : "This space will contain the training included in your active package."}
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
          <h2>Memberships are not active yet.</h2>
          <p>
            No package has been activated and no payment is being taken.
            Protected workouts stay unavailable until package access and billing
            are connected.
          </p>
          <a className="button secondary" href="#demo">
            Try the free sample demo <ArrowRight size={17} />
          </a>
          <p>
            Your private pilot sample practice remains available under My
            training or My family. Those illustrative activities are separate
            from paid content.
          </p>
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
export function LaunchReadiness({
  shared,
  demo = false,
}: {
  shared?: SharedState;
  demo?: boolean;
}) {
  if (!demo && !isStaff(shared?.role || null))
    return <Gate title="Staff access is required." />;
  return (
    <main className="page workspace-page">
      <div className="workspace-hero">
        <Tag>
          {demo ? "FICTIONAL PREVIEW" : "PRIVATE STAFF SPACE"} · LAUNCH
          READINESS
        </Tag>
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
            "Awaiting your decisions",
            "Define included training and access for each package. There are no final prices or allowances.",
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
        ].map(([title, status, body]) => (
          <section className="panel workspace-section" key={title}>
            <ClipboardCheck size={24} />
            <h2>{title}</h2>
            <Tag>{status}</Tag>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <a href={demo ? "#demo" : "#workspace"} className="button secondary">
        Back to overview
      </a>
    </main>
  );
}
function DemoAccess() {
  const [roles, setRoles] = useState(["owner", "manager", "coach"]);
  const [pending, setPending] = useState<{ i: number; role: string } | null>(
    null,
  );
  return (
    <main className="page workspace-page">
      <div className="workspace-hero">
        <Tag>FICTIONAL OWNER PREVIEW</Tag>
        <h1 tabIndex={-1}>Staff access, without the guesswork.</h1>
        <p>
          Try a role change using fictional adults. Changes stay in this screen
          and reset on refresh. This never changes real accounts.
        </p>
      </div>
      <section className="panel workspace-section">
        <h2>Sample team</h2>
        {["Taylor · Owner", "Riley · Manager", "Drew · Coach"].map(
          (name, i) => (
            <div className="demo-access-row" key={name}>
              <strong>{name.split(" · ")[0]}</strong>
              <label>
                Account level for {name.split(" · ")[0]}
                <select
                  value={roles[i]}
                  disabled={i === 0}
                  onChange={(e) => setPending({ i, role: e.target.value })}
                >
                  {["owner", "manager", "coach", "parent", "athlete"].map(
                    (role) => (
                      <option value={role} key={role}>
                        {ROLE_LABELS[role as AccountRole]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              {i === 0 && <small>Your own Owner access is protected.</small>}
            </div>
          ),
        )}
      </section>
      {pending && (
        <Modal
          title="Confirm fictional role change"
          onClose={() => setPending(null)}
        >
          <p>
            This demonstrates an Owner confirmation. No real account will
            change.
          </p>
          <div className="actions">
            <button
              className="button"
              onClick={() => {
                setRoles((old) =>
                  old.map((r, i) => (i === pending.i ? pending.role : r)),
                );
                setPending(null);
              }}
            >
              Confirm demo change
            </button>
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Keep current role
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
type AdminProps = ComponentProps<typeof Admin>;
export function ViewPreview({
  view,
  editor,
}: {
  view: PreviewView;
  editor: AdminProps;
}) {
  return (
    <>
      <PreviewBar view={view} />
      {view === "parent" || view === "athlete" || view === "junior" ? (
        <FamilyDemo
          key={view}
          focused
          initialView={
            view === "parent"
              ? "parent"
              : view === "athlete"
                ? "individual"
                : "athlete"
          }
        />
      ) : view === "coach" ? (
        <Admin {...editor} />
      ) : (
        <StaffDashboard role={view} resources={editor.resources || []} demo />
      )}
    </>
  );
}
export function OwnerAccessPreview() {
  return (
    <>
      <PreviewBar view="owner" />
      <DemoAccess />
    </>
  );
}
