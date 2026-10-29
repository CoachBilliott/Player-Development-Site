import { PrivateAccessMessage } from "./PrivateShell";
import { StaffLink } from "./StaffLinks";
import { ServiceDesk } from "./ServiceDesk";
import { GroupedReviewPanel, GroupedCoachReviews } from "./GroupedReviews";
import { ReviewServices, SERVICE_LABELS, reviewDate } from "./reviewServices";
import { VideoPreparation } from "./VideoPreparation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Camera, Upload, Play, Video, RefreshCw } from "lucide-react";
import type { PrivatePlayer } from "./accounts";
import type { Drill } from "./model";
import { Modal, Tag } from "./components";
import {
  VideoReviews,
  inspectVideo,
  REVIEW_STATUS,
  type VideoReview,
  type VideoState,
} from "./videoReviews";
import type { SharedState } from "./useSharedContent";
import { isStaff } from "./roles";

export function ClipPlayer({
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
  const requests = useMemo(() => new ReviewServices(client), [client]);
  const [preparing, setPreparing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
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
    setUploadProgress(null);
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
          disabled={busy || preparing}
          onClick={() => void act(refresh)}
        >
          Retry video review
        </button>
      )}
      {state?.service_tracking && !state.adult_only && (
        <>
          <ol className="review-steps" aria-label="How a drill review works">
            <li>1. Choose a drill</li>
            <li>2. Record & preview</li>
            <li>3. Send for feedback</li>
          </ol>
          <p>
            {state.grouped_reviews_ready
              ? "One complete clip set, one focused review."
              : "One video, one focused review."}{" "}
            Feedback within 48 hours after submission and any required parent
            approval. This private pilot does not collect payment or change your
            membership.
          </p>
          {state.services
            .filter((r) => r.state === "requested" && !r.is_grouped)
            .map((row) => (
              <div className="review-service-status" key={row.id}>
                <strong>{SERVICE_LABELS[row.state]}</strong>
                <p>
                  Request {row.id.slice(0, 8)} ·{" "}
                  {state.can_submit
                    ? "Access is ready. Send your drill video below."
                    : "Your request is saved. The team will confirm pilot access before you send a video. No charge was made."}
                </p>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await requests.cancel(row);
                      await refresh();
                      setMessage(
                        "Review request cancelled. No charge was made.",
                      );
                    })
                  }
                >
                  Cancel review request
                </button>
              </div>
            ))}
          {!state.can_submit &&
            player.owner_id === user &&
            !state.services.some((r) => r.state === "requested") && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await requests.request(crypto.randomUUID(), player.id);
                    await refresh();
                    setMessage(
                      "Request received. The team will confirm pilot access. No payment was taken.",
                    );
                  })
                }
              >
                Request one drill review
              </button>
            )}
        </>
      )}
      {state && (
        <>
          {(state.grouped_reviews_ready || state.groups.length > 0) && (
            <GroupedReviewPanel
              client={client}
              player={player}
              drills={drills}
              groups={state.groups}
              canCreate={state.grouped_reviews_ready}
              remaining={state.remaining_slots}
              actor={user}
              pendingRequest={
                state.services.find(
                  (s) => s.state === "requested" && !s.is_grouped,
                )?.id
              }
              onChange={refresh}
            />
          )}
          {state.can_submit && !state.grouped_reviews_ready ? (
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
          ) : !state.can_submit ? (
            <p>
              {state.adult_only
                ? "Junior video uploads are not open yet. Verified guardian consent and media retention setup must be completed first."
                : "Video review is an optional package feature. An Owner can enable pilot access and assign your review coach. No payment is collected here."}
            </p>
          ) : null}
          {state.can_submit && (
            <p className="member-fineprint">
              Storage: {state.remaining_slots} of 5 stored-clip spaces available
              across this account’s athletes. This is storage capacity, not a
              monthly review balance.{" "}
              {state.grouped_reviews_ready
                ? "Grouped reviews accept up to three 60-second clips, at most three minutes total. Four fully retained three-clip reviews will not fit the current five-space account cap."
                : "The current pilot accepts one clip per review, up to 60 seconds."}{" "}
              Clips remain stored until you delete them; no automatic retention
              schedule is active. Deleting a clip also removes its attached
              feedback.
            </p>
          )}
          {state.can_submit && !drills.length && (
            <p>
              Training must be assigned before you can send its video. Contact
              the team for help.
            </p>
          )}
          <div className="review-history">
            {state.reviews
              .filter((review) => !review.review_request_id)
              .map((review) => (
                <article key={review.id} className="review-card">
                  <Tag>{REVIEW_STATUS[review.status]}</Tag>
                  <h4>{review.drill_title}</h4>
                  <p>
                    {new Date(review.created_at).toLocaleDateString()} ·{" "}
                    {Math.round(review.duration_seconds)} sec
                  </p>
                  {state.service_tracking &&
                    state.services.find((r) => r.video_id === review.id)
                      ?.due_at && (
                      <p className="member-fineprint">
                        Feedback target:{" "}
                        {reviewDate(
                          state.services.find((r) => r.video_id === review.id)!
                            .due_at!,
                        )}{" "}
                        ·{" "}
                        {
                          SERVICE_LABELS[
                            state.services.find(
                              (r) => r.video_id === review.id,
                            )!.state
                          ]
                        }
                      </p>
                    )}
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
                          disabled={busy || preparing}
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
                        disabled={busy || preparing}
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
            if (!busy && !preparing)
              void act(async () => {
                if (draftStarted.current && draftId.current)
                  await service.discard(draftId.current);
                clear();
              });
          }}
        >
          <p>Up to 60 seconds · 40 MB · MP4, MOV or WebM.</p>
          <label>
            Which drill?
            <select
              value={drillId}
              disabled={busy || preparing || started}
              onChange={(e) => setDrillId(e.target.value)}
            >
              {drills.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <VideoPreparation
            maximumSeconds={60}
            maxBytes={40 * 1024 * 1024}
            disabled={busy || checking || started}
            onBusyChange={setPreparing}
            onChoose={(file) => void choose(file)}
          />
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
          <div className="actions video-picker-actions">
            <button
              className="button secondary"
              disabled={busy || preparing || checking || started}
              onClick={() => camera.current?.click()}
            >
              <Camera size={18} /> Record video
            </button>
            <button
              className="button secondary"
              disabled={busy || preparing || checking || started}
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
          {busy && uploadProgress !== null && (
            <div role="status" className="upload-transfer">
              <progress
                aria-label="Private video upload progress"
                max={1}
                value={uploadProgress}
              />
              <p>
                {Math.round(uploadProgress * 100)}% transferred
                {uploadProgress >= 1
                  ? " · Confirming the private submission…"
                  : " · Keep this screen open."}
              </p>
            </div>
          )}
          <p className="member-fineprint">
            Private to your authorized family and assigned coach. Keep other
            people and private information out of the shot.
          </p>
          <div className="actions">
            <button
              className="button"
              disabled={!selected || !drillId || checking || busy || preparing}
              onClick={() =>
                void act(async () => {
                  if (!selected || !draftId.current) return;
                  draftStarted.current = true;
                  setStarted(true);
                  setUploadProgress(0);
                  await service.send(
                    draftId.current,
                    player,
                    drillId,
                    selected.file,
                    selected.seconds,
                    ({ loaded, total }) =>
                      setUploadProgress(total ? loaded / total : 0),
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
              disabled={busy || preparing}
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
            This removes the stored clip and its review record, including
            coaching feedback. This cannot be undone.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button
              className="button danger"
              disabled={busy || preparing}
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
              disabled={busy || preparing}
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
      <PrivateAccessMessage
        signedIn={shared.signedIn}
        title="Coach access required."
      >
        Only authorized staff can open private review queues. Your account level
        determines the tools available.
      </PrivateAccessMessage>
    );
  return (
    <CoachQueue
      key={`${shared.session!.user.id}:${shared.role}`}
      client={shared.service.client}
      tracking={shared.serviceTrackingEnabled}
      manager={shared.role === "owner" || shared.role === "manager"}
      owner={shared.role === "owner"}
      actor={shared.session!.user.id}
    />
  );
}
function CoachQueue({
  client,
  tracking,
  manager,
  owner,
  actor,
}: {
  client: SupabaseClient;
  tracking: boolean;
  manager: boolean;
  owner: boolean;
  actor: string;
}) {
  const service = useMemo(() => new VideoReviews(client), [client]);
  const [rows, setRows] = useState<VideoReview[]>([]),
    [loadedVersion, setLoadedVersion] = useState(-1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [queueVersion, setQueueVersion] = useState(0);
  const [current, setCurrent] = useState<VideoReview | null>(null),
    [feedback, setFeedback] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void service
      .queue()
      .then((v) => {
        if (active) {
          setRows(v);
          setLoadedVersion(queueVersion);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [service, queueVersion]);
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
      {tracking && manager && (
        <ServiceDesk
          client={client}
          owner={owner}
          actor={actor}
          refreshKey={queueVersion}
          onChange={() => setQueueVersion((v) => v + 1)}
        />
      )}
      <div className="page-intro">
        <Tag>PRIVATE · COACH REVIEW</Tag>
        {tracking && manager ? (
          <h2>Your assigned videos</h2>
        ) : (
          <h1 tabIndex={-1}>Watch. Coach. Send feedback.</h1>
        )}
        <p>
          Only submissions from accounts assigned to you appear here. Family
          approvals happen before clips reach this queue.
        </p>
      </div>
      <button
        className="button secondary"
        disabled={busy || (!error && loadedVersion !== queueVersion)}
        onClick={() => {
          setError("");
          setQueueVersion((v) => v + 1);
        }}
      >
        <RefreshCw size={17} /> Refresh reviews
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!error && loadedVersion !== queueVersion && (
        <p role="status">Loading your assigned videos…</p>
      )}
      {!rows.length && !error && loadedVersion === queueVersion && (
        <section className="panel review-card">
          <h2>
            {tracking && manager
              ? "No videos assigned to you yet."
              : "No videos waiting."}
          </h2>
          <p>
            An Owner enables video review and assigns its review coach through
            Training → Individual lesson & review permissions. This is separate
            from roster responsibility. No payment is collected here.
          </p>
          {owner && (
            <StaffLink route="training-access">
              Open individual lesson & review permissions
            </StaffLink>
          )}
        </section>
      )}
      {rows.some((r) => r.review_request_id) && (
        <GroupedCoachReviews
          client={client}
          refreshKey={queueVersion}
          ids={[
            ...new Set(
              rows
                .map((r) => r.review_request_id)
                .filter((id): id is string => !!id),
            ),
          ]}
          onChange={() => {
            setQueueVersion((v) => v + 1);
            void act(async () => setRows(await service.queue()));
          }}
        />
      )}
      {rows
        .filter((row) => !row.review_request_id)
        .map((row) => (
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
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  if (tracking && row.status === "queued")
                    await service.start(row);
                  setCurrent(row);
                  setFeedback(row.feedback);
                  setError("");
                  setQueueVersion((v) => v + 1);
                })
              }
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
                setQueueVersion((v) => v + 1);
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
