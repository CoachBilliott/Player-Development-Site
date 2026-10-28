import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Facebook,
  Instagram,
  Music2,
  Youtube,
} from "lucide-react";
import { nativeApp } from "./mobile";
import { validSocialLinks, type SocialLink } from "./socialConfig";
import "./social-links.css";

function SocialGlyph({ platform }: { platform: string }) {
  if (platform === "Instagram")
    return <Instagram size={20} aria-hidden="true" />;
  if (platform === "Facebook") return <Facebook size={20} aria-hidden="true" />;
  if (platform === "YouTube") return <Youtube size={20} aria-hidden="true" />;
  if (platform === "TikTok") return <Music2 size={20} aria-hidden="true" />;
  return (
    <span className="social-x-glyph" aria-hidden="true">
      𝕏
    </span>
  );
}
export function SocialLinks({ compact = false }: { compact?: boolean } = {}) {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${import.meta.env.BASE_URL}social-links.json`, {
      signal: controller.signal,
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const values = validSocialLinks(await response.json());
        if (!controller.signal.aborted) setLinks(values);
      })
      .catch(() => {
        /* Unconfigured or unavailable links stay unpublished. */
      });
    return () => controller.abort();
  }, []);
  if (!links.length) return null;
  return (
    <div
      className={`social-links-block ${compact ? "social-links-compact" : ""}`}
    >
      <nav className="social-links" aria-label="Official social accounts">
        {links.map((link) => (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${link.platform} (opens outside Repformed)`}
            title={link.platform}
            onClick={(event) => {
              if (!nativeApp()) return;
              event.preventDefault();
              setError("");
              void import("@capacitor/app-launcher")
                .then(async ({ AppLauncher }) => {
                  const result = await AppLauncher.openUrl({ url: link.url });
                  if (!result.completed) throw new Error("unavailable");
                })
                .catch(() =>
                  setError(
                    "This social account could not open. Use the link on our website instead.",
                  ),
                );
            }}
          >
            {compact ? (
              <SocialGlyph platform={link.platform} />
            ) : (
              <>
                {link.platform} <ArrowUpRight size={16} aria-hidden="true" />
              </>
            )}
          </a>
        ))}
      </nav>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
