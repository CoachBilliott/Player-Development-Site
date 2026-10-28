import { useState, type ComponentProps } from "react";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { Admin } from "./Admin";
import { Notice } from "./components";
import type { SharedState } from "./useSharedContent";
import { ROLE_LABELS } from "./roles";
import { PrivateAccessMessage } from "./PrivateShell";
import { MemberAccountPage } from "./MemberAccount";

type Props = ComponentProps<typeof Admin> & { shared: SharedState };
export function ContentStudio({ shared, ...local }: Props) {
  const [selectedScope, setScope] = useState<"local" | "shared" | null>(null);
  const scope = selectedScope ?? "shared";
  const [nextScope, setNextScope] = useState<"local" | "shared" | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  if (shared.signedIn && (!shared.accessReady || shared.accessError))
    return <MemberAccountPage shared={shared} />;
  if (shared.loading && selectedScope === null)
    return (
      <main className="page narrow">
        <h1 tabIndex={-1}>Upload a lesson.</h1>
        <p role="status">Opening your upload space…</p>
      </main>
    );
  return (
    <>
      {shared.coach && (
        <div className="page narrow publishing-mode">
          <details className="publishing-settings">
            <summary>Publishing options</summary>
            <div
              className="scene-tabs"
              role="group"
              aria-label="Publishing destination"
            >
              <button
                disabled={editorBusy}
                aria-pressed={scope === "shared"}
                onClick={() => {
                  if (scope !== "shared") setNextScope("shared");
                }}
              >
                Shared website
              </button>
              <button
                disabled={editorBusy}
                aria-pressed={scope === "local"}
                onClick={() => {
                  if (scope !== "local") setNextScope("local");
                }}
              >
                This browser
              </button>
            </div>
            <p className="upload-destination" role="status">
              {scope === "shared"
                ? "Staff publishing: protected training by default. Free demo samples are a separate choice."
                : "Practice mode: uploads stay in this browser. Your partner will not see them."}
            </p>
            <div className="page narrow shared-toolbar">
              <span>
                <LockKeyhole size={16} />{" "}
                {shared.role ? ROLE_LABELS[shared.role] : "Staff"} · shared
                website
              </span>
              <div className="actions">
                <button
                  className="button secondary"
                  disabled={shared.checking || editorBusy}
                  onClick={() => void shared.refresh()}
                >
                  <RefreshCw size={16} />
                  Refresh shared library
                </button>
              </div>
            </div>
          </details>
          {shared.error && (
            <p className="form-error" role="alert">
              {shared.error}
            </p>
          )}
          {shared.message && <p role="status">{shared.message}</p>}

          {nextScope && (
            <div
              className="discard-box"
              role="group"
              aria-label="Confirm publishing destination"
            >
              <p>
                Switch publishing destination? Unsaved resource drafts will be
                discarded. Explicitly saved device drafts and published
                resources stay saved.
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
      )}
      {scope === "local" && shared.coach ? (
        <Admin
          key={`local-${shared.session?.user.id}`}
          {...local}
          onBusyChange={setEditorBusy}
        />
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
            The staff content service could not be connected. Upload tools
            require an authorized staff account. Reconnect the service before
            publishing; the customer training demo stays available separately.
          </Notice>
          {shared.error && (
            <p className="form-error" role="alert">
              {shared.error}
            </p>
          )}
        </main>
      ) : !shared.coach ? (
        <PrivateAccessMessage
          signedIn={shared.signedIn}
          title={
            shared.signedIn
              ? "Staff content access required."
              : "Log in to open the content studio."
          }
        >
          {shared.signedIn
            ? "Your account does not have publishing access. An Owner can assign staff roles; signing in again will not change your permissions."
            : "Use your Repformed account. Owners, Managers and Coaches use the same login as everyone else."}
        </PrivateAccessMessage>
      ) : (
        <>
          <Admin
            key={`shared-${shared.session?.user.id}`}
            scope="shared"
            uploadProgress={shared.uploadProgress}
            draftOwnerId={shared.session?.user.id}
            onBusyChange={setEditorBusy}
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
