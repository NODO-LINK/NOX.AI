// MojánYa — arma toda la app a partir de datos.js.
// Normalmente no hace falta tocar este archivo.

(() => {
  const D = window.APP;
  const M = D.marca;
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const guardado = {
    get(k, def) { try { const v = localStorage.getItem("mojanya." + k); return v ? JSON.parse(v) : def; } catch { return def; } },
    set(k, v) { try { localStorage.setItem("mojanya." + k, JSON.stringify(v)); } catch {} },
  };

  const usd = (n) => "$" + Number(n).toFixed(2);
  const bs = (n) => "Bs " + (Number(n) * D.tasaBs).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const comercio = (id) => D.comercios.find((c) => c.id === id);
  const categoria = (id) => D.categorias.find((c) => c.id === id) || { icono: "🏪", nombre: "" };
  const zona = (id) => D.zonas.find((z) => z.id === id);
  const pago = (id) => D.pagos.find((p) => p.id === id);

  // ---------- Horario de la central ----------
  const minutos = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  function centralAbierta() {
    const ahora = new Date();
    const m = ahora.getHours() * 60 + ahora.getMinutes();
    const a = minutos(D.horario.abre), c = minutos(D.horario.cierra);
    return a <= c ? m >= a && m < c : m >= a || m < c; // permite horarios que pasan la medianoche
  }

  // ---------- Carrito (un comercio por pedido) ----------
  let carrito = guardado.get("carrito", { comercio: null, items: {} });
  const cliente = guardado.get("cliente", {});
  const guardarCarrito = () => { guardado.set("carrito", carrito); contador(); };
  const lineas = () => {
    const c = comercio(carrito.comercio);
    if (!c) return [];
    return Object.entries(carrito.items)
      .map(([id, cant]) => ({ p: c.productos.find((p) => p.id === id), cant }))
      .filter((l) => l.p && l.cant > 0);
  };
  const subtotal = () => lineas().reduce((s, l) => s + l.p.precio * l.cant, 0);
  const unidades = () => lineas().reduce((s, l) => s + l.cant, 0);

  function cambiar(comercioId, prodId, delta) {
    if (carrito.comercio && carrito.comercio !== comercioId && unidades() > 0) {
      if (!confirm("Tu carrito tiene productos de otro comercio. ¿Vaciarlo y empezar uno nuevo?")) return;
      carrito = { comercio: null, items: {} };
    }
    carrito.comercio = comercioId;
    const n = Math.max(0, (carrito.items[prodId] || 0) + delta);
    if (n) carrito.items[prodId] = n; else delete carrito.items[prodId];
    if (!Object.keys(carrito.items).length) carrito.comercio = null;
    guardarCarrito();
  }

  function contador() {
    const n = unidades(), b = $("#contador");
    b.hidden = !n;
    b.textContent = n;
  }

  // ---------- Avisos, WhatsApp, pedidos guardados ----------
  let temporizador;
  function aviso(texto) {
    const a = $("#aviso");
    a.textContent = texto;
    a.classList.add("ver");
    clearTimeout(temporizador);
    temporizador = setTimeout(() => a.classList.remove("ver"), 2600);
  }
  const abrirWhatsApp = (texto) => window.open(`https://wa.me/${M.whatsapp}?text=${encodeURIComponent(texto)}`, "_blank");
  function guardarPedido(tipo, titulo, resumen, total) {
    const pedidos = guardado.get("pedidos", []);
    pedidos.unshift({ tipo, titulo, resumen, total, fecha: new Date().toISOString() });
    guardado.set("pedidos", pedidos.slice(0, 30));
  }

  // ---------- Ubicación (enlace de Google Maps para el motorizado) ----------
  let ubicacion = null;
  function pedirUbicacion(el) {
    if (!navigator.geolocation) { el.textContent = "Tu teléfono no permite compartir la ubicación."; return; }
    el.textContent = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ubicacion = `https://maps.google.com/?q=${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
        el.innerHTML = `✅ Ubicación agregada al pedido`;
      },
      () => { el.textContent = "No se pudo obtener la ubicación. Escribe bien la dirección y un punto de referencia."; },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // ---------- Partes comunes ----------
  function cabecera({ titulo, sub, atras } = {}) {
    const abierta = centralAbierta();
    $("#cabecera").innerHTML = `<div class="dentro">
      ${atras ? `<button class="atras" aria-label="Volver" onclick="history.length > 1 ? history.back() : location.hash = '#/'">←</button>` : ""}
      <div><div class="logo">${esc(titulo || M.nombre)}</div><div class="sub">${esc(sub ?? M.eslogan)}</div></div>
      <span class="estado">${abierta ? "🟢 Motorizados activos" : "🔴 Cerrado"}</span>
    </div>`;
  }

  const fotoComercio = (c) =>
    `<div class="foto">${c.imagen ? `<img src="${esc(c.imagen)}" alt="" loading="lazy">` : categoria(c.categoria).icono}</div>`;

  const camposCliente = () => `
    <label for="nombre">Tu nombre</label>
    <input id="nombre" autocomplete="name" value="${esc(cliente.nombre)}" required>
    <label for="telefono">Teléfono</label>
    <input id="telefono" type="tel" autocomplete="tel" value="${esc(cliente.telefono)}" placeholder="0414-0000000" required>
    <label for="zona">Zona de entrega</label>
    <select id="zona">${D.zonas.map((z) => `<option value="${z.id}" ${z.id === cliente.zona ? "selected" : ""}>${esc(z.nombre)} — ${usd(z.costo)}</option>`).join("")}</select>
    <label for="direccion">Dirección y punto de referencia</label>
    <textarea id="direccion" placeholder="Calle, casa, color de la casa, al lado de…" required>${esc(cliente.direccion)}</textarea>
    <p class="ubicacion"><button type="button" class="enlace" id="btn-ubicacion">📍 Agregar mi ubicación actual</button></p>`;

  const camposPago = () => `
    <div class="opciones">${D.pagos.map((p, i) => `
      <label class="opcion"><input type="radio" name="pago" value="${p.id}" ${(cliente.pago ? p.id === cliente.pago : i === 0) ? "checked" : ""}>
      <span>${esc(p.nombre)}${p.detalle ? `<small>${esc(p.detalle)}</small>` : ""}</span></label>`).join("")}
    </div>`;

  function leerCliente() {
    const datos = {
      nombre: $("#nombre").value.trim(),
      telefono: $("#telefono").value.trim(),
      zona: $("#zona").value,
      direccion: $("#direccion").value.trim(),
      pago: ($("input[name=pago]:checked") || {}).value,
    };
    if (!datos.nombre || !datos.telefono || !datos.direccion) { aviso("Completa tu nombre, teléfono y dirección"); return null; }
    Object.assign(cliente, datos);
    guardado.set("cliente", cliente);
    return datos;
  }

  const textoCliente = (d) => [
    `👤 ${d.nombre} · ${d.telefono}`,
    `📍 ${zona(d.zona).nombre}`,
    `🏠 ${d.direccion}`,
    ubicacion ? `🗺️ ${ubicacion}` : "",
  ].filter(Boolean).join("\n");

  const avisoCerrado = () => centralAbierta() ? "" :
    `<p class="nota">⚠️ Ahora mismo estamos cerrados (horario ${D.horario.abre}–${D.horario.cierra}). Puedes enviar tu pedido y te respondemos al abrir.</p>`;

  // ---------- Vistas ----------
  let filtroCat = null, busqueda = "";

  function vistaInicio() {
    cabecera();
    const v = $("#vista");
    v.innerHTML = `
      <div class="buscador"><input id="buscar" type="search" placeholder="¿Qué se te antoja hoy?" value="${esc(busqueda)}"></div>
      <div class="categorias">${D.categorias.map((c) =>
        `<button class="cat ${c.id === filtroCat ? "activa" : ""}" data-cat="${c.id}"><span>${c.icono}</span>${esc(c.nombre)}</button>`).join("")}
      </div>
      <a class="banner" href="#/mandado"><span class="emoji">🛵</span><span><b>${esc(D.mandados.titulo)}</b><small>Te buscamos y llevamos lo que sea</small></span></a>
      <h2 class="titulo">Comercios</h2>
      <div class="lista" id="lista"></div>
      <a class="banner" href="#/motorizados" style="margin-top:20px"><span class="emoji">🏍️</span><span><b>${esc(D.motorizados.titulo)}</b><small>Gana dinero haciendo entregas</small></span></a>`;

    const pintar = () => {
      const q = busqueda.toLowerCase();
      const lista = D.comercios
        .filter((c) => !filtroCat || c.categoria === filtroCat)
        .filter((c) => !q || [c.nombre, c.descripcion, ...c.productos.map((p) => p.nombre)].join(" ").toLowerCase().includes(q))
        .sort((a, b) => b.abierto - a.abierto);
      $("#lista").innerHTML = lista.length ? lista.map((c) => `
        <a class="comercio ${c.abierto ? "" : "cerrado"}" href="#/comercio/${c.id}">
          ${fotoComercio(c)}
          <div><h3>${esc(c.nombre)}</h3><p>${esc(c.descripcion)}</p>
            <div class="chips"><span class="chip ${c.abierto ? "ok" : "no"}">${c.abierto ? "● Abierto" : "Cerrado"}</span>
            <span class="chip">⏱ ${esc(c.tiempo)} min</span></div></div>
        </a>`).join("") : `<div class="vacio"><span>🔎</span>No encontramos comercios con esa búsqueda.</div>`;
    };
    pintar();
    $("#buscar").addEventListener("input", (e) => { busqueda = e.target.value; pintar(); });
    v.querySelectorAll(".cat").forEach((b) => b.addEventListener("click", () => {
      filtroCat = filtroCat === b.dataset.cat ? null : b.dataset.cat;
      v.querySelectorAll(".cat").forEach((x) => x.classList.toggle("activa", x.dataset.cat === filtroCat));
      pintar();
    }));
  }

  function vistaComercio(id) {
    const c = comercio(id);
    if (!c) { location.hash = "#/"; return; }
    cabecera({ titulo: c.nombre, sub: categoria(c.categoria).nombre, atras: true });
    const secciones = [...new Set(c.productos.map((p) => p.seccion || "Productos"))];
    const v = $("#vista");

    const pintar = () => {
      const enCarrito = carrito.comercio === c.id ? carrito.items : {};
      v.innerHTML = `
        <div class="portada">${fotoComercio(c)}<div><h1>${esc(c.nombre)}</h1><p>${esc(c.descripcion)}</p>
          <div class="chips"><span class="chip ${c.abierto ? "ok" : "no"}">${c.abierto ? "● Abierto" : "Cerrado"}</span><span class="chip">⏱ ${esc(c.tiempo)} min</span></div></div></div>
        ${c.abierto ? "" : `<p class="nota">Este comercio está cerrado ahora. Puedes ver el menú, pero no hacer pedidos.</p>`}
        ${secciones.map((s) => `<h2 class="seccion">${esc(s)}</h2>` +
          c.productos.filter((p) => (p.seccion || "Productos") === s).map((p) => {
            const n = enCarrito[p.id] || 0;
            return `<div class="producto"><div class="info"><h3>${esc(p.nombre)}</h3>${p.detalle ? `<p>${esc(p.detalle)}</p>` : ""}
              <div class="precio">${usd(p.precio)} <small>${bs(p.precio)}</small></div></div>
              ${c.abierto ? `<div class="cantidad">${n ? `<button class="menos" data-p="${p.id}" data-d="-1" aria-label="Quitar">−</button><b>${n}</b>` : ""}
              <button data-p="${p.id}" data-d="1" aria-label="Agregar">+</button></div>` : ""}</div>`;
          }).join("")).join("")}
        ${carrito.comercio === c.id && unidades() ? `<a class="flotante" href="#/carrito"><span>Ver carrito (${unidades()})</span><span>${usd(subtotal())}</span></a>` : ""}`;
      v.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => {
        cambiar(c.id, b.dataset.p, Number(b.dataset.d));
        pintar();
      }));
    };
    pintar();
  }

  function vistaCarrito() {
    cabecera({ titulo: "Tu carrito", sub: "", atras: false });
    const v = $("#vista");
    const c = comercio(carrito.comercio);
    if (!c || !unidades()) {
      v.innerHTML = `<div class="vacio"><span>🛍️</span>Tu carrito está vacío.<br><a class="boton" href="#/">Ver comercios</a></div>`;
      return;
    }
    ubicacion = null;
    v.innerHTML = `
      <div class="caja"><h2>${esc(c.nombre)}</h2>
        ${lineas().map((l) => `<div class="producto"><div class="info"><h3>${esc(l.p.nombre)}</h3><div class="precio">${usd(l.p.precio * l.cant)}</div></div>
          <div class="cantidad"><button class="menos" data-p="${l.p.id}" data-d="-1">−</button><b>${l.cant}</b><button data-p="${l.p.id}" data-d="1">+</button></div></div>`).join("")}
        <label for="nota">Nota para el comercio (opcional)</label>
        <textarea id="nota" placeholder="Sin cebolla, salsa aparte…"></textarea>
      </div>
      <div class="caja"><h2>Entrega</h2>${camposCliente()}</div>
      <div class="caja"><h2>Forma de pago</h2>${camposPago()}</div>
      <div class="caja" id="totales"></div>
      ${avisoCerrado()}
      <button class="boton wa" id="enviar">Enviar pedido por WhatsApp</button>
      <p class="nota">Al enviar se abre WhatsApp con tu pedido listo. La central te confirma el monto y el tiempo de entrega.</p>`;

    const totales = () => {
      const z = zona($("#zona").value), st = subtotal(), t = st + z.costo;
      $("#totales").innerHTML = `
        <div class="fila"><span>Productos</span><span>${usd(st)}</span></div>
        <div class="fila"><span>Delivery</span><span>${usd(z.costo)}</span></div>
        <div class="fila total"><span>Total</span><span>${usd(t)}<div class="bs">${bs(t)}</div></span></div>
        <p class="nota">Tasa: Bs ${D.tasaBs.toLocaleString("es-VE")} por dólar</p>`;
      return t;
    };
    totales();
    $("#zona").addEventListener("change", totales);
    $("#btn-ubicacion").addEventListener("click", (e) => pedirUbicacion(e.target.parentNode));
    v.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => {
      const nota = $("#nota").value;
      leerSinValidar();
      cambiar(c.id, b.dataset.p, Number(b.dataset.d));
      vistaCarrito();
      if ($("#nota")) $("#nota").value = nota;
    }));
    $("#enviar").addEventListener("click", () => {
      const d = leerCliente();
      if (!d) return;
      const t = totales(), z = zona(d.zona), nota = $("#nota").value.trim();
      const detalle = lineas().map((l) => `• ${l.cant} x ${l.p.nombre} — ${usd(l.p.precio * l.cant)}`).join("\n");
      const texto = [
        `🛵 *NUEVO PEDIDO — ${M.nombre}*`,
        `🏪 *${c.nombre}*`,
        detalle,
        nota ? `📝 ${nota}` : "",
        "",
        `Productos: ${usd(subtotal())}`,
        `Delivery: ${usd(z.costo)}`,
        `*Total: ${usd(t)} (${bs(t)})*`,
        `💳 ${pago(d.pago).nombre}`,
        "",
        textoCliente(d),
      ].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n");
      guardarPedido("comercio", c.nombre, detalle, t);
      abrirWhatsApp(texto);
      carrito = { comercio: null, items: {} };
      guardarCarrito();
      location.hash = "#/pedidos";
      aviso("¡Pedido listo! Envíalo en WhatsApp");
    });
  }

  // Guarda lo escrito en el formulario aunque falten datos (para no perderlo al redibujar).
  function leerSinValidar() {
    if (!$("#nombre")) return;
    Object.assign(cliente, {
      nombre: $("#nombre").value, telefono: $("#telefono").value, zona: $("#zona").value,
      direccion: $("#direccion").value, pago: ($("input[name=pago]:checked") || {}).value,
    });
    guardado.set("cliente", cliente);
  }

  function vistaMandado() {
    cabecera({ titulo: "Mandados", sub: "Encomiendas y compras" });
    ubicacion = null;
    const v = $("#vista");
    v.innerHTML = `
      <div class="banner"><span class="emoji">🛵</span><span><b>¿Qué necesitas?</b><small>${esc(D.mandados.texto)}</small></span></div>
      <div class="caja"><h2>El mandado</h2>
        <label for="que">¿Qué hay que buscar, comprar o llevar?</label>
        <textarea id="que" placeholder="Ej.: buscar un paquete y llevarlo a…  /  comprar 2 kg de queso en…"></textarea>
        <label for="donde">¿Dónde se busca?</label>
        <input id="donde" placeholder="Dirección o nombre del lugar">
        <label><input type="checkbox" id="adelanto" style="width:auto"> El motorizado debe pagar la compra (te la cobramos al entregar)</label>
      </div>
      <div class="caja"><h2>¿A dónde se lleva?</h2>${camposCliente()}</div>
      <div class="caja"><h2>Forma de pago</h2>${camposPago()}</div>
      <div class="caja" id="totales"></div>
      ${avisoCerrado()}
      <button class="boton wa" id="enviar">Pedir motorizado por WhatsApp</button>`;
    const totales = () => {
      const z = zona($("#zona").value);
      $("#totales").innerHTML = `<div class="fila total"><span>Costo del mandado</span><span>${usd(z.costo)}<div class="bs">${bs(z.costo)}</div></span></div>
        <p class="nota">Si el motorizado paga una compra por ti, ese monto se suma al total.</p>`;
    };
    totales();
    $("#zona").addEventListener("change", totales);
    $("#btn-ubicacion").addEventListener("click", (e) => pedirUbicacion(e.target.parentNode));
    $("#enviar").addEventListener("click", () => {
      const que = $("#que").value.trim(), donde = $("#donde").value.trim();
      if (!que || !donde) { aviso("Cuéntanos qué hay que buscar y dónde"); return; }
      const d = leerCliente();
      if (!d) return;
      const z = zona(d.zona);
      const texto = [
        `🛵 *MANDADO — ${M.nombre}*`,
        `📦 ${que}`,
        `📌 Buscar en: ${donde}`,
        $("#adelanto").checked ? "💵 El motorizado debe pagar la compra" : "",
        `Costo del mandado: ${usd(z.costo)} (${bs(z.costo)})`,
        `💳 ${pago(d.pago).nombre}`,
        "",
        "*Entregar a:*",
        textoCliente(d),
      ].filter(Boolean).join("\n");
      guardarPedido("mandado", "Mandado", `${que}\nBuscar en: ${donde}`, z.costo);
      abrirWhatsApp(texto);
      location.hash = "#/pedidos";
      aviso("¡Mandado listo! Envíalo en WhatsApp");
    });
  }

  function vistaPedidos() {
    cabecera({ titulo: "Mis pedidos", sub: "Guardados en este teléfono" });
    const pedidos = guardado.get("pedidos", []);
    $("#vista").innerHTML = pedidos.length ? pedidos.map((p) => `
      <article class="pedido"><header><span>${p.tipo === "mandado" ? "🛵" : "🏪"} ${esc(p.titulo)}</span><span>${usd(p.total)}</span></header>
        <p>${esc(new Date(p.fecha).toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" }))}</p>
        <p>${esc(p.resumen)}</p></article>`).join("") +
      `<button class="boton secundario" id="whatsapp">Preguntar por mi pedido</button>`
      : `<div class="vacio"><span>🧾</span>Todavía no has hecho pedidos.<br><a class="boton" href="#/">Pedir ahora</a></div>`;
    const b = $("#whatsapp");
    if (b) b.addEventListener("click", () => abrirWhatsApp(`Hola ${M.nombre}, quiero saber cómo va mi pedido.`));
  }

  function vistaMotorizados() {
    cabecera({ titulo: "Trabaja con nosotros", sub: "Motorizados", atras: true });
    $("#vista").innerHTML = `
      <div class="banner"><span class="emoji">🏍️</span><span><b>${esc(D.motorizados.titulo)}</b><small>Llena tus datos y te contactamos</small></span></div>
      <div class="caja"><h2>Requisitos</h2><ul class="requisitos">${D.motorizados.requisitos.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>
      <div class="caja"><h2>Tus datos</h2>
        <label for="m-nombre">Nombre completo</label><input id="m-nombre">
        <label for="m-cedula">Cédula</label><input id="m-cedula" inputmode="numeric">
        <label for="m-tel">Teléfono</label><input id="m-tel" type="tel">
        <label for="m-moto">Moto (marca, modelo y año)</label><input id="m-moto">
        <label for="m-sector">¿En qué sector vives?</label><input id="m-sector">
      </div>
      <button class="boton wa" id="enviar">Enviar solicitud por WhatsApp</button>`;
    $("#enviar").addEventListener("click", () => {
      const val = (id) => $("#" + id).value.trim();
      if (!val("m-nombre") || !val("m-tel") || !val("m-moto")) { aviso("Completa nombre, teléfono y moto"); return; }
      abrirWhatsApp([
        `🏍️ *Quiero trabajar como motorizado en ${M.nombre}*`,
        `Nombre: ${val("m-nombre")}`, `Cédula: ${val("m-cedula")}`, `Teléfono: ${val("m-tel")}`,
        `Moto: ${val("m-moto")}`, `Sector: ${val("m-sector")}`,
      ].join("\n"));
    });
  }

  // ---------- Rutas ----------
  function ir() {
    const [, ruta = "", param] = (location.hash || "#/").split("/");
    const nombre = ruta || "inicio";
    document.querySelectorAll("#barra a").forEach((a) => a.classList.toggle("activo", a.dataset.ruta === nombre || (nombre === "comercio" && a.dataset.ruta === "inicio")));
    ({ inicio: vistaInicio, comercio: () => vistaComercio(decodeURIComponent(param || "")), carrito: vistaCarrito,
       mandado: vistaMandado, pedidos: vistaPedidos, motorizados: vistaMotorizados }[nombre] || vistaInicio)();
    window.scrollTo(0, 0);
  }

  document.title = `${M.nombre} — ${M.eslogan}`;
  window.addEventListener("hashchange", ir);
  contador();
  ir();
})();
