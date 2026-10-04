// Whereapp — app del cliente: pedir carrera, ver motorizados, seguir la carrera y calificar.

import {
  signInAnonymously, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, db, NOMBRE, SERVICIOS, $, $$, esc, usd, fecha, fechaTexto, estrellas, promedio, habilitado, leerTarifas, escucharTarifas, recargos, precio, ruta, botonTema, botonInstalar, registroSw, escucharChat, abrirChat,
  ICONOS, icono, nuevoMapa, mostrarLugares, tipoLugar, normalizar, marcarRecorrido, filasRecorrido, transicion, activarBarra, progreso, afinarEta, lineaRecta, compartirCarrera, aviso, elegirMotivo, MOTIVOS_CLIENTE, avisoSinConfigurar,
  leerOpiniones, listaOpiniones, coincideLugar, politicasAceptadas, aceptarPoliticas, ENLACE_POLITICAS, VERSION_POLITICAS, sonarAlerta, cargarLugares, CENTRO, ASPECTOS, insigniasSeguridad, FORMAS_PAGO, aBs, bs, textoCobro,
} from "./comun.js?v=44";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  const L = window.L;
  let usuario = null, cliente = null, tarifas = null, bloqueado = false;
  let rutaActual = "motorizados", mapa = null;
  let motos = [], carreras = [], cancelarSubs = [];
  // Estado del formulario de pedido (se conserva al cambiar de pestaña).
  // puntos[0] = A (donde te buscan), los del medio = paradas, el último = B (destino).
  const pedido = { tipo: SERVICIOS[0], puntos: [], refs: [], retorno: false, agregando: false, nota: "", para: null, km: null, linea: null, oferta: null, ofertaTocada: false,
    formaPago: (() => { try { return localStorage.getItem("whereapp.pago") || "usd"; } catch { return "usd"; } })() };
  const MAX_PUNTOS = 6;
  let lugares = null;   // lugares de El Moján para el buscador y las sugerencias

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
    const pie = `<p class="nota" style="text-align:center;margin-top:18px">¿Eres motorizado? <a href="moto.html" style="color:var(--marca);font-weight:700">Entra aquí</a></p>
      <p class="nota" style="text-align:center">${ENLACE_POLITICAS}</p>`;
    // Casilla para aceptar la política (solo si no la ha aceptado en este teléfono).
    const casilla = politicasAceptadas() ? "" : `<label class="opcion acepto"><input type="checkbox" id="acepto"><span>Acepto la <a href="privacidad.html" target="_blank">política de privacidad y de cookies</a></span></label>`;
    const falta = () => {
      if (!$("#acepto") || $("#acepto").checked) return false;
      aviso("Para entrar, acepta la política de privacidad y de cookies");
      const l = $(".acepto"); l.classList.remove("falta"); void l.offsetWidth; l.classList.add("falta");
      return true;
    };
    const cabeza = `<div class="logo">${NOMBRE}</div><div class="logo-sub">${SERVICIOS.length > 1 ? "Delivery y mototaxi" : "Mototaxi"} en El Moján</div>`;

    if (guardados) {
      const iniciales = guardados.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
      $("#vista").innerHTML = `<div class="entrada">${cabeza}
        <div class="caja" style="text-align:center">
          <div class="avatar" style="margin:4px auto 12px;width:64px;height:64px;font-size:1.3rem">${esc(iniciales)}</div>
          <h2>¡Hola de nuevo, ${esc(guardados.nombre.split(" ")[0])}!</h2>
          <p class="nota">${esc(guardados.nombre)} · C.I. ${esc(guardados.cedula)} · ${esc(telBonito(guardados.telefono))}</p>
          ${casilla}
          <button class="boton" id="continuar">Entrar como ${esc(guardados.nombre.split(" ")[0])}</button>
          <button class="boton secundario" id="otros">No soy yo / cambiar datos</button>
        </div>${pie}</div>`;
      transicion();
      $("#continuar").onclick = () => { if (!falta()) entrar(guardados, $("#continuar")); };
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
        ${casilla}
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
      if (falta()) return;
      entrar({ nombre, cedula: `${$("#nacionalidad").value}-${numero}`, telefono }, $("#registro button"));
    };
  }

  async function entrar(datos, boton) {
    boton.disabled = true;
    registrando = true;
    try {
      const cred = usuario ? { user: usuario } : await signInAnonymously(auth);
      usuario = cred.user;
      aceptarPoliticas();
      cliente = { ...datos, creado: serverTimestamp(), politicas: VERSION_POLITICAS };
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
    cancelarSubs.push(escucharTarifas((t) => { tarifas = t; if (enPedido() && !$(".selector")) vistaPedir(); }));
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
      if (ahora && antes && ahora.id === antes.id && ahora.llegoEn && !antes.llegoEn && !ahora.recogido) {
        const quien = (ahora.motoNombre || "Tu motorizado").split(" ")[0];
        aviso(`¡${quien} llegó! Está afuera esperándote`);
        notificarCarrera(`¡${quien} llegó!`, "Está afuera esperándote en el punto A", { sonar: true });
      }
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

  // "pedir" (a un motorizado) y "publicar" (a todos, con el precio que pone el cliente) usan la misma pantalla.
  function enPedido() { return rutaActual === "pedir" || rutaActual === "publicar"; }
  const publicando = () => rutaActual === "publicar";

  function ir(r) {
    // "Pedir" ya no es pestaña: se llega desde "Pedir a este" y se marca Motorizados.
    if (r === "pedir" && !pedido.para) r = "motorizados";
    if (r === "publicar") pedido.para = null;
    rutaActual = r;
    activarBarra(r === "pedir" ? "motorizados" : r);
    if (mapa) { mapa.remove(); mapa = null; }
    const sel = $(".selector");
    if (sel) { sel.remove(); document.body.classList.remove("con-selector"); }
    seguimiento.alMover = null;
    ({ pedir: vistaPedir, publicar: vistaPedir, motorizados: vistaMotorizados, carrera: vistaCarrera })[r]();
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
    const pub = publicando();
    // Al redibujar (agregar parada, elegir un lugar…) se reusa el mapa chiquito: así no parpadea ni recarga.
    const mapaViejo = mapa && mapa._dePedido && $("#abrir-mapa");
    const scroll = window.scrollY;
    $("#vista").innerHTML = `
      ${pub ? `<h1 class="titulo">Publica tu carrera</h1>
        <p class="nota">Marca a dónde vas y pon cuánto quieres pagar. Todos los motorizados de turno la ven y el primero que acepte te busca.</p>`
      : `<button class="boton secundario chico" id="volver" style="margin-top:16px">${icono("flecha", "girada")} Motorizados</button>
      <h1 class="titulo">¿A dónde vamos?</h1>`}
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
      ${n >= 3 && !pedido.paradaPendiente ? `<p class="nota ayuda-orden">${icono("agarrar")} Mantén y arrastra la letra de una parada para cambiar el orden de la ruta.</p>` : ""}
      ${n >= 4 && !pedido.paradaPendiente ? `<button class="boton secundario chico" id="ordenar">${icono("ruta")} Ordenar por la ruta más corta</button>` : ""}
      <div class="precio-caja" id="precio"></div>
      <div class="caja-pago">
        <label>¿Cómo vas a pagar?</label>
        <div class="formas-pago">${Object.entries(FORMAS_PAGO).map(([k, f]) => `<button type="button" data-pago="${k}" class="${pedido.formaPago === k ? "on" : ""}">${icono(f.icono)}<span>${f.t}</span></button>`).join("")}</div>
        <small class="nota" id="nota-pago"></small>
      </div>
      ${pub ? `<div class="oferta" id="caja-oferta">
        <label for="oferta">¿Cuánto quieres pagar?</label>
        <div class="campo-oferta">
          <button class="boton secundario chico" data-sumar="-0.25" aria-label="Bajar">−</button>
          <span id="moneda-oferta">$</span><input id="oferta" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00">
          <button class="boton secundario chico" data-sumar="0.25" aria-label="Subir">+</button>
        </div>
        <small class="nota" id="nota-oferta"></small>
      </div>` : ""}
      <div id="caja-nota"><label for="nota">¿Qué hay que llevar?</label>
      <textarea id="nota" placeholder="Ej.: una pizza de la pizzería…, un sobre, unas compras">${esc(pedido.nota)}</textarea></div>
      <button class="boton" id="pedir" ${activa ? "disabled" : ""}>${pedido.para ? `Pedir a ${esc(pedido.para.nombre)}` : "Pedir a todos los motorizados"}</button>
      ${activa ? `<p class="nota">Ya tienes una carrera en curso. Mírala en "Mi carrera".</p>` : ""}`;

    // Vista previa quieta: tocarla abre el mapa en pantalla completa.
    if (mapaViejo) {
      $("#abrir-mapa").replaceWith(mapaViejo);
      $(".vista-mapa-boton", mapaViejo).innerHTML = `${icono("pin")} ${n < 2 ? "Toca para elegir en el mapa" : "Editar en el mapa"}`;
      mapa._capaPedido.clearLayers();
      dibujarRecorrido(mapa, mapa._capaPedido, false);
      encuadrar(mapa, true);
      window.scrollTo(0, scroll);
    } else {
      if (mapa) { mapa.remove(); mapa = null; }
      mapa = nuevoMapa("mapa", "mini");
      mapa._dePedido = true;
      mapa._capaPedido = L.layerGroup().addTo(mapa);
      dibujarRecorrido(mapa, mapa._capaPedido, false);
      encuadrar(mapa);
    }

    const t = tarifas[pedido.tipo];
    const extras = recargos(tarifas);
    $("#precio").innerHTML = (pedido.km != null && n >= 2
      ? `<span>${resumenRecorrido()}</span><b>${usd(precio(tarifas, pedido.tipo, pedido.km))}${tarifas.tasa > 0 ? `<small class="en-bs">${bs(aBs(precio(tarifas, pedido.tipo, pedido.km), tarifas.tasa))}</small>` : ""}</b>`
      : n >= 2 ? `<span>${icono("ruta")} Calculando el precio…</span><span class="calculando"></span>`
      : `<span>${usd(t.base)} + ${usd(t.porKm)} por km</span><span class="nota">Marca A y B</span>`)
      + (extras.length ? `<small class="recargo">${icono(extras.some((x) => /lluvia/i.test(x.nombre)) ? "lluvia" : "luna")} Incluye ${extras.map((x) => `${x.nombre.toLowerCase()} (+${usd(x.monto)})`).join(" y ")}</small>` : "");
    if (pub) $("#precio").hidden = true;   // al publicar, el precio lo pone el cliente (abajo se muestra el sugerido)
    if (bloqueado) $("#pedir").outerHTML = `<p class="pildora mal" style="margin-top:14px">Tu cédula está bloqueada. Comunícate con el administrador.</p>`;
    $$("#tipo button").forEach((b) => b.classList.toggle("activo", b.dataset.t === pedido.tipo));
    if ($("#tipo")) $("#tipo").dataset.activo = pedido.tipo;
    $("#caja-nota").hidden = pedido.tipo === "mototaxi";
    pintarListaPuntos(() => vistaPedir());

    $("#abrir-mapa").onclick = () => abrirSelector();
    if ($("#agregar")) $("#agregar").onclick = () => {
      pedido.paradaPendiente = true; pedido.filaNueva = "P";
      vistaPedir();
      const campo = $("[data-nuevo=P]");
      if (campo) { campo.focus({ preventScroll: true }); campo.closest(".parada-fila").scrollIntoView({ behavior: "smooth", block: "center" }); }
    };
    if ($("#agregar")) $("#agregar").disabled = pedido.paradaPendiente || n >= MAX_PUNTOS;
    if ($("#ordenar")) $("#ordenar").onclick = () => ordenarParadas(() => vistaPedir());
    if ($("#retorno")) $("#retorno").onchange = async (e) => { pedido.retorno = e.target.checked; await recalcular(); vistaPedir(); };
    $$("#tipo button").forEach((b) => (b.onclick = () => { pedido.tipo = b.dataset.t; vistaPedir(); }));
    const nota = $("#nota");
    if (nota) nota.addEventListener("input", (e) => { pedido.nota = e.target.value; });
    if ($("#volver")) $("#volver").onclick = () => ir("motorizados");
    // Forma de pago: se recuerda en el teléfono para la próxima vez.
    const pintarPago = () => {
      const monto = pub ? pedido.oferta : n >= 2 && pedido.km != null ? precio(tarifas, pedido.tipo, pedido.km) : null;
      const f = pedido.formaPago;
      const enBs = f === "bs" || f === "pagomovil";
      let texto = !enBs ? "Pagas en dólares en efectivo al llegar."
        : tarifas.tasa > 0 ? `${monto ? `Pagarás ${bs(aBs(monto, tarifas.tasa))}. ` : ""}Tasa: ${bs(tarifas.tasa)} por $1.`
        : "El monto en Bs se calcula con la tasa del día.";
      if (f === "pagomovil") {
        const m = pedido.para && motos.find((x) => x.id === pedido.para.id);
        texto += m && !(m.pagoMovil && m.pagoMovil.telefono)
          ? " Este motorizado aún no registró su pago móvil: pídele los datos por el chat."
          : " Cuando acepten tu carrera verás los datos del pago móvil del motorizado.";
      }
      $("#nota-pago").textContent = texto;
    };
    $$("[data-pago]").forEach((b) => (b.onclick = () => {
      pedido.formaPago = b.dataset.pago;
      try { localStorage.setItem("whereapp.pago", pedido.formaPago); } catch {}
      $$("[data-pago]").forEach((x) => x.classList.toggle("on", x === b));
      if (pub) vistaPedir(); else pintarPago();
    }));
    pintarPago();
    if (pub) {
      // Precio que pone el cliente: arranca con el sugerido por distancia y se puede cambiar libremente.
      // Si paga en Bs o Pago móvil (y hay tasa), lo escribe directamente en bolívares.
      const tasa = tarifas.tasa > 0 ? tarifas.tasa : 0;
      const enBs = !!tasa && (pedido.formaPago === "bs" || pedido.formaPago === "pagomovil");
      const moneda = (v) => (enBs ? bs(v) : usd(v));
      const paso = enBs ? Math.max(1, Math.round(tasa * 0.25)) : 0.25;
      $("#moneda-oferta").textContent = enBs ? "Bs" : "$";
      $("label[for=oferta]").textContent = enBs ? "¿Cuántos bolívares quieres pagar?" : "¿Cuánto quieres pagar?";
      const sugerido = n >= 2 && pedido.km != null ? precio(tarifas, pedido.tipo, pedido.km) : null;
      const campo = $("#oferta");
      // Acepta "1.500,50", "1500,50" o "37.23".
      const valor = () => {
        const t = String(campo.value).trim().replace(/[^\d.,]/g, "");
        const v = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : /^\d+\.\d{1,2}$/.test(t) ? parseFloat(t) : parseFloat(t.replace(/\./g, ""));
        return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
      };
      const escribir = (v) => (v == null ? "" : enBs ? v.toFixed(2).replace(".", ",") : v.toFixed(2));
      // pedido.oferta siempre en $; pedido.ofertaBs guarda el monto exacto si se escribió en Bs.
      const fijar = (v) => {
        if (enBs) { pedido.ofertaBs = v; pedido.oferta = v ? Math.round((v / tasa) * 100) / 100 : null; }
        else { pedido.oferta = v; pedido.ofertaBs = null; }
      };
      const mostrado = () => (enBs ? pedido.ofertaBs ?? (pedido.oferta != null ? aBs(pedido.oferta, tasa) : null) : pedido.oferta);
      const pintarOferta = () => {
        const v = valor();
        const b = $("#pedir");
        if (b) b.innerHTML = v ? `${icono("dinero")} Publicar por ${moneda(v)}` : "Publicar carrera";
        const equivale = v ? (enBs ? `Son ${usd(pedido.oferta)}. ` : tasa ? `Son ${bs(aBs(v, tasa))}. ` : "") : "";
        $("#nota-oferta").textContent = equivale + (sugerido == null ? "Marca A y B para ver el precio sugerido."
          : `Precio sugerido por distancia: ${enBs ? bs(aBs(sugerido, tasa)) : usd(sugerido)}.${pedido.oferta && pedido.oferta < sugerido ? " Con menos dinero puede tardar más en aceptarse." : ""}`);
        if ($("#nota-pago")) pintarPago();
      };
      if (!pedido.ofertaTocada && sugerido != null) { pedido.oferta = sugerido; pedido.ofertaBs = null; }
      const inicial = mostrado();
      campo.value = escribir(inicial);
      campo.addEventListener("input", () => { fijar(valor()); pedido.ofertaTocada = true; pintarOferta(); });
      $$("[data-sumar]").forEach((b) => (b.onclick = () => {
        pedido.ofertaTocada = true;
        const sube = Number(b.dataset.sumar) > 0 ? paso : -paso;
        fijar(Math.max(paso, Math.round(((valor() || 0) + sube) * 100) / 100));
        campo.value = escribir(mostrado()); pintarOferta();
      }));
      pintarOferta();
    }
    const quitar = $("#quitar-para");
    if (quitar) quitar.onclick = () => { pedido.para = null; ir("motorizados"); };
    if ($("#pedir")) $("#pedir").onclick = enviarPedido;
    // Lugares para las sugerencias.
    if (!lugares) cargarLugares().then((l) => { lugares = l; }).catch(() => {});
    // Tu ubicación se pone sola como punto A.
    if (n === 0 && !activa && !bloqueado && !pedido.yoIntentado && navigator.geolocation) {
      pedido.yoIntentado = true; pedido.buscandoA = true;
      const quitarAviso = () => { pedido.buscandoA = false; const el = $("[data-nuevo=A]"); if (el) el.placeholder = "¿Dónde te buscan? Escribe un lugar…"; };
      navigator.geolocation.getCurrentPosition((p) => {
        quitarAviso();
        const aqui = L.latLng(p.coords.latitude, p.coords.longitude);
        const escribiendo = $("[data-nuevo=A]") && $("[data-nuevo=A]").value.trim();
        if (pedido.puntos.length || escribiendo || !enZona(aqui)) return;
        pedido.puntos.push(aqui); pedido.refs.push("Mi ubicación actual");
        if (enPedido() && !$(".selector")) { vistaPedir(); setTimeout(() => $("[data-nuevo=B]")?.focus(), 60); }
      }, quitarAviso, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    }
  }

  const resumenRecorrido = () => {
    const n = pedido.puntos.length;
    return `${pedido.km.toFixed(1)} km${n > 2 ? ` · ${n - 2} parada${n > 3 ? "s" : ""}` : ""}${pedido.retorno ? " · ida y vuelta" : ""}`;
  };

  function encuadrar(m, animar = false) {
    if (pedido.puntos.length >= 2) m.fitBounds(L.latLngBounds(pedido.puntos).pad(0.3), { animate: animar, duration: 0.5 });
    else if (pedido.puntos.length === 1) m.setView(pedido.puntos[0], 16, { animate: animar });
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

  // Mis lugares (Mi casa, Trabajo, casa de un amigo…), guardados en este teléfono.
  const TIPOS_MIOS = {
    casa: { nombre: "Mi casa", icono: "casa", color: "#7c3aed", sugerido: "Mi casa" },
    trabajo: { nombre: "Trabajo", icono: "trabajo", color: "#0ea5e9", sugerido: "Trabajo" },
    amigo: { nombre: "Familia o amigo", icono: "amigos", color: "#ec4899", sugerido: "Casa de " },
    otro: { nombre: "Otro", icono: "favorito", color: "#f59e0b", sugerido: "" },
  };
  const tipoMio = (f) => TIPOS_MIOS[f.tipo] || TIPOS_MIOS.otro;
  const favoritos = {
    leer() { try { return JSON.parse(localStorage.getItem("whereapp.favoritos")) || []; } catch { return []; } },
    guardar(l) { try { localStorage.setItem("whereapp.favoritos", JSON.stringify(l.slice(0, 20))); } catch {} },
  };
  const mismoSitio = (f, p) => Math.abs(f.lat - p.lat) < 1e-5 && Math.abs(f.lng - p.lng) < 1e-5;
  const esFavorito = (p) => favoritos.leer().some((f) => mismoSitio(f, p));
  const iconoMio = (f) => L.divIcon({ className: "", html: `<div class="mi-lugar" style="background:${tipoMio(f).color}">${icono(tipoMio(f).icono)}</div>`, iconSize: [32, 32], iconAnchor: [16, 34] });

  // Ventana para guardar un lugar: se elige el tipo y se le pone nombre.
  function guardarLugar(p, sugerido = "") {
    return new Promise((resolver) => {
      const fondo = document.createElement("div");
      fondo.className = "modal";
      let tipo = "casa";
      fondo.innerHTML = `<div class="ventana"><h2>Guardar en mis lugares</h2>
        <div class="tipos-lugar">${Object.entries(TIPOS_MIOS).map(([k, t]) => `<button class="tipo-lugar ${k === tipo ? "on" : ""}" data-tipo="${k}"><span style="background:${t.color}">${icono(t.icono)}</span>${esc(t.nombre)}</button>`).join("")}</div>
        <input id="nombre-lugar" maxlength="40" placeholder="Nombre del lugar">
        <button class="boton" data-ok>Guardar</button>
        <button class="boton secundario" data-no>Cancelar</button></div>`;
      document.body.append(fondo);
      const campo = $("#nombre-lugar", fondo);
      const usados = new Set(Object.values(TIPOS_MIOS).map((t) => t.sugerido));
      campo.value = sugerido && !usados.has(sugerido) ? sugerido : TIPOS_MIOS.casa.sugerido;
      $$("[data-tipo]", fondo).forEach((b) => (b.onclick = () => {
        tipo = b.dataset.tipo;
        $$("[data-tipo]", fondo).forEach((x) => x.classList.toggle("on", x === b));
        if (!campo.value.trim() || usados.has(campo.value)) campo.value = TIPOS_MIOS[tipo].sugerido;
        campo.focus();
        campo.setSelectionRange(campo.value.length, campo.value.length);
      }));
      const cerrar = (v) => { fondo.remove(); resolver(v); };
      $("[data-no]", fondo).onclick = () => cerrar(null);
      $("[data-ok]", fondo).onclick = () => {
        const n = campo.value.trim();
        if (!n || n === "Casa de") return aviso("Escribe el nombre del lugar");
        const lugar = { n: n.slice(0, 40), tipo, lat: p.lat, lng: p.lng };
        favoritos.guardar([lugar, ...favoritos.leer().filter((f) => !mismoSitio(f, p))]);
        aviso(`«${lugar.n}» guardado en tus lugares`);
        cerrar(lugar);
      };
    });
  }

  // Ventana para ver y borrar los lugares guardados.
  function editarLugares(alCambiar) {
    const fondo = document.createElement("div");
    fondo.className = "modal";
    const pintar = () => {
      const lista = favoritos.leer();
      fondo.innerHTML = `<div class="ventana"><h2>Mis lugares</h2>
        <div class="lista-mis-lugares">${lista.map((f, i) => `<div class="fila-mi-lugar"><span class="punto-tipo" style="background:${tipoMio(f).color}">${icono(tipoMio(f).icono)}</span><b>${esc(f.n)}</b>
          <button class="quitar" data-borrar="${i}" aria-label="Borrar">${icono("basura")}</button></div>`).join("") || `<p class="nota">No tienes lugares guardados.</p>`}</div>
        <button class="boton" data-no>Listo</button></div>`;
      $("[data-no]", fondo).onclick = () => { fondo.remove(); alCambiar(); };
      $$("[data-borrar]", fondo).forEach((b) => (b.onclick = () => {
        const l = favoritos.leer(); const [quitado] = l.splice(Number(b.dataset.borrar), 1);
        favoritos.guardar(l); aviso(`«${quitado.n}» borrado`); pintar();
      }));
    };
    document.body.append(fondo);
    pintar();
  }

  async function alternarFavorito(i) {
    const p = pedido.puntos[i];
    if (esFavorito(p)) {
      favoritos.guardar(favoritos.leer().filter((f) => !mismoSitio(f, p)));
      aviso("Quitado de tus lugares");
    } else await guardarLugar(p, pedido.refs[i] || "");
  }

  // Lista de puntos con su referencia escrita (se puede quitar cada uno menos A).
  // Casillas de A, paradas y B. Se escriben directo: mientras escribes salen lugares sugeridos y al tocar uno
  // queda marcado (no hace falta abrir el mapa). La fila "pendiente" es el próximo punto que falta.
  const enZona = (p) => Math.abs(p.lat - CENTRO[0]) < 0.15 && Math.abs(p.lng - CENTRO[1]) < 0.15;
  function filasPuntos() {
    const n = pedido.puntos.length;
    const filas = pedido.puntos.map((p, i) => ({ i, p }));
    if (n === 0) filas.push({ pendiente: "A", pos: 0 }, { pendiente: "B", pos: 1, bloqueada: true });
    else if (n === 1) filas.push({ pendiente: "B", pos: 1 });
    else if (pedido.paradaPendiente) filas.splice(n - 1, 0, { pendiente: "P", pos: n - 1 });
    return filas;
  }
  function pintarListaPuntos(alCambiar) {
    const n = pedido.puntos.length;
    const total = n < 2 ? 2 : n + (pedido.paradaPendiente ? 1 : 0);
    $("#paradas").innerHTML = filasPuntos().map((f, k) => {
      if (f.pendiente) {
        const letra = f.pendiente === "P" ? String(f.pos) : f.pendiente;
        const clase = f.pendiente === "A" ? "letra-a" : f.pendiente === "B" ? "letra-b" : "letra-p";
        const ph = f.pendiente === "A" ? (pedido.buscandoA ? "Buscando tu ubicación…" : "¿Dónde te buscan? Escribe un lugar…")
          : f.pendiente === "B" ? (f.bloqueada ? "Primero el punto A" : "¿A dónde vas? Escribe un lugar…") : "¿Dónde es la parada? Escribe un lugar…";
        return `<div class="parada-fila pendiente ${pedido.filaNueva === "P" && f.pendiente === "P" ? "nueva" : ""}">
          <i class="${clase}">${letra}</i>
          <div class="campo-lugar"><input data-nuevo="${f.pendiente}" placeholder="${ph}" ${f.bloqueada ? "disabled" : ""} autocomplete="off"><div class="sugerencias" hidden></div></div>
          <button class="quitar" data-en-mapa="${f.pendiente}" aria-label="Marcar en el mapa" ${f.bloqueada ? "disabled" : ""}>${icono("pin")}</button>
          ${f.pendiente === "P" ? `<button class="quitar" data-cancelar-parada aria-label="Quitar parada">${icono("cerrar")}</button>` : ""}
        </div>`;
      }
      const i = f.i;
      const movible = i > 0 && n >= 3 && !pedido.paradaPendiente;
      return `<div class="parada-fila ${pedido.filaNueva === i ? "nueva" : ""}" data-fila="${i}">
        <i class="${clasePunto(i, n)} ${movible ? "asa" : ""}" ${movible ? `data-arrastrar="${i}" title="Arrastra para cambiar el orden"` : ""}>${letraPunto(i, n)}${movible ? `<b class="agarre">${icono("agarrar")}</b>` : ""}</i>
        <div class="campo-lugar"><input data-ref="${i}" placeholder="${i === 0 ? "Referencia: casa, color, frente a…" : "Referencia del lugar…"}" value="${esc(pedido.refs[i] || "")}" autocomplete="off"><div class="sugerencias" hidden></div></div>
        <button class="estrella-fav ${esFavorito(pedido.puntos[i]) ? "on" : ""}" data-fav="${i}" aria-label="Guardar en mis lugares">${icono("favorito")}</button>
        ${i > 0 ? `<button class="quitar" data-quitar="${i}" aria-label="Quitar punto">${icono("cerrar")}</button>` : ""}
      </div>`;
    }).join("");
    void total;
    pedido.filaNueva = null;

    const listo = async () => { await recalcular(); if (enPedido() && !$(".selector")) alCambiar(); };
    // Puntos ya marcados: lo escrito es la referencia; si eliges una sugerencia, el punto cambia a ese lugar.
    $$("[data-ref]").forEach((el) => {
      const i = Number(el.dataset.ref);
      el.addEventListener("input", () => { pedido.refs[i] = el.value; });
      sugerir(el, i === 0, (l) => {
        pedido.puntos[i] = L.latLng(l.lat, l.lng); pedido.refs[i] = l.n; pedido.km = null;
        alCambiar(); listo();
      });
    });
    // Punto que falta: al elegir una sugerencia se agrega (A, B o parada antes de B).
    $$("[data-nuevo]").forEach((el) => sugerir(el, el.dataset.nuevo === "A", (l) => {
      const p = L.latLng(l.lat, l.lng);
      if (el.dataset.nuevo === "P") { const k = pedido.puntos.length - 1; pedido.puntos.splice(k, 0, p); pedido.refs.splice(k, 0, l.n); pedido.paradaPendiente = false; }
      else { pedido.puntos.push(p); pedido.refs.push(l.n); }
      pedido.km = null;
      alCambiar(); listo();
      setTimeout(() => { const sig = $("[data-nuevo]:not([disabled])"); if (sig) sig.focus(); }, 60);
    }));
    $$("[data-en-mapa]").forEach((b) => (b.onclick = () => abrirSelector(b.dataset.enMapa === "P")));
    if ($("[data-cancelar-parada]")) $("[data-cancelar-parada]").onclick = () => { pedido.paradaPendiente = false; alCambiar(); };
    $$("[data-fav]").forEach((b) => (b.onclick = async () => { await alternarFavorito(Number(b.dataset.fav)); b.classList.toggle("on", esFavorito(pedido.puntos[Number(b.dataset.fav)])); }));
    $$("[data-quitar]").forEach((b) => (b.onclick = async () => {
      const i = Number(b.dataset.quitar);
      pedido.puntos.splice(i, 1); pedido.refs.splice(i, 1);
      await recalcular(); alCambiar();
    }));
    $$("[data-arrastrar]").forEach((asa) => arrastrable(asa, (desde, hasta) => {
      const [p] = pedido.puntos.splice(desde, 1), [r] = pedido.refs.splice(desde, 1);
      pedido.puntos.splice(hasta, 0, p); pedido.refs.splice(hasta, 0, r);
      pedido.km = null; pedido.filaNueva = hasta;
      alCambiar(); listo();
    }));
  }

  // Cambiar el orden de la ruta: se mantiene apretada la letra de una parada (o de B) y se arrastra
  // arriba o abajo. El punto A (donde te buscan) no se mueve.
  function arrastrable(asa, alSoltar) {
    asa.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const fila = asa.closest(".parada-fila");
      const filas = $$("#paradas .parada-fila[data-fila]").filter((f) => Number(f.dataset.fila) > 0);
      const desde = Number(fila.dataset.fila);
      const rects = new Map(filas.map((f) => [f, f.getBoundingClientRect()]));
      const alto = rects.get(fila).height + 8;
      const y0 = e.clientY;
      let hasta = desde;
      asa.setPointerCapture(e.pointerId);
      fila.classList.add("arrastrando");
      $("#paradas").classList.add("ordenando");
      if (navigator.vibrate) navigator.vibrate(15);
      const mover = (ev) => {
        const r0 = rects.get(fila);
        const dy = Math.max(rects.get(filas[0]).top - r0.top - alto * 0.6, Math.min(rects.get(filas[filas.length - 1]).top - r0.top + alto * 0.6, ev.clientY - y0));
        fila.style.transform = `translateY(${dy}px) scale(1.02)`;
        const centro = r0.top + r0.height / 2 + dy;
        const antes = filas.filter((f) => f !== fila && rects.get(f).top + rects.get(f).height / 2 < centro).length;
        const nuevo = 1 + antes;
        if (nuevo !== hasta && navigator.vibrate) navigator.vibrate(8);
        hasta = nuevo;
        filas.forEach((f) => {
          if (f === fila) return;
          const k = Number(f.dataset.fila);
          const corre = desde < hasta && k > desde && k <= hasta ? -alto : hasta < desde && k >= hasta && k < desde ? alto : 0;
          f.style.transform = corre ? `translateY(${corre}px)` : "";
        });
      };
      const soltar = () => {
        asa.removeEventListener("pointermove", mover);
        asa.removeEventListener("pointerup", soltar);
        asa.removeEventListener("pointercancel", soltar);
        filas.forEach((f) => (f.style.transform = ""));
        fila.classList.remove("arrastrando");
        $("#paradas").classList.remove("ordenando");
        if (hasta !== desde) alSoltar(desde, hasta);
      };
      asa.addEventListener("pointermove", mover);
      asa.addEventListener("pointerup", soltar);
      asa.addEventListener("pointercancel", soltar);
    });
  }

  // Ordena las paradas (entre A y B) para que el recorrido sea lo más corto posible.
  async function ordenarParadas(alCambiar) {
    const pts = pedido.puntos, n = pts.length;
    const medio = pts.slice(1, -1).map((p, k) => ({ p, r: pedido.refs[k + 1] }));
    const largo = (orden) => {
      const ruta = [pts[0], ...orden.map((x) => x.p), pts[n - 1], ...(pedido.retorno ? [pts[0]] : [])];
      let d = 0; for (let k = 1; k < ruta.length; k++) d += lineaRecta(ruta[k - 1], ruta[k]); return d;
    };
    const permutar = (a) => (a.length <= 1 ? [a] : a.flatMap((x, k) => permutar([...a.slice(0, k), ...a.slice(k + 1)]).map((r) => [x, ...r])));
    const actual = largo(medio);
    const mejor = permutar(medio).reduce((m, o) => (largo(o) < largo(m) ? o : m), medio);
    if (largo(mejor) >= actual - 0.01) return aviso("Las paradas ya están en el mejor orden");
    mejor.forEach((x, k) => { pts[k + 1] = x.p; pedido.refs[k + 1] = x.r; });
    pedido.km = null;
    aviso(`Ordenamos las paradas: ${((actual - largo(mejor)) * 1.3).toFixed(1)} km menos aprox.`);
    alCambiar();
    await recalcular();
    if (enPedido() && !$(".selector")) alCambiar();
  }

  // Lista de lugares sugeridos debajo de una casilla, según lo que se va escribiendo.
  function sugerir(input, conMiUbicacion, alElegir) {
    const caja = input.parentElement.querySelector(".sugerencias");
    const cerca = pedido.puntos[0];
    const pintar = () => {
      const q = normalizar(input.value.trim());
      const favs = favoritos.leer().map((f) => ({ ...f, t: "favorito", mio: true }));
      let lista;
      if (q.length < 2) {
        // Sin escribir: tu ubicación y tus lugares guardados.
        lista = favs.slice(0, 5);
      } else {
        const palabras = q.split(/\s+/);
        const puntaje = (l) => {
          const nom = normalizar(l.n);
          if (!coincideLugar(l, palabras)) return null;
          let p = nom.startsWith(q) ? 0 : nom.split(/\s+/).some((w) => w.startsWith(palabras[0])) ? 1 : 2;
          if (l.mio) p -= 3; else if (l.propio) p -= 2; else if (l.t === "sector") p -= 0.5;
          if (cerca) p += Math.min(lineaRecta(cerca, l), 10) / 10;
          return p;
        };
        lista = [...favs, ...(lugares || [])].map((l) => ({ l, p: puntaje(l) })).filter((x) => x.p != null)
          .sort((a, b) => a.p - b.p).slice(0, 7).map((x) => x.l);
      }
      const items = [
        ...(conMiUbicacion ? [{ yo: true, n: "Mi ubicación actual", t: "otro" }] : []),
        ...lista,
      ];
      caja.innerHTML = items.map((l, k) => {
        const tipo = l.mio ? tipoMio(l) : tipoLugar(l.t);
        const ic = l.yo ? "ubicarme" : tipo.icono;
        const color = l.yo ? "#2563eb" : tipo.color;
        const sub = l.yo ? "Usar el GPS del teléfono" : l.mio ? "Tus lugares" : tipoLugar(l.t).nombre;
        return `<button type="button" data-k="${k}"><span class="lugar" style="background:${color}">${icono(ic)}</span><span><b>${esc(l.n)}</b><small>${esc(sub)}</small></span></button>`;
      }).join("")
        + (q.length >= 2 && !lista.length ? `<p class="nota">No encontramos «${esc(input.value.trim())}». Márcalo en el mapa con el botón ${icono("pin")}.</p>` : "")
        + `<button type="button" data-mapa><span class="lugar" style="background:#7c3aed">${icono("pin")}</span><span><b>Marcar en el mapa</b><small>Toca el lugar exacto</small></span></button>`;
      caja.hidden = false;
      $$("[data-k]", caja).forEach((b) => b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        const l = items[Number(b.dataset.k)];
        caja.hidden = true; input.blur();
        if (!l.yo) return alElegir(l);
        if (!navigator.geolocation) return aviso("Tu teléfono no permite usar la ubicación");
        aviso("Buscando tu ubicación…");
        navigator.geolocation.getCurrentPosition(
          (p) => alElegir({ n: "Mi ubicación actual", lat: p.coords.latitude, lng: p.coords.longitude }),
          () => aviso("No se pudo obtener tu ubicación. Activa el GPS y da permiso."),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      }));
      $("[data-mapa]", caja).addEventListener("pointerdown", (e) => {
        e.preventDefault(); caja.hidden = true; input.blur();
        abrirSelector(input.dataset.nuevo === "P");
      });
    };
    input.addEventListener("input", pintar);
    input.addEventListener("focus", () => {
      pintar();
      // Que la lista no quede tapada por la barra de abajo.
      setTimeout(() => input.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    });
    input.addEventListener("blur", () => setTimeout(() => { caja.hidden = true; }, 150));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { const b = $("[data-k]", caja); if (b) b.dispatchEvent(new Event("pointerdown")); } });
  }

  // ---------- Mapa en pantalla completa para elegir A, paradas y B ----------
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
    const m = nuevoMapa("mapa-sel", "libre", { yo: true });
    const capaMios = L.layerGroup().addTo(m);
    const capa = L.layerGroup().addTo(m);
    encuadrar(m);
    setTimeout(() => m.invalidateSize(), 50);
    let guardando = false;
    let buscandoYo = false;   // mientras se busca tu ubicación para ponerla como A   // modo "Guardar lugar": el próximo toque en el mapa se guarda en Mis lugares
    const ir = (p, z) => m.flyTo(p, Math.max(z, m.getZoom()), { duration: 0.6 });

    // Mis lugares en el mapa: tocarlos los usa como punto.
    const pintarMios = () => {
      capaMios.eachLayer((x) => x.unbindTooltip());
      capaMios.clearLayers();
      favoritos.leer().forEach((f) => {
        const mk = L.marker([f.lat, f.lng], { icon: iconoMio(f), zIndexOffset: 500 }).addTo(capaMios);
        mk.bindTooltip(esc(f.n), { permanent: true, direction: "top", offset: [0, -34], className: "nombre-mio" });
        mk.on("click", () => { if (guardando) return; poner(L.latLng(f.lat, f.lng), f.n); });
      });
    };

    const pintar = () => {
      const n = pedido.puntos.length;
      dibujarRecorrido(m, capa, true, cambiar);
      $("#guia", caja).innerHTML = guardando
        ? `${icono("favorito")}<span>Toca en el mapa el lugar que quieres guardar</span><button class="boton secundario chico" id="guardar-aqui">${icono("ubicarme")} Aquí estoy</button>`
        : n === 0 && buscandoYo
        ? `${icono("ubicarme")}<span>Buscando tu ubicación… También puedes tocar el mapa.</span>`
        : n === 0
        ? `<i class="letra-a">A</i><span>Toca el mapa o un lugar donde te buscamos</span>`
        : n === 1
        ? `<i class="letra-b">B</i><span>Ahora toca a dónde vas</span>`
        : pedido.agregando
        ? `<i class="letra-p">${n - 1}</i><span>Toca dónde quieres la parada</span>`
        : `${icono("check")}<span>¡Listo! Arrastra los puntos para ajustar</span>`;
      $("#chips", caja).innerHTML = pedido.puntos.map((_, i) => `<span class="chip-punto"><i class="${clasePunto(i, n)}">${letraPunto(i, n)}</i>${esc(pedido.refs[i] || "Punto marcado")}</span>`).join("")
        || `<span class="nota">Puedes buscar un lugar arriba o tocar el mapa.</span>`;
      const favs = favoritos.leer();
      $("#favoritos", caja).innerHTML = `<button class="chip-fav nuevo ${guardando ? "activo" : ""}" id="nuevo-lugar">${icono(guardando ? "cerrar" : "mas")} ${guardando ? "Cancelar" : "Guardar lugar"}</button>`
        + favs.map((f, i) => `<button class="chip-fav" data-favi="${i}"><span class="punto-tipo" style="background:${tipoMio(f).color}">${icono(tipoMio(f).icono)}</span>${esc(f.n)}</button>`).join("")
        + (favs.length ? `<button class="chip-fav editar" id="editar-lugares">${icono("basura")} Editar</button>` : "");
      $$("[data-favi]", caja).forEach((b) => (b.onclick = () => { const f = favs[Number(b.dataset.favi)]; guardando = false; ir([f.lat, f.lng], 16); poner(L.latLng(f.lat, f.lng), f.n); }));
      $("#nuevo-lugar", caja).onclick = () => { guardando = !guardando; pintar(); };
      if ($("#editar-lugares", caja)) $("#editar-lugares", caja).onclick = () => editarLugares(() => { pintarMios(); pintar(); });
      if ($("#guardar-aqui", caja)) $("#guardar-aqui", caja).onclick = () => {
        if (!navigator.geolocation) return aviso("Tu teléfono no permite usar la ubicación");
        aviso("Buscando tu ubicación…");
        navigator.geolocation.getCurrentPosition(
          (p) => { const aqui = L.latLng(p.coords.latitude, p.coords.longitude); ir(aqui, 17); guardarAqui(aqui); },
          () => aviso("No se pudo obtener tu ubicación. Activa el GPS y da permiso."),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      };
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
    const guardarAqui = async (latlng) => {
      const marca = L.marker(latlng, { icon: iconoMio({ tipo: "otro" }) }).addTo(m);
      const lugar = await guardarLugar(latlng);
      m.removeLayer(marca);
      guardando = false;
      if (!document.body.contains(caja)) return;
      pintarMios(); pintar();
      if (lugar && pedido.puntos.length < 2) poner(L.latLng(lugar.lat, lugar.lng), lugar.n);
    };
    m.on("click", (e) => (guardando ? guardarAqui(e.latlng) : poner(e.latlng)));
    pintarMios();

    // Tu ubicación se pone sola como punto A (si todavía no marcaste nada).
    const vacio = pedido.puntos.length === 0;
    buscandoYo = vacio;
    m.miUbicacion.then((aqui) => {
      buscandoYo = false;
      if (!document.body.contains(caja) || !vacio || pedido.puntos.length) return pintar();
      if (!aqui) { pintar(); return aviso("Activa el GPS para ponerte en el mapa automáticamente"); }
      if (!L.latLngBounds(m.options.maxBounds).contains(aqui)) { pintar(); return aviso("Estás fuera de El Moján: marca el punto A en el mapa"); }
      pedido.puntos.push(aqui); pedido.refs.push("Mi ubicación actual");
      ir(aqui, 17);
      cambiar();
      aviso("Te ubicamos: el punto A es donde estás. Ahora toca a dónde vas.");
    });

    // Lugares de El Moján: se ven al acercarse; tocar uno lo usa como punto con su nombre.
    mostrarLugares(m, (l) => (guardando ? guardarAqui(L.latLng(l.lat, l.lng)) : poner(L.latLng(l.lat, l.lng), l.n))).listo
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
        ...lugares.filter((l) => coincideLugar(l, q.split(/\s+/))),
      ].slice(0, 8);
      res.hidden = false;
      res.innerHTML = hallados.length ? hallados.map((l, i) => `<button data-i="${i}"><span class="lugar" style="background:${tipoLugar(l.t).color}">${icono(tipoLugar(l.t).icono)}</span><span><b>${esc(l.n)}</b><small>${esc(tipoLugar(l.t).nombre)}</small></span></button>`).join("")
        : `<p class="nota">No encontramos «${esc(buscar.value)}». Toca el mapa en su lugar.</p>`;
      $$("[data-i]", res).forEach((b) => (b.onclick = () => {
        const l = hallados[Number(b.dataset.i)];
        res.hidden = true; buscar.value = ""; buscar.blur();
        ir([l.lat, l.lng], 17);
        poner(L.latLng(l.lat, l.lng), l.n);
      }));
    });

    $("#sel-agregar", caja).onclick = () => { pedido.agregando = !pedido.agregando; pintar(); };
    $("#sel-ubicacion", caja).onclick = () => {
      if (!navigator.geolocation) return aviso("Tu teléfono no permite usar la ubicación");
      const usar = (aqui) => {
        if (pedido.puntos.length) { pedido.puntos[0] = aqui; pedido.refs[0] = pedido.refs[0] || "Mi ubicación actual"; }
        else { pedido.puntos.push(aqui); pedido.refs.push("Mi ubicación actual"); }
        ir(aqui, 16);
        cambiar();
      };
      if (m._yo) return usar(m._yo);
      aviso("Buscando tu ubicación…");
      navigator.geolocation.getCurrentPosition(
        (p) => usar(L.latLng(p.coords.latitude, p.coords.longitude)),
        () => aviso("No se pudo obtener tu ubicación. Activa el GPS y da permiso."),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    };
    const cerrar = () => {
      m.stop(); m.remove(); caja.remove();
      document.body.classList.remove("con-selector");
      pedido.agregando = false;
      if (enPedido()) vistaPedir();
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
    const pub = publicando();
    if (pub && !(pedido.oferta > 0)) return aviso("Escribe cuánto quieres pagar");
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
        precio: pub ? pedido.oferta : precio(tarifas, pedido.tipo, pedido.km),
        recargos: pub ? [] : recargos(tarifas),
        ...(pub ? { ofertaCliente: true, precioSugerido: precio(tarifas, pedido.tipo, pedido.km) } : {}),
        formaPago: pedido.formaPago,
        tasa: tarifas.tasa > 0 ? tarifas.tasa : null,
        precioBs: pub && pedido.ofertaBs && (pedido.formaPago === "bs" || pedido.formaPago === "pagomovil") ? pedido.ofertaBs : aBs(pub ? pedido.oferta : precio(tarifas, pedido.tipo, pedido.km), tarifas.tasa),
        estado: "esperando",
        paraMoto: pedido.para ? pedido.para.id : null,
        paraMotoNombre: pedido.para ? pedido.para.nombre : null,
        motoUid: null,
        calificada: false,
        cancelaciones: [],
        creada: serverTimestamp(),
      });
      Object.assign(pedido, { puntos: [], refs: [], retorno: false, agregando: false, km: null, linea: null, nota: "", para: null, oferta: null, ofertaBs: null, ofertaTocada: false, paradaPendiente: false, yoIntentado: false });
      ir("carrera");
    } catch (e) {
      console.error(e);
      aviso("No se pudo pedir la carrera. Intenta de nuevo.");
      $("#pedir").disabled = false;
    }
  }

  // ---------- Motorizados activos ----------
  const iniciales = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
  // Ubicación del cliente para ordenar por cercanía (se pide al ver la lista, como mucho cada 2 min).
  let miPos = null, pidiendoPos = false, ultimaPos = 0;
  function actualizarMiPos() {
    if (!navigator.geolocation || pidiendoPos || Date.now() - ultimaPos < 120000) return;
    pidiendoPos = true;
    navigator.geolocation.getCurrentPosition((p) => {
      pidiendoPos = false; ultimaPos = Date.now();
      miPos = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (rutaActual === "motorizados") vistaMotorizados();
    }, () => { pidiendoPos = false; ultimaPos = Date.now(); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }
  // Distancia del motorizado al cliente (solo si su ubicación es de los últimos 15 min).
  function cercania(m) {
    const u = m.ubicacion;
    if (!miPos || !u || Date.now() - (fecha(u.t) || 0) > 15 * 60000) return null;
    const km = lineaRecta(miPos, u) * 1.3;
    return { km, min: Math.max(1, Math.round((km / 25) * 60)) };
  }

  function vistaMotorizados() {
    actualizarMiPos();
    // Disponibles primero; luego por cercanía (si se sabe) y por calificación.
    const lista = motos.map((m) => ({ m, cerca: cercania(m) })).sort((a, b) =>
      !!a.m.enCarrera - !!b.m.enCarrera
      || (a.cerca ? a.cerca.km : 1e9) - (b.cerca ? b.cerca.km : 1e9)
      || promedio(b.m) - promedio(a.m));
    const libres = motos.filter((m) => !m.enCarrera).length;
    $("#vista").innerHTML = `<h1 class="titulo">Motorizados activos</h1>
      ${motos.length && !libres ? `<div class="banner-aviso">${icono("reloj")}<span><b>Todos están ocupados ahora mismo.</b> Puedes pedirle a uno y tu carrera le llega apenas termine la que tiene.</span></div>` : ""}
      <p class="nota">${miPos ? "Primero los disponibles y los más cerca de ti." : "Primero los disponibles, por calificación. Activa tu ubicación para ver quién está más cerca."}</p>
      <div class="lista">${motos.length ? lista.map(({ m, cerca }) => `
        <article class="tarjeta">
          <div class="avatar">${esc(iniciales(m.nombre))}</div>
          <div class="info"><h3>${esc(m.nombre)}</h3>
            <p>${icono("moto")} ${esc(m.moto || "")}${m.placa ? ` · Placa ${esc(m.placa)}` : ""}</p>
            <button class="ver-perfil" data-perfil="${m.id}">${icono("estrella")} Ver perfil y opiniones</button>
            <div class="etiquetas">${m.enCarrera ? `<span class="pildora ocupado">${icono("ruta")} Carrera en curso</span>` : `<span class="pildora ok">Disponible</span>`}
            ${cerca ? `<span class="pildora cerca">${icono("pin")} a ${cerca.min} min</span>` : ""}
            <span class="rating">${estrellas(m)}</span>${insigniasSeguridad(m)}</div></div>
          <div class="acciones">
            <a class="boton secundario" href="tel:${esc(m.telefono)}" data-llamar="${m.id}">${icono("telefono")} Llamar</a>
            <button class="boton ${m.enCarrera ? "secundario" : ""}" data-pedir="${m.id}">${m.enCarrera ? "Pedir (al terminar)" : "Pedir a este"}</button>
          </div>
        </article>`).join("") : `<div class="vacio">${icono("moto")}<b>No hay motorizados de turno ahora.</b><br>Intenta en un rato; esta lista se actualiza sola.</div>`}
      </div>`;
    $("#vista").insertAdjacentHTML("beforeend", `<p class="nota pie-legal">${ENLACE_POLITICAS}</p>`);
    $$("[data-perfil]").forEach((b) => (b.onclick = () => verPerfil(motos.find((x) => x.id === b.dataset.perfil))));
    $$("[data-llamar]").forEach((a) => a.addEventListener("click", () => {
      setDoc(doc(db, "llamadas", a.dataset.llamar), { n: increment(1) }, { merge: true }).catch(() => {});
    }));
    $$("[data-pedir]").forEach((b) => (b.onclick = () => {
      const m = motos.find((x) => x.id === b.dataset.pedir);
      pedido.para = { id: m.id, nombre: m.nombre };
      ir("pedir");
    }));
  }

  // Datos del pago móvil del motorizado, con botones para copiarlos.
  function tarjetaPagoMovil(c) {
    const pm = (motos.find((x) => x.id === c.motoUid) || {}).pagoMovil || {};
    const monto = c.precioBs ? bs(c.precioBs) : `${usd(c.precio)} en Bs`;
    if (!pm.telefono) return `<div class="caja pago-movil"><h2>${icono("telefono")} Pago móvil · ${monto}</h2>
      <p class="nota">${esc(String(c.motoNombre).split(" ")[0])} aún no registró sus datos de pago móvil. Pídeselos por el chat.</p></div>`;
    const fila = (t, v) => `<div class="fila"><span>${t}</span><b>${esc(v)}</b><button class="quitar" data-copiar="${esc(v)}" aria-label="Copiar">${icono("copiar")}</button></div>`;
    const todo = `${pm.banco}\n${pm.telefono}\n${pm.cedula}\n${c.precioBs ? Number(c.precioBs).toFixed(2).replace(".", ",") : ""}`;
    return `<div class="caja pago-movil"><h2>${icono("telefono")} Pago móvil · ${monto}</h2>
      ${fila("Banco", pm.banco)}${fila("Teléfono", pm.telefono)}${fila("Cédula", pm.cedula)}
      ${c.precioBs ? fila("Monto", Number(c.precioBs).toFixed(2).replace(".", ",")) : ""}
      <button class="boton secundario" data-copiar="${esc(todo)}">${icono("copiar")} Copiar todos los datos</button></div>`;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copiar); aviso("Copiado"); } catch { aviso(b.dataset.copiar); }
  });

  // Perfil del motorizado: datos, seguridad y opiniones de otros clientes.
  async function verPerfil(m) {
    if (!m) return;
    const fondo = document.createElement("div");
    fondo.className = "modal";
    fondo.innerHTML = `<div class="ventana perfil-moto">
      <div class="perfil-cabeza"><div class="avatar">${esc(iniciales(m.nombre))}</div>
        <div><h2>${esc(m.nombre)}</h2><p class="nota">${icono("moto")} ${esc(m.moto || "")}${m.placa ? ` · Placa ${esc(m.placa)}` : ""}</p>
        <span class="rating">${estrellas(m)}</span></div></div>
      ${insigniasSeguridad(m, 6) ? `<div class="etiquetas">${insigniasSeguridad(m, 6)}</div>` : ""}
      <h3 class="subtitulo-perfil">Opiniones de clientes</h3>
      <div class="opiniones" id="opiniones"><p class="nota">Cargando…</p></div>
      <button class="boton secundario" data-no>Cerrar</button></div>`;
    document.body.append(fondo);
    const cerrar = () => fondo.remove();
    $("[data-no]", fondo).onclick = cerrar;
    fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
    try { $("#opiniones", fondo).innerHTML = listaOpiniones(await leerOpiniones(m.id)); }
    catch (e) { console.error(e); $("#opiniones", fondo).innerHTML = `<p class="nota">No se pudieron cargar las opiniones.</p>`; }
  }

  // ---------- Mi carrera ----------
  function vistaCarrera() {
    const c = carreraActual();
    if (mapa) { mapa.remove(); mapa = null; }
    seguimiento.alMover = null;
    if (!c) {
      const pasadas = carreras.filter((x) => x.estado === "terminada" || x.estado === "cancelada").sort((a, b) => tiempo(b) - tiempo(a)).slice(0, 15);
      $("#vista").innerHTML = `<div class="vacio">${icono("ruta")}No tienes carreras en curso.<br><button class="boton" id="ir-pedir">Ver motorizados</button></div>
        ${pasadas.length ? `<h1 class="titulo">${icono("reloj")} Tus viajes</h1><div class="lista">${pasadas.map((x) => `
          <article class="tarjeta"><div class="info">
            <h3>${esc(x.origen.dir)} ${icono("flecha")} ${esc(x.destino.dir)}</h3>
            <p>${fechaTexto(x.creada)} · ${x.km} km · ${usd(x.precio)}${x.paradas?.length ? ` · ${x.paradas.length} parada${x.paradas.length > 1 ? "s" : ""}` : ""}${x.retorno ? " · ida y vuelta" : ""}</p>
            <p>${x.estado === "terminada" ? `<span class="pildora ok">Terminada</span> con ${esc(x.motoNombre || "")}` : `<span class="pildora mal">Cancelada</span>`}</p></div>
            <div class="acciones"><button class="boton secundario" data-repetir="${x.id}">${icono("deshacer")} Repetir este viaje</button></div>
          </article>`).join("")}</div>` : ""}`;
      $("#ir-pedir").onclick = () => ir("motorizados");
      $$("[data-repetir]").forEach((b) => (b.onclick = () => repetir(carreras.find((x) => x.id === b.dataset.repetir))));
      return;
    }
    if (c.estado === "terminada") return vistaCalificar(c);

    const resumen = `
      <div class="caja">
        <div class="fila"><span>Servicio</span><b>${c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`}</b></div>
        ${filasRecorrido(c)}
        ${c.nota ? `<div class="fila"><span>Llevar</span><span>${esc(c.nota)}</span></div>` : ""}
        <div class="fila"><span>Distancia</span><span>${c.km} km</span></div>
        <div class="fila"><span>Precio</span><b>${usd(c.precio)}${c.precioBs ? ` · ${bs(c.precioBs)}` : ""}</b></div>
        <div class="fila"><span>Pago</span><span>${esc((FORMAS_PAGO[c.formaPago] || FORMAS_PAGO.usd).c)}</span></div>
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
        <article class="tarjeta" id="tarjeta-moto">
          <div class="avatar">${esc(iniciales(c.motoNombre || "?"))}</div>
          <div class="info"><h3>${esc(c.motoNombre)}</h3>
            <p>${icono("moto")} ${esc(c.motoMoto || "")}${c.motoPlaca ? ` · Placa <b>${esc(c.motoPlaca)}</b>` : ""}</p>
            ${m.ratingCount ? `<span class="rating">${estrellas(m)}</span>` : ""}</div>
          <div class="acciones"><a class="boton" href="tel:${esc(c.motoTel)}">${icono("telefono")} Llamar a ${esc(c.motoNombre.split(" ")[0])}</a></div>
        </article>
        ${c.formaPago === "pagomovil" ? tarjetaPagoMovil(c) : ""}
        <div class="mapa-vivo-caja">
          <div class="mapa grande" id="mapa"></div>
          <div class="mapa-estado" id="mapa-estado"></div>
          <button class="boton secundario chico seguir-moto" id="seguir-moto">${icono("moto")} Seguir la moto</button>
        </div>
        <p class="nota leyenda-mapa"><i class="linea-camino"></i> camino que va a tomar · <i class="linea-rastro"></i> por dónde ha venido</p>
        ${botonesExtra}
        ${resumen}
        <button class="boton peligro" id="cancelar">Cancelar carrera</button>`;
      mapa = nuevoMapa("mapa", "", { yo: true });
      const limites = marcarRecorrido(mapa, c);
      mapa.fitBounds(limites.pad(0.3), { animate: false });
      // El mapa va antes de la tarjeta del motorizado: es lo primero que se quiere ver.
      $("#vivo").after($(".mapa-vivo-caja"), $(".leyenda-mapa"));
      let marcaMoto = null, centrado = false, siguiendo = true, animando = null;
      const camino = L.polyline([], { color: "#7c3aed", weight: 5, opacity: 0.85, dashArray: "2 9", lineCap: "round" }).addTo(mapa);
      const rastro = L.polyline([], { color: "#64748b", weight: 4, opacity: 0.7 }).addTo(mapa);
      const botonSeguir = $("#seguir-moto");
      const pintarSeguir = () => botonSeguir.classList.toggle("activo", siguiendo);
      botonSeguir.onclick = () => { siguiendo = !siguiendo; pintarSeguir(); if (siguiendo) encuadrarMoto(true); };
      // Si mueves el mapa con el dedo, deja de seguir a la moto (con el botón vuelve a seguirla).
      mapa.on("dragstart", () => { siguiendo = false; pintarSeguir(); });
      pintarSeguir();
      const encuadrarMoto = (animar) => {
        if (!marcaMoto) return;
        const meta = c.recogido ? c.destino : c.origen;
        mapa.fitBounds(L.latLngBounds([marcaMoto.getLatLng(), [meta.lat, meta.lng]]).pad(0.35), { animate: animar, maxZoom: 17 });
      };
      // La moto se desliza de su posición anterior a la nueva en vez de saltar.
      const deslizar = (desde, hasta) => {
        cancelAnimationFrame(animando);
        const t0 = performance.now();
        const paso = (t) => {
          const k = Math.min(1, (t - t0) / 900);
          marcaMoto.setLatLng([desde.lat + (hasta.lat - desde.lat) * k, desde.lng + (hasta.lng - desde.lng) * k]);
          if (k < 1) animando = requestAnimationFrame(paso);
        };
        animando = requestAnimationFrame(paso);
      };
      seguimiento.alMover = (info, u) => {
        if (!$("#vivo")) return;
        $("#vivo").innerHTML = tarjetaVivo(info);
        if (!u || !mapa) { $("#mapa-estado").innerHTML = `${icono("reloj")} Esperando la ubicación de la moto…`; return; }
        // Rastro: las posiciones por donde ha pasado desde que aceptó.
        const r = seguimiento.rastro;
        const ult = r[r.length - 1];
        if (!ult || lineaRecta(ult, u) > 0.01) { r.push({ lat: u.lat, lng: u.lng, t: Date.now() }); seguimiento.movido = Date.now(); }
        rastro.setLatLngs(r.map((p) => [p.lat, p.lng]));
        // Camino que le falta (por calles), si ya se calculó.
        const real = seguimiento.memoria.real;
        camino.setLatLngs(real && real.linea && !info.llego ? real.linea : []);
        if (!marcaMoto) marcaMoto = L.marker([u.lat, u.lng], { icon: ICONOS.moto, zIndexOffset: 1000 }).addTo(mapa);
        else { const a = marcaMoto.getLatLng(); if (a.lat !== u.lat || a.lng !== u.lng) deslizar(a, u); }
        if (!centrado) { mapa.fitBounds(limites.extend([u.lat, u.lng]).pad(0.3), { animate: false }); centrado = true; }
        else if (siguiendo) encuadrarMoto(true);
        // Estado: hace cuánto se actualizó y si está detenido.
        const edad = Math.round((Date.now() - (fecha(u.t) || new Date()).getTime()) / 1000);
        const quieto = seguimiento.movido ? Math.round((Date.now() - seguimiento.movido) / 60000) : 0;
        $("#mapa-estado").innerHTML = info.llego ? `${icono("check")} Llegó al punto A`
          : quieto >= 2 ? `${icono("alerta")} Detenido hace ${quieto} min`
          : `<i class="en-vivo"></i> ${edad < 60 ? "En vivo" : `Ubicación de hace ${Math.round(edad / 60)} min`}`;
        $("#mapa-estado").classList.toggle("alerta", quieto >= 2 && !info.llego);
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

  // Carga los mismos puntos de un viaje anterior. Si su motorizado está disponible, se le pide a él.
  function repetir(x) {
    const pts = [x.origen, ...(x.paradas || []), x.destino];
    Object.assign(pedido, {
      puntos: pts.map((p) => L.latLng(p.lat, p.lng)), refs: pts.map((p) => p.dir || ""),
      retorno: !!x.retorno, agregando: false, km: null, linea: null, nota: x.nota || "",
    });
    const m = motos.find((y) => y.id === x.motoUid);
    pedido.para = m ? { id: m.id, nombre: m.nombre } : null;
    recalcular().then(() => { if (enPedido()) vistaPedir(); });
    if (m) ir("pedir");
    else { aviso("Tu viaje ya está cargado: publícalo con tu precio"); ir("publicar"); }
  }

  // Tarjeta grande con los minutos que faltan y la barra A → B con la moto avanzando.
  const tarjetaVivo = (info) => `
    <div class="vivo-cabeza"><span class="vivo-punto"></span>En vivo</div>
    <h2>${esc(info.titulo)}</h2>
    <div class="vivo-tiempo">${info.llego ? "¡Está afuera!" : info.min == null ? `${icono("reloj")}` : info.min === 0 ? "¡Ya llega!" : `${info.min}<small> min</small>`}</div>
    <p class="nota">${esc(info.detalle)}</p>
    <div class="pista"><i class="letra-a">A</i><div class="carril"><b style="width:${info.pct}%"></b><span class="moto-pista" style="left:${info.pct}%">${icono("moto")}</span></div><i class="letra-b">B</i></div>`;

  function vistaCalificar(c) {
    let puntos = 5, seguro = null;
    const buenos = new Set(), malos = new Set();
    const quien = esc(String(c.motoNombre).split(" ")[0]);
    $("#vista").innerHTML = `
      <div class="estado-carrera"><div class="grande">${icono("escudo")}</div><h2>¡Llegaste! ¿Fue un viaje seguro con ${quien}?</h2>
        <p class="nota">Tu opinión ayuda a que todos viajen seguros en El Moján.</p></div>
      <div class="caja calificar">
        <label>¿Te sentiste seguro en el viaje?</label>
        <div class="si-no" id="seguro">
          <button data-s="si">${icono("escudo")} Sí, seguro</button>
          <button data-s="no">${icono("alerta")} No</button>
        </div>
        <label>¿Cómo calificas el viaje?</label>
        <div class="estrellas" id="estrellas">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" aria-label="${n} estrellas">${icono("estrella")}</button>`).join("")}</div>
        <label>¿Qué hizo bien ${quien}?</label>
        <div class="chips-calif" id="buenos">${ASPECTOS.buenos.map((a) => `<button data-k="${a.k}">${icono("check")} ${esc(a.t)}</button>`).join("")}</div>
        <button type="button" class="boton secundario chico" id="abrir-reporte">${icono("alerta")} Reportar un problema</button>
        <label id="titulo-malos" hidden>¿Algo que reportar? <small class="nota">(lo ve solo el administrador)</small></label>
        <div class="chips-calif malos" id="malos" hidden>${ASPECTOS.malos.map((a) => `<button data-k="${a.k}">${icono("alerta")} ${esc(a.t)}</button>`).join("")}</div>
        <label for="comentario">Comentario (opcional)</label>
        <textarea id="comentario" placeholder="Cuéntanos cómo te fue"></textarea>
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
    $$("#seguro button").forEach((b) => (b.onclick = () => {
      seguro = b.dataset.s === "si";
      $$("#seguro button").forEach((x) => x.classList.toggle("on", x === b));
      // Si no se sintió seguro, se resalta la parte de reportar.
      $("#malos").classList.toggle("resaltar", !seguro);
      if (!seguro) abrirReporte();
      if (!seguro) { if (puntos > 3) { puntos = 2; pintar(); } $("#titulo-malos").scrollIntoView({ behavior: "smooth", block: "center" }); }
    }));
    const abrirReporte = () => { $("#malos").hidden = false; $("#titulo-malos").hidden = false; $("#abrir-reporte").hidden = true; };
    $("#abrir-reporte").onclick = abrirReporte;
    const alternar = (caja, conjunto) => $$(`#${caja} button`).forEach((b) => (b.onclick = () => {
      conjunto.has(b.dataset.k) ? conjunto.delete(b.dataset.k) : conjunto.add(b.dataset.k);
      b.classList.toggle("on", conjunto.has(b.dataset.k));
    }));
    alternar("buenos", buenos); alternar("malos", malos);
    $("#calificar").onclick = async () => {
      if (seguro === null) { $("#seguro").classList.add("falta"); setTimeout(() => $("#seguro").classList.remove("falta"), 600); return aviso("Dinos si te sentiste seguro en el viaje"); }
      $("#calificar").disabled = true;
      await addDoc(collection(db, "resenas"), {
        motoUid: c.motoUid, motoNombre: c.motoNombre, carreraId: c.id,
        clienteUid: usuario.uid, clienteNombre: cliente.nombre,
        estrellas: puntos, comentario: $("#comentario").value.trim(), aprobada: false, fecha: serverTimestamp(),
        seguro, buenos: [...buenos], malos: [...malos],
      });
      await updateDoc(doc(db, "carreras", c.id), { calificada: true });
      aviso(seguro ? "¡Gracias por calificar!" : "Gracias por avisarnos. El administrador revisará tu reporte.");
      ir("motorizados");
    };
    $("#omitir").onclick = async () => { await updateDoc(doc(db, "carreras", c.id), { calificada: true }); ir("motorizados"); };
  }

  // ---------- Seguimiento en vivo: widget flotante y aviso en la barra de notificaciones ----------
  const seguimiento = { id: null, motoUid: null, quitar: null, quitarChat: null, sinLeer: 0, ubic: null, info: null, memoria: {}, alMover: null, ultimoAviso: "", rastro: [], movido: 0 };
  const avisosPosibles = () => "Notification" in window && "serviceWorker" in navigator;

  async function pedirPermisoAvisos() {
    if (!avisosPosibles() || Notification.permission !== "default") return;
    try { await Notification.requestPermission(); } catch {}
  }

  const notificarCarrera = (...a) => notificar(...a);
  async function notificar(titulo, cuerpo, { sonar = false } = {}) {
    if (sonar) sonarAlerta();
    if (!avisosPosibles() || Notification.permission !== "granted") return;
    const reg = (await registroSw) || (await navigator.serviceWorker.ready.catch(() => null));
    if (!reg) return;
    const clave = titulo + cuerpo;
    if (clave === seguimiento.ultimoAviso && !sonar) return;
    if (!sonar) seguimiento.ultimoAviso = clave;
    // Las alertas (aceptó, llegó, terminó, mensaje) van aparte para que la actualización silenciosa del recorrido no las tape.
    reg.showNotification(titulo, {
      body: cuerpo, tag: sonar ? "whereapp-alerta" : "whereapp-carrera", renotify: sonar, silent: !sonar, requireInteraction: sonar,
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
      Object.assign(seguimiento, { id: null, motoUid: null, quitar: null, quitarChat: null, sinLeer: 0, ubic: null, info: null, memoria: {}, rastro: [], movido: 0 });
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
      // Solo suena si se vio el cambio en vivo (no cada vez que se abre la app con la carrera ya aceptada).
      if (antes && antes.id === c.id && antes.estado === "esperando") notificar(`¡${c.motoNombre.split(" ")[0]} aceptó tu carrera!`, `${c.motoMoto || "Moto"}${c.motoPlaca ? ` · Placa ${c.motoPlaca}` : ""}`, { sonar: true });
    }
    if (c && c.estado === "terminada" && antes && antes.estado === "aceptada") {
      notificar("¡Llegaste a tu destino!", `Toca para calificar a ${c.motoNombre.split(" ")[0]}`, { sonar: true });
    }
    if (!c) cerrarNotificacion();
    refrescarVivo();
  }

  // Recalcula cuánto falta y lo muestra en el widget, en "Mi carrera" y en la barra de notificaciones.
  // Cada 20 s se repinta el estado (para que "detenido hace X min" avance aunque la moto no mande ubicación).
  setInterval(() => { if (rutaActual === "carrera" && seguimiento.alMover) refrescarVivo(); }, 20000);
  function refrescarVivo() {
    const c = carreraActual();
    const w = $("#widget");
    if (!c || (c.estado !== "aceptada" && c.estado !== "esperando")) { w.hidden = true; document.body.classList.remove("con-widget"); return; }
    if (c.estado === "aceptada") {
      // Si el motorizado ya recogió, la memoria del tramo A se reinicia para el tramo B.
      if (seguimiento.memoria.recogido !== !!c.recogido) seguimiento.memoria = { recogido: !!c.recogido };
      seguimiento.info = progreso(c, seguimiento.ubic, seguimiento.memoria);
      afinarEta(c, seguimiento.ubic, seguimiento.memoria, refrescarVivo);
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
