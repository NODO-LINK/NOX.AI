// Whereapp — panel de administración: motorizados, cuotas, carreras, reseñas, tarifas y números.

import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, increment, writeBatch, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, authSecundaria, db, NOMBRE, icono, transicion, activarBarra, correoDe, $, $$, esc, usd, fecha, fechaTexto, estrellas, habilitado,
  leerTarifas, aviso, avisoSinConfigurar,
} from "./comun.js";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  let subs = [], ruta = "motos", tarifas = null;
  let motos = [], carreras = [], resenas = [], pagos = [], llamadas = {}, visitas = {}, cedulas = {};
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
        <label for="usuario">Usuario</label><input id="usuario" autocomplete="username" autocapitalize="none">
        <label for="clave">Clave</label><input id="clave" type="password" autocomplete="current-password">
        <button class="boton">Entrar</button></form></div>`;
    $("#login").onsubmit = async (e) => {
      e.preventDefault();
      try { await signInWithEmailAndPassword(auth, correoDe($("#usuario").value), $("#clave").value); }
      catch { aviso("Usuario o clave incorrectos"); }
    };
  }

  async function arrancar() {
    $("#cabecera").hidden = false; $("#barra").hidden = false;
    $("#cabecera").innerHTML = `<div class="dentro"><div><div class="logo">${NOMBRE}</div><div class="logo-sub">Administración</div></div>
      <div class="derecha"><button class="boton secundario chico" id="salir">Salir</button></div></div>`;
    $("#salir").onclick = () => signOut(auth);
    $$("#barra button").forEach((b) => (b.onclick = () => ir(b.dataset.ruta)));
    tarifas = await leerTarifas();

    const escuchar = (q, fn) => subs.push(onSnapshot(q, (s) => { fn(s); refrescar(); }, (e) => console.error(e)));
    escuchar(collection(db, "motorizados"), (s) => { motos = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.nombre.localeCompare(b.nombre)); });
    escuchar(query(collection(db, "carreras"), orderBy("creada", "desc"), limit(100)), (s) => { carreras = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(query(collection(db, "resenas"), orderBy("fecha", "desc"), limit(100)), (s) => { resenas = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(query(collection(db, "pagos"), orderBy("fecha", "desc"), limit(500)), (s) => { pagos = s.docs.map((d) => ({ id: d.id, ...d.data() })); });
    escuchar(collection(db, "llamadas"), (s) => { llamadas = Object.fromEntries(s.docs.map((d) => [d.id, d.data().n || 0])); });
    escuchar(collection(db, "clientes"), (s) => { cedulas = Object.fromEntries(s.docs.map((d) => [d.id, d.data().cedula])); });
    escuchar(doc(db, "stats", "visitas"), (s) => { visitas = s.exists() ? s.data() : {}; });
    ir("motos");
  }

  // Cada snapshot redibuja la pestaña abierta, salvo que se esté escribiendo en un formulario.
  function refrescar() {
    $("#punto-motos").hidden = !porVencer().length;
    $("#punto-resenas").hidden = !resenas.some((r) => !r.aprobada);
    const foco = document.activeElement;
    if (foco && /INPUT|TEXTAREA|SELECT/.test(foco.tagName) && $("#vista").contains(foco)) return;
    if (!$(".modal")) ir(ruta, true);
  }

  function ir(r, quieto) {
    ruta = r;
    activarBarra(r);
    const y = window.scrollY;
    ({ motos: vistaMotos, carreras: vistaCarreras, resenas: vistaResenas, tarifas: vistaTarifas, stats: vistaStats })[r]();
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
  const estadoPago = (m) => {
    const d = diasRestantes(m);
    if (d <= 0) return `<span class="pildora mal">Vencido</span>`;
    if (d <= 3) return `<span class="pildora alerta">Vence en ${d} día${d === 1 ? "" : "s"}</span>`;
    return `<span class="pildora ok">Pagado</span>`;
  };

  function vistaMotos() {
    const avisos = porVencer();
    $("#vista").innerHTML = `
      ${avisos.length ? `<h1 class="titulo">${icono("alerta")} Cuotas por vencer o vencidas</h1><div class="lista">${avisos.map((m) => `
        <article class="tarjeta"><div class="info"><h3>${esc(m.nombre)}</h3><p>${estadoPago(m)} · hasta ${fechaTexto(m.pagadoHasta)}</p></div>
          <div class="acciones">
            <a class="boton verde" href="https://wa.me/${telWa(m.telefono)}?text=${encodeURIComponent(mensajeCobro(m))}" target="_blank" rel="noopener">Avisar por WhatsApp</a>
            <button class="boton" data-pago="${m.id}">Registrar pago ${usd(tarifas.cuota)}</button></div>
        </article>`).join("")}</div>` : ""}
      <h1 class="titulo">Motorizados (${motos.length}) · ${motos.filter(habilitado).length} saliendo en la app</h1>
      <button class="boton" id="nuevo">+ Agregar motorizado</button>
      <div class="lista" style="margin-top:12px">${motos.map((m) => `
        <article class="tarjeta"><div class="info">
          <h3>${esc(m.nombre)} ${habilitado(m) ? `<span class="pildora ok">En la app</span>` : `<span class="pildora mal">No sale</span>`}</h3>
          <p>Usuario: <b>${esc(m.usuario)}</b> · ${icono("telefono")} ${esc(m.telefono)}</p>
          <p>${icono("moto")} ${esc(m.moto)} · Placa ${esc(m.placa)} · <span class="rating">${estrellas(m)}</span></p>
          <p>${estadoPago(m)} hasta ${fechaTexto(m.pagadoHasta)} · ${llamadas[m.id] || 0} llamadas</p></div>
          <div class="acciones">
            <button class="boton ${m.activo ? "peligro" : "verde"}" data-activo="${m.id}">${m.activo ? "Desactivar" : "Activar"}</button>
            <button class="boton secundario" data-pago="${m.id}">Pago ${usd(tarifas.cuota)}</button>
            <button class="boton secundario" data-editar="${m.id}">Editar</button></div>
        </article>`).join("") || `<div class="vacio">${icono("moto")}Aún no hay motorizados.</div>`}</div>`;
    $("#nuevo").onclick = () => formularioMoto();
    $$("[data-activo]").forEach((b) => (b.onclick = () => {
      const m = motos.find((x) => x.id === b.dataset.activo);
      updateDoc(doc(db, "motorizados", m.id), { activo: !m.activo });
    }));
    $$("[data-pago]").forEach((b) => (b.onclick = () => registrarPago(motos.find((x) => x.id === b.dataset.pago))));
    $$("[data-editar]").forEach((b) => (b.onclick = () => formularioMoto(motos.find((x) => x.id === b.dataset.editar))));
  }

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
      <label class="opcion" style="margin-top:12px"><input type="checkbox" name="pagado" checked> Ya pagó la primera quincena</label>`}
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
          const usuario = v.usuario.trim().toLowerCase();
          if (motos.some((x) => x.usuario === usuario)) throw new Error("Ese usuario ya existe");
          // Se usa una segunda conexión para crear la cuenta sin cerrar la sesión del admin.
          const authSeg = authSecundaria();
          const cred = await createUserWithEmailAndPassword(authSeg, correoDe(usuario), v.clave);
          await signOut(authSeg);
          const pagado = v.pagado === "on";
          await setDoc(doc(db, "motorizados", cred.user.uid), {
            ...datos, usuario, activo: false, ratingSum: 0, ratingCount: 0, creado: serverTimestamp(),
            pagadoHasta: Timestamp.fromDate(new Date(Date.now() + (pagado ? tarifas.diasCuota * DIA : 0))),
          });
          if (pagado) await addDoc(collection(db, "pagos"), { motoUid: cred.user.uid, nombre: datos.nombre, monto: tarifas.cuota, fecha: serverTimestamp() });
          aviso("Motorizado creado. Actívalo cuando esté de turno.");
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
          <p>A: ${esc(c.origen?.dir)} ${icono("flecha")} B: ${esc(c.destino?.dir)}</p>
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
      <div class="caja"><h2>${icono("paquete")} Delivery</h2><div class="dos">
        <div><label>Base ($)</label><input name="db" type="number" step="0.01" min="0" value="${t.delivery.base}"></div>
        <div><label>Por km ($)</label><input name="dk" type="number" step="0.01" min="0" value="${t.delivery.porKm}"></div></div></div>
      <div class="caja"><h2>${icono("moto")} Mototaxi</h2><div class="dos">
        <div><label>Base ($)</label><input name="mb" type="number" step="0.01" min="0" value="${t.mototaxi.base}"></div>
        <div><label>Por km ($)</label><input name="mk" type="number" step="0.01" min="0" value="${t.mototaxi.porKm}"></div></div></div>
      <div class="caja"><h2>${icono("tarjeta")} Cuota de motorizados</h2><div class="dos">
        <div><label>Monto ($)</label><input name="cuota" type="number" step="0.01" min="0" value="${t.cuota}"></div>
        <div><label>Cada cuántos días</label><input name="dias" type="number" step="1" min="1" value="${t.diasCuota}"></div></div></div>
      <button class="boton">Guardar tarifas</button></form>`;
    $("#tarifas").onsubmit = async (e) => {
      e.preventDefault();
      const v = Object.fromEntries([...new FormData(e.target)].map(([k, x]) => [k, Number(x)]));
      tarifas = { delivery: { base: v.db, porKm: v.dk }, mototaxi: { base: v.mb, porKm: v.mk }, cuota: v.cuota, diasCuota: v.dias };
      await setDoc(doc(db, "config", "general"), tarifas);
      document.activeElement?.blur();
      aviso("Tarifas guardadas");
    };
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
