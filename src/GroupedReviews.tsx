import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrivatePlayer } from "./accounts";
import type { Drill } from "./model";
import { Modal, Tag } from "./components";
import { VideoPreparation } from "./VideoPreparation";
import { ClipPlayer } from "./VideoReview";
import { inspectVideo } from "./videoReviews";
import { ReviewGroups, type ReviewGroup } from "./reviewGroups";
import { SERVICE_LABELS, reviewDate } from "./reviewServices";

type Chosen = { id: string; file: File; seconds: number; url: string };
export function GroupedReviewPanel({
  client,
  player,
  drills,
  groups,
  canCreate,
  remaining,
  actor,
  pendingRequest,
  onChange,
}: {
  client: SupabaseClient;
  player: PrivatePlayer;
  drills: Drill[];
  groups: ReviewGroup[];
  canCreate: boolean;
  remaining: number;
  actor: string;
  pendingRequest?: string;
  onChange: () => Promise<void>;
}) {
  const api = useMemo(() => new ReviewGroups(client), [client]);
  const videos = useMemo(() => api.videos(), [api]);
  const [compose, setCompose] = useState(false),
    [chosen, setChosen] = useState<Chosen[]>([]),
    [drill, setDrill] = useState(drills[0]?.id || "");
  const [current, setCurrent] = useState<ReviewGroup | null>(null),
    [removing, setRemoving] = useState<ReviewGroup | null>(null);
  const [running, setRunning] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState("");
  const lock = useRef(false),
    intent = useRef(""),
    files = useRef(new Map<string, { file: File; seconds: number }>()),
    urls = useRef(new Set<string>());
  const owner = player.owner_id === actor;
  const busy = running || preparing;
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setRunning(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Review was not confirmed. Refresh and retry.",
      );
    } finally {
      lock.current = false;
      setRunning(false);
      setProgress("");
    }
  }
  async function add(selected: File[]) {
    if (!selected.length) return;
    await run(async () => {
      if (
        chosen.length + selected.length > 3 ||
        chosen.length + selected.length > remaining
      )
        throw new Error(
          "Choose at most three clips and stay within the stored-clip spaces available to this account.",
        );
      const next: Chosen[] = [];
      try {
        for (const file of selected) {
          const seconds = await inspectVideo(file);
          const url = URL.createObjectURL(file);
          urls.current.add(url);
          next.push({ id: crypto.randomUUID(), file, seconds, url });
        }
        if ([...chosen, ...next].reduce((n, c) => n + c.seconds, 0) > 180)
          throw new Error("Keep the complete review within three minutes.");
      } catch (e) {
        for (const c of next) {
          URL.revokeObjectURL(c.url);
          urls.current.delete(c.url);
        }
        throw e;
      }
      setChosen([...chosen, ...next]);
      intent.current = pendingRequest || crypto.randomUUID();
    });
  }
  async function upload(g: ReviewGroup) {
    let latest = g;
    for (const c of g.clips) {
      if (c.status !== "uploading") continue;
      const selected = files.current.get(c.id);
      if (!selected) continue;
      setProgress(`Uploading clip ${c.clip_ordinal}…`);
      await videos.sendReserved(
        c,
        selected.file,
        selected.seconds,
        ({ loaded, total }) =>
          setProgress(
            `Uploading clip ${c.clip_ordinal}: ${total ? Math.round((loaded / total) * 100) : 0}%`,
          ),
      );
      files.current.delete(c.id);
      latest = await api.detail(g.id);
      setCurrent(latest);
    }
    setCurrent(await api.detail(g.id));
    await onChange();
  }
  return (
    <section className="panel review-card" aria-label="Grouped drill reviews">
      <h3>One review. Your best views.</h3>
      <p>
        Up to three clips of the same drill, each no longer than 60 seconds.
        Three minutes total is one review. Storage is shared across the account;
        this is not a paid-credit balance.
      </p>
      {canCreate && owner && (
        <button
          className="button secondary"
          disabled={busy || !drills.length || remaining === 0}
          onClick={() => {
            setChosen([]);
            intent.current = pendingRequest || crypto.randomUUID();
            setDrill(drills[0]?.id || "");
            setCompose(true);
            setError("");
          }}
        >
          Prepare a review
        </button>
      )}
      <button
        className="text-button"
        disabled={busy}
        onClick={() => void run(onChange)}
      >
        Refresh grouped reviews
      </button>
      {error && !compose && !current && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {groups.map((g) => (
        <article className="review-service-status" key={g.id}>
          <Tag>
            {g.erased
              ? g.clips.length
                ? "Review withdrawn · clip cleanup needed"
                : "Media and feedback deleted"
              : SERVICE_LABELS[g.state]}
          </Tag>
          <h4>{g.drill_title}</h4>
          <p>
            {g.erased
              ? "Review media removed"
              : `${g.clip_count} ${g.clip_count === 1 ? "clip" : "clips"} · ${Math.round(g.total_seconds)} seconds total · One review`}
          </p>
          <p>
            {g.due_at
              ? `Review target: ${reviewDate(g.due_at)}`
              : "48-hour target starts after you send every completed clip."}
          </p>
          {g.feedback && (
            <div className="coach-feedback">
              <strong>Coach feedback</strong>
              <p>{g.feedback}</p>
            </div>
          )}
          {!g.erased && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => setCurrent(await api.detail(g.id)))
              }
            >
              Open grouped review
            </button>
          )}
          {owner && g.clips.length > 0 && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setRemoving(g)}
            >
              Delete grouped review
            </button>
          )}
        </article>
      ))}
      {compose && (
        <Modal
          title="Prepare one drill review"
          onClose={() => {
            if (!busy)
              void run(async () => {
                setCompose(false);
                await onChange();
                setMessage(
                  "Preparation closed. Check your private review list for any draft saved before an interrupted response.",
                );
              });
          }}
        >
          <label>
            Drill for this review
            <select
              value={drill}
              disabled={busy}
              onChange={(e) => setDrill(e.target.value)}
            >
              {drills.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <p>
            {remaining} stored-clip spaces available. Review allowance is
            separate from storage capacity. No charge or credit is used here.
          </p>
          <label>
            Choose up to three review clips
            <input
              type="file"
              multiple
              accept="video/mp4,video/quicktime,video/webm"
              disabled={busy}
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                e.target.value = "";
                void add(list);
              }}
            />
          </label>
          <label>
            Record one review clip
            <input
              type="file"
              capture="environment"
              accept="video/*"
              disabled={busy}
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                e.target.value = "";
                void add(list);
              }}
            />
          </label>
          <VideoPreparation
            maximumSeconds={60}
            maxBytes={40 * 1024 * 1024}
            disabled={busy || chosen.length >= 3}
            onBusyChange={setPreparing}
            onChoose={(file) => void add([file])}
          />
          {chosen.map((c, n) => (
            <section key={c.id} aria-label={`Selected clip ${n + 1}`}>
              <h3>
                Clip {n + 1} · {Math.round(c.seconds)} seconds
              </h3>
              <video
                style={{ width: "100%", maxHeight: 260 }}
                controls
                playsInline
                preload="metadata"
                src={c.url}
                aria-label={`Preview selected clip ${n + 1}`}
              />
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setChosen(chosen.filter((v) => v.id !== c.id));
                  URL.revokeObjectURL(c.url);
                  urls.current.delete(c.url);
                  intent.current = pendingRequest || crypto.randomUUID();
                }}
              >
                Remove selected clip {n + 1}
              </button>
            </section>
          ))}
          {error && <p role="alert">{error}</p>}
          {progress && <p role="status">{progress}</p>}
          <button
            className="button"
            disabled={busy || !chosen.length || !drill}
            onClick={() =>
              void run(async () => {
                for (const c of chosen) files.current.set(c.id, c);
                const g = await api.create(
                  intent.current,
                  player.id,
                  chosen.map((c) => ({
                    id: c.id,
                    training_id: drill,
                    media_type: c.file.type,
                    byte_size: c.file.size,
                    duration_seconds: c.seconds,
                  })),
                );
                setCompose(false);
                setCurrent(g);
                await onChange();
                await upload(g);
              })
            }
          >
            {busy ? "Preparing clips…" : "Upload review clips"}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setCompose(false);
              void run(onChange);
            }}
          >
            Close preparation
          </button>
        </Modal>
      )}
      {current && (
        <Modal
          title="Your complete drill review"
          onClose={() => {
            if (!busy) setCurrent(null);
          }}
        >
          <h3>{current.drill_title}</h3>
          <p>
            {SERVICE_LABELS[current.state]} · One review · {current.clip_count}{" "}
            clips
          </p>
          {current.due_at && <p>Review target: {reviewDate(current.due_at)}</p>}
          {current.clips.map((c) => (
            <section key={c.id} aria-label={`Review clip ${c.clip_ordinal}`}>
              <h3>
                Clip {c.clip_ordinal} · {Math.round(c.duration_seconds)} seconds
              </h3>
              {c.status !== "uploading" ? (
                <ClipPlayer review={c} service={videos} />
              ) : (
                owner && (
                  <label>
                    Choose clip {c.clip_ordinal} to resume
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void run(async () => {
                            const seconds = await inspectVideo(file);
                            if (
                              file.size !== c.byte_size ||
                              file.type !== c.media_type ||
                              Math.abs(seconds - c.duration_seconds) > 0.05
                            )
                              throw new Error(
                                "Choose the same reserved clip, or delete this unfinished review and start again.",
                              );
                            files.current.set(c.id, { file, seconds });
                            setMessage(
                              `Clip ${c.clip_ordinal} selected. Retry remaining uploads.`,
                            );
                          });
                      }}
                    />
                  </label>
                )
              )}
            </section>
          ))}
          {current.feedback && (
            <div className="coach-feedback">
              <strong>Coach feedback</strong>
              <p>{current.feedback}</p>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          {progress && <p role="status">{progress}</p>}
          {owner && !current.erased && current.state === "uploading" && (
            <div className="actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void run(() => upload(current))}
              >
                Retry remaining uploads
              </button>
              <button
                className="button"
                disabled={
                  busy ||
                  current.clips.length !== current.clip_count ||
                  current.clips.some((c) => c.status !== "queued")
                }
                onClick={() =>
                  void run(async () => {
                    const g = await api.submit(current.id);
                    setCurrent(g);
                    await onChange();
                    setMessage(
                      "One complete review sent. Your 48-hour target has started. No payment was taken.",
                    );
                  })
                }
              >
                Send complete review
              </button>
            </div>
          )}
          {owner && current.clips.length > 0 && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRemoving(current);
                setCurrent(null);
              }}
            >
              Delete grouped review
            </button>
          )}
        </Modal>
      )}
      {removing && (
        <Modal
          title="Delete this complete review?"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <p>
            This removes every stored clip in this review and its coaching
            feedback. It cannot be undone. No automatic deletion or paid-credit
            refund is performed.
          </p>
          {error && <p role="alert">{error}</p>}
          <button
            className="button danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.remove(removing);
                setRemoving(null);
                await onChange();
                setMessage("Grouped clips and feedback deleted.");
              })
            }
          >
            Delete all grouped clips and feedback
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Keep grouped review
          </button>
        </Modal>
      )}
    </section>
  );
}

