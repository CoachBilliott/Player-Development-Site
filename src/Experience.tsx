import { useEffect, useRef, useState, type ReactNode } from "react";
import { MotionContext, useMotion } from "./motion";

export function MotionShell({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const enabled = !reduced;
  return (
    <MotionContext.Provider value={{ enabled, reduced }}>
      <div
        className="experience"
        data-motion={enabled ? "running" : "paused"}
        data-device-motion={reduced ? "reduced" : "normal"}
      >
        {children}
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
