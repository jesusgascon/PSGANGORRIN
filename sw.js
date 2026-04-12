importScripts("./version.js");

const APP_VERSION = self.__COFRABEAT_VERSION__ || "dev";
const CACHE_NAME = `cofrabeat-${APP_VERSION.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase()}`;
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./version.js",
  "./app.js",
  "./audio-recorder-worklet.js",
  "./manifest.webmanifest",
  "./assets/pasos/manifest.json",
  "./assets/pasos/features.json",
  "./assets/icons/icon.svg",
];

const NETWORK_FIRST_PATHS = new Set([
  "",
  "index.html",
  "styles.css",
  "version.js",
  "app.js",
  "audio-recorder-worklet.js",
  "manifest.webmanifest",
  "assets/pasos/manifest.json",
  "assets/pasos/features.json",
]);

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const isNetworkFirst = NETWORK_FIRST_PATHS.has(getScopedPath(url));

  event.respondWith(isNetworkFirst ? networkFirst(event.request) : cacheFirst(event.request));
});

function getScopedPath(url) {
  const scopePath = new URL(self.registration.scope).pathname;
  const relativePath = url.pathname.startsWith(scopePath)
    ? url.pathname.slice(scopePath.length)
    : url.pathname.replace(/^\//, "");

  return relativePath.replace(/^\//, "");
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}
