import { useEffect, useRef, useState } from "react";
import { MailPlus, RefreshCw } from "lucide-react";
import { Modal, Notice, Tag } from "./components";
import { ROLE_LABELS } from "./roles";
import {
  AccountLifecycle,
  type AccountInvitation,
  type ClosureHelpRequest,
  type InvitationRole,
} from "./accountLifecycle";
import type { SharedState } from "./useSharedContent";

const labels: Record<string, string> = {
  preparing: "Delivery not yet confirmed",
  sent: "Awaiting recipient",
  failed: "Email request failed",
  accepted: "Account activated",
  cancelled: "Cancelled",
  expired: "Expired",
};
const deliveryText = (state: string, code?: string) =>
  state === "cancelled"
    ? "Invitation cancelled. An email already in transit might still arrive, but it cannot activate the cancelled access."
    : code === "existing_account"
      ? "This verified account can sign in and accept its approved setup invitation. No new email was requested. Existing account password recovery remains available."
      : code === "mail_setup_required"
        ? "Email delivery needs Owner setup. Check the project's sending service before retrying. This invitation has not been confirmed sent."
        : code === "account_exists"
          ? "This person already has an account. Use Manage account access instead of inviting them again."
          : state === "sent"
            ? "The email service accepted the invitation request. Ask the recipient to check their inbox and spam folder; this is not proof of delivery or acceptance."
            : "Delivery has not been confirmed. Refresh invitations before retrying. Failed requests wait at least 60 seconds between retries.";
