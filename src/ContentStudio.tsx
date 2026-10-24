import { useState, type ComponentProps } from "react";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { Admin } from "./Admin";
import { Notice } from "./components";
import type { SharedState } from "./useSharedContent";
import { ROLE_LABELS } from "./roles";

type Props = ComponentProps<typeof Admin> & { shared: SharedState };
export function ContentStudio({ shared, ...local }: Props) {
  const [scope, setScope] = useState<"local" | "shared">("local");
  const [nextScope, setNextScope] = useState<"local" | "shared" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <div className="page narrow publishing-mode">
        <div
          className="scene-tabs"
          role="group"
          aria-label="Publishing destination"
        >
          <button
            aria-pressed={scope === "local"}
            onClick={() => {
              if (scope !== "local") setNextScope("local");
            }}
          >
            This browser
          </button>
          <button
            aria-pressed={scope === "shared"}
            onClick={() => {
              if (scope !== "shared") setNextScope("shared");
            }}
          >
            Shared website
          </button>
        </div>
        {nextScope && (
          <div
            className="discard-box"
            role="group"
            aria-label="Confirm publishing destination"
          >
            <p>
              Switch publishing destination? Unsaved resource drafts will be
              discarded. Published resources stay saved.
            </p>
            <div className="actions">
              <button
                className="button"
                onClick={() => {
                  setScope(nextScope);
                  setNextScope(null);
                }}
              >
                Switch destination
              </button>
              <button
                className="button secondary"
                onClick={() => setNextScope(null)}
              >
                Keep editing
              </button>
            </div>
          </div>
        )}
      </div>
      {scope === "local" ? (
        <Admin key="local" {...local} />
      ) : !shared.configured ? (
        <main className="page narrow">
          <div className="page-intro">
            <h1 tabIndex={-1}>Shared publishing needs setup.</h1>
            <p>
              The website is live. Sharing uploaded resources across devices
              requires a coach login and connected storage.
            </p>
          </div>
          <Notice>
            No shared service is connected yet. The “This browser” editor works
            now, but its files and edits stay on this device. The project owner
            must finish the separate shared-publishing setup before this
            destination can accept uploads.
          </Notice>
          {shared.error && (
            <p className="form-error" role="alert">
              {shared.error}
            </p>
          )}
        </main>
      ) : !shared.coach ? (
        <main className="page narrow">
          <div className="page-intro">
            <LockKeyhole size={26} />
            <h1 tabIndex={-1}>Coach sign-in</h1>
            <p>
              Approved adult coaches can upload and edit shared sample
              resources. Visitors do not need to sign in to try the demo.
            </p>
          </div>
          <form
            className="panel studio"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              void shared
                .signIn(email, password)
                .then(() => setPassword(""))
                .catch((e: Error) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Coach email
              <input
                type="email"
                autoComplete="username"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to publish"}
            </button>
            {(error || shared.error) && (
              <p className="form-error" role="alert">
                {error || shared.error}
              </p>
            )}
            <p>
              Accounts are provisioned by the project owner. This is not player
              registration.
            </p>
          </form>
          {shared.signedIn && (
            <button
              className="text-button"
              onClick={() =>
                void shared.signOut().catch((e: Error) => setError(e.message))
              }
            >
              Sign out
            </button>
          )}
        </main>
      ) : (
        <>
          <div className="page narrow shared-toolbar">
            <span>
              <LockKeyhole size={16} />{" "}
              {shared.role ? ROLE_LABELS[shared.role] : "Staff"} · shared
              website
            </span>
            <div className="actions">
              <button
                className="button secondary"
                disabled={shared.checking}
                onClick={() => void shared.refresh()}
              >
                <RefreshCw size={16} />
                Refresh shared library
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void shared
                    .signOut()
                    .catch((e: Error) => setError(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                Sign out
              </button>
            </div>
            {(shared.error || error) && (
              <p className="form-error" role="alert">
                {shared.error || error}
              </p>
            )}
            {shared.message && <p role="status">{shared.message}</p>}
          </div>
          <Admin
            key="shared"
            scope="shared"
            onPublish={shared.publish}
            onUpdate={shared.update}
            onRemove={shared.remove}
            resources={shared.resources.filter((drill) =>
              shared.canEditResource(drill.id),
            )}
            lockedIds={local.lockedIds}
          />
        </>
      )}
    </>
  );
}
