// Whereapp — service worker: avisos en la barra de notificaciones e instalar la app.
// Guarda una copia de la app para abrirla aunque falle la señal (primero intenta internet).
const CACHE = "whereapp-v2";
// Archivos de Firebase con versión fija: nunca cambian, se sirven de la copia (así abre sin señal).
const FIREBASE = /^https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.2\//;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

async function guardar(req, resp) {
  const cache = await caches.open(CACHE);
  // Solo la versión más nueva de cada archivo (no se acumulan cliente.js?v=50, ?v=51…).
  const ruta = new URL(req.url).pathname;
  if (!ruta.endsWith("seguir.html")) {
    for (const v of await cache.keys()) if (new URL(v.url).pathname === ruta && v.url !== req.url) await cache.delete(v);
    await cache.put(req, resp);
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (FIREBASE.test(req.url)) {
    e.respondWith(caches.match(req).then((g) => g || fetch(req).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {}); }
      return resp;
    })));
    return;
  }
  // Solo archivos de la propia app (ni mapas, ni lugares, ni la base de datos).
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const red = fetch(req).then((resp) => {
      if (resp.ok) guardar(req, resp.clone()).catch(() => {});
      return resp;
    });
    // Con señal muy mala no se espera para siempre: a los 5 s se usa la copia guardada (si hay).
    const pronto = await Promise.race([red.catch(() => null), new Promise((r) => setTimeout(() => r(null), 5000))]);
    if (pronto) return pronto;
    const guardada = await caches.match(req) || await caches.match(req, { ignoreSearch: true });
    return guardada || red;
  })());
});

// Al tocar el aviso, se abre (o se trae al frente) la ventana de esa misma app.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  const ruta = new URL(destino).pathname;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
    const misma = ventanas.find((v) => v.url.split("#")[0] === destino.split("#")[0]) || ventanas.find((v) => new URL(v.url).pathname === ruta);
    return misma ? misma.focus() : self.clients.openWindow(destino);
  }));
});