const date = (value: string) => new Date(value).toLocaleString();
export function OwnerAccountInvitations({ shared }: { shared: SharedState }) {
  const client = shared.service?.client;
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [rows, setRows] = useState<AccountInvitation[]>([]);
  const [requests, setRequests] = useState<ClosureHelpRequest[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("parent");
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false),
    [cancel, setCancel] = useState<AccountInvitation | null>(null);
  const requestId = useRef(crypto.randomUUID()),
    lock = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => setCheckedAt(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!client || !shared.accountLifecycleEnabled || shared.role !== "owner")
      return;
    let stopped = false;
    const service = new AccountLifecycle(client);
    void Promise.all([service.invitations(), service.helpRequests()])
      .then(([invitations, help]) => {
        if (!stopped) {
          setRows(invitations);
          setRequests(help);
          setReady(true);
        }
      })
      .catch(() => {
        if (!stopped)
          setError(
            "Invitations could not be loaded. Refresh before sending a new invitation.",
          );
      });
    return () => {
      stopped = true;
    };
  }, [client, shared.role, shared.accountLifecycleEnabled]);
  if (!client || !shared.accountLifecycleEnabled || shared.role !== "owner")
    return null;
  const service = new AccountLifecycle(client);
  async function refresh() {
    const [invitations, help] = await Promise.all([
      service.invitations(),
      service.helpRequests(),
    ]);
    setRows(invitations);
    setRequests(help);
    setReady(true);
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
          : "This account action was not confirmed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function send(id: string, address: string, level: InvitationRole) {
    const { invitation } = await service.invite(id, address, level);
    setMessage(deliveryText(invitation.state, invitation.delivery_code));
    setConfirm(false);
    if (invitation.state === "sent") {
      setEmail("");
      requestId.current = crypto.randomUUID();
    }
    await refresh();
  }
  return (
    <section className="lifecycle-tools" aria-labelledby="invite-heading">
      <div className="access-heading">
        <MailPlus size={24} />
        <div>
          <p className="eyebrow">OWNER · PRIVATE ADULT PILOT</p>
          <h2 id="invite-heading">Invite someone to Player Development</h2>
        </div>
      </div>
      <p>
        Choose their intended access. They set their own password and confirm
        their adult pilot setup. Invitations do not assign workouts, start
        billing or open junior enrollment.
      </p>
      <form
        className="member-form"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage("");
          setError("");
          setConfirm(true);
        }}
      >
        <fieldset disabled={busy || !ready}>
          <label>
            Adult invitation email
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                requestId.current = crypto.randomUUID();
              }}
            />
          </label>
          <label>
            Invited account level
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as InvitationRole);
                requestId.current = crypto.randomUUID();
              }}
            >
              <option value="parent">Parent</option>
              <option value="athlete">Athlete · individual adult</option>
              <option value="coach">Coach</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          <button className="button" type="submit">
            Review invitation
          </button>
        </fieldset>
      </form>
      <div className="actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void act(refresh)}
        >
          <RefreshCw size={16} /> Refresh invitations & requests
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <Notice>
        A dedicated email sender is needed for reliable customer invitations.
        Email links have the provider’s expiry, which can be shorter than the
        seven-day access invitation. A cancelled/expired invitation cannot
        activate access. Existing accounts use Manage account access.
      </Notice>
      {ready && (
        <>
          <h3>Recent invitations</h3>
          {!rows.length ? (
            <p>No invitations yet.</p>
          ) : (
            <ul className="lifecycle-list">
              {rows.map((row) => {
                const expired =
                  row.state !== "accepted" &&
                  new Date(row.expires_at).getTime() <= checkedAt;
                return (
                  <li key={row.id}>
                    <strong className="lifecycle-email">{row.email}</strong>
                    <p>
                      {ROLE_LABELS[row.intended_role]} ·{" "}
                      <Tag>{expired ? "Expired" : labels[row.state]}</Tag>
                    </p>
                    <small>
                      Requested {date(row.created_at)} · invitation expires{" "}
                      {date(row.expires_at)}
                    </small>
                    {row.state === "failed" && (
                      <p>{deliveryText(row.state, row.delivery_code)}</p>
                    )}
                    <div className="actions">
                      {row.state === "failed" && !expired && (
                        <button
                          className="button secondary"
                          disabled={
                            busy ||
                            checkedAt - new Date(row.updated_at).getTime() <
                              60000
                          }
                          onClick={() =>
                            void act(() =>
                              send(row.id, row.email, row.intended_role),
                            )
                          }
                        >
                          Retry invitation email
                        </button>
                      )}
                      {!["accepted", "cancelled"].includes(row.state) && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => setCancel(row)}
                        >
                          Cancel invitation for {row.email}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <h3>Account closure requests</h3>
          <p>
            These need an ownership/guardian review or unfinished cleanup.
            Marking a request reviewed does not delete the account.
          </p>
          {!requests.length ? (
            <p>No account closure requests waiting.</p>
          ) : (
            <ul className="lifecycle-list">
              {requests.map((row) => (
                <li key={row.id}>
                  <strong className="lifecycle-email">
                    {row.email || "Account unavailable"}
                  </strong>
                  <p>
                    {row.state === "failed"
                      ? "Cleanup retry required"
                      : row.state === "assistance_reviewed"
                        ? "Reviewed · account remains open"
                        : "Review requested"}{" "}
                    · {row.reason.replaceAll("_", " ")}
                  </p>
                  <small>
                    Request {row.id} · {date(row.created_at)}
                  </small>
                  {row.state === "assistance_requested" && (
                    <div className="actions">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await service.reviewHelp(row.id);
                            await refresh();
                          })
                        }
                      >
                        Mark request reviewed
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {confirm && (
        <Modal
          title="Send this account invitation?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p>
            <strong className="lifecycle-email">{email.trim()}</strong>
          </p>
          <p>
            Intended level: <strong>{ROLE_LABELS[role]}</strong>. The recipient
            must be 18 or older, verify the invitation and acknowledge the pilot
            privacy information. No Owner role or paid training access is
            granted.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void act(() => send(requestId.current, email, role))
              }
            >
              {busy
                ? "Requesting invitation…"
                : "Confirm & request invitation email"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Keep editing invitation
            </button>
          </div>
        </Modal>
      )}
      {cancel && (
        <Modal
          title="Cancel this invitation?"
          onClose={() => {
            if (!busy) setCancel(null);
          }}
        >
          <p>
            This stops the pending access invitation for{" "}
            <strong className="lifecycle-email">{cancel.email}</strong>. An
            email already sent might still arrive; it will not activate the
            cancelled invitation.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await service.cancel(cancel);
                  setCancel(null);
                  setMessage("Invitation cancelled.");
                  await refresh();
                })
              }
            >
              Confirm cancel invitation
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setCancel(null)}
            >
              Keep invitation
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
