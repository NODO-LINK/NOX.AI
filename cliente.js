// Whereapp — app del cliente: pedir carrera, ver motorizados, seguir la carrera y calificar.

import {
  signInAnonymously, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, db, NOMBRE, SERVICIOS, $, $$, esc, usd, fechaTexto, estrellas, promedio, habilitado, leerTarifas, escucharTarifas, recargos, precio, ruta, botonTema, botonInstalar, registroSw, escucharChat, abrirChat,
  ICONOS, icono, nuevoMapa, mostrarLugares, tipoLugar, normalizar, marcarRecorrido, filasRecorrido, transicion, activarBarra, progreso, compartirCarrera, aviso, elegirMotivo, MOTIVOS_CLIENTE, avisoSinConfigurar,
} from "./comun.js?v=28";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  const L = window.L;
  let usuario = null, cliente = null, tarifas = null, bloqueado = false;
  let rutaActual = "motorizados", mapa = null;
  let motos = [], carreras = [], cancelarSubs = [];
  // Estado del formulario de pedido (se conserva al cambiar de pestaña).
  // puntos[0] = A (donde te buscan), los del medio = paradas, el último = B (destino).
  const pedido = { tipo: SERVICIOS[0], puntos: [], refs: [], retorno: false, agregando: false, nota: "", para: null, km: null, linea: null };
  const MAX_PUNTOS = 6;

  contarVisita();

  // Mientras se guarda el registro, el aviso de sesión nueva no debe mostrar el formulario otra vez.
  let registrando = false;

  onAuthStateChanged(auth, async (u) => {
    cancelarSubs.forEach((f) => f()); cancelarSubs = [];
    if (typeof seguimiento !== "undefined" && seguimiento.quitar) { seguimiento.quitar(); seguimiento.quitar = null; seguimiento.id = null; }
    usuario = u;
    if (registrando) return;
    if (!u) return pantallaEntrada();
    const s = await getDoc(doc(db, "clientes", u.uid)).catch(() => null);
    cliente = s && s.exists() ? s.data() : null;
    if (!cliente || !cliente.nombre) return pantallaEntrada();
    if (cliente.cedula) recordados.guardar({ nombre: cliente.nombre, cedula: cliente.cedula, telefono: cliente.telefono });
    arrancar();
  });

  // ---------- Entrada: nombre, cédula y teléfono (sin verificación por SMS) ----------
  // Los datos del cliente se recuerdan en este teléfono para entrar con un solo toque la próxima vez.
  const recordados = {
    leer() { try { return JSON.parse(localStorage.getItem("whereapp.datos")) || null; } catch { return null; } },
    guardar(d) { try { localStorage.setItem("whereapp.datos", JSON.stringify(d)); } catch {} },
    borrar() { try { localStorage.removeItem("whereapp.datos"); } catch {} },
  };
  const telBonito = (t) => String(t || "").replace(/^\+58(\d{3})(\d{7})$/, "0$1-$2");

  function pantallaEntrada(forzarFormulario = false) {
    $("#cabecera").hidden = true; $("#barra").hidden = true; $("#widget").hidden = true; document.body.classList.add("sin-barra");
    document.body.classList.remove("con-widget");
    const guardados = forzarFormulario ? null : recordados.leer();
    const pie = `<p class="nota" style="text-align:center;margin-top:18px">¿Eres motorizado? <a href="moto.html" style="color:var(--marca);font-weight:700">Entra aquí</a></p>`;
    const cabeza = `<div class="logo">${NOMBRE}</div><div class="logo-sub">${SERVICIOS.length > 1 ? "Delivery y mototaxi" : "Mototaxi"} en El Moján</div>`;

    if (guardados) {
      const iniciales = guardados.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
      $("#vista").innerHTML = `<div class="entrada">${cabeza}
        <div class="caja" style="text-align:center">
          <div class="avatar" style="margin:4px auto 12px;width:64px;height:64px;font-size:1.3rem">${esc(iniciales)}</div>
          <h2>¡Hola de nuevo, ${esc(guardados.nombre.split(" ")[0])}!</h2>
          <p class="nota">${esc(guardados.nombre)} · C.I. ${esc(guardados.cedula)} · ${esc(telBonito(guardados.telefono))}</p>
          <button class="boton" id="continuar">Entrar como ${esc(guardados.nombre.split(" ")[0])}</button>
          <button class="boton secundario" id="otros">No soy yo / cambiar datos</button>
        </div>${pie}</div>`;
      transicion();
      $("#continuar").onclick = () => entrar(guardados, $("#continuar"));
      $("#otros").onclick = () => pantallaEntrada(true);
      return;
    }

    const previos = recordados.leer() || {};
    const [nac, num] = String(previos.cedula || "V-").split("-");
    $("#vista").innerHTML = `<div class="entrada">${cabeza}
      <form class="caja" id="registro"><h2>Entra con tus datos</h2>
        <label for="nombre">Nombre completo</label>
        <input id="nombre" autocomplete="name" placeholder="Ej.: María José Pérez González" value="${esc(previos.nombre)}" required>
        <label for="cedula">Cédula</label>
        <div class="cedula">
          <select id="nacionalidad" aria-label="Nacionalidad"><option ${nac === "V" ? "selected" : ""}>V</option><option ${nac === "E" ? "selected" : ""}>E</option></select>
          <input id="cedula" inputmode="numeric" placeholder="12345678" value="${esc(num)}" required>
        </div>
        <label for="tel">Teléfono</label>
        <input id="tel" type="tel" inputmode="tel" placeholder="0414-1234567" autocomplete="tel" value="${esc(telBonito(previos.telefono))}" required>
        <button class="boton">Entrar</button>
        <p class="nota">Tus datos quedan guardados en este teléfono para que la próxima vez entres con un toque.</p>
      </form>${pie}</div>`;
    transicion();
    $("#registro").onsubmit = (e) => {
      e.preventDefault();
      const nombre = $("#nombre").value.trim().replace(/\s+/g, " ");
      const numero = $("#cedula").value.replace(/\D/g, "");
      const telefono = normalizarTel($("#tel").value);
      if (nombre.split(" ").length < 2) return aviso("Escribe tu nombre y apellido");
      if (numero.length < 6 || numero.length > 9) return aviso("Escribe una cédula válida");
      if (!telefono) return aviso("Escribe un teléfono válido, ej. 0414-1234567");
      entrar({ nombre, cedula: `${$("#nacionalidad").value}-${numero}`, telefono }, $("#registro button"));
    };
  }

  async function entrar(datos, boton) {
    boton.disabled = true;
    registrando = true;
    try {
      const cred = usuario ? { user: usuario } : await signInAnonymously(auth);
      usuario = cred.user;
      cliente = { ...datos, creado: serverTimestamp() };
      await setDoc(doc(db, "clientes", usuario.uid), cliente);
      recordados.guardar(datos);
      registrando = false;
      arrancar();
    } catch (err) {
      console.error(err);
      registrando = false;
      boton.disabled = false;
      aviso(err.code === "auth/operation-not-allowed" || err.code === "auth/admin-restricted-operation"
        ? "Falta activar la entrada Anónima en Firebase (Authentication → Método de acceso → Anónimo)."
        : err.code === "permission-denied"
        ? "Firebase no dejó guardar tus datos: faltan publicar las reglas de Whereapp (Firestore → Reglas)."
        : `No se pudo entrar. Revisa tu internet e intenta de nuevo. (${err.code || "error"})`);
    }
  }

  function normalizarTel(v) {
    let d = String(v).replace(/\D/g, "");
    if (d.startsWith("58")) d = d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);
    return d.length === 10 ? "+58" + d : null;
  }

  // ---------- App ----------
  async function arrancar() {
    document.body.classList.remove("sin-barra");
    $("#cabecera").hidden = false; $("#barra").hidden = false;
    $("#cabecera").innerHTML = `<div class="dentro"><div><div class="logo">${NOMBRE}</div><div class="logo-sub">Hola, ${esc(cliente.nombre)}</div></div>
      <div class="derecha"><button class="boton secundario chico" id="salir">Salir</button></div></div>`;
    $("#salir").onclick = () => { if (confirm("¿Salir de Whereapp?")) signOut(auth); };
    $("#cabecera .derecha").prepend(botonInstalar(), botonTema());
    $$("#barra button").forEach((b) => (b.onclick = () => ir(b.dataset.ruta)));
    $("#widget").onclick = () => ir("carrera");
    tarifas = await leerTarifas();
    // Tarifas en vivo: el recargo de lluvia aparece apenas el admin lo enciende.
    cancelarSubs.push(escucharTarifas((t) => { tarifas = t; if (rutaActual === "pedir" && !$(".selector")) vistaPedir(); }));
    // Cédula bloqueada por el administrador: no puede pedir.
    bloqueado = await getDoc(doc(db, "bloqueados", cliente.cedula || "-")).then((x) => x.exists()).catch(() => false);

    cancelarSubs.push(onSnapshot(query(collection(db, "motorizados"), where("activo", "==", true)), (s) => {
      const antes = JSON.stringify(motos.map(sinUbicacion));
      // Primero los libres, luego los que tienen una carrera en curso; dentro de cada grupo, por calificación.
      motos = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => habilitado(m) && m.deTurno !== false)
        .sort((a, b) => !!a.enCarrera - !!b.enCarrera || promedio(b) - promedio(a) || (b.ratingCount || 0) - (a.ratingCount || 0));
      // La ubicación de los motorizados cambia seguido; solo se redibuja si cambió otra cosa.
      if (rutaActual === "motorizados" && JSON.stringify(motos.map(sinUbicacion)) !== antes) vistaMotorizados();
    }));
    cancelarSubs.push(onSnapshot(query(collection(db, "carreras"), where("clienteUid", "==", usuario.uid)), (s) => {
      const antes = carreraActual();
      carreras = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      const ahora = carreraActual();
      $("#punto").hidden = !ahora;
      actualizarSeguimiento(antes);
      if (ahora && antes && antes.estado !== ahora.estado) {
        if (ahora.estado === "aceptada") aviso(`¡${ahora.motoNombre} aceptó tu carrera!`);
        if (ahora.estado === "esperando" && antes.estado === "aceptada") aviso("El motorizado canceló. Buscando otro…");
        if (ahora.estado === "terminada") aviso("Carrera terminada");
        if (rutaActual !== "carrera") return ir("carrera");
      }
      if (rutaActual === "carrera") vistaCarrera();
    }));
    ir(carreraActual() ? "carrera" : "motorizados");
  }

  const sinUbicacion = ({ ubicacion, ...resto }) => resto;
  const tiempo = (c) => (c.creada && c.creada.toMillis ? c.creada.toMillis() : Date.now());
  function carreraActual() {
    return carreras
      .filter((c) => c.estado === "esperando" || c.estado === "aceptada" || (c.estado === "terminada" && !c.calificada))
      .sort((a, b) => tiempo(b) - tiempo(a))[0] || null;
  }

  function ir(r) {
    // "Pedir" ya no es pestaña: se llega desde "Pedir a este" y se marca Motorizados.
    if (r === "pedir" && !pedido.para) r = "motorizados";
    rutaActual = r;
    activarBarra(r === "pedir" ? "motorizados" : r);
    if (mapa) { mapa.remove(); mapa = null; }
    const sel = $(".selector");
    if (sel) { sel.remove(); document.body.classList.remove("con-selector"); }
    seguimiento.alMover = null;
    ({ pedir: vistaPedir, motorizados: vistaMotorizados, carrera: vistaCarrera })[r]();
    refrescarVivo();
    transicion();
    window.scrollTo(0, 0);
  }

  // ---------- Pedir carrera: A, paradas y B en el mismo mapa ----------
  const letraPunto = (i, n) => (i === 0 ? "A" : i === n - 1 && n > 1 ? "B" : String(i));
  const clasePunto = (i, n) => (i === 0 ? "letra-a" : i === n - 1 && n > 1 ? "letra-b" : "letra-p");
  const iconoPunto = (i, n) => (i === 0 ? ICONOS.origen : i === n - 1 && n > 1 ? ICONOS.destino : ICONOS.parada(i));

  function vistaPedir() {
    const activa = carreraActual();
    const n = pedido.puntos.length;
    $("#vista").innerHTML = `
      <button class="boton secundario chico" id="volver" style="margin-top:16px">${icono("flecha", "girada")} Motorizados</button>
      <h1 class="titulo">¿A dónde vamos?</h1>
      ${SERVICIOS.length > 1 ? `<div class="segmento" id="tipo">
        <button data-t="delivery">${icono("paquete")} Delivery</button><button data-t="mototaxi">${icono("moto")} Mototaxi</button>
      </div>` : ""}
      ${pedido.para ? `<div class="para pildora">Para: ${esc(pedido.para.nombre)} <button id="quitar-para" aria-label="Quitar">${icono("cerrar")}</button></div>` : ""}
      <button class="vista-mapa" id="abrir-mapa" aria-label="Abrir el mapa para elegir los puntos">
        <div class="mapa mini" id="mapa"></div>
        <span class="vista-mapa-boton">${icono("pin")} ${n < 2 ? "Toca para elegir en el mapa" : "Editar en el mapa"}</span>
      </button>
      <div class="paradas" id="paradas"></div>
      ${n >= 2 ? `<div class="botones">
        <button class="boton secundario" id="agregar">${icono("mas")} Agregar parada</button>
        <label class="opcion interruptor"><input type="checkbox" id="retorno" ${pedido.retorno ? "checked" : ""}><span>Ida y vuelta</span></label>
      </div>` : ""}
      <div class="precio-caja" id="precio"></div>
      <div id="caja-nota"><label for="nota">¿Qué hay que llevar?</label>
      <textarea id="nota" placeholder="Ej.: una pizza de la pizzería…, un sobre, unas compras">${esc(pedido.nota)}</textarea></div>
      <button class="boton" id="pedir" ${activa ? "disabled" : ""}>${pedido.para ? `Pedir a ${esc(pedido.para.nombre)}` : "Pedir a todos los motorizados"}</button>
      ${activa ? `<p class="nota">Ya tienes una carrera en curso. Mírala en "Mi carrera".</p>` : ""}`;

    // Vista previa quieta: tocarla abre el mapa en pantalla completa.
    mapa = nuevoMapa("mapa", "mini");
    dibujarRecorrido(mapa, L.layerGroup().addTo(mapa), false);
    encuadrar(mapa);

    const t = tarifas[pedido.tipo];
    const extras = recargos(tarifas);
    $("#precio").innerHTML = (pedido.km != null && n >= 2
      ? `<span>${resumenRecorrido()}</span><b>${usd(precio(tarifas, pedido.tipo, pedido.km))}</b>`
      : `<span>${usd(t.base)} + ${usd(t.porKm)} por km</span><span class="nota">Marca A y B</span>`)
      + (extras.length ? `<small class="recargo">${icono(extras.some((x) => /lluvia/i.test(x.nombre)) ? "lluvia" : "luna")} Incluye ${extras.map((x) => `${x.nombre.toLowerCase()} (+${usd(x.monto)})`).join(" y ")}</small>` : "");
    if (bloqueado) $("#pedir").outerHTML = `<p class="pildora mal" style="margin-top:14px">Tu cédula está bloqueada. Comunícate con el administrador.</p>`;
    $$("#tipo button").forEach((b) => b.classList.toggle("activo", b.dataset.t === pedido.tipo));
    if ($("#tipo")) $("#tipo").dataset.activo = pedido.tipo;
    $("#caja-nota").hidden = pedido.tipo === "mototaxi";
    pintarListaPuntos(() => vistaPedir());

    $("#abrir-mapa").onclick = () => abrirSelector();
    if ($("#agregar")) $("#agregar").onclick = () => abrirSelector(true);
    if ($("#retorno")) $("#retorno").onchange = async (e) => { pedido.retorno = e.target.checked; await recalcular(); vistaPedir(); };
    $$("#tipo button").forEach((b) => (b.onclick = () => { pedido.tipo = b.dataset.t; vistaPedir(); }));
    const nota = $("#nota");
    if (nota) nota.addEventListener("input", (e) => { pedido.nota = e.target.value; });
    $("#volver").onclick = () => ir("motorizados");
    const quitar = $("#quitar-para");
    if (quitar) quitar.onclick = () => { pedido.para = null; ir("motorizados"); };
    if ($("#pedir")) $("#pedir").onclick = enviarPedido;
    // Si todavía no hay puntos, el mapa se abre solo.
    if (n === 0 && !activa && !bloqueado) abrirSelector();
  }

  const resumenRecorrido = () => {
    const n = pedido.puntos.length;
    return `${pedido.km.toFixed(1)} km${n > 2 ? ` · ${n - 2} parada${n > 3 ? "s" : ""}` : ""}${pedido.retorno ? " · ida y vuelta" : ""}`;
  };

  function encuadrar(m) {
    if (pedido.puntos.length >= 2) m.fitBounds(L.latLngBounds(pedido.puntos).pad(0.3), { animate: false });
    else if (pedido.puntos.length === 1) m.setView(pedido.puntos[0], 16, { animate: false });
  }

  // Marcadores y línea del recorrido en un mapa (arrastrables en el mapa completo).
  function dibujarRecorrido(m, capa, editable, alMover) {
    capa.clearLayers();
    const n = pedido.puntos.length;
    pedido.puntos.forEach((p, i) => {
      const marca = L.marker(p, { icon: iconoPunto(i, n), draggable: editable }).addTo(capa);
      if (editable) marca.on("dragend", (e) => { pedido.puntos[i] = e.target.getLatLng(); alMover && alMover(); });
    });
    if (pedido.linea && n >= 2) L.polyline(pedido.linea, { color: "#7c3aed", weight: 5, opacity: .75 }).addTo(capa);
  }

  let vueltaRuta = 0;
  async function recalcular() {
    pedido.km = null; pedido.linea = null;
    if (pedido.puntos.length < 2) return;
    const mia = ++vueltaRuta;
    const r = await ruta([...pedido.puntos, ...(pedido.retorno ? [pedido.puntos[0]] : [])]);
    if (mia !== vueltaRuta) return;
    pedido.km = r.km; pedido.linea = r.linea;
  }

  // Lugares favoritos del cliente (Casa, Trabajo…), guardados en este teléfono.
  const favoritos = {
    leer() { try { return JSON.parse(localStorage.getItem("whereapp.favoritos")) || []; } catch { return []; } },
    guardar(l) { try { localStorage.setItem("whereapp.favoritos", JSON.stringify(l.slice(0, 10))); } catch {} },
  };
  const esFavorito = (p) => favoritos.leer().some((f) => Math.abs(f.lat - p.lat) < 1e-5 && Math.abs(f.lng - p.lng) < 1e-5);
  function alternarFavorito(i) {
    const p = pedido.puntos[i];
    let lista = favoritos.leer();
    if (esFavorito(p)) {
      lista = lista.filter((f) => !(Math.abs(f.lat - p.lat) < 1e-5 && Math.abs(f.lng - p.lng) < 1e-5));
      aviso("Quitado de tus lugares");
    } else {
      const nombre = prompt("¿Cómo quieres llamar este lugar? (Casa, Trabajo, Casa de mamá…)", pedido.refs[i] || "");
      if (!nombre || !nombre.trim()) return;
      lista.unshift({ n: nombre.trim().slice(0, 40), lat: p.lat, lng: p.lng });
      aviso("Guardado en tus lugares");
    }
    favoritos.guardar(lista);
  }

  // Lista de puntos con su referencia escrita (se puede quitar cada uno menos A).
  function pintarListaPuntos(alCambiar) {
    const n = pedido.puntos.length;
    $("#paradas").innerHTML = pedido.puntos.map((_, i) => `
      <div class="parada-fila">
        <i class="${clasePunto(i, n)}">${letraPunto(i, n)}</i>
        <input data-ref="${i}" placeholder="${i === 0 ? "¿Dónde te buscan? Casa, calle, referencia…" : i === n - 1 ? "¿A dónde vas? Referencia…" : "Referencia de la parada…"}" value="${esc(pedido.refs[i] || "")}">
        <button class="estrella-fav ${esFavorito(pedido.puntos[i]) ? "on" : ""}" data-fav="${i}" aria-label="Guardar en mis lugares">${icono("favorito")}</button>
        ${i > 0 ? `<button class="quitar" data-quitar="${i}" aria-label="Quitar punto">${icono("cerrar")}</button>` : ""}
      </div>`).join("");
    $$("[data-ref]").forEach((el) => el.addEventListener("input", () => { pedido.refs[Number(el.dataset.ref)] = el.value; }));
    $$("[data-fav]").forEach((b) => (b.onclick = () => { alternarFavorito(Number(b.dataset.fav)); b.classList.toggle("on", esFavorito(pedido.puntos[Number(b.dataset.fav)])); }));
    $$("[data-quitar]").forEach((b) => (b.onclick = async () => {
      const i = Number(b.dataset.quitar);
      pedido.puntos.splice(i, 1); pedido.refs.splice(i, 1);
      await recalcular(); alCambiar();
    }));
  }

  // ---------- Mapa en pantalla completa para elegir A, paradas y B ----------
  let lugares = null;
  function abrirSelector(agregar = false) {
    if ($(".selector")) return;
    pedido.agregando = agregar && pedido.puntos.length >= 2;
    const caja = document.createElement("div");
    caja.className = "selector";
    caja.innerHTML = `
      <div class="selector-arriba">
        <div class="buscador">${icono("buscar")}<input id="buscar" type="search" placeholder="Buscar escuela, mercado, playa…" autocomplete="off">
          <button class="quitar" id="cerrar-sel" aria-label="Cerrar">${icono("cerrar")}</button></div>
        <div class="resultados" id="resultados" hidden></div>
        <div class="guia" id="guia"></div>
      </div>
      <div class="mapa-sel" id="mapa-sel"></div>
      <div class="selector-abajo">
        <div class="chips favoritos" id="favoritos"></div>
        <div class="chips" id="chips"></div>
        <div class="botones">
          <button class="boton secundario" id="sel-ubicacion">${icono("ubicarme")} Mi ubicación (A)</button>
          <button class="boton secundario" id="sel-agregar">${icono("mas")} Parada</button>
        </div>
        <button class="boton" id="listo">Listo</button>
      </div>`;
    document.body.append(caja);
    document.body.classList.add("con-selector");
    const m = nuevoMapa("mapa-sel", "libre");
    const capa = L.layerGroup().addTo(m);
    encuadrar(m);
    setTimeout(() => m.invalidateSize(), 50);

    const pintar = () => {
      const n = pedido.puntos.length;
      dibujarRecorrido(m, capa, true, cambiar);
      $("#guia", caja).innerHTML = n === 0
        ? `<i class="letra-a">A</i><span>Toca el mapa o un lugar donde te buscamos</span>`
        : n === 1
        ? `<i class="letra-b">B</i><span>Ahora toca a dónde vas</span>`
        : pedido.agregando
        ? `<i class="letra-p">${n - 1}</i><span>Toca dónde quieres la parada</span>`
        : `${icono("check")}<span>¡Listo! Arrastra los puntos para ajustar</span>`;
      $("#chips", caja).innerHTML = pedido.puntos.map((_, i) => `<span class="chip-punto"><i class="${clasePunto(i, n)}">${letraPunto(i, n)}</i>${esc(pedido.refs[i] || "Punto marcado")}</span>`).join("")
        || `<span class="nota">Puedes buscar un lugar arriba o tocar el mapa.</span>`;
      const favs = favoritos.leer();
      $("#favoritos", caja).innerHTML = favs.length ? favs.map((f, i) => `<button class="chip-fav" data-favi="${i}">${icono("casa")} ${esc(f.n)}</button>`).join("") : "";
      $$("[data-favi]", caja).forEach((b) => (b.onclick = () => { const f = favs[Number(b.dataset.favi)]; m.setView([f.lat, f.lng], 16, { animate: false }); poner(L.latLng(f.lat, f.lng), f.n); }));
      const agregarBtn = $("#sel-agregar", caja);
      agregarBtn.disabled = n < 2 || n >= MAX_PUNTOS;
      agregarBtn.classList.toggle("activo", pedido.agregando);
      $("#listo", caja).innerHTML = n < 2 ? "Listo" : pedido.km != null ? `Listo · ${resumenRecorrido()} · ${usd(precio(tarifas, pedido.tipo, pedido.km))}` : "Calculando…";
    };
    const cambiar = async () => { pedido.km = null; pintar(); await recalcular(); if (document.body.contains(caja)) pintar(); };

    // Agrega un punto: 1.º = A, 2.º = B; con "Parada" se mete antes de B.
    const poner = (latlng, nombre = "") => {
      const n = pedido.puntos.length;
      if (n < 2) { pedido.puntos.push(latlng); pedido.refs.push(nombre); }
      else if (pedido.agregando) { pedido.puntos.splice(n - 1, 0, latlng); pedido.refs.splice(n - 1, 0, nombre); pedido.agregando = false; }
      else { aviso("Para otra parada toca «Parada». Para mover un punto, arrástralo."); return; }
      if (pedido.puntos.length === 2) encuadrar(m);
      cambiar();
    };
    m.on("click", (e) => poner(e.latlng));

    // Lugares de El Moján: se ven al acercarse; tocar uno lo usa como punto con su nombre.
    mostrarLugares(m, (l) => poner(L.latLng(l.lat, l.lng), l.n)).listo
      .then((l) => { lugares = l; })
      .catch(() => aviso("No se pudieron cargar los lugares. Puedes tocar el mapa igual."));

    // Buscador de lugares por nombre o tipo.
    const buscar = $("#buscar", caja), res = $("#resultados", caja);
    buscar.addEventListener("input", () => {
      const q = normalizar(buscar.value.trim());
      if (q.length < 2) { res.hidden = true; return; }
      lugares = lugares || [];
      const hallados = [
        ...favoritos.leer().filter((f) => normalizar(f.n).includes(q)).map((f) => ({ ...f, t: "favorito" })),
        ...lugares.filter((l) => normalizar(l.n).includes(q) || normalizar(tipoLugar(l.t).nombre).includes(q)),
      ].slice(0, 8);
      res.hidden = false;
      res.innerHTML = hallados.length ? hallados.map((l, i) => `<button data-i="${i}"><span class="lugar" style="background:${tipoLugar(l.t).color}">${icono(tipoLugar(l.t).icono)}</span><span><b>${esc(l.n)}</b><small>${esc(tipoLugar(l.t).nombre)}</small></span></button>`).join("")
        : `<p class="nota">No encontramos «${esc(buscar.value)}». Toca el mapa en su lugar.</p>`;
      $$("[data-i]", res).forEach((b) => (b.onclick = () => {
        const l = hallados[Number(b.dataset.i)];
        res.hidden = true; buscar.value = ""; buscar.blur();
        m.setView([l.lat, l.lng], 17, { animate: false });
        poner(L.latLng(l.lat, l.lng), l.n);
      }));
    });

    $("#sel-agregar", caja).onclick = () => { pedido.agregando = !pedido.agregando; pintar(); };
    $("#sel-ubicacion", caja).onclick = () => {
      if (!navigator.geolocation) return aviso("Tu teléfono no permite usar la ubicación");
      aviso("Buscando tu ubicación…");
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const aqui = L.latLng(p.coords.latitude, p.coords.longitude);
          if (pedido.puntos.length) { pedido.puntos[0] = aqui; pedido.refs[0] = pedido.refs[0] || "Mi ubicación actual"; }
          else { pedido.puntos.push(aqui); pedido.refs.push("Mi ubicación actual"); }
          m.setView(aqui, 16, { animate: false });
          cambiar();
        },
        () => aviso("No se pudo obtener tu ubicación. Activa el GPS y da permiso."),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    };
    const cerrar = () => {
      m.remove(); caja.remove();
      document.body.classList.remove("con-selector");
      pedido.agregando = false;
      if (rutaActual === "pedir") vistaPedir();
    };
    $("#cerrar-sel", caja).onclick = cerrar;
    $("#listo", caja).onclick = () => {
      if (pedido.puntos.length < 2) return aviso("Marca al menos el punto A y el punto B");
      cerrar();
    };
    pintar();
  }

  async function enviarPedido() {
    if (bloqueado) return aviso("Tu cédula está bloqueada. Comunícate con el administrador.");
    if (carreraActual()) return aviso("Ya tienes una carrera en curso");
    const n = pedido.puntos.length;
    if (n < 2 || pedido.km == null) return aviso("Marca el punto A y el punto B en el mapa");
    if (pedido.puntos.some((_, i) => !(pedido.refs[i] || "").trim())) return aviso("Escribe una referencia para cada punto");
    if (pedido.tipo === "delivery" && !pedido.nota.trim()) return aviso("Cuéntanos qué hay que llevar");
    $("#pedir").disabled = true;
    pedirPermisoAvisos();
    const punto = (i) => ({ lat: pedido.puntos[i].lat, lng: pedido.puntos[i].lng, dir: pedido.refs[i].trim() });
    try {
      await addDoc(collection(db, "carreras"), {
        clienteUid: usuario.uid,
        clienteNombre: cliente.nombre,
        clienteTel: cliente.telefono,
        tipo: pedido.tipo,
        origen: punto(0),
        destino: punto(n - 1),
        paradas: pedido.puntos.slice(1, -1).map((_, j) => punto(j + 1)),
        retorno: pedido.retorno,
        nota: pedido.tipo === "delivery" ? pedido.nota.trim() : "",
        km: Math.round(pedido.km * 10) / 10,
        precio: precio(tarifas, pedido.tipo, pedido.km),
        recargos: recargos(tarifas),
        estado: "esperando",
        paraMoto: pedido.para ? pedido.para.id : null,
        paraMotoNombre: pedido.para ? pedido.para.nombre : null,
        motoUid: null,
        calificada: false,
        cancelaciones: [],
        creada: serverTimestamp(),
      });
      Object.assign(pedido, { puntos: [], refs: [], retorno: false, agregando: false, km: null, linea: null, nota: "", para: null });
      ir("carrera");
    } catch (e) {
      console.error(e);
      aviso("No se pudo pedir la carrera. Intenta de nuevo.");
      $("#pedir").disabled = false;
    }
  }

  // ---------- Motorizados activos ----------
  const iniciales = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
  function vistaMotorizados() {
    $("#vista").innerHTML = `<h1 class="titulo">Motorizados activos</h1>
      <p class="nota">Primero los disponibles, ordenados por calificación. Los que tienen <b>carrera en curso</b> reciben tu pedido al terminar.</p>
      <div class="lista">${motos.length ? motos.map((m) => `
        <article class="tarjeta">
          <div class="avatar">${esc(iniciales(m.nombre))}</div>
          <div class="info"><h3>${esc(m.nombre)}</h3>
            <p>${icono("moto")} ${esc(m.moto || "")}${m.placa ? ` · Placa ${esc(m.placa)}` : ""}</p>
            <div class="etiquetas">${m.enCarrera ? `<span class="pildora ocupado">${icono("ruta")} Carrera en curso</span>` : `<span class="pildora ok">Disponible</span>`}
            <span class="rating">${estrellas(m)}</span></div></div>
          <div class="acciones">
            <a class="boton secundario" href="tel:${esc(m.telefono)}" data-llamar="${m.id}">${icono("telefono")} Llamar</a>
            <button class="boton ${m.enCarrera ? "secundario" : ""}" data-pedir="${m.id}">${m.enCarrera ? "Pedir (al terminar)" : "Pedir a este"}</button>
          </div>
        </article>`).join("") : `<div class="vacio">${icono("moto")}No hay motorizados activos ahora.<br>Intenta en un rato.</div>`}
      </div>`;
    $$("[data-llamar]").forEach((a) => a.addEventListener("click", () => {
      setDoc(doc(db, "llamadas", a.dataset.llamar), { n: increment(1) }, { merge: true }).catch(() => {});
    }));
    $$("[data-pedir]").forEach((b) => (b.onclick = () => {
      const m = motos.find((x) => x.id === b.dataset.pedir);
      pedido.para = { id: m.id, nombre: m.nombre };
      ir("pedir");
    }));
  }

  // ---------- Mi carrera ----------
  function vistaCarrera() {
    const c = carreraActual();
    if (mapa) { mapa.remove(); mapa = null; }
    seguimiento.alMover = null;
    if (!c) {
      $("#vista").innerHTML = `<div class="vacio">${icono("ruta")}No tienes carreras en curso.<br><button class="boton" id="ir-pedir">Ver motorizados</button></div>`;
      $("#ir-pedir").onclick = () => ir("motorizados");
      return;
    }
    if (c.estado === "terminada") return vistaCalificar(c);

    const resumen = `
      <div class="caja">
        <div class="fila"><span>Servicio</span><b>${c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`}</b></div>
        ${filasRecorrido(c)}
        ${c.nota ? `<div class="fila"><span>Llevar</span><span>${esc(c.nota)}</span></div>` : ""}
        <div class="fila"><span>Distancia</span><span>${c.km} km</span></div>
        <div class="fila"><span>Precio</span><b>${usd(c.precio)}</b></div>
        <div class="fila"><span>Pedida</span><span>${fechaTexto(c.creada)}</span></div>
      </div>`;
    const botonesExtra = `
      <div class="botones">
        ${c.estado === "aceptada" ? `<button class="boton" id="chat">${icono("chat")} Chat con ${esc(c.motoNombre.split(" ")[0])}<b class="contador" id="chat-sin-leer" ${seguimiento.sinLeer ? "" : "hidden"}>${seguimiento.sinLeer || ""}</b></button>` : ""}
        <button class="boton secundario" id="compartir">${icono("compartir")} Compartir con un amigo</button>
        ${avisosPosibles() && Notification.permission !== "granted" ? `<button class="boton secundario" id="activar-avisos">${icono("campana")} Ver en notificaciones</button>` : ""}
      </div>`;

    if (c.estado === "esperando") {
      $("#vista").innerHTML = `
        <div class="estado-carrera"><div class="grande latido">${icono("moto")}</div>
          <h2>${c.paraMoto ? `Esperando a que ${esc(c.paraMotoNombre)} acepte…` : "Buscando motorizado…"}</h2>
          <p class="nota">Te avisamos apenas un motorizado acepte. Puedes dejar esta pantalla abierta.</p></div>
        ${botonesExtra}
        ${resumen}
        <button class="boton peligro" id="cancelar">Cancelar carrera</button>`;
    } else {
      const m = motos.find((x) => x.id === c.motoUid) || {};
      $("#vista").innerHTML = `
        <div class="vivo" id="vivo"></div>
        <article class="tarjeta">
          <div class="avatar">${esc(iniciales(c.motoNombre || "?"))}</div>
          <div class="info"><h3>${esc(c.motoNombre)}</h3>
            <p>${icono("moto")} ${esc(c.motoMoto || "")}${c.motoPlaca ? ` · Placa <b>${esc(c.motoPlaca)}</b>` : ""}</p>
            ${m.ratingCount ? `<span class="rating">${estrellas(m)}</span>` : ""}</div>
          <div class="acciones"><a class="boton" href="tel:${esc(c.motoTel)}">${icono("telefono")} Llamar a ${esc(c.motoNombre.split(" ")[0])}</a></div>
        </article>
        ${botonesExtra}
        <div class="mapa" id="mapa"></div>
        ${resumen}
        <button class="boton peligro" id="cancelar">Cancelar carrera</button>`;
      mapa = nuevoMapa("mapa");
      const limites = marcarRecorrido(mapa, c);
      mapa.fitBounds(limites.pad(0.3), { animate: false });
      let marcaMoto = null, centrado = false;
      seguimiento.alMover = (info, u) => {
        if (!$("#vivo")) return;
        $("#vivo").innerHTML = tarjetaVivo(info);
        if (!u || !mapa) return;
        if (!marcaMoto) marcaMoto = L.marker([u.lat, u.lng], { icon: ICONOS.moto }).addTo(mapa);
        else marcaMoto.setLatLng([u.lat, u.lng]);
        if (!centrado) { mapa.fitBounds(limites.extend([u.lat, u.lng]).pad(0.3), { animate: false }); centrado = true; }
      };
      seguimiento.alMover(seguimiento.info || progreso(c, null), seguimiento.ubic);
    }
    $("#compartir").onclick = () => compartirCarrera(c, cliente.nombre);
    if ($("#chat")) $("#chat").onclick = () => abrirChat(c.id, usuario.uid, cliente.nombre, c.motoNombre.split(" ")[0]);
    const av = $("#activar-avisos");
    if (av) av.onclick = async () => { await pedirPermisoAvisos(); vistaCarrera(); };
    $("#cancelar").onclick = async () => {
      const motivo = await elegirMotivo("¿Por qué cancelas?", MOTIVOS_CLIENTE);
      if (!motivo) return;
      await updateDoc(doc(db, "carreras", c.id), { estado: "cancelada", cancelacion: { por: "cliente", motivo, fecha: new Date() } });
      aviso("Carrera cancelada");
    };
  }

  // Tarjeta grande con los minutos que faltan y la barra A → B con la moto avanzando.
  const tarjetaVivo = (info) => `
    <div class="vivo-cabeza"><span class="vivo-punto"></span>En vivo</div>
    <h2>${esc(info.titulo)}</h2>
    <div class="vivo-tiempo">${info.min == null ? `${icono("reloj")}` : info.min === 0 ? "¡Ya llega!" : `${info.min}<small> min</small>`}</div>
    <p class="nota">${esc(info.detalle)}</p>
    <div class="pista"><i class="letra-a">A</i><div class="carril"><b style="width:${info.pct}%"></b><span class="moto-pista" style="left:${info.pct}%">${icono("moto")}</span></div><i class="letra-b">B</i></div>`;

  function vistaCalificar(c) {
    let puntos = 5;
    $("#vista").innerHTML = `
      <div class="estado-carrera"><div class="grande">${icono("listo")}</div><h2>¡Llegaste! ¿Cómo te fue con ${esc(c.motoNombre)}?</h2></div>
      <div class="caja">
        <div class="estrellas" id="estrellas">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" aria-label="${n} estrellas">${icono("estrella")}</button>`).join("")}</div>
        <label for="comentario">Comentario (opcional)</label>
        <textarea id="comentario" placeholder="¿Qué tal el servicio?"></textarea>
        <button class="boton" id="calificar">Enviar calificación</button>
        <button class="boton secundario" id="omitir">Ahora no</button>
      </div>`;
    const pintar = () => $$("#estrellas button").forEach((b) => b.classList.toggle("on", Number(b.dataset.n) <= puntos));
    $$("#estrellas button").forEach((b) => (b.onclick = () => {
      puntos = Number(b.dataset.n); pintar();
      $$("#estrellas button").forEach((x, i) => {
        x.classList.remove("salta");
        if (i < puntos) { void x.offsetWidth; x.style.animationDelay = `${i * 50}ms`; x.classList.add("salta"); }
      });
    }));
    pintar();
    $("#calificar").onclick = async () => {
      $("#calificar").disabled = true;
      await addDoc(collection(db, "resenas"), {
        motoUid: c.motoUid, motoNombre: c.motoNombre, carreraId: c.id,
        clienteUid: usuario.uid, clienteNombre: cliente.nombre,
        estrellas: puntos, comentario: $("#comentario").value.trim(), aprobada: false, fecha: serverTimestamp(),
      });
      await updateDoc(doc(db, "carreras", c.id), { calificada: true });
      aviso("¡Gracias por calificar!");
      ir("motorizados");
    };
    $("#omitir").onclick = async () => { await updateDoc(doc(db, "carreras", c.id), { calificada: true }); ir("motorizados"); };
  }

  // ---------- Seguimiento en vivo: widget flotante y aviso en la barra de notificaciones ----------
  const seguimiento = { id: null, motoUid: null, quitar: null, quitarChat: null, sinLeer: 0, ubic: null, info: null, memoria: {}, alMover: null, ultimoAviso: "" };
  const avisosPosibles = () => "Notification" in window && "serviceWorker" in navigator;

  async function pedirPermisoAvisos() {
    if (!avisosPosibles() || Notification.permission !== "default") return;
    try { await Notification.requestPermission(); } catch {}
  }

  async function notificar(titulo, cuerpo, { sonar = false } = {}) {
    if (!avisosPosibles() || Notification.permission !== "granted") return;
    const reg = (await registroSw) || (await navigator.serviceWorker.ready.catch(() => null));
    if (!reg) return;
    const clave = titulo + cuerpo;
    if (clave === seguimiento.ultimoAviso && !sonar) return;
    seguimiento.ultimoAviso = clave;
    reg.showNotification(titulo, {
      body: cuerpo, tag: "whereapp-carrera", renotify: sonar, silent: !sonar,
      icon: "icono-192.png", badge: "icono-192.png", data: { url: location.href.split("#")[0] },
      vibrate: sonar ? [200, 100, 200] : undefined,
    }).catch(() => {});
  }
  async function cerrarNotificacion() {
    const reg = await registroSw;
    if (!reg) return;
    (await reg.getNotifications({ tag: "whereapp-carrera" }).catch(() => [])).forEach((n) => n.close());
  }

  // Se llama cada vez que cambian las carreras del cliente.
  function actualizarSeguimiento(antes) {
    const c = carreraActual();
    const enCurso = c && c.estado === "aceptada";
    if (!enCurso || seguimiento.id !== c.id || seguimiento.motoUid !== c.motoUid) {
      if (seguimiento.quitar) seguimiento.quitar();
      if (seguimiento.quitarChat) seguimiento.quitarChat();
      Object.assign(seguimiento, { id: null, motoUid: null, quitar: null, quitarChat: null, sinLeer: 0, ubic: null, info: null, memoria: {} });
    }
    if (enCurso && !seguimiento.id) {
      Object.assign(seguimiento, { id: c.id, motoUid: c.motoUid });
      seguimiento.quitar = onSnapshot(doc(db, "motorizados", c.motoUid), (s) => {
        seguimiento.ubic = (s.data() && s.data().ubicacion) || null;
        refrescarVivo();
      });
      // Chat: contador de mensajes sin leer y aviso si la app está en segundo plano.
      seguimiento.quitarChat = escucharChat(c.id, usuario.uid, (msgs, sinLeer) => {
        const nuevo = sinLeer > seguimiento.sinLeer;
        seguimiento.sinLeer = sinLeer;
        const b = $("#chat-sin-leer");
        if (b) { b.hidden = !sinLeer; b.textContent = sinLeer; }
        const ult = msgs[msgs.length - 1];
        if (nuevo && ult && ult.de !== usuario.uid) {
          if (document.hidden) notificar(`Mensaje de ${c.motoNombre.split(" ")[0]}`, ult.texto, { sonar: true });
          else if (!$(".chat")) aviso(`${c.motoNombre.split(" ")[0]}: ${ult.texto}`);
        }
      });
      notificar(`¡${c.motoNombre.split(" ")[0]} aceptó tu carrera!`, `${c.motoMoto || "Moto"}${c.motoPlaca ? ` · Placa ${c.motoPlaca}` : ""}`, { sonar: true });
    }
    if (c && c.estado === "terminada" && antes && antes.estado === "aceptada") {
      notificar("¡Llegaste a tu destino!", `Toca para calificar a ${c.motoNombre.split(" ")[0]}`, { sonar: true });
    }
    if (!c) cerrarNotificacion();
    refrescarVivo();
  }

  // Recalcula cuánto falta y lo muestra en el widget, en "Mi carrera" y en la barra de notificaciones.
  function refrescarVivo() {
    const c = carreraActual();
    const w = $("#widget");
    if (!c || (c.estado !== "aceptada" && c.estado !== "esperando")) { w.hidden = true; document.body.classList.remove("con-widget"); return; }
    if (c.estado === "aceptada") {
      // Si el motorizado ya recogió, la memoria del tramo A se reinicia para el tramo B.
      if (seguimiento.memoria.recogido !== !!c.recogido) seguimiento.memoria = { recogido: !!c.recogido };
      seguimiento.info = progreso(c, seguimiento.ubic, seguimiento.memoria);
    }
    const info = c.estado === "aceptada" ? seguimiento.info : { titulo: c.paraMoto ? `Esperando a ${c.paraMotoNombre}` : "Buscando motorizado…", detalle: "Te avisamos apenas acepten", pct: null, min: null };
    const visible = rutaActual !== "carrera";
    w.hidden = !visible;
    document.body.classList.toggle("con-widget", visible);
    w.innerHTML = `
      <div class="widget-icono ${c.estado === "esperando" ? "latido" : ""}">${icono("moto")}</div>
      <div class="widget-texto"><b>${esc(info.titulo)}</b><small>${esc(info.detalle)}</small>
        <div class="barra-progreso ${info.pct == null ? "buscando" : ""}"><i style="width:${info.pct ?? 30}%"></i></div></div>
      ${info.min ? `<div class="widget-min">${info.min}<small>min</small></div>` : ""}`;
    if (c.estado === "aceptada") {
      if (seguimiento.alMover) seguimiento.alMover(info, seguimiento.ubic);
      notificar(info.titulo, `${info.detalle} · ${c.motoNombre.split(" ")[0]}${c.motoPlaca ? ` (${c.motoPlaca})` : ""}`);
    }
  }

  function contarVisita() {
    try { if (sessionStorage.getItem("whereapp.visita")) return; sessionStorage.setItem("whereapp.visita", "1"); } catch {}
    const hoy = new Date().toISOString().slice(0, 10);
    setDoc(doc(db, "stats", "visitas"), { total: increment(1), dias: { [hoy]: increment(1) } }, { merge: true }).catch(() => {});
  }
}
