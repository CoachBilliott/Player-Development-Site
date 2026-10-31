import { useEffect, useRef, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Modal, Notice } from "./components";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_DETAILS,
  assignRole,
  listNamedAccess,
  type AccountRole,
  type AccessMember,
} from "./roles";
import type { SharedState } from "./useSharedContent";

export function AccountAccess({
  shared,
  manage = false,
}: {
  shared: SharedState;
  manage?: boolean;
}) {
  const role = shared.role;
  if (manage)
    return role === "owner" && shared.service && shared.session ? (
      <section
        className="panel member-panel account-access"
        aria-label="Account level"
      >
        <AccessManager key={shared.session.user.id} shared={shared} />
      </section>
    ) : null;
  return (
    <section
      className="panel member-panel account-access"
      aria-label="Account level"
    >
      <div className="access-heading">
        <ShieldCheck size={24} />
        <div>
          <p className="eyebrow">YOUR ACCOUNT LEVEL</p>
          <h2>{role ? ROLE_LABELS[role] : "Finish account setup"}</h2>
        </div>
      </div>
      <p>
        {role
          ? ROLE_DETAILS[role]
          : "Finish your adult profile setup. Staff access is assigned by an Owner."}
      </p>
      <p className="member-fineprint">
        Your account role is separate from membership access.
      </p>
      {role === "owner" && !manage && (
        <a className="text-button" href="#access">
          <LockKeyhole size={17} />
          Manage team access
        </a>
      )}
    </section>
  );
}
function AccessManager({ shared }: { shared: SharedState }) {
  const client = shared.service!.client;
  const [rows, setRows] = useState<AccessMember[]>([]);
  const [directoryView, setDirectoryView] = useState<"staff" | "all">("staff");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [choices, setChoices] = useState<Record<string, AccountRole>>({});
  const [pending, setPending] = useState<{
    member: AccessMember;
    role: AccountRole;
  } | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let stopped = false;
    void listNamedAccess(client, "")
      .then((data) => {
        if (!stopped) {
          setRows(data);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (!stopped) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      stopped = true;
    };
  }, [client]);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not be completed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="access-manager" aria-busy={loading || busy}>
      <h2>People & roles</h2>
      <p>
        Only Owners can assign these levels. People must verify their email and
        finish adult setup before their level can change. Your own Owner access
        is protected.
      </p>
      <div
        className="workflow-segments"
        role="group"
        aria-label="People directory view"
      >
        <button
          aria-pressed={directoryView === "staff"}
          onClick={() => setDirectoryView("staff")}
        >
          Staff
        </button>
        <button
          aria-pressed={directoryView === "all"}
          onClick={() => setDirectoryView("all")}
        >
          All accounts
        </button>
      </div>
      <form
        className="access-search"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            setRows(await listNamedAccess(client, search));
            setChoices({});
          });
        }}
      >
        <label>
          Find an account by email
          <input
            type="search"
            value={search}
            maxLength={254}
            disabled={busy}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button className="button secondary" disabled={busy}>
          Search accounts
        </button>
      </form>
      {error && !pending && (
        <>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                setRows(await listNamedAccess(client, search));
                setChoices({});
              })
            }
          >
            Retry accounts
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {(loading || busy) && (
        <p role="status">
          {loading ? "Loading accounts…" : "Updating account directory…"}
        </p>
      )}
      {!loading &&
        !busy &&
        !error &&
        !rows.filter(
          (m) =>
            directoryView === "all" ||
            ["owner", "manager", "coach"].includes(m.role || ""),
        ).length && (
          <p>
            {directoryView === "staff"
              ? "No staff accounts match. Choose All accounts to manage a customer’s role."
              : "No matching accounts. Try another email or search again."}
          </p>
        )}
      <div className="access-directory">
        {rows
          .filter(
            (m) =>
              directoryView === "all" ||
              ["owner", "manager", "coach"].includes(m.role || ""),
          )
          .map((member) => {
            const self = member.user_id === shared.session?.user.id;
            const choice = choices[member.user_id] || member.role || "athlete";
            return (
              <details className="access-person" key={member.user_id}>
                <summary>
                  <span>
                    <strong>{member.display_name || member.email}</strong>
                    {member.display_name && <small>{member.email}</small>}
                    <small>
                      {member.role ? ROLE_LABELS[member.role] : "Setup pending"}
                      {self ? " · You" : ""}
                    </small>
                  </span>
                  <small>Manage access</small>
                </summary>
                <div className="access-person-fields">
                  {(!member.email_verified || !member.adult_setup) && !self && (
                    <p>
                      Email verification and adult setup are required before a
                      role change.
                    </p>
                  )}
                  <label>
                    Account level for {member.email}
                    <select
                      aria-label={`Account level for ${member.email}`}
                      disabled={
                        busy ||
                        self ||
                        !member.email_verified ||
                        !member.adult_setup
                      }
                      value={choice}
                      onChange={(e) =>
                        setChoices((old) => ({
                          ...old,
                          [member.user_id]: e.target.value as AccountRole,
                        }))
                      }
                    >
                      {ROLES.map((level) => (
                        <option value={level} key={level}>
                          {ROLE_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button secondary"
                    disabled={
                      busy ||
                      self ||
                      !member.email_verified ||
                      !member.adult_setup ||
                      member.role === choice
                    }
                    onClick={() => {
                      setError("");
                      setPending({ member, role: choice });
                    }}
                  >
                    Review access change
                  </button>
                </div>
              </details>
            );
          })}
      </div>
      <small>
        Up to 50 matching accounts. Use Invite staff for a new approved adult
        account. Public enrollment remains closed.
      </small>
      {pending && (
        <Modal
          title="Change account level?"
          onClose={() => {
            if (!busy) setPending(null);
          }}
        >
          <p>
            <strong>
              {pending.member.display_name || pending.member.email}
            </strong>
          </p>
          <p>{pending.member.email}</p>
          <p className="member-fineprint">
            Account ID: {pending.member.user_id} · Access version:{" "}
            {pending.member.version}
          </p>
          <p>
            {pending.member.role
              ? ROLE_LABELS[pending.member.role]
              : "No level"}{" "}
            → <strong>{ROLE_LABELS[pending.role]}</strong>
          </p>
          <Notice>
            {ROLE_DETAILS[pending.role]} This does not start a subscription or
            share private player profiles.
          </Notice>
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
                void act(async () => {
                  await assignRole(client, pending.member, pending.role);
                  setPending(null);
                  setRows(await listNamedAccess(client, search));
                  setChoices({});
                  setMessage(
                    "Account level updated. This person’s next access check will use the new permissions.",
                  );
                })
              }
            >
              {busy ? "Saving…" : "Confirm account level"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Keep current level
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
