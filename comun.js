// Whereapp — piezas compartidas por la app del cliente, la de motorizados y el panel.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig as configReal } from "./firebase-config.js";
import { icono, pintarIconos } from "./iconos.js";

export { icono };
pintarIconos();

export const NOMBRE = "Whereapp";
// En la computadora (localhost) la app usa el simulador de Firebase, para hacer pruebas sin tocar los datos reales.
const simulador = location.hostname === "localhost";
export const firebaseConfig = simulador ? { ...configReal, apiKey: "demo", projectId: "demo-whereapp" } : configReal;
export const configurado = simulador || !String(configReal.apiKey).startsWith("PEGA");
export const app = initializeApp(firebaseConfig);
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
export const correoDe = (usuario) => `${String(usuario).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@whereapp.app`;

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
export async function ruta(a, b) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    const j = await r.json();
    if (j.code !== "Ok") throw 0;
    return { km: j.routes[0].distance / 1000, linea: j.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
  } catch {
    return { km: lineaRecta(a, b) * 1.3, linea: [[a.lat, a.lng], [b.lat, b.lng]] };
  }
}

export const mapsLink = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

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
};
export function nuevoMapa(id) {
  const m = window.L.map(id, { zoomControl: true }).setView(CENTRO, 14);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
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
    const b = $(`button[data-ruta="${barra.dataset.ruta}"]`, barra);
    if (!b) return;
    ind.style.width = b.offsetWidth + "px";
    ind.style.transform = `translateX(${b.offsetLeft}px)`;
  };
  barra.dataset.ruta = ruta;
  $$("button", barra).forEach((b) => b.classList.toggle("activo", b.dataset.ruta === ruta));
  mover();
  if (!barra.dataset.escucha) { barra.dataset.escucha = "1"; addEventListener("resize", mover); }
}
