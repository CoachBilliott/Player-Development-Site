import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileUp,
  ShieldCheck,
  Video,
} from "lucide-react";
import { MemberAccountPage } from "./MemberAccount";
import { Tag } from "./components";
import { isStaff, ROLE_LABELS } from "./roles";
import type { SharedState } from "./useSharedContent";

/** The app's staff home keeps daily actions separate from website administration. */
export function MobileStaffHome({ shared }: { shared: SharedState }) {
  if (
    !shared.signedIn ||
    !shared.accessReady ||
    shared.accessError ||
    !isStaff(shared.role)
  )
    return <MemberAccountPage shared={shared} />;
  const role = shared.role as "owner" | "manager" | "coach";
  const resources = shared.resources.filter((d) =>
    shared.canEditResource(d.id),
  );
  return (
    <main className="page app-staff-home">
      <div className="app-home-heading">
        <Tag>{ROLE_LABELS[role]} WORKSPACE</Tag>
        <h1 tabIndex={-1}>
          {role === "owner"
            ? "Your platform. Your playbook."
            : role === "manager"
              ? "Keep the team moving."
              : "Build the next great practice."}
        </h1>
        <p>Good training starts with a clear plan.</p>
      </div>
      <section className="app-feature" aria-label="Create training">
        <img
          src={`${import.meta.env.BASE_URL}media/football-field.jpg`}
          alt=""
          width={1440}
          height={960}
        />
        <div className="app-feature-content">
          <span className="app-eyebrow">THE NEXT SESSION STARTS HERE</span>
          <h2>
            Build the plan.
            <br />
            Set the standard.
          </h2>
          <p>Pick your drills. Set the order. Preview the whole workout.</p>
          <a className="button full" href="#workout-builder">
            Build a workout <ArrowRight size={19} />
          </a>
        </div>
      </section>
      <a className="app-upload-action" href="#coach">
        <span className="app-tool-icon">
          <FileUp size={23} />
        </span>
        <span>
          <strong>Upload a drill</strong>
          <small>Choose a file, add instructions, publish.</small>
        </span>
        <ChevronRight size={20} />
      </a>
      <section className="app-tool-section" aria-labelledby="app-tools-heading">
        <div className="app-section-heading">
          <h2 id="app-tools-heading">Your tools</h2>
          <span>FOOTBALL</span>
        </div>
        <div className="app-tool-list">
          <a href="#member-library">
            <BookOpen size={22} />
            <span>
              <strong>Content bank</strong>
              <small>
                {shared.libraryReady
                  ? `${resources.length} accessible ${resources.length === 1 ? "drill" : "drills"}`
                  : "Loading your content…"}
              </small>
            </span>
            <ChevronRight size={18} />
          </a>
          <a href="#content-review">
            <ShieldCheck size={22} />
            <span>
              <strong>Drafts & approvals</strong>
              <small>Review content before players can see it.</small>
            </span>
            <ChevronRight size={18} />
          </a>
          <a href="#video-reviews">
            <Video size={22} />
            <span>
              <strong>
                {shared.serviceTrackingEnabled && role !== "coach"
                  ? "Service desk & reviews"
                  : "Video reviews"}
              </strong>
              <small>
                {shared.serviceTrackingEnabled && role !== "coach"
                  ? "Track requests, deadlines and delivery."
                  : "Watch submissions and send feedback."}
              </small>
            </span>
            <ChevronRight size={18} />
          </a>
          {role === "owner" && (
            <a href="#access">
              <ShieldCheck size={22} />
              <span>
                <strong>Accounts & training access</strong>
                <small>Manage roles, workouts and pilot access.</small>
              </span>
              <ChevronRight size={18} />
            </a>
          )}
        </div>
      </section>
      <details className="app-pilot-details">
        <summary>About this private pilot</summary>
        <p>
          Use original or licensed sample content and approved adult accounts.
          Training awaits qualified review. Payments and real junior enrollment
          remain closed.
        </p>
        {role === "owner" && (
          <a className="text-button" href="#launch">
            Launch readiness <ArrowRight size={16} />
          </a>
        )}
      </details>
    </main>
  );
}
