/* Player Development: app-shell caching only. No API, authentication or uploaded-media caching. */
const SCOPE = new URL(self.registration.scope);
const PREFIX = `pd-shell-${SCOPE.pathname}-`;
const CACHE = `${PREFIX}f71cfcb6cd5096a5`;
const ASSETS = ["assets/dm-sans-latin-400-normal-CW0RaeGs.woff2","assets/barlow-condensed-latin-800-italic-Cnej2eWp.woff2","assets/barlow-condensed-latin-700-normal-v1xN8_Wq.woff2","assets/dm-sans-latin-600-normal-Aqo67rzb.woff2","assets/dm-sans-latin-400-normal-BwCSEQnW.woff","assets/barlow-condensed-latin-800-italic-B5BpsPSY.woff","assets/barlow-condensed-latin-700-normal-Dmwat-ge.woff","assets/dm-sans-latin-600-normal-BmdmIIQ2.woff","assets/index-TQOtBjOk.css","assets/index-CezM81oG.js","assets/index-CcCxm0Mt.js","index.html","manifest.webmanifest","favicon.svg","icons/app-192.png","icons/app-512.png","icons/maskable-512.png","icons/apple-touch-180.png"].map((name) => new URL(name, SCOPE).href);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const own = (await caches.keys()).filter((key) => key.startsWith(PREFIX));
    const previous = own.filter((key) => key !== CACHE).at(-1);
    await Promise.all(own.filter((key) => key !== CACHE && key !== previous).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== SCOPE.origin || request.headers.has("range")) return;
  if (request.mode === "navigate" && (url.pathname === SCOPE.pathname || url.pathname === `${SCOPE.pathname}index.html`)) {
    event.respondWith((async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch(request, { signal: controller.signal });
        if (!response.ok) throw new Error("Navigation unavailable");
        return response;
      } catch {
        const cached = await (await caches.open(CACHE)).match(new URL("index.html", SCOPE).href);
        return cached || new Response("Connect to the internet and reopen Player Development.", { status: 503, headers: { "Content-Type": "text/plain" } });
      } finally { clearTimeout(timeout); }
    })());
    return;
  }
  if (ASSETS.includes(url.href) || url.pathname.startsWith(`${SCOPE.pathname}assets/`)) {
    event.respondWith((async () => {
      const own = (await caches.keys()).filter((key) => key.startsWith(PREFIX)).reverse();
      for (const key of own) {
        // App-shell files are identical for every origin header; Vite and some hosts add Vary: Origin.
        const cached = await (await caches.open(key)).match(request, { ignoreVary: true });
        if (cached) return cached;
      }
      return fetch(request);
    })());
  }
});
