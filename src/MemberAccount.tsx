import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  passwordIssue,
} from "./password";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AGES, GOALS, LEVELS, POSITIONS } from "./model";
import {
  Accounts,
  authRedirect,
  type MemberAccount,
  type PlayerInput,
  type PrivatePlayer,
} from "./accounts";
import { Modal, Notice, Tag } from "./components";
import type { SharedState } from "./useSharedContent";
import { isStaff, ROLE_LABELS } from "./roles";
import { AccountAccess } from "./AccountAccess";
import { FamilyTraining } from "./family";
import { AthleteTraining } from "./FamilyTraining";
import { appSurface } from "./mobile";
import { WebsiteLink } from "./MobileApp";
import { AccountClosure } from "./AccountClosure";
import "./accountLifecycle.css";

export function MemberAccountPage({
  shared,
  workspace = false,
}: {
  shared: SharedState;
  workspace?: boolean;
}) {
  if (shared.loading)
    return (
      <main className="page narrow member-page">
        <h1 tabIndex={-1}>Connecting your account…</h1>
        <p role="status">Checking the secure account service.</p>
      </main>
    );
  if (!shared.service || !shared.membersEnabled)
    return (
      <main className="page member-page">
        <div className="member-heading">
          <Tag>MEMBER ACCOUNTS · ACTIVATION PENDING</Tag>
          <h1 tabIndex={-1}>
            Your own space.
            <br />
            <span className="electric-text">Your player’s next chapter.</span>
          </h1>
          <p>
            Private accounts for adult players and parent-managed families. The
            public sample demo is ready to explore while the account service is
            connected.
          </p>
        </div>
        <div className="member-layout">
          <section className="panel member-panel">
            <LockKeyhole size={30} />
            <h2>Private profiles are being connected.</h2>
            <p>
              Registration is not open yet. No real player information is
              collected on this screen.
            </p>
            <Notice>
              The account database and email service still need owner setup.
              This page will offer real signup once that connection has been
              activated and tested.
            </Notice>
            {appSurface() ? (
              <a className="button" href="#app-help">
                Sign-in help <ArrowRight size={18} />
              </a>
            ) : (
              <a className="button" href="#onboarding">
                Try the sample demo <ArrowRight size={18} />
              </a>
            )}
          </section>
          <AccountPrinciples />
        </div>
      </main>
    );
  return (
    <ConnectedAccount
      key={shared.session?.user.id || "visitor"}
      shared={shared}
      service={new Accounts(shared.service.client)}
      workspace={workspace}
    />
  );
}
function AccountPrinciples() {
  return (
    <aside className="panel member-panel member-principles">
      <ShieldCheck size={28} />
      <h2>Built around your household.</h2>
      <ul>
        <li>
          Parents manage family athletes and decide whether each one may record
          practice independently.
        </li>
        <li>Private profiles. No public roster or direct messages.</li>
        <li>
          Only a nickname, age group and football preferences. No birth dates,
          school, address or profile photo is required. Video review uses
          separate, optional private uploads.
        </li>
        <li>
          Demo players and practice history never become real member records.
        </li>
      </ul>
      <p>
        Monthly packages and payments are not active. Creating a profile does
        not start a subscription.
      </p>
    </aside>
  );
}
function ConnectedAccount({
  shared,
  service,
  workspace,
}: {
  shared: SharedState;
  service: Accounts;
  workspace: boolean;
}) {
  const client = service.client;
  const [familyService] = useState(() => new FamilyTraining(client));
  const [trainingPlayer, setTrainingPlayer] = useState<PrivatePlayer | null>(
    null,
  );
  const [guardianManaged, setGuardianManaged] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "recover" | "verify">(
    "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [kind, setKind] = useState<"parent" | "adult">("parent");
  const profileKind =
    shared.role === "athlete"
      ? "adult"
      : shared.role === "parent"
        ? "parent"
        : kind;
  const [account, setAccount] = useState<MemberAccount | null>(null);
  const [players, setPlayers] = useState<PrivatePlayer[]>([]);
  const [under18Enabled, setUnder18Enabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<{
    id: string;
    player?: PrivatePlayer;
  } | null>(null);
  const [remove, setRemove] = useState<PrivatePlayer | null>(null);
  const [deleteData, setDeleteData] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [recovery, setRecovery] = useState(
    () => new URL(window.location.href).searchParams.get("flow") === "recovery",
  );
  const userId = shared.session?.user.id;
  // The parent keys this component by identity. Requests from a signed-out
  // account cannot populate the next account's view, including cross-tab logout.
  useEffect(() => {
    if (
      !userId ||
      !shared.accessReady ||
      shared.accessError ||
      isStaff(shared.role)
    )
      return;
    let stopped = false;
    void new Accounts(client)
      .load()
      .then((result) => {
        if (!stopped) {
          setAccount(result.account);
          setPlayers(result.players);
          setGuardianManaged(result.guardianManaged);
          setUnder18Enabled(result.under18Enabled);
          setLoaded(true);
        }
      })
      .catch((e: Error) => {
        if (!stopped) {
          setError(e.message);
          setLoaded(false);
        }
      });
    return () => {
      stopped = true;
    };
  }, [client, userId, shared.accessReady, shared.accessError, shared.role]);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    shared.clearConnectionError();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The request did not finish. Please reconnect and retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    const result = await service.load();
    setAccount(result.account);
    setPlayers(result.players);
    setGuardianManaged(result.guardianManaged);
    setTrainingPlayer(null);
    setUnder18Enabled(result.under18Enabled);
    setLoaded(true);
  }
  const linkedPlayer = players.find((p) => p.owner_id !== userId);
  const ownedPlayers = players.filter((p) => p.owner_id === userId);
  function switchMode(next: typeof mode) {
    setMode(next);
    setPassword("");
    setError("");
    setMessage("");
  }
  function clearRecovery() {
    const url = new URL(window.location.href);
    url.searchParams.delete("flow");
    window.history.replaceState(null, "", url);
    setRecovery(false);
  }
  async function authenticate(event: FormEvent) {
    event.preventDefault();
    await act(async () => {
      if (mode === "signup") {
        if (!shared.signupEnabled)
          throw new Error(
            "Public registration is not open. Use your activation email or sign in with an existing pilot account.",
          );
        if (!adult)
          throw new Error(
            "Accounts must be created by someone aged 18 or older.",
          );
        const issue = passwordIssue(password);
        if (issue) throw new Error(issue);
        const result = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirect() },
        });
        if (result.error)
          throw new Error(
            "Signup could not be completed. Check the email and password, then retry. If you already have an account, sign in or reset your password.",
          );
        setPassword("");
        setMessage(
          "Check your email to verify your account. Open the link in this browser, then sign in. If you already registered, use Sign in or Forgot password.",
        );
      } else if (mode === "verify") {
        const result = await client.auth.resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo: authRedirect() },
        });
        if (result.error)
          throw new Error(
            "A verification email could not be requested. Reconnect, wait briefly, and retry.",
          );
        setMessage(
          "If this email has an unverified account, a fresh verification link has been requested. Check your inbox and open it in this browser.",
        );
      } else if (mode === "recover") {
        const result = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirect(true),
        });
        if (result.error)
          throw new Error(
            "A recovery email could not be requested. Reconnect and try again.",
          );
        setMessage(
          "If an account exists for that email, a reset link has been requested. Open the link in this browser. Check spam, then request a fresh link if needed.",
        );
      } else {
        const result = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error)
          throw new Error(
            "Sign-in failed. Check your email, verification and password, then try again.",
          );
        setPassword("");
      }
    });
  }
  if (userId && !recovery && !shared.accessReady)
    return (
      <main className="page narrow">
        <h1 tabIndex={-1}>Opening your account…</h1>
        <p role="status">Checking your account permissions.</p>
      </main>
    );
  if (userId && !recovery && shared.accessError)
    return (
      <main className="page narrow">
        <h1 tabIndex={-1}>Account access could not be verified.</h1>
        <p role="alert">{shared.accessError}</p>
        <div className="actions">
          <button
            className="button"
            disabled={busy}
            onClick={() => void act(shared.refreshAccess)}
          >
            Retry account access
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void act(shared.signOut)}
          >
            {appSurface() ? "Sign out" : "Sign out of this browser"}
          </button>
        </div>
      </main>
    );
  if (userId && !recovery && isStaff(shared.role))
    return (
      <StaffAccount
        shared={shared}
        busy={busy}
        error={error}
        onSignOut={() => void act(shared.signOut)}
        onChangePassword={() => {
          const url = new URL(window.location.href);
          url.searchParams.set("flow", "recovery");
          window.history.replaceState(null, "", url);
          setRecovery(true);
        }}
      />
    );
  return (
    <main
      className={`page member-page ${workspace ? "workspace-page" : ""} ${workspace && linkedPlayer?.age_group !== "18+" && linkedPlayer ? "junior-workspace" : ""}`}
    >
      {shared.connectionError && (
        <p className="form-error member-feedback" role="alert">
          {shared.connectionError}
        </p>
      )}
      <div className="member-heading">
        {appSurface() && (
          <a className="text-button" href="#app-help">
            App help & support <ArrowRight size={16} />
          </a>
        )}
        <Tag>
          <LockKeyhole size={14} /> PRIVATE MEMBER SPACE
        </Tag>
        <h1 tabIndex={-1}>
          {workspace && userId
            ? shared.role === "parent"
              ? "Your family. Their next step."
              : linkedPlayer && linkedPlayer.age_group !== "18+"
                ? "Ready for your next practice?"
                : "Your training. Your next step."
            : userId
              ? "Your account. Your players."
              : "A clear start. A private account."}
        </h1>
        <p>
          {workspace && userId
            ? shared.role === "parent"
              ? "Add your family athletes, choose their permissions and review practice, one athlete at a time."
              : "One individual profile. Your own plan and honest practice history."
            : userId
              ? "Your household’s profiles stay separate from the public demo."
              : "An adult account is the starting point. No credit card or subscription required."}
        </p>
      </div>
      {error && (
        <p className="form-error member-feedback" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="member-feedback" role="status">
          {message}
        </p>
      )}
      {shared.accountNotice && (
        <p className="member-feedback" role="status">
          {shared.accountNotice}
        </p>
      )}
      {userId && !recovery && !workspace && (
        <>
          <a className="button workspace-entry" href="#workspace">
            Open my workspace <ArrowRight size={18} />
          </a>
          <AccountAccess shared={shared} />
        </>
      )}
      {userId &&
        !recovery &&
        !linkedPlayer &&
        (shared.role === null || shared.role === "athlete") &&
        !ownedPlayers.length && (
          <section className="panel member-panel family-join">
            <h2>Have a parent’s athlete access code?</h2>
            <p>
              Connect to your individual athlete profile in the family. This
              does not give access to siblings or parent controls. Real child
              access remains closed until verified consent setup is complete.
            </p>
            <form
              className="member-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await familyService.accept(joinCode);
                  setJoinCode("");
                  await shared.refreshAccess();
                  await refresh();
                });
              }}
            >
              <label>
                Parent’s private athlete access code
                <input
                  autoComplete="off"
                  required
                  maxLength={64}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  disabled={busy}
                />
              </label>
              <button
                className="button"
                disabled={busy || joinCode.trim().length !== 64}
              >
                Connect my athlete profile
              </button>
            </form>
          </section>
        )}
      {!userId ? (
        <div className="member-layout">
          <section className="panel member-panel">
            {!shared.signupEnabled && (
              <Notice>
                Private account pilot. Public registration is not open yet. Use
                the activation email sent to you, or sign in with an existing
                account. Adult profiles only while parental-consent setup is
                completed.
              </Notice>
            )}
            <div
              className="scene-tabs"
              role="group"
              aria-label="Account access"
            >
              <button
                disabled={busy}
                aria-pressed={mode === "signin"}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
              {shared.signupEnabled &&
                (appSurface() ? (
                  <WebsiteLink path="#account">
                    Set up account on website
                  </WebsiteLink>
                ) : (
                  <button
                    disabled={busy}
                    aria-pressed={mode === "signup"}
                    onClick={() => switchMode("signup")}
                  >
                    Create account
                  </button>
                ))}
            </div>
            <h2>
              {mode === "signup"
                ? "Start with the adult."
                : mode === "verify"
                  ? "Verify your email."
                  : mode === "recover"
                    ? "Reset your password."
                    : "Welcome back."}
            </h2>
            <form
              className="member-form"
              onSubmit={(event) => void authenticate(event)}
            >
              <fieldset disabled={busy}>
                <label>
                  {mode === "signup" ? "Adult email" : "Account email"}
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                {(mode === "signin" || mode === "signup") && (
                  <label>
                    Password
                    <input
                      type="password"
                      aria-label="Password"
                      aria-describedby={
                        mode === "signup" ? "signup-password-help" : undefined
                      }
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      minLength={
                        mode === "signup" ? PASSWORD_MIN_LENGTH : undefined
                      }
                      maxLength={128}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {mode === "signup" && (
                      <small id="signup-password-help">
                        {PASSWORD_REQUIREMENTS} Never use a child’s email for
                        this account.
                      </small>
                    )}
                  </label>
                )}
                {mode === "signup" && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={adult}
                      required
                      onChange={(e) => setAdult(e.target.checked)}
                    />
                    I am 18 or older. I will manage any under-18 player as their
                    parent or legal guardian.
                  </label>
                )}
                <p className="member-fineprint">
                  Your email is used for login and account recovery. The login
                  session is stored in this browser; player details are
                  retrieved from the private database. Sign out on shared
                  devices.{" "}
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setPrivacyOpen(true)}
                  >
                    Read profile privacy details
                  </button>
                </p>
                <button className="button full" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "signup"
                      ? "Create adult account"
                      : mode === "verify"
                        ? "Resend verification link"
                        : mode === "recover"
                          ? "Send reset link"
                          : "Sign in securely"}
                  <ArrowRight size={18} />
                </button>
                {mode === "signin" &&
                  (appSurface() ? (
                    <WebsiteLink path="#account">
                      Reset password on website
                    </WebsiteLink>
                  ) : (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => switchMode("recover")}
                    >
                      Forgot password?
                    </button>
                  ))}
                {mode === "signin" &&
                  (appSurface() ? (
                    <WebsiteLink path="#account">
                      Verify email on website
                    </WebsiteLink>
                  ) : (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => switchMode("verify")}
                    >
                      Resend verification email
                    </button>
                  ))}
                {(mode === "recover" || mode === "verify") && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => switchMode("signin")}
                  >
                    Back to sign in
                  </button>
                )}
              </fieldset>
            </form>
          </section>
          <AccountPrinciples />
        </div>
      ) : recovery ? (
        <section className="panel member-panel account-narrow">
          <h2>Choose a new password.</h2>
          <form
            className="member-form"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                const issue = passwordIssue(password);
                if (issue) throw new Error(issue);
                const result = await client.auth.updateUser({ password });
                if (result.error)
                  throw new Error(
                    "The password could not be updated. Request a fresh recovery link and try again.",
                  );
                setPassword("");
                clearRecovery();
                setMessage("Password updated. You are signed in.");
              });
            }}
          >
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                aria-describedby="new-password-help"
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            <small id="new-password-help">{PASSWORD_REQUIREMENTS}</small>
            <button className="button" disabled={busy}>
              Save new password
            </button>
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={clearRecovery}
            >
              Cancel password change
            </button>
          </form>
        </section>
      ) : !loaded ? (
        <section className="panel member-panel">
          <p role="status">
            {error
              ? "Profiles could not be loaded."
              : "Loading your private account…"}
          </p>
          {error && (
            <button
              className="button"
              disabled={busy}
              onClick={() => void act(refresh)}
            >
              Retry connection
            </button>
          )}
        </section>
      ) : trainingPlayer ? (
        <>
          <button
            className="button secondary"
            onClick={() => setTrainingPlayer(null)}
          >
            Back to athlete profiles
          </button>
          <AthleteTraining
            key={trainingPlayer.id}
            player={trainingPlayer}
            service={familyService}
            client={client}
          />
        </>
      ) : linkedPlayer ? (
        <>
          <Notice>
            You are connected as one individual athlete in a family. Only your
            own athlete profile and practice history are shown.
          </Notice>
          <AthleteTraining
            key={linkedPlayer.id}
            player={linkedPlayer}
            service={familyService}
            client={client}
            onConnectionChange={refresh}
            junior={linkedPlayer.age_group !== "18+"}
          />
        </>
      ) : guardianManaged ? (
        <section className="panel member-panel">
          <h2>Your parent manages athlete access.</h2>
          <p>
            Your connection is paused or unavailable. Ask your parent to review
            your access. You cannot switch this account to an adult or parent
            account yourself.
          </p>
        </section>
      ) : !account ? (
        <div className="member-layout">
          <section className="panel member-panel">
            <h2>Who is the training for?</h2>
            <p>
              Signed in as {shared.session?.user.email}. Your account starts
              empty.
            </p>
            <form
              className="member-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!adult || !privacy) return;
                void act(async () => {
                  const saved = await service.setup(profileKind);
                  setAccount(saved);
                  await shared.refreshAccess();
                  setPlayers([]);
                  setMessage(
                    "Account ready. Add a private player profile when you’re ready.",
                  );
                });
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Account type
                  <select
                    value={profileKind}
                    disabled={
                      shared.role === "parent" || shared.role === "athlete"
                    }
                    onChange={(e) => setKind(e.target.value as typeof kind)}
                  >
                    <option value="parent">Parent / legal guardian</option>
                    <option value="adult">Athlete (18+ only)</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    required
                    checked={adult}
                    onChange={(e) => setAdult(e.target.checked)}
                  />
                  I am 18 or older
                  {profileKind === "parent"
                    ? " and I am the parent or legal guardian of any under-18 player I add"
                    : " and will only add adult players"}
                  .
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
                    onChange={(e) => setPrivacy(e.target.checked)}
                  />
                  I understand what is stored and how to delete profile data. I
                  will use nicknames and keep identifying child information out
                  of profiles.
                </label>
                <button
                  className="button"
                  disabled={!adult || !privacy || busy}
                >
                  Finish account setup <Check size={18} />
                </button>
              </fieldset>
            </form>
          </section>
          <AccountPrinciples />
        </div>
      ) : (
        <>
          {workspace &&
            account.account_type === "adult" &&
            ownedPlayers.length === 1 && (
              <AthleteTraining
                player={ownedPlayers[0]}
                service={familyService}
                client={client}
              />
            )}
          {workspace && account.account_type === "parent" && (
            <div className="workspace-metrics">
              <div>
                <strong>{ownedPlayers.length}</strong>
                <span>Private family athletes</span>
              </div>
              <div>
                <strong>You decide</strong>
                <span>Separate recording permission for each athlete</span>
              </div>
              <div>
                <strong>Parent review</strong>
                <span>Athlete reports wait for your approval</span>
              </div>
            </div>
          )}
          <div className="member-toolbar">
            <div>
              <Tag>
                {account.account_type === "parent"
                  ? "PARENT / GUARDIAN"
                  : "PERSONAL ATHLETE PROFILE"}
              </Tag>
              <p>{shared.session?.user.email}</p>
            </div>
            <div className="actions">
              <button
                className="button secondary"
                disabled={busy || !!draft}
                onClick={() => void act(refresh)}
              >
                Refresh profiles
              </button>
              <button
                className="button"
                disabled={
                  busy ||
                  !!draft ||
                  (shared.role === "athlete" && players.length >= 1)
                }
                onClick={() => setDraft({ id: crypto.randomUUID() })}
              >
                <Plus size={18} />
                Add player
              </button>
            </div>
          </div>
          {draft ? (
            <PlayerEditor
              key={draft.id}
              account={account}
              under18Enabled={under18Enabled}
              existing={draft.player}
              busy={busy}
              onCancel={() => {
                setDraft(null);
                setError("");
              }}
              onSave={(input) =>
                void act(async () => {
                  const saved = await service.save(
                    draft.id,
                    input,
                    draft.player?.version,
                  );
                  setPlayers((old) => [
                    ...old.filter((p) => p.id !== saved.id),
                    saved,
                  ]);
                  setDraft(null);
                  setMessage("Private player profile saved.");
                })
              }
            />
          ) : players.length ? (
            <div className="member-player-grid">
              {ownedPlayers.map((player) => (
                <article
                  className="panel member-panel private-player"
                  key={player.id}
                >
                  <div className="player-monogram" aria-hidden="true">
                    {player.nickname.slice(0, 1).toUpperCase()}
                  </div>
                  <Tag>
                    {player.age_group === "18+"
                      ? "ADULT PROFILE"
                      : "PARENT-MANAGED"}
                  </Tag>
                  <h2>{player.nickname}</h2>
                  <p>
                    Age {player.age_group} · {player.position}
                  </p>
                  <dl>
                    <div>
                      <dt>Experience</dt>
                      <dd>{player.experience}</dd>
                    </div>
                    <div>
                      <dt>Focus</dt>
                      <dd>{player.goal}</dd>
                    </div>
                  </dl>
                  <div className="actions">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => setTrainingPlayer(player)}
                    >
                      Workouts &amp; permissions
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => setDraft({ id: player.id, player })}
                    >
                      Edit {player.nickname}
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setRemove(player)}
                    >
                      Delete {player.nickname}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="panel member-panel empty-private">
              <Users size={36} />
              <h2>A fresh start for your players.</h2>
              <p>
                No profiles yet. Add a nickname, an age group and a few football
                preferences. Demo players will stay in the demo.
              </p>
              <button
                className="button"
                disabled={busy}
                onClick={() => setDraft({ id: crypto.randomUUID() })}
              >
                Add your first player <Plus size={18} />
              </button>
            </section>
          )}
          <Notice>
            Profile setup is available. Training is still illustrative and
            pending qualified coaching review; no paid training access or
            subscription is active.{" "}
            <a href="#onboarding">
              Explore training with a fictional demo player.
            </a>
          </Notice>
          <div className="member-data-actions">
            <button
              className="text-button"
              onClick={() => setPrivacyOpen(true)}
            >
              Profile privacy details
            </button>
            {!shared.accountLifecycleEnabled && (
              <button
                className="text-button"
                disabled={busy || !!draft}
                onClick={() => {
                  setDeleteText("");
                  setDeleteData(true);
                }}
              >
                Delete member profile data
              </button>
            )}
          </div>
        </>
      )}
      {userId && !workspace && shared.accountLifecycleEnabled && (
        <AccountClosure key={userId} shared={shared} />
      )}
      {userId && (
        <div className="member-signout">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await shared.signOut();
                clearRecovery();
              })
            }
          >
            {appSurface() ? "Sign out" : "Sign out of this browser"}
          </button>
          <p>Sign out before handing a shared device to someone else.</p>
        </div>
      )}

      {remove && (
        <Modal
          title={`Delete ${remove.nickname}’s profile?`}
          onClose={() => {
            if (!busy) setRemove(null);
          }}
        >
          <p>
            This permanently deletes this private player profile and its
            recorded workouts and family connection. The fictional demo is
            unaffected.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await service.remove(remove);
                  setPlayers((old) => old.filter((p) => p.id !== remove.id));
                  setRemove(null);
                  setMessage("Player profile deleted.");
                })
              }
            >
              Delete player profile
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              Keep profile
            </button>
          </div>
        </Modal>
      )}
      {deleteData && (
        <Modal
          title="Delete your member profile data?"
          onClose={() => {
            if (!busy) setDeleteData(false);
          }}
        >
          <p>
            This permanently removes your player profiles, their workout
            records, family connections and member setup. Your email login
            remains with the authentication provider. Full login erasure
            requires the project owner through Supabase Auth; there is no
            automatic billing or subscription to cancel.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <label>
            Type DELETE to confirm
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <div className="actions">
            <button
              className="button danger"
              disabled={deleteText !== "DELETE" || busy}
              onClick={() =>
                void act(async () => {
                  await service.deleteData();
                  setPlayers([]);
                  setAccount(null);
                  setDeleteData(false);
                  setAdult(false);
                  setPrivacy(false);
                  setMessage(
                    "Member setup and all player profiles deleted. Your email login still exists.",
                  );
                })
              }
            >
              Permanently delete profile data
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleteData(false)}
            >
              Keep my data
            </button>
          </div>
        </Modal>
      )}
      {privacyOpen && (
        <Modal
          title="Your profile privacy"
          onClose={() => setPrivacyOpen(false)}
        >
          <p>
            Repformed stores the adult’s email and login credentials
            through Supabase Auth. Member records store your account type,
            acknowledgement time, and each player’s nickname, age group,
            football position, experience and goal. Do not enter full names,
            birth dates, school details, health information or photos.
          </p>
          <p>
            Profiles are private to their household and explicitly linked
            individual athlete. Coaches do not receive general profile access;
            optional video review is limited to the assigned coach. Real
            under-18 enrollment and junior logins remain closed. Adult status
            and guardianship are self-attested; verified guardian consent and
            identity checks still require separate launch work.
          </p>
          <p>
            Your login session is saved in this browser. Profile details are
            fetched online and are not saved into demo storage or the app’s
            offline cache. The fictional demo remains separate.{" "}
            {shared.accountLifecycleEnabled
              ? "Customer account deletion includes the email login, owned profiles/history and private clips after password confirmation. Staff content and guardian-managed closure use assisted review. Other households keep their own records with your reporter identity removed. A minimal receipt retains the request ID, status, counts and dates without your email. Provider backups and already-downloaded copies follow their applicable retention rules."
              : "Profile deletion is available in your account; provider backup retention and complete email-login erasure require the project owner."}
          </p>
          <p>
            This is the adult pilot disclosure,{" "}
            {shared.accountLifecycleEnabled
              ? "version adult-pilot-lifecycle-2026-10"
              : "version profile-pilot-2026-10"}
            . A reviewed privacy policy, verified parental-consent process,
            support contact and retention policy are still required before
            public enrollment of children.
          </p>
          <button className="button" onClick={() => setPrivacyOpen(false)}>
            Close privacy details
          </button>
        </Modal>
      )}
    </main>
  );
}
function PlayerEditor({
  account,
  under18Enabled,
  existing,
  busy,
  onCancel,
  onSave,
}: {
  account: MemberAccount;
  under18Enabled: boolean;
  existing?: PrivatePlayer;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: PlayerInput) => void;
}) {
  const [input, setInput] = useState<PlayerInput>(
    existing || {
      nickname: "",
      age_group: "18+",
      sport: "football",
      position: "Explore all positions",
      experience: "New to the game",
      goal: "Coordination",
      guardian_confirmed: false,
    },
  );
  const change = <K extends keyof PlayerInput>(key: K, value: PlayerInput[K]) =>
    setInput((old) => ({ ...old, [key]: value }));
  return (
    <section className="panel member-panel account-narrow">
      <h2>{existing ? "Edit private player" : "Add a private player"}</h2>
      <p>
        Use a nickname, not a full name. All under-18 profiles must be
        parent-managed.
      </p>
      {!under18Enabled && (
        <Notice>
          Under-18 enrollment is not open yet. Adult profiles are available;
          children’s profiles require the parental-consent and privacy setup to
          be completed first.
        </Notice>
      )}
      <form
        className="member-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(input);
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Player nickname
            <input
              required
              maxLength={40}
              autoComplete="off"
              value={input.nickname}
              onChange={(e) => change("nickname", e.target.value)}
            />
          </label>
          <label>
            Age group
            <select
              aria-label="Age group"
              value={input.age_group}
              onChange={(e) =>
                setInput((old) => ({
                  ...old,
                  age_group: e.target.value as PlayerInput["age_group"],
                  guardian_confirmed: false,
                }))
              }
            >
              {(account.account_type === "parent" && under18Enabled
                ? AGES
                : ["18+"]
              ).map((age) => (
                <option key={age}>{age}</option>
              ))}
            </select>
          </label>
          <label>
            Football position
            <select
              value={input.position}
              onChange={(e) =>
                change("position", e.target.value as PlayerInput["position"])
              }
            >
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Experience
            <select
              value={input.experience}
              onChange={(e) =>
                change(
                  "experience",
                  e.target.value as PlayerInput["experience"],
                )
              }
            >
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Primary goal
            <select
              value={input.goal}
              onChange={(e) =>
                change("goal", e.target.value as PlayerInput["goal"])
              }
            >
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          {input.age_group !== "18+" && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={input.guardian_confirmed}
                onChange={(e) => change("guardian_confirmed", e.target.checked)}
              />
              I am this player’s parent or legal guardian and will manage their
              profile and supervise any practice.
            </label>
          )}
          <div className="actions">
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Save private player"}
              <Check size={18} />
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel changes
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function StaffAccount({
  shared,
  busy,
  error,
  onSignOut,
  onChangePassword,
}: {
  shared: SharedState;
  busy: boolean;
  error: string;
  onSignOut: () => void;
  onChangePassword: () => void;
}) {
  const role = shared.role!;
  return (
    <main className="page narrow staff-account">
      <div className="page-intro">
        <Tag>PRIVATE · STAFF ACCOUNT</Tag>
        <h1 tabIndex={-1}>Your {ROLE_LABELS[role]} account.</h1>
        <p>Manage Repformed with your assigned staff permissions.</p>
      </div>
      <section className="panel member-panel">
        <h2>Signed in</h2>
        <p className="staff-account-email">{shared.session?.user.email}</p>
        <div className="actions">
          <a className="button" href="#workspace">
            Open my workspace <ArrowRight size={18} />
          </a>
          <a className="button secondary" href="#coach">
            Upload & manage content
          </a>
          <a className="button secondary" href="#video-reviews">
            Video reviews
          </a>
          {role === "owner" && (
            <a className="button secondary" href="#access">
              Workouts & account access
            </a>
          )}
        </div>
      </section>
      <AccountAccess shared={shared} />
      <section className="panel member-panel">
        <h2>Sign-in settings</h2>
        <div className="actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={onChangePassword}
          >
            Change password
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={onSignOut}
          >
            {appSurface() ? "Sign out" : "Sign out of this browser"}
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </section>
      {shared.accountLifecycleEnabled && (
        <AccountClosure key={shared.session?.user.id} shared={shared} />
      )}
    </main>
  );
}
