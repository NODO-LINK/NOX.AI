// Whereapp — piezas compartidas por la app del cliente, la de motorizados y el panel.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, onSnapshot, collection, query, orderBy, limit, addDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig as configReal } from "./firebase-config.js?v=51";
import { icono, pintarIconos } from "./iconos.js?v=51";

export { icono };
pintarIconos();

export const NOMBRE = "Whereapp";
// Servicios que se ofrecen. Para volver a ofrecer delivery, agrega "delivery" a la lista.
export const SERVICIOS = ["mototaxi"];
// En la computadora (localhost) la app usa el simulador de Firebase, para hacer pruebas sin tocar los datos reales.
const simulador = location.hostname === "localhost";
export const firebaseConfig = simulador ? { ...configReal, apiKey: "demo", projectId: "demo-whereapp" } : configReal;
export const configurado = simulador || !String(configReal.apiKey).startsWith("PEGA");
// Cada parte (cliente, motorizado, administrador) guarda su propia sesión. Así, abrir el panel
// en el mismo navegador no cierra la sesión del cliente ni la del motorizado, y viceversa.
const ROL = /admin\.html$/.test(location.pathname) ? "admin" : /moto\.html$/.test(location.pathname) ? "moto" : "cliente";
export const app = initializeApp(firebaseConfig, ROL);
export const auth = getAuth(app);
export const db = getFirestore(app);
if (simulador) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

// Segunda conexión de Firebase: permite al admin crear cuentas sin cerrar su propia sesión.
export function authSecundaria() {
  const a = getAuth(initializeApp(firebaseConfig, "crear-" + Date.now()));
  if (simulador) connectAuthEmulator(a, "http://127.0.0.1:9099", { disableWarnings: true });
  return a;
}

// Centro del mapa: San Rafael de El Moján.
export const CENTRO = [10.9833, -71.6667];

// Usuario de motorizados y administrador → correo interno de Firebase.
// Si se escribe un correo completo (ej. el Gmail del administrador), se usa tal cual.
export const correoDe = (usuario) => {
  const u = String(usuario).trim().toLowerCase();
  return u.includes("@") ? u : `${u.replace(/[^a-z0-9._-]/g, "")}@whereapp.app`;
};

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const usd = (n) => "$" + Number(n || 0).toFixed(2);
export const bs = (n) => "Bs " + Number(n || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- Pago en bolívares ----------
// La tasa (Bs por cada $) la pone el administrador en Más → Tarifas.
export const FORMAS_PAGO = {
  usd: { t: "Dólares", c: "Dólares en efectivo", icono: "dolar" },
  bs: { t: "Bolívares", c: "Bolívares en efectivo", icono: "dinero" },
  pagomovil: { t: "Pago móvil", c: "Pago móvil", icono: "telefono" },
};
export const aBs = (montoUsd, tasa) => (tasa > 0 ? Math.round(montoUsd * tasa * 100) / 100 : null);
// Lo que hay que cobrar en una carrera, según cómo paga el cliente.
export function textoCobro(c) {
  const forma = FORMAS_PAGO[c.formaPago] || FORMAS_PAGO.usd;
  if (c.formaPago === "bs" || c.formaPago === "pagomovil") {
    return c.precioBs ? `${bs(c.precioBs)} · ${forma.c}` : `${usd(c.precio)} en Bs a la tasa del día · ${forma.c}`;
  }
  return `${usd(c.precio)} · ${forma.c}`;
}
// Precio en $ con su equivalente en Bs (si hay tasa).
export const conBs = (montoUsd, tasa) => (tasa > 0 ? `${usd(montoUsd)} · ${bs(aBs(montoUsd, tasa))}` : usd(montoUsd));
export const fecha = (t) => (t ? (t.toDate ? t.toDate() : new Date(t)) : null);
export const fechaTexto = (t) => { const f = fecha(t); return f ? f.toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" }) : "—"; };
export const estrellas = (m) => {
  const n = Number(m.ratingCount) || 0;
  if (!n) return "Sin calificaciones";
  const p = (Number(m.ratingSum) || 0) / n;
  return `${icono("estrella")} ${p.toFixed(1)} (${n})`;
};
export const promedio = (m) => (m.ratingCount ? m.ratingSum / m.ratingCount : 0);

// ---------- Viaje seguro: lo que el cliente marca al calificar ----------
export const ASPECTOS = {
  buenos: [
    { k: "prudente", t: "Manejó con prudencia", c: "Prudente" },
    { k: "velocidad", t: "Respetó la velocidad", c: "Velocidad segura" },
    { k: "casco", t: "Me dio casco", c: "Da casco" },
    { k: "moto", t: "Moto en buen estado", c: "Moto en buen estado" },
    { k: "puntual", t: "Llegó a tiempo", c: "Puntual" },
    { k: "respeto", t: "Amable y respetuoso", c: "Respetuoso" },
  ],
  malos: [
    { k: "rapido", t: "Iba muy rápido" },
    { k: "peligro", t: "Maniobras peligrosas" },
    { k: "sincasco", t: "No me dio casco" },
    { k: "telefono", t: "Usó el teléfono manejando" },
    { k: "motomal", t: "Moto en mal estado" },
    { k: "irrespeto", t: "Trato irrespetuoso" },
  ],
};
// % de viajes en que el cliente dijo que se sintió seguro (null si nadie ha respondido).
export const pctSeguro = (m) => (Number(m.seguroN) > 0 ? Math.round((100 * (Number(m.seguroSi) || 0)) / Number(m.seguroN)) : null);
// ---------- Fotos del motorizado y de su moto ----------
// Se guardan pequeñas (JPEG ~300 px) en la colección "fotos", aparte, para no hacer pesada la lista de motorizados.
const cacheFotos = new Map();
export function fotosDe(motoId) {
  if (!cacheFotos.has(motoId)) cacheFotos.set(motoId, getDoc(doc(db, "fotos", motoId)).then((d) => (d.exists() ? d.data() : {})).catch(() => ({})));
  return cacheFotos.get(motoId);
}
export const olvidarFotos = (motoId) => cacheFotos.delete(motoId);
// Reduce una imagen elegida en el teléfono a un JPEG pequeño (data URL).
export function achicarFoto(archivo, lado = 320) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = mal;
    img.src = URL.createObjectURL(archivo);
  });
}
// Pone la foto en los avatares con data-foto-moto="id" (si tiene).
export function pintarFotos(raiz = document) {
  $$("[data-foto-moto]", raiz).forEach(async (el) => {
    const f = await fotosDe(el.dataset.fotoMoto);
    const url = el.dataset.cual === "moto" ? f.moto : f.persona;
    if (url) { el.style.backgroundImage = `url("${url}")`; el.classList.add("con-foto"); }
  });
}

