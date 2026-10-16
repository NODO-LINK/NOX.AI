// Whereapp — service worker: avisos en la barra de notificaciones e instalar la app.
// Guarda una copia de la app para abrirla aunque falle la señal (primero intenta internet).
const CACHE = "whereapp-v5";
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
    // Copia sin importar el ?v= solo para las páginas: con los .js se mezclarían versiones viejas y nuevas.
    const guardada = await caches.match(req) || (req.mode === "navigate" ? await caches.match(req, { ignoreSearch: true }) : null);
    return guardada || red;
  })());
});

// Al tocar el aviso, se abre (o se trae al frente) la ventana de esa misma app.
self.addEventListener("notificationclick", (e) => {
  const d = e.notification.data || {};
  // Botones de la notificación del viaje: llamar al motorizado o compartir el viaje por WhatsApp.
  if (e.action === "llamar" && d.tel) { e.waitUntil(self.clients.openWindow("tel:" + d.tel)); return; }
  if (e.action === "compartir" && d.compartir) { e.waitUntil(self.clients.openWindow(d.compartir)); return; }
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  const ruta = new URL(destino).pathname;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
    const misma = ventanas.find((v) => v.url.split("#")[0] === destino.split("#")[0]) || ventanas.find((v) => new URL(v.url).pathname === ruta);
    return misma ? misma.focus() : self.clients.openWindow(destino);
  }));
});

// Aviso push del servidor (llega aunque la app esté cerrada).
self.addEventListener("push", (e) => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = j.data || j.notification || j; } catch {}
  // Orden de cerrar una notificación (ej.: el viaje terminó): se quita la del viaje en curso.
  if (d.cerrar) {
    e.waitUntil(self.registration.getNotifications({ tag: d.cerrar }).then((l) => l.forEach((n) => n.close())));
    return;
  }
  if (!d.titulo && !d.title) return;
  const urgente = !!d.urgente;
  const viaje = d.tag === "whereapp-carrera";
  e.waitUntil(self.registration.showNotification(d.titulo || d.title, {
    body: d.cuerpo || d.body || "", tag: d.tag || "whereapp", renotify: !viaje, silent: viaje, requireInteraction: urgente,
    icon: "icono-192.png", badge: "icono-192.png",
    data: { url: d.url || "./", tel: d.tel || "", compartir: d.compartir || "" },
    // Viaje en curso: botones para llamar al motorizado o compartir el viaje.
    ...(viaje ? { actions: [...(d.tel ? [{ action: "llamar", title: "Llamar" }] : []), ...(d.compartir ? [{ action: "compartir", title: "Compartir" }] : [])] } : {}),
    vibrate: viaje ? undefined : urgente ? [150, 80, 400, 120, 400] : [200, 100, 200],
  }));
});
