import { useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LearningAthlete } from "../../src/learning/LearningAthlete";
import { LearningApi, athleteSchema } from "../../src/learning/api";
import { StaffLearning } from "../../src/learning/StaffLearning";
import { StaffService } from "../../src/staffService";
import type { ProfileLoader } from "../../src/learning/RosterPicker";
import { ROLES, isStaff, type AccountRole } from "../../src/roles";
import {
  TEST_REF,
  TEST_URL,
  TEST_ACCOUNTS,
  SAMPLE_TEXT,
  UUID,
  publicTestKey,
  testFetch,
  syntheticAccount,
  samplePath,
  learnerKeysAbsent,
  receiptJson,
  type Receipt,
  type CheckName,
} from "./policy";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "./harness.css";
import { RosterChecks } from "./RosterChecks";

type Connection = {
  client: SupabaseClient;
  anonymous: SupabaseClient;
  key: string;
};
type Actor = { id: string; role: AccountRole };
type Sample = { resource: string; path: string; saved: boolean };
type CheckResult = Receipt["result"];
const content = {
  title: "REHEARSAL ONLY — original text lesson",
  sport: "football",
  skill: "Game understanding",
  ages: ["18+"],
  levels: ["New to the game"],
  positions: ["Quarterback"],
  minutes: 1,
  steps: [
    "Read this synthetic lesson. No actual athletic instruction is prescribed.",
  ],
  equipment: "None — synthetic acceptance only",
  lesson: "Original sample for private delivery checks.",
  cue: "Test data, not coaching advice",
  kind: "read",
};