// Copia pública de una reseña aprobada (sin datos privados del cliente ni los reportes).
export function opinionPublica(r) {
  const partes = String(r.clienteNombre || "Cliente").trim().split(/\s+/);
  return {
    estrellas: r.estrellas, comentario: r.comentario || "", fecha: r.fecha || new Date(),
    nombre: partes[0] + (partes[1] ? ` ${partes[1][0]}.` : ""),
    seguro: typeof r.seguro === "boolean" ? r.seguro : null, buenos: r.buenos || [],
  };
}
// Lista de opiniones: muestra pocas y el resto con "Ver más" (para que no sea una lista enorme).
export function listaOpiniones(ops, visibles = 3) {
  if (!ops.length) return `<p class="nota">Todavía no tiene opiniones.</p>`;
  const una = (o) => `<div class="opinion">
    <div class="opinion-cabeza"><b>${esc(o.nombre)}</b><span class="rating">${[1, 2, 3, 4, 5].map((n) => icono("estrella", n <= o.estrellas ? "" : "apagada")).join("")}</span></div>
    ${o.seguro || (o.buenos || []).length ? `<div class="etiquetas">${o.seguro ? `<span class="pildora seguro mini">${icono("escudo")} Viaje seguro</span>` : ""}${(o.buenos || []).slice(0, 3).map((k) => `<span class="pildora insignia mini">${esc((ASPECTOS.buenos.find((a) => a.k === k) || { c: k }).c)}</span>`).join("")}</div>` : ""}
    ${o.comentario ? `<p>“${esc(o.comentario)}”</p>` : ""}
    <small class="nota">${fechaTexto(o.fecha)}</small></div>`;
  return ops.slice(0, visibles).map(una).join("")
    + (ops.length > visibles ? `<details class="mas-opiniones"><summary>Ver ${ops.length - visibles} opiniones más</summary>${ops.slice(visibles).map(una).join("")}</details>` : "");
}
export async function leerOpiniones(motoId) {
  const s = await getDocs(collection(db, "motorizados", motoId, "opiniones"));
  return s.docs.map((d) => d.data()).sort((a, b) => (fecha(b.fecha) || 0) - (fecha(a.fecha) || 0));
}
// Insignias para la tarjeta del motorizado: % seguro y lo que más destacan los clientes.
export function insigniasSeguridad(m, cuantas = 2) {
  const pct = pctSeguro(m);
  if (pct == null) return "";
  const top = ASPECTOS.buenos.map((a) => ({ a, n: (m.buenos || {})[a.k] || 0 })).filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n).slice(0, cuantas);
  return `<span class="pildora ${pct >= 90 ? "seguro" : pct >= 70 ? "medio" : "riesgo"}">${icono("escudo")} ${pct}% viajes seguros</span>`
    + top.map((x) => `<span class="pildora insignia">${icono("check")} ${esc(x.a.c)}</span>`).join("");
}

// Un motorizado sale en la app si el admin lo activó y tiene la quincena pagada.
export const habilitado = (m) => m.activo === true && fecha(m.pagadoHasta) > new Date();

export const MOTIVOS_CLIENTE = ["Ya no lo necesito", "Tarda mucho", "Me equivoqué de dirección", "Conseguí otro transporte", "Otro"];
export const MOTIVOS_MOTO = ["Problema con la moto", "No encuentro la dirección", "El cliente no responde", "Muy lejos", "Otro"];

// Tarifas por defecto si el admin aún no las ha guardado.
export const TARIFAS_BASE = {
  delivery: { base: 1, porKm: 0.5 },
  mototaxi: { base: 1, porKm: 0.4 },
  cuota: 1,
  diasCuota: 15,
  // Recargos: el nocturno se aplica solo en su horario; el de lluvia, mientras el admin lo tenga encendido.
  nocturna: { activa: false, desde: "20:00", hasta: "05:00", extra: 0.5 },
  lluvia: { activa: false, extra: 0.5 },
  tasa: 0,
};
const conBase = (d) => ({ ...TARIFAS_BASE, ...d, nocturna: { ...TARIFAS_BASE.nocturna, ...(d.nocturna || {}) }, lluvia: { ...TARIFAS_BASE.lluvia, ...(d.lluvia || {}) } });
export async function leerTarifas() {
  try {
    const s = await getDoc(doc(db, "config", "general"));
    return conBase(s.exists() ? s.data() : {});
  } catch { return conBase({}); }
}
// Tarifas en vivo (para que el recargo de lluvia se vea apenas el admin lo encienda).
export const escucharTarifas = (cb) => onSnapshot(doc(db, "config", "general"), (s) => cb(conBase(s.exists() ? s.data() : {})), () => {});

const minutosDe = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };
export function esDeNoche(t, cuando = new Date()) {
  const n = t.nocturna;
  if (!n || !n.activa) return false;
  const ahora = cuando.getHours() * 60 + cuando.getMinutes(), a = minutosDe(n.desde), b = minutosDe(n.hasta);
  return a <= b ? ahora >= a && ahora < b : ahora >= a || ahora < b;
}
// Recargos que aplican ahora: [{ nombre, monto }]
export function recargos(t, cuando = new Date()) {
  const r = [];
  if (esDeNoche(t, cuando)) r.push({ nombre: "Recargo nocturno", monto: Number(t.nocturna.extra) || 0 });
  if (t.lluvia && t.lluvia.activa) r.push({ nombre: "Recargo por lluvia", monto: Number(t.lluvia.extra) || 0 });
  return r.filter((x) => x.monto > 0);
}
export const precio = (t, tipo, km, cuando = new Date()) =>
  Math.round((t[tipo].base + t[tipo].porKm * km + recargos(t, cuando).reduce((s, x) => s + x.monto, 0)) * 100) / 100;

