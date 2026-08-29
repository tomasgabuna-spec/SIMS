// SIMS service worker — caches the app shell so the game works with
// zero internet connection. Firebase (cloud classroom) is left alone:
// those requests go straight to the network and simply fail gracefully
// offline, same as they already do in script.js.

const CACHE_VERSION = "sims-cache-v7";

// Everything needed to play SIMS fully offline (practice, missions,
// word problems, time trial, progress/badges — all already localStorage-based).
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./firebase-config.js",
  "./manifest.json",
  "./assets/sims-grid-bg.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only manage our own app-shell files. Let Firebase's CDN scripts and
  // the Firebase Realtime Database calls go straight to the network —
  // caching a partial SDK response would be worse than letting it fail.
  if (url.origin !== self.location.origin) {
    return;
  }

  if (req.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Serve from cache instantly, but refresh it in the background
        // when a connection is available so updates aren't stuck forever.
        const refresh = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
            }
            return res;
          })
          .catch(() => null);
        event.waitUntil(refresh);
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
