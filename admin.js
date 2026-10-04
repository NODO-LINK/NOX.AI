// Whereapp — panel de administración: motorizados, cuotas, carreras, reseñas, tarifas y números.

import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, increment, writeBatch, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, authSecundaria, db, NOMBRE, botonTema, botonInstalar, nuevoMapa, ICONOS, recargos, motivoEntrada, SERVICIOS, icono, transicion, activarBarra, correoDe, $, $$, esc, usd, fecha, fechaTexto, estrellas, habilitado,
  leerTarifas, aviso, avisoSinConfigurar,
} from "./comun.js?v=32";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  let subs = [], ruta = "motos", tarifas = null;
  let motos = [], carreras = [], resenas = [], pagos = [], llamadas = {}, visitas = {}, cedulas = {}, clientes = [], bloqueados = {}, notasClientes = {};
  let mapaVivo = null, marcasVivo = {}, filtroClientes = "";
  const DIA = 864e5;

  onAuthStateChanged(auth, async (u) => {
    subs.forEach((f) => f()); subs = [];
    if (!u) return pantallaEntrada();
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
      moverMapaVivo();
      return sinUbicacion(motos) !== antes;
    });
    escuchar(query(collection(db, "carreras"), orderBy("creada", "desc"), limit(100)), (s) => { carreras = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(query(collection(db, "resenas"), orderBy("fecha", "desc"), limit(100)), (s) => { resenas = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(query(collection(db, "pagos"), orderBy("fecha", "desc"), limit(500)), (s) => { pagos = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(collection(db, "llamadas"), (s) => { llamadas = Object.fromEntries(s.docs.map((d) => [d.id, d.data().n || 0])); });
    escuchar(collection(db, "clientes"), (s) => {
      clientes = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      cedulas = Object.fromEntries(clientes.map((c) => [c.id, c.cedula]));
    });
    escuchar(collection(db, "calificacionesClientes"), (s) => {
      notasClientes = {};
      s.docs.map((d) => d.data()).sort((a, b) => (fecha(b.fecha) || 0) - (fecha(a.fecha) || 0)).forEach((n) => {
        const x = (notasClientes[n.clienteUid] ??= { suma: 0, cant: 0, ultimo: null });
        x.suma += n.estrellas; x.cant++;
        if (!x.ultimo && n.comentario) x.ultimo = n;
      });
    });
    escuchar(collection(db, "bloqueados"), (s) => { bloqueados = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); });
    escuchar(doc(db, "stats", "visitas"), (s) => { visitas = s.exists() ? s.data() : {}; });
    ir("motos");
  }

  // Cada snapshot redibuja la pestaña abierta, salvo que se esté escribiendo en un formulario.
  function refrescar() {
    $("#punto-pagos").hidden = !porVencer().length;
    $("#punto-resenas").hidden = !resenas.some((r) => !r.aprobada);
    const foco = document.activeElement;
    if (foco && /INPUT|TEXTAREA|SELECT/.test(foco.tagName) && $("#vista").contains(foco)) return;
    if (!$(".modal")) ir(ruta, true);
  }

  function ir(r, quieto) {
    ruta = r;
    activarBarra(r);
    const y = window.scrollY;
    if (mapaVivo && r !== "motos") { mapaVivo.remove(); mapaVivo = null; marcasVivo = {}; }
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
  const colorMoto = (m) => (!habilitado(m) ? "#9ca3af" : m.enCarrera ? "#f59e0b" : m.deTurno === false ? "#6b7280" : "#16a34a");
  const estadoMoto = (m) => (!habilitado(m) ? "No sale en la app" : m.enCarrera ? "Carrera en curso" : m.deTurno === false ? "Descansando" : "Disponible");
  function moverMapaVivo() {
    if (!mapaVivo) return;
    const L = window.L;
    for (const m of motos) {
      const u = m.ubicacion;
      if (!u) continue;
      const icono = L.divIcon({ className: "", html: `<div class="pin" style="background:${colorMoto(m)}"><span>${esc(m.nombre.slice(0, 1).toUpperCase())}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
      const texto = `<b>${esc(m.nombre)}</b><br>${estadoMoto(m)}<br><small>${fechaTexto(u.t)}</small>`;
      if (!marcasVivo[m.id]) marcasVivo[m.id] = L.marker([u.lat, u.lng], { icon: icono }).bindPopup(texto).addTo(mapaVivo);
      else marcasVivo[m.id].setLatLng([u.lat, u.lng]).setIcon(icono).setPopupContent(texto);
    }
  }

  function vistaMotos() {
    if (mapaVivo) { mapaVivo.remove(); mapaVivo = null; marcasVivo = {}; }
    const conUbic = motos.filter((m) => m.ubicacion).length;
    $("#vista").innerHTML = `
      <h1 class="titulo">${icono("pin")} Mapa en vivo</h1>
      <div class="mapa" id="mapa-vivo"></div>
      <div class="leyenda"><span><i style="background:#16a34a"></i>Disponible</span><span><i style="background:#f59e0b"></i>En carrera</span><span><i style="background:#6b7280"></i>Descansando</span><span><i style="background:#9ca3af"></i>No sale</span></div>
      <p class="nota">${conUbic ? `Se ve la última ubicación de ${conUbic} motorizado${conUbic === 1 ? "" : "s"} (se actualiza mientras tienen carrera o la app abierta).` : "Todavía ningún motorizado ha compartido su ubicación."}</p>
      <h1 class="titulo">Motorizados (${motos.length}) · ${motos.filter(habilitado).length} saliendo en la app</h1>
      <button class="boton" id="nuevo">+ Agregar motorizado</button>
      ${motos.some((x) => x.usuario === "prueba") ? "" : `<button class="boton secundario" id="prueba">${icono("moto")} Crear motorizado de prueba</button>`}
      <div class="lista" style="margin-top:12px">${motos.map((m) => `
        <article class="tarjeta"><div class="info">
          <h3>${esc(m.nombre)} ${habilitado(m) ? `<span class="pildora ok">En la app</span>` : `<span class="pildora mal">No sale</span>`}${m.enCarrera ? ` <span class="pildora ocupado">Carrera en curso</span>` : m.deTurno === false ? ` <span class="pildora">Descansando</span>` : ""}</h3>
          <p>Usuario: <b>${esc(m.usuario)}</b> · ${icono("telefono")} ${esc(m.telefono)}</p>
          <p>${icono("moto")} ${esc(m.moto)} · Placa ${esc(m.placa)} · <span class="rating">${estrellas(m)}</span></p>
          <p>${estadoPago(m)} · ${llamadas[m.id] || 0} llamadas</p></div>
          <div class="acciones">
            <button class="boton ${m.activo ? "peligro" : "verde"}" data-activo="${m.id}">${m.activo ? "Desactivar" : "Activar"}</button>
            <button class="boton secundario" data-editar="${m.id}">Editar</button></div>
        </article>`).join("") || `<div class="vacio">${icono("moto")}Aún no hay motorizados.</div>`}</div>`;
    mapaVivo = nuevoMapa("mapa-vivo");
    moverMapaVivo();
    const puntos = motos.filter((m) => m.ubicacion).map((m) => [m.ubicacion.lat, m.ubicacion.lng]);
    if (puntos.length > 1) mapaVivo.fitBounds(window.L.latLngBounds(puntos).pad(0.3), { animate: false });
    else if (puntos.length === 1) mapaVivo.setView(puntos[0], 15, { animate: false });
    $("#nuevo").onclick = () => formularioMoto();
    if ($("#prueba")) $("#prueba").onclick = () => crearMotoPrueba($("#prueba"));
    $$("[data-activo]").forEach((b) => (b.onclick = () => {
      const m = motos.find((x) => x.id === b.dataset.activo);
      updateDoc(doc(db, "motorizados", m.id), { activo: !m.activo });
    }));
    $$("[data-editar]").forEach((b) => (b.onclick = () => formularioMoto(motos.find((x) => x.id === b.dataset.editar))));
  }

  // ---------- Pagos de la cuota ----------
  function vistaPagos() {
    const avisos = porVencer();
    const orden = [...motos].sort((a, b) => diasRestantes(a) - diasRestantes(b));
    $("#vista").innerHTML = `
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
  }
  const fechaPago = (m) => (yaPago(m) || diasRestantes(m) > 0 ? `pagado hasta ${fechaTexto(m.pagadoHasta)}` : "nunca ha pagado");

  async function registrarPago(m) {
    if (!confirm(`¿Registrar pago de ${usd(tarifas.cuota)} de ${m.nombre}? Se le suman ${tarifas.diasCuota} días.`)) return;
    const desde = new Date(Math.max(Date.now(), (fecha(m.pagadoHasta) || new Date(0)).getTime()));
    const hasta = new Date(desde.getTime() + tarifas.diasCuota * DIA);
    const lote = writeBatch(db);
    lote.update(doc(db, "motorizados", m.id), { pagadoHasta: Timestamp.fromDate(hasta) });
    lote.set(doc(collection(db, "pagos")), { motoUid: m.id, nombre: m.nombre, monto: tarifas.cuota, desde: Timestamp.fromDate(desde), hasta: Timestamp.fromDate(hasta), fecha: serverTimestamp() });
    await lote.commit();
    aviso(`Pago registrado. Pagado hasta ${fechaTexto(hasta)}`);
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
    const cred = await createUserWithEmailAndPassword(authSeg, correoDe(usuario), clave);
    await signOut(authSeg);
    await setDoc(doc(db, "motorizados", cred.user.uid), {
      ...datos, usuario, activo, ratingSum: 0, ratingCount: 0, creado: serverTimestamp(),
      pagadoHasta: Timestamp.fromDate(new Date(Date.now() + (pagado ? dias * DIA : 0))),
    });
    if (pagado && cobrar) await addDoc(collection(db, "pagos"), { motoUid: cred.user.uid, nombre: datos.nombre, monto: tarifas.cuota, fecha: serverTimestamp() });
  }

  async function crearMotoPrueba(boton) {
    boton.disabled = true;
    try {
      await crearMoto(
        { nombre: "Motorizado de Prueba", telefono: "+584140000000", moto: "Moto de prueba", placa: "PRUEBA1" },
        "prueba", "prueba123", { pagado: true, activo: true, dias: 30, cobrar: false });
      aviso("Listo: usuario «prueba», clave «prueba123». Ya sale en la app.");
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
      ${m ? `<p class="nota">Usuario: <b>${esc(m.usuario)}</b>. Para cambiar la clave, bórralo y créalo de nuevo, o cámbiala en la consola de Firebase.</p>` : `
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
      if (!confirm(`¿Eliminar a ${m.nombre}? Ya no podrá entrar ni saldrá en la app.`)) return;
      await deleteDoc(doc(db, "motorizados", m.id));
      cerrar();
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      const telefono = normalizarTel(v.telefono);
      if (!telefono) return aviso("Teléfono no válido");
      const datos = { nombre: v.nombre.trim(), telefono, moto: v.moto.trim(), placa: v.placa.trim().toUpperCase() };
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
        const cancel = [...(c.cancelaciones || []).map((x) => `${icono("moto")} ${esc(x.motoNombre)} canceló: ${esc(x.motivo)}`),
          c.cancelacion ? `${c.cancelacion.por === "admin" ? `${icono("escudo")} Admin` : `${icono("usuario")} Cliente`} canceló: ${esc(c.cancelacion.motivo)}` : ""].filter(Boolean);
        return `<article class="tarjeta"><div class="info">
          <h3>${c.tipo === "mototaxi" ? `${icono("moto")} Mototaxi` : `${icono("paquete")} Delivery`} · ${usd(c.precio)} · ${c.km} km <span class="pildora ${cl}">${tx}</span></h3>
          <p>${icono("usuario")} ${esc(c.clienteNombre)}${cedulas[c.clienteUid] ? ` · C.I. ${esc(cedulas[c.clienteUid])}` : ""} · ${esc(c.clienteTel)}</p>
          <p>${icono("moto")} ${c.motoNombre && c.motoUid ? esc(c.motoNombre) : c.paraMotoNombre ? `Pedida a ${esc(c.paraMotoNombre)}` : "—"}</p>
          <p>A: ${esc(c.origen?.dir)} ${icono("flecha")} B: ${esc(c.destino?.dir)}${c.paradas?.length ? ` · ${c.paradas.length} parada${c.paradas.length > 1 ? "s" : ""}` : ""}${c.retorno ? " · ida y vuelta" : ""}</p>
          <p>${fechaTexto(c.creada)}</p>
          ${cancel.map((x) => `<p style="color:var(--rojo)">${x}</p>`).join("")}</div>
          ${c.estado === "esperando" || c.estado === "aceptada" ? `<div class="acciones"><button class="boton peligro" data-cancelar="${c.id}">Cancelar</button></div>` : ""}
        </article>`;
      }).join("") || `<div class="vacio">${icono("ruta")}Todavía no hay carreras.</div>`}</div>`;
    $$("[data-cancelar]").forEach((b) => (b.onclick = async () => {
      const motivo = prompt("Motivo de la cancelación:");
      if (motivo === null) return;
      await updateDoc(doc(db, "carreras", b.dataset.cancelar), { estado: "cancelada", cancelacion: { por: "admin", motivo: motivo || "Sin motivo", fecha: new Date() } });
    }));
  }

  // ---------- Clientes ----------
  function vistaClientes() {
    const q = filtroClientes.toLowerCase();
    const cuenta = (uid) => carreras.filter((c) => c.clienteUid === uid).length;
    const lista = clientes
      .filter((c) => !q || [c.nombre, c.cedula, c.telefono].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (fecha(b.creado) || 0) - (fecha(a.creado) || 0));
    $("#vista").innerHTML = `
      <h1 class="titulo">Clientes (${clientes.length})</h1>
      <input id="filtro-clientes" type="search" placeholder="Buscar por nombre, cédula o teléfono" value="${esc(filtroClientes)}">
      <div class="lista" style="margin-top:12px">${lista.map((c) => {
        const b = !!bloqueados[c.cedula];
        return `<article class="tarjeta"><div class="info">
          <h3>${esc(c.nombre)} ${b ? `<span class="pildora mal">${icono("bloquear")} Bloqueado</span>` : ""}</h3>
          <p>C.I. ${esc(c.cedula || "—")} · ${icono("telefono")} ${esc(c.telefono || "—")}</p>
          <p>Desde ${fechaTexto(c.creado)} · ${cuenta(c.id)} carrera${cuenta(c.id) === 1 ? "" : "s"} recientes</p>
          ${notasClientes[c.id] ? `<p><span class="rating">${icono("estrella")} ${(notasClientes[c.id].suma / notasClientes[c.id].cant).toFixed(1)} (${notasClientes[c.id].cant})</span> según los motorizados${notasClientes[c.id].ultimo ? ` · “${esc(notasClientes[c.id].ultimo.comentario)}” — ${esc(notasClientes[c.id].ultimo.motoNombre)}` : ""}</p>` : `<p>Sin calificaciones de motorizados</p>`}</div>
          <div class="acciones">
            <a class="boton secundario" href="tel:${esc(c.telefono)}">${icono("telefono")} Llamar</a>
            <button class="boton ${b ? "verde" : "peligro"}" data-bloquear="${esc(c.cedula)}" data-nombre="${esc(c.nombre)}">${b ? "Desbloquear" : "Bloquear"}</button></div>
        </article>`;
      }).join("") || `<div class="vacio">${icono("usuario")}${q ? "Nadie coincide con la búsqueda." : "Aún no hay clientes."}</div>`}</div>
      <p class="nota">Bloquear usa la cédula: aunque el cliente vuelva a registrarse con la misma cédula, no podrá pedir carreras.</p>`;
    const f = $("#filtro-clientes");
    f.oninput = () => { filtroClientes = f.value; const pos = f.selectionStart; vistaClientes(); const n = $("#filtro-clientes"); n.focus(); n.setSelectionRange(pos, pos); };
    $$("[data-bloquear]").forEach((b) => (b.onclick = async () => {
      const ced = b.dataset.bloquear;
      if (!ced) return;
      if (bloqueados[ced]) await deleteDoc(doc(db, "bloqueados", ced));
      else if (confirm(`¿Bloquear a ${b.dataset.nombre} (C.I. ${ced})? No podrá pedir carreras.`)) await setDoc(doc(db, "bloqueados", ced), { nombre: b.dataset.nombre, fecha: serverTimestamp() });
    }));
  }

  // ---------- Reseñas ----------
  function vistaResenas() {
    const pendientes = resenas.filter((r) => !r.aprobada), aprobadas = resenas.filter((r) => r.aprobada);
    const tarjeta = (r, botones) => `<article class="tarjeta"><div class="info">
      <h3><span class="rating">${[1, 2, 3, 4, 5].map((n) => icono("estrella", n <= r.estrellas ? "" : "apagada")).join("")}</span> para ${esc(r.motoNombre)}</h3>
      ${r.comentario ? `<p>“${esc(r.comentario)}”</p>` : `<p><i>Sin comentario</i></p>`}
      <p>De ${esc(r.clienteNombre)} · ${fechaTexto(r.fecha)}</p></div>${botones}</article>`;
    $("#vista").innerHTML = `
      <h1 class="titulo">Por aprobar (${pendientes.length})</h1>
      <p class="nota">Las estrellas cuentan para el motorizado solo cuando apruebas la reseña.</p>
      <div class="lista">${pendientes.map((r) => tarjeta(r, `<div class="acciones">
        <button class="boton verde" data-aprobar="${r.id}">Aprobar</button><button class="boton peligro" data-rechazar="${r.id}">Rechazar</button></div>`)).join("")
        || `<div class="vacio">${icono("estrella")}No hay reseñas pendientes.</div>`}</div>
      <h1 class="titulo">Aprobadas</h1>
      <div class="lista">${aprobadas.map((r) => tarjeta(r, "")).join("") || `<p class="nota">Ninguna todavía.</p>`}</div>`;
    $$("[data-aprobar]").forEach((b) => (b.onclick = async () => {
      const r = resenas.find((x) => x.id === b.dataset.aprobar);
      const lote = writeBatch(db);
      lote.update(doc(db, "resenas", r.id), { aprobada: true });
      if (motos.some((m) => m.id === r.motoUid)) lote.update(doc(db, "motorizados", r.motoUid), { ratingSum: increment(r.estrellas), ratingCount: increment(1) });
      await lote.commit();
    }));
    $$("[data-rechazar]").forEach((b) => (b.onclick = () => {
      if (confirm("¿Rechazar y borrar esta reseña?")) deleteDoc(doc(db, "resenas", b.dataset.rechazar));
    }));
  }

  // ---------- Tarifas ----------
  function vistaTarifas() {
    const t = tarifas;
    $("#vista").innerHTML = `<form id="tarifas">
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
      tarifas = {
        delivery: { base: num("db"), porKm: num("dk") }, mototaxi: { base: num("mb"), porKm: num("mk") }, cuota: num("cuota"), diasCuota: num("dias") || 15,
        nocturna: { activa: fd.get("nocheActiva") === "on", desde: fd.get("nocheDesde") || "20:00", hasta: fd.get("nocheHasta") || "05:00", extra: num("nocheExtra") },
        lluvia: { activa: fd.get("lluviaActiva") === "on", extra: num("lluviaExtra") },
      };
      await setDoc(doc(db, "config", "general"), tarifas);
      document.activeElement?.blur();
      aviso("Tarifas guardadas");
      ir(ruta, true);
    };
  }

  // Pestaña "Más": tarifas y números.
  let subMas = "tarifas";
  function vistaMas() {
    $("#vista").innerHTML = `<div class="segmento" id="sub-mas" data-activo="${subMas === "tarifas" ? "delivery" : "mototaxi"}">
      <button data-s="tarifas" class="${subMas === "tarifas" ? "activo" : ""}">${icono("dolar")} Tarifas</button>
      <button data-s="stats" class="${subMas === "stats" ? "activo" : ""}">${icono("grafica")} Números</button></div><div id="sub-vista"></div>`;
    const vista = $("#vista");
    // Las vistas escriben en #vista: se les presta un contenedor y luego se pone debajo del selector.
    const real = vista.id;
    const cont = $("#sub-vista");
    vista.id = ""; cont.id = "vista";
    (subMas === "tarifas" ? vistaTarifas : vistaStats)();
    cont.id = "sub-vista"; vista.id = real;
    $$("#sub-mas button").forEach((b) => (b.onclick = () => { subMas = b.dataset.s; vistaMas(); }));
  }

  // ---------- Números ----------
  function quincena(f) {
    const mes = f.toLocaleString("es-VE", { month: "short", year: "numeric" });
    return { clave: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${f.getDate() <= 15 ? 1 : 2}`, texto: `${f.getDate() <= 15 ? "1–15" : "16–fin"} ${mes}` };
  }
  function vistaStats() {
    const dias = visitas.dias || {};
    const hoy = new Date().toISOString().slice(0, 10);
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
    $("#vista").innerHTML = `
      <h1 class="titulo">Visitas a la app</h1>
      <div class="cifras">
        <div class="cifra"><b>${dias[hoy] || 0}</b><span>Hoy</span></div>
        <div class="cifra"><b>${semana}</b><span>Últimos 7 días</span></div>
        <div class="cifra"><b>${visitas.total || 0}</b><span>En total</span></div>
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
