// Whereapp — piezas compartidas por la app del cliente, la de motorizados y el panel.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig as configReal } from "./firebase-config.js?v=25";
import { icono, pintarIconos } from "./iconos.js?v=25";

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
export const fecha = (t) => (t ? (t.toDate ? t.toDate() : new Date(t)) : null);
export const fechaTexto = (t) => { const f = fecha(t); return f ? f.toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" }) : "—"; };
export const estrellas = (m) => {
  if (!m.ratingCount) return "Sin calificaciones";
  const p = m.ratingSum / m.ratingCount;
  return `${icono("estrella")} ${p.toFixed(1)} (${m.ratingCount})`;
};
export const promedio = (m) => (m.ratingCount ? m.ratingSum / m.ratingCount : 0);

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
};
export async function leerTarifas() {
  try {
    const s = await getDoc(doc(db, "config", "general"));
    return { ...TARIFAS_BASE, ...(s.exists() ? s.data() : {}) };
  } catch { return TARIFAS_BASE; }
}
export const precio = (t, tipo, km) => Math.round((t[tipo].base + t[tipo].porKm * km) * 100) / 100;

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

export const mapsLink = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

// Todos los puntos de una carrera en orden: A, paradas, B y, si es ida y vuelta, A otra vez.
export const puntosCarrera = (c) => [c.origen, ...(c.paradas || []), c.destino, ...(c.retorno ? [c.origen] : [])];

// Ruta completa en Google Maps (con las paradas como puntos intermedios).
export function mapsRuta(c) {
  const pts = puntosCarrera(c);
  const txt = (p) => `${p.lat},${p.lng}`;
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
  iconSize: [30, 30], iconAnchor: [15, 30],
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
export function nuevoMapa(id, modo = "") {
  const L = window.L;
  const libre = modo === "libre", mini = modo === "mini";
  const m = L.map(id, {
    zoomControl: false, dragging: libre, scrollWheelZoom: libre, doubleClickZoom: false, boxZoom: false, keyboard: false,
    touchZoom: !mini, attributionControl: !mini,
    maxBounds: LIMITES, maxBoundsViscosity: 1, minZoom: 12,
  }).setView(CENTRO, 14);
  if (mini) {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
    return m;
  }
  L.control.zoom({ position: "bottomleft" }).addTo(m);
  const Controles = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd() {
      const caja = L.DomUtil.create("div", "leaflet-bar controles-mapa");
      caja.innerHTML = `${libre ? "" : `<a href="#" role="button" data-mover title="Mover el mapa">${icono("mano")}</a>`}<a href="#" role="button" data-centro title="Volver al centro de El Moján">${icono("centro")}</a>`;
      L.DomEvent.disableClickPropagation(caja);
      if (!libre) caja.querySelector("[data-mover]").onclick = (e) => {
        e.preventDefault();
        const activo = !m.dragging.enabled();
        activo ? m.dragging.enable() : m.dragging.disable();
        e.currentTarget.classList.toggle("activo", activo);
        aviso(activo ? "Ahora puedes mover el mapa con el dedo" : "Mapa fijo");
      };
      caja.querySelector("[data-centro]").onclick = (e) => { e.preventDefault(); m.setView(CENTRO, 14, { animate: false }); };
      return caja;
    },
  });
  new Controles().addTo(m);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
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
  if (!u) return { recogido, titulo, detalle: "Esperando la ubicación del motorizado…", pct: recogido ? 50 : 0, min: null, km: null };
  const km = lineaRecta(u, meta) * 1.3;
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
  otro: { icono: "pin", color: "#6b7280", nombre: "Lugar" },
};
export const tipoLugar = (t) => TIPOS_LUGAR[t] || TIPOS_LUGAR.otro;

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
  return "otro";
}

// Se descargan una vez y se guardan 7 días en el teléfono (Overpass, gratis).
let lugaresEnCamino = null;
export function cargarLugares() {
  if (!lugaresEnCamino) lugaresEnCamino = descargarLugares().catch((e) => { lugaresEnCamino = null; throw e; });
  return lugaresEnCamino;
}
async function descargarLugares() {
  const CLAVE = "whereapp.lugares.v1";
  try { const g = JSON.parse(localStorage.getItem(CLAVE)); if (g && Date.now() - g.t < 7 * 864e5 && g.l.length) return g.l; } catch {}
  const [s, w, n, e] = [CENTRO[0] - 0.09, CENTRO[1] - 0.09, CENTRO[0] + 0.09, CENTRO[1] + 0.09].map((x) => x.toFixed(4));
  const caja = `(${s},${w},${n},${e})`;
  const q = `[out:json][timeout:25];(
    nwr["name"]["amenity"~"^(school|college|university|kindergarten|library|hospital|clinic|doctors|dentist|pharmacy|marketplace|restaurant|fast_food|cafe|bar|ice_cream|place_of_worship|townhall|police|fire_station|post_office|courthouse|community_centre|bank|fuel|bus_station)$"]${caja};
    nwr["name"]["shop"]${caja};
    nwr["natural"="beach"]${caja};
    nwr["name"]["leisure"~"^(park|stadium|sports_centre|pitch|playground)$"]${caja};
    nwr["name"]["tourism"]${caja};
    nwr["name"]["office"="government"]${caja};
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
  let lista = null;
  const pintar = () => {
    capa.eachLayer((x) => x.unbindTooltip());
    capa.clearLayers();
    m.getContainer().classList.toggle("sin-nombres", m.getZoom() < 17);
    if (!lista || m.getZoom() < 15) return;
    const vista = m.getBounds().pad(0.2);
    lista.filter((l) => vista.contains([l.lat, l.lng])).forEach((l) => {
      const mk = L.marker([l.lat, l.lng], { icon: iconoLugar(l) }).addTo(capa);
      mk.bindTooltip(esc(l.n), { permanent: true, direction: "top", offset: [0, -12], className: "nombre-lugar" });
      if (alTocar) mk.on("click", () => alTocar(l));
    });
  };
  m.on("moveend", pintar);
  const listo = cargarLugares().then((l) => { lista = l; pintar(); return l; });
  return { capa, listo };
}
