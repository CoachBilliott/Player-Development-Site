import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { useMotion } from "./motion";
import type { FootballRenderer } from "./footballRenderer";

/** Original product artwork. The lightweight SVG stays visible if WebGL is unavailable. */
export function FootballScene() {
  const { enabled } = useMotion();
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<FootballRenderer | null>(null);
  const motion = useRef(enabled);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );
  useEffect(() => {
    motion.current = enabled;
    renderer.current?.setMotion(enabled);
  }, [enabled]);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    // The training interface loads first; the 3D engine is a separate, deferred chunk.
    void import("./footballRenderer")
      .then(({ createFootballRenderer }) => {
        if (disposed || !host.current) return;
        const instance = createFootballRenderer(
          host.current,
          motion.current,
          () => {
            if (!disposed) setStatus("fallback");
          },
        );
        renderer.current = instance;
        cleanup = () => instance.dispose();
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("fallback");
      });
    return () => {
      disposed = true;
      cleanup?.();
      renderer.current = null;
    };
  }, []);
  return (
    <div className="football-art" data-renderer={status}>
      <div className="football-aura" aria-hidden="true" />
      <div className="football-canvas" ref={host}>
        <svg
          className="football-fallback"
          viewBox="0 0 500 300"
          role="img"
          aria-label="Original football artwork"
        >
          <defs>
            <radialGradient id="ball-leather" cx="40%" cy="28%" r="75%">
              <stop stopColor="#d19768" />
              <stop offset=".48" stopColor="#89452d" />
              <stop offset="1" stopColor="#301d1b" />
            </radialGradient>
          </defs>
          <g transform="rotate(-20 250 150)">
            <path
              d="M62 150Q250 -38 438 150Q250 338 62 150"
              fill="url(#ball-leather)"
              stroke="#dda978"
              strokeWidth="1.5"
            />
            <path
              d="M62 150Q250 115 438 150M150 82Q170 150 150 218M350 82Q330 150 350 218"
              fill="none"
              stroke="#251b18"
              strokeWidth="3"
            />
            <path
              d="M195 116Q250 103 305 116"
              stroke="#efe4cd"
              strokeWidth="7"
              fill="none"
            />
            {[209, 225, 241, 257, 273, 289].map((x) => (
              <path
                key={x}
                d={`M${x} 105v21`}
                stroke="#fff2d8"
                strokeWidth="5"
                strokeLinecap="round"
              />
            ))}
          </g>
        </svg>
      </div>
      <div className="football-caption">
        <span className="football-caption-line" />
        <span>THE WORK STARTS HERE</span>
        <span className="football-dimension">01 / FOOTBALL</span>
      </div>
      <div
        className="football-turn"
        role="group"
        aria-label="Football artwork view"
      >
        <span>{status === "ready" ? "EXPLORE IN 3D" : "ORIGINAL ARTWORK"}</span>
        <button
          type="button"
          aria-label="Rotate football left"
          disabled={status !== "ready"}
          onClick={() => renderer.current?.rotate(-1)}
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          aria-label="Rotate football right"
          disabled={status !== "ready"}
          onClick={() => renderer.current?.rotate(1)}
        >
          <RotateCw size={16} />
        </button>
      </div>
    </div>
  );
}
