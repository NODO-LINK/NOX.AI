// Whereapp — apartado de motorizados: ver carreras nuevas, aceptarlas, compartir ubicación y terminarlas.

import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, deleteDoc, addDoc, writeBatch, onSnapshot, updateDoc, collection, query, where, runTransaction, serverTimestamp, arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  pedirAvisosAlTocar, leerOpiniones, listaOpiniones, ENLACE_POLITICAS, sonarAlerta, ASPECTOS, insigniasSeguridad, textoCobro, FORMAS_PAGO, bs, auth, db, NOMBRE, motivoEntrada, correoDe, $, $$, esc, usd, fecha, fechaTexto, estrellas, habilitado, ICONOS, icono, botonTema, botonInstalar, pedirPermisoAvisos, notificar, escucharChat, abrirChat, nuevoMapa, mostrarLugares, marcarRecorrido, filasRecorrido, mapsRuta, transicion,
  mapsLink, aviso, elegirMotivo, MOTIVOS_MOTO, avisoSinConfigurar, escucharTarifas, aBs, lineaRecta,
  hoyLocal,
} from "./comun.js?v=53";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  const L = window.L;
  let yo = null, perfil = null, subs = [], subsCarreras = [];
  let tarifas = null, reportes = [];
  // Contraofertas: lo que ofreció este motorizado en carreras con precio del cliente, y las que aceptó él mismo.
  const misOfertas = new Map(), aceptadasPorMi = new Set();   // tarifas (cuota, tasa, datos de cobro) y pagos de cuota reportados
  const opiniones = { abiertas: false, html: "" };   // se recuerda si la lista está abierta al redibujar
  let disponibles = [], miCarrera = null, conocidas = new Set(), primeraCarga = true;
  let mapa = null, vigilaGps = null, sonido = null, ultimoModo = null;
  let terminadas = [], chat = { id: null, quitar: null, sinLeer: 0, ajenos: null }, bloqueoPantalla = null;
  let chatAbierto = null, aceptando = false;
  const cerradasPorMi = new Set();   // carreras que él terminó o canceló (para no avisarle "te cancelaron")
  // Paradas bien formadas (una carrera mal escrita no debe romper la pantalla de todos).
  const limpiarCarrera = (c) => ({ ...c, paradas: Array.isArray(c.paradas) ? c.paradas.filter((p) => p && typeof p.dir === "string" && Number.isFinite(p.lat) && Number.isFinite(p.lng)) : [] });
  const carreraValida = (c) => [c.origen, c.destino].every((p) => p && typeof p.dir === "string" && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const cerrarChat = () => { if (chatAbierto) { try { chatAbierto(); } catch {} chatAbierto = null; } };
  // Quita sus contraofertas en todas las carreras (al salir o al pasar a descanso).
  async function retirarTodasOfertas() {
    const ids = [...misOfertas.keys()];
    misOfertas.clear();
    await Promise.all(ids.map((id) => deleteDoc(doc(db, "carreras", id, "ofertas", yo.uid)).catch(() => {})));
  }
  // Mantener la pantalla encendida (se recuerda en este teléfono).
  let pantallaFija = (() => { try { return localStorage.getItem("whereapp.pantalla") === "1"; } catch { return false; } })();

  onAuthStateChanged(auth, (u) => {
    subs.forEach((f) => f()); subs = [];
    pararCarreras(); pararGps();
    // Si cambia la cuenta en este teléfono, no debe quedar nada del motorizado anterior.
    if (chat.quitar) chat.quitar();
    chat = { id: null, quitar: null, sinLeer: 0, ajenos: null };
    cerrarChat(); cerradasPorMi.clear();
    misOfertas.clear(); aceptadasPorMi.clear(); revisadas.clear(); conocidas = new Set();
    Object.assign(opiniones, { abiertas: false, html: "" });
    terminadas = []; reportes = []; tarifas = null; primeraCarga = true;
    $$(".modal").forEach((m) => m.remove());
    yo = u; perfil = null; miCarrera = null; disponibles = []; ultimoModo = null;
    if (!u) return pantallaEntrada();
    pedirAvisosAlTocar();
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
    // Con una carrera en curso no se redibuja (el mapa perdería el zoom); se verá al terminarla.
    subs.push(escucharTarifas((t) => { tarifas = t; if (perfil && !miCarrera) pintar(); }));
    subs.push(onSnapshot(query(collection(db, "reportesPago"), where("motoUid", "==", u.uid)), (s) => {
      reportes = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (fecha(b.creado) || new Date()) - (fecha(a.creado) || new Date()));
      if (perfil && !miCarrera) pintar();
    }, () => {}));
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
        <p class="nota">El usuario y la clave te los da el administrador.</p>
        <p class="nota">Al entrar aceptas la ${ENLACE_POLITICAS.replace("Política", "política")}.</p></form></div>`;
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
      const antes = miCarrera;
      // Si por algo tuviera dos, se muestra primero la más antigua (al terminarla aparece la otra).
      const lista = s.docs.map((d) => limpiarCarrera({ id: d.id, ...d.data() })).sort((a, b) => (fecha(a.aceptada) || new Date()) - (fecha(b.aceptada) || new Date()));
      miCarrera = lista[0] || null;
      // Le cancelaron la carrera (el cliente o el admin): que se entere aunque tenga la app minimizada.
      if (antes && (!miCarrera || miCarrera.id !== antes.id) && !cerradasPorMi.has(antes.id)) {
        const previa = antes;
        cerrarChat();
        getDoc(doc(db, "carreras", previa.id)).then((d) => {
          if (d.exists() && d.data().estado === "cancelada") {
            const por = d.data().cancelacion?.por === "admin" ? "El administrador" : "El cliente";
            sonar(); aviso(`${por} canceló la carrera`);
            notificar("❌ Carrera cancelada", `${por} canceló: ${previa.origen?.dir || ""}`, { tag: "whereapp-moto", urgente: true });
          }
        }).catch(() => {});
      }
      // La volvió a tomar (después de haberla cancelado): ya no cuenta como "cerrada por él".
      if (miCarrera) cerradasPorMi.delete(miCarrera.id);
      if (lista.length > 1 && (!antes || antes.id !== miCarrera.id)) aviso(`Tienes ${lista.length} carreras aceptadas: termina esta y luego verás la otra.`);
      if (miCarrera) retirarOtrasOfertas(miCarrera.id);
      // Si la carrera llegó sin que él la aceptara, es que el cliente aceptó su contraoferta.
      if (miCarrera && (!antes || antes.id !== miCarrera.id) && misOfertas.has(miCarrera.id) && !aceptadasPorMi.has(miCarrera.id)) {
        sonar(); aviso(`¡${miCarrera.clienteNombre.split(" ")[0]} aceptó tu oferta de ${usd(miCarrera.precio)}!`);
        notificar("¡Aceptaron tu oferta!", `${textoCobro(miCarrera)} · ${miCarrera.origen.dir}`, { tag: "whereapp-moto" });
      }
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
      disponibles = s.docs.map((d) => limpiarCarrera({ id: d.id, ...d.data() }))
        .filter((c) => carreraValida(c) && (!c.paraMoto || c.paraMoto === yo.uid))
        .sort((a, b) => (fecha(a.creada) || 0) - (fecha(b.creada) || 0));
      const nuevas = disponibles.filter((c) => !conocidas.has(c.id));
      nuevas.forEach((c) => conocidas.add(c.id));
      if (nuevas.length && !primeraCarga && !miCarrera) {
        sonar();
        aviso(nuevas.length > 1 ? `¡${nuevas.length} carreras nuevas!` : nuevas[0].ofertaCliente ? "¡Carrera publicada! El cliente puso su precio" : "¡Carrera nueva!");
        // Una notificación por cada carrera, en la barra del teléfono (aunque la app esté minimizada).
        nuevas.forEach((c) => {
          const titulo = c.paraMoto ? "🏍️ ¡Un cliente te pidió a ti!" : c.ofertaCliente ? "🏍️ Carrera publicada · precio del cliente" : "🏍️ ¡Carrera nueva!";
          const ruta = `${c.origen.dir} → ${c.destino.dir}${(c.paradas || []).length ? ` (+${c.paradas.length} parada${c.paradas.length > 1 ? "s" : ""})` : ""}`;
          notificar(titulo, `${textoCobro(c)} · ${Number(c.km) || 0} km\n${ruta}`, { tag: "carrera-" + c.id, urgente: true });
        });
      }
      primeraCarga = false;
      cerrarAvisosViejos();
      // Con una carrera en curso no se redibuja (si no, el mapa se reinicia a cada rato).
      if (!miCarrera) pintar();
    }, () => {}));
  }

  // Quita de la barra del teléfono los avisos de carreras que ya tomó otro o se cancelaron.
  async function cerrarAvisosViejos() {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) return;
      for (const n of await reg.getNotifications())
        if (n.tag && n.tag.startsWith("carrera-") && !disponibles.some((c) => "carrera-" + c.id === n.tag)) n.close();
    } catch {}
  }

  // La cuota vence con el reloj (sin que cambie nada en la base de datos): se revisa cada minuto.
  let habilitadoAntes = null;
  setInterval(() => {
    if (!perfil) return;
    const ahora = habilitado(perfil);
    if (habilitadoAntes !== null && ahora !== habilitadoAntes) { escucharCarreras(); gpsSegunEstado(); pintar(); }
    habilitadoAntes = ahora;
  }, 60000);

  // ---------- Chat con el cliente ----------
  function seguirChat() {
    if (chat.id === (miCarrera && miCarrera.id)) return;
    if (chat.quitar) chat.quitar();
    chat = { id: null, quitar: null, sinLeer: 0, ajenos: null };
    if (!miCarrera) return;
    const c = miCarrera;
    chat.id = c.id;
    chat.quitar = escucharChat(c.id, yo.uid, (msgs, sinLeer, ajenos) => {
      // Mensaje nuevo = llegó uno más del cliente (aunque ya haya leído los anteriores).
      const nuevo = chat.ajenos !== null && ajenos > chat.ajenos;
      chat.ajenos = ajenos;
      chat.sinLeer = $(".chat") ? 0 : sinLeer;
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

  // ---------- Cuota quincenal: ver datos de cobro y reportar el pago ----------
  function tuCuota() {
    if (!tarifas) return "";
    const hasta = fecha(perfil.pagadoHasta);
    const vigente = hasta && hasta > new Date();
    const dias = vigente ? Math.ceil((hasta - new Date()) / 864e5) : 0;
    const cob = tarifas.cobro || {};
    const montoBs = aBs(tarifas.cuota, tarifas.tasa);
    const ult = reportes[0];
    const fila = (t, v) => `<div class="fila"><span>${t}</span><b>${esc(v)}</b><button class="quitar" data-copiar="${esc(v)}" aria-label="Copiar">${icono("copiar")}</button></div>`;
    return `<h1 class="titulo">${icono("tarjeta")} Tu cuota</h1>
      <div class="caja cuota">
        <p class="pildora ${!vigente ? "riesgo" : dias <= 3 ? "medio" : "seguro"}">${vigente ? `Pagada hasta ${fechaTexto(hasta)} (${dias} día${dias === 1 ? "" : "s"})` : "Vencida: no sales en la app hasta pagar"}</p>
        <div class="fila"><span>Cuota</span><b>${usd(tarifas.cuota)}${montoBs ? ` · ${bs(montoBs)}` : ""} cada ${tarifas.diasCuota} días</b></div>
        ${cob.telefono ? `<p class="nota" style="margin-top:8px">Paga por pago móvil a:</p>${fila("Banco", cob.banco)}${fila("Teléfono", cob.telefono)}${fila("Cédula", cob.cedula)}${montoBs ? fila("Monto", montoBs.toFixed(2).replace(".", ",")) : ""}`
          : `<p class="nota">El administrador todavía no puso sus datos de pago móvil. Pregúntale cómo pagar.</p>`}
        ${ult && ult.estado === "pendiente" ? `<p class="pildora medio" style="margin-top:10px">${icono("reloj")} Reportaste un pago (ref. ${esc(ult.referencia)}). Esperando que el administrador lo apruebe.</p>`
          : ult && ult.estado === "rechazado" ? `<p class="pildora riesgo" style="margin-top:10px">${icono("alerta")} Tu último reporte (ref. ${esc(ult.referencia)}) fue rechazado${ult.motivo ? `: ${esc(ult.motivo)}` : ""}.</p>`
          : ult && ult.estado === "aprobado" ? `<p class="pildora seguro" style="margin-top:10px">${icono("check")} Tu último pago (ref. ${esc(ult.referencia)}) fue aprobado.</p>` : ""}
        ${ult && ult.estado === "pendiente" ? "" : `<button class="boton" id="reportar-pago" style="margin-top:10px">${icono("check")} Ya pagué: reportar pago</button>`}
      </div>`;
  }
  function reportarPago() {
    const montoBs = aBs(tarifas.cuota, tarifas.tasa);
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<form class="ventana"><h2>Reportar pago de la cuota</h2>
      <label>Número de referencia</label><input name="ref" inputmode="numeric" maxlength="20" required placeholder="Ej.: 012345">
      <div class="dos"><div><label>Monto</label><input name="monto" inputmode="decimal" required value="${montoBs ? montoBs.toFixed(2).replace(".", ",") : tarifas.cuota}"></div>
        <div><label>Moneda</label><select name="moneda"><option value="bs" ${montoBs ? "selected" : ""}>Bs</option><option value="usd" ${montoBs ? "" : "selected"}>$</option></select></div></div>
      <label>Fecha del pago</label><input name="fecha" type="date" value="${hoyLocal()}">
      <button class="boton">Enviar reporte</button><button class="boton secundario" type="button" data-no>Cancelar</button></form>`;
    document.body.append(fondo);
    $("[data-no]", fondo).onclick = () => fondo.remove();
    $("form", fondo).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const ref = String(f.get("ref")).replace(/\D/g, "");
      const t = String(f.get("monto")).trim().replace(/[^\d.,]/g, "");
      const monto = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : /^\d+\.\d{1,2}$/.test(t) ? parseFloat(t) : parseFloat(t.replace(/\./g, ""));
      if (ref.length < 4) return aviso("Escribe el número de referencia (al menos 4 números)");
      if (ref.length > 20) return aviso("La referencia es muy larga (máximo 20 números)");
      if (!(monto > 0)) return aviso("Escribe el monto que pagaste");
      try {
        await addDoc(collection(db, "reportesPago"), {
          motoUid: yo.uid, nombre: perfil.nombre, referencia: ref, monto, moneda: f.get("moneda"),
          fechaPago: f.get("fecha"), estado: "pendiente", creado: serverTimestamp(),
        });
        fondo.remove(); aviso("Pago reportado. El administrador lo revisará.");
      } catch (err) { console.error(err); aviso("No se pudo enviar. Avísale al administrador (faltan las reglas nuevas)."); }
    };
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copiar); aviso("Copiado"); } catch { aviso(b.dataset.copiar); }
  });

  // ---------- Metas y estadísticas ----------
  const leerMeta = () => { try { return Number(localStorage.getItem("whereapp.meta")) || 0; } catch { return 0; } };
  function estadisticas() {
    const cuando = (c) => fecha(c.terminada) || fecha(c.creada);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    // Últimos 7 días, uno por barra.
    const dias = Array.from({ length: 7 }, (_, k) => {
      const d = new Date(hoy.getTime() - (6 - k) * 864e5), fin = new Date(d.getTime() + 864e5);
      const l = terminadas.filter((c) => { const f = cuando(c); return f && f >= d && f < fin; });
      return { d, monto: l.reduce((s, c) => s + (c.precio || 0), 0), n: l.length };
    });
    const max = Math.max(1, ...dias.map((x) => x.monto));
    const semana = dias.reduce((s, x) => s + x.monto, 0);
    const meta = leerMeta();
    const pct = meta ? Math.min(100, Math.round((semana / meta) * 100)) : 0;
    // Mejores horas: en qué horas ha tenido más carreras (de todas las terminadas).
    const porHora = Array(24).fill(0);
    terminadas.forEach((c) => { const f = fecha(c.creada) || cuando(c); if (f) porHora[f.getHours()]++; });
    const hora = (h) => `${((h + 11) % 12) + 1}${h < 12 ? " a. m." : " p. m."}`;
    const mejores = porHora.map((n, h) => ({ h, n })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 3);
    const nombreDia = (d) => d.toLocaleDateString("es-VE", { weekday: "short" }).replace(".", "");
    return `<h1 class="titulo">${icono("grafica")} Tus metas y estadísticas</h1>
      <div class="caja">
        <div class="meta-cabeza"><b>Meta de la semana</b><button class="boton secundario chico" id="poner-meta">${meta ? "Cambiar" : "Poner meta"}</button></div>
        ${meta ? `<div class="barra-meta"><i style="width:${pct}%"></i></div>
          <p class="nota">${usd(semana)} de ${usd(meta)} en los últimos 7 días · ${pct >= 100 ? "¡Meta cumplida! 🎉" : `te faltan ${usd(Math.max(0, meta - semana))}`}</p>`
        : `<p class="nota">Ponte una meta de ganancias por semana y mira cómo avanzas.</p>`}
        <div class="grafica-dias">${dias.map((x) => `<div class="dia" title="${usd(x.monto)} · ${x.n} carreras">
          <small>${x.monto ? usd(x.monto).replace(".00", "") : ""}</small><i style="height:${Math.round((x.monto / max) * 72)}%"></i><span>${nombreDia(x.d)}</span></div>`).join("")}</div>
        <p class="nota">Ganancias por día (últimos 7 días).</p>
        ${mejores.length ? `<p style="margin-top:12px"><b>Tus mejores horas:</b> ${mejores.map((x) => `${hora(x.h)}–${hora((x.h + 1) % 24)} (${x.n})`).join(" · ")}</p>
          <p class="nota">Son las horas en que más carreras has hecho: buen momento para estar de turno.</p>` : ""}
      </div>`;
  }
  function ponerMeta() {
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<form class="ventana"><h2>Meta de la semana</h2>
      <label>¿Cuánto quieres ganar en 7 días? ($)</label><input name="meta" type="number" min="1" step="1" inputmode="numeric" value="${leerMeta() || ""}" placeholder="Ej.: 40">
      <button class="boton">Guardar</button><button class="boton secundario" type="button" data-no>Cancelar</button></form>`;
    document.body.append(fondo);
    $("[data-no]", fondo).onclick = () => fondo.remove();
    $("form", fondo).onsubmit = (e) => {
      e.preventDefault();
      try { localStorage.setItem("whereapp.meta", String(Number(new FormData(e.target).get("meta")) || 0)); } catch {}
      fondo.remove(); pintar(); aviso("Meta guardada");
    };
  }

  // ---------- Pantalla encendida (para no perder carreras) ----------
  let pidiendoPantalla = false;
  async function aplicarPantalla() {
    if (pidiendoPantalla) return;
    pidiendoPantalla = true;
    try {
      if (pantallaFija && "wakeLock" in navigator && !bloqueoPantalla && document.visibilityState === "visible") {
        const b = await navigator.wakeLock.request("screen");
        bloqueoPantalla = b;
        b.addEventListener("release", () => { if (bloqueoPantalla === b) bloqueoPantalla = null; });
      } else if (!pantallaFija && bloqueoPantalla) { const b = bloqueoPantalla; bloqueoPantalla = null; await b.release(); }
    } catch {} finally { pidiendoPantalla = false; }
  }
  document.addEventListener("visibilitychange", aplicarPantalla);

  // ---------- Sonido ----------
  // Corneta de moto (la misma de la app del cliente); solo después de tocar "Activar sonido".
  function sonar() { sonarAlerta(); }
  const avisosListos = () => sonido && (!("Notification" in window) || Notification.permission === "granted");


  // ---------- Ubicación en vivo ----------
  // Con carrera: cada 8 s (el cliente lo sigue). De turno sin carrera: cada 30 s (para "a X min de ti").
  function gpsSegunEstado() {
    const deTurno = perfil && habilitado(perfil) && perfil.deTurno !== false;
    if (miCarrera || deTurno) iniciarGps(); else pararGps();
  }
  // Para ahorrar (plan gratis de Firebase):
  // - Con carrera: la posición va cada 8 s a "ubicaciones/{uid}", que solo mira el cliente de esa carrera.
  // - De turno sin carrera: a la ficha del motorizado solo si se movió más de 150 m (máx. cada 3 min)
  //   o, si está quieto, una vez cada 8 min para seguir saliendo "con señal".
  function iniciarGps() {
    if (vigilaGps !== null || !navigator.geolocation) return;
    let ultVivo = 0, ultFicha = 0, ultPos = null;
    vigilaGps = navigator.geolocation.watchPosition((p) => {
      const ahora = Date.now();
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (miCarrera && ahora - ultVivo >= 8000) {
        ultVivo = ahora;
        setDoc(doc(db, "ubicaciones", yo.uid), { ...pos, t: new Date() }).catch(() => {});
      }
      const movido = ultPos ? lineaRecta(ultPos, pos) : Infinity;
      if ((movido > 0.15 && ahora - ultFicha >= 180000) || ahora - ultFicha >= 480000) {
        ultFicha = ahora; ultPos = pos;
        updateDoc(doc(db, "motorizados", yo.uid), { ubicacion: { ...pos, t: new Date() } }).catch(() => {});
      }
    }, () => aviso("Activa la ubicación para que el cliente te vea llegar"), { enableHighAccuracy: true, maximumAge: 5000 });
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
    // Al salir deja de estar de turno: así no sale como disponible con el teléfono apagado.
    $("#salir").onclick = async () => {
      if (miCarrera && !confirm("Tienes una carrera en curso. Si sales, el cliente dejará de verte llegar. ¿Salir de todos modos?")) return;
      await retirarTodasOfertas();
      if (!miCarrera) await updateDoc(doc(db, "motorizados", yo.uid), { deTurno: false }).catch(() => {});
      signOut(auth);
    };
    $("#cabecera .derecha").prepend(botonInstalar(), botonTema());

    let html = "";
    if (!perfil.activo) html += `<div class="caja"><h2>Estás inactivo</h2><p class="nota">El administrador debe activarte para que recibas carreras y salgas en la app.</p></div>`;
    else if (!ok) html += `<div class="caja"><h2>${vence ? "Quincena vencida" : "Falta tu primera cuota"}</h2><p class="nota">${vence ? `Tu pago venció el ${fechaTexto(vence)}.` : "Todavía no tienes una cuota pagada."} Paga la cuota y repórtala abajo en «Tu cuota» para volver a salir en la app.</p></div>`;
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
          ${avisosListos() ? `<span class="pildora ok avisos-ok">${icono("campana")} Avisos activados</span>` : `<button class="boton" id="activar-sonido">${icono("campana")} Activar sonido y avisos</button>`}
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
      html += estadisticas();
      // Lo que dicen los clientes de su seguridad (de las reseñas aprobadas).
      const malosMios = Object.entries(perfil.malos || {}).filter(([, n]) => n > 0);
      html += `<h1 class="titulo">${icono("escudo")} Tu seguridad</h1>
        <div class="caja">${insigniasSeguridad(perfil, 6) ? `<div class="etiquetas">${insigniasSeguridad(perfil, 6)}</div>` : `<p class="nota">Todavía no hay opiniones de seguridad.</p>`}
        ${malosMios.length ? `<p class="nota" style="margin-top:10px">Para mejorar:</p><div class="etiquetas">${malosMios.map(([k, n]) => `<span class="pildora riesgo">${icono("alerta")} ${esc((ASPECTOS.malos.find((a) => a.k === k) || { t: k }).t)} (${n})</span>`).join("")}</div>` : ""}
        <p class="nota" style="margin-top:10px">Maneja con prudencia y lleva casco para tu pasajero: los clientes lo ven en tu perfil.</p></div>`;
      html += `<details class="caja opiniones-mias" id="mis-opiniones" ${opiniones.abiertas ? "open" : ""}><summary>${icono("estrella")} Lo que dicen tus clientes</summary><div id="lista-opiniones">${opiniones.html || `<p class="nota">Cargando…</p>`}</div></details>`;
      html += tuCuota();
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
    if ($("#poner-meta")) $("#poner-meta").onclick = ponerMeta;
    if ($("#reportar-pago")) $("#reportar-pago").onclick = reportarPago;
    const ops = $("#mis-opiniones");
    if (ops) ops.addEventListener("toggle", async () => {
      opiniones.abiertas = ops.open;
      if (!ops.open || opiniones.html) return;
      try { opiniones.html = listaOpiniones(await leerOpiniones(yo.uid), 5); }
      catch (e) { console.error(e); opiniones.html = `<p class="nota">No se pudieron cargar.</p>`; }
      if ($("#lista-opiniones")) $("#lista-opiniones").innerHTML = opiniones.html;
    });
    const s = $("#activar-sonido");
    if (s) s.onclick = async () => {
      sonido = true; sonar();
      await pedirPermisoAvisos();
      if ("Notification" in window && Notification.permission === "granted") notificar("🏍️ Avisos activados", "Así te llegará cada carrera nueva, aunque tengas la app minimizada.", { tag: "prueba-aviso" });
      else if ("Notification" in window && Notification.permission === "denied") aviso("Las notificaciones están bloqueadas: actívalas en Ajustes → Apps → Whereapp → Notificaciones");
      pintar();
    };
    const t = $("#turno");
    if (t) t.onclick = async () => {
      t.disabled = true;
      // Al pasar a descanso se retiran sus contraofertas (si no, un cliente podría aceptarle sin que esté).
      if (deTurno) await retirarTodasOfertas();
      await updateDoc(doc(db, "motorizados", yo.uid), { deTurno: !deTurno }).catch(() => { t.disabled = false; aviso("No se pudo cambiar el turno"); });
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
    $$("[data-ofrecer]").forEach((b) => (b.onclick = () => ofrecer(disponibles.find((x) => x.id === b.dataset.ofrecer))));
    $$("[data-retirar]").forEach((b) => (b.onclick = () => retirarOferta(b.dataset.retirar)));
    revisarMisOfertas();
    if (miCarrera) activarMiCarrera(miCarrera);
  }

  const tipoTexto = (c) => (c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`);
  const tarjetaCarrera = (c) => `
    <article class="tarjeta"><div class="info">
      <h3>${tipoTexto(c)} · ${usd(c.precio)} · ${esc(c.km)} km ${c.paraMoto ? `<span class="pildora">Para ti</span>` : ""}${c.ofertaCliente ? `<span class="pildora oferta-pill">Precio del cliente</span>` : ""}</h3>
      <p class="cobro">${icono((FORMAS_PAGO[c.formaPago] || FORMAS_PAGO.usd).icono)} <b>Cobrar:</b> ${esc(textoCobro(c))}</p>
      <p><b>A:</b> ${esc(c.origen.dir)}</p>
      ${(c.paradas || []).map((p, i) => `<p><b>Parada ${i + 1}:</b> ${esc(p.dir)}</p>`).join("")}
      <p><b>B:</b> ${esc(c.destino.dir)}</p>
      ${c.retorno ? `<p><b>Ida y vuelta:</b> regresa al punto A</p>` : ""}
      ${c.nota ? `<p><b>Llevar:</b> ${esc(c.nota)}</p>` : ""}
      <p>${esc(c.clienteNombre)} · ${fechaTexto(c.creada)}</p></div>
      ${c.ofertaCliente && misOfertas.get(c.id) ? `<p class="pildora medio">${icono("reloj")} Ofreciste ${usd(misOfertas.get(c.id).precio)}. Esperando al cliente…</p>` : ""}
      <div class="acciones">
        <a class="boton secundario" href="${mapsLink(c.origen)}" target="_blank" rel="noopener">Ver A en mapa</a>
        ${c.ofertaCliente && !c.paraMoto ? (misOfertas.get(c.id)
          ? `<button class="boton secundario" data-retirar="${c.id}">Retirar oferta</button>`
          : `<button class="boton secundario" data-ofrecer="${c.id}">${icono("dinero")} Ofrecer otro precio</button>`) : ""}
        <button class="boton" data-aceptar="${c.id}">Aceptar${c.ofertaCliente ? ` por ${usd(c.precio)}` : ""}</button></div>
    </article>`;

  // ---------- Contraoferta: proponer otro precio en una carrera publicada por el cliente ----------
  // Revisa una vez si ya había ofrecido algo en cada carrera publicada (por si recargó la app).
  const revisadas = new Set();
  function revisarMisOfertas() {
    disponibles.filter((c) => c.ofertaCliente && !revisadas.has(c.id)).forEach(async (c) => {
      revisadas.add(c.id);
      try { const d = await getDoc(doc(db, "carreras", c.id, "ofertas", yo.uid)); if (d.exists()) { misOfertas.set(c.id, d.data()); pintar(); } } catch {}
    });
  }
  function ofrecer(c) {
    const tasa = c.tasa || (tarifas && tarifas.tasa) || 0;
    const enBs = tasa && (c.formaPago === "bs" || c.formaPago === "pagomovil");
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<form class="ventana"><h2>Ofrecer otro precio</h2>
      <p class="nota">El cliente ofrece ${esc(textoCobro(c))} por ${esc(c.km)} km. Escribe tu precio en dólares; el cliente decide.</p>
      <label>Tu precio ($)</label><input name="precio" inputmode="decimal" required value="${(Math.round((c.precioSugerido || c.precio) * 4) / 4).toFixed(2)}">
      <p class="nota" id="equiv"></p>
      <button class="boton">Enviar oferta</button><button class="boton secundario" type="button" data-no>Cancelar</button></form>`;
    document.body.append(fondo);
    const campo = $("input", fondo);
    const leer = () => { const v = parseFloat(String(campo.value).replace(",", ".")); return v > 0 ? Math.round(v * 100) / 100 : null; };
    const equiv = () => { const v = leer(); $("#equiv", fondo).textContent = v && enBs ? `El cliente pagaría ${bs(aBs(v, tasa))}.` : ""; };
    campo.addEventListener("input", equiv); equiv();
    $("[data-no]", fondo).onclick = () => fondo.remove();
    $("form", fondo).onsubmit = async (e) => {
      e.preventDefault();
      const precio = leer();
      if (!precio) return aviso("Escribe un precio válido");
      const oferta = {
        motoUid: yo.uid, nombre: perfil.nombre, telefono: perfil.telefono || "", moto: perfil.moto || "", placa: perfil.placa || "",
        ratingSum: perfil.ratingSum || 0, ratingCount: perfil.ratingCount || 0, seguroSi: perfil.seguroSi || 0, seguroN: perfil.seguroN || 0,
        precio, precioBs: tasa ? aBs(precio, tasa) : null, fecha: serverTimestamp(),
      };
      try {
        await setDoc(doc(db, "carreras", c.id, "ofertas", yo.uid), oferta);
        misOfertas.set(c.id, oferta); fondo.remove(); pintar();
        aviso("Oferta enviada. Te avisamos si el cliente la acepta.");
      } catch (err) { console.error(err); aviso("No se pudo enviar la oferta. Puede que ya la tomaron (o faltan las reglas nuevas)."); }
    };
  }
  async function retirarOferta(id) {
    try { await deleteDoc(doc(db, "carreras", id, "ofertas", yo.uid)); } catch {}
    misOfertas.delete(id); pintar(); aviso("Oferta retirada");
  }

  async function aceptar(id) {
    if (miCarrera || aceptando) return aviso("Ya tienes una carrera en curso");
    aceptando = true;
    aceptadasPorMi.add(id);
    try {
      // En una sola transacción: la toma solo si sigue libre y queda marcado "en carrera" al instante
      // (así no le pueden aceptar otra oferta ni tomar dos a la vez).
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "carreras", id);
        const s = await tx.get(ref);
        if (!s.exists() || s.data().estado !== "esperando") throw new Error("tomada");
        tx.update(ref, {
          estado: "aceptada", motoUid: yo.uid, motoNombre: perfil.nombre, motoTel: perfil.telefono || "",
          motoMoto: perfil.moto || "", motoPlaca: perfil.placa || "", aceptada: serverTimestamp(),
        });
        tx.update(doc(db, "motorizados", yo.uid), { enCarrera: true });
      });
      aviso("¡Carrera aceptada!");
      retirarOtrasOfertas(id);
    } catch (e) {
      aceptadasPorMi.delete(id);
      aviso(e && e.message === "tomada" ? "Otro motorizado ya la aceptó"
        : e && e.code === "permission-denied" ? "No puedes aceptar ahora: revisa que estés activo y con la cuota al día"
        : "No se pudo aceptar. Revisa tu internet e intenta de nuevo.");
    } finally { aceptando = false; }
  }
  // Cuando ya tiene una carrera, quita sus ofertas en otras (para que no le acepten dos a la vez).
  function retirarOtrasOfertas(excepto) {
    [...misOfertas.keys()].filter((id) => id !== excepto).forEach((id) => {
      deleteDoc(doc(db, "carreras", id, "ofertas", yo.uid)).catch(() => {});
      misOfertas.delete(id);
    });
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

  // Botones para navegar con Waze o Google Maps al próximo punto (A antes de recoger; luego paradas y B).
  const waze = (p) => `https://waze.com/ul?ll=${Number(p.lat)},${Number(p.lng)}&navigate=yes`;
  function navegar(c) {
    const ir = (letra, p, grande) => `<div class="navegar-fila ${grande ? "principal" : ""}">
      <div><small>${grande ? "Próximo destino" : "Parada"}</small><b><i class="${letra === "A" ? "letra-a" : letra === "B" ? "letra-b" : "letra-p"}">${letra}</i> ${esc(p.dir)}</b></div>
      <div class="botones">
        <a class="boton waze" href="${waze(p)}" target="_blank" rel="noopener">${icono("ruta")} Waze</a>
        <a class="boton secundario" href="${mapsLink(p)}" target="_blank" rel="noopener">${icono("pin")} Google Maps</a>
      </div></div>`;
    const paradas = c.paradas || [];
    return `<div class="caja navegar">
      <h2>${icono("ruta")} Navegar</h2>
      ${!c.recogido ? ir("A", c.origen, true) : `${paradas.map((p, i) => ir(String(i + 1), p, false)).join("")}${ir("B", c.destino, !paradas.length)}`}
      ${c.recogido && c.retorno ? ir("A", c.origen, false).replace("Parada", "Regreso") : ""}
      <a class="boton secundario chico" href="${mapsRuta(c)}" target="_blank" rel="noopener">${icono("ruta")} Ruta completa con paradas (Google Maps)</a>
    </div>`;
  }

  function vistaMiCarrera(c) {
    return `<h1 class="titulo">Tu carrera en curso</h1>
      <div class="caja">
        <div class="fila"><span>Servicio</span><b>${tipoTexto(c)}</b></div>
        <div class="fila"><span>Cliente</span><span>${esc(c.clienteNombre)}</span></div>
        <div class="fila cobrar"><span>Cobrar</span><b>${esc(textoCobro(c))}</b></div>
        <div class="fila"><span>Distancia</span><span>${esc(c.km)} km</span></div>
        ${c.nota ? `<div class="fila"><span>Llevar</span><span>${esc(c.nota)}</span></div>` : ""}
      </div>
      <div class="mapa" id="mapa"></div>
      <p class="nota">Acerca el mapa (+) para ver escuelas, mercados, playas y otros lugares.</p>
      <div class="caja">
        ${filasRecorrido(c)}
      </div>
      ${navegar(c)}
      <div class="botones">
        <a class="boton" href="tel:${esc(c.clienteTel)}">${icono("telefono")} Llamar</a>
        <button class="boton" id="chat">${icono("chat")} Chat<b class="contador" id="chat-sin-leer" ${chat.sinLeer ? "" : "hidden"}>${chat.sinLeer || ""}</b></button>
      </div>
      ${!c.recogido && !c.llegoEn ? `<button class="boton" id="llegue">${icono("campana")} Llegué al punto A (avisar al cliente)</button>` : ""}
      ${!c.recogido && c.llegoEn ? `<p class="pildora ok" style="margin-top:12px">${icono("check")} Le avisaste al cliente que llegaste</p>` : ""}
      ${c.recogido
        ? `<button class="boton verde" id="termine">${icono("listo")} Terminé: ya llegamos a B</button>`
        : `<button class="boton verde" id="recogi">${icono("check")} Ya ${c.tipo === "mototaxi" ? "lo recogí" : "busqué el pedido"} (salgo hacia B)</button>`}
      ${c.recogido ? `<p class="nota">Si ya recogiste y hay un problema, llama al cliente o al administrador.</p>` : `<button class="boton peligro" id="cancelar">Cancelar carrera</button>`}
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
      fondo.querySelector("[data-ok]").disabled = true;
      try {
        await addDoc(collection(db, "calificacionesClientes"), {
          carreraId: c.id, motoUid: yo.uid, motoNombre: perfil.nombre, clienteUid: c.clienteUid, clienteNombre: c.clienteNombre,
          estrellas: puntos, comentario: fondo.querySelector("#nota-cliente").value.trim().slice(0, 300), fecha: serverTimestamp(),
        });
        aviso("¡Gracias!");
      } catch { aviso("No se pudo guardar la calificación"); }
      fondo.remove();
    };
  }

  function activarMiCarrera(c) {
    $("#chat").onclick = () => {
      cerrarChat();
      chatAbierto = abrirChat(c.id, yo.uid, perfil.nombre, c.clienteNombre.split(" ")[0]);
      chat.sinLeer = 0; const b = $("#chat-sin-leer"); if (b) b.hidden = true;
    };
    mapa = nuevoMapa("mapa", "", { yo: true });
    mapa.fitBounds(marcarRecorrido(mapa, c).pad(0.3), { animate: false });
    // Lugares de El Moján (escuelas, mercados, playas…) para ubicarse mejor.
    mostrarLugares(mapa).listo.catch(() => {});
    const llegue = $("#llegue");
    if (llegue) llegue.onclick = async () => {
      llegue.disabled = true;
      try { await updateDoc(doc(db, "carreras", c.id), { llegoEn: serverTimestamp() }); aviso("Le avisamos al cliente que llegaste"); }
      catch { llegue.disabled = false; aviso("No se pudo avisar. Revisa tu internet."); }
    };
    const recogi = $("#recogi");
    if (recogi) recogi.onclick = async () => {
      recogi.disabled = true;
      try { await updateDoc(doc(db, "carreras", c.id), { recogido: true, recogidoEn: serverTimestamp() }); aviso("¡Vamos hacia el punto B!"); }
      catch { recogi.disabled = false; aviso("No se pudo guardar. Puede que el cliente haya cancelado; revisa tu internet."); }
    };
    const termine = $("#termine");
    if (termine) termine.onclick = async () => {
      if (!confirm("¿Entregaste y cobraste la carrera?")) return;
      termine.disabled = true;
      cerradasPorMi.add(c.id);
      aviso("Guardando…");
      // Se espera al servidor: si no hay señal, el motorizado lo sabe y puede intentarlo de nuevo.
      try {
        await updateDoc(doc(db, "carreras", c.id), { estado: "terminada", terminada: serverTimestamp() });
      } catch (e) {
        cerradasPorMi.delete(c.id); termine.disabled = false;
        return aviso(e.code === "permission-denied" ? "No se pudo terminar: puede que el cliente la haya cancelado." : "No se pudo terminar. Revisa tu internet e intenta de nuevo.");
      }
      deleteDoc(doc(db, "ubicaciones", yo.uid)).catch(() => {});
      cerrarChat();
      aviso("¡Carrera terminada!");
      calificarCliente(c);
    };
    const cancelar = $("#cancelar");
    if (cancelar) cancelar.onclick = async () => {
      const motivo = await elegirMotivo("¿Por qué cancelas?", MOTIVOS_MOTO);
      if (!motivo) return;
      cerradasPorMi.add(c.id);
      // La carrera vuelve a quedar disponible para los demás motorizados, con el precio que puso el cliente
      // (si había aceptado una contraoferta) y sin los datos de este motorizado. Su oferta se borra.
      const lote = writeBatch(db);
      lote.update(doc(db, "carreras", c.id), {
        estado: "esperando", motoUid: null, paraMoto: null, paraMotoNombre: null, recogido: false, llegoEn: null,
        motoNombre: null, motoTel: null, motoMoto: null, motoPlaca: null,
        precio: c.precioCliente ?? c.precio, precioBs: c.precioBsCliente ?? c.precioBs ?? null, contraoferta: false,
        cancelaciones: arrayUnion({ por: "motorizado", motoUid: yo.uid, motoNombre: perfil.nombre, motivo, fecha: new Date() }),
      });
      if (c.ofertaCliente) lote.delete(doc(db, "carreras", c.id, "ofertas", yo.uid));
      const base = {
        estado: "esperando", motoUid: null, paraMoto: null, paraMotoNombre: null, recogido: false, llegoEn: null,
        cancelaciones: arrayUnion({ por: "motorizado", motoUid: yo.uid, motoNombre: perfil.nombre, motivo, fecha: new Date() }),
      };
      try { await lote.commit(); }
      catch (e) {
        // Reglas viejas (sin restaurar precio): se cancela como antes.
        if (e.code !== "permission-denied") { cerradasPorMi.delete(c.id); return aviso("No se pudo cancelar. Revisa tu internet e intenta de nuevo."); }
        try { await updateDoc(doc(db, "carreras", c.id), base); } catch { cerradasPorMi.delete(c.id); return aviso("No se pudo cancelar."); }
      }
      misOfertas.delete(c.id); revisadas.delete(c.id); aviso("Cancelaste la carrera");
      deleteDoc(doc(db, "ubicaciones", yo.uid)).catch(() => {});
      cerrarChat();
      if (!miCarrera) pintar();
    };
  }
}
