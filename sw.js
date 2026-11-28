// Offline cache for the installed app. Bump CACHE with every release so phones pick up the new version.
const CACHE = "svt-v0.54.1";
const FILES = ["./", "index.html", "css/style.css", "js/data.js", "js/balance.js", "js/raid.js", "js/art.js", "js/boats.js", "js/game.js", "js/ui.js", "js/rush.js", "js/bugs.js", "js/vault.js", "js/hoard.js", "js/supers.js", "js/icons.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first so updates show up right away; fall back to the cache when offline.
// Our own files skip the browser's HTTP cache (GitHub Pages caches for 10 minutes), so a release shows up on the next open.
// v0.54.1 (user: "Game won't load ... black screen"): on a slow or stalled connection the page waited on the network
// for every file. Now a file we have cached is served from the cache if the network hasn't answered in WAIT ms (the
// network copy still lands in the cache for next time), and the web fonts come from the cache first.
const WAIT = 1500;
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url), own = url.origin === location.origin, fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  const net = fetch(own ? new Request(e.request.url, { cache: "no-cache" }) : e.request).then((res) => {
    if (res.ok && (own || fonts)) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  e.respondWith(caches.match(e.request).then((hit) => {
    if (!hit) return net;
    if (fonts) return hit;
    return new Promise((done) => {
      const t = setTimeout(() => done(hit), WAIT);
      net.then((res) => { clearTimeout(t); done(res.ok ? res : hit); }, () => { clearTimeout(t); done(hit); });
    });
  }));
});
