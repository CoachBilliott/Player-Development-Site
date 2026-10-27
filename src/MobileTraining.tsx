import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Users } from "lucide-react";
import { Accounts } from "./accounts";
import { FamilyTraining } from "./family";
import { AthleteTraining } from "./FamilyTraining";
import { MemberAccountPage } from "./MemberAccount";
import { Notice, Tag } from "./components";
import { isStaff } from "./roles";
import type { SharedState } from "./useSharedContent";

export type TrainingScreen = "today" | "workouts" | "progress";
type Snapshot = Awaited<ReturnType<Accounts["load"]>>;
type Selection = { userId: string; playerId: string };
type Props = {
  shared: SharedState;
  screen: TrainingScreen;
  selection: Selection;
  onSelect: (selection: Selection) => void;
};
const headings: Record<TrainingScreen, string> = {
  today: "Today’s training.",
  workouts: "Your workouts.",
  progress: "Your practice. Your progress.",
};
const descriptions: Record<TrainingScreen, string> = {
  today: "One clear next session, matched to the athlete you choose.",
  workouts:
    "See the plan, prepare your equipment and follow each practice step.",
  progress:
    "Reported practice and parent reviews. Participation, not an athletic ability score.",
};

export function MobileTraining(props: Props) {
  const { shared } = props;
  if (!shared.signedIn || !shared.service || !shared.membersEnabled)
    return <MemberAccountPage shared={shared} />;
  if (!shared.accessReady || shared.accessError)
    return <MemberAccountPage shared={shared} />;
  if (isStaff(shared.role))
    return (
      <main className="page narrow">
        <h1 tabIndex={-1}>Your staff workspace.</h1>
        <p>Your account has content and administration tools.</p>
        <a className="button" href="#workspace">
          Open staff workspace <ArrowRight size={18} />
        </a>
      </main>
    );
  return (
    <ConnectedTraining
      key={`${shared.session!.user.id}:${shared.role}`}
      {...props}
    />
  );
}

function ConnectedTraining({ shared, screen, selection, onSelect }: Props) {
  const client = shared.service!.client;
  const userId = shared.session!.user.id;
  const selectionKey = `repformed.training-selection.${userId}`;
  const [restoredSelection] = useState(() => {
    try {
      return sessionStorage.getItem(selectionKey) || "";
    } catch {
      return "";
    }
  });
  const service = useMemo(() => new FamilyTraining(client), [client]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      setError("");
      try {
        const next = await new Accounts(client).load();
        if (!stopped && current === request) setSnapshot(next);
      } catch (e) {
        if (!stopped && current === request) {
          setSnapshot(null);
          setError(
            e instanceof Error
              ? e.message
              : "Your training could not be loaded. Reconnect and retry.",
          );
        }
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      stopped = true;
      window.removeEventListener("focus", refresh);
    };
  }, [client, userId, attempt]);

  const linked = snapshot?.players.find((player) => player.owner_id !== userId);
  const parent =
    snapshot?.account?.account_type === "parent" &&
    !snapshot.guardianManaged &&
    !linked;
  const eligible = linked
    ? [linked]
    : snapshot?.account && !snapshot.guardianManaged
      ? snapshot.players
          .filter((player) => player.owner_id === userId)
          .slice(0, parent ? undefined : 1)
      : [];
  const player =
    eligible.find(
      (p) =>
        p.id ===
        (selection.userId === userId ? selection.playerId : restoredSelection),
    ) || eligible[0];
  return (
    <main className={`page app-training app-training-${screen}`}>
      <div className="page-intro app-training-intro">
        <Tag>YOUR TRAINING · FOOTBALL</Tag>
        <h1 tabIndex={-1}>{headings[screen]}</h1>
        {screen !== "today" && <p>{descriptions[screen]}</p>}
      </div>
      {error && (
        <section className="panel app-training-empty">
          <p role="alert" className="form-error">
            {error}
          </p>
          <button
            className="button secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry loading training <RefreshCw size={17} />
          </button>
        </section>
      )}
      {!snapshot && !error && (
        <p role="status">Loading your private training…</p>
      )}
      {snapshot && !player && (
        <section className="panel app-training-empty">
          <Users size={28} />
          <h2>
            {snapshot.guardianManaged
              ? "Your parent manages access."
              : parent
                ? "Add an athlete to get started."
                : "Set up your training profile."}
          </h2>
          <p>
            {snapshot.guardianManaged
              ? "Use Account to check your family connection. Ask your parent to review access; there is no independent adult setup for a guardian-managed account."
              : "Open Account to finish setup or manage your private profiles."}
          </p>
          <a className="button" href="#account">
            Open account <ArrowRight size={17} />
          </a>
          <Notice>
            The adult pilot is invite-only. Real junior enrollment and paid
            packages remain closed.
          </Notice>
        </section>
      )}
      {player && (
        <>
          <section
            className="panel app-athlete-picker"
            aria-label="Current training athlete"
          >
            <span className="app-athlete-avatar" aria-hidden="true">
              {player.nickname.slice(0, 1).toUpperCase()}
            </span>
            {parent && eligible.length > 1 ? (
              <div>
                <label htmlFor="app-training-athlete">Training athlete</label>
                <select
                  id="app-training-athlete"
                  value={player.id}
                  onChange={(event) => {
                    const playerId = event.target.value;
                    try {
                      sessionStorage.setItem(selectionKey, playerId);
                    } catch {
                      /* Selection remains available in memory when session storage is blocked. */
                    }
                    onSelect({ userId, playerId });
                  }}
                >
                  {eligible.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nickname}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <span className="app-athlete-label">
                  {parent
                    ? "FAMILY ATHLETE"
                    : linked
                      ? "CONNECTED ATHLETE"
                      : "YOUR ATHLETE PROFILE"}
                </span>
                <strong>{player.nickname}</strong>
              </div>
            )}
            {screen !== "today" && (
              <p className="app-athlete-meta">
                {player.position} · Age {player.age_group}
                <br />
                {player.experience} · {player.goal}
              </p>
            )}
            {screen === "today" && (
              <a
                href="#account"
                className="app-profile-link"
                aria-label="Athlete profile and permissions"
              >
                <ArrowRight size={18} />
              </a>
            )}
            {screen !== "today" && (
              <a className="text-button" href="#account">
                {parent
                  ? "Manage athletes & permissions"
                  : "Profile & account settings"}{" "}
                <ArrowRight size={16} />
              </a>
            )}
          </section>
          <AthleteTraining
            key={player.id}
            player={player}
            service={service}
            client={client}
            junior={!!linked && player.age_group !== "18+"}
            view={screen}
          />
        </>
      )}
    </main>
  );
}
