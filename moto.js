// Whereapp — apartado de motorizados: ver carreras nuevas, aceptarlas, compartir ubicación y terminarlas.

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, onSnapshot, updateDoc, collection, query, where, runTransaction, serverTimestamp, arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, db, NOMBRE, correoDe, $, $$, esc, usd, fecha, fechaTexto, estrellas, habilitado, ICONOS, nuevoMapa,
  mapsLink, aviso, elegirMotivo, MOTIVOS_MOTO, avisoSinConfigurar,
} from "./comun.js";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  const L = window.L;
  let yo = null, perfil = null, subs = [], subsCarreras = [];
  let disponibles = [], miCarrera = null, conocidas = new Set(), primeraCarga = true;
  let mapa = null, vigilaGps = null, sonido = null;

  onAuthStateChanged(auth, (u) => {
    subs.forEach((f) => f()); subs = [];
    pararCarreras(); pararGps();
    yo = u; perfil = null; miCarrera = null; disponibles = [];
    if (!u) return pantallaEntrada();
    subs.push(onSnapshot(doc(db, "motorizados", u.uid), (s) => {
      if (!s.exists()) { aviso("Esta cuenta no es de un motorizado"); signOut(auth); return; }
      const antes = perfil && habilitado(perfil);
      const firmaAntes = firma(perfil);
      perfil = { id: s.id, ...s.data() };
      if (antes !== habilitado(perfil) || !subsCarreras.length) escucharCarreras();
      // Los cambios de ubicación (cada pocos segundos) no redibujan la pantalla.
      if (firma(perfil) !== firmaAntes) pintar();
    }));
  });

  function firma(p) {
    if (!p) return "";
    const { ubicacion, ...resto } = p;
    return JSON.stringify(resto);
  }

  function pantallaEntrada() {
    $("#cabecera").hidden = true;
    $("#vista").innerHTML = `<div class="entrada">
      <div class="logo">${NOMBRE}</div><div class="logo-sub">Apartado de motorizados</div>
      <form class="caja" id="login"><h2>Entrar</h2>
        <label for="usuario">Usuario</label><input id="usuario" autocomplete="username" autocapitalize="none">
        <label for="clave">Clave</label><input id="clave" type="password" autocomplete="current-password">
        <button class="boton">Entrar</button>
        <p class="nota">El usuario y la clave te los da el administrador.</p></form></div>`;
    $("#login").onsubmit = async (e) => {
      e.preventDefault();
      try { await signInWithEmailAndPassword(auth, correoDe($("#usuario").value), $("#clave").value); }
      catch { aviso("Usuario o clave incorrectos"); }
    };
  }

  // ---------- Carreras ----------
  function pararCarreras() { subsCarreras.forEach((f) => f()); subsCarreras = []; }
  function escucharCarreras() {
    pararCarreras();
    // Su carrera aceptada (aunque lo hayan desactivado, debe poder terminarla).
    subsCarreras.push(onSnapshot(query(collection(db, "carreras"), where("motoUid", "==", yo.uid), where("estado", "==", "aceptada")), (s) => {
      miCarrera = s.docs.length ? { id: s.docs[0].id, ...s.docs[0].data() } : null;
      if (miCarrera) iniciarGps(); else pararGps();
      pintar();
    }, () => {}));
    if (!habilitado(perfil)) { disponibles = []; return; }
    primeraCarga = true;
    subsCarreras.push(onSnapshot(query(collection(db, "carreras"), where("estado", "==", "esperando")), (s) => {
      disponibles = s.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => !c.paraMoto || c.paraMoto === yo.uid)
        .sort((a, b) => (fecha(a.creada) || 0) - (fecha(b.creada) || 0));
      const nuevas = disponibles.filter((c) => !conocidas.has(c.id));
      nuevas.forEach((c) => conocidas.add(c.id));
      if (nuevas.length && !primeraCarga) { sonar(); aviso("🔔 ¡Carrera nueva!"); }
      primeraCarga = false;
      pintar();
    }, () => {}));
  }

  // ---------- Sonido ----------
  function sonar() {
    if (!sonido) return;
    const t = sonido.currentTime;
    [0, 0.25, 0.5].forEach((d) => {
      const o = sonido.createOscillator(), g = sonido.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(sonido.destination);
      g.gain.setValueAtTime(0.4, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.2);
      o.start(t + d); o.stop(t + d + 0.2);
    });
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  // ---------- Ubicación en vivo ----------
  function iniciarGps() {
    if (vigilaGps !== null || !navigator.geolocation) return;
    let ultima = 0;
    vigilaGps = navigator.geolocation.watchPosition((p) => {
      if (Date.now() - ultima < 8000) return; // como máximo cada 8 segundos
      ultima = Date.now();
      updateDoc(doc(db, "motorizados", yo.uid), { ubicacion: { lat: p.coords.latitude, lng: p.coords.longitude, t: new Date() } }).catch(() => {});
    }, () => aviso("Activa la ubicación para que el cliente te vea llegar"), { enableHighAccuracy: true });
  }
  function pararGps() { if (vigilaGps !== null) { navigator.geolocation.clearWatch(vigilaGps); vigilaGps = null; } }

  // ---------- Pantalla ----------
  function pintar() {
    if (!perfil) return;
    if (mapa) { mapa.remove(); mapa = null; }
    const ok = habilitado(perfil);
    const vence = fecha(perfil.pagadoHasta);
    $("#cabecera").hidden = false;
    $("#cabecera").innerHTML = `<div class="dentro"><div><div class="logo">${NOMBRE}</div><div class="logo-sub">${esc(perfil.nombre)} · ${estrellas(perfil)}</div></div>
      <div class="derecha"><span class="pildora ${ok ? "ok" : "mal"}">${ok ? "● Activo" : "Inactivo"}</span>
      <button class="boton secundario chico" id="salir">Salir</button></div></div>`;
    $("#salir").onclick = () => signOut(auth);

    let html = "";
    if (!perfil.activo) html += `<div class="caja"><h2>Estás inactivo</h2><p class="nota">El administrador debe activarte para que recibas carreras y salgas en la app.</p></div>`;
    else if (!ok) html += `<div class="caja"><h2>Quincena vencida</h2><p class="nota">Tu pago venció el ${fechaTexto(vence)}. Paga la cuota al administrador para volver a salir en la app.</p></div>`;
    else if (vence && vence - new Date() < 3 * 864e5) html += `<p class="pildora alerta" style="display:inline-block;margin-top:12px">Tu quincena vence el ${fechaTexto(vence)}</p>`;

    if (miCarrera) html += vistaMiCarrera(miCarrera);
    else if (ok) {
      html += `${sonido ? "" : `<button class="boton secundario" id="activar-sonido">🔔 Activar sonido de carreras nuevas</button>`}
        <h1 class="titulo">Carreras disponibles (${disponibles.length})</h1>
        <div class="lista">${disponibles.length ? disponibles.map(tarjetaCarrera).join("") : `<div class="vacio"><span>🛵</span>No hay carreras por ahora.<br>Deja esta pantalla abierta: te avisamos con un sonido.</div>`}</div>`;
    }
    $("#vista").innerHTML = html;

    const s = $("#activar-sonido");
    if (s) s.onclick = () => { sonido = new (window.AudioContext || window.webkitAudioContext)(); sonar(); pintar(); };
    $$("[data-aceptar]").forEach((b) => (b.onclick = () => aceptar(b.dataset.aceptar)));
    if (miCarrera) activarMiCarrera(miCarrera);
  }

  const tipoTexto = (c) => (c.tipo === "mototaxi" ? "🏍️ Mototaxi" : "📦 Delivery");
  const tarjetaCarrera = (c) => `
    <article class="tarjeta"><div class="info">
      <h3>${tipoTexto(c)} · ${usd(c.precio)} · ${c.km} km ${c.paraMoto ? `<span class="pildora">Para ti</span>` : ""}</h3>
      <p><b>A:</b> ${esc(c.origen.dir)}</p><p><b>B:</b> ${esc(c.destino.dir)}</p>
      ${c.nota ? `<p><b>Llevar:</b> ${esc(c.nota)}</p>` : ""}
      <p>${esc(c.clienteNombre)} · ${fechaTexto(c.creada)}</p></div>
      <div class="acciones">
        <a class="boton secundario" href="${mapsLink(c.origen)}" target="_blank" rel="noopener">Ver A en mapa</a>
        <button class="boton" data-aceptar="${c.id}">Aceptar</button></div>
    </article>`;

  async function aceptar(id) {
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "carreras", id);
        const s = await tx.get(ref);
        if (!s.exists() || s.data().estado !== "esperando") throw new Error("tomada");
        tx.update(ref, {
          estado: "aceptada", motoUid: yo.uid, motoNombre: perfil.nombre, motoTel: perfil.telefono || "",
          motoMoto: perfil.moto || "", motoPlaca: perfil.placa || "", aceptada: serverTimestamp(),
        });
      });
      aviso("¡Carrera aceptada!");
    } catch {
      aviso("Otro motorizado ya la aceptó");
    }
  }

  function vistaMiCarrera(c) {
    return `<h1 class="titulo">Tu carrera en curso</h1>
      <div class="caja">
        <div class="fila"><span>Servicio</span><b>${tipoTexto(c)}</b></div>
        <div class="fila"><span>Cliente</span><span>${esc(c.clienteNombre)}</span></div>
        <div class="fila"><span>Cobrar</span><b>${usd(c.precio)}</b></div>
        <div class="fila"><span>Distancia</span><span>${c.km} km</span></div>
        ${c.nota ? `<div class="fila"><span>Llevar</span><span>${esc(c.nota)}</span></div>` : ""}
      </div>
      <div class="mapa" id="mapa"></div>
      <div class="caja">
        <div class="fila"><span>🟢 A (origen)</span><span>${esc(c.origen.dir)}</span></div>
        <a class="boton secundario" href="${mapsLink(c.origen)}" target="_blank" rel="noopener">Ir al punto A con Google Maps</a>
        <div class="fila" style="margin-top:10px"><span>🟣 B (destino)</span><span>${esc(c.destino.dir)}</span></div>
        <a class="boton secundario" href="${mapsLink(c.destino)}" target="_blank" rel="noopener">Ir al punto B con Google Maps</a>
      </div>
      <a class="boton" href="tel:${esc(c.clienteTel)}">📞 Llamar a ${esc(c.clienteNombre)}</a>
      <button class="boton verde" id="termine">✅ Terminé</button>
      <button class="boton peligro" id="cancelar">Cancelar carrera</button>
      <p class="nota">Mientras tengas una carrera, tu ubicación se comparte con el cliente.</p>`;
  }

  function activarMiCarrera(c) {
    mapa = nuevoMapa("mapa");
    L.marker(c.origen, { icon: ICONOS.origen }).addTo(mapa);
    L.marker(c.destino, { icon: ICONOS.destino }).addTo(mapa);
    mapa.fitBounds(L.latLngBounds([c.origen, c.destino]).pad(0.3), { animate: false });
    $("#termine").onclick = async () => {
      if (!confirm("¿Entregaste y cobraste la carrera?")) return;
      await updateDoc(doc(db, "carreras", c.id), { estado: "terminada", terminada: serverTimestamp() });
      aviso("¡Carrera terminada!");
    };
    $("#cancelar").onclick = async () => {
      const motivo = await elegirMotivo("¿Por qué cancelas?", MOTIVOS_MOTO);
      if (!motivo) return;
      // La carrera vuelve a quedar disponible para los demás motorizados.
      await updateDoc(doc(db, "carreras", c.id), {
        estado: "esperando", motoUid: null, paraMoto: null, paraMotoNombre: null,
        cancelaciones: arrayUnion({ por: "motorizado", motoUid: yo.uid, motoNombre: perfil.nombre, motivo, fecha: new Date() }),
      });
      aviso("Cancelaste la carrera");
    };
  }
}