// Distancia por calle (OSRM, gratis). Si falla, línea recta × 1,3.
export function lineaRecta(a, b) {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Distancia por calle pasando por todos los puntos en orden (OSRM, gratis).
// Si falla, suma las líneas rectas × 1,3. Acepta ruta([p1, p2, …]) o ruta(p1, p2).
export async function ruta(...args) {
  const pts = Array.isArray(args[0]) ? args[0] : args;
  try {
    const coords = pts.map((p) => `${p.lng},${p.lat}`).join(";");
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const j = await r.json();
    if (j.code !== "Ok") throw 0;
    return { km: j.routes[0].distance / 1000, linea: j.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
  } catch {
    let km = 0;
    for (let i = 1; i < pts.length; i++) km += lineaRecta(pts[i - 1], pts[i]) * 1.3;
    return { km, linea: pts.map((p) => [p.lat, p.lng]) };
  }
}

export const mapsLink = (p) => `https://www.google.com/maps/dir/?api=1&destination=${Number(p.lat)},${Number(p.lng)}`;

// Todos los puntos de una carrera en orden: A, paradas, B y, si es ida y vuelta, A otra vez.
export const puntosCarrera = (c) => [c.origen, ...(c.paradas || []), c.destino, ...(c.retorno ? [c.origen] : [])];

// Ruta completa en Google Maps (con las paradas como puntos intermedios).
export function mapsRuta(c) {
  const pts = puntosCarrera(c);
  const txt = (p) => `${Number(p.lat)},${Number(p.lng)}`;
  const medio = pts.slice(1, -1).map(txt).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${txt(pts[0])}&destination=${txt(pts[pts.length - 1])}${medio ? `&waypoints=${encodeURIComponent(medio)}` : ""}&travelmode=driving`;
}

// Filas con el recorrido (A, paradas, B y regreso) para los resúmenes.
export function filasRecorrido(c) {
  const fila = (letra, clase, dir) => `<div class="fila"><span><i class="${clase}">${letra}</i></span><span>${esc(dir)}</span></div>`;
  return [
    fila("A", "letra-a", c.origen.dir),
    ...(c.paradas || []).map((p, i) => fila(i + 1, "letra-p", p.dir)),
    fila("B", "letra-b", c.destino.dir),
    c.retorno ? `<div class="fila"><span>${icono("deshacer")}</span><span>Ida y vuelta: regresa al punto A</span></div>` : "",
  ].join("");
}

// Marcadores de la carrera en un mapa (A, paradas numeradas y B).
export function marcarRecorrido(mapa, c) {
  const L = window.L;
  L.marker(c.origen, { icon: ICONOS.origen }).addTo(mapa);
  (c.paradas || []).forEach((p, i) => L.marker(p, { icon: ICONOS.parada(i + 1) }).addTo(mapa));
  L.marker(c.destino, { icon: ICONOS.destino }).addTo(mapa);
  return L.latLngBounds([c.origen, ...(c.paradas || []), c.destino]);
}

// Íconos de mapa (Leaflet).
const pin = (color, letra) => window.L.divIcon({
  className: "",
  html: `<div class="pin" style="background:${color}"><span>${letra}</span></div>`,
  // La punta del pin (cuadrado de 32 px girado 45°) queda 22,6 px bajo su centro: ahí está el punto exacto.
  iconSize: [32, 32], iconAnchor: [16, 38],
});
export const ICONOS = {
  get origen() { return pin("#16a34a", "A"); },
  get destino() { return pin("#7c3aed", "B"); },
  get moto() { return pin("#111827", icono("moto")); },
  parada(n) { return pin("#f59e0b", n); },
};
// Límites del mapa: El Moján y sus alrededores. El mapa no se sale de aquí.
const LIMITES = [[CENTRO[0] - 0.15, CENTRO[1] - 0.15], [CENTRO[0] + 0.15, CENTRO[1] + 0.15]];

// El mapa queda quieto al hacer scroll: solo se mueve con el botón de la mano,
// con + / − o pellizcando con dos dedos. Los puntos se marcan tocando y se ajustan arrastrándolos.
// modo "libre": pantalla completa, se mueve con el dedo (no hay scroll que estorbe).
// modo "mini": vista previa quieta, sin botones; tocarla abre el mapa completo.
// Fondo del mapa: satelital (por defecto) o de calles. Se recuerda en el teléfono.
const CLAVE_FONDO = "whereapp.fondo";
const leerFondo = () => { try { return localStorage.getItem(CLAVE_FONDO) || "satelite"; } catch { return "satelite"; } };
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
function ponerFondo(m, fondo) {
  const L = window.L;
  if (m._fondo) m._fondo.forEach((c) => m.removeLayer(c));
  const op = { maxZoom: 19, keepBuffer: 4, updateWhenZooming: false };
  m._fondo = fondo === "satelite"
    ? [
        L.tileLayer(ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}", { ...op, maxNativeZoom: 18, attribution: "Imágenes © Esri, Maxar" }),
        L.tileLayer(ESRI + "Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { ...op, maxNativeZoom: 18, opacity: 0.75 }),
        // Nombres de calles y sectores (de OpenStreetMap) encima de la foto.
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png", { ...op, subdomains: "abcd", attribution: "© OpenStreetMap, © CARTO" }),
      ]
    : [L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { ...op, attribution: "© OpenStreetMap" })];
  m._fondo.forEach((c) => c.addTo(m));
  m.getContainer().classList.toggle("satelital", fondo === "satelite");
}

// Punto azul con tu ubicación en vivo (como en Google Maps). Devuelve una promesa con la primera posición.
function seguirMiUbicacion(m) {
  const L = window.L;
  if (!navigator.geolocation) return Promise.resolve(null);
  let punto = null, aro = null, primera;
  const lista = new Promise((r) => (primera = r));
  const id = navigator.geolocation.watchPosition((p) => {
    const ll = [p.coords.latitude, p.coords.longitude];
    m._yo = L.latLng(ll);
    if (!m._loaded) return;
    if (!punto) {
      aro = L.circle(ll, { radius: Math.min(p.coords.accuracy, 300), color: "#2563eb", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(m);
      punto = L.marker(ll, { icon: L.divIcon({ className: "", html: '<div class="yo-punto"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, zIndexOffset: 900 }).addTo(m);
    } else { punto.setLatLng(ll); aro.setLatLng(ll).setRadius(Math.min(p.coords.accuracy, 300)); }
    primera(m._yo);
  }, () => primera(null), { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  m.on("unload", () => navigator.geolocation.clearWatch(id));
  return lista;
}

export function nuevoMapa(id, modo = "", { yo = false } = {}) {
  const L = window.L;
  const libre = modo === "libre", mini = modo === "mini";
  const m = L.map(id, {
    zoomControl: false, dragging: libre, scrollWheelZoom: libre, doubleClickZoom: false, boxZoom: false, keyboard: false,
    touchZoom: !mini, attributionControl: !mini,
    maxBounds: LIMITES, maxBoundsViscosity: 0.85, minZoom: 12,
    // Movimiento más suave: zoom sin saltos bruscos al pellizcar y deslizamiento con inercia.
    zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 100, inertiaDeceleration: 2600, bounceAtZoomLimits: false,
  }).setView(CENTRO, 14);
  ponerFondo(m, leerFondo());
  if (mini) return m;
  m.miUbicacion = yo ? seguirMiUbicacion(m) : Promise.resolve(null);
  L.control.zoom({ position: "bottomleft" }).addTo(m);
  const Controles = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd() {
      const caja = L.DomUtil.create("div", "leaflet-bar controles-mapa");
      caja.innerHTML = `${yo ? `<a href="#" role="button" data-yo title="Ir a mi ubicación">${icono("ubicarme")}</a>` : ""}<a href="#" role="button" data-fondo title="Cambiar entre satélite y calles">${icono("capas")}</a>${libre ? "" : `<a href="#" role="button" data-mover title="Mover el mapa">${icono("mano")}</a>`}<a href="#" role="button" data-centro title="Volver al centro de El Moján">${icono("centro")}</a>`;
      L.DomEvent.disableClickPropagation(caja);
      if (yo) caja.querySelector("[data-yo]").onclick = (e) => {
        e.preventDefault();
        if (m._yo) m.flyTo(m._yo, Math.max(m.getZoom(), 17), { duration: 0.6 });
        else aviso("Buscando tu ubicación… Activa el GPS y da permiso.");
      };
      caja.querySelector("[data-fondo]").onclick = (e) => {
        e.preventDefault();
        const nuevo = leerFondo() === "satelite" ? "calles" : "satelite";
        try { localStorage.setItem(CLAVE_FONDO, nuevo); } catch {}
        ponerFondo(m, nuevo);
        aviso(nuevo === "satelite" ? "Vista satelital" : "Vista de calles");
      };
      if (!libre) caja.querySelector("[data-mover]").onclick = (e) => {
        e.preventDefault();
        const activo = !m.dragging.enabled();
        activo ? m.dragging.enable() : m.dragging.disable();
        e.currentTarget.classList.toggle("activo", activo);
        aviso(activo ? "Ahora puedes mover el mapa con el dedo" : "Mapa fijo");
      };
      caja.querySelector("[data-centro]").onclick = (e) => { e.preventDefault(); m.flyTo(CENTRO, 14, { duration: 0.6 }); };
      return caja;
    },
  });
  new Controles().addTo(m);
  return m;
}

let temporizador;
export function aviso(texto) {
  let a = $("#aviso");
  if (!a) { a = document.createElement("div"); a.id = "aviso"; a.className = "aviso"; document.body.append(a); }
  a.textContent = texto;
  a.classList.add("ver");
  clearTimeout(temporizador);
  temporizador = setTimeout(() => a.classList.remove("ver"), Math.max(3000, texto.length * 70));
}

// Ventana para elegir un motivo (cancelaciones).
export function elegirMotivo(titulo, motivos) {
  return new Promise((resolver) => {
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<div class="ventana"><h2>${esc(titulo)}</h2>
      <div class="opciones">${motivos.map((m, i) => `<label class="opcion"><input type="radio" name="motivo" value="${esc(m)}" ${i ? "" : "checked"}><span>${esc(m)}</span></label>`).join("")}</div>
      <textarea id="motivo-otro" placeholder="Explica un poco más (opcional)"></textarea>
      <button class="boton peligro" data-ok>Cancelar carrera</button>
      <button class="boton secundario" data-no>Volver</button></div>`;
    document.body.append(fondo);
    const cerrar = (v) => { fondo.remove(); resolver(v); };
    $("[data-no]", fondo).onclick = () => cerrar(null);
    $("[data-ok]", fondo).onclick = () => {
      const m = $("input[name=motivo]:checked", fondo).value;
      const extra = $("#motivo-otro", fondo).value.trim();
      cerrar(extra ? `${m}: ${extra}` : m);
    };
  });
}

