import { ArrowLeft, ArrowUpRight, CircleHelp } from "lucide-react";
import { Logo } from "./components";
import { isStaff, ROLE_LABELS, type AccountRole } from "./roles";
import { SocialLinks } from "./SocialLinks";
import type { SharedState } from "./useSharedContent";
import "./privateWorkspace.css";

function workspaceNavigation(
  role: AccountRole | null,
  interest: boolean,
): [string, string][] {
  if (isStaff(role))
    return [
      ["workspace", "Client service"],
      ["coach", "Content"],
      ["workout-builder", "Workouts"],
      ["video-reviews", "Reviews"],
      ...(role !== "coach" && interest
        ? [["interest", "Interest"] as [string, string]]
        : []),
      ...(role === "owner"
        ? [["access", "Team & access"] as [string, string]]
        : []),
      ["account", "Account"],
    ];
  return [
    ["workspace", "Today"],
    ["app-workouts", "Workouts"],
    ["app-progress", "Progress"],
    ["profiles", role === "parent" ? "Family profiles" : "Profile"],
    ["account", "Account"],
  ];
}
export function PrivateHeader({
  shared,
  page,
}: {
  shared: SharedState;
  page: string;
}) {
  const ready = shared.signedIn && shared.accessReady && !shared.accessError;
  const active = (route: string) =>
    route === page ||
    (route === "app-workouts" && page === "member-library") ||
    (route === "coach" && ["member-library", "content-review"].includes(page));
  return (
    <header className="private-header">
      <div className="private-header-top">
        <Logo href={ready ? "#workspace" : "#home"} />
        <div className="private-header-meta">
          {ready && shared.role && (
            <span className="private-role">{ROLE_LABELS[shared.role]}</span>
          )}
          <a href="#contact" aria-label="Account help" className="private-help">
            <CircleHelp size={19} />
            <span>Help</span>
          </a>
          <a href="#home" className="private-website">
            <ArrowUpRight size={16} />
            <span>Website</span>
          </a>
        </div>
      </div>
      {ready ? (
        <nav className="private-nav" aria-label="Workspace navigation">
          {workspaceNavigation(
            shared.role,
            Boolean(shared.interestEndpoint),
          ).map(([route, label]) => (
            <a
              key={route}
              href={`#${route}`}
              aria-current={active(route) ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      ) : (
        <div className="private-auth-back">
          <a href="#home">
            <ArrowLeft size={16} /> Back to website
          </a>
          <span>Repformed account access</span>
        </div>
      )}
    </header>
  );
}
export function PrivateFooter() {
  return (
    <footer className="private-footer">
      <nav aria-label="Account help and credits">
        <a href="#contact">Contact</a>
        <a href={`${import.meta.env.BASE_URL}account-help.html`}>
          Account & privacy help
        </a>
        <a href={`${import.meta.env.BASE_URL}credits.html`}>
          Credits & licenses
        </a>
      </nav>
      <SocialLinks compact />
      <small>© {new Date().getFullYear()} Repformed</small>
    </footer>
  );
}

export function PrivateAccessMessage({
  signedIn,
  title,
  children,
}: {
  signedIn: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="page narrow private-message">
      <span className="eyebrow">ACCOUNT ACCESS</span>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{children}</p>
      <a className="button" href={signedIn ? "#workspace" : "#account"}>
        {signedIn ? "Back to dashboard" : "Log in"}
        <ArrowUpRight size={17} />
      </a>
      <a href="#contact" className="text-button">
        Get account help
      </a>
    </main>
  );
}
