// Whereapp — app del cliente: pedir carrera, ver motorizados, seguir la carrera y calificar.

import {
  RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, db, NOMBRE, $, $$, esc, usd, fechaTexto, estrellas, promedio, habilitado, leerTarifas, precio, ruta,
  ICONOS, icono, nuevoMapa, transicion, activarBarra, aviso, elegirMotivo, MOTIVOS_CLIENTE, avisoSinConfigurar,
} from "./comun.js";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  const L = window.L;
  let usuario = null, cliente = null, tarifas = null;
  let rutaActual = "pedir", mapa = null;
  let motos = [], carreras = [], cancelarSubs = [];
  let motoSeguida = null;
  // Estado del formulario de pedido (se conserva al cambiar de pestaña).
  const pedido = { tipo: "delivery", origen: null, destino: null, marcando: "origen", dirOrigen: "", dirDestino: "", nota: "", para: null, km: null, linea: null };

  contarVisita();

  onAuthStateChanged(auth, async (u) => {
    cancelarSubs.forEach((f) => f()); cancelarSubs = [];
    usuario = u;
    if (!u) return pantallaEntrada();
    const s = await getDoc(doc(db, "clientes", u.uid));
    cliente = s.exists() ? s.data() : null;
    if (!cliente || !cliente.nombre) return pantallaNombre();
    arrancar();
  });

  // ---------- Entrada con teléfono ----------
  function pantallaEntrada() {
    $("#cabecera").hidden = true; $("#barra").hidden = true; document.body.classList.add("sin-barra");
    $("#vista").innerHTML = `<div class="entrada">
      <div class="logo">${NOMBRE}</div><div class="logo-sub">Delivery y mototaxi en El Moján</div>
      <div class="caja" id="paso-tel"><h2>Entra con tu teléfono</h2>
        <label for="tel">Número de teléfono</label>
        <input id="tel" type="tel" inputmode="tel" placeholder="0414-1234567" autocomplete="tel">
        <button class="boton" id="enviar-codigo">Enviarme un código por SMS</button></div>
      <div class="caja" id="paso-codigo" hidden><h2>Escribe el código</h2>
        <p class="nota" id="enviado-a"></p>
        <input id="codigo" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code">
        <button class="boton" id="confirmar">Entrar</button>
        <button class="boton secundario" id="otro-numero">Usar otro número</button></div>
      <p class="nota" style="text-align:center;margin-top:18px">¿Eres motorizado? <a href="moto.html" style="color:var(--marca);font-weight:600">Entra aquí</a></p>
    </div>`;
    const verificador = new RecaptchaVerifier(auth, "recaptcha", { size: "invisible" });
    let confirmacion = null;
    $("#enviar-codigo").onclick = async () => {
      const tel = normalizarTel($("#tel").value);
      if (!tel) return aviso("Escribe un número válido, ej. 0414-1234567");
      $("#enviar-codigo").disabled = true;
      try {
        confirmacion = await signInWithPhoneNumber(auth, tel, verificador);
        $("#paso-tel").hidden = true; $("#paso-codigo").hidden = false;
        $("#enviado-a").textContent = `Te enviamos un código al ${tel}`;
      } catch (e) {
        console.error(e);
        aviso("No se pudo enviar el SMS. Revisa el número e intenta de nuevo.");
      }
      $("#enviar-codigo").disabled = false;
    };
    $("#confirmar").onclick = async () => {
      try { await confirmacion.confirm($("#codigo").value.trim()); }
      catch { aviso("Código incorrecto"); }
    };
    $("#otro-numero").onclick = () => { $("#paso-tel").hidden = false; $("#paso-codigo").hidden = true; };
  }

  function normalizarTel(v) {
    let d = String(v).replace(/\D/g, "");
    if (d.startsWith("58")) d = d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);
    return d.length === 10 ? "+58" + d : null;
  }

  function pantallaNombre() {
    $("#vista").innerHTML = `<div class="entrada"><div class="logo">${NOMBRE}</div>
      <div class="caja"><h2>¿Cómo te llamas?</h2>
        <p class="nota">Así te verá el motorizado cuando acepte tu carrera.</p>
        <input id="nombre" autocomplete="name" placeholder="Tu nombre">
        <button class="boton" id="guardar">Continuar</button></div></div>`;
    $("#guardar").onclick = async () => {
      const nombre = $("#nombre").value.trim();
      if (!nombre) return aviso("Escribe tu nombre");
      cliente = { nombre, telefono: usuario.phoneNumber, creado: serverTimestamp() };
      await setDoc(doc(db, "clientes", usuario.uid), cliente);
      arrancar();
    };
  }

  // ---------- App ----------
  async function arrancar() {
    document.body.classList.remove("sin-barra");
    $("#cabecera").hidden = false; $("#barra").hidden = false;
    $("#cabecera").innerHTML = `<div class="dentro"><div><div class="logo">${NOMBRE}</div><div class="logo-sub">Hola, ${esc(cliente.nombre)}</div></div>
      <div class="derecha"><button class="boton secundario chico" id="salir">Salir</button></div></div>`;
    $("#salir").onclick = () => signOut(auth);
    $$("#barra button").forEach((b) => (b.onclick = () => ir(b.dataset.ruta)));
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
    if (motoSeguida) { motoSeguida(); motoSeguida = null; }
    ({ pedir: vistaPedir, motorizados: vistaMotorizados, carrera: vistaCarrera })[r]();
    transicion();
    window.scrollTo(0, 0);
  }

  // ---------- Pedir carrera ----------
  function vistaPedir() {
    const activa = carreraActual();
    $("#vista").innerHTML = `
      <h1 class="titulo">¿A dónde vamos?</h1>
      <div class="segmento" id="tipo">
        <button data-t="delivery">${icono("paquete")} Delivery</button><button data-t="mototaxi">${icono("moto")} Mototaxi</button>
      </div>
      ${pedido.para ? `<div class="para pildora">Para: ${esc(pedido.para.nombre)} <button id="quitar-para" aria-label="Quitar">${icono("cerrar")}</button></div>` : ""}
      <button class="punto" data-p="origen"><span class="letra" style="background:#16a34a">A</span>
        <span><b>${pedido.tipo === "mototaxi" ? "¿Dónde te buscamos?" : "¿Dónde se busca?"}</b><small id="txt-origen">${pedido.origen ? "Marcado en el mapa" : "Toca aquí y luego en el mapa"}</small></span></button>
      <button class="punto" data-p="destino"><span class="letra" style="background:#7c3aed">B</span>
        <span><b>¿A dónde se lleva?</b><small id="txt-destino">${pedido.destino ? "Marcado en el mapa" : "Toca aquí y luego en el mapa"}</small></span></button>
      <button class="boton secundario chico" id="mi-ubicacion" style="margin-top:8px">${icono("ubicarme")} Usar mi ubicación como punto A</button>
      <div class="mapa" id="mapa"></div>
      <div class="precio-caja" id="precio"></div>
      <label for="dir-origen">Referencia del punto A</label>
      <input id="dir-origen" placeholder="Casa, calle, al lado de…" value="${esc(pedido.dirOrigen)}">
      <label for="dir-destino">Referencia del punto B</label>
      <input id="dir-destino" placeholder="Casa, calle, al lado de…" value="${esc(pedido.dirDestino)}">
      <div id="caja-nota"><label for="nota">¿Qué hay que llevar?</label>
      <textarea id="nota" placeholder="Ej.: una pizza de la pizzería…, un sobre, unas compras">${esc(pedido.nota)}</textarea></div>
      <button class="boton" id="pedir" ${activa ? "disabled" : ""}>${pedido.para ? `Pedir a ${esc(pedido.para.nombre)}` : "Pedir a todos los motorizados"}</button>
      ${activa ? `<p class="nota">Ya tienes una carrera en curso. Mírala en "Mi carrera".</p>` : ""}`;

    mapa = nuevoMapa("mapa");
    const marcas = {};
    let linea = null;
    const pintar = () => {
      for (const p of ["origen", "destino"]) {
        if (pedido[p] && !marcas[p]) {
          marcas[p] = L.marker(pedido[p], { icon: ICONOS[p], draggable: true }).addTo(mapa);
          marcas[p].on("dragend", (e) => { pedido[p] = e.target.getLatLng(); calcular(); });
        } else if (pedido[p]) marcas[p].setLatLng(pedido[p]);
      }
      $$(".punto").forEach((b) => b.classList.toggle("activo", b.dataset.p === pedido.marcando));
      $$("#tipo button").forEach((b) => b.classList.toggle("activo", b.dataset.t === pedido.tipo));
      $("#tipo").dataset.activo = pedido.tipo;
      $("#caja-nota").hidden = pedido.tipo !== "delivery";
      $("#txt-origen").textContent = pedido.origen ? "Marcado en el mapa (puedes arrastrarlo)" : "Toca aquí y luego en el mapa";
      $("#txt-destino").textContent = pedido.destino ? "Marcado en el mapa (puedes arrastrarlo)" : "Toca aquí y luego en el mapa";
      const t = tarifas[pedido.tipo];
      $("#precio").innerHTML = pedido.km != null
        ? `<span>${pedido.km.toFixed(1)} km</span><b>${usd(precio(tarifas, pedido.tipo, pedido.km))}</b>`
        : `<span>${usd(t.base)} + ${usd(t.porKm)} por km</span><span class="nota">Marca A y B</span>`;
      if (linea) { linea.remove(); linea = null; }
      if (pedido.linea) linea = L.polyline(pedido.linea, { color: "#7c3aed", weight: 5, opacity: .7 }).addTo(mapa);
    };
    const calcular = async () => {
      pintar();
      if (!pedido.origen || !pedido.destino) return;
      $("#precio").innerHTML = `<span>Calculando distancia…</span>`;
      const r = await ruta(pedido.origen, pedido.destino);
      pedido.km = r.km; pedido.linea = r.linea;
      pintar();
      mapa.fitBounds(L.latLngBounds([pedido.origen, pedido.destino]).pad(0.3), { animate: false });
    };

    mapa.on("click", (e) => {
      pedido[pedido.marcando] = e.latlng;
      if (pedido.marcando === "origen" && !pedido.destino) pedido.marcando = "destino";
      calcular();
    });
    $$(".punto").forEach((b) => (b.onclick = () => { pedido.marcando = b.dataset.p; pintar(); }));
    $$("#tipo button").forEach((b) => (b.onclick = () => { pedido.tipo = b.dataset.t; pintar(); }));
    $("#mi-ubicacion").onclick = () => {
      if (!navigator.geolocation) return aviso("Tu teléfono no permite usar la ubicación");
      aviso("Buscando tu ubicación…");
      navigator.geolocation.getCurrentPosition(
        (p) => {
          pedido.origen = L.latLng(p.coords.latitude, p.coords.longitude);
          if (!pedido.destino) pedido.marcando = "destino";
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
    if (pedido.origen && pedido.destino) mapa.fitBounds(L.latLngBounds([pedido.origen, pedido.destino]).pad(0.3), { animate: false });
    pintar();
    $("#pedir").onclick = enviarPedido;
  }

  async function enviarPedido() {
    if (carreraActual()) return aviso("Ya tienes una carrera en curso");
    if (!pedido.origen || !pedido.destino || pedido.km == null) return aviso("Marca el punto A y el punto B en el mapa");
    if (!pedido.dirOrigen.trim() || !pedido.dirDestino.trim()) return aviso("Escribe una referencia para A y para B");
    if (pedido.tipo === "delivery" && !pedido.nota.trim()) return aviso("Cuéntanos qué hay que llevar");
    $("#pedir").disabled = true;
    try {
      await addDoc(collection(db, "carreras"), {
        clienteUid: usuario.uid,
        clienteNombre: cliente.nombre,
        clienteTel: cliente.telefono || usuario.phoneNumber,
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
      Object.assign(pedido, { origen: null, destino: null, km: null, linea: null, dirOrigen: "", dirDestino: "", nota: "", para: null, marcando: "origen" });
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
    if (motoSeguida) { motoSeguida(); motoSeguida = null; }
    if (mapa) { mapa.remove(); mapa = null; }
    if (!c) {
      $("#vista").innerHTML = `<div class="vacio">${icono("ruta")}No tienes carreras en curso.<br><button class="boton" id="ir-pedir">Pedir una carrera</button></div>`;
      $("#ir-pedir").onclick = () => ir("pedir");
      return;
    }
    if (c.estado === "terminada") return vistaCalificar(c);

    const resumen = `
      <div class="caja">
        <div class="fila"><span>Servicio</span><b>${c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`}</b></div>
        <div class="fila"><span>A</span><span>${esc(c.origen.dir)}</span></div>
        <div class="fila"><span>B</span><span>${esc(c.destino.dir)}</span></div>
        ${c.nota ? `<div class="fila"><span>Llevar</span><span>${esc(c.nota)}</span></div>` : ""}
        <div class="fila"><span>Distancia</span><span>${c.km} km</span></div>
        <div class="fila"><span>Precio</span><b>${usd(c.precio)}</b></div>
        <div class="fila"><span>Pedida</span><span>${fechaTexto(c.creada)}</span></div>
      </div>`;

    if (c.estado === "esperando") {
      $("#vista").innerHTML = `
        <div class="estado-carrera"><div class="grande latido">${icono("moto")}</div>
          <h2>${c.paraMoto ? `Esperando a que ${esc(c.paraMotoNombre)} acepte…` : "Buscando motorizado…"}</h2>
          <p class="nota">Te avisamos apenas un motorizado acepte. Puedes dejar esta pantalla abierta.</p></div>
        ${resumen}
        <button class="boton peligro" id="cancelar">Cancelar carrera</button>`;
    } else {
      const m = motos.find((x) => x.id === c.motoUid) || {};
      $("#vista").innerHTML = `
        <div class="estado-carrera"><div class="grande">${icono("moto")}</div><h2>${esc(c.motoNombre)} viene en camino</h2></div>
        <article class="tarjeta">
          <div class="avatar">${esc(iniciales(c.motoNombre || "?"))}</div>
          <div class="info"><h3>${esc(c.motoNombre)}</h3>
            <p>${icono("moto")} ${esc(c.motoMoto || "")}${c.motoPlaca ? ` · Placa <b>${esc(c.motoPlaca)}</b>` : ""}</p>
            ${m.ratingCount ? `<span class="rating">${estrellas(m)}</span>` : ""}</div>
          <div class="acciones"><a class="boton" href="tel:${esc(c.motoTel)}">${icono("telefono")} Llamar a ${esc(c.motoNombre)}</a></div>
        </article>
        <div class="mapa" id="mapa"></div>
        <p class="nota" id="ubic-moto">Esperando la ubicación del motorizado…</p>
        ${resumen}
        <button class="boton peligro" id="cancelar">Cancelar carrera</button>`;
      mapa = nuevoMapa("mapa");
      L.marker(c.origen, { icon: ICONOS.origen }).addTo(mapa);
      L.marker(c.destino, { icon: ICONOS.destino }).addTo(mapa);
      mapa.fitBounds(L.latLngBounds([c.origen, c.destino]).pad(0.3), { animate: false });
      let marcaMoto = null, centrado = false;
      motoSeguida = onSnapshot(doc(db, "motorizados", c.motoUid), (s) => {
        const u = s.data() && s.data().ubicacion;
        if (!u || !mapa) return;
        if (!marcaMoto) marcaMoto = L.marker([u.lat, u.lng], { icon: ICONOS.moto }).addTo(mapa);
        else marcaMoto.setLatLng([u.lat, u.lng]);
        if (!centrado) { mapa.fitBounds(L.latLngBounds([c.origen, c.destino, [u.lat, u.lng]]).pad(0.3), { animate: false }); centrado = true; }
        $("#ubic-moto").textContent = `Ubicación del motorizado actualizada: ${fechaTexto(u.t)}`;
      });
    }
    $("#cancelar").onclick = async () => {
      const motivo = await elegirMotivo("¿Por qué cancelas?", MOTIVOS_CLIENTE);
      if (!motivo) return;
      await updateDoc(doc(db, "carreras", c.id), { estado: "cancelada", cancelacion: { por: "cliente", motivo, fecha: new Date() } });
      aviso("Carrera cancelada");
    };
  }

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

  function contarVisita() {
    try { if (sessionStorage.getItem("whereapp.visita")) return; sessionStorage.setItem("whereapp.visita", "1"); } catch {}
    const hoy = new Date().toISOString().slice(0, 10);
    setDoc(doc(db, "stats", "visitas"), { total: increment(1), dias: { [hoy]: increment(1) } }, { merge: true }).catch(() => {});
  }
}
