const CACHE_NAME = "gparc-mobile-shell-v9";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./icons/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    const isAppShell = request.mode === "navigate" ||
      url.pathname.endsWith("/index.html") ||
      url.pathname.endsWith("/app.js") ||
      url.pathname.endsWith("/service-worker.js");

    if (isAppShell) {
      // Prefer the latest deployed version; use cache only when offline.
      event.respondWith(
        fetch(request, { cache: "no-cache" })
          .then(response => {
            if (response.ok && !url.pathname.endsWith("/service-worker.js")) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
      );
    } else {
      event.respondWith(
        caches.match(request).then(cached => cached || fetch(request).then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          return response;
        }).catch(() => caches.match("./index.html")))
      );
    }
  } else if (url.hostname === "cdn.jsdelivr.net" && (/sql(?:-wasm)?\.(?:js|wasm)/.test(url.pathname) || url.pathname.includes("/npm/@zxing/library@"))) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok || response.type === "opaque") {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      }))
    );
  }
});