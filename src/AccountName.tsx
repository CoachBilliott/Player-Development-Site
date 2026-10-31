import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadAccountName,
  normalizeAccountName,
  saveAccountName,
  type AccountNameState,
} from "./accountNames";
import { StaffAccountSetup } from "./StaffAccountSetup";
import { isStaff } from "./roles";
import type { SharedState } from "./useSharedContent";

export function AccountName({ shared }: { shared: SharedState }) {
  const client = shared.service?.client,
    user = shared.session?.user;
  return client && user ? (
    <NameEditor
      key={user.id}
      client={client}
      userId={user.id}
      staff={isStaff(shared.role)}
      email={user.email || ""}
    />
  ) : null;
}
function NameEditor({
  client,
  userId,
  staff,
  email,
}: {
  client: SupabaseClient;
  userId: string;
  staff: boolean;
  email: string;
}) {
  const [state, setState] = useState<AccountNameState | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const live = useRef(false),
    lock = useRef(false);
  useEffect(() => {
    live.current = true;
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    let stopped = false;
    void loadAccountName(client)
      .then((value) => {
        if (!stopped) {
          setState(value);
          setDraft(value.display_name || "");
        }
      })
      .catch((e: Error) => {
        if (!stopped) setError(e.message);
      })
      .finally(() => {
        if (!stopped) setBusy(false);
      });
    return () => {
      stopped = true;
      live.current = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [client]);
  async function act(save: boolean) {
    if (lock.current || !online) return;
    if (save) {
      try {
        normalizeAccountName(draft);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Check your name.");
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = save
        ? await saveAccountName(client, draft, state!.version, userId)
        : await loadAccountName(client);
      if (!live.current) return;
      setState(value);
      setDraft(value.display_name || "");
      setReloadRequired(false);
      if (save)
        setMessage(
          value.display_name ? "Your name is saved." : "Your name is removed.",
        );
    } catch (e) {
      if (live.current) {
        setError(
          e instanceof Error ? e.message : "Your name could not be saved.",
        );
        if (save) setReloadRequired(true);
      }
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      className="panel member-panel account-name"
      aria-label="Your name"
      aria-busy={busy}
    >
      <h2>Your name</h2>
      <p>
        Optional. Visible to you and Repformed Owners so they can recognize your
        account. This name does not verify your identity or change your access.
      </p>
      {busy && <p role="status">Loading or saving your name…</p>}
      {!online && <p role="status">Reconnect to load or save your name.</p>}
      {state?.eligible === false && (
        <p>
          Verified email and completed adult setup are required. Parent-managed
          accounts and accounts closing cannot edit an adult name.
        </p>
      )}
      {state?.staff_setup && staff && (
        <StaffAccountSetup
          key={`${userId}:${state.staff_setup.role_version}`}
          client={client}
          userId={userId}
          email={email}
          setup={state.staff_setup}
          online={online}
          onState={(value, completed) => {
            setState(value);
            setDraft(value.display_name || "");
            setReloadRequired(false);
            setError("");
            setMessage(
              completed
                ? "Adult/privacy setup recorded. Your staff role is unchanged."
                : "",
            );
          }}
        />
      )}
      {state?.eligible === false && staff && !state.staff_setup && (
        <p>
          This account is not eligible for self-service adult/privacy setup.
          Verify your email or ask Repformed to review its onboarding, family
          access or closure status.
        </p>
      )}
      {state?.eligible && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(true);
          }}
        >
          <label>
            Your name (optional)
            <input
              name="adult-name"
              autoComplete="name"
              value={draft}
              disabled={busy || !online || reloadRequired}
              onChange={(e) => setDraft(e.target.value)}
              aria-describedby="adult-name-help"
            />
          </label>
          <p id="adult-name-help" className="member-fineprint">
            Up to 100 characters. Leave blank to remove your name. Your sign-in
            email stays the same.
          </p>
          <div className="actions">
            <button
              className="button secondary"
              disabled={
                busy ||
                !online ||
                reloadRequired ||
                draft === (state.display_name || "")
              }
            >
              Save name
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || draft === (state.display_name || "")}
              onClick={() => {
                setDraft(state.display_name || "");
                setMessage("");
              }}
            >
              Cancel name edit
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {(!state || reloadRequired) && !busy && (
        <button
          className="button secondary"
          disabled={!online}
          onClick={() => void act(false)}
        >
          Reload your name
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
