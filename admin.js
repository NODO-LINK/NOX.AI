// Whereapp — panel de administración: motorizados, cuotas, carreras, reseñas, tarifas y números.

import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, deleteUser,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, increment, writeBatch, Timestamp, runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, authSecundaria, db, NOMBRE, botonTema, botonInstalar, nuevoMapa, ICONOS, recargos, motivoEntrada, SERVICIOS, icono, transicion, activarBarra, correoDe, $, $$, esc, usd, fecha, fechaTexto, estrellas, habilitado,
  leerTarifas, escucharTarifas, aviso, avisoSinConfigurar, bs, sonarAlerta, mostrarLugares, tipoLugar, TIPOS_PARA_AGREGAR, ASPECTOS, insigniasSeguridad, opinionPublica, fotosDe, olvidarFotos, achicarFoto, pintarFotos,
  hoyLocal,
  enlaceWhatsapp, ANUNCIO_PREDETERMINADO, htmlPublicidad, enlacePublicidad,
  DOCUMENTOS, estadoDoc, resumenDocs,
  filasRecorrido, marcarRecorrido, mapsRuta, textoCobro, FORMAS_PAGO, ruta as rutaCalles,
} from "./comun.js?v=69";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  let subs = [], ruta = "motos", tarifas = null;
  let motos = [], carreras = [], resenas = [], pagos = [], llamadas = {}, visitas = {}, cedulas = {}, clientes = [], bloqueados = {}, notasClientes = {};
  let mapaVivo = null, marcasVivo = {}, filtroClientes = "";
  let lugaresPropios = [], mapaLugares = null, reportesPago = [];
  let anuncio = null, publicidad = null, toquesPub = 0;
  let documentos = {}, califClientes = [];   // documentos de cada motorizado (licencia, médico, RCV, trimestres): fechas, sin fotos
  const DIA = 864e5;

  onAuthStateChanged(auth, async (u) => {
    subs.forEach((f) => f()); subs = [];
    if (!u) { $("#banda-sos")?.remove(); sosVistos.clear(); return pantallaEntrada(); }
    const esAdmin = await getDoc(doc(db, "admins", u.uid)).then((s) => s.exists()).catch(() => false);
    if (!esAdmin) { aviso("Esta cuenta no es de administrador"); return signOut(auth); }
    arrancar(u);
  });

  function pantallaEntrada() {
    $("#cabecera").hidden = true; $("#barra").hidden = true;
    $("#vista").innerHTML = `<div class="entrada">
      <div class="logo">${NOMBRE}</div><div class="logo-sub">Administración</div>
      <form class="caja" id="login"><h2>Entrar</h2>
        <label for="usuario">Correo o usuario</label><input id="usuario" type="email" inputmode="email" autocomplete="username" autocapitalize="none" placeholder="tucorreo@gmail.com">
        <label for="clave">Clave</label><input id="clave" type="password" autocomplete="current-password">
        <button class="boton">Entrar</button></form></div>`;
    $("#login").onsubmit = async (e) => {
      e.preventDefault();
      try { await signInWithEmailAndPassword(auth, correoDe($("#usuario").value), $("#clave").value); }
      catch (err) { console.error(err); aviso(motivoEntrada(err)); }
    };
  }

  async function arrancar() {
    $("#cabecera").hidden = false; $("#barra").hidden = false;
    $("#cabecera").innerHTML = `<div class="dentro"><div><div class="logo">${NOMBRE}</div><div class="logo-sub">Administración</div></div>
      <div class="derecha"><button class="boton secundario chico" id="salir">Salir</button></div></div>`;
    $("#salir").onclick = () => signOut(auth);
    $("#cabecera .derecha").prepend(botonInstalar(), botonTema());
    $$("#barra button").forEach((b) => (b.onclick = () => ir(b.dataset.ruta)));
    tarifas = await leerTarifas();

    // Si fn devuelve false, no hace falta redibujar la pantalla.
    const escuchar = (q, fn) => subs.push(onSnapshot(q, (s) => { if (fn(s) !== false) refrescar(); }, (e) => console.error(e)));
    // La ubicación de los motorizados cambia cada pocos segundos: eso no redibuja el panel.
    const sinUbicacion = (lista) => JSON.stringify(lista.map(({ ubicacion, ...resto }) => resto));
    escuchar(collection(db, "motorizados"), (s) => {
      const antes = sinUbicacion(motos);
      motos = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre));
      publicarAprobadasViejas();
      moverMapaVivo();
      return sinUbicacion(motos) !== antes;
    });
    escuchar(query(collection(db, "carreras"), orderBy("creada", "desc"), limit(100)), (s) => { carreras = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(query(collection(db, "resenas"), orderBy("fecha", "desc"), limit(100)), (s) => { resenas = s.docs.map((d) => ({ id: d.id, ...d.data() })); publicarAprobadasViejas(); });
    escuchar(query(collection(db, "pagos"), orderBy("fecha", "desc"), limit(500)), (s) => { pagos = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(collection(db, "llamadas"), (s) => { llamadas = Object.fromEntries(s.docs.map((d) => [d.id, Number(d.data().n) || 0])); return ruta === "mas"; });
    escuchar(collection(db, "documentos"), (s) => { documentos = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); });
    escuchar(doc(db, "config", "anuncio"), (d) => { anuncio = d.exists() ? d.data() : null; });
    escuchar(doc(db, "config", "publicidad"), (d) => { publicidad = d.exists() ? d.data() : null; });
    subs.push(onSnapshot(doc(db, "stats", "publicidad"), (d) => {
      toquesPub = (d.exists() && d.data().toques) || 0;
      const t = $("#toques-pub"); if (t) t.textContent = toquesPub;
    }, () => {}));
    escuchar(collection(db, "clientes"), (s) => {
      clientes = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      cedulas = Object.fromEntries(clientes.map((c) => [c.id, c.cedula]));
    });
    escuchar(collection(db, "calificacionesClientes"), (s) => {
      califClientes = s.docs.map((d) => d.data());
      notasClientes = {};
      s.docs.map((d) => d.data()).sort((a, b) => (fecha(b.fecha) || 0) - (fecha(a.fecha) || 0)).forEach((n) => {
        const x = (notasClientes[n.clienteUid] ??= { suma: 0, cant: 0, ultimo: null });
        x.suma += n.estrellas; x.cant++;
        if (!x.ultimo && n.comentario) x.ultimo = n;
      });
    });
    escuchar(collection(db, "bloqueados"), (s) => { bloqueados = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); });
    escuchar(doc(db, "stats", "visitas"), (s) => { visitas = s.exists() ? s.data() : {}; return ruta === "mas"; });
    // Tarifas siempre al día (por si se cambiaron desde otro teléfono), sin redibujar el formulario.
    subs.push(escucharTarifas((t) => { tarifas = t; }));
    escuchar(query(collection(db, "reportesPago"), orderBy("creado", "desc"), limit(60)), (s) => { reportesPago = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(collection(db, "lugares"), (s) => {
      lugaresPropios = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.n).localeCompare(b.n));
      pintarListaLugares();
      return false;   // no se redibuja toda la pestaña (el mapa se quedaría en blanco)
    });
    ir("motos");
  }

  // Cada snapshot redibuja la pestaña abierta, salvo que se esté escribiendo en un formulario.
  // Alerta SOS de un cliente: banda roja arriba en cualquier pestaña, con sonido.
  const sosVistos = new Set();
  function pintarSos() {
    // Activa si el cliente pidió ayuda después de la última vez que se marcó atendida.
    const t = (x) => (x === true ? Infinity : (fecha(x) || new Date(0)).getTime());
    const activas = carreras.filter((c) => c.sos && c.estado === "aceptada" && (!c.sosAtendido || t(c.sos) > t(c.sosAtendido)));
    let banda = $("#banda-sos");
    if (!activas.length) { if (banda) banda.remove(); return; }
    if (!banda) { banda = document.createElement("div"); banda.id = "banda-sos"; banda.className = "banda-sos"; document.body.prepend(banda); }
    const clave = (c) => `${c.id}:${t(c.sos)}`;
    if (activas.some((c) => !sosVistos.has(clave(c)))) { sonarAlerta(); activas.forEach((c) => sosVistos.add(clave(c))); }
    banda.innerHTML = activas.map((c) => `<div class="sos-item"><b>${icono("alerta")} SOS: ${esc(c.clienteNombre)} en carrera con ${esc(c.motoNombre)} (${esc(c.motoPlaca || "")})</b>
      <div class="botones"><a class="boton chico" href="tel:${esc(c.clienteTel)}">${icono("telefono")} Cliente</a><a class="boton chico" href="tel:${esc(c.motoTel || "")}">${icono("telefono")} Motorizado</a>
      ${c.sosUbic ? `<a class="boton chico" href="https://maps.google.com/?q=${Number(c.sosUbic.lat)},${Number(c.sosUbic.lng)}" target="_blank" rel="noopener">${icono("pin")} Ubicación</a>` : ""}
      <button class="boton chico secundario" data-atendido="${esc(c.id)}">Atendido</button></div></div>`).join("");
    $$("[data-atendido]", banda).forEach((b) => (b.onclick = () => updateDoc(doc(db, "carreras", b.dataset.atendido), { sosAtendido: serverTimestamp() })));
  }

  function refrescar() {
    pintarSos();
    $("#punto-pagos").hidden = !porVencer().length && !reportesPago.some((r) => r.estado === "pendiente");
    $("#punto-resenas").hidden = !resenas.some((r) => !r.aprobada);
    const foco = document.activeElement;
    if (foco && /INPUT|TEXTAREA|SELECT/.test(foco.tagName) && $("#vista").contains(foco)) return;
    if (ruta === "mas" && (subMas === "lugares" || subMas === "tarifas" || subMas === "publicidad")) return;   // no borrar el mapa ni lo que se está escribiendo
    if (!$(".modal")) ir(ruta, true);
  }

  function ir(r, quieto) {
    ruta = r;
    activarBarra(r);
    const y = window.scrollY;
    if (mapaVivo && r !== "motos") { mapaVivo.remove(); mapaVivo = null; marcasVivo = {}; }
    if (mapaLugares) { mapaLugares.remove(); mapaLugares = null; }
    ({ motos: vistaMotos, pagos: vistaPagos, carreras: vistaCarreras, clientes: vistaClientes, resenas: vistaResenas, mas: vistaMas })[r]();
    if (!quieto) transicion();
    window.scrollTo(0, quieto ? y : 0);
  }

  // ---------- Motorizados y cuotas ----------
  const diasRestantes = (m) => { const f = fecha(m.pagadoHasta); return f ? Math.ceil((f - new Date()) / DIA) : -1; };
  const porVencer = () => motos.filter((m) => m.activo && diasRestantes(m) <= 3);
  const telWa = (t) => String(t || "").replace(/\D/g, "");
  const mensajeCobro = (m) => {
    const d = diasRestantes(m);
    const cuando = d <= 0 ? `se venció el ${fechaTexto(m.pagadoHasta)}` : `vence el ${fechaTexto(m.pagadoHasta)}`;
    return `Hola ${m.nombre}, tu quincena de ${NOMBRE} ${cuando}. La cuota es de ${usd(tarifas.cuota)}. Si no se paga, dejas de salir en la app como activo.`;
  };
  const yaPago = (m) => pagos.some((p) => p.motoUid === m.id);
  const estadoPago = (m) => {
    const d = diasRestantes(m);
    if (d <= 0 && !yaPago(m)) return `<span class="pildora mal">Sin pagar</span>`;
    if (d <= 0) return `<span class="pildora mal">Vencido</span>`;
    if (d <= 3) return `<span class="pildora alerta">Vence en ${d} día${d === 1 ? "" : "s"}</span>`;
    return `<span class="pildora ok">Pagado</span>`;
  };

  // ---------- Mapa en vivo de los motorizados ----------
  const ubicOk = (u) => !!u && Number.isFinite(Number(u.lat)) && Number.isFinite(Number(u.lng));
  const colorMoto = (m) => (!habilitado(m) ? "#9ca3af" : m.enCarrera ? "#f59e0b" : m.deTurno === false ? "#6b7280" : "#16a34a");
  const estadoMoto = (m) => (!habilitado(m) ? "No sale en la app" : m.enCarrera ? "Carrera en curso" : m.deTurno === false ? "Descansando" : "Disponible");
  function moverMapaVivo() {
    if (!mapaVivo) return;
    const L = window.L;
    for (const m of motos) {
      const u = m.ubicacion;
      if (!ubicOk(u)) continue;
      const icono = L.divIcon({ className: "", html: `<div class="pin" style="background:${colorMoto(m)}"><span>${esc(m.nombre.slice(0, 1).toUpperCase())}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
      const texto = `<b>${esc(m.nombre)}</b><br>${estadoMoto(m)}<br><small>${fechaTexto(u.t)}</small>`;
      if (!marcasVivo[m.id]) marcasVivo[m.id] = L.marker([u.lat, u.lng], { icon: icono }).bindPopup(texto).addTo(mapaVivo);
      else marcasVivo[m.id].setLatLng([u.lat, u.lng]).setIcon(icono).setPopupContent(texto);
    }
    // Quita los pines de motorizados borrados o sin ubicación.
    for (const id of Object.keys(marcasVivo)) if (!motos.some((m) => m.id === id && ubicOk(m.ubicacion))) { marcasVivo[id].remove(); delete marcasVivo[id]; }
  }

  function vistaMotos() {
    if (mapaVivo) { mapaVivo.remove(); mapaVivo = null; marcasVivo = {}; }
    const conUbic = motos.filter((m) => ubicOk(m.ubicacion)).length;
    $("#vista").innerHTML = `
      <h1 class="titulo">${icono("pin")} Mapa en vivo</h1>
      <div class="mapa" id="mapa-vivo"></div>
      <div class="leyenda"><span><i style="background:#16a34a"></i>Disponible</span><span><i style="background:#f59e0b"></i>En carrera</span><span><i style="background:#6b7280"></i>Descansando</span><span><i style="background:#9ca3af"></i>No sale</span></div>
      <p class="nota">${conUbic ? `Se ve la última ubicación de ${conUbic} motorizado${conUbic === 1 ? "" : "s"} (se actualiza mientras tienen carrera o la app abierta).` : "Todavía ningún motorizado ha compartido su ubicación."}</p>
      <h1 class="titulo">Motorizados (${motos.length}) · ${motos.filter(habilitado).length} saliendo en la app</h1>
      ${(() => { const mal = motosConFallas();
        return mal.length ? `<div class="banner-aviso docs-aviso">${icono("alerta")}<div><span><b>Documentos por revisar:</b> ${mal.map((m) => `${esc(m.nombre)} (${resumenDocs(documentos[m.id]).t.toLowerCase()})`).join(" · ")}</span>
          <div class="botones"><button class="boton chico" id="copiar-docs">${icono("copiar")} Copiar lista</button>
          <a class="boton chico verde" target="_blank" rel="noopener" href="${esc("https://wa.me/?text=" + encodeURIComponent(listaFallas(mal)))}">${icono("chat")} Enviar por WhatsApp</a></div></div></div>` : ""; })()}
      <button class="boton" id="nuevo">+ Agregar motorizado</button>
      ${motos.some((x) => x.usuario === "prueba") ? "" : `<button class="boton secundario" id="prueba">${icono("moto")} Crear motorizado de prueba</button>`}
      <div class="lista" style="margin-top:12px">${motos.map((m) => `
        <article class="tarjeta"><div class="avatar" data-foto-moto="${m.id}">${esc(String(m.nombre).split(" ").slice(0, 2).map((x) => x[0] || "").join("").toUpperCase())}</div><div class="info">
          <h3>${esc(m.nombre)} ${habilitado(m) ? `<span class="pildora ok">En la app</span>` : `<span class="pildora mal">No sale</span>`}${m.enCarrera ? ` <span class="pildora ocupado">Carrera en curso</span>` : m.deTurno === false ? ` <span class="pildora">Descansando</span>` : ""}</h3>
          <p>Usuario: <b>${esc(m.usuario)}</b> · ${icono("telefono")} ${esc(m.telefono)}</p>
          <p>${icono("moto")} ${esc(m.moto)}${m.color ? ` · ${esc(m.color)}` : ""} · Placa ${esc(m.placa)} · <span class="rating">${estrellas(m)}</span></p>
          ${(() => { const r = resumenDocs(documentos[m.id]); return `<p><span class="pildora ${r.c}" style="cursor:pointer" data-docs="${m.id}">${icono("tarjeta")} ${r.t}</span>
            ${r.n >= 1 && /^\+58\d{10}$/.test(m.telefono || "") ? ` <a class="pildora wa-docs" target="_blank" rel="noopener" href="${esc(enlaceWhatsapp(m.telefono, mensajeFallas(m)))}">${icono("chat")} Pedirle por WhatsApp</a>` : ""}</p>`; })()}
          ${m.pagoMovil && m.pagoMovil.telefono ? `<p>${icono("telefono")} Pago móvil: ${esc(m.pagoMovil.banco)} · ${esc(m.pagoMovil.telefono)} · ${esc(m.pagoMovil.cedula)}</p>` : ""}
          ${insigniasSeguridad(m) || Object.keys(m.malos || {}).length ? `<div class="etiquetas">${insigniasSeguridad(m, 3)}${Object.entries(m.malos || {}).filter(([, n]) => n > 0).map(([k, n]) => `<span class="pildora riesgo">${icono("alerta")} ${esc((ASPECTOS.malos.find((a) => a.k === k) || { t: k }).t)} (${n})</span>`).join("")}</div>` : ""}
          <p>${estadoPago(m)} · ${llamadas[m.id] || 0} llamadas</p></div>
          <div class="acciones">
            <button class="boton ${m.activo ? "peligro" : "verde"}" data-activo="${m.id}">${m.activo ? "Desactivar" : "Activar"}</button>
            <button class="boton secundario" data-editar="${m.id}">Editar</button>
            <button class="boton secundario" data-fotos="${m.id}">${icono("usuario")} Fotos</button>
            <button class="boton secundario" data-docs="${m.id}">${icono("tarjeta")} Documentos</button></div>
        </article>`).join("") || `<div class="vacio">${icono("moto")}Aún no hay motorizados.</div>`}</div>`;
    mapaVivo = nuevoMapa("mapa-vivo");
    moverMapaVivo();
    const puntos = motos.filter((m) => ubicOk(m.ubicacion)).map((m) => [Number(m.ubicacion.lat), Number(m.ubicacion.lng)]);
    if (puntos.length > 1) mapaVivo.fitBounds(window.L.latLngBounds(puntos).pad(0.3), { animate: false });
    else if (puntos.length === 1) mapaVivo.setView(puntos[0], 15, { animate: false });
    $("#nuevo").onclick = () => formularioMoto();
    if ($("#prueba")) $("#prueba").onclick = () => crearMotoPrueba($("#prueba"));
    $$("[data-activo]").forEach((b) => (b.onclick = () => {
      const m = motos.find((x) => x.id === b.dataset.activo);
      updateDoc(doc(db, "motorizados", m.id), { activo: !m.activo });
    }));
    $$("[data-editar]").forEach((b) => (b.onclick = () => formularioMoto(motos.find((x) => x.id === b.dataset.editar))));
    $$("[data-fotos]").forEach((b) => (b.onclick = () => fotosMoto(motos.find((x) => x.id === b.dataset.fotos))));
    $$("[data-docs]").forEach((b) => (b.onclick = () => documentosMoto(motos.find((x) => x.id === b.dataset.docs))));
    if ($("#copiar-docs")) $("#copiar-docs").onclick = async () => {
      const texto = listaFallas(motosConFallas());
      try { await navigator.clipboard.writeText(texto); aviso("Lista copiada: pégala en WhatsApp"); }
      catch { prompt("Copia la lista:", texto); }
    };
    pintarFotos();
  }

  // ---------- Pagos de la cuota ----------
  function vistaPagos() {
    const avisos = porVencer();
    const orden = [...motos].sort((a, b) => diasRestantes(a) - diasRestantes(b));
    const reportados = reportesPago.filter((r) => r.estado === "pendiente");
    $("#vista").innerHTML = `
      ${reportados.length ? `<h1 class="titulo">${icono("check")} Pagos reportados (${reportados.length})</h1>
        <p class="nota">Revisa en tu banco que llegó el pago y apruébalo: se le suman ${tarifas.diasCuota} días.</p>
        <div class="lista">${reportados.map((r) => `<article class="tarjeta"><div class="info"><h3>${esc(r.nombre)}</h3>
          <p><b>Ref. ${esc(r.referencia)}</b> · ${r.moneda === "bs" ? bs(r.monto) : usd(r.monto)} · ${esc(r.fechaPago || "")}</p><p class="nota">Reportado ${fechaTexto(r.creado)}</p></div>
          <div class="acciones"><button class="boton verde" data-aprobar-pago="${esc(r.id)}">Aprobar</button><button class="boton peligro" data-rechazar-pago="${esc(r.id)}">Rechazar</button></div></article>`).join("")}</div>` : ""}
      ${avisos.length ? `<h1 class="titulo">${icono("alerta")} Por vencer o vencidas (${avisos.length})</h1><div class="lista">${avisos.map((m) => `
        <article class="tarjeta"><div class="info"><h3>${esc(m.nombre)}</h3><p>${estadoPago(m)} · ${fechaPago(m)}</p></div>
          <div class="acciones">
            <a class="boton verde" href="https://wa.me/${telWa(m.telefono)}?text=${encodeURIComponent(mensajeCobro(m))}" target="_blank" rel="noopener">Avisar por WhatsApp</a>
            <button class="boton" data-pago="${m.id}">Registrar pago</button></div>
        </article>`).join("")}</div>` : ""}
      <h1 class="titulo">Registrar pago</h1>
      <p class="nota">Cuota de ${usd(tarifas.cuota)} cada ${tarifas.diasCuota} días. Al registrar, se le suman ${tarifas.diasCuota} días desde que vence (o desde hoy si ya venció).</p>
      <div class="lista">${orden.map((m) => `
        <article class="tarjeta"><div class="info"><h3>${esc(m.nombre)}</h3><p>${estadoPago(m)} · ${fechaPago(m)}</p></div>
          <button class="boton chico" data-pago="${m.id}">${icono("tarjeta")} Pago ${usd(tarifas.cuota)}</button>
        </article>`).join("") || `<div class="vacio">${icono("tarjeta")}Aún no hay motorizados.</div>`}</div>
      <h1 class="titulo">Últimos pagos</h1>
      <div class="caja"><table class="tabla"><tr><th>Fecha</th><th>Motorizado</th><th class="num">Monto</th></tr>
        ${pagos.slice(0, 30).map((p) => `<tr><td>${fechaTexto(p.fecha)}</td><td>${esc(p.nombre)}</td><td class="num">${usd(p.monto)}</td></tr>`).join("") || `<tr><td colspan="3">Todavía no hay pagos</td></tr>`}
      </table></div>`;
    $$("[data-pago]").forEach((b) => (b.onclick = () => registrarPago(motos.find((x) => x.id === b.dataset.pago))));
    $$("[data-aprobar-pago]").forEach((b) => (b.onclick = async () => {
      const r = reportesPago.find((x) => x.id === b.dataset.aprobarPago);
      const m = motos.find((x) => x.id === r.motoUid);
      if (!m) return aviso("Ese motorizado ya no existe");
      await registrarPago(m, r);
    }));
    $$("[data-rechazar-pago]").forEach((b) => (b.onclick = async () => {
      const motivo = prompt("¿Por qué lo rechazas? (lo verá el motorizado)", "No llegó el pago");
      if (motivo === null) return;
      try {
        // Solo si sigue pendiente (otro teléfono pudo aprobarlo mientras se escribía el motivo).
        await runTransaction(db, async (tx) => {
          const ref = doc(db, "reportesPago", b.dataset.rechazarPago);
          const d = await tx.get(ref);
          if (!d.exists() || d.data().estado !== "pendiente") throw new Error("Ese pago ya fue revisado");
          tx.update(ref, { estado: "rechazado", motivo: motivo.trim().slice(0, 200), revisado: serverTimestamp() });
        });
        aviso("Reporte rechazado");
      } catch (e) { console.error(e); aviso(e.message && !e.code ? e.message : "No se pudo rechazar. Intenta de nuevo."); }
    }));
  }
  const fechaPago = (m) => (yaPago(m) || diasRestantes(m) > 0 ? `pagado hasta ${fechaTexto(m.pagadoHasta)}` : "nunca ha pagado");

  // Fotos del motorizado y de su moto: el cliente las ve en el perfil y cuando le aceptan la carrera.
  async function fotosMoto(m) {
    const actuales = await fotosDe(m.id);
    const nuevas = { ...actuales };
    const fondo = document.createElement("div");
    fondo.className = "modal";
    const cuadro = (k, titulo) => `<label class="foto-subir"><span class="foto-vista" data-vista="${k}" style="${nuevas[k] ? `background-image:url('${nuevas[k]}')` : ""}">${nuevas[k] ? "" : icono(k === "moto" ? "moto" : "usuario")}</span>
      <b>${titulo}</b><small>Toca para elegir</small><input type="file" accept="image/*" data-archivo="${k}" hidden></label>`;
    fondo.innerHTML = `<div class="ventana"><h2>Fotos de ${esc(m.nombre)}</h2>
      <div class="fotos-dos">${cuadro("persona", "Motorizado")}${cuadro("moto", "Moto")}</div>
      <p class="nota">Que se vea bien la cara y la moto con la placa. Se guardan en tamaño pequeño.</p>
      <button class="boton" data-ok>Guardar fotos</button><button class="boton secundario" data-no>Cancelar</button></div>`;
    document.body.append(fondo);
    $$("[data-archivo]", fondo).forEach((inp) => (inp.onchange = async () => {
      const a = inp.files[0]; if (!a) return;
      try {
        nuevas[inp.dataset.archivo] = await achicarFoto(a);
        const v = $(`[data-vista=${inp.dataset.archivo}]`, fondo);
        v.style.backgroundImage = `url('${nuevas[inp.dataset.archivo]}')`; v.innerHTML = "";
      } catch { aviso("No se pudo leer esa imagen"); }
    }));
    $("[data-no]", fondo).onclick = () => fondo.remove();
    $("[data-ok]", fondo).onclick = async () => {
      try {
        await setDoc(doc(db, "fotos", m.id), { persona: nuevas.persona || null, moto: nuevas.moto || null, actualizado: serverTimestamp() });
        olvidarFotos(m.id); fondo.remove(); aviso("Fotos guardadas"); ir(ruta, true);
      } catch (e) { console.error(e); aviso("No se pudieron guardar. ¿Publicaste las reglas nuevas?"); }
    };
  }

  // ---------- Lista de documentos pendientes (para pedirlos por WhatsApp) ----------
  const motosConFallas = () => motos.filter((m) => m.usuario !== "prueba" && resumenDocs(documentos[m.id]).n >= 1);
  const telLocal = (t) => (/^\+58\d{10}$/.test(t || "") ? `0${t.slice(3, 6)}-${t.slice(6)}` : t || "");
  // Solo lo que falta, está vencido o vence pronto.
  const pendientes = (m) => resumenDocs(documentos[m.id]).est.filter((x) => x.e.n >= 1)
    .map((x) => `• ${x.t}: ${x.e.n === 3 ? "falta" : x.e.t.charAt(0).toLowerCase() + x.e.t.slice(1)}`);
  function listaFallas(lista) {
    const hoy = new Date().toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" });
    return `*Whereapp · Documentos pendientes*\n_${hoy}_\n\n`
      + lista.map((m) => `*${m.nombre}*${m.telefono ? ` (${telLocal(m.telefono)})` : ""}\n${pendientes(m).join("\n")}`).join("\n\n")
      + `\n\nPor favor, traigan o envíen foto de los documentos pendientes para tenerlos al día. ¡Gracias! 🏍️`;
  }
  const mensajeFallas = (m) => `Hola ${String(m.nombre).split(" ")[0]}, te escribe Whereapp. Para seguir trabajando con la app necesitamos que tengas al día estos documentos:\n\n${pendientes(m).join("\n")}\n\nEnvíanos la foto por aquí o tráelos cuando puedas. ¡Gracias! 🏍️`;

  // Documentos del motorizado: foto de cada uno y su fecha de vencimiento (solo los ve el admin y el motorizado).
  async function documentosMoto(m) {
    if (!m) return;
    const resumen = { ...(documentos[m.id] || {}) };
    const fotos = {}, nuevas = {};
    const fondo = document.createElement("div");
    fondo.className = "modal";
    const fila = (x) => {
      const d = resumen[x.k] || {}, e = estadoDoc(d, x);
      return `<div class="doc-fila" data-doc="${x.k}">
        <label class="doc-foto" title="Toca para elegir la foto"><span class="foto-vista" data-vista="${x.k}">${icono("tarjeta")}</span><input type="file" accept="image/*" data-archivo="${x.k}" hidden></label>
        <div class="doc-info"><b>${esc(x.t)}</b><span class="pildora ${e.c}" data-estado="${x.k}">${e.t}</span>
          ${x.sinVence ? `<p class="nota">No vence: solo sube la foto.</p>` : `<label>${x.fecha}</label><input type="date" data-vence="${x.k}" value="${esc(d.vence || "")}">`}
          <button type="button" class="enlace" data-ver="${x.k}" hidden>Ver foto grande</button></div></div>`;
    };
    fondo.innerHTML = `<div class="ventana"><h2>Documentos de ${esc(m.nombre)}</h2>
      <p class="nota">Toca el cuadro de cada documento para subir su foto y pon la fecha. Solo los ves tú; el motorizado ve si los tiene al día.</p>
      <div class="docs-lista">${DOCUMENTOS.map(fila).join("")}</div>
      <button class="boton" data-ok>Guardar documentos</button><button class="boton secundario" data-no>Cerrar</button></div>`;
    document.body.append(fondo);
    const pintarFoto = (k) => {
      const url = nuevas[k] || fotos[k];
      const v = $(`[data-vista=${k}]`, fondo);
      if (url) { v.style.backgroundImage = `url('${url}')`; v.innerHTML = ""; }
      $(`[data-ver=${k}]`, fondo).hidden = !url;
    };
    const pintarEstado = (k) => {
      const d = { ...(resumen[k] || {}), vence: $(`[data-vence=${k}]`, fondo)?.value || null, tiene: !!(nuevas[k] || fotos[k] || (resumen[k] || {}).tiene) };
      const e = estadoDoc(d, DOCUMENTOS.find((x) => x.k === k)), el = $(`[data-estado=${k}]`, fondo);
      el.className = `pildora ${e.c}`; el.textContent = e.t;
    };
    // Las fotos se cargan aparte (pesan más que las fechas).
    DOCUMENTOS.forEach((x) => getDoc(doc(db, "documentos", m.id, "fotos", x.k)).then((d) => { if (d.exists() && d.data().foto) { fotos[x.k] = d.data().foto; pintarFoto(x.k); } }).catch(() => {}));
    $$("[data-archivo]", fondo).forEach((inp) => (inp.onchange = async () => {
      const a = inp.files[0]; if (!a) return;
      // Más grande que las fotos de perfil para poder leer el documento.
      try { nuevas[inp.dataset.archivo] = await achicarFoto(a, 1280); pintarFoto(inp.dataset.archivo); pintarEstado(inp.dataset.archivo); }
      catch { aviso("No se pudo leer esa imagen"); }
    }));
    $$("[data-vence]", fondo).forEach((i) => (i.oninput = () => pintarEstado(i.dataset.vence)));
    $$("[data-ver]", fondo).forEach((b) => (b.onclick = () => {
      const url = nuevas[b.dataset.ver] || fotos[b.dataset.ver]; if (!url) return;
      const v = document.createElement("div"); v.className = "modal visor-doc";
      v.innerHTML = `<img src="${url}" alt=""><button class="boton secundario" data-cerrar>Cerrar</button>`;
      document.body.append(v); $("[data-cerrar]", v).onclick = () => v.remove();
    }));
    $("[data-no]", fondo).onclick = () => fondo.remove();
    $("[data-ok]", fondo).onclick = async () => {
      const bt = $("[data-ok]", fondo); bt.disabled = true;
      try {
        const lote = writeBatch(db);
        const datos = { actualizado: serverTimestamp() };
        DOCUMENTOS.forEach((x) => {
          datos[x.k] = { vence: $(`[data-vence=${x.k}]`, fondo)?.value || null, tiene: !!(nuevas[x.k] || fotos[x.k] || (resumen[x.k] || {}).tiene) };
          if (nuevas[x.k]) lote.set(doc(db, "documentos", m.id, "fotos", x.k), { foto: nuevas[x.k], actualizado: serverTimestamp() });
        });
        lote.set(doc(db, "documentos", m.id), datos);
        await lote.commit();
        fondo.remove(); aviso("Documentos guardados");
      } catch (e) { console.error(e); aviso("No se pudieron guardar. ¿Publicaste las reglas nuevas?"); bt.disabled = false; }
    };
  }

  let registrando = false;
  async function registrarPago(m, reporte = null) {
    if (registrando) return;
    if (!confirm(reporte ? `¿Aprobar el pago de ${m.nombre}: ${reporte.moneda === "bs" ? `Bs ${reporte.monto}` : usd(reporte.monto)} (ref. ${reporte.referencia})? Se le suman ${tarifas.diasCuota} días.`
      : `¿Registrar pago de ${usd(tarifas.cuota)} de ${m.nombre}? Se le suman ${tarifas.diasCuota} días.`)) return;
    registrando = true;
    try {
    // En una transacción: lee la fecha actual de pago y, si es un reporte, que siga pendiente (evita sumar dos veces).
    let hasta;
    await runTransaction(db, async (tx) => {
      const mRef = doc(db, "motorizados", m.id);
      const md = await tx.get(mRef);
      if (!md.exists()) throw new Error("Ese motorizado ya no existe");
      if (reporte) {
        const rd = await tx.get(doc(db, "reportesPago", reporte.id));
        if (!rd.exists() || rd.data().estado !== "pendiente") throw new Error("Ese pago ya fue revisado");
      }
      const desde = new Date(Math.max(Date.now(), (fecha(md.data().pagadoHasta) || new Date(0)).getTime()));
      hasta = new Date(desde.getTime() + tarifas.diasCuota * DIA);
      const lote = tx;
      lote.update(mRef, { pagadoHasta: Timestamp.fromDate(hasta) });
      lote.set(doc(collection(db, "pagos")), { motoUid: m.id, nombre: m.nombre, monto: tarifas.cuota, desde: Timestamp.fromDate(desde), hasta: Timestamp.fromDate(hasta), fecha: serverTimestamp(),
        ...(reporte ? { referencia: reporte.referencia, montoReportado: reporte.monto, monedaReportada: reporte.moneda } : {}) });
      if (reporte) lote.update(doc(db, "reportesPago", reporte.id), { estado: "aprobado", revisado: serverTimestamp() });
    });
    aviso(`Pago registrado. Pagado hasta ${fechaTexto(hasta)}`);
    } catch (e) { console.error(e); aviso(e.message && !e.code ? e.message : "No se pudo registrar el pago. Intenta de nuevo."); }
    finally { registrando = false; }
  }

  function normalizarTel(v) {
    let d = String(v).replace(/\D/g, "");
    if (d.startsWith("58")) d = d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);
    return d.length === 10 ? "+58" + d : null;
  }

  // Crea la cuenta del motorizado (usuario y clave) y su ficha.
  async function crearMoto(datos, usuario, clave, { pagado = false, activo = false, dias = tarifas.diasCuota, cobrar = true } = {}) {
    usuario = String(usuario).trim().toLowerCase();
    if (motos.some((x) => x.usuario === usuario)) throw new Error("Ese usuario ya existe");
    // Se usa una segunda conexión para crear la cuenta sin cerrar la sesión del admin.
    const authSeg = authSecundaria();
    try {
      const cred = await createUserWithEmailAndPassword(authSeg, correoDe(usuario), clave);
      try {
        await setDoc(doc(db, "motorizados", cred.user.uid), {
          ...datos, usuario, activo, ratingSum: 0, ratingCount: 0, creado: serverTimestamp(),
          pagadoHasta: Timestamp.fromDate(new Date(Date.now() + (pagado ? dias * DIA : 0))),
        });
      } catch (e) {
        // Sin ficha la cuenta quedaría huérfana y el usuario "ocupado": se borra para poder reintentar.
        await deleteUser(cred.user).catch(() => {});
        throw e;
      }
      if (pagado && cobrar) await addDoc(collection(db, "pagos"), { motoUid: cred.user.uid, nombre: datos.nombre, monto: tarifas.cuota, fecha: serverTimestamp() });
    } finally {
      await signOut(authSeg).catch(() => {});
      await deleteApp(authSeg.app).catch(() => {});
    }
  }

  async function crearMotoPrueba(boton) {
    boton.disabled = true;
    try {
      // Clave al azar (la de antes estaba escrita en el código público y cualquiera podía entrar).
      const clave = "p" + Math.random().toString(36).slice(2, 9);
      await crearMoto(
        { nombre: "Motorizado de Prueba", telefono: "+584140000000", moto: "Moto de prueba", placa: "PRUEBA1" },
        "prueba", clave, { pagado: true, activo: true, dias: 30, cobrar: false });
      alert(`Motorizado de prueba creado.\n\nUsuario: prueba\nClave: ${clave}\n\nAnótala. Desactívalo cuando termines de probar: mientras esté activo, los clientes lo ven.`);
    } catch (err) {
      console.error(err);
      aviso(err.code === "auth/email-already-in-use" ? "El usuario «prueba» ya existe" : err.message || "No se pudo crear");
      boton.disabled = false;
    }
  }

  function formularioMoto(m) {
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<form class="ventana"><h2>${m ? "Editar motorizado" : "Nuevo motorizado"}</h2>
      <label>Nombre</label><input name="nombre" value="${esc(m?.nombre)}" required>
      <label>Teléfono</label><input name="telefono" type="tel" value="${esc(m?.telefono)}" placeholder="0414-1234567" required>
      <div class="dos"><div><label>Moto</label><input name="moto" value="${esc(m?.moto)}" placeholder="Bera SBR 150"></div>
      <div><label>Placa</label><input name="placa" value="${esc(m?.placa)}"></div></div>
      <label>Color de la moto</label><input name="color" maxlength="30" placeholder="Ej.: Roja con negro" value="${esc(m?.color)}">
      ${m ? `<p class="nota">Usuario: <b>${esc(m.usuario)}</b>. Para cambiar la clave, hazlo en la consola de Firebase (Authentication → Usuarios). Si lo borras, ese usuario no se puede volver a crear.</p>` : `
      <div class="dos"><div><label>Usuario</label><input name="usuario" autocapitalize="none" required></div>
      <div><label>Clave (mín. 6)</label><input name="clave" minlength="6" required></div></div>
      <p class="nota">El pago de la quincena se registra en la pestaña Pagos.</p>`}
      <button class="boton">${m ? "Guardar" : "Crear motorizado"}</button>
      ${m ? `<button type="button" class="boton peligro" data-borrar>Eliminar motorizado</button>` : ""}
      <button type="button" class="boton secundario" data-cerrar>Cerrar</button></form>`;
    document.body.append(fondo);
    const f = $("form", fondo);
    const cerrar = () => { fondo.remove(); ir(ruta, true); };
    $("[data-cerrar]", fondo).onclick = cerrar;
    const borrar = $("[data-borrar]", fondo);
    if (borrar) borrar.onclick = async () => {
      if (m.enCarrera || carreras.some((c) => c.motoUid === m.id && c.estado === "aceptada")) return aviso(`${m.nombre} tiene una carrera en curso: espera que termine (o cancélala en Carreras) antes de eliminarlo.`);
      if (!confirm(`¿Eliminar a ${m.nombre}? Ya no podrá entrar ni saldrá en la app.\n\nSi solo quieres que deje de salir, mejor usa «Desactivar». Ojo: su usuario «${m.usuario}» no se podrá volver a crear.`)) return;
      borrar.disabled = true;
      try {
        // Se borra todo lo suyo de una vez y se liberan las carreras que esperaban solo por él.
        const b = writeBatch(db);
        ["motorizados", "fotos", "ubicaciones", "llamadas"].forEach((c) => b.delete(doc(db, c, m.id)));
        (await getDocs(collection(db, "motorizados", m.id, "opiniones"))).forEach((d) => b.delete(d.ref));
        (await getDocs(collection(db, "documentos", m.id, "fotos"))).forEach((d) => b.delete(d.ref));
        b.delete(doc(db, "documentos", m.id));
        reportesPago.filter((r) => r.motoUid === m.id && r.estado === "pendiente")
          .forEach((r) => b.update(doc(db, "reportesPago", r.id), { estado: "rechazado", motivo: "Motorizado eliminado", revisado: serverTimestamp() }));
        carreras.filter((c) => c.estado === "esperando" && c.paraMoto === m.id)
          .forEach((c) => b.update(doc(db, "carreras", c.id), { paraMoto: null, paraMotoNombre: null }));
        await b.commit();
        cerrar();
      } catch (e) { console.error(e); aviso("No se pudo eliminar. ¿Publicaste las reglas nuevas?"); borrar.disabled = false; }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      const telefono = normalizarTel(v.telefono);
      if (!telefono) return aviso("Teléfono no válido");
      const datos = { nombre: v.nombre.trim(), telefono, moto: v.moto.trim(), placa: v.placa.trim().toUpperCase(), color: String(v.color || "").trim().slice(0, 30) };
      $("button", f).disabled = true;
      try {
        if (m) {
          await updateDoc(doc(db, "motorizados", m.id), datos);
        } else {
          await crearMoto(datos, v.usuario, v.clave);
          aviso("Motorizado creado. Registra su pago en Pagos y actívalo.");
        }
        cerrar();
      } catch (err) {
        console.error(err);
        aviso(err.code === "auth/email-already-in-use" ? "Ese usuario ya existe" : err.message || "No se pudo guardar");
        $("button", f).disabled = false;
      }
    };
  }

  // ---------- Carreras ----------
  const ESTADOS = { esperando: ["alerta", "Esperando"], aceptada: ["", "En curso"], terminada: ["ok", "Terminada"], cancelada: ["mal", "Cancelada"] };
  function vistaCarreras() {
    const hoy = new Date().toDateString();
    const deHoy = carreras.filter((c) => fecha(c.creada)?.toDateString() === hoy);
    $("#vista").innerHTML = `
      <div class="cifras">
        <div class="cifra"><b>${deHoy.length}</b><span>Carreras hoy</span></div>
        <div class="cifra"><b>${deHoy.filter((c) => c.estado === "terminada").length}</b><span>Terminadas hoy</span></div>
        <div class="cifra"><b>${carreras.filter((c) => c.estado === "esperando").length}</b><span>Esperando motorizado</span></div>
      </div>
      <h1 class="titulo">Últimas carreras</h1>
      <div class="lista">${carreras.map((c) => {
        const [cl, tx] = ESTADOS[c.estado] || ["", c.estado];
        const cancel = [...(Array.isArray(c.cancelaciones) ? c.cancelaciones : []).map((x) => `${icono("moto")} ${esc(x.motoNombre)} canceló: ${esc(x.motivo)}`),
          c.cancelacion ? `${c.cancelacion.por === "admin" ? `${icono("escudo")} Admin` : `${icono("usuario")} Cliente`} canceló: ${esc(c.cancelacion.motivo)}` : ""].filter(Boolean);
        return `<article class="tarjeta tocable-carrera" data-ver-carrera="${esc(c.id)}"><div class="info">
          <h3>${c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`} · ${usd(c.precio)} · ${esc(c.km)} km <span class="pildora ${cl}">${tx}</span></h3>
          <p>${icono("usuario")} ${esc(c.clienteNombre)}${cedulas[c.clienteUid] ? ` · C.I. ${esc(cedulas[c.clienteUid])}` : ""} · ${esc(c.clienteTel)}</p>
          <p>${icono("moto")} ${c.motoNombre && c.motoUid ? esc(c.motoNombre) : c.paraMotoNombre ? `Pedida a ${esc(c.paraMotoNombre)}` : "—"}</p>
          <p>A: ${esc(c.origen?.dir)} ${icono("flecha")} B: ${esc(c.destino?.dir)}${c.paradas?.length ? ` · ${c.paradas.length} parada${c.paradas.length > 1 ? "s" : ""}` : ""}${c.retorno ? " · ida y vuelta" : ""}</p>
          <p>${fechaTexto(c.creada)}</p>
          ${cancel.map((x) => `<p style="color:var(--rojo)">${x}</p>`).join("")}${c.sos ? `<p style="color:var(--rojo)"><b>${icono("alerta")} Hubo SOS</b></p>` : ""}
          <p class="ver-mas">${icono("buscar")} Toca para ver todo</p></div>
          ${c.estado === "esperando" || c.estado === "aceptada" ? `<div class="acciones"><button class="boton peligro" data-cancelar="${esc(c.id)}">Cancelar</button></div>` : ""}
        </article>`;
      }).join("") || `<div class="vacio">${icono("ruta")}Todavía no hay carreras.</div>`}</div>`;
    $$("[data-ver-carrera]").forEach((t) => (t.onclick = (e) => {
      if (e.target.closest("[data-cancelar], a")) return;
      const c = carreras.find((x) => x.id === t.dataset.verCarrera);
      if (c) detalleCarrera(c);
    }));
    $$("[data-cancelar]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); cancelarCarrera(b.dataset.cancelar); }));
  }

  async function cancelarCarrera(id) {
      const motivo = prompt("Motivo de la cancelación:");
      if (motivo === null) return false;
      try {
        // Solo si sigue en curso (pudo terminarse mientras se escribía el motivo); libera al motorizado.
        await runTransaction(db, async (tx) => {
          const ref = doc(db, "carreras", id);
          const d = await tx.get(ref);
          const c = d.data();
          if (!c || !["esperando", "aceptada"].includes(c.estado)) throw new Error("La carrera ya cambió de estado");
          const mRef = c.estado === "aceptada" && c.motoUid ? doc(db, "motorizados", c.motoUid) : null;
          const md = mRef ? await tx.get(mRef) : null;
          tx.update(ref, { estado: "cancelada", cancelacion: { por: "admin", motivo: motivo.trim().slice(0, 200) || "Sin motivo", fecha: new Date() } });
          if (md?.exists()) tx.update(mRef, { enCarrera: false });
        });
        aviso("Carrera cancelada");
        return true;
      } catch (e) { console.error(e); aviso(e.message && !e.code ? e.message : "No se pudo cancelar. Intenta de nuevo."); return false; }
  }

  // ---------- Detalle de una carrera (al tocarla) ----------
  function detalleCarrera(c) {
    const [cl, tx] = ESTADOS[c.estado] || ["", c.estado];
    const tel = (t) => (/^\+58\d{10}$/.test(t || "") ? `0${t.slice(3, 6)}-${t.slice(6)}` : esc(t || "—"));
    const botonesTel = (t, nombre) => /^\+58\d{10}$/.test(t || "") ? `<div class="botones"><a class="boton secundario chico" href="tel:${esc(t)}">${icono("telefono")} Llamar</a>
      <a class="boton verde chico" target="_blank" rel="noopener" href="${esc(enlaceWhatsapp(t, `Hola ${String(nombre || "").split(" ")[0]}, te escribe Whereapp sobre la carrera del ${fechaTexto(c.creada)}.`))}">${icono("chat")} WhatsApp</a></div>` : "";
    const fila = (a, b) => `<div class="fila"><span>${a}</span><b>${b}</b></div>`;
    const cliente = clientes.find((x) => x.id === c.clienteUid);
    const moto = motos.find((x) => x.id === c.motoUid);
    // Línea de tiempo con lo que pasó, en orden.
    const pasos = [
      [c.creada, icono("ruta"), `Pedida${c.ofertaCliente ? " (publicada con su precio)" : c.paraMotoNombre ? ` a ${esc(c.paraMotoNombre)}` : ""}`],
      ...(Array.isArray(c.cancelaciones) ? c.cancelaciones : []).map((x) => [x.fecha, icono("cerrar"), `${esc(x.motoNombre || "Motorizado")} la canceló: ${esc(x.motivo || "")}`]),
      [c.aceptada, icono("check"), `Aceptada por ${esc(c.motoNombre || "—")}${c.contraoferta ? " (contraoferta)" : ""}`],
      [c.llegoEn, icono("campana"), "El motorizado llegó al punto A"],
      [c.recogidoEn, icono("moto"), c.tipo === "mototaxi" ? "Recogió al cliente" : "Buscó el pedido"],
      [c.sos, icono("alerta"), `<span style="color:var(--rojo)">SOS del cliente</span>${c.sosUbic ? ` · <a href="https://maps.google.com/?q=${Number(c.sosUbic.lat)},${Number(c.sosUbic.lng)}" target="_blank" rel="noopener">ver ubicación</a>` : ""}`],
      [c.sosAtendido, icono("escudo"), "SOS atendido"],
      [c.terminada, icono("listo"), "Terminada"],
      [c.cancelacion && (c.cancelacion.fecha || c.creada), icono("cerrar"), c.cancelacion ? `Cancelada por ${c.cancelacion.por === "admin" ? "el administrador" : "el cliente"}: ${esc(c.cancelacion.motivo || "")}` : ""],
    ].filter(([t, , txt]) => t && txt).map(([t, i, txt]) => ({ t: fecha(t === true ? null : t), i, txt })).sort((a, b) => (a.t || 0) - (b.t || 0));
    const duracion = (a, b) => { const x = fecha(a), y = fecha(b); if (!x || !y) return ""; const m = Math.round((y - x) / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
    const resena = resenas.find((r) => r.carreraId === c.id);
    const notaCli = califClientes.find((n) => n.carreraId === c.id);
    const forma = FORMAS_PAGO[c.formaPago] || FORMAS_PAGO.usd;
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<div class="ventana detalle-carrera">
      <div class="chat-cabeza"><h2>${c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`} <span class="pildora ${cl}">${tx}</span></h2><button class="quitar" data-cerrar aria-label="Cerrar">${icono("cerrar")}</button></div>
      <p class="nota">${fechaTexto(c.creada)} · N.º ${esc(c.id.slice(0, 6).toUpperCase())}</p>
      <div class="mapa" id="mapa-detalle"></div>
      <a class="boton secundario chico" href="${esc(mapsRuta(c))}" target="_blank" rel="noopener" style="margin-top:8px">${icono("pin")} Abrir ruta en Google Maps</a>
      <h3 class="sub-detalle">${icono("ruta")} Recorrido</h3>
      <div class="caja-detalle">${filasRecorrido(c)}${fila("Distancia", `${esc(c.km)} km`)}${c.nota ? fila("Qué lleva", esc(c.nota)) : ""}</div>
      <h3 class="sub-detalle">${icono("dinero")} Cobro</h3>
      <div class="caja-detalle">${fila("Precio", `${usd(c.precio)}${c.precioBs ? ` · Bs ${Number(c.precioBs).toFixed(2).replace(".", ",")}` : ""}`)}
        ${fila("Forma de pago", esc(forma.c))}${fila("Cobrar", esc(textoCobro(c)))}
        ${c.tasa ? fila("Tasa usada", `Bs ${Number(c.tasa).toFixed(2).replace(".", ",")} por $1`) : ""}
        ${c.ofertaCliente ? fila("Precio del cliente", `${usd(c.precioCliente ?? c.precio)}${c.precioSugerido ? ` (sugerido ${usd(c.precioSugerido)})` : ""}`) : ""}
        ${c.contraoferta ? fila("Contraoferta aceptada", usd(c.precio)) : ""}
        ${(c.recargos || []).map((r) => fila(`Recargo ${esc(r.nombre)}`, `+${usd(r.monto)}`)).join("")}</div>
      <h3 class="sub-detalle">${icono("usuario")} Cliente</h3>
      <div class="caja-detalle">${fila("Nombre", esc(c.clienteNombre))}${fila("Cédula", esc(cliente?.cedula || cedulas[c.clienteUid] || "—"))}${fila("Teléfono", tel(c.clienteTel))}
        ${notaCli ? fila("El motorizado lo calificó", `${"★".repeat(notaCli.estrellas)}${notaCli.comentario ? ` “${esc(notaCli.comentario)}”` : ""}`) : ""}
        ${botonesTel(c.clienteTel, c.clienteNombre)}</div>
      <h3 class="sub-detalle">${icono("moto")} Motorizado</h3>
      <div class="caja-detalle">${c.motoUid ? `${fila("Nombre", esc(c.motoNombre || moto?.nombre || "—"))}${fila("Moto", esc(c.motoMoto || moto?.moto || "—"))}${fila("Placa", `<span class="placa">${esc(c.motoPlaca || moto?.placa || "—")}</span>`)}${fila("Teléfono", tel(c.motoTel || moto?.telefono))}
        ${botonesTel(c.motoTel || moto?.telefono, c.motoNombre)}` : `<p class="nota">${c.paraMotoNombre ? `Pedida a ${esc(c.paraMotoNombre)}; todavía no la acepta.` : "Todavía ningún motorizado la acepta."}</p>`}</div>
      <h3 class="sub-detalle">${icono("reloj")} Qué pasó</h3>
      <div class="caja-detalle linea-tiempo">${pasos.map((p) => `<div class="paso">${p.i}<div><b>${p.txt}</b><small>${p.t ? p.t.toLocaleString("es-VE", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }) : ""}</small></div></div>`).join("")}
        ${c.aceptada && c.terminada ? `<p class="nota">Duración desde que la aceptó: ${duracion(c.aceptada, c.terminada)}${c.recogidoEn ? ` · viaje: ${duracion(c.recogidoEn, c.terminada)}` : ""}</p>` : ""}</div>
      ${resena ? `<h3 class="sub-detalle">${icono("estrella")} Calificación del cliente</h3>
      <div class="caja-detalle">${fila("Estrellas", "★".repeat(resena.estrellas) + "☆".repeat(5 - resena.estrellas))}${fila("¿Viaje seguro?", resena.seguro === false ? `<span style="color:var(--rojo)">No</span>` : "Sí")}
        ${resena.comentario ? `<p>“${esc(resena.comentario)}”</p>` : ""}${resena.aprobada ? "" : `<p class="nota">Pendiente de aprobar en Reseñas.</p>`}</div>` : ""}
      <h3 class="sub-detalle">${icono("chat")} Chat</h3>
      <div class="caja-detalle" id="chat-detalle"><button class="boton secundario chico" id="ver-chat">${icono("chat")} Ver mensajes</button></div>
      ${c.estado === "esperando" || c.estado === "aceptada" ? `<button class="boton peligro" id="cancelar-detalle">Cancelar esta carrera</button>` : ""}
      <button class="boton secundario" data-cerrar>Cerrar</button></div>`;
    document.body.append(fondo);
    let quitarVivo = null, mapa = null;
    const cerrar = () => { if (quitarVivo) quitarVivo(); if (mapa) mapa.remove(); fondo.remove(); };
    $$("[data-cerrar]", fondo).forEach((b) => (b.onclick = cerrar));
    fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
    // Mapa con la ruta por calles (y la moto en vivo si está en curso).
    setTimeout(() => {
      if (!document.body.contains(fondo)) return;
      mapa = nuevoMapa("mapa-detalle");
      const limites = marcarRecorrido(mapa, c);
      mapa.fitBounds(limites.pad(0.25), { animate: false });
      const pts = [c.origen, ...(c.paradas || []), c.destino, ...(c.retorno ? [c.origen] : [])];
      rutaCalles(pts).then((r) => { if (mapa) window.L.polyline(r.linea, { color: "#7c3aed", weight: 5, opacity: .8 }).addTo(mapa); }).catch(() => {});
      if (c.estado === "aceptada" && c.motoUid) {
        let marca = null;
        quitarVivo = onSnapshot(doc(db, "ubicaciones", c.motoUid), (d) => {
          const u = d.exists() ? d.data() : moto?.ubicacion;
          if (!mapa || !u || !Number.isFinite(Number(u.lat))) return;
          const ll = [Number(u.lat), Number(u.lng)];
          if (!marca) marca = window.L.marker(ll, { icon: ICONOS.moto, zIndexOffset: 900 }).bindTooltip("Motorizado ahora").addTo(mapa);
          else marca.setLatLng(ll);
        }, () => {});
      }
    }, 60);
    $("#ver-chat", fondo).onclick = async () => {
      const caja = $("#chat-detalle", fondo);
      caja.innerHTML = `<p class="nota">Cargando…</p>`;
      try {
        const s = await getDocs(query(collection(db, "carreras", c.id, "mensajes"), orderBy("fecha"), limit(200)));
        const msgs = s.docs.map((d) => d.data());
        caja.innerHTML = msgs.length ? msgs.map((m) => `<div class="msg-detalle ${m.de === c.clienteUid ? "de-cliente" : "de-moto"}"><b>${esc(m.nombre || (m.de === c.clienteUid ? "Cliente" : "Motorizado"))}</b> ${esc(m.texto)}<small>${fecha(m.fecha) ? fecha(m.fecha).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" }) : ""}</small></div>`).join("")
          : `<p class="nota">No escribieron nada en el chat.</p>`;
      } catch (e) { console.error(e); caja.innerHTML = `<p class="nota">No se pudo cargar el chat.</p>`; }
    };
    if ($("#cancelar-detalle", fondo)) $("#cancelar-detalle", fondo).onclick = async () => { if (await cancelarCarrera(c.id)) cerrar(); };
  }

  // ---------- Clientes ----------
  function vistaClientes() {
    const q = filtroClientes.toLowerCase();
    const cuenta = (uid) => carreras.filter((c) => c.clienteUid === uid).length;
    const lista = clientes
      .filter((c) => !q || [c.nombre, c.cedula, c.telefono].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (fecha(b.creado) || 0) - (fecha(a.creado) || 0));
    const a = anuncio || {};
    const textoWa = a.texto || ANUNCIO_PREDETERMINADO;
    const conTel = clientes.filter((c) => /^\+58\d{10}$/.test(c.telefono || ""));
    $("#vista").innerHTML = `
      <form class="caja" id="anuncio"><h2>${icono("descargar")} Anuncio para clientes</h2>
        <p class="nota">Sale arriba en la lista de motorizados para quienes usan Whereapp desde la página web (no a quienes ya tienen la app instalada), con un botón para escribirte por WhatsApp.</p>
        <label class="opcion"><input type="checkbox" name="activo" ${a.activo ? "checked" : ""}><span>Mostrar el anuncio</span></label>
        <label>Mensaje</label><textarea name="texto" maxlength="200" placeholder="${esc(ANUNCIO_PREDETERMINADO)}">${esc(a.texto || "")}</textarea>
        <label>Enlace para descargar la app (opcional)</label><input name="enlace" type="url" placeholder="https://…" value="${esc(a.enlace || "")}">
        <p class="nota">Si pones un enlace (por ejemplo, de Google Drive), sale también el botón «Descargar la app».</p>
        <button class="boton">Guardar anuncio</button></form>
      <div class="caja"><h2>${icono("chat")} Avisar por WhatsApp</h2>
        <p class="nota">WhatsApp no deja enviar a todos de una vez desde una página. Puedes: tocar «WhatsApp» en cada cliente (el mensaje ya va escrito), o copiar todos los números y crear una <b>lista de difusión</b> en WhatsApp (solo les llega a quienes te tienen guardado).</p>
        <button class="boton secundario" id="copiar-numeros" ${conTel.length ? "" : "disabled"}>Copiar los ${conTel.length} números</button></div>
      <h1 class="titulo">Clientes (${clientes.length})</h1>
      <input id="filtro-clientes" type="search" placeholder="Buscar por nombre, cédula o teléfono" value="${esc(filtroClientes)}">
      <div class="lista" style="margin-top:12px">${lista.map((c) => {
        const b = !!bloqueados[c.cedula];
        return `<article class="tarjeta"><div class="info">
          <h3>${esc(c.nombre)} ${b ? `<span class="pildora mal">${icono("bloquear")} Bloqueado</span>` : ""}${c.enApp ? ` <span class="pildora ok">${icono("descargar")} App</span>` : ` <span class="pildora">Página web</span>`}</h3>
          <p>C.I. ${esc(c.cedula || "—")} · ${icono("telefono")} ${esc(c.telefono || "—")}</p>
          <p>Desde ${fechaTexto(c.creado)} · ${cuenta(c.id)} carrera${cuenta(c.id) === 1 ? "" : "s"} recientes</p>
          ${notasClientes[c.id] ? `<p><span class="rating">${icono("estrella")} ${(notasClientes[c.id].suma / notasClientes[c.id].cant).toFixed(1)} (${notasClientes[c.id].cant})</span> según los motorizados${notasClientes[c.id].ultimo ? ` · “${esc(notasClientes[c.id].ultimo.comentario)}” — ${esc(notasClientes[c.id].ultimo.motoNombre)}` : ""}</p>` : `<p>Sin calificaciones de motorizados</p>`}</div>
          <div class="acciones">
            <a class="boton secundario" href="tel:${esc(c.telefono)}">${icono("telefono")} Llamar</a>
            ${/^\+58\d{10}$/.test(c.telefono || "") ? `<a class="boton verde" target="_blank" rel="noopener" href="${esc(enlaceWhatsapp(c.telefono, `Hola ${String(c.nombre || "").split(" ")[0]}, te escribe Whereapp. ${textoWa}`))}">${icono("chat")} WhatsApp</a>` : ""}
            <button class="boton ${b ? "verde" : "peligro"}" data-bloquear="${esc(c.cedula)}" data-nombre="${esc(c.nombre)}">${b ? "Desbloquear" : "Bloquear"}</button></div>
        </article>`;
      }).join("") || `<div class="vacio">${icono("usuario")}${q ? "Nadie coincide con la búsqueda." : "Aún no hay clientes."}</div>`}</div>
      <p class="nota">Bloquear usa la cédula: aunque el cliente vuelva a registrarse con la misma cédula, no podrá pedir carreras.</p>`;
    $("#anuncio").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const enlace = String(fd.get("enlace") || "").trim();
      if (enlace && !/^https:\/\//.test(enlace)) return aviso("El enlace debe empezar con https://");
      const bt = $("button", e.target); bt.disabled = true;
      try {
        await setDoc(doc(db, "config", "anuncio"), { activo: fd.get("activo") === "on", texto: String(fd.get("texto") || "").trim().slice(0, 200), enlace, actualizado: serverTimestamp() });
        document.activeElement?.blur();
        aviso("Anuncio guardado. Los clientes lo ven al instante.");
      } catch (err) { console.error(err); aviso("No se pudo guardar el anuncio"); }
      bt.disabled = false;
    };
    $("#copiar-numeros").onclick = async () => {
      // En formato 0412-1234567, uno por línea (fácil de guardar en contactos).
      const lista = conTel.map((c) => `${c.nombre}: 0${c.telefono.slice(3, 6)}-${c.telefono.slice(6)}`).join("\n");
      try { await navigator.clipboard.writeText(lista); aviso(`${conTel.length} números copiados`); }
      catch { prompt("Copia los números:", lista); }
    };
    const f = $("#filtro-clientes");
    f.oninput = () => { filtroClientes = f.value; const pos = f.selectionStart; vistaClientes(); const n = $("#filtro-clientes"); n.focus(); n.setSelectionRange(pos, pos); };
    $$("[data-bloquear]").forEach((b) => (b.onclick = async () => {
      const ced = b.dataset.bloquear;
      if (!ced) return;
      if (bloqueados[ced]) await deleteDoc(doc(db, "bloqueados", ced));
      else if (confirm(`¿Bloquear a ${b.dataset.nombre} (C.I. ${ced})? No podrá pedir carreras.`)) await setDoc(doc(db, "bloqueados", ced), { nombre: b.dataset.nombre, fecha: serverTimestamp() });
    }));
  }

  // Una sola vez: las reseñas aprobadas antes de existir los perfiles también se publican.
  let yaPublicadas = false;
  async function publicarAprobadasViejas() {
    if (yaPublicadas || !motos.length || !resenas.length) return;
    yaPublicadas = true;
    try { if (localStorage.getItem("whereapp.opiniones.v1")) return; } catch {}
    const lote = writeBatch(db);
    let n = 0;
    resenas.filter((r) => r.aprobada && motos.some((m) => m.id === r.motoUid)).forEach((r) => { lote.set(doc(db, "motorizados", r.motoUid, "opiniones", r.id), opinionPublica(r)); n++; });
    try { if (n) await lote.commit(); localStorage.setItem("whereapp.opiniones.v1", "1"); } catch (e) { console.error(e); yaPublicadas = false; }
  }

  // ---------- Reseñas ----------
  let resenasAbiertas = false;   // las aprobadas van plegadas: son muchas
  function vistaResenas() {
    const grave = (r) => (r.seguro === false ? 2 : 0) + ((r.malos || []).length ? 1 : 0);
    const pendientes = resenas.filter((r) => !r.aprobada).sort((a, b) => grave(b) - grave(a)), aprobadas = resenas.filter((r) => r.aprobada);
    const texto = (lista, k) => (lista.find((a) => a.k === k) || { t: k }).t;
    const tarjeta = (r, botones) => `<article class="tarjeta ${r.seguro === false || (r.malos || []).length ? "reporte" : ""}"><div class="info">
      <h3><span class="rating">${[1, 2, 3, 4, 5].map((n) => icono("estrella", n <= r.estrellas ? "" : "apagada")).join("")}</span> para ${esc((motos.find((m) => m.id === r.motoUid) || {}).nombre || r.motoNombre)}</h3>
      ${r.seguro === false ? `<p class="pildora riesgo">${icono("alerta")} El cliente NO se sintió seguro</p>` : r.seguro ? `<p class="pildora seguro">${icono("escudo")} Viaje seguro</p>` : ""}
      ${(r.malos || []).length ? `<div class="etiquetas">${r.malos.map((k) => `<span class="pildora riesgo">${icono("alerta")} ${esc(texto(ASPECTOS.malos, k))}</span>`).join("")}</div>` : ""}
      ${(r.buenos || []).length ? `<div class="etiquetas">${r.buenos.map((k) => `<span class="pildora insignia">${icono("check")} ${esc(texto(ASPECTOS.buenos, k))}</span>`).join("")}</div>` : ""}
      ${r.comentario ? `<p>“${esc(r.comentario)}”</p>` : `<p><i>Sin comentario</i></p>`}
      <p>De ${esc(r.clienteNombre)} · ${fechaTexto(r.fecha)}</p></div>${botones}</article>`;
    $("#vista").innerHTML = `
      <h1 class="titulo">Por aprobar (${pendientes.length})</h1>
      <p class="nota">Las estrellas y lo de seguridad cuentan para el motorizado solo cuando apruebas la reseña. Los reportes de seguridad salen en rojo.</p>
      <div class="lista compacta">${pendientes.map((r) => tarjeta(r, `<div class="acciones">
        <button class="boton verde" data-aprobar="${esc(r.id)}">Aprobar</button><button class="boton peligro" data-rechazar="${esc(r.id)}">Rechazar</button></div>`)).join("")
        || `<div class="vacio">${icono("estrella")}No hay reseñas pendientes.</div>`}</div>
      <details class="caja plegable" ${resenasAbiertas ? "open" : ""} id="aprobadas"><summary>${icono("estrella")} Aprobadas (${aprobadas.length})</summary>
        <div class="lista compacta">${aprobadas.map((r) => tarjeta(r, "")).join("") || `<p class="nota">Ninguna todavía.</p>`}</div></details>`;
    $("#aprobadas").addEventListener("toggle", (e) => { resenasAbiertas = e.target.open; });
    $$("[data-aprobar]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const id = b.dataset.aprobar;
      try {
        // En una transacción: si ya estaba aprobada (doble toque u otro teléfono), no suma dos veces.
        await runTransaction(db, async (tx) => {
          const ref = doc(db, "resenas", id);
          const d = await tx.get(ref);
          if (!d.exists() || d.data().aprobada) throw new Error("ya");
          const r = { id, ...d.data() };
          const mRef = doc(db, "motorizados", r.motoUid);
          const m = await tx.get(mRef);
          tx.update(ref, { aprobada: true });
          if (m.exists()) {
            const estrellasOk = Math.min(5, Math.max(1, Math.round(Number(r.estrellas) || 0)));
            const cambios = { ratingSum: increment(estrellasOk), ratingCount: increment(1) };
            if (typeof r.seguro === "boolean") { cambios.seguroN = increment(1); if (r.seguro) cambios.seguroSi = increment(1); }
            const validos = (lista, k) => lista.some((a) => a.k === k);
            (Array.isArray(r.buenos) ? r.buenos : []).filter((k) => validos(ASPECTOS.buenos, k)).forEach((k) => { cambios[`buenos.${k}`] = increment(1); });
            (Array.isArray(r.malos) ? r.malos : []).filter((k) => validos(ASPECTOS.malos, k)).forEach((k) => { cambios[`malos.${k}`] = increment(1); });
            tx.update(mRef, cambios);
            // Copia pública para el perfil del motorizado.
            tx.set(doc(db, "motorizados", r.motoUid, "opiniones", r.id), opinionPublica(r));
          }
        });
      } catch (e) { if (e.message !== "ya") { console.error(e); aviso("No se pudo aprobar. Intenta de nuevo."); b.disabled = false; } }
    }));
    $$("[data-rechazar]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Rechazar y borrar esta reseña?")) return;
      try {
        await runTransaction(db, async (tx) => {
          const ref = doc(db, "resenas", b.dataset.rechazar);
          const d = await tx.get(ref);
          if (!d.exists()) return;
          if (d.data().aprobada === true) throw new Error("Esa reseña ya fue aprobada");
          tx.delete(ref);
        });
      } catch (e) { console.error(e); aviso(e.message && !e.code ? e.message : "No se pudo rechazar. Intenta de nuevo."); }
    }));
  }

  // ---------- Tarifas ----------
  function vistaTarifas() {
    const t = tarifas;
    $("#vista").innerHTML = `<form id="tarifas">
      <div class="caja"><h2>${icono("dinero")} Tasa del dólar</h2>
        <label>Bolívares por cada $1 (ej. tasa BCV del día)</label><input name="tasa" type="number" step="0.01" min="0" value="${t.tasa || ""}" placeholder="Ej.: 36.50">
        <p class="nota">${t.tasa ? `Actualizada el ${fechaTexto(t.tasaFecha)} · Con esta tasa la app muestra los precios en Bs.` : "Escríbela para que los clientes puedan pagar en Bs y Pago móvil."} Actualízala cada día.</p></div>
      <div class="caja"><h2>${icono("telefono")} Tu pago móvil (para cobrar la cuota)</h2>
        <p class="nota">Los motorizados lo ven en su app para pagarte la quincena y reportar el pago.</p>
        <label>Banco</label><input name="cobroBanco" value="${esc((t.cobro || {}).banco || "")}" placeholder="Ej.: Banesco">
        <div class="dos"><div><label>Teléfono</label><input name="cobroTel" value="${esc((t.cobro || {}).telefono || "")}" placeholder="0414-1234567"></div>
        <div><label>Cédula</label><input name="cobroCed" value="${esc((t.cobro || {}).cedula || "")}" placeholder="V-12345678"></div></div></div>
      <h1 class="titulo">Tarifas por kilómetro</h1>
      <p class="nota">Precio = base + (precio por km × kilómetros). El cliente lo ve calculado en el mapa.</p>
      <div class="caja" ${SERVICIOS.includes("delivery") ? "" : "hidden"}><h2>${icono("paquete")} Delivery</h2><div class="dos">
        <div><label>Base ($)</label><input name="db" type="number" step="0.01" min="0" value="${t.delivery.base}"></div>
        <div><label>Por km ($)</label><input name="dk" type="number" step="0.01" min="0" value="${t.delivery.porKm}"></div></div></div>
      <div class="caja"><h2>${icono("moto")} Mototaxi</h2><div class="dos">
        <div><label>Base ($)</label><input name="mb" type="number" step="0.01" min="0" value="${t.mototaxi.base}"></div>
        <div><label>Por km ($)</label><input name="mk" type="number" step="0.01" min="0" value="${t.mototaxi.porKm}"></div></div></div>
      <div class="caja"><h2>${icono("tarjeta")} Cuota de motorizados</h2><div class="dos">
        <div><label>Monto ($)</label><input name="cuota" type="number" step="0.01" min="0" value="${t.cuota}"></div>
        <div><label>Cada cuántos días</label><input name="dias" type="number" step="1" min="1" value="${t.diasCuota}"></div></div></div>
      <div class="caja"><h2>${icono("luna")} Recargo nocturno</h2>
        <label class="opcion"><input type="checkbox" name="nocheActiva" ${t.nocturna.activa ? "checked" : ""}><span>Cobrar recargo de noche</span></label>
        <div class="dos"><div><label>Desde</label><input name="nocheDesde" type="time" value="${esc(t.nocturna.desde)}"></div>
        <div><label>Hasta</label><input name="nocheHasta" type="time" value="${esc(t.nocturna.hasta)}"></div></div>
        <label>Monto extra ($)</label><input name="nocheExtra" type="number" step="0.01" min="0" value="${t.nocturna.extra}"></div>
      <div class="caja"><h2>${icono("lluvia")} Recargo por lluvia</h2>
        <label class="opcion"><input type="checkbox" name="lluviaActiva" ${t.lluvia.activa ? "checked" : ""}><span>Está lloviendo: cobrar recargo ahora</span></label>
        <label>Monto extra ($)</label><input name="lluviaExtra" type="number" step="0.01" min="0" value="${t.lluvia.extra}">
        <p class="nota">Apágalo cuando pare de llover. Los clientes lo ven al instante en el precio.</p></div>
      ${recargos(t).length ? `<p class="pildora alerta">Ahora se está cobrando: ${recargos(t).map((x) => `${x.nombre} +${usd(x.monto)}`).join(" y ")}</p>` : ""}
      <button class="boton">Guardar tarifas</button></form>`;
    $("#tarifas").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const num = (k) => Number(fd.get(k)) || 0;
      const nuevas = {
        delivery: { base: num("db"), porKm: num("dk") }, mototaxi: { base: num("mb"), porKm: num("mk") }, cuota: num("cuota"), diasCuota: num("dias") || 15,
        nocturna: { activa: fd.get("nocheActiva") === "on", desde: fd.get("nocheDesde") || "20:00", hasta: fd.get("nocheHasta") || "05:00", extra: num("nocheExtra") },
        lluvia: { activa: fd.get("lluviaActiva") === "on", extra: num("lluviaExtra") },
        tasa: num("tasa"),
        cobro: { banco: String(fd.get("cobroBanco") || "").trim(), telefono: String(fd.get("cobroTel") || "").trim(), cedula: String(fd.get("cobroCed") || "").trim() },
        tasaFecha: num("tasa") !== (t.tasa || 0) ? new Date() : (t.tasaFecha || new Date()),
      };
      const bt = $("button", e.target); bt.disabled = true;
      try {
        await setDoc(doc(db, "config", "general"), nuevas);
        tarifas = nuevas;
        document.activeElement?.blur();
        aviso("Tarifas guardadas");
        ir(ruta, true);
      } catch (err) { console.error(err); aviso("No se pudieron guardar las tarifas. Revisa la conexión."); bt.disabled = false; }
    };
  }

  // Pestaña "Más": tarifas y números.
  let subMas = "tarifas";
  function vistaMas() {
    if (mapaLugares) { mapaLugares.remove(); mapaLugares = null; }
    const subs = ["tarifas", "stats", "lugares", "publicidad"];
    $("#vista").innerHTML = `<div class="segmento cuatro" id="sub-mas" data-pos="${subs.indexOf(subMas)}">
      <button data-s="tarifas" class="${subMas === "tarifas" ? "activo" : ""}">${icono("dolar")} Tarifas</button>
      <button data-s="stats" class="${subMas === "stats" ? "activo" : ""}">${icono("grafica")} Números</button>
      <button data-s="lugares" class="${subMas === "lugares" ? "activo" : ""}">${icono("pin")} Lugares</button>
      <button data-s="publicidad" class="${subMas === "publicidad" ? "activo" : ""}">${icono("megafono")} Publicidad</button></div><div id="sub-vista"></div>`;
    const vista = $("#vista");
    // Las vistas escriben en #vista: se les presta un contenedor y luego se pone debajo del selector.
    const real = vista.id;
    const cont = $("#sub-vista");
    vista.id = ""; cont.id = "vista";
    ({ tarifas: vistaTarifas, stats: vistaStats, lugares: vistaLugares, publicidad: vistaPublicidad })[subMas]();
    cont.id = "sub-vista"; vista.id = real;
    $$("#sub-mas button").forEach((b) => (b.onclick = () => { subMas = b.dataset.s; vistaMas(); }));
  }

  // ---------- Publicidad: un anuncio de un negocio que ven todos los clientes ----------
  function vistaPublicidad() {
    const p = publicidad || {};
    let foto = p.foto || null;
    $("#vista").innerHTML = `
      <form class="caja" id="form-pub"><h2>${icono("megafono")} Publicidad para clientes</h2>
        <p class="nota">Sale arriba en la lista de motorizados de <b>todos</b> los clientes (en la página y en la app instalada), marcado como «Publicidad». Si el cliente lo cierra, no le vuelve a salir hasta que guardes un anuncio nuevo.</p>
        <label class="opcion"><input type="checkbox" name="activo" ${p.activo ? "checked" : ""}><span>Mostrar la publicidad</span></label>
        <label>Nombre del negocio</label><input name="negocio" maxlength="40" placeholder="Ej.: Pizzería El Moján" value="${esc(p.negocio || "")}">
        <label>Mensaje</label><textarea name="texto" maxlength="160" placeholder="Ej.: 2x1 en pizzas los viernes. ¡Pide tu mototaxi y ven!">${esc(p.texto || "")}</textarea>
        <label>Foto (opcional)</label>
        <div class="botones"><label class="boton secundario">${icono("descargar")} Elegir foto<input type="file" accept="image/*" id="foto-pub" hidden></label>
          <button type="button" class="boton secundario" id="quitar-foto-pub" ${foto ? "" : "hidden"}>Quitar foto</button></div>
        <label>Texto del botón</label><input name="boton" maxlength="30" placeholder="Ej.: Escribir por WhatsApp" value="${esc(p.boton || "")}">
        <label>WhatsApp del negocio o enlace</label><input name="enlace" maxlength="300" placeholder="0414-1234567 o https://instagram.com/…" value="${esc(p.enlace || "")}">
        <p class="nota" id="enlace-pub-nota"></p>
        <label class="opcion"><input type="checkbox" name="reiniciar" ${p.activo ? "" : "checked"}><span>Es un anuncio nuevo: volver a mostrarlo a todos y empezar a contar los toques desde cero</span></label>
        <button class="boton">Guardar publicidad</button></form>
      <div class="caja"><h2>${icono("grafica")} Resultados</h2>
        <p><b id="toques-pub">${toquesPub}</b> toques en el botón${p.actualizado ? ` desde el ${fechaTexto(p.actualizado)}` : ""}</p>
        <p class="nota">Sirve para mostrarle al negocio cuánta gente se interesó. Cada toque abre su WhatsApp o su página.</p></div>
      <h2 class="subtitulo">Así lo ven los clientes</h2>
      <div class="pub-vista-previa" id="vista-pub"></div>`;
    const f = $("#form-pub");
    const datos = () => {
      const fd = new FormData(f);
      return { activo: true, negocio: String(fd.get("negocio") || "").trim(), texto: String(fd.get("texto") || "").trim(), boton: String(fd.get("boton") || "").trim(), enlace: String(fd.get("enlace") || "").trim(), foto };
    };
    const previa = () => {
      const d = datos();
      $("#vista-pub").innerHTML = htmlPublicidad(d, { cerrable: false }) || `<p class="nota">Escribe un mensaje o elige una foto para ver cómo queda.</p>`;
      const url = enlacePublicidad(d);
      $("#enlace-pub-nota").textContent = !d.enlace ? "Sin enlace: no saldrá botón." : url ? (url.startsWith("https://wa.me/") ? "El botón abrirá el WhatsApp del negocio." : "El botón abrirá ese enlace.") : "No se entiende: pon un número de teléfono o un enlace que empiece con https://";
      $("#quitar-foto-pub").hidden = !foto;
    };
    f.addEventListener("input", previa);
    $("#foto-pub").onchange = async (e) => {
      const a = e.target.files[0]; if (!a) return;
      try { foto = await achicarFoto(a, 720); previa(); } catch { aviso("No se pudo leer esa imagen"); }
    };
    $("#quitar-foto-pub").onclick = () => { foto = null; previa(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const d = datos(); d.activo = fd.get("activo") === "on";
      if (d.activo && !d.texto && !d.foto) return aviso("Escribe un mensaje o elige una foto");
      if (d.enlace && !enlacePublicidad(d)) return aviso("El WhatsApp o el enlace no es válido");
      const nuevo = fd.get("reiniciar") === "on";
      const bt = $("button.boton:not([type])", f) || $("button:last-of-type", f); bt.disabled = true;
      try {
        // "actualizado" cambia solo con un anuncio nuevo: así vuelve a salirle a quien cerró el anterior.
        await setDoc(doc(db, "config", "publicidad"), { ...d, boton: d.boton || "Ver más", actualizado: nuevo || !p.actualizado ? serverTimestamp() : p.actualizado });
        if (nuevo) await setDoc(doc(db, "stats", "publicidad"), { toques: 0 });
        aviso(d.activo ? "Publicidad guardada. Los clientes la ven al instante." : "Publicidad guardada (apagada).");
        ir(ruta, true);
      } catch (err) { console.error(err); aviso("No se pudo guardar. ¿Publicaste las reglas nuevas?"); }
      bt.disabled = false;
    };
    previa();
  }

  // ---------- Lugares: puntos de referencia que ven clientes y motorizados ----------
  let capaLugares = null;
  function vistaLugares() {
    $("#vista").innerHTML = `
      <h1 class="titulo">Puntos de referencia</h1>
      <p class="nota">Toca el mapa donde está el lugar (una bodega, una cancha, la casa de alguien conocido, un sector…) y ponle nombre. Lo verán todos los clientes y motorizados en sus mapas.</p>
      <div class="mapa" id="mapa-lugares" style="height:380px"></div>
      <div class="caja" style="margin-top:14px"><h2>Agregados por ti</h2><div id="lista-lugares"></div></div>`;
    // El mapa se crea después de que la vista está en su lugar.
    setTimeout(() => {
      if (!$("#mapa-lugares") || mapaLugares) return;
      mapaLugares = nuevoMapa("mapa-lugares", "libre");
      mapaLugares.setView([10.9833, -71.6667], 15, { animate: false });
      capaLugares = mostrarLugares(mapaLugares, (l) => aviso(`${l.n} · ${tipoLugar(l.t).nombre}`));
      mapaLugares.on("click", (e) => nuevoLugar(e.latlng));
      pintarListaLugares();
    }, 0);
  }
  function pintarListaLugares() {
    const caja = $("#lista-lugares");
    if (!caja) return;
    caja.innerHTML = lugaresPropios.length ? lugaresPropios.map((l) => `
      <div class="fila-mi-lugar"><span class="punto-tipo" style="background:${tipoLugar(l.t).color}">${icono(tipoLugar(l.t).icono)}</span>
        <b>${esc(l.n)}</b><small>${esc(tipoLugar(l.t).nombre)}</small>
        <button class="quitar" data-ver="${l.id}" aria-label="Ver en el mapa">${icono("pin")}</button>
        <button class="quitar" data-borrar-lugar="${l.id}" aria-label="Borrar">${icono("basura")}</button></div>`).join("")
      : `<p class="nota">Todavía no agregaste lugares.</p>`;
    $$("[data-ver]", caja).forEach((b) => (b.onclick = () => {
      const l = lugaresPropios.find((x) => x.id === b.dataset.ver);
      if (mapaLugares) { mapaLugares.flyTo([l.lat, l.lng], 17, { duration: 0.6 }); $("#mapa-lugares").scrollIntoView({ behavior: "smooth", block: "center" }); }
    }));
    $$("[data-borrar-lugar]", caja).forEach((b) => (b.onclick = async () => {
      const l = lugaresPropios.find((x) => x.id === b.dataset.borrarLugar);
      if (!confirm(`¿Borrar «${l.n}»?`)) return;
      await deleteDoc(doc(db, "lugares", l.id));
      aviso("Lugar borrado");
      if (capaLugares) capaLugares.recargar();
    }));
  }
  function nuevoLugar(latlng) {
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<form class="ventana"><h2>Nuevo punto de referencia</h2>
      <label>Nombre<input name="n" maxlength="50" required placeholder="Ej.: Bodega Los Primos, Cancha del sector, Sector Las Palmas"></label>
      <label>Tipo<select name="t">${TIPOS_PARA_AGREGAR.map((t) => `<option value="${t}">${esc(tipoLugar(t).nombre)}</option>`).join("")}</select></label>
      <button class="boton">Guardar</button>
      <button class="boton secundario" type="button" data-no>Cancelar</button></form>`;
    document.body.append(fondo);
    const marca = window.L.marker(latlng).addTo(mapaLugares);
    const cerrar = () => { fondo.remove(); if (mapaLugares) mapaLugares.removeLayer(marca); };
    $("[data-no]", fondo).onclick = cerrar;
    $("form", fondo).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const n = String(f.get("n")).trim();
      const bt = $("button[type=submit], button:not([type])", e.target);
      if (!n || bt?.disabled) return;
      if (bt) bt.disabled = true;
      try {
        await addDoc(collection(db, "lugares"), { n, t: f.get("t"), lat: latlng.lat, lng: latlng.lng, creado: serverTimestamp() });
        aviso(`«${n}» agregado. Ya lo ven todos.`);
        cerrar();
        if (capaLugares) capaLugares.recargar();
      } catch (err) {
        console.error(err);
        aviso("No se pudo guardar. ¿Publicaste las reglas nuevas de Firebase?");
        if (bt) bt.disabled = false;
      }
    };
    setTimeout(() => $("input", fondo).focus(), 50);
  }

  // ---------- Números ----------
  function quincena(f) {
    const mes = f.toLocaleString("es-VE", { month: "short", year: "numeric" });
    return { clave: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${f.getDate() <= 15 ? 1 : 2}`, texto: `${f.getDate() <= 15 ? "1–15" : "16–fin"} ${mes}` };
  }
  function vistaStats() {
    const dias = visitas.dias || {};
    const hoy = hoyLocal();
    const semana = Object.entries(dias).filter(([d]) => new Date(d) > new Date(Date.now() - 7 * DIA)).reduce((s, [, n]) => s + n, 0);
    const porQuincena = {};
    pagos.forEach((p) => {
      const f = fecha(p.fecha); if (!f) return;
      const q = quincena(f);
      porQuincena[q.clave] ??= { texto: q.texto, total: 0, n: 0 };
      porQuincena[q.clave].total += p.monto || 0; porQuincena[q.clave].n++;
    });
    const filasQ = Object.entries(porQuincena).sort(([a], [b]) => b.localeCompare(a));
    const totalCobrado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
    const ranking = motos.map((m) => ({ m, n: llamadas[m.id] || 0, c: carreras.filter((c) => c.motoUid === m.id && c.estado === "terminada").length }))
      .sort((a, b) => b.n - a.n);
    const haceDias = (n) => Date.now() - n * DIA;
    const cliApp = clientes.filter((c) => c.enApp).length;
    const cliActivos = clientes.filter((c) => (fecha(c.ultimaVez) || 0) > haceDias(7)).length;
    const motosReales = motos.filter((m) => m.usuario !== "prueba");
    const motoApp = motosReales.filter((m) => m.enApp).length;
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    $("#vista").innerHTML = `
      <h1 class="titulo">${icono("descargar")} App instalada</h1>
      <div class="cifras">
        <div class="cifra"><b>${cliApp}</b><span>Clientes con la app (${pct(cliApp, clientes.length)}%)</span></div>
        <div class="cifra"><b>${clientes.length}</b><span>Clientes registrados</span></div>
        <div class="cifra"><b>${cliActivos}</b><span>Usaron Whereapp (7 días)</span></div>
      </div>
      <div class="cifras"><div class="cifra"><b>${motoApp} de ${motosReales.length}</b><span>Motorizados con la app</span></div></div>
      <p class="nota">Cuenta a quien abrió Whereapp desde la app instalada (APK) al menos una vez, desde el 5 de octubre en adelante. Si alguien la desinstala, no se puede saber. En Clientes ves quién la tiene (${icono("descargar")} App).</p>
      <h1 class="titulo">Visitas a la app</h1>
      <div class="cifras">
        <div class="cifra"><b>${Number(dias[hoy]) || 0}</b><span>Hoy</span></div>
        <div class="cifra"><b>${Number(semana) || 0}</b><span>Últimos 7 días</span></div>
        <div class="cifra"><b>${Number(visitas.total) || 0}</b><span>En total</span></div>
      </div>
      <h1 class="titulo">Pagos cobrados</h1>
      <div class="cifras"><div class="cifra"><b>${usd(totalCobrado)}</b><span>Total cobrado</span></div>
        <div class="cifra"><b>${usd(filasQ[0]?.[1].total || 0)}</b><span>Última quincena</span></div></div>
      <div class="caja"><table class="tabla"><tr><th>Quincena</th><th class="num">Pagos</th><th class="num">Cobrado</th></tr>
        ${filasQ.map(([, q]) => `<tr><td>${q.texto}</td><td class="num">${q.n}</td><td class="num">${usd(q.total)}</td></tr>`).join("") || `<tr><td colspan="3">Sin pagos todavía</td></tr>`}</table></div>
      <h1 class="titulo">Llamadas por motorizado</h1>
      <div class="caja"><table class="tabla"><tr><th>Motorizado</th><th class="num">Llamadas</th><th class="num">Carreras*</th></tr>
        ${ranking.map((x) => `<tr><td>${esc(x.m.nombre)}</td><td class="num">${x.n}</td><td class="num">${x.c}</td></tr>`).join("") || `<tr><td colspan="3">Sin motorizados</td></tr>`}</table>
        <p class="nota">* Carreras terminadas entre las últimas 100.</p></div>`;
  }
}
