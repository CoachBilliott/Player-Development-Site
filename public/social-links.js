/* global document, fetch, URL */
// The same owner-approved configuration serves the app, website and public guides.
// No embeds, tracking scripts or guessed handles.
(() => {
  const source = document.currentScript?.src;
  if (!source) return;
  const platforms = {
    Instagram: ["instagram.com", "www.instagram.com"],
    TikTok: ["tiktok.com", "www.tiktok.com"],
    Facebook: ["facebook.com", "www.facebook.com"],
    X: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
    YouTube: ["youtube.com", "www.youtube.com"],
    Threads: [
      "threads.com",
      "www.threads.com",
      "threads.net",
      "www.threads.net",
    ],
    LinkedIn: ["linkedin.com", "www.linkedin.com"],
    Snapchat: ["snapchat.com", "www.snapchat.com"],
  };
  void fetch(new URL("social-links.json", source), { cache: "no-cache" })
    .then(async (response) => {
      if (!response.ok) return;
      const config = await response.json();
      if (!Array.isArray(config?.links)) return;
      for (const mount of document.querySelectorAll("[data-social-links]")) {
        const nav = document.createElement("nav");
        nav.className = "social-links";
        nav.setAttribute("aria-label", "Official social accounts");
        const seen = new Set();
        for (const item of config.links) {
          if (
            !item ||
            typeof item.platform !== "string" ||
            typeof item.url !== "string"
          )
            continue;
          try {
            const url = new URL(item.url);
            if (
              seen.has(item.platform) ||
              !platforms[item.platform]?.includes(url.hostname) ||
              url.protocol !== "https:" ||
              url.username ||
              url.password ||
              url.port ||
              url.pathname === "/"
            )
              continue;
            seen.add(item.platform);
            const link = document.createElement("a");
            link.href = url.href;
            link.textContent = item.platform + " ↗";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.setAttribute(
              "aria-label",
              item.platform + " (opens outside Repformed)",
            );
            nav.append(link);
          } catch {
            /* Invalid links stay unpublished. */
          }
        }
        if (nav.childElementCount) {
          mount.replaceChildren(nav);
          mount.hidden = false;
        }
      }
    })
    .catch(() => {
      /* Guides remain usable offline without social links. */
    });
})();
