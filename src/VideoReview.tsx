import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Camera, Upload, Play, Video, RefreshCw } from "lucide-react";
import type { PrivatePlayer } from "./accounts";
import type { Drill } from "./model";
import { Modal, Notice, Tag } from "./components";
import {
  VideoReviews,
  inspectVideo,
  REVIEW_STATUS,
  type VideoReview,
  type VideoState,
} from "./videoReviews";
import type { SharedState } from "./useSharedContent";
import { isStaff } from "./roles";

function ClipPlayer({
  review,
  service,
}: {
  review: VideoReview;
  service: VideoReviews;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void service
      .url(review)
      .then((value) => {
        if (active) {
          setUrl(value);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (active) {
          setUrl("");
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [review, service, attempt]);
  return (
    <div className="review-player">
      {url && !error && (
        <video
          controls
          playsInline
          preload="metadata"
          src={url}
          aria-label="Private athlete practice video"
          onError={() =>
            setError(
              "This private link expired or the video format could not play. Try opening it again.",
            )
          }
        />
      )}
      {!url && !error && <p role="status">Opening private video…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            className="button secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Reopen video
          </button>
        </>
      )}
    </div>
  );
}
export function AthleteVideoReview({
  client,
  player,
  drills,
}: {
  client: SupabaseClient;
  player: PrivatePlayer;
  drills: Drill[];
}) {
  const service = useMemo(() => new VideoReviews(client), [client]);
  const [state, setState] = useState<VideoState | null>(null);
  const [user, setUser] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [compose, setCompose] = useState(false);
  const [drillId, setDrillId] = useState(drills[0]?.id || "");
  const [selected, setSelected] = useState<{
    file: File;
    seconds: number;
    url: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<VideoReview | null>(null);
  const [removing, setRemoving] = useState<VideoReview | null>(null);
  const lock = useRef(false);
  const draftId = useRef<string | null>(null);
  const draftStarted = useRef(false);
  const [started, setStarted] = useState(false);
  const fileRequest = useRef(0);
  const selectedUrl = useRef("");
  const camera = useRef<HTMLInputElement>(null),
    picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [next, auth] = await Promise.all([
          service.state(player),
          client.auth.getSession(),
        ]);
        if (active) {
          setState(next);
          setUser(auth.data.session?.user.id || "");
        }
      } catch (e) {
        if (active) {
          setState(null);
          setError((e as Error).message);
        }
      }
    };
    void load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [service, player, client]);
  useEffect(
    () => () => {
      fileRequest.current++;
      if (selectedUrl.current) URL.revokeObjectURL(selectedUrl.current);
    },
    [],
  );
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
        e instanceof Error
          ? e.message
          : "The video request could not be confirmed.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    setState(await service.state(player));
  }
  async function choose(file?: File) {
    if (!file || busy || draftStarted.current) return;
    const request = ++fileRequest.current;
    if (selectedUrl.current) URL.revokeObjectURL(selectedUrl.current);
    selectedUrl.current = "";
    setSelected(null);
    draftId.current = null;
    setChecking(true);
    setError("");
    try {
      const seconds = await inspectVideo(file);
      if (request !== fileRequest.current) return;
      if (selectedUrl.current) URL.revokeObjectURL(selectedUrl.current);
      const url = URL.createObjectURL(file);
      selectedUrl.current = url;
      setSelected({ file, seconds, url });
      draftId.current = crypto.randomUUID();
    } catch (e) {
      if (request === fileRequest.current) setError((e as Error).message);
    } finally {
      if (request === fileRequest.current) setChecking(false);
    }
  }
  function clear() {
    fileRequest.current++;
    setChecking(false);
    if (selectedUrl.current) URL.revokeObjectURL(selectedUrl.current);
    selectedUrl.current = "";
    setSelected(null);
    draftId.current = null;
    draftStarted.current = false;
    setStarted(false);
    setCompose(false);
  }
  return (
    <section className="video-review-section" aria-label="Private video review">
      <div className="review-heading">
        <Video size={23} />
        <div>
          <Tag>OPTIONAL VIDEO REVIEW</Tag>
          <h3>Show your coach.</h3>
          <p>Record your drill, preview it, then send it privately.</p>
        </div>
      </div>
      {!state && !error && <p role="status">Loading video review…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!state && error && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void act(refresh)}
        >
          Retry video review
        </button>
      )}
      {state && (
        <>
          {state.can_submit ? (
            <button
              className="button secondary"
              disabled={!drills.length || state.remaining_slots === 0}
              onClick={() => {
                setDrillId(drills[0]?.id || "");
                setCompose(true);
                setError("");
              }}
            >
              <Camera size={19} /> Send a drill video
            </button>
          ) : (
            <p>
              {state.adult_only
                ? "Junior video uploads are not open yet. Verified guardian consent and media retention setup must be completed first."
                : "Video review is an optional package feature. An Owner can enable pilot access and assign your review coach. No payment is collected here."}
            </p>
          )}
          {state.can_submit && (
            <p className="member-fineprint">
              {state.remaining_slots} of 5 pilot video slots available. Delete
              old clips to free a slot. Clips remain stored until you delete
              them; no automatic retention schedule is active.
            </p>
          )}
          {state.can_submit && !drills.length && (
            <p>
              Your coach needs to assign a drill before you can submit its
              video.
            </p>
          )}
          <div className="review-history">
            {state.reviews.map((review) => (
              <article key={review.id} className="review-card">
                <Tag>{REVIEW_STATUS[review.status]}</Tag>
                <h4>{review.drill_title}</h4>
                <p>
                  {new Date(review.created_at).toLocaleDateString()} ·{" "}
                  {Math.round(review.duration_seconds)} sec
                </p>
                {review.feedback && (
                  <div className="coach-feedback">
                    <strong>Coach feedback</strong>
                    <p>{review.feedback}</p>
                  </div>
                )}
                <div className="actions">
                  <button
                    className="text-button"
                    onClick={() => setPlaying(review)}
                  >
                    <Play size={16} /> View video
                  </button>
                  {review.status === "pending_parent" &&
                    review.account_id === user && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await service.approve(review);
                            await refresh();
                            setMessage(
                              "Video approved and sent to your assigned coach.",
                            );
                          })
                        }
                      >
                        Approve & send to coach
                      </button>
                    )}
                  {(review.account_id === user ||
                    review.submitted_by === user) && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setRemoving(review)}
                    >
                      Delete video
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {compose && (
        <Modal
          title="Send a drill video"
          onClose={() => {
            if (!busy)
              void act(async () => {
                if (draftStarted.current && draftId.current)
                  await service.discard(draftId.current);
                clear();
              });
          }}
        >
          <p>
            Up to 60 seconds · 40 MB · MP4, MOV or WebM. Keep other people and
            private information out of the shot.
          </p>
          <label>
            Which drill?
            <select
              value={drillId}
              disabled={busy || started}
              onChange={(e) => setDrillId(e.target.value)}
            >
              {drills.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={camera}
            hidden
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            capture="environment"
            aria-label="Record drill video"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={picker}
            hidden
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            aria-label="Choose drill video"
            onChange={(e) => {
              void choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="actions">
            <button
              className="button secondary"
              disabled={busy || checking || started}
              onClick={() => camera.current?.click()}
            >
              <Camera size={18} /> Record video
            </button>
            <button
              className="button secondary"
              disabled={busy || checking || started}
              onClick={() => picker.current?.click()}
            >
              <Upload size={18} /> Choose video
            </button>
          </div>
          {checking && <p role="status">Checking your video…</p>}
          {selected && (
            <div className="review-player">
              <video
                controls
                playsInline
                preload="metadata"
                src={selected.url}
                aria-label="Your video preview"
              />
              <p>
                {Math.round(selected.seconds)} seconds ·{" "}
                {(selected.file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Notice>
            Only this athlete’s authorized family account and assigned review
            coach can view a submitted clip. It stays private and is never
            posted publicly. A submission does not prove improved athletic
            ability.
          </Notice>
          <div className="actions">
            <button
              className="button"
              disabled={!selected || !drillId || checking || busy}
              onClick={() =>
                void act(async () => {
                  if (!selected || !draftId.current) return;
                  draftStarted.current = true;
                  setStarted(true);
                  await service.send(
                    draftId.current,
                    player,
                    drillId,
                    selected.file,
                    selected.seconds,
                  );
                  clear();
                  await refresh();
                  setMessage(
                    "Video submitted. Check its status and feedback below.",
                  );
                })
              }
            >
              {busy
                ? "Sending… Keep the app open"
                : started
                  ? "Retry sending video"
                  : "Send for coach review"}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  if (draftStarted.current && draftId.current)
                    await service.discard(draftId.current);
                  clear();
                  setMessage(
                    "Video selection canceled. Nothing is waiting for review.",
                  );
                })
              }
            >
              Cancel video
            </button>
          </div>
        </Modal>
      )}
      {playing && (
        <Modal title={playing.drill_title} onClose={() => setPlaying(null)}>
          <ClipPlayer review={playing} service={service} />
        </Modal>
      )}
      {removing && (
        <Modal
          title="Delete this private video?"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <p>
            This removes the stored clip and its review record. This cannot be
            undone.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await service.remove(removing);
                  setRemoving(null);
                  await refresh();
                  setMessage("Private video and review deleted.");
                })
              }
            >
              Delete video permanently
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Keep video
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
export function CoachVideoReviews({ shared }: { shared: SharedState }) {
  if (!shared.signedIn || !shared.service || !isStaff(shared.role))
    return (
      <main className="page narrow">
        <h1>Coach access required.</h1>
        <a className="button" href="#account">
          Log in
        </a>
      </main>
    );
  return (
    <CoachQueue key={shared.session!.user.id} client={shared.service.client} />
  );
}
function CoachQueue({ client }: { client: SupabaseClient }) {
  const service = useMemo(() => new VideoReviews(client), [client]);
  const [rows, setRows] = useState<VideoReview[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [current, setCurrent] = useState<VideoReview | null>(null),
    [feedback, setFeedback] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void service
      .queue()
      .then((v) => {
        if (active) setRows(v);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [service]);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="page narrow">
      <div className="page-intro">
        <Tag>PRIVATE · COACH REVIEW</Tag>
        <h1 tabIndex={-1}>Watch. Coach. Send feedback.</h1>
        <p>
          Only submissions from accounts assigned to you appear here. Family
          approvals happen before clips reach this queue.
        </p>
      </div>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void act(async () => setRows(await service.queue()))}
      >
        <RefreshCw size={17} /> Refresh reviews
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!rows.length && !error && (
        <section className="panel">
          <h2>No videos waiting.</h2>
          <p>
            An Owner enables video review and assigns a coach through Account
            access. No payment is collected by this pilot.
          </p>
        </section>
      )}
      {rows.map((row) => (
        <article className="panel review-card" key={row.id}>
          <Tag>{REVIEW_STATUS[row.status]}</Tag>
          <h2>{row.drill_title}</h2>
          <p>
            {new Date(row.created_at).toLocaleDateString()} ·{" "}
            {Math.round(row.duration_seconds)} sec · Submission{" "}
            {row.id.slice(0, 8)}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setCurrent(row);
              setFeedback(row.feedback);
              setError("");
            }}
          >
            <Play size={17} /> Open review
          </button>
        </article>
      ))}
      {current && (
        <Modal
          title={current.drill_title}
          onClose={() => {
            if (!busy) setCurrent(null);
          }}
        >
          <ClipPlayer review={current} service={service} />
          <label>
            Coaching feedback
            <textarea
              rows={5}
              maxLength={3000}
              value={feedback}
              disabled={busy}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="One thing done well, one clear adjustment, and what to practice next."
            />
          </label>
          <p>
            Keep feedback age-appropriate and specific to practice. Do not
            provide medical advice or guarantee outcomes.
          </p>
          {error && <p role="alert">{error}</p>}
          <button
            className="button"
            disabled={busy || !feedback.trim()}
            onClick={() =>
              void act(async () => {
                await service.feedback(current, feedback);
                setCurrent(null);
                setRows(await service.queue());
                setMessage(
                  "Coach feedback saved to the athlete’s private review.",
                );
              })
            }
          >
            {busy ? "Saving…" : "Send coaching feedback"}
          </button>
        </Modal>
      )}
    </main>
  );
}
