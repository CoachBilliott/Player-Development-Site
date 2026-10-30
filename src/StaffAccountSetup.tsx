import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completeStaffAccountSetup,
  loadAccountName,
  type AccountNameState,
} from "./accountNames";
import { ProfilePrivacy } from "./ProfilePrivacy";

export function StaffAccountSetup({
  client,
  userId,
  email,
  setup,
  online,
  onState,
}: {
  client: SupabaseClient;
  userId: string;
  email: string;
  setup: NonNullable<AccountNameState["staff_setup"]>;
  online: boolean;
  onState: (state: AccountNameState, completed: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [adult, setAdult] = useState(false),
    [privacy, setPrivacy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const live = useRef(false),
    lock = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  async function act(reload = false) {
    if (
      lock.current ||
      !online ||
      (!reload && (!adult || !privacy || reloadRequired))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = reload
        ? await loadAccountName(client)
        : await completeStaffAccountSetup(
            client,
            userId,
            setup.role_version,
            adult,
            privacy,
            setup.privacy_version,
          );
      if (!live.current) return;
      setAdult(false);
      setPrivacy(false);
      setReloadRequired(false);
      setOpen(false);
      onState(result, !reload);
    } catch (e) {
      if (live.current) {
        setError(e instanceof Error ? e.message : "Setup was not confirmed.");
        setReloadRequired(true);
      }
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <div className="staff-adult-setup" aria-busy={busy}>
      <p>
        Complete your own adult/privacy setup before adding an optional name.
        Your staff role stays the same.
      </p>
      {!open ? (
        <button
          type="button"
          className="button secondary"
          disabled={!online}
          onClick={() => {
            setAdult(false);
            setPrivacy(false);
            setOpen(true);
            setError("");
          }}
        >
          Review adult/privacy setup
        </button>
      ) : (
        <form
          className="member-form"
          onSubmit={(event) => {
            event.preventDefault();
            void act();
          }}
          aria-label="Complete your adult/privacy setup"
        >
          <p>Signed in as {email}. This setup applies only to your account.</p>
          <p>
            Profile privacy details apply to player profiles. Your optional
            account name is separate and visible to you and Repformed Owners.
          </p>
          <fieldset disabled={busy || !online || reloadRequired}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={adult}
                onChange={(event) => setAdult(event.target.checked)}
              />
              I am 18 or older and will only add adult players.
            </label>
            <button
              className="text-button"
              type="button"
              onClick={() => setPrivacyOpen(true)}
            >
              Read profile privacy details
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={privacy}
                onChange={(event) => setPrivacy(event.target.checked)}
              />
              I understand what is stored and how to delete profile data. I will
              use nicknames and keep identifying child information out of
              profiles.
            </label>
            <p className="member-fineprint">
              Adult pilot disclosure, version {setup.privacy_version}.
            </p>
            <button
              className="button secondary"
              disabled={!adult || !privacy || busy || !online || reloadRequired}
            >
              Complete my adult/privacy setup
            </button>
          </fieldset>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setAdult(false);
              setPrivacy(false);
              setOpen(false);
              setError("");
            }}
          >
            Cancel adult/privacy setup
          </button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {reloadRequired && (
        <button
          type="button"
          className="button secondary"
          disabled={busy || !online}
          onClick={() => void act(true)}
        >
          Reload account setup
        </button>
      )}
      {privacyOpen && (
        <ProfilePrivacy
          lifecycleEnabled={true}
          onClose={() => setPrivacyOpen(false)}
        />
      )}
    </div>
  );
}
