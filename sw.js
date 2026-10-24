/* Player Development: app-shell caching only. No API, authentication or uploaded-media caching. */
const SCOPE = new URL(self.registration.scope);
const PREFIX = `pd-shell-${SCOPE.pathname}-`;
const CACHE = `${PREFIX}b0d6b956c500be49`;
const ASSETS = ["assets/dm-sans-latin-600-normal-Aqo67rzb.woff2","assets/dm-sans-latin-400-normal-CW0RaeGs.woff2","assets/barlow-condensed-latin-700-normal-v1xN8_Wq.woff2","assets/barlow-condensed-latin-800-italic-Cnej2eWp.woff2","assets/dm-sans-latin-600-normal-BmdmIIQ2.woff","assets/dm-sans-latin-400-normal-BwCSEQnW.woff","assets/barlow-condensed-latin-700-normal-Dmwat-ge.woff","assets/barlow-condensed-latin-800-italic-B5BpsPSY.woff","assets/index-B-ncjpaA.css","assets/index-aRLdLIUt.js","assets/index-Da5SxNcZ.js","assets/index-CcCxm0Mt.js","assets/web-LByz4xye.js","assets/index-BRGSt8aZ.js","assets/web-CWb_Ger6.js","assets/web-B5mnhTfq.js","index.html","manifest.webmanifest","favicon.svg","media/training-poster.jpg","media/family-football.jpg","media/solo-football.jpg","media/football-field.jpg","media/credits.txt","icons/app-192.png","icons/app-512.png","icons/maskable-512.png","icons/apple-touch-180.png"].map((name) => new URL(name, SCOPE).href);
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
