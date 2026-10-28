import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccountLifecycle,
  type PendingInvitation,
  type AccountClosureState,
} from "./accountLifecycle";
import { AccountClosure } from "./AccountClosure";
import { Notice, Tag } from "./components";
import { ROLE_LABELS } from "./roles";
import type { SharedState } from "./useSharedContent";

export function AccountInvitationGate({
  shared,
  children,
  enforce = true,
}: {
  shared: SharedState;
  children: ReactNode;
  enforce?: boolean;
}) {
  const client = shared.service?.client,
    id = shared.session?.user.id;
  const recovery =
    new URL(window.location.href).searchParams.get("flow") === "recovery";
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [checked, setChecked] = useState(false),
    [invite, setInvite] = useState<PendingInvitation | null>(null);
  const [checkedFor, setCheckedFor] = useState("");
  const [closure, setClosure] = useState<AccountClosureState | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [adult, setAdult] = useState(false),
    [privacy, setPrivacy] = useState(false);
  const [retry, setRetry] = useState(0),
    lock = useRef(false);
  useEffect(() => {
    if (
      !client ||
      !id ||
      !shared.accountLifecycleEnabled ||
      recovery ||
      !enforce
    )
      return;
    let stopped = false;
    const service = new AccountLifecycle(client);
    void (async () => {
      const verified = await client.auth.getUser();
      if (verified.error || verified.data.user?.id !== id)
        throw new Error(
          "Your sign-in could not be verified. Reconnect, or sign out and sign in again.",
        );
      return Promise.all([service.pending(), service.closure()]);
    })()
      .then(([result, closing]) => {
        if (!stopped) {
          setInvite(result);
          setClosure(closing);
          setCheckedFor(id);
          setCheckedAt(Date.now());
          setChecked(true);
          setError("");
        }
      })
      .catch((failure: Error) => {
        if (!stopped) {
          setError(
            failure.message ||
              "Invitation access could not be verified. Reconnect and retry.",
          );
          setChecked(false);
        }
      });
    return () => {
      stopped = true;
    };
  }, [
    client,
    id,
    shared.accountLifecycleEnabled,
    shared.role,
    recovery,
    retry,
    enforce,
  ]);
  if (!client || !id || !shared.accountLifecycleEnabled || recovery || !enforce)
    return children;
  const ready = checked && checkedFor === id;
  if (ready && closure && ["cleaning", "failed"].includes(closure.state))
    return (
      <main className="page narrow member-page">
        <Tag>ACCOUNT DELETION</Tag>
        <h1 tabIndex={-1}>Finish your account deletion.</h1>
        <p>
          Cleanup has started. Account access is paused until this request
          finishes; creating new profiles will not restart the account.
        </p>
        <AccountClosure key={id} shared={shared} />
        <button
          className="button secondary"
          onClick={() =>
            void shared
              .signOut()
              .catch(() =>
                setError("Sign-out was not confirmed. Retry online."),
              )
          }
        >
          Sign out
        </button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </main>
    );
  if (ready && !invite) return children;
  const service = new AccountLifecycle(client);
  const active =
    invite?.state === "sent" &&
    new Date(invite.expires_at).getTime() > checkedAt;
  return (
    <main className="page narrow member-page">
      <Tag>PRIVATE ACCOUNT ACCESS</Tag>
      <h1 tabIndex={-1}>
        {!ready
          ? "Checking your account…"
          : active
            ? "Welcome to Repformed."
            : "Your invitation is not active."}
      </h1>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!ready ? (
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry account check
          </button>
          <button
            className="button secondary"
            onClick={() =>
              void shared
                .signOut()
                .catch(() =>
                  setError("Sign-out was not confirmed. Retry online."),
                )
            }
          >
            Sign out and return to login
          </button>
        </div>
      ) : active && invite ? (
        <section className="panel member-panel">
          <h2>Your invited level: {ROLE_LABELS[invite.intended_role]}</h2>
          <p>
            Signed in as{" "}
            <strong className="lifecycle-email">
              {shared.session?.user.email}
            </strong>
            . Finish this adult pilot setup to activate the level selected by
            your Owner. Staff do not choose Parent or Athlete for their
            management account.
          </p>
          <details>
            <summary>Pilot privacy and access</summary>
            <p>
              Supabase stores your email and login credentials. Private account
              data can include player nicknames, age bands, football
              preferences, practice reports and optional private adult video
              reviews. Family access and assigned-coach feedback are
              permission-controlled. Public profiles, direct messaging, payments
              and real junior access are not active. Customer account deletion
              includes the login and owned media/data; staff and
              guardian-managed closure requires an ownership/consent review.
              Provider backup retention and the final public-launch
              privacy/support policies remain separate requirements.
            </p>
          </details>
          <form
            className="member-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!adult || !privacy || lock.current) return;
              lock.current = true;
              setBusy(true);
              setError("");
              void service
                .accept(invite.id)
                .then(async () => {
                  await shared.refreshAccess();
                  setInvite(null);
                  window.location.hash = "workspace";
                })
                .catch((e: Error) => setError(e.message))
                .finally(() => {
                  lock.current = false;
                  setBusy(false);
                });
            }}
          >
            <fieldset disabled={busy}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                />
                I am 18 or older. I will use approved adult pilot accounts and
                no real children’s information.
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                />
                I read the pilot privacy and access information and accept this
                invited account level.
              </label>
              <button className="button" disabled={!adult || !privacy || busy}>
                {busy
                  ? "Activating your account…"
                  : "Accept invitation & open my account"}
              </button>
            </fieldset>
          </form>
          <p className="member-fineprint">
            Set your own password using the invitation email’s password screen.
            If you still need to choose one, use the button below.
          </p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set("flow", "recovery");
              url.hash = "account";
              window.location.assign(url);
            }}
          >
            Choose my Repformed password
          </button>
        </section>
      ) : (
        <Notice>
          This invitation is cancelled, expired or delivery is unfinished. Ask
          an Owner to check it. An old email link cannot activate a cancelled
          invitation. TestFlight testing access is separate from your Player
          Development account.
        </Notice>
      )}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() =>
          void shared
            .signOut()
            .catch(() => setError("Sign-out was not confirmed. Retry online."))
        }
      >
        Sign out of this invitation
      </button>
      {ready && <AccountClosure key={id} shared={shared} />}
    </main>
  );
}
