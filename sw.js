// Offline cache for the installed app. Bump CACHE with every release so phones pick up the new version.
const CACHE = "svt-v0.36.1";
const FILES = ["./", "index.html", "css/style.css", "js/data.js", "js/balance.js", "js/raid.js", "js/art.js", "js/boats.js", "js/game.js", "js/ui.js", "js/rush.js", "js/vault.js", "js/hoard.js", "js/icons.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first so updates show up right away; fall back to the cache when offline.
// Our own files skip the browser's HTTP cache (GitHub Pages caches for 10 minutes), so a release shows up on the next open.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const own = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    fetch(own ? new Request(e.request.url, { cache: "no-cache" }) : e.request).then((res) => {
      if (res.ok && own) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