export function avisoSinConfigurar() {
  if (configurado) return false;
  document.body.innerHTML = `<div class="vista"><div class="caja" style="margin-top:40px">
    <h2>Falta conectar Firebase</h2>
    <p class="nota">Abre el archivo <b>firebase-config.js</b> y pega los datos de tu proyecto de Firebase. Los pasos están en el README.</p></div></div>`;
  return true;
}

// ---------- Sensación de app: sin zoom con los dedos, onda al tocar, transiciones ----------

// Sin pellizcar para hacer zoom (el mapa sí se puede pellizcar).
document.addEventListener("gesturestart", (e) => { if (!e.target.closest?.(".leaflet-container")) e.preventDefault(); });
document.addEventListener("touchmove", (e) => {
  if (e.touches.length > 1 && !e.target.closest?.(".leaflet-container")) e.preventDefault();
}, { passive: false });
document.addEventListener("wheel", (e) => { if (e.ctrlKey && !e.target.closest?.(".leaflet-container")) e.preventDefault(); }, { passive: false });

// Onda que sale desde donde tocas un botón.
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest?.(".boton, .barra button, .punto, .opcion");
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect();
  const lado = Math.max(r.width, r.height) * 2;
  const o = document.createElement("span");
  o.className = "onda";
  o.style.cssText = `width:${lado}px;height:${lado}px;left:${e.clientX - r.left - lado / 2}px;top:${e.clientY - r.top - lado / 2}px`;
  b.append(o);
  setTimeout(() => o.remove(), 650);
});

// Entrada animada de la pantalla (solo al cambiar de pestaña, no en cada actualización).
let finTransicion;
export function transicion() {
  const v = $("#vista");
  if (!v) return;
  v.classList.remove("entrar");
  void v.offsetWidth;
  v.classList.add("entrar");
  clearTimeout(finTransicion);
  finTransicion = setTimeout(() => v.classList.remove("entrar"), 900);
}

// Barra inferior: marca la pestaña activa y desliza la píldora de fondo hasta ella.
export function activarBarra(ruta) {
  const barra = $("#barra");
  if (!barra) return;
  let ind = $(".indicador", barra);
  if (!ind) { ind = document.createElement("i"); ind.className = "indicador"; barra.prepend(ind); }
  const mover = () => {
    const b = $(`button[data-ruta="${barra.dataset.activa}"]`, barra);
    if (!b) return;
    ind.style.width = b.offsetWidth + "px";
    ind.style.transform = `translateX(${b.offsetLeft}px)`;
  };
  barra.dataset.activa = ruta;
  $$("button", barra).forEach((b) => b.classList.toggle("activo", b.dataset.ruta === ruta));
  mover();
  if (!barra.dataset.escucha) { barra.dataset.escucha = "1"; addEventListener("resize", mover); }
}

// ---------- Seguimiento en vivo: cuánto le falta al motorizado ----------

const VELOCIDAD = 25; // km/h promedio de una moto en El Moján

