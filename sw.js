const CACHE_NAME = "row-echelon-v55";
const ASSETS = [
  "./",
  "index.html",
  "styles.css?v=35",
  "app.js?v=55",
  "manifest.webmanifest",
  "assets/audio/row_echelon_music.mp3",
  "assets/audio/ui_apply.wav",
  "assets/audio/ui_complete.mp3",
  "assets/audio/ui_reset.wav",
  "assets/audio/ui_row.wav",
  "assets/audio/ui_tap.wav",
  "assets/audio/intro/intro_key_tick.wav?v=55",
  "assets/audio/intro/intro_button_up.wav?v=55",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-1024.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
