// Service worker: guarda la app en caché para que cargue rápido y funcione sin internet.
const CACHE = 'chispa-v1';
const ASSETS = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/solver.js', 'js/components.js', 'js/missions.js', 'js/lessons.js', 'js/storage.js', 'js/icons.js',
  'img/chispa.svg', 'img/icon-192.png', 'img/icon-512.png',
  'fonts/nunito-latin-400-normal.woff2', 'fonts/nunito-latin-600-normal.woff2', 'fonts/nunito-latin-700-normal.woff2',
  'fonts/nunito-latin-800-normal.woff2', 'fonts/baloo-2-latin-700-normal.woff2', 'fonts/baloo-2-latin-800-normal.woff2',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Páginas: primero internet (para recibir mejoras), si no hay, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // Archivos: la copia guardada al instante y se actualiza por detrás.
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => cached);
    return cached || net;
  }));
});