// Calcula en qué va la carrera a partir de la última ubicación del motorizado.
// "memoria" guarda la distancia inicial hasta A para poder llenar la barra de progreso.
// Con "tercero" (el nombre del cliente) los textos se escriben para el amigo que sigue la carrera.
export function progreso(c, u, memoria = {}, tercero = "") {
  const recogido = !!c.recogido;
  const meta = recogido ? c.destino : c.origen;
  const quien = String(c.motoNombre || "El motorizado").split(" ")[0];
  const taxi = c.tipo === "mototaxi";
  const titulo = tercero
    ? (recogido ? (taxi ? `${tercero} va en camino a su destino` : "El pedido va en camino") : `${quien} va a buscar ${taxi ? `a ${tercero}` : "el pedido"}`)
    : (recogido ? (taxi ? "En camino a tu destino" : "Tu pedido va en camino") : `${quien} va a buscar${taxi ? "te" : " el pedido"}`);
  // El motorizado avisó que llegó al punto A y está esperando.
  if (c.llegoEn && !recogido) {
    return { recogido, llego: true, titulo: tercero ? `${quien} llegó a buscar ${taxi ? `a ${tercero}` : "el pedido"}` : `¡${quien} llegó!`,
      detalle: tercero ? "Está esperando en el punto A" : "Está afuera esperándote en el punto A", pct: 50, min: 0, km: 0 };
  }
  if (!u) return { recogido, titulo, detalle: "Esperando la ubicación del motorizado…", pct: recogido ? 50 : 0, min: null, km: null };
  // Distancia por la ruta de calles si ya se calculó hace poco (ver afinarEta); si no, línea recta × 1,3.
  const real = memoria.real && memoria.real.meta === `${meta.lat},${meta.lng}` && Date.now() - memoria.real.t < 120000 ? memoria.real : null;
  const km = real ? Math.max(0, real.km - lineaRecta(real.desde, u)) : lineaRecta(u, meta) * 1.3;
  const min = Math.max(1, Math.round((km / VELOCIDAD) * 60));
  let pct;
  if (!recogido) {
    memoria.inicial = Math.max(memoria.inicial || 0, km, 0.05);
    pct = 50 * (1 - km / memoria.inicial);
  } else {
    pct = 50 + 50 * (1 - km / Math.max(c.km || km, 0.1));
  }
  pct = Math.min(100, Math.max(0, pct));
  const llegando = km < 0.1;
  const textoKm = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const edad = Date.now() - (fecha(u.t) || new Date()).getTime();
  const viejo = edad > 120000 ? ` · ubicación de hace ${Math.round(edad / 60000)} min` : "";
  const detalle = llegando
    ? (recogido ? "Llegando al destino" : "Está llegando al punto A")
    : `Faltan ${min} min · ${textoKm}${viejo}`;
  return { recogido, titulo, detalle, pct, min: llegando ? 0 : min, km };
}

