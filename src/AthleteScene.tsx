import { useEffect, useRef, useState } from "react";
import { useMotion } from "./motion";
export function AthleteScene() {
  const { enabled } = useMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element || !enabled || failed) return;
    let visible = true,
      stopped = false;
    element.muted = true;
    const update = () => {
      if (stopped) return;
      if (!visible || document.hidden) {
        element.pause();
        return;
      }
      void element.play().catch(() => {
        if (!stopped) setPlaying(false);
      });
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              visible = entries[0]?.isIntersecting ?? true;
              update();
            },
            { threshold: 0.05 },
          );
    observer?.observe(element);
    document.addEventListener("visibilitychange", update);
    element.addEventListener("canplay", update);
    update();
    return () => {
      stopped = true;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
      element.removeEventListener("canplay", update);
      element.pause();
    };
  }, [enabled, failed]);
  const media = `${import.meta.env.BASE_URL}media/`;
  return (
    <figure className="real-athlete-scene">
      <div className="training-film">
        <img
          className="training-poster"
          src={`${media}training-poster.jpg`}
          alt="Licensed stock image of an adult athlete preparing for practice on an outdoor track."
          fetchPriority="high"
        />
        {enabled && !failed && (
          <video
            ref={video}
            className={`hero-training-video ${playing ? "is-playing" : ""}`}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            controls={false}
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
            onPlaying={() => setPlaying(true)}
            onError={(event) => {
              if (event.currentTarget.error) setFailed(true);
            }}
          >
            <source src={`${media}training-loop.mp4`} type="video/mp4" />
            <source src={`${media}training-loop.webm`} type="video/webm" />
          </video>
        )}
        <div className="training-film-shade" aria-hidden="true" />
        <span className="training-film-eyebrow">THE WORK STARTS HERE</span>
        <div className="training-film-title" aria-hidden="true">
          Built in
          <br />
          <span>practice.</span>
        </div>
        <span className="training-film-label">PLAN / PRACTICE / REFLECT</span>
      </div>
      <figcaption className="training-film-credit">
        Licensed stock footage · Not a coaching lesson.{" "}
        <a href={`${media}credits.txt`} target="_blank" rel="noreferrer">
          Footage credits
        </a>
      </figcaption>
    </figure>
  );
}
