// Whereapp — app del cliente: pedir carrera, ver motorizados, seguir la carrera y calificar.

import {
  signInAnonymously, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, db, NOMBRE, $, $$, esc, usd, fechaTexto, estrellas, promedio, habilitado, leerTarifas, precio, ruta,
  ICONOS, icono, nuevoMapa, transicion, activarBarra, progreso, compartirCarrera, aviso, elegirMotivo, MOTIVOS_CLIENTE, avisoSinConfigurar,
} from "./comun.js";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  const L = window.L;
  let usuario = null, cliente = null, tarifas = null;
  let rutaActual = "pedir", mapa = null;
  let motos = [], carreras = [], cancelarSubs = [];
  // Estado del formulario de pedido (se conserva al cambiar de pestaña).
  const pedido = { tipo: "delivery", origen: null, destino: null, dirOrigen: "", dirDestino: "", nota: "", para: null, km: null, linea: null };

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
    const cabeza = `<div class="logo">${NOMBRE}</div><div class="logo-sub">Delivery y mototaxi en El Moján</div>`;

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
    $$("#barra button").forEach((b) => (b.onclick = () => ir(b.dataset.ruta)));
    $("#widget").onclick = () => ir("carrera");
    tarifas = await leerTarifas();

    cancelarSubs.push(onSnapshot(query(collection(db, "motorizados"), where("activo", "==", true)), (s) => {
      const antes = JSON.stringify(motos.map(sinUbicacion));
      motos = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter(habilitado).sort((a, b) => promedio(b) - promedio(a) || (b.ratingCount || 0) - (a.ratingCount || 0));
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
    ir(carreraActual() ? "carrera" : "pedir");
  }

  const sinUbicacion = ({ ubicacion, ...resto }) => resto;
  const tiempo = (c) => (c.creada && c.creada.toMillis ? c.creada.toMillis() : Date.now());
  function carreraActual() {
    return carreras
      .filter((c) => c.estado === "esperando" || c.estado === "aceptada" || (c.estado === "terminada" && !c.calificada))
      .sort((a, b) => tiempo(b) - tiempo(a))[0] || null;
  }

  function ir(r) {
    rutaActual = r;
    activarBarra(r);
    if (mapa) { mapa.remove(); mapa = null; }
    seguimiento.alMover = null;
    ({ pedir: vistaPedir, motorizados: vistaMotorizados, carrera: vistaCarrera })[r]();
    refrescarVivo();
    transicion();
    window.scrollTo(0, 0);
  }

  // ---------- Pedir carrera: A y B en el mismo mapa ----------
  function vistaPedir() {
    const activa = carreraActual();
    $("#vista").innerHTML = `
      <h1 class="titulo">¿A dónde vamos?</h1>
      <div class="segmento" id="tipo">
        <button data-t="delivery">${icono("paquete")} Delivery</button><button data-t="mototaxi">${icono("moto")} Mototaxi</button>
      </div>
      ${pedido.para ? `<div class="para pildora">Para: ${esc(pedido.para.nombre)} <button id="quitar-para" aria-label="Quitar">${icono("cerrar")}</button></div>` : ""}
      <div class="mapa-pedir">
        <div class="mapa alto" id="mapa"></div>
        <div class="guia" id="guia"></div>
        <div class="mapa-botones">
          <button class="redondo" id="mi-ubicacion" aria-label="Usar mi ubicación como punto A">${icono("ubicarme")}</button>
          <button class="redondo" id="reiniciar" aria-label="Marcar de nuevo">${icono("deshacer")}</button>
        </div>
      </div>
      <div class="precio-caja" id="precio"></div>
      <label for="dir-origen"><i class="letra-a">A</i> Referencia de dónde se busca</label>
      <input id="dir-origen" placeholder="Casa, calle, al lado de…" value="${esc(pedido.dirOrigen)}">
      <label for="dir-destino"><i class="letra-b">B</i> Referencia de a dónde se lleva</label>
      <input id="dir-destino" placeholder="Casa, calle, al lado de…" value="${esc(pedido.dirDestino)}">
      <div id="caja-nota"><label for="nota">¿Qué hay que llevar?</label>
      <textarea id="nota" placeholder="Ej.: una pizza de la pizzería…, un sobre, unas compras">${esc(pedido.nota)}</textarea></div>
      <button class="boton" id="pedir" ${activa ? "disabled" : ""}>${pedido.para ? `Pedir a ${esc(pedido.para.nombre)}` : "Pedir a todos los motorizados"}</button>
      ${activa ? `<p class="nota">Ya tienes una carrera en curso. Mírala en "Mi carrera".</p>` : ""}`;

    mapa = nuevoMapa("mapa");
    let marcas = {}, linea = null;
    const pintar = () => {
      for (const p of ["origen", "destino"]) {
        if (pedido[p] && !marcas[p]) {
          marcas[p] = L.marker(pedido[p], { icon: ICONOS[p], draggable: true }).addTo(mapa);
          marcas[p].on("dragend", (e) => { pedido[p] = e.target.getLatLng(); calcular(); });
        } else if (pedido[p]) marcas[p].setLatLng(pedido[p]);
      }
      const taxi = pedido.tipo === "mototaxi";
      $("#guia").innerHTML = !pedido.origen
        ? `<i class="letra-a">A</i><span>Toca el mapa donde ${taxi ? "te buscamos" : "se busca el pedido"}</span>`
        : !pedido.destino
        ? `<i class="letra-b">B</i><span>Ahora toca a dónde ${taxi ? "vas" : "se lleva"}</span>`
        : `${icono("check")}<span>¡Listo! Arrastra A o B si quieres ajustar</span>`;
      $("#guia").classList.remove("cambia"); void $("#guia").offsetWidth; $("#guia").classList.add("cambia");
      $$("#tipo button").forEach((b) => b.classList.toggle("activo", b.dataset.t === pedido.tipo));
      $("#tipo").dataset.activo = pedido.tipo;
      $("#caja-nota").hidden = taxi;
      const t = tarifas[pedido.tipo];
      $("#precio").innerHTML = pedido.km != null
        ? `<span>${pedido.km.toFixed(1)} km</span><b>${usd(precio(tarifas, pedido.tipo, pedido.km))}</b>`
        : `<span>${usd(t.base)} + ${usd(t.porKm)} por km</span><span class="nota">Marca A y B</span>`;
      if (linea) { linea.remove(); linea = null; }
      if (pedido.linea) linea = L.polyline(pedido.linea, { color: "#7c3aed", weight: 5, opacity: .75 }).addTo(mapa);
    };
    const calcular = async () => {
      pintar();
      if (!pedido.origen || !pedido.destino) return;
      $("#precio").innerHTML = `<span>Calculando distancia…</span>`;
      const r = await ruta(pedido.origen, pedido.destino);
      if (!mapa) return;
      pedido.km = r.km; pedido.linea = r.linea;
      pintar();
      mapa.fitBounds(L.latLngBounds([pedido.origen, pedido.destino]).pad(0.35), { animate: false });
    };

    // Primer toque = A, segundo toque = B. Después se ajustan arrastrando.
    mapa.on("click", (e) => {
      if (!pedido.origen) pedido.origen = e.latlng;
      else if (!pedido.destino) pedido.destino = e.latlng;
      else return aviso("Arrastra A o B para moverlos, o toca el botón de reiniciar");
      calcular();
    });
    $("#reiniciar").onclick = () => {
      Object.values(marcas).forEach((m) => m.remove()); marcas = {};
      Object.assign(pedido, { origen: null, destino: null, km: null, linea: null });
      pintar();
    };
    $$("#tipo button").forEach((b) => (b.onclick = () => { pedido.tipo = b.dataset.t; pintar(); }));
    $("#mi-ubicacion").onclick = () => {
      if (!navigator.geolocation) return aviso("Tu teléfono no permite usar la ubicación");
      aviso("Buscando tu ubicación…");
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (!mapa) return;
          pedido.origen = L.latLng(p.coords.latitude, p.coords.longitude);
          mapa.setView(pedido.origen, 16, { animate: false });
          calcular();
        },
        () => aviso("No se pudo obtener tu ubicación"),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    };
    ["dir-origen", "dir-destino", "nota"].forEach((id) => $("#" + id).addEventListener("input", (e) => {
      pedido[{ "dir-origen": "dirOrigen", "dir-destino": "dirDestino", nota: "nota" }[id]] = e.target.value;
    }));
    const quitar = $("#quitar-para");
    if (quitar) quitar.onclick = () => { pedido.para = null; ir("pedir"); };
    if (pedido.origen && pedido.destino) mapa.fitBounds(L.latLngBounds([pedido.origen, pedido.destino]).pad(0.35), { animate: false });
    pintar();
    $("#pedir").onclick = enviarPedido;
  }

  async function enviarPedido() {
    if (carreraActual()) return aviso("Ya tienes una carrera en curso");
    if (!pedido.origen || !pedido.destino || pedido.km == null) return aviso("Marca el punto A y el punto B en el mapa");
    if (!pedido.dirOrigen.trim() || !pedido.dirDestino.trim()) return aviso("Escribe una referencia para A y para B");
    if (pedido.tipo === "delivery" && !pedido.nota.trim()) return aviso("Cuéntanos qué hay que llevar");
    $("#pedir").disabled = true;
    pedirPermisoAvisos();
    try {
      await addDoc(collection(db, "carreras"), {
        clienteUid: usuario.uid,
        clienteNombre: cliente.nombre,
        clienteTel: cliente.telefono,
        tipo: pedido.tipo,
        origen: { lat: pedido.origen.lat, lng: pedido.origen.lng, dir: pedido.dirOrigen.trim() },
        destino: { lat: pedido.destino.lat, lng: pedido.destino.lng, dir: pedido.dirDestino.trim() },
        nota: pedido.tipo === "delivery" ? pedido.nota.trim() : "",
        km: Math.round(pedido.km * 10) / 10,
        precio: precio(tarifas, pedido.tipo, pedido.km),
        estado: "esperando",
        paraMoto: pedido.para ? pedido.para.id : null,
        paraMotoNombre: pedido.para ? pedido.para.nombre : null,
        motoUid: null,
        calificada: false,
        cancelaciones: [],
        creada: serverTimestamp(),
      });
      Object.assign(pedido, { origen: null, destino: null, km: null, linea: null, dirOrigen: "", dirDestino: "", nota: "", para: null });
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
      <p class="nota">Ordenados por calificación. Llama directo o pídele una carrera.</p>
      <div class="lista">${motos.length ? motos.map((m) => `
        <article class="tarjeta">
          <div class="avatar">${esc(iniciales(m.nombre))}</div>
          <div class="info"><h3>${esc(m.nombre)}</h3>
            <p>${icono("moto")} ${esc(m.moto || "")}${m.placa ? ` · Placa ${esc(m.placa)}` : ""}</p>
            <span class="rating">${estrellas(m)}</span></div>
          <div class="acciones">
            <a class="boton secundario" href="tel:${esc(m.telefono)}" data-llamar="${m.id}">${icono("telefono")} Llamar</a>
            <button class="boton" data-pedir="${m.id}">Pedir a este</button>
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
      $("#vista").innerHTML = `<div class="vacio">${icono("ruta")}No tienes carreras en curso.<br><button class="boton" id="ir-pedir">Pedir una carrera</button></div>`;
      $("#ir-pedir").onclick = () => ir("pedir");
      return;
    }
    if (c.estado === "terminada") return vistaCalificar(c);

    const resumen = `
      <div class="caja">
        <div class="fila"><span>Servicio</span><b>${c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`}</b></div>
        <div class="fila"><span><i class="letra-a">A</i></span><span>${esc(c.origen.dir)}</span></div>
        <div class="fila"><span><i class="letra-b">B</i></span><span>${esc(c.destino.dir)}</span></div>
        ${c.nota ? `<div class="fila"><span>Llevar</span><span>${esc(c.nota)}</span></div>` : ""}
        <div class="fila"><span>Distancia</span><span>${c.km} km</span></div>
        <div class="fila"><span>Precio</span><b>${usd(c.precio)}</b></div>
        <div class="fila"><span>Pedida</span><span>${fechaTexto(c.creada)}</span></div>
      </div>`;
    const botonesExtra = `
      <div class="botones">
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
      L.marker(c.origen, { icon: ICONOS.origen }).addTo(mapa);
      L.marker(c.destino, { icon: ICONOS.destino }).addTo(mapa);
      mapa.fitBounds(L.latLngBounds([c.origen, c.destino]).pad(0.3), { animate: false });
      let marcaMoto = null, centrado = false;
      seguimiento.alMover = (info, u) => {
        if (!$("#vivo")) return;
        $("#vivo").innerHTML = tarjetaVivo(info);
        if (!u || !mapa) return;
        if (!marcaMoto) marcaMoto = L.marker([u.lat, u.lng], { icon: ICONOS.moto }).addTo(mapa);
        else marcaMoto.setLatLng([u.lat, u.lng]);
        if (!centrado) { mapa.fitBounds(L.latLngBounds([c.origen, c.destino, [u.lat, u.lng]]).pad(0.3), { animate: false }); centrado = true; }
      };
      seguimiento.alMover(seguimiento.info || progreso(c, null), seguimiento.ubic);
    }
    $("#compartir").onclick = () => compartirCarrera(c, cliente.nombre);
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
      ir("pedir");
    };
    $("#omitir").onclick = async () => { await updateDoc(doc(db, "carreras", c.id), { calificada: true }); ir("pedir"); };
  }

  // ---------- Seguimiento en vivo: widget flotante y aviso en la barra de notificaciones ----------
  const seguimiento = { id: null, motoUid: null, quitar: null, ubic: null, info: null, memoria: {}, alMover: null, ultimoAviso: "" };
  let registroSw = null;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then((r) => (registroSw = r)).catch(() => {});
  const avisosPosibles = () => "Notification" in window && "serviceWorker" in navigator;

  async function pedirPermisoAvisos() {
    if (!avisosPosibles() || Notification.permission !== "default") return;
    try { await Notification.requestPermission(); } catch {}
  }

  async function notificar(titulo, cuerpo, { sonar = false } = {}) {
    if (!avisosPosibles() || Notification.permission !== "granted") return;
    const reg = registroSw || (await navigator.serviceWorker.ready.catch(() => null));
    if (!reg) return;
    const clave = titulo + cuerpo;
    if (clave === seguimiento.ultimoAviso && !sonar) return;
    seguimiento.ultimoAviso = clave;
    reg.showNotification(titulo, {
      body: cuerpo, tag: "whereapp-carrera", renotify: sonar, silent: !sonar,
      icon: "icono.svg", badge: "icono.svg", data: { url: location.href.split("#")[0] },
      vibrate: sonar ? [200, 100, 200] : undefined,
    }).catch(() => {});
  }
  async function cerrarNotificacion() {
    const reg = registroSw || (await navigator.serviceWorker?.getRegistration?.().catch(() => null));
    if (!reg) return;
    (await reg.getNotifications({ tag: "whereapp-carrera" }).catch(() => [])).forEach((n) => n.close());
  }

  // Se llama cada vez que cambian las carreras del cliente.
  function actualizarSeguimiento(antes) {
    const c = carreraActual();
    const enCurso = c && c.estado === "aceptada";
    if (!enCurso || seguimiento.id !== c.id || seguimiento.motoUid !== c.motoUid) {
      if (seguimiento.quitar) seguimiento.quitar();
      Object.assign(seguimiento, { id: null, motoUid: null, quitar: null, ubic: null, info: null, memoria: {} });
    }
    if (enCurso && !seguimiento.id) {
      Object.assign(seguimiento, { id: c.id, motoUid: c.motoUid });
      seguimiento.quitar = onSnapshot(doc(db, "motorizados", c.motoUid), (s) => {
        seguimiento.ubic = (s.data() && s.data().ubicacion) || null;
        refrescarVivo();
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
