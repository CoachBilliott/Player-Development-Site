import { ArrowRight, KeyRound, LogOut, Users } from "lucide-react";
import { AccountAccess } from "./AccountAccess";
import { AccountClosure } from "./AccountClosure";
import { Tag } from "./components";
import { isStaff } from "./roles";
import { appSurface } from "./mobile";
import type { SharedState } from "./useSharedContent";

export function PersonalSettings({
  shared,
  busy,
  error,
  message,
  onChangePassword,
  onSignOut,
}: {
  shared: SharedState;
  busy: boolean;
  error: string;
  message?: string;
  onChangePassword: () => void;
  onSignOut: () => void;
}) {
  const staff = isStaff(shared.role);
  return (
    <main className="page personal-settings">
      <div className="page-intro">
        <Tag>YOUR ACCOUNT</Tag>
        <h1 tabIndex={-1}>Account settings.</h1>
        <p>Your sign-in, privacy and account preferences.</p>
      </div>
      {message && (
        <p role="status" className="member-feedback">
          {message}
        </p>
      )}
      {shared.accountNotice && (
        <p role="status" className="member-feedback">
          {shared.accountNotice}
        </p>
      )}
      <section className="panel member-panel">
        <div className="account-summary-row">
          <div>
            <h2>Signed in</h2>
            <p className="staff-account-email">{shared.session?.user.email}</p>
          </div>
          <a className="text-button" href="#workspace">
            Back to dashboard <ArrowRight size={17} />
          </a>
        </div>
      </section>
      <AccountAccess shared={shared} />
      {!staff && (
        <section className="panel member-panel">
          <h2>
            {shared.role === "parent" ? "Family profiles" : "Athlete profile"}
          </h2>
          <div className="settings-links">
            <a href="#profiles">
              <span>
                <Users size={18} />{" "}
                {shared.role === "parent"
                  ? "Manage athletes & permissions"
                  : "Manage your profile"}
                <small>
                  Profile details and training permissions are separate from
                  your sign-in settings.
                </small>
              </span>
              <ArrowRight size={19} />
            </a>
          </div>
        </section>
      )}
      <section className="panel member-panel">
        <h2>Sign-in & security</h2>
        <div className="actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={onChangePassword}
          >
            <KeyRound size={17} /> Change password
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={onSignOut}
          >
            <LogOut size={17} />
            {appSurface() ? "Sign out" : "Sign out of this browser"}
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <p className="member-fineprint">
          Sign out before handing a shared device to someone else.
        </p>
      </section>
      <div className="settings-links">
        <a href={`${import.meta.env.BASE_URL}account-help.html`}>
          <span>
            Account & privacy help
            <small>
              How private profiles, media and account requests are handled.
            </small>
          </span>
          <ArrowRight size={18} />
        </a>
      </div>
      {shared.accountLifecycleEnabled && (
        <details className="account-danger">
          <summary>Manage account closure</summary>
          <AccountClosure key={shared.session?.user.id} shared={shared} />
        </details>
      )}
    </main>
  );
}
