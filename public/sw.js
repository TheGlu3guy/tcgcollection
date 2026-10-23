const CACHE_VERSION = "tcgcollection-shell-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

async function precacheShell() {
  const cache = await caches.open(CACHE_VERSION);
  await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));

  const response = await fetch("./index.html", { cache: "reload" });
  if (!response.ok) return;
  await cache.put("./index.html", response.clone());
  const html = await response.text();
  const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.registration.scope))
    .filter((url) => url.origin === self.location.origin)
    .filter((url) =>
      /\.(?:js|css|png|svg|webmanifest)$/i.test(url.pathname),
    )
    .map((url) => url.href);
  await Promise.allSettled(
    [...new Set(assetUrls)].map((url) => cache.add(url)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell().then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("tcgcollection-") && key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put("./", response.clone());
      await cache.put("./index.html", response.clone());
    }
    return response;
  } catch {
    return (
      (await cache.match(request)) ??
      (await cache.match("./index.html")) ??
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}

async function networkFirstAsset(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("The requested offline asset is not cached.");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.includes("/image-search/") &&
    (url.pathname.endsWith(".json") || url.pathname.endsWith(".bin"))
  ) {
    event.respondWith(networkFirstAsset(request));
    return;
  }
  if (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".bin")
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
