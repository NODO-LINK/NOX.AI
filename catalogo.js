// Lógica del catálogo. Normalmente no necesitas tocar este archivo:
// los productos y datos de la tienda están en productos.js.

(() => {
  const T = window.TIENDA;
  const P = window.PRODUCTOS.map((p, i) => ({ id: i, ...p }));
  const $ = (id) => document.getElementById(id);

  const dinero = (n) =>
    T.moneda + Number(n).toLocaleString(T.formato, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- Datos de la tienda ----------
  document.title = `${T.nombre} — Catálogo`;
  $("nombreTienda").textContent = T.nombre;
  $("pieNombre").textContent = T.nombre;
  $("eslogan").textContent = T.eslogan;
  $("pieHorario").textContent = T.horario ? `🕒 ${T.horario}` : "";
  $("pieDireccion").textContent = T.direccion ? `📍 ${T.direccion}` : "";
  if (T.instagram) {
    $("pieInstagram").innerHTML = `📸 <a href="https://instagram.com/${encodeURIComponent(T.instagram)}" target="_blank" rel="noopener">@${esc(T.instagram)}</a>`;
  }

  // ---------- Pedido (se guarda en el móvil del cliente) ----------
  const CLAVE = "spot.pedido";
  let pedido = {};
  try { pedido = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch {}
  // Quita productos que ya no existen o se agotaron
  for (const id of Object.keys(pedido)) {
    const p = P[id];
    if (!p || p.disponible === false) delete pedido[id];
  }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(pedido)); } catch {} };

  // ---------- Filtros ----------
  let categoria = "Todo";
  let texto = "";
  const categorias = ["Todo", ...new Set(P.map((p) => p.categoria).filter(Boolean))];

  function pintarCategorias() {
    $("categorias").innerHTML = categorias
      .map((c) => `<button class="chip ${c === categoria ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
  }
  $("categorias").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    categoria = b.dataset.cat;
    pintarCategorias();
    pintarProductos();
  });
  $("buscar").addEventListener("input", (e) => { texto = e.target.value.trim().toLowerCase(); pintarProductos(); });

  const media = (p) =>
    p.imagen ? `<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" />` : esc(p.emoji || "🛍️");

  function pintarProductos() {
    const normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const q = normal(texto);
    const lista = P.filter((p) => (categoria === "Todo" || p.categoria === categoria) && (!q || normal(`${p.nombre} ${p.descripcion} ${p.categoria}`).includes(q)))
      // destacados primero, agotados al final
      .sort((a, b) => (b.disponible !== false) - (a.disponible !== false) || !!b.destacado - !!a.destacado);

    $("vacio").hidden = lista.length > 0;
    $("grid").innerHTML = lista.map((p) => {
      const agotado = p.disponible === false;
      const oferta = p.precioAntes && p.precioAntes > p.precio;
      const etiqueta = agotado ? `<span class="tag out">Agotado</span>` : oferta ? `<span class="tag">Oferta</span>` : p.destacado ? `<span class="tag">Destacado</span>` : "";
      return `
        <article class="card ${agotado ? "off" : ""}">
          <div class="media">${media(p)}${etiqueta}</div>
          <div class="body">
            <h3>${esc(p.nombre)}</h3>
            <p class="desc">${esc(p.descripcion)}</p>
            <div class="price"><strong>${dinero(p.precio)}</strong>${oferta ? `<s>${dinero(p.precioAntes)}</s>` : ""}</div>
            <button class="add" data-add="${p.id}" ${agotado ? "disabled" : ""}>${agotado ? "Agotado" : "+ Agregar"}</button>
          </div>
        </article>`;
    }).join("");
  }

  $("grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    const id = b.dataset.add;
    pedido[id] = (pedido[id] || 0) + 1;
    guardar();
    pintarPedido();
    avisar(`✓ ${P[id].nombre} agregado`);
  });

  // ---------- Panel del pedido ----------
  function pintarPedido() {
    const ids = Object.keys(pedido);
    const piezas = ids.reduce((n, id) => n + pedido[id], 0);
    const total = ids.reduce((s, id) => s + P[id].precio * pedido[id], 0);

    $("contador").hidden = piezas === 0;
    $("contador").textContent = piezas;
    $("total").textContent = dinero(total);
    $("enviar").disabled = piezas === 0;

    $("lineas").innerHTML = ids.length
      ? ids.map((id) => {
          const p = P[id];
          return `
            <div class="line">
              <div class="thumb">${media(p)}</div>
              <div class="info"><b>${esc(p.nombre)}</b><span>${dinero(p.precio)} c/u</span></div>
              <div class="qty">
                <button data-menos="${id}" aria-label="Quitar uno">−</button>
                <span>${pedido[id]}</span>
                <button data-mas="${id}" aria-label="Agregar uno">+</button>
              </div>
            </div>`;
        }).join("")
      : `<p class="none">Tu pedido está vacío.<br />Agrega productos del catálogo.</p>`;
  }

  $("lineas").addEventListener("click", (e) => {
    const mas = e.target.closest("[data-mas]");
    const menos = e.target.closest("[data-menos]");
    if (mas) pedido[mas.dataset.mas]++;
    if (menos) {
      const id = menos.dataset.menos;
      if (--pedido[id] <= 0) delete pedido[id];
    }
    if (mas || menos) { guardar(); pintarPedido(); }
  });

  function abrir(si) {
    $("aviso").hidden = true;
    $("panel").classList.toggle("open", si);
    $("panel").setAttribute("aria-hidden", String(!si));
    $("fondo").hidden = !si;
  }
  $("verPedido").addEventListener("click", () => abrir(true));
  $("cerrar").addEventListener("click", () => abrir(false));
  $("fondo").addEventListener("click", () => abrir(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") abrir(false); });

  $("vaciar").addEventListener("click", () => { pedido = {}; guardar(); pintarPedido(); });

  $("enviar").addEventListener("click", () => {
    const ids = Object.keys(pedido);
    if (!ids.length) return;
    const nombre = $("clienteNombre").value.trim();
    const lineas = ids.map((id) => `• ${pedido[id]} x ${P[id].nombre} — ${dinero(P[id].precio * pedido[id])}`);
    const total = ids.reduce((s, id) => s + P[id].precio * pedido[id], 0);
    const mensaje = [
      `¡Hola ${T.nombre}! 👋${nombre ? ` Soy ${nombre}.` : ""} Quiero hacer este pedido:`,
      "",
      ...lineas,
      "",
      `*Total: ${dinero(total)}*`,
      "",
      "¿Me confirman disponibilidad y forma de entrega? Gracias.",
    ].join("\n");
    window.open(`https://wa.me/${T.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
  });

  // ---------- Aviso ----------
  let temporizador;
  function avisar(msg) {
    $("aviso").textContent = msg;
    $("aviso").hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => ($("aviso").hidden = true), 1800);
  }

  pintarCategorias();
  pintarProductos();
  pintarPedido();
})();
