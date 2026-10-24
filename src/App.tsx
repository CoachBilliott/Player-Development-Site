import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flag,
  Footprints,
  Menu,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  AGES,
  GOALS,
  LEVELS,
  POSITIONS,
  PROFILES,
  SPORTS,
  completeRun,
  filterDrills,
  planFor,
  type Drill,
  type Profile,
  type RecordEntry,
  type Run,
  type State,
} from "./model";
import { DRILLS } from "./data";
import { deleteAsset, loadState, putAsset, saveState } from "./storage";
import {
  AssetPreview,
  CheckLine,
  DrillCard,
  Field,
  Logo,
  Modal,
  Notice,
  Tag,
} from "./components";
import { ContentStudio } from "./ContentStudio";
import { useSharedContent } from "./useSharedContent";
import { CinematicField, MotionShell, Reveal } from "./Experience";
import { useMotion } from "./motion";
import { usePwa } from "./pwa";
import { InstallApp } from "./InstallApp";
import { MemberAccountPage } from "./MemberAccount";
import { FamilyDemo } from "./FamilyDemo";
import {
  DemoHub,
  Workspace,
  AccessWorkspace,
  WorkspaceLibrary,
  LaunchReadiness,
  ViewPreview,
  OwnerAccessPreview,
} from "./Workspaces";
import {
  navigationFor,
  isDemoPage,
  PREVIEW_VIEWS,
  type PreviewView,
} from "./views";
const safeHash = () => {
  const value = window.location.hash.slice(1);
  return [
    "home",
    "onboarding",
    "today",
    "library",
    "progress",
    "session",
    "coach",
    "membership",
    "install",
    "account",
    "family-demo",
    "demo",
    "workspace",
    "access",
    "member-library",
    "launch",
    "demo-owner-access",
    "demo-launch",
    ...PREVIEW_VIEWS.map((view) => `demo-${view}`),
  ].includes(value)
    ? value
    : "home";
};
function go(page: string) {
  window.location.hash = page;
}
export default function App() {
  const app = usePwa();
  const shared = useSharedContent();
  const [initial] = useState(loadState);
  const [state, setState] = useState<State>(initial.state);
  const stateSnapshot = useRef<State>(initial.state);
  const [warning, setWarning] = useState(initial.warning);
  const [page, setPage] = useState(safeHash);
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<Drill | null>(null);
  const [ready, setReady] = useState<string[] | null>(null);
  const [ack, setAck] = useState(false);
  const [exit, setExit] = useState(false);
  const [reset, setReset] = useState(false);
  const [toast, setToast] = useState("");
  const sessionLock = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = () => {
      setPage(safeHash());
      setMenu(false);
      window.scrollTo(0, 0);
      requestAnimationFrame(() =>
        mainRef.current?.querySelector<HTMLElement>("h1")?.focus(),
      );
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  function commit(next: State) {
    stateSnapshot.current = next;
    try {
      saveState(next);
      setState(next);
      setWarning("");
      return true;
    } catch {
      setState(next);
      setWarning(
        "Browser storage could not be saved. Changes are temporary and may be lost on refresh. Allow site storage to keep demo progress.",
      );
      return false;
    }
  }
  const drills = [
    ...DRILLS,
    ...shared.resources.filter((d) => d.visibility === "public_sample"),
    ...state.custom,
  ];
  const profile = state.profile;
  function requestStart(ids: string[]) {
    if (!profile) {
      go("onboarding");
      return;
    }
    if (state.run) {
      setDetail(null);
      go("session");
      setToast("Your active session is ready to resume.");
      return;
    }
    setAck(false);
    setDetail(null);
    sessionLock.current = false;
    setReady(ids);
  }
  function begin() {
    if (!profile || !ready || !ack || sessionLock.current) return;
    sessionLock.current = true;
    const run: Run = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      drillIds: ready,
      index: 0,
      phase: "lesson",
    };
    commit({ ...state, run });
    setReady(null);
    go("session");
  }
  function chooseProfile(next: Profile) {
    if (state.run) {
      setToast("Finish or end your active session before changing profiles.");
      go("session");
      return;
    }
    commit({ ...state, profile: next, run: null });
    go("today");
  }
  async function publish(drill: Drill, file: File) {
    await putAsset(drill.id, file);
    const current = stateSnapshot.current;
    const next = {
      ...current,
      custom: [
        ...current.custom,
        {
          ...drill,
          assetId: drill.id,
          assetType: file.type,
          assetName: file.name,
        },
      ],
    };
    try {
      saveState(next);
    } catch {
      await deleteAsset(drill.id).catch(() => undefined);
      throw new Error(
        "Publishing failed because browser storage is unavailable or full. Free space or allow site storage, then try again.",
      );
    }
    stateSnapshot.current = next;
    setState(next);
  }
  async function updateResource(drill: Drill, file?: File) {
    const previous = state.custom.find((d) => d.id === drill.id);
    if (!previous)
      throw new Error(
        "This resource is no longer in the local library. Refresh and try again.",
      );
    if (state.run?.drillIds.includes(drill.id))
      throw new Error(
        "Finish or end the active session before editing its resource.",
      );
    const assetId = file ? crypto.randomUUID() : previous.assetId;
    if (file && assetId) await putAsset(assetId, file);
    const current = stateSnapshot.current;
    if (
      current.run?.drillIds.includes(drill.id) ||
      !current.custom.some((d) => d.id === drill.id)
    ) {
      if (file && assetId) await deleteAsset(assetId).catch(() => undefined);
      throw new Error(
        "This resource changed or entered an active session. Cancel and reopen it before editing.",
      );
    }
    const updated = {
      ...drill,
      assetId,
      assetType: file?.type || previous.assetType,
      assetName: file?.name || previous.assetName,
    };
    const next = {
      ...current,
      custom: current.custom.map((d) => (d.id === drill.id ? updated : d)),
    };
    try {
      saveState(next);
    } catch {
      if (file && assetId) await deleteAsset(assetId).catch(() => undefined);
      throw new Error(
        "Changes could not be saved. Your published resource is unchanged. Free browser storage and try again.",
      );
    }
    stateSnapshot.current = next;
    setState(next);
    if (file && previous.assetId)
      await deleteAsset(previous.assetId).catch(() =>
        setToast(
          "Changes saved. The previous attachment could not be cleared from browser storage.",
        ),
      );
  }
  async function removeResource(drill: Drill) {
    if (state.run?.drillIds.includes(drill.id))
      throw new Error(
        "Finish or end the active session before removing its resource.",
      );
    const next = {
      ...state,
      custom: state.custom.filter((d) => d.id !== drill.id),
    };
    try {
      saveState(next);
    } catch {
      throw new Error(
        "Could not save removal. The resource is still available; allow browser storage and try again.",
      );
    }
    stateSnapshot.current = next;
    setState(next);
    if (drill.assetId)
      await deleteAsset(drill.assetId).catch(() =>
        setToast(
          "Resource removed. Its attachment could not be cleared from browser storage.",
        ),
      );
  }
  const onboarding =
    page === "onboarding" ||
    ((page === "today" || page === "session" || page === "progress") &&
      !profile);
  const nav = navigationFor(page, shared.role);
  const privatePage =
    ["workspace", "account", "access", "member-library", "launch"].includes(
      page,
    ) ||
    (page === "coach" && shared.signedIn);
  const demoPage = isDemoPage(page);
  return (
    <MotionShell>
      <div className="demo-strip">
        <span className="live-dot" />{" "}
        {privatePage
          ? "PRIVATE WORKSPACE"
          : demoPage
            ? "SAMPLE-DATA DEMO"
            : "PLAYER DEVELOPMENT · PREVIEW"}{" "}
        <span className="strip-divider">/</span>
        <span>
          {privatePage
            ? "Private adult & parent-managed profiles"
            : demoPage
              ? "Fictional profiles · No account required"
              : "American football · More sports in the future"}
        </span>
        <span className="strip-note">
          {privatePage ? "Public demo stays separate" : "No account needed"}{" "}
          <ArrowUpRight size={13} />
        </span>
      </div>
      <header className="header">
        <div className="header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Main navigation">
            {nav.map(([id, label]) => (
              <a
                key={id}
                className={page === id ? "active" : ""}
                href={`#${id}`}
                aria-current={page === id ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <a
              className="member-header-link"
              href={shared.signedIn ? "#workspace" : "#account"}
            >
              {shared.signedIn ? "My workspace" : "Member access"}
            </a>
            <a
              className="header-demo"
              href={profile ? "#today" : "#onboarding"}
            >
              {profile ? (
                <>
                  <span className="avatar mini">{profile.name[0]}</span>
                  {profile.name}’s demo
                </>
              ) : (
                <>
                  Try the demo <ArrowUpRight size={17} />
                </>
              )}
            </a>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
                <ArrowUpRight size={18} />
              </a>
            ))}
            <a href="#account">
              {shared.signedIn ? "Account settings" : "Member access"}{" "}
              <ArrowUpRight size={18} />
            </a>
            <a href="#membership">
              Future memberships
              <ArrowUpRight size={18} />
            </a>
            <a href="#install">
              Get the app <ArrowUpRight size={18} />
            </a>
            {!privatePage && (
              <a href="#coach">
                Staff sign-in <ArrowUpRight size={18} />
              </a>
            )}
          </nav>
        )}
      </header>
      {!app.online && (
        <div className="connection-banner" role="status">
          You’re offline. Built-in demo practice can continue after setup.
          Member profiles, shared content and uploads need a connection.
        </div>
      )}
      {warning && (
        <div className="storage-warning" role="alert">
          {warning}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <div ref={mainRef} className="page-transition" key={page}>
        {onboarding ? (
          <Onboarding
            current={profile}
            onChoose={chooseProfile}
            onCancel={() => go(profile ? "today" : "home")}
          />
        ) : page === "demo" ? (
          <DemoHub />
        ) : page === "workspace" ? (
          <Workspace shared={shared} />
        ) : page === "access" ? (
          <AccessWorkspace shared={shared} />
        ) : page === "member-library" ? (
          <WorkspaceLibrary
            key={`${shared.session?.user.id}-${shared.role}`}
            shared={shared}
          />
        ) : page === "launch" ? (
          <LaunchReadiness shared={shared} />
        ) : page === "demo-owner-access" ? (
          <OwnerAccessPreview />
        ) : page === "demo-launch" ? (
          <LaunchReadiness demo />
        ) : page.startsWith("demo-") ? (
          <ViewPreview
            view={page.slice(5) as PreviewView}
            editor={{
              onPublish: publish,
              onUpdate: updateResource,
              onRemove: removeResource,
              resources: state.custom,
              lockedIds: state.run?.drillIds,
            }}
          />
        ) : page === "family-demo" ? (
          <FamilyDemo />
        ) : page === "account" ? (
          <MemberAccountPage shared={shared} />
        ) : page === "home" ? (
          <Home />
        ) : page === "today" && profile ? (
          <Dashboard
            profile={profile}
            drills={drills}
            state={state}
            onStart={requestStart}
            onOpen={setDetail}
          />
        ) : page === "library" ? (
          <Library
            drills={drills.filter(
              (d) => d.source !== "shared" || d.visibility === "public_sample",
            )}
            onOpen={setDetail}
          />
        ) : page === "progress" && profile ? (
          <Progress
            profile={profile}
            history={state.history.filter((h) => h.profileId === profile.id)}
            onReset={() => setReset(true)}
          />
        ) : page === "session" && profile ? (
          <Session
            run={state.run}
            drills={drills}
            profile={profile}
            onUpdate={(run) => commit({ ...state, run })}
            onExit={() => setExit(true)}
            onComplete={(reflection) => {
              if (!state.run) return;
              const next = completeRun(state, state.run, drills, reflection);
              commit(next);
              // Update the view in the same render that clears the run so a
              // second tap cannot activate the empty-session fallback.
              setPage("progress");
              go("progress");
              setToast("Practice recorded. Showing your session history.");
            }}
          />
        ) : page === "install" ? (
          <InstallApp app={app} />
        ) : page === "coach" ? (
          <ContentStudio
            shared={shared}
            onPublish={publish}
            onUpdate={updateResource}
            onRemove={removeResource}
            resources={state.custom}
            lockedIds={state.run?.drillIds}
          />
        ) : (
          <Membership />
        )}
      </div>
      <footer>
        <div className="footer-inner">
          <Logo />
          <p>A clear plan. A purposeful practice.</p>
          <div>
            <a href="#membership">
              Future memberships <ArrowUpRight size={14} />
            </a>
            <a href="#home">About the demo</a>
            <a href="#account">Member access</a>
            <a href="#family-demo">Try the family demo</a>
            <a href="#demo">Explore every demo view</a>
            <a href="#coach">Staff sign-in</a>
            <a href="#install">
              Get the app <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Player Development · Temporary name
          </span>
          <span>Illustrative content · pending qualified coaching review</span>
          <span>
            No athletic, scholarship, or recruiting outcomes guaranteed.
          </span>
        </div>
      </footer>
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          <Tag>
            {detail.skill} · {detail.minutes} MIN
          </Tag>
          <Field kind={detail.kind} />
          <p>{detail.lesson}</p>
          <p className="equipment">
            <Flag size={18} />
            {detail.equipment}
          </p>
          {detail.assetId && <AssetPreview drill={detail} />}
          <h3>Practice walkthrough</h3>
          <ol className="instruction-list">
            {detail.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="coaching-cue">
            <Sparkles size={19} />
            <p>
              <strong>Coaching cue</strong>
              {detail.cue}
            </p>
          </div>
          <small>
            Illustrative, noncontact activity. Pending qualified review.
          </small>
          {profile &&
          (!detail.ages.includes(profile.age) ||
            !detail.levels.includes(profile.level) ||
            (detail.positions.length > 0 &&
              !detail.positions.includes(profile.position))) ? (
            <Notice>
              This activity does not match {profile.name}’s age, position, or
              level.{" "}
              <a href="#onboarding" onClick={() => setDetail(null)}>
                Change the fictional profile
              </a>{" "}
              to try a different audience.
            </Notice>
          ) : (
            <button
              className="button full"
              onClick={() => requestStart([detail.id])}
            >
              {profile ? "Practice this drill" : "Choose a demo player"}
              <ArrowRight size={18} />
            </button>
          )}
        </Modal>
      )}
      {ready && profile && (
        <Modal
          title={
            profile.guardian ? "Parent practice check" : "Before you begin"
          }
          onClose={() => setReady(null)}
        >
          <Tag>ILLUSTRATIVE NONCONTACT PRACTICE</Tag>
          <p>
            {profile.guardian
              ? "This fictional profile is parent-managed. An adult should choose and supervise activities, especially for younger players."
              : "Choose a comfortable pace and a clear, flat practice area."}
          </p>
          <Notice>
            These sample activities are pending qualified coaching review.
            Review every instruction before trying it. Pause if an activity
            feels uncomfortable; this demo does not provide medical advice.
          </Notice>
          <label className="checkbox-label readiness">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            {profile.guardian
              ? "I’m exploring as the parent/guardian and understand that real practice needs adult supervision and qualified guidance."
              : "I understand this is illustrative content, not a reviewed training prescription."}
          </label>
          <div className="actions">
            <button className="button" disabled={!ack} onClick={begin}>
              Begin guided session <ArrowRight size={18} />
            </button>
            <button className="text-button" onClick={() => setReady(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
      {exit && (
        <Modal title="End this session?" onClose={() => setExit(false)}>
          <p>
            Your completed history stays saved. This unfinished session will not
            count as completed practice.
          </p>
          <div className="actions">
            <button
              className="button danger"
              onClick={() => {
                commit({ ...state, run: null });
                setExit(false);
                go("today");
              }}
            >
              End without recording
            </button>
            <button className="button secondary" onClick={() => setExit(false)}>
              Keep practicing
            </button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal title="Reset demo history?" onClose={() => setReset(false)}>
          <p>
            This removes only {profile?.name}’s recorded practice on this
            browser. It cannot be undone. Uploaded content and other fictional
            players stay saved.
          </p>
          <div className="actions">
            <button
              className="button danger"
              onClick={() => {
                commit({
                  ...state,
                  history: state.history.filter(
                    (h) => h.profileId !== profile?.id,
                  ),
                });
                setReset(false);
              }}
            >
              Reset this history
            </button>
            <button
              className="button secondary"
              onClick={() => setReset(false)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </MotionShell>
  );
}
function Home() {
  const { enabled: motionEnabled } = useMotion();
  return (
    <main className="home">
      <section className="hero page">
        <div className="hero-copy">
          <div className="sport-tag">
            <span /> AMERICAN FOOTBALL · AGES 5 TO ADULT
          </div>
          <div className="hero-kicker">
            <span /> BUILT FOR YOUR NEXT CHAPTER
          </div>
          <h1 tabIndex={-1}>
            Your game.
            <br />
            <span className="electric-text">Your next rep.</span>
          </h1>
          <p className="hero-description">
            Turn “what should I work on?” into a clear next step. Guided
            football practice matched to your age, position, experience, and
            goals.
          </p>
          <div className="actions">
            <a className="button" href="#onboarding">
              Try the demo <ArrowRight size={19} />
            </a>
            <button
              className="text-button"
              onClick={() =>
                document.getElementById("how-it-works")?.scrollIntoView({
                  behavior: motionEnabled ? "smooth" : "auto",
                })
              }
            >
              See how it works <ArrowDown size={16} />
            </button>
          </div>
          <p className="member-home-link">
            One platform, different spaces:{" "}
            <a href="#demo">Explore all demo views</a>. Ready for your own
            account?{" "}
            <a href="#account">
              Member access <ArrowUpRight size={14} />
            </a>
          </p>
          <div className="hero-proof">
            <ShieldCheck size={19} />
            <p>
              Fictional players. No account needed.
              <span>Parent-managed for all players under 18.</span>
            </p>
          </div>
        </div>
        <CinematicField />
      </section>
      <Reveal>
        <section id="how-it-works" className="page how-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A SIMPLE ROUTINE</span>
              <h2>A clear path from plan to practice.</h2>
            </div>
            <p>Three steps. One focused session.</p>
          </div>
          <div className="three-grid">
            {[
              {
                n: "01",
                title: "Choose your player",
                text: "Start with a fictional profile. Adjust age, position, experience, and a primary goal.",
                icon: Users,
              },
              {
                n: "02",
                title: "Follow your session",
                text: "Learn the idea, work through the practice steps, and use a clear cue for each drill.",
                icon: Footprints,
              },
              {
                n: "03",
                title: "Record your practice",
                text: "Log completed sessions and a simple reflection. Build a record of participation.",
                icon: TrendingUp,
              },
            ].map((c) => (
              <article className="how-card" key={c.n}>
                <div>
                  <span>{c.n}</span>
                  <c.icon size={22} />
                </div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="page parent-section">
          <div>
            <span className="eyebrow">DESIGNED AROUND THE PLAYER</span>
            <h2>
              The right starting point.
              <br />
              Support at every age.
            </h2>
            <p>
              Young players need short, playful activities and an adult
              alongside them. Older players get a structured starting point for
              their experience and goals.
            </p>
            <a className="text-button" href="#onboarding">
              Meet the sample players <ArrowRight size={17} />
            </a>
          </div>
          <div className="safeguard-list">
            {[
              {
                icon: ShieldCheck,
                title: "Parent-managed for minors",
                text: "An adult manages preferences and supervises practice.",
              },
              {
                icon: Footprints,
                title: "Noncontact sample activities",
                text: "Illustrative instruction, pending qualified coaching review.",
              },
              {
                icon: Users,
                title: "Private by design in this demo",
                text: "Fictional profiles. No public profiles or direct messages.",
              },
            ].map((item) => (
              <div key={item.title}>
                <span>
                  <item.icon size={22} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="page home-scope">
          <div className="scope-strip">
            <div>
              <span className="eyebrow">FOOTBALL FIRST</span>
              <h3>Built for today. Room for what’s next.</h3>
              <p>
                {SPORTS.filter((s) => !s.available)
                  .map((s) => s.name)
                  .join(" and ")}{" "}
                remain future offerings.
              </p>
            </div>
            <a className="button secondary" href="#membership">
              Future packages <ArrowUpRight size={17} />
            </a>
          </div>
          <p className="home-disclaimer">
            Sample-data prototype. All training content is illustrative and
            pending qualified review. Practice records show participation, not
            proven improvement. Scholarship and recruiting outcomes are never
            guaranteed.
          </p>
        </section>
      </Reveal>
    </main>
  );
}
function Onboarding({
  current,
  onChoose,
  onCancel,
}: {
  current: Profile | null;
  onChoose: (p: Profile) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Profile>(current || PROFILES[1]);
  const [guardian, setGuardian] = useState(false);
  const update = (key: keyof Profile, value: string) => {
    setForm({ ...form, [key]: value });
    setGuardian(false);
  };
  return (
    <main className="page onboarding">
      <div className="page-intro centered">
        <Tag>YOUR STARTING POINT</Tag>
        <h1 tabIndex={-1}>Choose your demo player</h1>
        <p>
          Choose a fictional player, or adjust their training preferences.
          <br />
          No names, accounts, or real player information needed.
        </p>
      </div>
      <div className="profile-options">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            className={`profile-option ${form.id === p.id ? "selected" : ""}`}
            onClick={() => {
              setForm(p);
              setGuardian(false);
            }}
          >
            <span className={`avatar avatar-${p.id}`}>{p.name[0]}</span>
            <strong>{p.name}</strong>
            <span>{p.age === "18+" ? "18+ & adults" : `Ages ${p.age}`}</span>
            <small>
              {p.position === "Explore all positions"
                ? "First steps"
                : p.position}
            </small>
            {form.id === p.id && (
              <CheckCircle2 className="profile-selected" size={19} />
            )}
          </button>
        ))}
      </div>
      <form
        className="panel profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          const minor = form.age !== "18+";
          if (minor && !guardian) return;
          const base = PROFILES.find((p) => p.id === form.id);
          const same =
            base &&
            base.age === form.age &&
            base.position === form.position &&
            base.level === form.level &&
            base.goal === form.goal;
          const id = same
            ? form.id
            : `custom:${form.id.split(":")[0]}:${form.age}:${form.position}:${form.level}:${form.goal}`;
          onChoose({
            ...form,
            id,
            name: same ? form.name : "Sample player",
            guardian: minor,
          });
        }}
      >
        <div className="form-heading">
          <div>
            <h2>Make the demo yours.</h2>
            <p>Training preferences for a fictional player.</p>
          </div>
          <Tag>FOOTBALL</Tag>
        </div>
        <div className="form-grid">
          <label>
            Age group
            <select
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
            >
              {AGES.map((a) => (
                <option value={a} key={a}>
                  {a === "18+" ? "18+ & adults" : `Ages ${a}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Football position
            <select
              value={form.position}
              onChange={(e) => update("position", e.target.value)}
            >
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Experience
            <select
              value={form.level}
              onChange={(e) => update("level", e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Main goal
            <select
              value={form.goal}
              onChange={(e) => update("goal", e.target.value)}
            >
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
        {form.age !== "18+" ? (
          <div className="guardian-box">
            <ShieldCheck size={23} />
            <div>
              <strong>Parent-managed demo</strong>
              <p>
                {form.age === "5–7"
                  ? "Short, playful activities with a parent alongside every step."
                  : "A parent or guardian manages this fictional minor’s training preferences and supervises practice."}
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={guardian}
                  onChange={(e) => setGuardian(e.target.checked)}
                  required
                />{" "}
                I’m exploring as a parent or guardian using fictional
                information only.
              </label>
            </div>
          </div>
        ) : (
          <Notice>
            Adult sample profile. All activities are illustrative, noncontact,
            and pending qualified review.
          </Notice>
        )}
        <div className="actions">
          <button className="button" type="submit">
            See my training <ArrowRight size={18} />
          </button>
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <small className="form-footnote">
          Saved in this browser only. No personal information is needed or
          requested.
        </small>
      </form>
    </main>
  );
}
function Dashboard({
  profile,
  drills,
  state,
  onStart,
  onOpen,
}: {
  profile: Profile;
  drills: Drill[];
  state: State;
  onStart: (ids: string[]) => void;
  onOpen: (d: Drill) => void;
}) {
  const plan = planFor(profile, drills);
  const total = plan.reduce((n, d) => n + d.minutes, 0);
  const history = state.history.filter((h) => h.profileId === profile.id);
  return (
    <main className="page dashboard">
      <div className="dashboard-heading">
        <div>
          <div className="eyebrow">
            <span className="green-dot" /> YOUR TRAINING PLAN
          </div>
          <h1 tabIndex={-1}>Today’s training</h1>
          <p>
            {profile.guardian
              ? `You’re managing ${profile.name}’s fictional training.`
              : `Welcome to your sample practice, ${profile.name}.`}{" "}
            Here’s a clear place to start.
          </p>
        </div>
        <a href="#onboarding" className="profile-badge">
          <span className="avatar">{profile.name[0]}</span>
          <span>
            <strong>
              {profile.name} <small>FICTIONAL</small>
            </strong>
            <span>
              {profile.age} · {profile.position}
            </span>
            <small>
              {profile.guardian ? "Parent-managed" : "Adult player"} · Change
              profile
            </small>
          </span>
          <ChevronRight size={17} />
        </a>
      </div>
      <div className="dashboard-grid">
        <section className="next-session">
          <div className="next-copy">
            <Tag light>TODAY’S TRAINING</Tag>
            <h2>
              {profile.age === "5–7"
                ? "Little steps, big curiosity."
                : profile.goal === "Footwork"
                  ? "Find your footing."
                  : profile.goal === "Ball skills"
                    ? "Get a feel for the game."
                    : profile.goal === "Coordination"
                      ? "Move with intention."
                      : "See the next possibility."}
            </h2>
            <p>
              A guided foundations session built around{" "}
              {profile.goal.toLowerCase()}.
            </p>
            <div className="session-meta">
              <span>
                <Clock3 size={17} />
                {total} minutes
              </span>
              <span>
                <BookOpen size={17} />
                {plan.length} drills
              </span>
              <span>
                <ShieldCheck size={17} />
                Noncontact
              </span>
            </div>
            <button
              className="button lime"
              onClick={() =>
                state.run ? go("session") : onStart(plan.map((d) => d.id))
              }
              disabled={!plan.length}
            >
              {state.run ? "Resume session" : "Start today’s session"}{" "}
              <Play size={17} fill="currentColor" />
            </button>
          </div>
          <div className="next-art">
            <Field kind={plan[0]?.kind} />
          </div>
        </section>
        <aside className="why-card">
          <span className="eyebrow">
            <Sparkles size={17} /> WHY THIS FITS
          </span>
          <h3>Matched to your player</h3>
          <p>
            Selected for{" "}
            <strong>
              {profile.age === "18+" ? "adults" : `ages ${profile.age}`}
            </strong>
            , <strong>{profile.level.toLowerCase()}</strong>, and your goal of{" "}
            <strong>{profile.goal.toLowerCase()}</strong>.
          </p>
          <p>
            {profile.position === "Explore all positions"
              ? "Explore foundational skills before choosing a position."
              : `Foundations apply to ${profile.position.toLowerCase()} play. Position-specific resources are included when available.`}
          </p>
          <div className="why-note">
            {profile.guardian ? (
              <ShieldCheck size={18} />
            ) : (
              <Target size={18} />
            )}
            <span>
              {profile.age === "5–7"
                ? "Short activities. Parent alongside. Plenty of room for play."
                : profile.guardian
                  ? "Parent-managed preferences. Adult-supervised practice."
                  : "A comfortable pace. Simple instructions. No contact."}
            </span>
          </div>
          <small>Rule-based sample matching · no AI assessment</small>
        </aside>
      </div>
      <div className="dashboard-lower">
        <section>
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">ONE STEP AT A TIME</span>
              <h2>Inside your session</h2>
            </div>
            <span className="muted">{plan.length} guided activities</span>
          </div>
          <div className="session-list">
            {plan.map((d, i) => (
              <button key={d.id} onClick={() => onOpen(d)}>
                <span className="list-number">0{i + 1}</span>
                <div>
                  <strong>{d.title}</strong>
                  <span>{d.equipment}</span>
                </div>
                <span className="list-time">
                  {d.minutes} min <ArrowUpRight size={19} />
                </span>
              </button>
            ))}
          </div>
        </section>
        <aside className="routine-card">
          <TrendingUp size={26} />
          <span className="eyebrow">BUILD YOUR ROUTINE</span>
          <strong>
            {history.length}
            <small>sessions recorded</small>
          </strong>
          <p>
            Practice history tracks participation, not proven athletic
            improvement.
          </p>
          <a className="text-button" href="#progress">
            See my progress <ArrowRight size={17} />
          </a>
        </aside>
      </div>
      <Notice>
        Before you practice: use a clear, flat space and review the equipment in
        each activity. All content is illustrative and pending qualified
        coaching review.
      </Notice>
      <div className="library-prompt">
        <div>
          <h3>Keep exploring</h3>
          <p>Find more activities in the drill library.</p>
        </div>
        <a className="button secondary" href="#library">
          Browse drills <ArrowRight size={17} />
        </a>
      </div>
    </main>
  );
}
function Library({
  drills,
  onOpen,
}: {
  drills: Drill[];
  onOpen: (d: Drill) => void;
}) {
  const [filters, setFilters] = useState({
    query: "",
    age: "",
    position: "",
    level: "",
    skill: "",
  });
  const filtered = filterDrills(drills, filters);
  const set = (key: keyof typeof filters, value: string) =>
    setFilters({ ...filters, [key]: value });
  return (
    <main className="page library">
      <div className="page-intro">
        <Tag>THE PRACTICE PLAYBOOK</Tag>
        <h1 tabIndex={-1}>Drill library</h1>
        <p>
          Short lessons. Clear instructions. A purpose for every rep.
          <br />
          Explore illustrative American football activities for your starting
          point.
        </p>
      </div>
      <div className="library-tools">
        <label className="search-input">
          <Search size={20} />
          <input
            type="search"
            placeholder="Search drills, skills, or ideas…"
            aria-label="Search drills"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
          />
        </label>
        <div className="filters">
          <label>
            Age group
            <select
              value={filters.age}
              onChange={(e) => set("age", e.target.value)}
            >
              <option value="">All ages</option>
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {a === "18+" ? "18+ & adults" : a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Position
            <select
              value={filters.position}
              onChange={(e) => set("position", e.target.value)}
            >
              <option value="">All positions</option>
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Experience
            <select
              value={filters.level}
              onChange={(e) => set("level", e.target.value)}
            >
              <option value="">All levels</option>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Skill
            <select
              value={filters.skill}
              onChange={(e) => set("skill", e.target.value)}
            >
              <option value="">All skills</option>
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="results-heading">
        <p role="status">
          <strong>{filtered.length}</strong>{" "}
          {filtered.length === 1 ? "activity" : "activities"} to explore
        </p>
        <button
          className="text-button"
          onClick={() =>
            setFilters({
              query: "",
              age: "",
              position: "",
              level: "",
              skill: "",
            })
          }
        >
          Clear filters <X size={15} />
        </button>
      </div>
      {filtered.length ? (
        <div className="three-grid">
          {filtered.map((d) => (
            <DrillCard key={d.id} drill={d} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={35} />
          <h2>No drills match just yet.</h2>
          <p>Try a broader age group, position, or skill.</p>
          <button
            className="button secondary"
            onClick={() =>
              setFilters({
                query: "",
                age: "",
                position: "",
                level: "",
                skill: "",
              })
            }
          >
            Clear all filters
          </button>
        </div>
      )}
      <Notice>
        Original illustrative practice resources, not certified coaching
        demonstrations. Local coach uploads appear only on the browser where
        they were published.
      </Notice>
    </main>
  );
}
function Session({
  run,
  drills,
  profile,
  onUpdate,
  onExit,
  onComplete,
}: {
  run: Run | null;
  drills: Drill[];
  profile: Profile;
  onUpdate: (run: Run) => void;
  onExit: () => void;
  onComplete: (r: RecordEntry["reflection"]) => void;
}) {
  const [reflection, setReflection] =
    useState<RecordEntry["reflection"]>("Prefer not to say");
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(false);
  const [paused, setPaused] = useState(false);
  if (!run)
    return (
      <main className="page empty-state">
        <Footprints size={40} />
        <h1 tabIndex={-1}>Your next step is waiting.</h1>
        <p>Choose today’s guided session to begin.</p>
        <a className="button" href="#today">
          Go to today’s training <ArrowRight size={18} />
        </a>
      </main>
    );
  const current = drills.find((d) => d.id === run.drillIds[run.index]);
  if (!current)
    return (
      <main className="page">
        <h1 tabIndex={-1}>This practice resource is unavailable.</h1>
        <p>End the session and choose another activity from the library.</p>
        <button className="button" onClick={onExit}>
          End session
        </button>
      </main>
    );
  const update = (next: Run) => {
    setChecked(false);
    setAttempt(false);
    setPaused(false);
    onUpdate(next);
    window.scrollTo(0, 0);
  };
  const done = run.phase === "done";
  return (
    <main className="page training">
      <div className="training-top">
        <a className="text-button" href="#today">
          <ArrowLeft size={17} /> Save & return to Today
        </a>
        <button className="text-button" onClick={onExit}>
          End session <X size={17} />
        </button>
      </div>
      <div className="session-progress" aria-label="Session progress">
        {run.drillIds.map((id, i) => (
          <div
            className={
              done || i < run.index
                ? "finished"
                : i === run.index
                  ? "current"
                  : ""
            }
            key={id}
          >
            <span>{done || i < run.index ? <Check size={13} /> : i + 1}</span>
            <b>{drills.find((d) => d.id === id)?.title}</b>
          </div>
        ))}
      </div>
      {done ? (
        <section className="session-finish panel">
          <span className="finish-icon">
            <Flag size={34} />
          </span>
          <Tag>YOU SHOWED UP</Tag>
          <h1 tabIndex={-1}>Practice complete</h1>
          <p>
            You’ve reached the end of {run.drillIds.length} guided{" "}
            {run.drillIds.length === 1 ? "activity" : "activities"}. Record only
            practice you actually completed.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={attempt}
              onChange={(e) => setAttempt(e.target.checked)}
            />{" "}
            {profile.guardian
              ? "As the parent/guardian, I confirm the sample practice was completed."
              : "I confirm the sample practice was completed."}
          </label>
          <label>
            How did practice feel?{" "}
            <span className="muted">Optional reflection</span>
            <select
              value={reflection}
              onChange={(e) =>
                setReflection(e.target.value as RecordEntry["reflection"])
              }
            >
              <option>Prefer not to say</option>
              <option>Felt comfortable</option>
              <option>Still practicing</option>
            </select>
          </label>
          <Notice>
            This records self-reported participation, not athletic ability or
            improvement. Watching a lesson alone does not count as completed
            practice.
          </Notice>
          <button
            className="button"
            disabled={!attempt}
            onClick={() => onComplete(reflection)}
          >
            Record completed practice <CheckCircle2 size={18} />
          </button>
        </section>
      ) : (
        <>
          <div className="training-heading">
            <span className="eyebrow">
              DRILL {run.index + 1} OF {run.drillIds.length}{" "}
              <span className="muted">
                /{" "}
                {run.phase === "lesson"
                  ? "UNDERSTAND IT"
                  : "TRY IT AT YOUR PACE"}
              </span>
            </span>
            <h1 tabIndex={-1}>{current.title}</h1>
            <p>
              <Clock3 size={17} />
              {current.minutes} min practice <span>·</span> {current.skill}
              <span>·</span> Noncontact
            </p>
          </div>
          <div className="training-grid">
            <section className="training-main">
              <div className="lesson-art">
                <Field kind={current.kind} />
                <div>
                  <span>ILLUSTRATIVE FIELD DIAGRAM</span>
                  <span>
                    {run.phase === "lesson" ? "01 / LEARN" : "02 / PRACTICE"}
                  </span>
                </div>
              </div>
              {current.assetId && <AssetPreview drill={current} />}
              <div className="panel lesson-copy">
                {run.phase === "lesson" ? (
                  <>
                    <Tag>THE SHORT LESSON</Tag>
                    <h2>
                      A little understanding
                      <br />
                      before the first step.
                    </h2>
                    <p>{current.lesson}</p>
                    <Notice>
                      {profile.guardian
                        ? "Parent: read the activity first and supervise the practice. "
                        : ""}
                      This is illustrative content pending qualified review. No
                      contact, sprinting, or performance assessment.
                    </Notice>
                    <button
                      className="button"
                      onClick={() => update({ ...run, phase: "practice" })}
                    >
                      Show practice steps <ArrowRight size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <Tag>PUT IT INTO PRACTICE</Tag>
                    <h2>Take it one step at a time.</h2>
                    <ol className="instruction-list">
                      {current.steps.map((s, i) => (
                        <li key={i}>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="coaching-cue">
                      <Sparkles size={21} />
                      <p>
                        <strong>Keep this cue in mind</strong>
                        {current.cue}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPaused(!paused)}
                    >
                      {paused ? "Continue practice" : "Pause for a break"}{" "}
                      {paused ? <Play size={16} /> : <Clock3 size={16} />}
                    </button>
                    {paused ? (
                      <Notice>
                        Practice paused. Take the time you need. Your place is
                        saved; continue when ready.
                      </Notice>
                    ) : (
                      <>
                        <label className="checkbox-label readiness">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                          />
                          {profile.guardian
                            ? "We completed the practice steps together."
                            : "I completed the practice steps, not only the lesson."}
                        </label>
                        <button
                          className="button"
                          disabled={!checked}
                          onClick={() =>
                            update(
                              run.index === run.drillIds.length - 1
                                ? { ...run, phase: "done" }
                                : {
                                    ...run,
                                    index: run.index + 1,
                                    phase: "lesson",
                                  },
                            )
                          }
                        >
                          {run.index === run.drillIds.length - 1
                            ? "Finish & reflect"
                            : "Next drill"}
                          <ArrowRight size={18} />
                        </button>
                      </>
                    )}
                    <button
                      className="text-button back-lesson"
                      onClick={() => update({ ...run, phase: "lesson" })}
                    >
                      <ArrowLeft size={15} /> Review lesson
                    </button>
                  </>
                )}
              </div>
            </section>
            <aside>
              <div className="panel training-kit">
                <span className="eyebrow">SET YOURSELF UP</span>
                <h3>
                  <Flag size={21} /> What you’ll need
                </h3>
                <p>{current.equipment}</p>
                <hr />
                <h3>
                  <ShieldCheck size={21} /> Before you move
                </h3>
                <p>
                  Check for a clear, flat space. Keep it comfortable and
                  noncontact. Pause if anything feels uncomfortable.
                </p>
                {profile.guardian && <Tag>PARENT SUPERVISION</Tag>}
                <small>
                  Instructions are illustrative. Qualified coaching review is
                  required before real use.
                </small>
              </div>
              <div className="up-next">
                <span className="eyebrow">UP NEXT</span>
                <h3>
                  {drills.find((d) => d.id === run.drillIds[run.index + 1])
                    ?.title || "Reflect & record your practice"}
                </h3>
                <p>
                  {run.index + 1 < run.drillIds.length
                    ? "Another small step in your session."
                    : "A moment to notice how practice felt."}
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
function Progress({
  profile,
  history,
  onReset,
}: {
  profile: Profile;
  history: RecordEntry[];
  onReset: () => void;
}) {
  const minutes = history.reduce((n, h) => n + h.minutes, 0);
  return (
    <main className="page progress-page">
      <div className="page-intro">
        <Tag>THE WORK YOU’VE PUT IN</Tag>
        <h1 tabIndex={-1}>Practice progress</h1>
        <p>
          {profile.name}’s fictional practice history. A record of showing up,
          <br />
          with space to reflect along the way.
        </p>
      </div>
      <div className="stats-grid">
        <article>
          <Flag size={23} />
          <strong>{history.length}</strong>
          <span>Sessions recorded</span>
        </article>
        <article>
          <Clock3 size={23} />
          <strong>{minutes}</strong>
          <span>Planned practice minutes*</span>
        </article>
        <article>
          <Footprints size={23} />
          <strong>{history.reduce((n, h) => n + h.titles.length, 0)}</strong>
          <span>Drills practiced</span>
        </article>
      </div>
      <p className="metric-note">
        *Minutes are estimated from each activity, not measured with a timer.
        All records are self-reported.
      </p>
      <Notice>
        Practice history shows participation only. It does not measure athletic
        improvement, validate technique, or predict recruiting or scholarship
        outcomes. Video completion is never used as proof of ability.
      </Notice>
      <div className="section-heading compact">
        <h2>Your practice history</h2>
        {history.length > 0 && (
          <button className="text-button" onClick={onReset}>
            Reset demo history
          </button>
        )}
      </div>
      {!history.length ? (
        <div className="empty-state panel">
          <Flag size={36} />
          <h2>Your first small step is ahead.</h2>
          <p>
            Complete a guided session and record it to see your history here.
          </p>
          <a className="button" href="#today">
            Find today’s training <ArrowRight size={18} />
          </a>
        </div>
      ) : (
        <div className="history-list">
          {history.map((h) => (
            <article key={h.id}>
              <span className="history-check">
                <Check size={21} />
              </span>
              <div>
                <span className="eyebrow">
                  {new Date(h.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <h3>{h.titles.join(" + ")}</h3>
                <p>
                  {h.titles.length} {h.titles.length === 1 ? "drill" : "drills"}{" "}
                  · {h.minutes} planned minutes · Self-reported practice
                </p>
                <span className="reflection">
                  {h.reflection === "Prefer not to say"
                    ? "No reflection added"
                    : h.reflection}
                </span>
              </div>
              <Tag>RECORDED</Tag>
            </article>
          ))}
        </div>
      )}
      <p className="local-note">
        Saved on this browser for this fictional profile only. No public
        profiles, comparisons, or leaderboards.
      </p>
    </main>
  );
}
function Membership() {
  return (
    <main className="page memberships">
      <div className="page-intro centered">
        <Tag>LOOKING AHEAD</Tag>
        <h1 tabIndex={-1}>Future memberships</h1>
        <p>
          A look at possible future memberships.
          <br />
          These are product concepts, not purchasable plans.
        </p>
      </div>
      <div className="three-grid">
        {[
          {
            name: "Foundations",
            for: "For a confident first step",
            items: [
              "Age-aware guided practice",
              "A simple weekly routine",
              "Parent-managed experience",
            ],
            icon: Footprints,
          },
          {
            name: "Position pathways",
            for: "For a little more direction",
            items: [
              "Deeper position-specific learning",
              "Structured practice series",
              "Reflection and practice history",
            ],
            icon: Target,
          },
          {
            name: "Team & coach",
            for: "For learning together",
            items: [
              "Reviewed coach-created content",
              "Team practice assignments",
              "Parent and coach collaboration",
            ],
            icon: Users,
          },
        ].map((p, i) => (
          <article
            className={`package-card ${i === 1 ? "featured" : ""}`}
            key={p.name}
          >
            <Tag light={i === 1}>FUTURE CONCEPT</Tag>
            <p.icon size={32} />
            <h2>{p.name}</h2>
            <p>{p.for}</p>
            <div className="package-price">Pricing to be determined</div>
            <div className="check-lines">
              {p.items.map((t) => (
                <CheckLine key={t}>{t}</CheckLine>
              ))}
            </div>
            <span className="package-status">Not available to purchase</span>
          </article>
        ))}
      </div>
      <section className="aspiration panel">
        <Trophy size={35} />
        <div>
          <h2>A foundation for what comes later.</h2>
          <p>
            Scholarship and recruiting readiness may become longer-term learning
            topics. This prototype offers neither recruiting services nor
            exposure, evaluations, scholarships, or guaranteed outcomes.
          </p>
        </div>
      </section>
      <Notice>
        No checkout, billing, enrollment, or waitlist is active. American
        football is the only sport in this demo; other sports remain future
        offerings.
      </Notice>
      <div className="centered">
        <a href="#onboarding" className="button">
          Explore the free sample demo <ArrowRight size={18} />
        </a>
      </div>
    </main>
  );
}
