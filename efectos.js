// Whereapp — efectos visuales de la app de pasajeros (negro y dorado).
// Todo respeta "reducir movimiento" del teléfono y se apaga solo cuando no se ve.

const quieto = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ORO = ["#60a5fa", "#1d4ed8", "#2563eb", "#bfdbfe"];

// ---------- Vibración suave ----------
export function vibrar(patron = 12) {
  try { if (navigator.vibrate) navigator.vibrate(patron); } catch {}
}
// Al tocar un botón: un toquecito.
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest?.(".boton, .barra button")) vibrar(8);
}, { passive: true });

// ---------- Vórtice dorado (pantalla de entrada) ----------
// Partículas azules girando lento alrededor del centro. Solo mientras se ve la pantalla de entrada.
let vortice = null;
function iniciarVortice() {
  if (vortice || quieto()) return;
  const c = document.createElement("canvas");
  c.className = "vortice";
  document.body.prepend(c);
  const ctx = c.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  let w = 0, h = 0;
  const medir = () => { w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  medir(); addEventListener("resize", medir);
  const N = Math.round(Math.min(220, (w * h) / 2600));
  const ps = Array.from({ length: N }, () => ({
    r: 30 + Math.random() * Math.max(w, h) * 0.62, a: Math.random() * Math.PI * 2,
    v: (0.0016 + Math.random() * 0.004) * (Math.random() < 0.85 ? 1 : -1),
    t: 0.6 + Math.random() * 1.8, c: ORO[(Math.random() * ORO.length) | 0], f: Math.random() * Math.PI * 2,
  }));
  let id = 0, ultimo = performance.now();
  const paso = (ahora) => {
    const dt = Math.min(50, ahora - ultimo); ultimo = ahora;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,.22)";           // rastro: cada cuadro borra un poco (sirve en fondo claro)
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    const cx = w / 2, cy = h * 0.42;
    for (const p of ps) {
      p.a += p.v * dt * (1 + 60 / p.r);           // más rápido cerca del centro (efecto remolino)
      p.r -= 0.004 * dt * (p.r / 300);              // se va cerrando poco a poco…
      if (p.r < 20) p.r = Math.max(w, h) * 0.65;   // …y renace afuera
      const x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r * 0.62;
      const brillo = 0.45 + 0.55 * Math.sin(ahora / 600 + p.f) ** 2;
      ctx.globalAlpha = brillo * 0.8;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(x, y, p.t, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    id = requestAnimationFrame(paso);
  };
  id = requestAnimationFrame(paso);
  vortice = { parar: () => { cancelAnimationFrame(id); removeEventListener("resize", medir); c.classList.add("fuera"); setTimeout(() => c.remove(), 600); } };
}
function pararVortice() { if (vortice) { vortice.parar(); vortice = null; } }
// Se enciende y se apaga solo según lo que hay en pantalla.
new MutationObserver(() => {
  const entrada = document.querySelector("#vista > .entrada");
  if (entrada && !document.hidden) iniciarVortice(); else pararVortice();
  escribirLogos();
}).observe(document.body, { childList: true, subtree: true });
document.addEventListener("visibilitychange", () => { if (document.hidden) pararVortice(); else if (document.querySelector("#vista > .entrada")) iniciarVortice(); });

// ---------- Logo que se escribe ----------
// Una vez por sesión: las letras aparecen una por una y el subrayado se dibuja debajo.
let logoEscrito = false;
try { logoEscrito = sessionStorage.getItem("whereapp.logo") === "1"; } catch {}
function escribirLogos() {
  if (logoEscrito || quieto()) return;
  const el = document.querySelector(".entrada .logo, .cabecera .logo");
  if (!el || el.dataset.escrito) return;
  el.dataset.escrito = "1";
  logoEscrito = true;
  try { sessionStorage.setItem("whereapp.logo", "1"); } catch {}
  const texto = el.textContent;
  el.innerHTML = [...texto].map((l, i) => `<span class="letra" style="animation-delay:${0.15 + i * 0.07}s">${l}</span>`).join("");
  el.classList.add("escribiendo");
  el.style.setProperty("--fin-letras", `${0.15 + texto.length * 0.07}s`);
  setTimeout(() => { el.classList.remove("escribiendo"); el.textContent = texto; }, (0.9 + texto.length * 0.07) * 1000 + 400);
}

// ---------- Barra con píldora líquida ----------
// La marca dorada se estira hasta la pestaña nueva y luego se encoge, como una gota.
(() => {
  const iniciar = () => {
    const barra = document.getElementById("barra");
    if (!barra) return;
    let antes = null;
    const caja = () => {
      const b = barra.querySelector(`button[data-ruta="${barra.dataset.activa}"]`);
      return b ? { x: b.offsetLeft, w: b.offsetWidth } : null;
    };
    new MutationObserver(() => {
      const ind = barra.querySelector(".indicador");
      const ahora = caja();
      if (!ind || !ahora) return;
      if (antes && (antes.x !== ahora.x) && !quieto() && ind.animate) {
        const x0 = Math.min(antes.x, ahora.x), x1 = Math.max(antes.x + antes.w, ahora.x + ahora.w);
        ind.animate([
          { transform: `translateX(${antes.x}px)`, width: `${antes.w}px` },
          { transform: `translateX(${x0}px)`, width: `${x1 - x0}px`, offset: 0.45 },
          { transform: `translateX(${ahora.x}px)`, width: `${ahora.w}px` },
        ], { duration: 520, easing: "cubic-bezier(.3,1.25,.5,1)" });
      }
      antes = ahora;
    }).observe(barra, { attributes: true, attributeFilter: ["data-activa"] });
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();

// ---------- Foto que vuela al perfil (elemento compartido) ----------
export function volar(origen, destino) {
  if (!origen || !destino || quieto() || !origen.animate) return;
  const a = origen.getBoundingClientRect();
  if (!a.width) return;
  const cs = getComputedStyle(origen);
  const clon = origen.cloneNode(true);
  clon.removeAttribute("data-perfil"); clon.removeAttribute("data-foto-moto");
  Object.assign(clon.style, {
    position: "fixed", left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", margin: 0,
    zIndex: 2000, pointerEvents: "none", backgroundImage: cs.backgroundImage, backgroundSize: "cover", backgroundPosition: "center",
    borderRadius: cs.borderRadius, transformOrigin: "0 0", boxShadow: "0 0 30px 4px rgba(29,78,216,.45)",
  });
  document.body.append(clon);
  destino.style.opacity = "0";
  // Mientras la ventana del perfil sube, la foto "se levanta"; cuando la ventana termina, vuela a su lugar.
  clon.animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }], { duration: 220, fill: "forwards", easing: "ease-out" });
  const ventana = destino.closest(".ventana") || destino;
  const esperar = Promise.race([
    Promise.all((ventana.getAnimations ? ventana.getAnimations() : []).map((x) => x.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 700)),
  ]);
  esperar.then(() => {
    const b = destino.getBoundingClientRect();
    if (!b.width || !document.body.contains(destino)) { destino.style.opacity = ""; clon.remove(); return; }
    const dx = b.left - a.left, dy = b.top - a.top, sx = b.width / a.width, sy = b.height / a.height;
    const radioFin = getComputedStyle(destino).borderRadius;
    clon.animate([
      { transform: "translate(0,0) scale(1.15)", borderRadius: cs.borderRadius },
      { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 40}px) scale(${(1 + sx) / 2},${(1 + sy) / 2})`, offset: 0.55 },
      { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, borderRadius: radioFin, boxShadow: "0 0 0 0 rgba(29,78,216,0)" },
    ], { duration: 480, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }).onfinish = () => {
      destino.style.opacity = ""; destino.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      clon.remove();
    };
  });
}

// ---------- Ruta que se dibuja sola ----------
// Solo cuando la ruta cambia (no en cada redibujo de la pantalla).
let ultimaRuta = "";
export function dibujarLinea(linea, firma) {
  if (quieto() || !linea) return;
  if (firma === ultimaRuta) return;
  ultimaRuta = firma;
  requestAnimationFrame(() => {
    const p = linea._path;
    if (!p || !p.getTotalLength) return;
    const largo = p.getTotalLength();
    if (!largo) return;
    p.classList.add("trazando");
    p.style.strokeDasharray = `${largo}`;
    p.animate([{ strokeDashoffset: largo }, { strokeDashoffset: 0 }], { duration: Math.min(1400, 500 + largo), easing: "cubic-bezier(.45,0,.2,1)" })
      .onfinish = () => { p.style.strokeDasharray = ""; p.classList.remove("trazando"); };
  });
}

// ---------- Confeti dorado ----------
export function confeti() {
  if (quieto()) return;
  const c = document.createElement("canvas");
  c.className = "confeti";
  document.body.append(c);
  const ctx = c.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
  c.width = w * dpr; c.height = h * dpr; ctx.scale(dpr, dpr);
  const ps = Array.from({ length: 140 }, (_, i) => {
    const izq = i % 2 === 0;
    return { x: izq ? -10 : w + 10, y: h * 0.62, vx: (izq ? 1 : -1) * (4 + Math.random() * 7), vy: -(9 + Math.random() * 9),
      g: 0.28 + Math.random() * 0.1, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      tw: 6 + Math.random() * 6, th: 3 + Math.random() * 4, c: ORO[(Math.random() * ORO.length) | 0] };
  });
  const inicio = performance.now();
  const paso = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.vx *= 0.985; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - (t - inicio) / 2600);
      ctx.fillRect(-p.tw / 2, -p.th / 2 * Math.abs(Math.cos(p.r * 2)), p.tw, p.th * Math.abs(Math.cos(p.r * 2)) + 0.5);
      ctx.restore();
    }
    if (t - inicio < 2600) requestAnimationFrame(paso); else c.remove();
  };
  requestAnimationFrame(paso);
}

// ---------- Aviso tipo "isla" ----------
// Una cápsula negra baja de arriba, se expande con el mensaje y luego se recoge.
let islaActual = null;
export function isla(titulo, texto = "", icono = "") {
  if (islaActual) islaActual.remove();
  const el = document.createElement("div");
  el.className = "isla";
  el.innerHTML = `<div class="isla-icono">${icono}</div><div class="isla-texto"><b></b><span></span></div>`;
  el.querySelector("b").textContent = titulo;
  el.querySelector("span").textContent = texto;
  document.body.append(el);
  islaActual = el;
  requestAnimationFrame(() => el.classList.add("abierta"));
  const cerrar = () => { el.classList.remove("abierta"); el.classList.add("cerrando"); setTimeout(() => el.remove(), 500); if (islaActual === el) islaActual = null; };
  el.onclick = cerrar;
  setTimeout(cerrar, 4200);
  vibrar([20, 60, 30]);
}

// ---------- Precio que cuenta hasta su valor ----------
export function contar(el, hasta, formato, ms = 700) {
  if (!el || !Number.isFinite(hasta)) return;
  const desde = Number(el.dataset.valor) || 0;
  el.dataset.valor = hasta;
  if (quieto() || Math.abs(hasta - desde) < 0.005) { el.textContent = formato(hasta); return; }
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = formato(desde + (hasta - desde) * e);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// ---------- Pestañas con elemento compartido ----------
// El botón que se toca en la barra crece y se convierte en la pantalla nueva (transformación de contenedor).
// Usa View Transitions (Chrome); si el teléfono no la tiene, una burbuja del color de la marca crece desde el botón.
export function cambiarPestana(boton, actualizar) {
  const vista = document.getElementById("vista");
  if (quieto() || !boton || !vista) return actualizar();
  if (document.startViewTransition) {
    boton.style.viewTransitionName = "pestana";
    let t;
    try {
      t = document.startViewTransition(() => {
        boton.style.viewTransitionName = "";
        actualizar();
        vista.style.viewTransitionName = "pestana";
      });
    } catch { boton.style.viewTransitionName = ""; return actualizar(); }
    t.finished.finally(() => { vista.style.viewTransitionName = ""; boton.style.viewTransitionName = ""; });
    return;
  }
  const r = boton.getBoundingClientRect();
  const fin = { x: 0, y: 0, w: innerWidth, h: innerHeight };
  const burbuja = document.createElement("div");
  burbuja.className = "burbuja-pestana";
  Object.assign(burbuja.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  document.body.appendChild(burbuja);
  const dx = fin.x - r.left, dy = fin.y - r.top;
  const a = burbuja.animate([
    { transform: "none", borderRadius: "22px", opacity: 0.95 },
    { transform: `translate(${dx}px,${dy}px) scale(${fin.w / r.width},${fin.h / r.height})`, borderRadius: "0px", opacity: 0.9, offset: 0.55 },
    { transform: `translate(${dx}px,${dy}px) scale(${fin.w / r.width},${fin.h / r.height})`, borderRadius: "0px", opacity: 0 },
  ], { duration: 560, easing: "cubic-bezier(.3,.9,.3,1)" });
  setTimeout(actualizar, 300);
  a.onfinish = a.oncancel = () => burbuja.remove();
}
