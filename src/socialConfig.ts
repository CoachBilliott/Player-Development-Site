export type SocialLink = { platform: string; url: string };

const platforms: Record<string, readonly string[]> = {
  Instagram: ["instagram.com", "www.instagram.com"],
  TikTok: ["tiktok.com", "www.tiktok.com"],
  Facebook: ["facebook.com", "www.facebook.com"],
  X: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  YouTube: ["youtube.com", "www.youtube.com"],
  Threads: ["threads.com", "www.threads.com", "threads.net", "www.threads.net"],
  LinkedIn: ["linkedin.com", "www.linkedin.com"],
  Snapchat: ["snapchat.com", "www.snapchat.com"],
};

/** Publish only explicit HTTPS profile links, never guessed handles or placeholders. */
export function validSocialLinks(value: unknown): SocialLink[] {
  if (!value || typeof value !== "object" || !("links" in value)) return [];
  if (!Array.isArray(value.links)) return [];
  const seen = new Set<string>();
  return value.links.flatMap((item: unknown): SocialLink[] => {
    if (!item || typeof item !== "object") return [];
    const { platform, url } = item as Partial<SocialLink>;
    if (typeof platform !== "string" || typeof url !== "string") return [];
    try {
      const link = new URL(url);
      if (
        seen.has(platform) ||
        !platforms[platform]?.includes(link.hostname) ||
        link.protocol !== "https:" ||
        link.username ||
        link.password ||
        link.port ||
        link.pathname === "/"
      )
        return [];
      seen.add(platform);
      return [{ platform, url: link.href }];
    } catch {
      return [];
    }
  });
}
