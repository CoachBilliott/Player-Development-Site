import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, Flag, Play, X } from "lucide-react";
import type { Drill } from "./model";
import { getAsset } from "./storage";
export function Logo({ href = "#home" }: { href?: string }) {
  return (
    <a className="brand" href={href} title="Repformed home">
      <img
        className="brand-mark"
        src={`${import.meta.env.BASE_URL}brand/repformed-mark.svg`}
        alt=""
        width="48"
        height="36"
      />
      <span className="brand-name">
        REPFORMED <span>ATHLETE DEVELOPMENT</span>
      </span>
    </a>
  );
}
export function Tag({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return <span className={`tag ${light ? "tag-light" : ""}`}>{children}</span>;
}
export function Field({
  kind = "movement",
  hero = false,
}: {
  kind?: Drill["kind"];
  hero?: boolean;
}) {
  const fieldId = useId();
  return (
    <div className={`field-art ${hero ? "field-hero" : ""}`}>
      <svg
        viewBox="0 0 560 380"
        role="img"
        aria-label={
          kind === "read"
            ? "Illustrative field diagram showing open space"
            : kind === "hands"
              ? "Illustrative ball tracking diagram"
              : "Illustrative walking route between markers"
        }
      >
        <defs>
          <pattern
            id={`grid-${fieldId}`}
            width="70"
            height="380"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0V380"
              stroke="currentColor"
              strokeWidth="1"
              opacity=".18"
            />
          </pattern>
          <marker
            id={`arrow-${fieldId}`}
            markerWidth="8"
            markerHeight="8"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path
              d="M0 0L6 3 0 6"
              fill="none"
              stroke="#d9ed9c"
              strokeWidth="1.4"
            />
          </marker>
        </defs>
        <rect width="560" height="380" fill={`url(#grid-${fieldId})`} />
        {[55, 135, 245, 325].map((y) => (
          <path
            key={y}
            d={`M35 ${y}H525`}
            stroke="currentColor"
            strokeWidth="1"
            opacity=".18"
          />
        ))}
        {[70, 140, 210, 280, 350, 420, 490].map((x) => (
          <g key={x} opacity=".35">
            <path
              d={`M${x - 5} 185h10M${x - 5} 195h10`}
              stroke="currentColor"
              strokeWidth="2"
            />
          </g>
        ))}
        <text x="23" y="207" fill="currentColor" opacity=".4" fontSize="11">
          20
        </text>
        <text x="518" y="207" fill="currentColor" opacity=".4" fontSize="11">
          20
        </text>
        {kind === "movement" ? (
          <>
            <path
              d="M130 292V175Q130 150 158 150H335Q362 150 362 122V73"
              fill="none"
              stroke="#d9ed9c"
              strokeWidth="4"
              strokeDasharray="9 8"
              markerEnd={`url(#arrow-${fieldId})`}
            />
            <circle cx="130" cy="292" r="21" fill="#d9ed9c" />
            <path
              d="m122 292 6 6 11-12"
              fill="none"
              stroke="#153f35"
              strokeWidth="3"
            />
            <path d="m320 247 15-30 15 30z" fill="#ec9666" />
            <path d="m192 96 15-30 15 30z" fill="#ec9666" />
            <text
              x="164"
              y="300"
              fill="currentColor"
              fontSize="12"
              letterSpacing="2"
            >
              START HERE
            </text>
            <circle
              cx="362"
              cy="60"
              r="24"
              fill="none"
              stroke="#d9ed9c"
              opacity=".5"
              strokeWidth="1"
            />
          </>
        ) : kind === "hands" ? (
          <>
            <path
              d="M140 255Q280 60 420 180"
              fill="none"
              stroke="#d9ed9c"
              strokeWidth="4"
              strokeDasharray="8 8"
              markerEnd={`url(#arrow-${fieldId})`}
            />
            <ellipse
              cx="270"
              cy="135"
              rx="35"
              ry="21"
              transform="rotate(-25 270 135)"
              fill="#ec9666"
            />
            <path
              d="m255 142 28-14m-22 4 5 10m3-14 5 10m3-14 5 10"
              stroke="#153f35"
              strokeWidth="2"
            />
            <circle cx="140" cy="255" r="20" fill="#d9ed9c" />
            <circle
              cx="420"
              cy="180"
              r="20"
              fill="none"
              stroke="#d9ed9c"
              strokeWidth="3"
            />
          </>
        ) : (
          <>
            <rect
              x="226"
              y="80"
              width="108"
              height="220"
              rx="18"
              fill="#d9ed9c"
              opacity=".12"
            />
            <path
              d="m148 139 28 28m0-28-28 28m228-28 28 28m0-28-28 28"
              stroke="#ec9666"
              strokeWidth="5"
            />
            <path
              d="M280 280V135"
              stroke="#d9ed9c"
              strokeWidth="4"
              strokeDasharray="8 8"
              markerEnd={`url(#arrow-${fieldId})`}
            />
            <circle cx="280" cy="280" r="18" fill="#d9ed9c" />
            <text x="232" y="63" fill="#d9ed9c" fontSize="12" letterSpacing="2">
              OPEN SPACE
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ) || [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <button
        className="icon-button close"
        aria-label="Close dialog"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
export function DrillCard({
  drill,
  onOpen,
}: {
  drill: Drill;
  onOpen: (d: Drill) => void;
}) {
  return (
    <button className="drill-card" onClick={() => onOpen(drill)}>
      <div className={`drill-image art-${drill.kind}`}>
        <Field kind={drill.kind} />
        <span className="image-time">{drill.minutes} MIN</span>
        <span className="play-bubble">
          <Play size={17} fill="currentColor" />
        </span>
      </div>
      <div className="drill-info">
        <span className="eyebrow">
          {drill.skill}{" "}
          <span className="muted">
            /{" "}
            {drill.source === "local"
              ? "YOUR LOCAL CONTENT"
              : "GUIDED PRACTICE"}
          </span>
        </span>
        <h3>{drill.title}</h3>
        <div className="drill-bottom">
          <span>
            {drill.ages.length === 4
              ? "All ages"
              : drill.ages.map((a) => (a === "18+" ? "18+" : a)).join(" · ")}
          </span>
          <ArrowUpRight size={20} />
        </div>
      </div>
    </button>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <Flag size={18} />
      <div>{children}</div>
    </div>
  );
}
export function AssetPreview({ drill, file }: { drill?: Drill; file?: File }) {
  const [asset, setAsset] = useState<{ url: string; error: string }>({
    url: "",
    error: "",
  });
  useEffect(() => {
    let active = true;
    let url = "";
    async function load() {
      try {
        if (!file && drill?.source === "shared" && drill.assetUrl) {
          if (active) setAsset({ url: drill.assetUrl, error: "" });
          return;
        }
        const blob =
          file || (drill?.assetId ? await getAsset(drill.assetId) : undefined);
        if (!blob) {
          if (active)
            setAsset({
              url: "",
              error:
                "This attachment is not available in this browser. The practice instructions remain available.",
            });
          return;
        }
        url = URL.createObjectURL(blob);
        if (active) setAsset({ url, error: "" });
        else URL.revokeObjectURL(url);
      } catch {
        if (active)
          setAsset({
            url: "",
            error:
              "Could not load the local attachment. Check browser storage permissions.",
          });
      }
    }
    void load();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [drill?.assetId, drill?.assetUrl, drill?.source, file]);
  const type = file?.type || drill?.assetType || "";
  if (asset.error) return <Notice>{asset.error}</Notice>;
  if (!asset.url) return <p role="status">Loading attachment…</p>;
  return (
    <div className="attachment">
      {type.startsWith("video/") ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={asset.url}
          aria-label="Uploaded illustrative media"
          onError={() =>
            setAsset((current) => ({
              ...current,
              error:
                "This video could not be played. Choose a valid MP4 or WebM supported by this browser; the written instructions are still available.",
            }))
          }
        />
      ) : type.startsWith("image/") ? (
        <img
          src={asset.url}
          alt="Uploaded practice reference"
          onError={() =>
            setAsset((current) => ({
              ...current,
              error:
                "This image could not be displayed. Choose a valid PNG, JPEG, or WebP; the written instructions are still available.",
            }))
          }
        />
      ) : (
        <a
          className="button secondary"
          href={asset.url}
          download={file?.name || drill?.assetName}
        >
          Download {file?.name || drill?.assetName} <ArrowUpRight size={16} />
        </a>
      )}
      <small>
        {drill?.source === "shared" ? "Shared" : "Local"} attachment · not a
        verified coaching demonstration
      </small>
    </div>
  );
}
export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <span className="check-line">
      <Check size={16} />
      {children}
    </span>
  );
}
