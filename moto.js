// Whereapp — apartado de motorizados: ver carreras nuevas, aceptarlas, compartir ubicación y terminarlas.

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, addDoc, onSnapshot, updateDoc, collection, query, where, runTransaction, serverTimestamp, arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ASPECTOS, insigniasSeguridad, textoCobro, FORMAS_PAGO, bs, auth, db, NOMBRE, motivoEntrada, correoDe, $, $$, esc, usd, fecha, fechaTexto, estrellas, habilitado, ICONOS, icono, botonTema, botonInstalar, pedirPermisoAvisos, notificar, escucharChat, abrirChat, nuevoMapa, mostrarLugares, marcarRecorrido, filasRecorrido, mapsRuta, transicion,
  mapsLink, aviso, elegirMotivo, MOTIVOS_MOTO, avisoSinConfigurar,
} from "./comun.js?v=39";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  const L = window.L;
  let yo = null, perfil = null, subs = [], subsCarreras = [];
  let disponibles = [], miCarrera = null, conocidas = new Set(), primeraCarga = true;
  let mapa = null, vigilaGps = null, sonido = null, ultimoModo = null;
  let terminadas = [], chat = { id: null, quitar: null, sinLeer: 0 }, bloqueoPantalla = null;
  // Mantener la pantalla encendida (se recuerda en este teléfono).
  let pantallaFija = (() => { try { return localStorage.getItem("whereapp.pantalla") === "1"; } catch { return false; } })();

  onAuthStateChanged(auth, (u) => {
    subs.forEach((f) => f()); subs = [];
    pararCarreras(); pararGps();
    yo = u; perfil = null; miCarrera = null; disponibles = []; ultimoModo = null;
    if (!u) return pantallaEntrada();
    subs.push(onSnapshot(doc(db, "motorizados", u.uid), (s) => {
      if (!s.exists()) { aviso("Esta cuenta no es de un motorizado"); signOut(auth); return; }
      const antes = perfil && habilitado(perfil);
      const turnoAntes = perfil ? perfil.deTurno !== false : null;
      const firmaAntes = firma(perfil);
      perfil = { id: s.id, ...s.data() };
      if (antes !== habilitado(perfil) || turnoAntes !== (perfil.deTurno !== false) || !subsCarreras.length) escucharCarreras();
      gpsSegunEstado();
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
      catch (err) { console.error(err); aviso(motivoEntrada(err)); }
    };
  }

  // ---------- Carreras ----------
  function pararCarreras() { subsCarreras.forEach((f) => f()); subsCarreras = []; }
  function escucharCarreras() {
    pararCarreras();
    // Su carrera aceptada (aunque lo hayan desactivado, debe poder terminarla).
    subsCarreras.push(onSnapshot(query(collection(db, "carreras"), where("motoUid", "==", yo.uid), where("estado", "==", "aceptada")), (s) => {
      miCarrera = s.docs.length ? { id: s.docs[0].id, ...s.docs[0].data() } : null;
      gpsSegunEstado();
      // Avisa a los clientes si está ocupado: sale activo pero con la etiqueta "Carrera en curso".
      // Se sincroniza siempre con la carrera real (aunque la cancele el cliente o el admin).
      if (perfil && !!perfil.enCarrera !== !!miCarrera) {
        updateDoc(doc(db, "motorizados", yo.uid), { enCarrera: !!miCarrera }).catch(() => {});
      }
      seguirChat();
      pintar();
    }, () => {}));
    // Carreras terminadas: para calcular sus ganancias.
    subsCarreras.push(onSnapshot(query(collection(db, "carreras"), where("motoUid", "==", yo.uid), where("estado", "==", "terminada")), (s) => {
      terminadas = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!miCarrera) pintar();
    }, () => {}));
    // Descansando: no recibe carreras nuevas (las que ya tiene sí las termina).
    if (!habilitado(perfil) || perfil.deTurno === false) { disponibles = []; return; }
    primeraCarga = true;
    subsCarreras.push(onSnapshot(query(collection(db, "carreras"), where("estado", "==", "esperando")), (s) => {
      disponibles = s.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => !c.paraMoto || c.paraMoto === yo.uid)
        .sort((a, b) => (fecha(a.creada) || 0) - (fecha(b.creada) || 0));
      const nuevas = disponibles.filter((c) => !conocidas.has(c.id));
      nuevas.forEach((c) => conocidas.add(c.id));
      if (nuevas.length && !primeraCarga) {
        sonar(); aviso("¡Carrera nueva!");
        // Si la app está en segundo plano, aviso en la barra de notificaciones.
        const c = nuevas[0];
        if (document.hidden) notificar("¡Carrera nueva!", `${textoCobro(c)} · ${c.km} km · ${c.origen.dir}`, { tag: "whereapp-moto" });
      }
      primeraCarga = false;
      pintar();
    }, () => {}));
  }

  // ---------- Chat con el cliente ----------
  function seguirChat() {
    if (chat.id === (miCarrera && miCarrera.id)) return;
    if (chat.quitar) chat.quitar();
    chat = { id: null, quitar: null, sinLeer: 0 };
    if (!miCarrera) return;
    const c = miCarrera;
    chat.id = c.id;
    chat.quitar = escucharChat(c.id, yo.uid, (msgs, sinLeer) => {
      const nuevo = sinLeer > chat.sinLeer;
      chat.sinLeer = sinLeer;
      const b = $("#chat-sin-leer");
      if (b) { b.hidden = !sinLeer; b.textContent = sinLeer; }
      const ult = msgs[msgs.length - 1];
      if (nuevo && ult && ult.de !== yo.uid) {
        sonar();
        if (document.hidden) notificar(`Mensaje de ${c.clienteNombre.split(" ")[0]}`, ult.texto, { tag: "whereapp-chat" });
        else if (!$(".chat")) aviso(`${c.clienteNombre.split(" ")[0]}: ${ult.texto}`);
      }
    });
  }

  // ---------- Ganancias: hoy, últimos 7 días y quincena actual ----------
  function ganancias() {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const semana = new Date(hoy.getTime() - 6 * 864e5);
    const quincena = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() <= 15 ? 1 : 16);
    const suma = (desde) => terminadas.filter((c) => (fecha(c.terminada) || fecha(c.creada) || 0) >= desde);
    const total = (l) => l.reduce((s, c) => s + (c.precio || 0), 0);
    return [["Hoy", suma(hoy)], ["7 días", suma(semana)], ["Quincena", suma(quincena)]].map(([n, l]) => ({ n, monto: total(l), cant: l.length }));
  }

  // ---------- Pantalla encendida (para no perder carreras) ----------
  async function aplicarPantalla() {
    try {
      if (pantallaFija && "wakeLock" in navigator && !bloqueoPantalla && document.visibilityState === "visible") {
        bloqueoPantalla = await navigator.wakeLock.request("screen");
        bloqueoPantalla.addEventListener("release", () => (bloqueoPantalla = null));
      } else if (!pantallaFija && bloqueoPantalla) { await bloqueoPantalla.release(); bloqueoPantalla = null; }
    } catch {}
  }
  document.addEventListener("visibilitychange", aplicarPantalla);

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
  // Con carrera: cada 8 s (el cliente lo sigue). De turno sin carrera: cada 30 s (para "a X min de ti").
  function gpsSegunEstado() {
    const deTurno = perfil && habilitado(perfil) && perfil.deTurno !== false;
    if (miCarrera || deTurno) iniciarGps(); else pararGps();
  }
  function iniciarGps() {
    if (vigilaGps !== null || !navigator.geolocation) return;
    let ultima = 0;
    vigilaGps = navigator.geolocation.watchPosition((p) => {
      if (Date.now() - ultima < (miCarrera ? 8000 : 30000)) return;
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
      <div class="derecha"><span class="pildora ${ok ? "ok" : "mal"}">${ok ? "Activo" : "Inactivo"}</span>
      <button class="boton secundario chico" id="salir">Salir</button></div></div>`;
    $("#salir").onclick = () => signOut(auth);
    $("#cabecera .derecha").prepend(botonInstalar(), botonTema());

    let html = "";
    if (!perfil.activo) html += `<div class="caja"><h2>Estás inactivo</h2><p class="nota">El administrador debe activarte para que recibas carreras y salgas en la app.</p></div>`;
    else if (!ok) html += `<div class="caja"><h2>Quincena vencida</h2><p class="nota">Tu pago venció el ${fechaTexto(vence)}. Paga la cuota al administrador para volver a salir en la app.</p></div>`;
    else if (vence && vence - new Date() < 3 * 864e5) html += `<p class="pildora alerta" style="display:inline-block;margin-top:12px">Tu quincena vence el ${fechaTexto(vence)}</p>`;

    const deTurno = perfil.deTurno !== false;
    if (miCarrera) html += vistaMiCarrera(miCarrera);
    else if (ok) {
      html += `
        <div class="turno ${deTurno ? "on" : ""}">
          <div><b>${deTurno ? "Estás de turno" : "Estás descansando"}</b><small>${deTurno ? "Los clientes te ven, recibes carreras y ven qué tan cerca estás" : "No sales en la app ni recibes carreras"}</small></div>
          <button class="interruptor-grande ${deTurno ? "on" : ""}" id="turno" aria-label="Cambiar turno"><span></span></button>
        </div>
        ${deTurno ? `<div class="botones">
          ${sonido ? "" : `<button class="boton secundario" id="activar-sonido">${icono("campana")} Activar sonido y avisos</button>`}
          <button class="boton secundario ${pantallaFija ? "activo-suave" : ""}" id="pantalla">${icono("pantalla")} ${pantallaFija ? "Pantalla siempre encendida" : "Mantener pantalla encendida"}</button>
        </div>
        <h1 class="titulo">Carreras disponibles (${disponibles.length})</h1>
        <div class="lista">${disponibles.length ? disponibles.map(tarjetaCarrera).join("") : `<div class="vacio">${icono("ruta")}No hay carreras por ahora.<br>Deja esta pantalla abierta: te avisamos con un sonido.</div>`}</div>` : ""}`;
    }
    if (!miCarrera) {
      const g = ganancias();
      html += `<h1 class="titulo">${icono("dinero")} Tus ganancias</h1>
        <div class="cifras">${g.map((x) => `<div class="cifra"><b>${usd(x.monto)}</b><span>${x.n} · ${x.cant} carrera${x.cant === 1 ? "" : "s"}</span></div>`).join("")}</div>
        <p class="nota">Suma de lo que cobraste en las carreras terminadas.</p>`;
      // Lo que dicen los clientes de su seguridad (de las reseñas aprobadas).
      const malosMios = Object.entries(perfil.malos || {}).filter(([, n]) => n > 0);
      html += `<h1 class="titulo">${icono("escudo")} Tu seguridad</h1>
        <div class="caja">${insigniasSeguridad(perfil, 6) ? `<div class="etiquetas">${insigniasSeguridad(perfil, 6)}</div>` : `<p class="nota">Todavía no hay opiniones de seguridad.</p>`}
        ${malosMios.length ? `<p class="nota" style="margin-top:10px">Para mejorar:</p><div class="etiquetas">${malosMios.map(([k, n]) => `<span class="pildora riesgo">${icono("alerta")} ${esc((ASPECTOS.malos.find((a) => a.k === k) || { t: k }).t)} (${n})</span>`).join("")}</div>` : ""}
        <p class="nota" style="margin-top:10px">Maneja con prudencia y lleva casco para tu pasajero: los clientes lo ven en tu perfil.</p></div>`;
      const pm = perfil.pagoMovil || {};
      html += `<h1 class="titulo">${icono("telefono")} Tu pago móvil</h1>
        <div class="caja">${pm.telefono
          ? `<div class="fila"><span>Banco</span><b>${esc(pm.banco)}</b></div><div class="fila"><span>Teléfono</span><b>${esc(pm.telefono)}</b></div><div class="fila"><span>Cédula</span><b>${esc(pm.cedula)}</b></div>`
          : `<p class="nota">Regístralo para que los clientes que pagan por Pago móvil vean tus datos.</p>`}
          <button class="boton secundario" id="editar-pm" style="margin-top:10px">${icono("telefono")} ${pm.telefono ? "Cambiar datos" : "Registrar pago móvil"}</button></div>`;
    }
    $("#vista").innerHTML = html;
    // Animar la entrada solo cuando cambia lo que se muestra (lista, carrera o aviso de inactivo).
    const modo = `${ok}-${miCarrera ? miCarrera.id : "lista"}-${miCarrera ? !!miCarrera.recogido : ""}`;
    if (modo !== ultimoModo) { ultimoModo = modo; transicion(); }

    if ($("#editar-pm")) $("#editar-pm").onclick = editarPagoMovil;
    const s = $("#activar-sonido");
    if (s) s.onclick = () => { sonido = new (window.AudioContext || window.webkitAudioContext)(); sonar(); pedirPermisoAvisos(); pintar(); };
    const t = $("#turno");
    if (t) t.onclick = async () => {
      t.disabled = true;
      await updateDoc(doc(db, "motorizados", yo.uid), { deTurno: !deTurno }).catch(() => aviso("No se pudo cambiar el turno"));
    };
    const pf = $("#pantalla");
    if (pf) pf.onclick = () => {
      pantallaFija = !pantallaFija;
      try { localStorage.setItem("whereapp.pantalla", pantallaFija ? "1" : "0"); } catch {}
      if (pantallaFija && !("wakeLock" in navigator)) aviso("Tu teléfono no permite dejar la pantalla encendida desde la app");
      aplicarPantalla(); pintar();
    };
    aplicarPantalla();
    $$("[data-aceptar]").forEach((b) => (b.onclick = () => aceptar(b.dataset.aceptar)));
    if (miCarrera) activarMiCarrera(miCarrera);
  }

  const tipoTexto = (c) => (c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`);
  const tarjetaCarrera = (c) => `
    <article class="tarjeta"><div class="info">
      <h3>${tipoTexto(c)} · ${usd(c.precio)} · ${c.km} km ${c.paraMoto ? `<span class="pildora">Para ti</span>` : ""}${c.ofertaCliente ? `<span class="pildora oferta-pill">Precio del cliente</span>` : ""}</h3>
      <p class="cobro">${icono((FORMAS_PAGO[c.formaPago] || FORMAS_PAGO.usd).icono)} <b>Cobrar:</b> ${esc(textoCobro(c))}</p>
      <p><b>A:</b> ${esc(c.origen.dir)}</p>
      ${(c.paradas || []).map((p, i) => `<p><b>Parada ${i + 1}:</b> ${esc(p.dir)}</p>`).join("")}
      <p><b>B:</b> ${esc(c.destino.dir)}</p>
      ${c.retorno ? `<p><b>Ida y vuelta:</b> regresa al punto A</p>` : ""}
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

  // Datos de pago móvil del motorizado (los ve el cliente que paga por Pago móvil).
  const BANCOS = ["Banco de Venezuela", "Banesco", "Mercantil", "Provincial (BBVA)", "Bancamiga", "Banco Nacional de Crédito (BNC)", "Bicentenario", "Banco del Tesoro", "Banplus", "Exterior", "Venezolano de Crédito", "Sofitasa", "Bancaribe", "100% Banco", "Banco Activo", "Banco Plaza", "Banco Caroní", "Mi Banco", "Bancrecer", "Banco Fondo Común (BFC)"];
  function editarPagoMovil() {
    const pm = perfil.pagoMovil || {};
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<form class="ventana"><h2>Tu pago móvil</h2>
      <label>Banco<select name="banco" required><option value="">Elige tu banco</option>${BANCOS.map((b) => `<option ${pm.banco === b ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></label>
      <label>Teléfono<input name="telefono" inputmode="tel" required placeholder="0414-1234567" value="${esc(pm.telefono || "")}"></label>
      <label>Cédula<input name="cedula" required placeholder="V-12345678" value="${esc(pm.cedula || "")}"></label>
      <button class="boton">Guardar</button>
      <button class="boton secundario" type="button" data-no>Cancelar</button></form>`;
    document.body.append(fondo);
    $("[data-no]", fondo).onclick = () => fondo.remove();
    $("form", fondo).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const tel = String(f.get("telefono")).replace(/\D/g, "");
      const ced = String(f.get("cedula")).toUpperCase().replace(/[^VEJ0-9]/g, "");
      if (!/^0?4\d{9}$/.test(tel)) return aviso("Escribe un teléfono válido, ej. 0414-1234567");
      if (!/^[VEJ]?\d{6,9}$/.test(ced)) return aviso("Escribe una cédula válida, ej. V-12345678");
      const datos = { banco: f.get("banco"), telefono: (tel.startsWith("0") ? tel : "0" + tel).replace(/^(\d{4})(\d{7})$/, "$1-$2"), cedula: (/^[VEJ]/.test(ced) ? ced[0] + "-" + ced.slice(1) : "V-" + ced) };
      try {
        await updateDoc(doc(db, "motorizados", yo.uid), { pagoMovil: datos });
        fondo.remove(); aviso("Pago móvil guardado");
      } catch (err) {
        console.error(err); aviso("No se pudo guardar. Avísale al administrador (faltan las reglas nuevas).");
      }
    };
  }

  function vistaMiCarrera(c) {
    return `<h1 class="titulo">Tu carrera en curso</h1>
      <div class="caja">
        <div class="fila"><span>Servicio</span><b>${tipoTexto(c)}</b></div>
        <div class="fila"><span>Cliente</span><span>${esc(c.clienteNombre)}</span></div>
        <div class="fila cobrar"><span>Cobrar</span><b>${esc(textoCobro(c))}</b></div>
        <div class="fila"><span>Distancia</span><span>${c.km} km</span></div>
        ${c.nota ? `<div class="fila"><span>Llevar</span><span>${esc(c.nota)}</span></div>` : ""}
      </div>
      <div class="mapa" id="mapa"></div>
      <p class="nota">Acerca el mapa (+) para ver escuelas, mercados, playas y otros lugares.</p>
      <div class="caja">
        ${filasRecorrido(c)}
        <a class="boton" href="${mapsRuta(c)}" target="_blank" rel="noopener">${icono("ruta")} Abrir la ruta completa en Google Maps</a>
        <div class="botones">
          <a class="boton secundario" href="${mapsLink(c.origen)}" target="_blank" rel="noopener">Ir a A</a>
          <a class="boton secundario" href="${mapsLink(c.destino)}" target="_blank" rel="noopener">Ir a B</a>
        </div>
      </div>
      <div class="botones">
        <a class="boton" href="tel:${esc(c.clienteTel)}">${icono("telefono")} Llamar</a>
        <button class="boton" id="chat">${icono("chat")} Chat<b class="contador" id="chat-sin-leer" ${chat.sinLeer ? "" : "hidden"}>${chat.sinLeer || ""}</b></button>
      </div>
      ${!c.recogido && !c.llegoEn ? `<button class="boton" id="llegue">${icono("campana")} Llegué al punto A (avisar al cliente)</button>` : ""}
      ${!c.recogido && c.llegoEn ? `<p class="pildora ok" style="margin-top:12px">${icono("check")} Le avisaste al cliente que llegaste</p>` : ""}
      ${c.recogido
        ? `<button class="boton verde" id="termine">${icono("listo")} Terminé: ya llegamos a B</button>`
        : `<button class="boton verde" id="recogi">${icono("check")} Ya ${c.tipo === "mototaxi" ? "lo recogí" : "busqué el pedido"} (salgo hacia B)</button>`}
      <button class="boton peligro" id="cancelar">Cancelar carrera</button>
      <p class="nota">Mientras tengas una carrera, tu ubicación se comparte con el cliente.</p>`;
  }

  // Al terminar, el motorizado califica al cliente (solo lo ve el administrador).
  function calificarCliente(c) {
    let puntos = 5;
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<div class="ventana"><h2>¿Cómo fue ${esc(c.clienteNombre.split(" ")[0])} como cliente?</h2>
      <div class="estrellas" id="estrellas-cliente">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" aria-label="${n} estrellas">${icono("estrella")}</button>`).join("")}</div>
      <textarea id="nota-cliente" placeholder="Comentario para el administrador (opcional)"></textarea>
      <button class="boton" data-ok>Enviar</button><button class="boton secundario" data-no>Ahora no</button></div>`;
    document.body.append(fondo);
    const pintarE = () => fondo.querySelectorAll("[data-n]").forEach((b) => b.classList.toggle("on", Number(b.dataset.n) <= puntos));
    fondo.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => { puntos = Number(b.dataset.n); pintarE(); }));
    pintarE();
    fondo.querySelector("[data-no]").onclick = () => fondo.remove();
    fondo.querySelector("[data-ok]").onclick = async () => {
      await addDoc(collection(db, "calificacionesClientes"), {
        carreraId: c.id, motoUid: yo.uid, motoNombre: perfil.nombre, clienteUid: c.clienteUid, clienteNombre: c.clienteNombre,
        estrellas: puntos, comentario: fondo.querySelector("#nota-cliente").value.trim().slice(0, 300), fecha: serverTimestamp(),
      }).catch(() => aviso("No se pudo guardar la calificación"));
      fondo.remove();
      aviso("¡Gracias!");
    };
  }

  function activarMiCarrera(c) {
    $("#chat").onclick = () => abrirChat(c.id, yo.uid, perfil.nombre, c.clienteNombre.split(" ")[0]);
    mapa = nuevoMapa("mapa", "", { yo: true });
    mapa.fitBounds(marcarRecorrido(mapa, c).pad(0.3), { animate: false });
    // Lugares de El Moján (escuelas, mercados, playas…) para ubicarse mejor.
    mostrarLugares(mapa).listo.catch(() => {});
    const llegue = $("#llegue");
    if (llegue) llegue.onclick = async () => {
      llegue.disabled = true;
      await updateDoc(doc(db, "carreras", c.id), { llegoEn: serverTimestamp() }).catch(() => { llegue.disabled = false; aviso("No se pudo avisar"); });
      aviso("Le avisamos al cliente que llegaste");
    };
    const recogi = $("#recogi");
    if (recogi) recogi.onclick = async () => {
      recogi.disabled = true;
      await updateDoc(doc(db, "carreras", c.id), { recogido: true, recogidoEn: serverTimestamp() });
      aviso("¡Vamos hacia el punto B!");
    };
    const termine = $("#termine");
    if (termine) termine.onclick = async () => {
      if (!confirm("¿Entregaste y cobraste la carrera?")) return;
      await updateDoc(doc(db, "carreras", c.id), { estado: "terminada", terminada: serverTimestamp() });
      aviso("¡Carrera terminada!");
      calificarCliente(c);
    };
    $("#cancelar").onclick = async () => {
      const motivo = await elegirMotivo("¿Por qué cancelas?", MOTIVOS_MOTO);
      if (!motivo) return;
      // La carrera vuelve a quedar disponible para los demás motorizados.
      await updateDoc(doc(db, "carreras", c.id), {
        estado: "esperando", motoUid: null, paraMoto: null, paraMotoNombre: null, recogido: false, llegoEn: null,
        cancelaciones: arrayUnion({ por: "motorizado", motoUid: yo.uid, motoNombre: perfil.nombre, motivo, fecha: new Date() }),
      });
      aviso("Cancelaste la carrera");
    };
  }
}
