import { useEffect, useId, useRef, useState } from "react";
import { MoveUpRight, RotateCcw } from "lucide-react";
import { useMotion } from "./motion";
const themes = {
  move: {
    label: "Move",
    title: "Build your foundation.",
    text: "Start with purposeful practice.",
    path: "M90 350 C90 265 510 265 510 350 C510 435 90 435 90 350",
  },
  focus: {
    label: "Focus",
    title: "Make each rep intentional.",
    text: "A clear plan. One next step.",
    path: "M145 350 C145 290 455 290 455 350 C455 410 145 410 145 350",
  },
  build: {
    label: "Build",
    title: "Keep showing up.",
    text: "Practice. Reflect. Return.",
    path: "M190 350 C190 310 410 310 410 350 C410 390 190 390 190 350",
  },
};
export function AthleteScene() {
  const { enabled } = useMotion();
  const [theme, setTheme] = useState<keyof typeof themes>("move"),
    [replay, setReplay] = useState(0);
  const animation = useRef<SVGAnimateMotionElement>(null);
  const id = useId();
  const active = themes[theme];
  useEffect(() => {
    if (enabled) animation.current?.beginElement();
  }, [enabled, theme, replay]);
  return (
    <figure className="athlete-scene" data-theme={theme}>
      <div className="scene-head">
        <span className="eyebrow">
          <span className="signal-dot" /> THE ATHLETE, FIRST
        </span>
        <span className="scene-index">PLAYER DEVELOPMENT</span>
      </div>
      <div
        className="athlete-stage"
        onPointerMove={(event) => {
          if (!enabled || event.pointerType !== "mouse") return;
          const r = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty(
            "--athlete-tilt-x",
            `${-((event.clientY - r.top) / r.height - 0.5) * 5}deg`,
          );
          event.currentTarget.style.setProperty(
            "--athlete-tilt-y",
            `${((event.clientX - r.left) / r.width - 0.5) * 7}deg`,
          );
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--athlete-tilt-x", "0deg");
          event.currentTarget.style.setProperty("--athlete-tilt-y", "0deg");
        }}
      >
        <div className="athlete-glow" aria-hidden="true" />
        <svg
          className="athlete-sculpture"
          viewBox="0 0 600 480"
          role="img"
          aria-label={`Original decorative athlete-development illustration: ${active.label.toLowerCase()}. Not a coaching demonstration or measured performance.`}
        >
          <defs>
            <linearGradient id={`body-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#c9f7f1" />
              <stop offset=".35" stopColor="#60a9b6" />
              <stop offset="1" stopColor="#173f56" />
            </linearGradient>
            <linearGradient id={`limb-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#93d6d8" />
              <stop offset="1" stopColor="#234a60" />
            </linearGradient>
            <linearGradient id={`plinth-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#1c3b48" />
              <stop offset="1" stopColor="#07131e" />
            </linearGradient>
            <radialGradient id={`floor-${id}`}>
              <stop stopColor="#8bc8b3" stopOpacity=".2" />
              <stop offset="1" stopColor="#16303d" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g fill="none" stroke="#52778a" strokeWidth="1" opacity=".3">
            <circle cx="300" cy="235" r="182" />
            <circle cx="300" cy="235" r="217" strokeDasharray="2 14" />
            <path d="M35 235H95M505 235H565M300 8V30M300 440V465" />
          </g>
          <g className="athlete-platform">
            <ellipse
              cx="300"
              cy="382"
              rx="247"
              ry="76"
              fill="#000"
              opacity=".3"
            />
            <path
              d="M65 350V368C65 470 535 470 535 368V350Z"
              fill={`url(#plinth-${id})`}
              stroke="#31596b"
            />
            <ellipse
              cx="300"
              cy="350"
              rx="235"
              ry="86"
              fill="#0e2530"
              stroke="#527d88"
            />
            <ellipse
              cx="300"
              cy="350"
              rx="230"
              ry="81"
              fill={`url(#floor-${id})`}
            />
            <g fill="none" stroke="#638c98" strokeWidth="1" opacity=".5">
              <ellipse cx="300" cy="350" rx="210" ry="65" />
              <ellipse cx="300" cy="350" rx="155" ry="48" />
              <ellipse cx="300" cy="350" rx="110" ry="34" />
            </g>
            <path
              className="athlete-lane"
              d={active.path}
              fill="none"
              strokeWidth="2.5"
              key={`${theme}-${replay}`}
            />
            <g
              className="athlete-marker"
              key={`marker-${theme}-${replay}-${enabled}`}
            >
              <circle
                cx={enabled ? 0 : 90}
                cy={enabled ? 0 : 350}
                r="5"
                fill="var(--athlete-accent)"
              />
              {enabled && (
                <animateMotion
                  ref={animation}
                  dur="6s"
                  repeatCount="indefinite"
                  path={active.path}
                  rotate="auto"
                />
              )}
            </g>
            <path
              d="M104 388L126 395M474 395L496 388M288 427H312"
              stroke="#99c1c2"
              strokeWidth="2"
            />
          </g>
          <g className="athlete-figure">
            <ellipse
              cx="306"
              cy="351"
              rx="76"
              ry="15"
              fill="#030b13"
              opacity=".65"
            />
            <path
              d="M304 206L266 253L225 294"
              stroke="#193949"
              strokeWidth="31"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M304 206L266 253L225 294"
              stroke={`url(#limb-${id})`}
              strokeWidth="24"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M324 214L358 258L335 310"
              stroke="#143546"
              strokeWidth="33"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M324 214L358 258L335 310"
              stroke={`url(#body-${id})`}
              strokeWidth="25"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M309 155L268 184L238 161"
              stroke={`url(#limb-${id})`}
              strokeWidth="19"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M305 145Q327 136 348 155L334 204Q331 224 314 227L283 208Q287 178 305 145Z"
              fill={`url(#body-${id})`}
              stroke="#80b8c0"
              strokeWidth="1.5"
            />
            <path
              d="M342 157L377 191L407 167"
              stroke="#143546"
              strokeWidth="25"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M342 157L377 191L407 167"
              stroke={`url(#body-${id})`}
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M315 143L322 128"
              stroke="#80bdc8"
              strokeWidth="17"
              strokeLinecap="round"
            />
            <circle
              cx="327"
              cy="108"
              r="23"
              fill={`url(#body-${id})`}
              stroke="#c3ece4"
              strokeWidth="1.5"
            />
            <path
              d="M213 294L234 303M328 315L350 319"
              stroke="var(--athlete-accent)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M298 179L319 190M318 158L334 164"
              stroke="#d9f4e9"
              opacity=".65"
              strokeWidth="2"
            />
          </g>
          <g
            className="athlete-plan-label"
            fontFamily="inherit"
            fontSize="10"
            fill="#b3cdd7"
            letterSpacing="2"
          >
            <text x="435" y="112">
              PLAN
            </text>
            <text x="435" y="135">
              PRACTICE
            </text>
            <text x="435" y="158">
              REFLECT
            </text>
            <path
              d="M422 103V162"
              stroke="var(--athlete-accent)"
              strokeWidth="2"
            />
          </g>
        </svg>
        <div className="athlete-caption">
          <span className="annotation-icon">
            <MoveUpRight size={18} />
          </span>
          <span>
            <strong>{active.title}</strong>
            <small>{active.text}</small>
          </span>
        </div>
      </div>
      <div className="athlete-controls">
        <div
          className="scene-tabs"
          role="group"
          aria-label="Explore development themes"
        >
          {Object.entries(themes).map(([key, item]) => (
            <button
              key={key}
              aria-pressed={theme === key}
              onClick={() => setTheme(key as keyof typeof themes)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          aria-label="Replay athlete animation"
          disabled={!enabled}
          onClick={() => setReplay((r) => r + 1)}
        >
          <RotateCcw size={15} />
          Replay
        </button>
      </div>
      <figcaption className="athlete-art-note">
        Original illustration · Not a coaching demonstration
      </figcaption>
    </figure>
  );
}