export function App() {
  const [key, setKey] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const learning = useMemo(
    () => (connection ? new LearningApi(connection.client) : null),
    [connection],
  );
  const [email, setEmail] = useState(TEST_ACCOUNTS[0]);
  const [password, setPassword] = useState("");
  const [actor, setActor] = useState<Actor | null>(null);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const [results, setResults] = useState<Receipt[]>([]);
  const [profile, setProfile] = useState(""),
    [profileExpected, setProfileExpected] = useState("allow");
  const [mediaPath, setMediaPath] = useState(""),
    [mediaExpected, setMediaExpected] = useState("allow");
  const [view, setView] = useState("checks"),
    [openedProfile, setOpenedProfile] = useState("");
  const lock = useRef(false),
    positiveProfile = useRef(false),
    positiveMedia = useRef(false);
  const knownSamples = useRef(new Set<string>()),
    knownProfiles = useRef(new Set<string>()),
    sample = useRef<Sample | null>(null);
  const [sampleView, setSampleView] = useState<Sample | null>(null);
  function record(check: CheckName, result: CheckResult) {
    setResults((rows) => [
      ...rows,
      {
        check,
        role:
          check === "anonymous roster"
            ? "anonymous"
            : actor?.role || "anonymous",
        result,
        at: new Date().toISOString(),
      },
    ]);
    setStatus(
      `${check}: ${result}. The receipt contains no credentials, URLs, answers or file bytes.`,
    );
  }
  async function run(check: CheckName, action: () => Promise<CheckResult>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus("");
    try {
      record(check, await action());
    } catch {
      record(check, "blocked");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function configure() {
    try {
      const value = publicTestKey(key);
      const make = () =>
        createClient(TEST_URL, value, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: "rehearsal-" + crypto.randomUUID(),
          },
          global: { fetch: testFetch() },
        });
      setConnection({ client: make(), anonymous: make(), key: value });
      setKey("");
      setStatus(
        "Public test configuration loaded in memory. No request has been sent yet.",
      );
    } catch {
      setStatus(
        "Rejected configuration. Enter only the approved test project's public publishable/anon key.",
      );
    }
  }
  async function signIn() {
    if (!connection || lock.current || !syntheticAccount(email) || !password)
      return;
    lock.current = true;
    setBusy(true);
    setStatus("");
    const temporaryPassword = password;
    setPassword("");
    try {
      const response = await connection.client.auth.signInWithPassword({
        email,
        password: temporaryPassword,
      });
      if (response.error || !response.data.user) throw Error();
      const verified = await connection.client.auth.getUser();
      if (
        verified.error ||
        verified.data.user?.id !== response.data.user.id ||
        verified.data.user.email !== email
      )
        throw Error();
      const role = await connection.client.rpc("current_account_role");
      if (role.error || !ROLES.includes(role.data as AccountRole))
        throw Error();
      setActor({ id: verified.data.user.id, role: role.data as AccountRole });
      setResults((rows) => [
        ...rows,
        {
          check: "verified sign-in",
          role: role.data as AccountRole,
          result: "passed",
          at: new Date().toISOString(),
        },
      ]);
      positiveProfile.current = false;
      positiveMedia.current = false;
      sample.current = null;
      setSampleView(null);
      setProfile("");
      setOpenedProfile("");
      setView("checks");
      setStatus(
        "Real test-user sign-in and server user verification succeeded. Role came from the guarded database RPC.",
      );
    } catch {
      await connection.client.auth.signOut({ scope: "local" }).catch(() => {});
      setActor(null);
      setStatus(
        "Sign-in or role verification was not confirmed. Check the disposable account and approved role setup. No recovery email was requested.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function signOut() {
    if (lock.current || !connection) return;
    lock.current = true;
    setBusy(true);
    setPassword("");
    try {
      await connection.client.auth.signOut({ scope: "local" });
    } finally {
      setActor(null);
      positiveProfile.current = false;
      positiveMedia.current = false;
      sample.current = null;
      setSampleView(null);
      setOpenedProfile("");
      setProfile("");
      setView("checks");
      setStatus(
        "Session and private component state cleared from this page. Previously issued signed URLs can remain valid until expiry.",
      );
      lock.current = false;
      setBusy(false);
    }
  }
  async function refreshRole() {
    if (!connection || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const verified = await connection.client.auth.getUser();
      const level = await connection.client.rpc("current_account_role");
      if (
        verified.error ||
        !verified.data.user ||
        !syntheticAccount(verified.data.user.email || "") ||
        level.error ||
        !ROLES.includes(level.data as AccountRole)
      )
        throw Error();
      setActor({ id: verified.data.user.id, role: level.data as AccountRole });
      positiveProfile.current = false;
      positiveMedia.current = false;
      setOpenedProfile("");
      setView("checks");
      setStatus(
        "Server identity/role refreshed. Private panels and paired controls were cleared; run positive controls again.",
      );
    } catch {
      setActor(null);
      setOpenedProfile("");
      positiveProfile.current = false;
      positiveMedia.current = false;
      await connection.client.auth.signOut({ scope: "local" }).catch(() => {});
      setStatus(
        "Session/role could not be verified; private panels cleared. Sign in again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function rawKeys(anonymous: boolean): Promise<CheckResult> {
    if (!connection) return "blocked";
    if (!anonymous && !(await currentUserVerified())) return "blocked";
    const response = await (
      anonymous ? connection.anonymous : connection.client
    )
      .from("learning_quiz_keys")
      .select("version_id")
      .limit(1);
    return response.error?.code === "42501" ||
      [401, 403].includes(response.status)
      ? "passed"
      : response.error
        ? "blocked"
        : "failed";
  }
  async function currentUserVerified() {
    if (!connection || !actor) return false;
    const response = await connection.client.auth.getUser();
    return !response.error && response.data.user?.id === actor.id;
  }
  async function profileCheck(): Promise<CheckResult> {
    if (!connection || !actor || !UUID.test(profile)) return "blocked";
    if (
      profileExpected === "deny" &&
      (!positiveProfile.current || !knownProfiles.current.has(profile))
    )
      return "blocked";
    const response = await connection.client.rpc("learning_athlete", {
      target_profile: profile,
    });
    if (profileExpected === "allow") {
      if (response.error) return "blocked";
      if (
        !athleteSchema.safeParse(response.data).success ||
        !learnerKeysAbsent(response.data)
      )
        return "failed";
      positiveProfile.current = true;
      knownProfiles.current.add(profile);
      return "passed";
    }
    return response.error &&
      /outside.*scope|unavailable|not assigned/i.test(response.error.message)
      ? "passed"
      : response.error
        ? "blocked"
        : "failed";
  }
  async function tampered(): Promise<CheckResult> {
    if (!connection || !actor) return "blocked";
    const control = await connection.client.rpc("current_account_role");
    if (control.error || control.data !== actor.role) return "blocked";
    const session = await connection.client.auth.getSession(),
      token = session.data.session?.access_token;
    if (!token) return "blocked";
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[2]) return "blocked";
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    const response = await testFetch()(
      `${TEST_URL}/rest/v1/rpc/current_account_role`,
      {
        method: "POST",
        headers: {
          apikey: connection.key,
          Authorization: "Bearer " + parts.join("."),
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    await response.body?.cancel();
    return response.status === 401 ? "passed" : "failed";
  }
  async function readSample(path: string) {
    if (!connection) throw Error();
    const signed = await connection.client.storage
      .from("training-media")
      .createSignedUrl(path, 60);
    if (signed.error || !signed.data?.signedUrl)
      return {
        allowed: false,
        denial:
          !!signed.error &&
          "statusCode" in signed.error &&
          ["400", "403", "404"].includes(String(signed.error.statusCode)),
      };
    const response = await testFetch()(signed.data.signedUrl);
    if (!response.ok) return { allowed: false, denial: false };
    return { allowed: (await response.text()) === SAMPLE_TEXT, denial: false };
  }
  async function mediaCheck(): Promise<CheckResult> {
    if (!actor || !samplePath(mediaPath)) return "blocked";
    if (!(await currentUserVerified())) return "blocked";
    if (
      mediaExpected === "deny" &&
      (!positiveMedia.current || !knownSamples.current.has(mediaPath))
    )
      return "blocked";
    const result = await readSample(mediaPath);
    if (mediaExpected === "allow") {
      if (!result.allowed) return result.denial ? "failed" : "blocked";
      positiveMedia.current = true;
      knownSamples.current.add(mediaPath);
      return "passed";
    }
    return result.denial ? "passed" : result.allowed ? "failed" : "blocked";
  }
  async function uploadSample(): Promise<CheckResult> {
    if (!connection || !actor || !isStaff(actor.role)) return "blocked";
    if (!sample.current) {
      const resource = crypto.randomUUID();
      sample.current = {
        resource,
        path: `${actor.id}/${resource}/${crypto.randomUUID()}.txt`,
        saved: false,
      };
    }
    const current = sample.current;
    const upload = await connection.client.storage
      .from("training-media")
      .upload(current.path, new Blob([SAMPLE_TEXT], { type: "text/plain" }), {
        upsert: false,
        contentType: "text/plain",
      });
    // A lost upload response is not success. Confirm exact original bytes at the
    // stable path before continuing or recognizing a duplicate on retry.
    if (upload.error && !(await readSample(current.path)).allowed)
      return "blocked";
    const inserted = await connection.client.from("training_resources").insert({
      id: current.resource,
      content,
      asset_path: current.path,
      asset_type: "text/plain",
      asset_name: "repformed-rehearsal-original.txt",
    });
    if (inserted.error) {
      const check = await connection.client
        .from("training_resources")
        .select("id,asset_path")
        .eq("id", current.resource)
        .maybeSingle();
      if (check.error || check.data?.asset_path !== current.path)
        return "blocked";
    }
    if (!(await readSample(current.path)).allowed) return "failed";
    current.saved = true;
    setSampleView({ ...current });
    setMediaPath(current.path);
    positiveMedia.current = true;
    knownSamples.current.add(current.path);
    return "passed";
  }
  function downloadReceipt() {
    const url = URL.createObjectURL(
      new Blob([receiptJson(results)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "repformed-test-acceptance.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main>
      <h1>Isolated learning acceptance</h1>
      <p>
        <strong>REAL TEST PROJECT ONLY — not a simulation.</strong> Target{" "}
        <code>{TEST_REF}</code>. No production connection, signup, emails,
        administrator keys or scheduler controls.
      </p>
      <p>
        Only approved disposable accounts and original synthetic files. Use only
        disposable test passwords, never personal or production passwords.
        Password/session persistence is disabled; reload requires sign-in again.
        Decline browser password saving and never capture filled credentials.
      </p>
      {!connection ? (
        <section aria-label="Public test configuration">
          <h2>1. Public configuration</h2>
          <p>
            In the signed-in Supabase dashboard, select this test project →
            Settings → API Keys, or Connect. Use only its existing public
            publishable/anon key.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              configure();
            }}
          >
            <label>
              Public test publishable/anon key
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
              />
            </label>
            <button>Load public test configuration</button>
          </form>
        </section>
      ) : (
        <section aria-label="Test-user sign-in">
          <h2>2. Disposable account</h2>
          {!actor ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void signIn();
              }}
            >
              <label>
                Approved test account
                <select
                  value={email}
                  disabled={busy}
                  onChange={(e) => setEmail(e.target.value)}
                >
                  {TEST_ACCOUNTS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label>
                Temporary test password
                <input
                  type="password"
                  autoComplete="off"
                  value={password}
                  required
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button disabled={busy}>Sign in to test project</button>
            </form>
          ) : (
            <>
              <p>
                Verified session · <strong>{actor.role}</strong>
              </p>
              <button disabled={busy} onClick={() => void signOut()}>
                Sign out and clear private views
              </button>
              <button disabled={busy} onClick={() => void refreshRole()}>
                Refresh verified role
              </button>
            </>
          )}
        </section>
      )}
      {status && (
        <p role="status" className="harness-status">
          {status}
        </p>
      )}
      {connection && (
        <>
          <nav aria-label="Acceptance views">
            <button
              aria-pressed={view === "checks"}
              onClick={() => setView("checks")}
            >
              Boundary checks
            </button>
            {actor && (
              <button
                aria-pressed={view === "athlete"}
                onClick={() => setView("athlete")}
              >
                Actual athlete UI
              </button>
            )}
            {actor && isStaff(actor.role) && (
              <button
                aria-pressed={view === "bank"}
                onClick={() => setView("bank")}
              >
                Actual training bank
              </button>
            )}
          </nav>
          {view === "checks" && (
            <>
              <section>
                <h2>3. Direct API boundaries</h2>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run("anonymous keys", () => rawKeys(true))
                  }
                >
                  Check anonymous key denial
                </button>
                <button
                  disabled={busy || !actor}
                  onClick={() => void run("raw keys", () => rawKeys(false))}
                >
                  Check signed-in raw key denial
                </button>
                <button
                  disabled={busy || !actor}
                  onClick={() => void run("tampered JWT", tampered)}
                >
                  Check tampered JWT rejection
                </button>
                <p>
                  Denied raw reads do not establish profile isolation. A denial
                  from disabled flags or a network error is not an
                  access-control pass.
                </p>
              </section>
              <RosterChecks
                key={actor ? actor.id + actor.role : "anonymous"}
                client={connection.client}
                anonymous={connection.anonymous}
                actor={actor}
                busy={busy}
                run={(name, action) => void run(name, action)}
              />
              <div className="harness-grid">
                <section>
                  <h2>Profile access</h2>
                  <label>
                    Synthetic profile UUID
                    <input
                      type="text"
                      value={profile}
                      onChange={(e) => setProfile(e.target.value.trim())}
                    />
                  </label>
                  <label>
                    Expected profile result
                    <select
                      value={profileExpected}
                      onChange={(e) => setProfileExpected(e.target.value)}
                    >
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </label>
                  <button
                    disabled={busy || !actor}
                    onClick={() =>
                      void run(
                        profileExpected === "allow"
                          ? "profile allow"
                          : "profile deny",
                        profileCheck,
                      )
                    }
                  >
                    Check profile access
                  </button>
                  <p>
                    For each signed-in actor, first prove an allowed profile
                    works; then test a known out-of-scope profile.
                    Setup/disabled-feature errors are blocked, not passes.
                  </p>
                </section>
                <section>
                  <h2>Private Storage</h2>
                  {actor && isStaff(actor.role) && (
                    <button
                      disabled={busy || sampleView?.saved}
                      onClick={() => void run("sample upload", uploadSample)}
                    >
                      Upload original synthetic text lesson
                    </button>
                  )}
                  {sampleView && (
                    <p>
                      Saved private draft resource{" "}
                      <code>{sampleView.resource}</code>
                      <br />
                      Sample path <code>{sampleView.path}</code>. Do not delete
                      retained media as a shortcut.
                    </p>
                  )}
                  <label>
                    Known synthetic sample path
                    <input
                      type="text"
                      value={mediaPath}
                      onChange={(e) => setMediaPath(e.target.value.trim())}
                    />
                  </label>
                  <label>
                    Expected media result
                    <select
                      value={mediaExpected}
                      onChange={(e) => setMediaExpected(e.target.value)}
                    >
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </label>
                  <button
                    disabled={busy || !actor}
                    onClick={() =>
                      void run(
                        mediaExpected === "allow"
                          ? "media allow"
                          : "media deny",
                        mediaCheck,
                      )
                    }
                  >
                    Check private signing and bytes
                  </button>
                  <p>
                    Only the original generated text file is read. A denied
                    check requires both a known existing sample and a paired
                    allowed read for this actor. URLs/tokens are never displayed
                    or exported. Existing signed URLs last up to their requested
                    TTL.
                  </p>
                </section>
              </div>
            </>
          )}
          {actor && view === "athlete" && (
            <section>
              <h2>Actual learner/staff plan view</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (UUID.test(profile)) setOpenedProfile(profile);
                }}
              >
                <label>
                  Profile UUID to open
                  <input
                    value={profile}
                    onChange={(e) => setProfile(e.target.value.trim())}
                    required
                    pattern="[0-9a-fA-F-]{36}"
                  />
                </label>
                <button>Open actual weekly UI</button>
              </form>
              {openedProfile && learning && (
                <LearningAthlete
                  key={actor.id + actor.role + openedProfile}
                  api={learning}
                  profile={openedProfile}
                  actor={actor.id}
                  staff={isStaff(actor.role)}
                  owner={actor.role === "owner"}
                />
              )}
            </section>
          )}
          {actor && isStaff(actor.role) && view === "bank" && (
            <ConnectedBank
              key={actor.id}
              client={connection.client}
              role={actor.role}
            />
          )}
        </>
      )}
      <section>
        <h2>Redacted acceptance receipt</h2>
        <p>
          Only fixed check names, roles, outcomes and timestamps. UI content,
          passwords, tokens and signed URLs are excluded. Role/session changes
          clear private panels; previous redacted check results remain until
          reset.
        </p>
        <button disabled={!results.length} onClick={downloadReceipt}>
          Download redacted receipt
        </button>
        <button disabled={busy} onClick={() => setResults([])}>
          Reset receipt
        </button>
        <table>
          <caption>Observed checks, not simulated service delivery</caption>
          <thead>
            <tr>
              <th>Check</th>
              <th>Role</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td>{r.check}</td>
                <td>{r.role}</td>
                <td>{r.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

export function ConnectedBank({
  client,
  role,
}: {
  client: SupabaseClient;
  role: AccountRole;
}) {
  const api = useMemo(() => new LearningApi(client), [client]);
  const service = useMemo(() => new StaffService(client), [client]);
  const [resources, setResources] = useState<
      { id: string; title: string; version: number; stage: string }[]
    >([]),
    [message, setMessage] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false),
    [withdrawWeek, setWithdrawWeek] = useState(""),
    [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [versions, setVersions] = useState<{ id: string; label: string }[]>([]);
  const reviewLock = useRef(false);
  const loadProfiles = useCallback<ProfileLoader>(
    async (query, cursor) => {
      const p = await service.page(
        { query, filter: "all", age: "", position: "", coach: "" },
        cursor,
        25,
      );
      return {
        rows: p.rows
          .filter((r) => r.athlete_id)
          .map((r) => ({
            id: r.athlete_id!,
            name: r.athlete_name || "Synthetic athlete",
          })),
        next_cursor: p.page!.next_cursor,
      };
    },
    [service],
  );
  async function refresh() {
    const response = await client.rpc("staff_training_resources");
    if (response.error || !Array.isArray(response.data)) {
      setResources([]);
      setMessage("Resources not loaded. Check authorized staff setup.");
      return;
    }
    setResources(
      response.data
        .filter((r: { content: { title: string } }) =>
          r.content.title.startsWith("REHEARSAL ONLY"),
        )
        .map(
          (r: {
            id: string;
            content: { title: string };
            version: number;
            review_stage: string;
          }) => ({
            id: r.id,
            title: r.content.title,
            version: r.version,
            stage: r.review_stage,
          }),
        ),
    );
    setMessage(
      "Real scoped resources loaded. Drafts still need normal submission/approval before a week releases.",
    );
  }
  async function review(resource: string, decision: string, version: number) {
    if (reviewLock.current) return;
    reviewLock.current = true;
    setReviewBusy(true);
    try {
      const response = await client.rpc("review_training_resource", {
        resource,
        decision,
        note: "Original synthetic acceptance sample only",
        expected_version: version,
      });
      if (response.error) {
        setMessage(
          "Review change not confirmed. Refresh before retrying; no success is assumed.",
        );
        return;
      }
      await refresh();
    } finally {
      reviewLock.current = false;
      setReviewBusy(false);
    }
  }
  async function withdraw() {
    if (reviewLock.current || !confirmWithdraw || !UUID.test(withdrawWeek))
      return;
    reviewLock.current = true;
    setReviewBusy(true);
    try {
      const response = await client.rpc("learning_retract_week", {
        target_week: withdrawWeek,
      });
      setMessage(
        response.error
          ? "Withdrawal not confirmed. Inspect the test version before retrying."
          : "Test week withdrawn. Reload the learner and test NEW signing. Previously issued URLs can remain usable until expiry; history is retained.",
      );
      if (!response.error) {
        setConfirmWithdraw(false);
        setWithdrawWeek("");
      }
    } finally {
      reviewLock.current = false;
      setReviewBusy(false);
    }
  }
  async function loadVersions() {
    try {
      const catalog = await api.catalog();
      setVersions(
        catalog.plans.flatMap((p) =>
          p.weeks_content
            .filter((w) => w.approved_at && !w.retracted_at)
            .map((w) => ({
              id: w.id,
              label: `${p.title} · week ${w.week_number} · version ${w.revision}`,
            })),
        ),
      );
    } catch {
      setVersions([]);
      setMessage(
        "Approved versions not loaded. Verify authorized test access.",
      );
    }
  }
  return (
    <section>
      <h2>Actual staff learning components</h2>
      <button onClick={() => void refresh()}>
        Refresh real test resources
      </button>
      {message && <p role="status">{message}</p>}
      <p>
        Only original sample resources created by this harness appear below.
        Upload is not approval or delivery. A zero list is not proof no files
        exist.
      </p>
      {resources.map((r) => (
        <article key={r.id}>
          <h3>{r.title}</h3>
          <p>
            <code>{r.id}</code> · version {r.version} · {r.stage}
          </p>
          {["draft", "changes_requested"].includes(r.stage) && (
            <button
              disabled={reviewBusy}
              onClick={() => void review(r.id, "submit", r.version)}
            >
              Submit sample for review
            </button>
          )}
          {r.stage === "pending" && ["owner", "manager"].includes(role) && (
            <button
              disabled={reviewBusy}
              onClick={() => void review(r.id, "approve", r.version)}
            >
              Approve original test sample
            </button>
          )}
        </article>
      ))}
      {["owner", "manager"].includes(role) && (
        <details>
          <summary>Controlled withdrawal acceptance</summary>
          <p>
            After the paired media checks, withdraw only the exact synthetic
            week version. This is a real, irreversible test-version change, not
            cleanup. Choices come only from this test project's authorized
            catalog.
          </p>
          <button disabled={reviewBusy} onClick={() => void loadVersions()}>
            Load approved test week versions
          </button>
          <label>
            Synthetic approved week version
            <select
              value={withdrawWeek}
              onChange={(e) => {
                setWithdrawWeek(e.target.value);
                setConfirmWithdraw(false);
              }}
            >
              <option value="">Choose exact test version</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmWithdraw}
              onChange={(e) => setConfirmWithdraw(e.target.checked)}
            />
            I confirm this is the exact synthetic test week
          </label>
          <button
            disabled={
              reviewBusy || !confirmWithdraw || !UUID.test(withdrawWeek)
            }
            onClick={() => void withdraw()}
          >
            Withdraw exact test week
          </button>
        </details>
      )}
      <StaffLearning
        api={api}
        resources={resources}
        loadProfiles={loadProfiles}
        owner={role === "owner"}
        approver={role === "owner" || role === "manager"}
      />
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
