import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { nativeApp } from "./mobile";
import { validSocialLinks, type SocialLink } from "./socialLinks";
import "./social-links.css";

export function SocialLinks() {
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
    <div className="social-links-block">
      <nav className="social-links" aria-label="Official social accounts">
        {links.map((link) => (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${link.platform} (opens outside Repformed)`}
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
            {link.platform} <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        ))}
      </nav>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
