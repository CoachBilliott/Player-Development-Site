import { useEffect, useRef, useState } from "react";
import { Modal, Notice } from "./components";
import {
  AccountLifecycle,
  closureReason,
  type AccountClosureState,
} from "./accountLifecycle";
import type { SharedState } from "./useSharedContent";

export function AccountClosure({ shared }: { shared: SharedState }) {
  const client = shared.service?.client,
    user = shared.session?.user;
  const userId = user?.id;
  const [state, setState] = useState<AccountClosureState | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(""),
    [password, setPassword] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [deleted, setDeleted] = useState(false);
  const requestId = useRef<string>(crypto.randomUUID()),
    lock = useRef(false);
  useEffect(() => {
    if (!client || !userId || !shared.accountLifecycleEnabled) return;
    let stopped = false;
    void new AccountLifecycle(client)
      .closure()
      .then((value) => {
        if (!stopped) {
          setState(value);
          if (value.request_id) requestId.current = value.request_id;
        }
      })
      .catch(() => {
        if (!stopped)
          setError(
            "Deletion status could not be verified. Refresh before continuing.",
          );
      });
    return () => {
      stopped = true;
    };
  }, [client, userId, shared.accountLifecycleEnabled]);
  if (!client || !user || !shared.accountLifecycleEnabled) return null;
  const service = new AccountLifecycle(client);
  async function refresh() {
    const result = await service.closure();
    setState(result);
    if (result.request_id) requestId.current = result.request_id;
  }
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This deletion request was not confirmed.",
      );
      if (open) {
        try {
          await refresh();
        } catch {
          /* Keep the explicit failure and request ID. */
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const closing = state?.state === "cleaning" || state?.state === "failed";
  function close() {
    if (!busy) {
      setOpen(false);
      setPassword("");
      setConfirm("");
    }
  }
  return (
    <section
      className="panel member-panel lifecycle-tools"
      aria-labelledby="closure-heading"
    >
      <h2 id="closure-heading">Delete your account</h2>
      {deleted ? (
        <p role="status">
          Your login and customer account were deleted. Close this screen and
          sign out if any old session remains on this device.
        </p>
      ) : (
        <>
          <p>
            Customer deletion removes the email login, owned profiles, their
            practice history, saved practice, family links, assignments and
            private practice clips. It cannot be undone. Another person’s
            independent login or household is not deleted.
          </p>
          {state && !state.eligible && (
            <Notice>{closureReason(state.reason)}</Notice>
          )}
          {closing && (
            <Notice>
              Deletion is unfinished and access is paused. Some data may already
              have been removed. Retry this same request to finish cleanup;
              closing this dialog does not cancel deletion.
            </Notice>
          )}
          {message && <p role="status">{message}</p>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button secondary"
              disabled={busy || !state}
              onClick={() => {
                setError("");
                setPassword("");
                setConfirm("");
                setOpen(true);
              }}
            >
              {state?.eligible
                ? closing
                  ? "Continue account deletion"
                  : "Review account deletion"
                : "Request assisted account closure"}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void act(refresh)}
            >
              Refresh deletion status
            </button>
          </div>
          <details>
            <summary>What can remain after deletion?</summary>
            <p>
              Other households keep their own profiles and reports; your
              reporter identity is cleared when your login is removed. A minimal
              operational receipt keeps the request ID, status, counts and dates
              without your email. Provider backups, security records and copies
              someone already downloaded follow their applicable retention
              rules; this action does not erase those copies. Final
              public-launch retention and support policies still need review.
            </p>
          </details>
        </>
      )}
      {open && state && (
        <Modal
          title={
            state.eligible
              ? "Permanently delete this account?"
              : "Request an account closure review?"
          }
          onClose={close}
        >
          <p>
            <strong className="lifecycle-email">{user.email}</strong>
          </p>
          {state.eligible ? (
            <>
              <p>
                {state.profile_count} owned{" "}
                {state.profile_count === 1 ? "profile" : "profiles"} and{" "}
                {state.video_count} private{" "}
                {state.video_count === 1 ? "clip" : "clips"} are currently
                associated with this deletion. Your email login is removed after
                stored media and account data are cleaned. Other people’s
                accounts stay intact.
              </p>
              <Notice>
                Re-enter your current Player Development password, then type
                DELETE. Selecting the final button starts irreversible cleanup.
              </Notice>
            </>
          ) : (
            <p>
              {closureReason(state.reason)} This creates a request for an Owner
              to review. It does not delete data, cancel payments or transfer
              staff ownership.
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <form
            className="member-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (confirm !== "DELETE" || !state || lock.current) return;
              const currentPassword = password;
              setPassword("");
              void act(async () => {
                if (!state.eligible) {
                  const id = await service.requestHelp();
                  setMessage(
                    `Closure review requested. Reference: ${id}. Your account remains open until its review is complete.`,
                  );
                  setOpen(false);
                  await refresh();
                  return;
                }
                const result = await service.deleteAccount(
                  requestId.current,
                  user.id,
                  user.email || "",
                  currentPassword,
                );
                setDeleted(true);
                setOpen(false);
                setMessage(`Account deleted. Reference: ${result.requestId}.`);
                await shared.signOut();
                shared.setAccountNotice(
                  `Your Player Development login and customer account were deleted. Reference: ${result.requestId}.`,
                );
                window.location.hash = "account";
              });
            }}
          >
            <fieldset disabled={busy}>
              {state.eligible && (
                <label>
                  Current password to delete this account
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <label>
                Type DELETE to confirm this account action
                <input
                  autoComplete="off"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <div className="actions">
                <button
                  className="button danger"
                  disabled={
                    busy ||
                    confirm !== "DELETE" ||
                    (state.eligible && !password)
                  }
                >
                  {busy
                    ? "Processing account request…"
                    : state.eligible
                      ? "Delete my account permanently"
                      : "Confirm closure review request"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={close}
                >
                  {closing
                    ? "Close without cancelling deletion"
                    : "Keep my account"}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </section>
  );
}
