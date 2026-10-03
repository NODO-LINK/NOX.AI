// Whereapp — service worker: necesario para mostrar el aviso de la carrera en la barra de notificaciones.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Al tocar el aviso, se abre (o se trae al frente) la app.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
    const abierta = ventanas.find((v) => "focus" in v);
    return abierta ? abierta.focus() : self.clients.openWindow(url);
  }));
});
