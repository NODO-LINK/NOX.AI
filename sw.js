// Whereapp — service worker: avisos en la barra de notificaciones e instalar la app.
// Guarda una copia de la app para abrirla aunque falle la señal (primero intenta internet).
const CACHE = "whereapp-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo archivos de la propia app (ni Firebase, ni mapas, ni lugares).
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const resp = await fetch(req);
      if (resp.ok) (await caches.open(CACHE)).put(req, resp.clone());
      return resp;
    } catch {
      const guardada = await caches.match(req, { ignoreSearch: false }) || await caches.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      throw new Error("sin conexión");
    }
  })());
});

// Al tocar el aviso, se abre (o se trae al frente) la app.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
    const abierta = ventanas.find((v) => "focus" in v);
    return abierta ? abierta.focus() : self.clients.openWindow(url);
  }));
});
