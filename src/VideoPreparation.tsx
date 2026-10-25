import { useCallback, useEffect, useRef, useState } from "react";
import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import { Film, X } from "lucide-react";

type Chosen =
  { id: string; duration: number; canceled: false } | { canceled: true };
type Prepared =
  | {
      id: string;
      fileURL: string;
      size: number;
      duration: number;
      canceled: false;
    }
  | { canceled: true };
const video = registerPlugin<{
  chooseVideo(): Promise<Chosen>;
  prepareVideo(options: {
    id: string;
    start: number;
    end: number;
    maxBytes: number;
  }): Promise<Prepared>;
  cancelPreparation(): Promise<void>;
  releaseVideo(options: { id: string }): Promise<void>;
  addListener(
    name: "preparationProgress",
    callback: (event: { progress: number }) => void,
  ): Promise<PluginListenerHandle>;
}>("TrainingVideo");
export function VideoPreparation({
  onChoose,
  disabled = false,
  maxBytes = 40 * 1024 * 1024,
  maximumSeconds = 180,
  onBusyChange,
}: {
  onChoose: (file: File) => void;
  disabled?: boolean;
  maxBytes?: number;
  maximumSeconds?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [chosen, setChosen] = useState<Extract<
    Chosen,
    { canceled: false }
  > | null>(null);
  const [start, setStart] = useState(0),
    [end, setEnd] = useState(0);
  const [phase, setPhase] = useState<"idle" | "choosing" | "preparing">("idle");
  const [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const active = useRef(true),
    lock = useRef(false),
    request = useRef(0),
    owned = useRef(new Set<string>());
  const onChooseRef = useRef(onChoose);
  useEffect(() => {
    onChooseRef.current = onChoose;
  }, [onChoose]);
  useEffect(() => {
    onBusyChange?.(phase !== "idle");
    return () => onBusyChange?.(false);
  }, [phase, onBusyChange]);
  const invalidate = useCallback(() => {
    request.current++;
  }, []);
  useEffect(() => {
    const ownedFiles = owned.current;
    active.current = true;
    return () => {
      active.current = false;
      invalidate();
      void video
        .cancelPreparation()
        .catch(() => undefined)
        .then(async () => {
          for (const id of ownedFiles)
            await video.releaseVideo({ id }).catch(() => undefined);
          ownedFiles.clear();
        });
    };
  }, [invalidate]);
  if (Capacitor.getPlatform() !== "ios") return null;
  async function release(id: string) {
    owned.current.delete(id);
    await video.releaseVideo({ id }).catch(() => undefined);
  }
  async function choose() {
    if (disabled || lock.current) return;
    lock.current = true;
    const current = ++request.current;
    setError("");
    setPhase("choosing");
    try {
      const value = await video.chooseVideo();
      if (value.canceled) return;
      owned.current.add(value.id);
      if (!active.current || request.current !== current) {
        await release(value.id);
        return;
      }
      if (chosen) await release(chosen.id);
      setChosen(value);
      setStart(0);
      setEnd(Math.min(value.duration, maximumSeconds));
    } catch (e) {
      if (active.current && request.current === current)
        setError(
          e instanceof Error ? e.message : "The video could not be opened.",
        );
    } finally {
      lock.current = false;
      if (active.current && request.current === current) setPhase("idle");
    }
  }
  async function prepare() {
    if (!chosen || lock.current || disabled) return;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start ||
      end > chosen.duration + 0.05 ||
      end - start > maximumSeconds
    ) {
      setError(
        `Choose a clip within the video, up to ${maximumSeconds} seconds.`,
      );
      return;
    }
    lock.current = true;
    const current = ++request.current;
    setError("");
    setPhase("preparing");
    setProgress(0);
    let listener: PluginListenerHandle | undefined;
    try {
      listener = await video.addListener(
        "preparationProgress",
        ({ progress: value }) => {
          if (active.current && request.current === current)
            setProgress(Math.max(0, Math.min(1, value)));
        },
      );
      const value = await video.prepareVideo({
        id: chosen.id,
        start,
        end,
        maxBytes: Math.min(maxBytes, 12 * 1024 * 1024),
      });
      if (value.canceled) return;
      owned.current.add(value.id);
      try {
        if (!active.current || request.current !== current) return;
        const response = await fetch(Capacitor.convertFileSrc(value.fileURL));
        if (!response.ok)
          throw new Error("The prepared video could not be read. Try again.");
        const blob = await response.blob();
        if (!blob.size || blob.size > maxBytes)
          throw new Error(
            "The prepared clip is too large. Choose a shorter section.",
          );
        if (!active.current || request.current !== current) return;
        onChooseRef.current(
          new File([blob], `training-${Date.now()}.mp4`, { type: "video/mp4" }),
        );
        await release(chosen.id);
        setChosen(null);
      } finally {
        await release(value.id);
      }
    } catch (e) {
      if (active.current && request.current === current)
        setError(
          e instanceof Error
            ? e.message
            : "Video preparation failed. Shorten the clip and retry.",
        );
    } finally {
      await listener?.remove();
      lock.current = false;
      if (active.current && request.current === current) setPhase("idle");
    }
  }
  async function cancel() {
    request.current++;
    await video.cancelPreparation().catch(() => undefined);
    if (chosen) await release(chosen.id);
    if (active.current) {
      setChosen(null);
      setPhase("idle");
      setError("");
    }
    lock.current = false;
  }
  return (
    <section className="video-preparation" aria-label="Prepare iPhone video">
      {!chosen && (
        <button
          type="button"
          className="button secondary full"
          disabled={disabled || phase !== "idle"}
          onClick={() => void choose()}
        >
          <Film size={19} />
          {phase === "choosing"
            ? "Opening your videos…"
            : "Choose & prepare iPhone video"}
        </button>
      )}
      {chosen && (
        <>
          <h3>Choose the part to use</h3>
          <p>
            {Math.round(chosen.duration)} seconds available. Prepare up to{" "}
            {maximumSeconds} seconds as a smaller MP4. Your original stays in
            Photos.
          </p>
          <div className="clip-range">
            <label>
              Start (seconds)
              <input
                type="number"
                min={0}
                max={chosen.duration}
                step={0.1}
                value={start}
                disabled={disabled || phase !== "idle"}
                onChange={(e) => setStart(Number(e.target.value))}
              />
            </label>
            <label>
              End (seconds)
              <input
                type="number"
                min={0}
                max={chosen.duration}
                step={0.1}
                value={end}
                disabled={disabled || phase !== "idle"}
                onChange={(e) => setEnd(Number(e.target.value))}
              />
            </label>
          </div>
          <button
            type="button"
            className="button full"
            disabled={disabled || phase !== "idle"}
            onClick={() => void prepare()}
          >
            {phase === "preparing" ? "Preparing MP4…" : "Prepare this clip"}
          </button>
        </>
      )}
      {phase === "preparing" && (
        <div role="status">
          <progress
            max={1}
            value={progress}
            aria-label="Video preparation progress"
          />
          <p>
            {Math.round(progress * 100)}% · Keep the app open. Nothing uploads
            yet.
          </p>
        </div>
      )}
      {(chosen || phase !== "idle") && (
        <button
          type="button"
          className="text-button"
          onClick={() => void cancel()}
        >
          <X size={16} />
          Cancel video preparation
        </button>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}
