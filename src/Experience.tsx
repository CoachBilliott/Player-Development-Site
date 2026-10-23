import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  MoveUpRight,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";
import { MotionContext, useMotion } from "./motion";
import { FootballScene } from "./FootballScene";

export function MotionShell({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [paused, setPaused] = useState(() => {
    try {
      return sessionStorage.getItem("pd-motion-paused") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const enabled = !reduced && !paused;
  return (
    <MotionContext.Provider value={{ enabled, reduced }}>
      <div
        className="experience"
        data-motion={enabled ? "running" : "paused"}
        data-device-motion={reduced ? "reduced" : "normal"}
      >
        {children}
        <button
          className="motion-toggle"
          disabled={reduced}
          aria-label={
            reduced
              ? "Motion off: reduced-motion preference"
              : enabled
                ? "Motion on: pause animations"
                : "Motion off: play animations"
          }
          title={
            reduced
              ? "Following your device’s reduced-motion preference"
              : enabled
                ? "Pause visual animations"
                : "Play visual animations"
          }
          onClick={() => {
            const next = !paused;
            setPaused(next);
            try {
              sessionStorage.setItem("pd-motion-paused", String(next));
            } catch {
              /* Motion remains controllable without browser storage. */
            }
          }}
        >
          {enabled ? <Pause size={16} /> : <Play size={16} />}
          <span>Motion {enabled ? "on" : "off"}</span>
        </button>
      </div>
    </MotionContext.Provider>
  );
}

export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { enabled } = useMotion();
  const [visible, setVisible] = useState(
    () => !("IntersectionObserver" in window),
  );
  useEffect(() => {
    if (
      !enabled ||
      visible ||
      !ref.current ||
      !("IntersectionObserver" in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -24px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, visible]);
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-visible={visible ? "true" : "false"}
    >
      {children}
    </div>
  );
}

export function CinematicField() {
  const { enabled } = useMotion();
  const [focus, setFocus] = useState<"footwork" | "vision">("footwork");
  const [replay, setReplay] = useState(0);
  const routeAnimation = useRef<SVGAnimateMotionElement>(null);
  useEffect(() => {
    // SMIL uses the document timeline; remounting alone does not restart playback.
    if (enabled) routeAnimation.current?.beginElement();
  }, [enabled, focus, replay]);
  const id = useId();
  const route =
    focus === "footwork"
      ? "M 135 350 L 135 230 Q 135 205 165 205 L 390 205 Q 420 205 420 175 L 420 100"
      : "M 135 350 L 280 245 Q 305 225 325 205 L 420 100";
  const end = [420, 100];
  return (
    <div className="field-scene">
      <div className="scene-orbit orbit-one" aria-hidden="true" />
      <div className="scene-orbit orbit-two" aria-hidden="true" />
      <div className="scene-head">
        <span className="eyebrow">
          <span className="signal-dot" /> THE PRACTICE PLAYBOOK
        </span>
        <span className="scene-index">PD / 001</span>
      </div>
      <div
        className="field-stage"
        onPointerMove={(event) => {
          if (!enabled || event.pointerType !== "mouse") return;
          const rect = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty(
            "--pointer-x",
            `${((event.clientX - rect.left) / rect.width) * 100}%`,
          );
          event.currentTarget.style.setProperty(
            "--pointer-y",
            `${((event.clientY - rect.top) / rect.height) * 100}%`,
          );
        }}
      >
        <FootballScene />
        <div className="stadium-halo" aria-hidden="true" />
        <div className="stadium-surface">
          <svg
            viewBox="0 0 620 460"
            role="img"
            aria-label={`Original illustrative football field showing a ${focus === "footwork" ? "walking route" : "path toward open space"}. Not a coaching demonstration.`}
          >
            <defs>
              <linearGradient id={`turf-${id}`} x1="0" y1="1" x2="1" y2="0">
                <stop stopColor="#102b32" />
                <stop offset="1" stopColor="#132b3d" />
              </linearGradient>
              <radialGradient id={`spot-${id}`}>
                <stop stopColor="#85b9ad" stopOpacity=".18" />
                <stop offset="1" stopColor="#85b9ad" stopOpacity="0" />
              </radialGradient>
              <filter
                id={`glow-${id}`}
                x="-100%"
                y="-100%"
                width="300%"
                height="300%"
              >
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <rect
              x="34"
              y="44"
              width="552"
              height="404"
              rx="14"
              fill="#081722"
              stroke="#325365"
            />
            <rect
              x="34"
              y="36"
              width="552"
              height="404"
              rx="14"
              fill="#122a38"
              stroke="#48788a"
              strokeOpacity=".6"
            />
            <rect
              x="34"
              y="28"
              width="552"
              height="404"
              rx="14"
              fill={`url(#turf-${id})`}
              stroke="#6c9ea4"
              strokeOpacity=".45"
              strokeWidth="1.5"
            />
            <rect
              x="34"
              y="28"
              width="552"
              height="404"
              rx="14"
              fill={`url(#spot-${id})`}
            />
            <path
              d="M34 92H586M34 368H586"
              stroke="#80b2bc"
              strokeOpacity=".25"
            />
            {Array.from({ length: 7 }, (_, i) => 92 + i * 46).map((y, i) => (
              <g key={y}>
                <path d={`M34 ${y}H586`} stroke="#a6d1d7" strokeOpacity=".2" />
                {i > 0 && i < 6 && (
                  <>
                    <text
                      x="48"
                      y={y - 12}
                      fontSize="14"
                      fill="#8caeb5"
                      opacity=".8"
                    >
                      {i * 10}
                    </text>
                    <text
                      x="550"
                      y={y - 12}
                      fontSize="14"
                      fill="#8caeb5"
                      opacity=".8"
                    >
                      {i * 10}
                    </text>
                  </>
                )}
              </g>
            ))}
            {Array.from({ length: 12 }, (_, i) => 100 + i * 22).map((y) => (
              <path
                key={y}
                d={`M232 ${y}h8M380 ${y}h8`}
                stroke="#b0d1cf"
                strokeOpacity=".35"
              />
            ))}
            <text
              x="310"
              y="69"
              textAnchor="middle"
              fill="#91b6bb"
              fontSize="12"
              letterSpacing="8"
            >
              PLAYER DEVELOPMENT
            </text>
            <text
              x="310"
              y="410"
              textAnchor="middle"
              fill="#91b6bb"
              fontSize="12"
              letterSpacing="8"
            >
              THE NEXT REP STARTS HERE
            </text>
            <path
              d={route}
              fill="none"
              stroke="#c4fa5d"
              strokeOpacity=".1"
              strokeWidth="28"
              strokeLinecap="round"
              filter={`url(#glow-${id})`}
            />
            <g className="field-activity" key={`${focus}-${replay}-${enabled}`}>
              <path
                className="route-trace"
                d={route}
                pathLength="1"
                fill="none"
                stroke="#c4fa5d"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {enabled ? (
                <circle r="7" fill="#efffc9" stroke="#c4fa5d" strokeWidth="3">
                  <animateMotion
                    ref={routeAnimation}
                    begin="indefinite"
                    path={route}
                    dur="4.2s"
                    repeatCount="1"
                    fill="freeze"
                    calcMode="paced"
                  />
                </circle>
              ) : (
                <circle
                  cx="135"
                  cy="350"
                  r="7"
                  fill="#efffc9"
                  stroke="#c4fa5d"
                  strokeWidth="3"
                />
              )}
            </g>
            <circle
              cx="135"
              cy="350"
              r="18"
              fill="none"
              stroke="#c4fa5d"
              strokeOpacity=".65"
            />
            <circle
              cx={end[0]}
              cy={end[1]}
              r="25"
              fill="#c4fa5d"
              fillOpacity=".06"
              stroke="#c4fa5d"
              strokeOpacity=".6"
            />
            <circle
              className="target-ring"
              cx={end[0]}
              cy={end[1]}
              r="15"
              fill="none"
              stroke="#c4fa5d"
              strokeOpacity=".4"
            />
            <path
              d="m230 295 13-25 13 25zM495 270l13-25 13 25z"
              fill="#ff9b6d"
            />
            <g stroke="#74d7f7" strokeWidth="3" strokeLinecap="round">
              <path d="m300 142 14 14m0-14-14 14M475 335l14 14m0-14-14 14" />
            </g>
          </svg>
        </div>
        <div className="field-annotation">
          <span className="annotation-icon">
            <MoveUpRight size={17} />
          </span>
          <div>
            <strong>
              {focus === "footwork"
                ? "Find your first step."
                : "See the open space."}
            </strong>
            <span>
              {focus === "footwork"
                ? "A clear path. One move at a time."
                : "Look first. Then choose your path."}
            </span>
          </div>
        </div>
        <span className="field-coordinate" aria-hidden="true">
          01 / FOUNDATIONS
        </span>
      </div>
      <div className="scene-controls">
        <div
          className="scene-tabs"
          role="group"
          aria-label="Field illustration focus"
        >
          <button
            aria-pressed={focus === "footwork"}
            onClick={() => {
              setFocus("footwork");
              setReplay((v) => v + 1);
            }}
          >
            Footwork
          </button>
          <button
            aria-pressed={focus === "vision"}
            onClick={() => {
              setFocus("vision");
              setReplay((v) => v + 1);
            }}
          >
            Field vision
          </button>
        </div>
        <button
          className="replay-button"
          onClick={() => setReplay((v) => v + 1)}
          disabled={!enabled}
          aria-label="Replay field animation"
        >
          <Play size={15} />
          <span>Replay</span>
        </button>
      </div>
      <div className="scene-footnote">
        <ShieldCheck size={13} />
        <span>Original illustration · not a coaching demonstration</span>
        <ArrowUpRight size={15} />
      </div>
    </div>
  );
}