// Pide a OSRM la distancia por calles desde el motorizado hasta su meta (como máximo cada 45 s
// o si se movió más de 150 m) y la guarda en memoria.real; luego llama a listo() para redibujar.
export async function afinarEta(c, u, memoria, listo) {
  if (!u || (c.llegoEn && !c.recogido)) return;
  const meta = c.recogido ? c.destino : c.origen;
  const r = memoria.real;
  const clave = `${meta.lat},${meta.lng}`;
  if (memoria.pidiendo || (r && r.meta === clave && Date.now() - r.t < 45000 && lineaRecta(r.desde, u) < 0.15)) return;
  memoria.pidiendo = true;
  try {
    const x = await fetch(`https://router.project-osrm.org/route/v1/driving/${u.lng},${u.lat};${meta.lng},${meta.lat}?overview=full&geometries=geojson`).then((y) => y.json());
    if (x.code === "Ok") {
      // linea: el camino por calles que le falta al motorizado (para dibujarlo en el mapa del cliente).
      memoria.real = { km: x.routes[0].distance / 1000, t: Date.now(), desde: { lat: u.lat, lng: u.lng }, meta: clave,
        linea: x.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
      listo && listo();
    }
  } catch {} finally { memoria.pidiendo = false; }
}

// Comparte el enlace de seguimiento de una carrera (WhatsApp, etc.).
export async function compartirCarrera(c, nombreCliente) {
  const url = new URL(`seguir.html?c=${encodeURIComponent(c.id)}`, location.href).href;
  const texto = `Sigue mi ${c.tipo === "mototaxi" ? "viaje" : "pedido"} en ${NOMBRE} y mira cuánto falta para llegar:`;
  if (navigator.share) {
    try { await navigator.share({ title: `${NOMBRE} — ${nombreCliente || ""}`.trim(), text: texto, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); aviso("Enlace copiado. Pégalo en WhatsApp"); }
  catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`, "_blank"); }
}

// Explica por qué no se pudo entrar (el código entre paréntesis ayuda a encontrar el problema).
export function motivoEntrada(e) {
  const m = {
    "auth/invalid-credential": "Correo o clave incorrectos.",
    "auth/wrong-password": "La clave es incorrecta.",
    "auth/user-not-found": "Ese correo no está registrado en Firebase (Authentication → Usuarios).",
    "auth/invalid-email": "El correo no está bien escrito.",
    "auth/operation-not-allowed": "Falta activar «Correo electrónico/contraseña» en Firebase (Authentication → Método de acceso).",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
    "auth/network-request-failed": "Sin conexión a internet.",
    "auth/unauthorized-domain": "Falta autorizar este dominio en Firebase (Authentication → Configuración → Dominios autorizados).",
  }[e && e.code];
  return `${m || "No se pudo entrar."} (${(e && e.code) || "error"})`;
}

// ---------- Lugares de El Moján (escuelas, mercados, playas…) desde OpenStreetMap ----------

// Tipo de lugar → ícono, color y nombre en español.
const TIPOS_LUGAR = {
  educacion: { icono: "escuela", color: "#2563eb", nombre: "Educación" },
  salud: { icono: "salud", color: "#dc2626", nombre: "Salud" },
  farmacia: { icono: "salud", color: "#16a34a", nombre: "Farmacia" },
  mercado: { icono: "carrito", color: "#ea580c", nombre: "Mercado y tiendas" },
  comida: { icono: "comida", color: "#d97706", nombre: "Comida" },
  playa: { icono: "olas", color: "#0891b2", nombre: "Playa" },
  parque: { icono: "arbol", color: "#15803d", nombre: "Parques y deporte" },
  iglesia: { icono: "iglesia", color: "#7c3aed", nombre: "Iglesia" },
  gobierno: { icono: "institucion", color: "#475569", nombre: "Instituciones" },
  banco: { icono: "institucion", color: "#0f766e", nombre: "Banco" },
  gasolina: { icono: "gasolina", color: "#b91c1c", nombre: "Gasolina" },
  transporte: { icono: "moto", color: "#4f46e5", nombre: "Transporte" },
  referencia: { icono: "pin", color: "#db2777", nombre: "Punto de referencia" },
  sector: { icono: "casa", color: "#334155", nombre: "Sector o barrio" },
  otro: { icono: "pin", color: "#6b7280", nombre: "Lugar" },
  favorito: { icono: "casa", color: "#7c3aed", nombre: "Tus lugares" },
};
export const tipoLugar = (t) => TIPOS_LUGAR[t] || TIPOS_LUGAR.otro;
// Palabras con las que la gente busca cada tipo de lugar (escribir "escuela" encuentra la U.E. …).
const PALABRAS_TIPO = {
  educacion: "escuela colegio liceo unidad educativa ue universidad preescolar kinder biblioteca",
  salud: "hospital ambulatorio cdi clinica medico doctor consultorio emergencia",
  farmacia: "farmacia medicina botica",
  mercado: "mercado tienda bodega abasto supermercado comercio negocio",
  comida: "comida restaurante arepera pizzeria panaderia cafe heladeria",
  playa: "playa mar costa",
  parque: "parque plaza cancha estadio deporte",
  iglesia: "iglesia capilla templo",
  gobierno: "alcaldia policia prefectura bomberos gobierno oficina",
  banco: "banco cajero",
  gasolina: "bomba gasolina estacion de servicio combustible",
  transporte: "parada terminal transporte autobus",
  sector: "sector barrio urbanizacion",
  referencia: "referencia",
};
// ¿El lugar coincide con todas las palabras buscadas (por nombre, tipo o sinónimos)?
export const coincideLugar = (l, palabras) => {
  const texto = normalizar(`${l.n} ${tipoLugar(l.t).nombre} ${PALABRAS_TIPO[l.t] || ""}`);
  return palabras.every((w) => texto.includes(w));
};

function clasificar(tag) {
  const a = tag.amenity, sh = tag.shop, l = tag.leisure;
  if (["school", "college", "university", "kindergarten", "library"].includes(a)) return "educacion";
  if (["hospital", "clinic", "doctors", "dentist"].includes(a)) return "salud";
  if (a === "pharmacy" || sh === "chemist") return "farmacia";
  if (a === "marketplace" || sh) return "mercado";
  if (["restaurant", "fast_food", "cafe", "bar", "ice_cream"].includes(a)) return "comida";
  if (tag.natural === "beach") return "playa";
  if (l) return "parque";
  if (a === "place_of_worship") return "iglesia";
  if (["townhall", "police", "fire_station", "post_office", "courthouse", "community_centre", "public_building"].includes(a) || tag.office === "government") return "gobierno";
  if (a === "bank" || a === "atm") return "banco";
  if (a === "fuel") return "gasolina";
  if (a === "bus_station" || tag.highway === "bus_stop") return "transporte";
  if (tag.place) return "sector";
  return "otro";
}

// Se descargan una vez y se guardan 7 días en el teléfono (Overpass, gratis).
let lugaresEnCamino = null;
export function cargarLugares() {
  if (!lugaresEnCamino) lugaresEnCamino = Promise.all([
    descargarLugares().catch(() => []),
    lugaresPropios().catch(() => []),
  ]).then(([osm, propios]) => {
    if (!osm.length && !propios.length) throw new Error("sin lugares");
    return [...propios, ...osm];
  }).catch((e) => { lugaresEnCamino = null; throw e; });
  return lugaresEnCamino;
}
// Puntos de referencia que agrega el administrador (los ve todo el mundo).
async function lugaresPropios() {
  const s = await getDocs(collection(db, "lugares"));
  return s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => l.n && l.lat != null).map((l) => ({ n: l.n, t: l.t || "referencia", lat: l.lat, lng: l.lng, propio: true }));
}
export const TIPOS_PARA_AGREGAR = ["referencia", "comida", "mercado", "educacion", "salud", "iglesia", "gobierno", "parque", "playa", "transporte", "sector"];
async function descargarLugares() {
  const CLAVE = "whereapp.lugares.v2";
  try { const g = JSON.parse(localStorage.getItem(CLAVE)); if (g && Date.now() - g.t < 7 * 864e5 && g.l.length) return g.l; } catch {}
  const [s, w, n, e] = [CENTRO[0] - 0.09, CENTRO[1] - 0.09, CENTRO[0] + 0.09, CENTRO[1] + 0.09].map((x) => x.toFixed(4));
  const caja = `(${s},${w},${n},${e})`;
  const q = `[out:json][timeout:25];(
    nwr["name"]["amenity"~"^(school|college|university|kindergarten|library|hospital|clinic|doctors|dentist|pharmacy|marketplace|restaurant|fast_food|cafe|bar|ice_cream|place_of_worship|townhall|police|fire_station|post_office|courthouse|community_centre|bank|fuel|bus_station)$"]${caja};
    nwr["name"]["shop"]${caja};
    nwr["natural"="beach"]${caja};
    nwr["name"]["leisure"~"^(park|stadium|sports_centre|pitch|playground)$"]${caja};
    nwr["name"]["tourism"]${caja};
    nwr["name"]["office"]${caja};
    nwr["name"]["amenity"]${caja};
    nwr["name"]["historic"]${caja};
    nwr["name"]["man_made"]${caja};
    nwr["name"]["landuse"~"^(cemetery|recreation_ground|religious)$"]${caja};
    nwr["name"]["highway"="bus_stop"]${caja};
    nwr["name"]["place"~"^(neighbourhood|suburb|quarter|hamlet|village|locality|isolated_dwelling)$"]${caja};
  );out center tags;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  const j = await r.json();
  const vistos = new Set();
  const lugares = (j.elements || []).map((el) => {
    const tag = el.tags || {};
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    const tipo = clasificar(tag);
    const nombre = tag.name || (tipo === "playa" ? "Playa" : "");
    return { n: nombre, t: tipo, lat, lng };
  }).filter((x) => {
    if (!x.n || x.lat == null) return false;
    const k = x.n + x.lat.toFixed(3) + x.lng.toFixed(3);
    if (vistos.has(k)) return false;
    vistos.add(k); return true;
  });
  try { localStorage.setItem(CLAVE, JSON.stringify({ t: Date.now(), l: lugares })); } catch {}
  return lugares;
}

// Quita acentos y mayúsculas para buscar por nombre.
export const normalizar = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function iconoLugar(l) {
  const t = tipoLugar(l.t);
  return window.L.divIcon({
    className: "",
    html: `<div class="lugar" style="background:${t.color}">${icono(t.icono)}</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13],
  });
}

// Muestra los lugares en un mapa: aparecen al acercarse (zoom 15+) y con nombre desde zoom 17.
// alTocar(lugar) es opcional (en el cliente sirve para usar el lugar como punto).
export function mostrarLugares(m, alTocar) {
  const L = window.L;
  const capa = L.layerGroup().addTo(m);
  const marcas = new Map();
  let lista = null;
  const quitar = (k) => { const mk = marcas.get(k); if (mk.getTooltip()) mk.unbindTooltip(); capa.removeLayer(mk); marcas.delete(k); };
  // Solo agrega o quita los lugares que entran o salen de la vista: así el mapa no parpadea al moverse.
  const pintar = () => {
    m.getContainer().classList.toggle("sin-nombres", m.getZoom() < 16.5);
    if (!lista) return;
    const z = m.getZoom();
    // Lejos: solo sectores y puntos de referencia. Cerca: todos los lugares.
    const visible = (l) => l.t === "sector" ? z >= 13.5 && z < 17.5 : l.propio ? z >= 14 : z >= 15;
    const vista = m.getBounds().pad(0.6);
    [...marcas.keys()].forEach((k) => { const l = lista[k]; if (!visible(l) || !vista.contains(marcas.get(k).getLatLng())) quitar(k); });
    lista.forEach((l, k) => {
      if (marcas.has(k) || !visible(l) || !vista.contains([l.lat, l.lng])) return;
      if (l.t === "sector") {
        // Sectores y barrios: solo el nombre grande, para orientarse.
        const mk = L.marker([l.lat, l.lng], { icon: L.divIcon({ className: "", html: `<div class="nombre-sector">${esc(l.n)}</div>`, iconSize: [0, 0] }), interactive: !!alTocar }).addTo(capa);
        if (alTocar) mk.on("click", () => alTocar(l));
        marcas.set(k, mk);
        return;
      }
      const mk = L.marker([l.lat, l.lng], { icon: iconoLugar(l), zIndexOffset: l.propio ? 300 : 0 }).addTo(capa);
      mk.bindTooltip(esc(l.n), { permanent: true, direction: "top", offset: [0, -12], className: "nombre-lugar" + (l.propio ? " propio" : "") });
      if (alTocar) mk.on("click", () => alTocar(l));
      marcas.set(k, mk);
    });
  };
  m.on("moveend zoomend", pintar);
  const listo = cargarLugares().then((l) => { lista = l; pintar(); return l; });
  // Para que el panel pueda refrescar los lugares después de agregar uno.
  const recargar = () => { [...marcas.keys()].forEach(quitar); lugaresEnCamino = null; return cargarLugares().then((l) => { lista = l; pintar(); return l; }); };
  return { capa, listo, recargar };
}

// ---------- Modo oscuro ----------
// Sigue al teléfono, y el botón de la luna/sol lo cambia y lo recuerda.
const CLAVE_TEMA = "whereapp.tema";
export function aplicarTema() {
  let t = null;
  try { t = localStorage.getItem(CLAVE_TEMA); } catch {}
  if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
  document.documentElement.dataset.tema = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === "oscuro" ? "#141021" : "#ffffff";
  return t;
}
aplicarTema();
export function botonTema() {
  const b = document.createElement("button");
  b.className = "boton secundario chico redondo-chico";
  b.setAttribute("aria-label", "Cambiar entre modo claro y oscuro");
  const pintar = () => { b.innerHTML = icono(document.documentElement.dataset.tema === "oscuro" ? "sol" : "luna"); };
  b.onclick = () => {
    const nuevo = document.documentElement.dataset.tema === "oscuro" ? "claro" : "oscuro";
    try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch {}
    aplicarTema(); pintar();
  };
  pintar();
  return b;
}

// ---------- Instalar como app y funcionar con poca señal ----------
export const registroSw = "serviceWorker" in navigator
  ? navigator.serviceWorker.register("sw.js").catch(() => null)
  : Promise.resolve(null);
let pedidoInstalar = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  pedidoInstalar = e;
  document.querySelectorAll("[data-instalar]").forEach((b) => (b.hidden = false));
});
// iPhone/iPad: Safari no ofrece el aviso de instalar; se explica cómo agregarla a la pantalla de inicio.
const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const instalada = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
function guiaIos() {
  const fondo = document.createElement("div");
  fondo.className = "modal";
  fondo.innerHTML = `<div class="ventana"><h2>Instalar en iPhone</h2>
    <ol class="guia-ios">
      <li>Abre esta página en <b>Safari</b>.</li>
      <li>Toca el botón <b>Compartir</b> (el cuadrito con la flecha hacia arriba).</li>
      <li>Baja y toca <b>Agregar a pantalla de inicio</b>.</li>
      <li>Toca <b>Agregar</b>. El ícono de ${esc(NOMBRE)} queda junto a tus apps.</li>
    </ol>
    <button class="boton" data-no>Entendido</button></div>`;
  document.body.append(fondo);
  $("[data-no]", fondo).onclick = () => fondo.remove();
}
export function botonInstalar() {
  const b = document.createElement("button");
  b.className = "boton secundario chico";
  b.dataset.instalar = "";
  b.hidden = !pedidoInstalar && !(esIos && !instalada);
  b.innerHTML = `${icono("descargar")} Instalar`;
  b.onclick = async () => {
    if (!pedidoInstalar) { if (esIos) guiaIos(); return; }
    pedidoInstalar.prompt();
    await pedidoInstalar.userChoice.catch(() => {});
    pedidoInstalar = null;
    document.querySelectorAll("[data-instalar]").forEach((x) => (x.hidden = true));
  };
  return b;
}

// ---------- Política de privacidad y cookies ----------
// Si la política cambia, sube la versión para que todos la acepten de nuevo.
export const VERSION_POLITICAS = "2026-10-04";
const CLAVE_POLITICAS = "whereapp.politicas";
export const politicasAceptadas = () => { try { return localStorage.getItem(CLAVE_POLITICAS) === VERSION_POLITICAS; } catch { return false; } };
export const aceptarPoliticas = () => { try { localStorage.setItem(CLAVE_POLITICAS, VERSION_POLITICAS); } catch {} };
export const ENLACE_POLITICAS = `<a href="privacidad.html" class="enlace">Política de privacidad y cookies</a>`;
// Aviso de cookies abajo (motorizados, panel y seguimiento; el cliente acepta al entrar).
export function avisoCookies() {
  if (politicasAceptadas() || $("#aviso-cookies")) return;
  const a = document.createElement("div");
  a.id = "aviso-cookies"; a.className = "aviso-cookies";
  a.innerHTML = `<p>${icono("escudo")} <span>Whereapp guarda tu sesión y preferencias en este teléfono para funcionar. No usamos cookies de publicidad ni de rastreo. <a href="privacidad.html#cookies">Más información</a></span></p>
    <button class="boton chico">Entendido</button>`;
  $("button", a).onclick = () => { aceptarPoliticas(); a.classList.add("fuera"); setTimeout(() => a.remove(), 300); };
  document.body.append(a);
}
if (ROL !== "cliente" || /seguir\.html$/.test(location.pathname)) setTimeout(avisoCookies, 1500);

// ---------- Sonido de alerta: corneta de moto ----------
// El navegador solo deja sonar después de que la persona toca la pantalla: el primer toque prepara el sonido
// y carga la corneta (corneta.mp3). Si el archivo no cargó, se imita con dos tonos.
let ctxSonido = null, corneta = null;
addEventListener("pointerdown", () => {
  try {
    ctxSonido = ctxSonido || new (window.AudioContext || window.webkitAudioContext)();
    ctxSonido.resume();
    if (!corneta) {
      corneta = fetch("corneta.mp3").then((r) => r.arrayBuffer()).then((b) => ctxSonido.decodeAudioData(b)).catch(() => (corneta = null));
    }
  } catch {}
}, { capture: true });
export async function sonarAlerta() {
  if (navigator.vibrate) navigator.vibrate([150, 80, 400]);
  if (!ctxSonido) return;
  try {
    ctxSonido.resume();
    const buf = corneta && (await corneta);
    if (buf && buf.duration) {
      const fuente = ctxSonido.createBufferSource(), vol = ctxSonido.createGain();
      vol.gain.value = 0.9;
      fuente.buffer = buf; fuente.connect(vol); vol.connect(ctxSonido.destination); fuente.start();
      return;
    }
    // Respaldo: "pi-piii" con dos tonos de bocina.
    const t = ctxSonido.currentTime;
    [[0, 0.16], [0.23, 0.42]].forEach(([d, largo]) => [415, 498].forEach((f) => {
      const o = ctxSonido.createOscillator(), g = ctxSonido.createGain();
      o.type = "square"; o.frequency.value = f; o.connect(g); g.connect(ctxSonido.destination);
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.01);
      g.gain.setValueAtTime(0.18, t + d + largo - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d + largo);
      o.start(t + d); o.stop(t + d + largo);
    }));
  } catch {}
}

// ---------- Avisos en la barra de notificaciones (sin servidor) ----------
export const avisosPosibles = () => "Notification" in window && "serviceWorker" in navigator;
export async function pedirPermisoAvisos() {
  if (!avisosPosibles() || Notification.permission !== "default") return;
  try { await Notification.requestPermission(); } catch {}
}
export async function notificar(titulo, cuerpo, { tag = "whereapp", sonar = true, url = location.href.split("#")[0], urgente = false } = {}) {
  if (!avisosPosibles() || Notification.permission !== "granted") return;
  const reg = (await registroSw) || (await navigator.serviceWorker.ready.catch(() => null));
  if (!reg) return;
  reg.showNotification(titulo, {
    body: cuerpo, tag, renotify: sonar, silent: !sonar, icon: "icono-192.png", badge: "icono-192.png",
    data: { url }, vibrate: sonar ? (urgente ? [150, 80, 400, 120, 400] : [200, 100, 200]) : undefined,
    requireInteraction: urgente,   // se queda en la barra hasta que la toque
  }).catch(() => {});
}
// Pide permiso de notificaciones con el primer toque en la pantalla (algunos teléfonos solo lo permiten así).
export function pedirAvisosAlTocar() {
  if (!avisosPosibles() || Notification.permission !== "default") return;
  addEventListener("pointerdown", () => { Notification.requestPermission().catch(() => {}); }, { once: true, capture: true });
}

// ---------- Chat de la carrera (cliente ↔ motorizado) ----------
const vistoChat = {
  leer(id) { try { return Number(localStorage.getItem("whereapp.chat." + id)) || 0; } catch { return 0; } },
  guardar(id, n) { try { localStorage.setItem("whereapp.chat." + id, String(n)); } catch {} },
};
// Escucha los mensajes de una carrera. alCambiar(mensajes, sinLeer) se llama con cada mensaje nuevo.
export function escucharChat(carreraId, yoUid, alCambiar) {
  return onSnapshot(query(collection(db, "carreras", carreraId, "mensajes"), orderBy("fecha"), limit(200)), (s) => {
    const msgs = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    const ajenos = msgs.filter((m) => m.de !== yoUid).length;
    alCambiar(msgs, Math.max(0, ajenos - vistoChat.leer(carreraId)), ajenos);
  }, () => {});
}
export const marcarChatLeido = (carreraId, ajenos) => vistoChat.guardar(carreraId, ajenos);

// Ventana de chat (hoja que sube). Devuelve una función para cerrarla.
export function abrirChat(carreraId, yoUid, yoNombre, conQuien) {
  const fondo = document.createElement("div");
  fondo.className = "modal";
  fondo.innerHTML = `<div class="ventana chat">
    <div class="chat-cabeza"><h2>${icono("chat")} Chat con ${esc(conQuien)}</h2><button class="quitar" data-cerrar aria-label="Cerrar">${icono("cerrar")}</button></div>
    <div class="chat-mensajes" id="chat-mensajes"><p class="nota">Cargando…</p></div>
    <form class="chat-escribir" id="chat-form"><input id="chat-texto" maxlength="500" placeholder="Escribe un mensaje…" autocomplete="off">
      <button class="boton chico" aria-label="Enviar">${icono("enviar")}</button></form>
    <div class="chat-rapidos">${["Ya voy", "Estoy afuera", "¿Dónde estás?", "Gracias"].map((t) => `<button type="button" class="pildora" data-rapido="${esc(t)}">${esc(t)}</button>`).join("")}</div>
  </div>`;
  document.body.append(fondo);
  const lista = fondo.querySelector("#chat-mensajes");
  const quitar = escucharChat(carreraId, yoUid, (msgs, _sin, ajenos) => {
    marcarChatLeido(carreraId, ajenos);
    lista.innerHTML = msgs.length ? msgs.map((m) => `<div class="burbuja ${m.de === yoUid ? "mia" : ""}"><span>${esc(m.texto)}</span><small>${esc(m.de === yoUid ? "Tú" : m.nombre || conQuien)} · ${fecha(m.fecha) ? fecha(m.fecha).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }) : "…"}</small></div>`).join("")
      : `<p class="nota" style="text-align:center">Todavía no hay mensajes. Escribe el primero.</p>`;
    lista.scrollTop = lista.scrollHeight;
  });
  const enviar = async (texto) => {
    texto = texto.trim();
    if (!texto) return;
    try { await addDoc(collection(db, "carreras", carreraId, "mensajes"), { de: yoUid, nombre: yoNombre, texto: texto.slice(0, 500), fecha: serverTimestamp() }); }
    catch { aviso("No se pudo enviar el mensaje"); }
  };
  fondo.querySelector("#chat-form").onsubmit = (e) => { e.preventDefault(); const i = fondo.querySelector("#chat-texto"); enviar(i.value); i.value = ""; };
  fondo.querySelectorAll("[data-rapido]").forEach((b) => (b.onclick = () => enviar(b.dataset.rapido)));
  const cerrar = () => { quitar(); fondo.remove(); };
  fondo.querySelector("[data-cerrar]").onclick = cerrar;
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
  return cerrar;
}

// ---------- Aviso de "sin conexión" ----------
(function avisoConexion() {
  const barra = document.createElement("div");
  barra.className = "sin-conexion";
  barra.setAttribute("role", "status");
  barra.innerHTML = `${icono("alerta")} Sin conexión a internet. Reintentando…`;
  const pintar = () => {
    if (!document.body) return;
    if (!barra.isConnected) document.body.append(barra);
    barra.classList.toggle("ver", !navigator.onLine);
  };
  addEventListener("offline", pintar);
  addEventListener("online", () => { pintar(); aviso("Conexión restablecida"); });
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", pintar); else pintar();
})();