export function GroupedCoachReviews({
  client,
  ids,
  onChange,
  refreshKey = 0,
}: {
  client: SupabaseClient;
  ids: string[];
  onChange: () => void;
  refreshKey?: number;
}) {
  const api = useMemo(() => new ReviewGroups(client), [client]);
  const videos = useMemo(() => api.videos(), [api]);
  const [groups, setGroups] = useState<ReviewGroup[]>([]),
    [current, setCurrent] = useState<ReviewGroup | null>(null),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    key = ids.join(",");
  useEffect(() => {
    let active = true;
    void Promise.all(
      key
        .split(",")
        .filter(Boolean)
        .map((id) => api.detail(id)),
    )
      .then((v) => {
        if (active) {
          setGroups(v);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setGroups([]);
          setCurrent(null);
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [api, key, refreshKey]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review was not confirmed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-label="Assigned grouped reviews">
      {error && !current && <p role="alert">{error}</p>}
      {groups.map((g) => (
        <article key={g.id} className="panel review-card">
          <Tag>{SERVICE_LABELS[g.state]}</Tag>
          <h2>{g.drill_title}</h2>
          <p>
            {g.clip_count} {g.clip_count === 1 ? "clip" : "clips"} ·{" "}
            {Math.round(g.total_seconds)} seconds total · One response
          </p>
          <p>{g.due_at && `Target: ${reviewDate(g.due_at)}`}</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const next = await api.start(g);
                setCurrent(next);
                setText(next.feedback);
              })
            }
          >
            Open grouped review
          </button>
        </article>
      ))}
      {current && (
        <Modal
          title="Coach the complete review"
          onClose={() => {
            if (!busy) setCurrent(null);
          }}
        >
          <h3>{current.drill_title}</h3>
          {current.clips.map((c) => (
            <section key={c.id}>
              <h3>Clip {c.clip_ordinal}</h3>
              <ClipPlayer review={c} service={videos} />
            </section>
          ))}
          <label>
            Feedback for the complete review
            <textarea
              rows={5}
              maxLength={3000}
              value={text}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <p>
            One specific coaching response for all clips. No medical advice or
            guaranteed outcomes.
          </p>
          {error && <p role="alert">{error}</p>}
          <button
            className="button"
            disabled={busy || !text.trim()}
            onClick={() =>
              void run(async () => {
                await api.feedback(current, text);
                setCurrent(null);
                setGroups(await Promise.all(ids.map((id) => api.detail(id))));
                onChange();
              })
            }
          >
            Send one review response
          </button>
        </Modal>
      )}
    </section>
  );
}
