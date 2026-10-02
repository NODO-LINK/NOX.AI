// Spot — arma todas las páginas a partir de datos.js.
// Normalmente no hace falta tocar este archivo.

(() => {
  const D = window.SPOT;
  const M = D.marca;
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const guardado = {
    get(k) { try { return localStorage.getItem("spot." + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem("spot." + k, v); } catch {} },
  };

  // ---------- Idioma ----------
  // Al entrar se usa el idioma del móvil; el botón ES / EN lo cambia y se recuerda.
  let idioma = guardado.get("idioma") || ((navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es");
  const tx = (v) => (v && typeof v === "object" ? v[idioma] ?? v.es ?? "" : v ?? "");

  const TEXTOS = {
    catalogo: { es: "Catálogo", en: "Catalog" },
    nosotros: { es: "Nosotros", en: "About" },
    envios: { es: "Envíos", en: "Shipping" },
    recienLlegado: { es: "Recién llegado", en: "New in" },
    verCatalogo: { es: "Ver catálogo", en: "View catalog" },
    todos: { es: "Todos", en: "All" },
    tipo: { es: "Tipo", en: "Type" },
    coleccion: { es: "Colección", en: "Collection" },
    genero: { es: "Género", en: "Gender" },
    sinResultados: { es: "No hay prendas con estos filtros.", en: "No items match these filters." },
    color: { es: "Color", en: "Color" },
    detalles: { es: "Detalles", en: "Details" },
    cuidado: { es: "Cuidado de la prenda", en: "Garment care" },
    enviosTitulo: { es: "Envíos a todo el país", en: "Nationwide shipping" },
    enviosTexto: { es: "Consulta tiempos y formas de envío.", en: "Check shipping times and methods." },
    masInfo: { es: "Más información", en: "Learn more" },
    preguntar: { es: "Preguntar por WhatsApp", en: "Ask on WhatsApp" },
    compartir: { es: "Compartir", en: "Share" },
    enlaceCopiado: { es: "Enlace copiado", en: "Link copied" },
    otrasPrendas: { es: "También te puede gustar", en: "You may also like" },
    volver: { es: "← Volver al catálogo", en: "← Back to catalog" },
    noEncontrada: { es: "Esta prenda no existe o ya no está disponible.", en: "This item doesn't exist or is no longer available." },
    mensajeWa: {
      es: "Hola Spot, me interesa la prenda «{p}». ¿Me das más información?",
      en: "Hi Spot, I'm interested in «{p}». Could you give me more information?",
    },
    qrTitulo: { es: "Código QR", en: "QR code" },
    qrTexto: { es: "Escanéalo para abrir el catálogo de Spot.", en: "Scan it to open the Spot catalog." },
    qrDescargar: { es: "Descargar QR", en: "Download QR" },
    qrSinUrl: {
      es: "Aún no hay dirección pública. Cuando el sitio esté publicado, pon su dirección en «url» dentro de datos.js. Mientras tanto, el QR apunta a esta página.",
      en: "There's no public address yet. Once the site is published, set its address in «url» in datos.js. Until then, the QR points to this page.",
    },
    etiquetas: {
      nuevo: { es: "Nuevo", en: "New" },
      agotado: { es: "Agotado", en: "Sold out" },
      limitada: { es: "Edición limitada", en: "Limited edition" },
      proximamente: { es: "Próximamente", en: "Coming soon" },
    },
  };
  const t = (clave) => tx(TEXTOS[clave]);

  // ---------- Utilidades ----------
  const ICONO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>`;
  const foto = (src, alt = "") =>
    src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />` : `<div class="relleno" role="img" aria-label="${esc(alt)}">${ICONO}</div>`;
  const etiqueta = (p) => (p.etiqueta && TEXTOS.etiquetas[p.etiqueta] ? `<span class="etiqueta e-${p.etiqueta}">${esc(tx(TEXTOS.etiquetas[p.etiqueta]))}</span>` : "");
  const enlacePrenda = (p) => `prenda.html?id=${encodeURIComponent(p.id)}`;
  const urlBase = () => (M.url ? M.url.replace(/\/?$/, "/") : location.href.replace(/[^/]*([?#].*)?$/, ""));

  document.documentElement.lang = idioma;
  document.documentElement.style.setProperty("--acento", M.colorAcento || "#111");

  // ---------- Cabecera y pie (comunes) ----------
  function pintarCabecera() {
    const marca = M.logo ? `<img src="${esc(M.logo)}" alt="${esc(M.nombre)}" />` : esc(M.nombre);
    $("#cabecera").innerHTML = `
      <a class="logo" href="index.html">${marca}</a>
      <nav class="menu">
        <a href="index.html#catalogo">${t("catalogo")}</a>
        <a href="info.html?p=nosotros">${t("nosotros")}</a>
        <a href="info.html?p=envios">${t("envios")}</a>
        <button type="button" class="idioma" id="cambiarIdioma" aria-label="Cambiar idioma">${idioma === "es" ? "EN" : "ES"}</button>
      </nav>`;
    $("#cambiarIdioma").addEventListener("click", () => {
      idioma = idioma === "es" ? "en" : "es";
      guardado.set("idioma", idioma);
      location.reload();
    });
  }

  function pintarPie() {
    const redes = [
      M.instagram && `<a href="https://instagram.com/${encodeURIComponent(M.instagram)}" target="_blank" rel="noopener">Instagram</a>`,
      M.tiktok && `<a href="https://www.tiktok.com/@${encodeURIComponent(M.tiktok)}" target="_blank" rel="noopener">TikTok</a>`,
      !M.instagram && `<span class="pendiente">Instagram</span>`,
      !M.tiktok && `<span class="pendiente">TikTok</span>`,
    ].filter(Boolean).join("");
    $("#pie").innerHTML = `
      <div class="pie-marca">${esc(M.nombre)}</div>
      <div class="pie-enlaces">
        ${redes}
        <a href="info.html?p=envios">${t("envios")}</a>
        <a href="info.html?p=nosotros">${t("nosotros")}</a>
        <a href="qr.html">QR</a>
      </div>
      <div class="pie-copy">© ${new Date().getFullYear()} ${esc(M.nombre)}</div>`;
  }

  // ---------- Animaciones suaves al bajar ----------
  function animar() {
    const els = document.querySelectorAll(".aparece");
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((e) => e.classList.add("visible"));
      return;
    }
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -40px 0px" });
    els.forEach((e) => io.observe(e));
  }

  // ---------- Tarjeta de prenda (portada) ----------
  const tarjeta = (p) => `
    <a class="tarjeta aparece" href="${enlacePrenda(p)}">
      <div class="tarjeta-foto">${foto(p.colores?.[0]?.imagen, tx(p.nombre))}${etiqueta(p)}</div>
      <div class="tarjeta-info">
        <h3>${esc(tx(p.nombre))}</h3>
        <p>${esc(tx(D.tipos[p.tipo]))}</p>
        ${p.colores?.length > 1 ? `<div class="puntos">${p.colores.map((c) => `<span style="background:${esc(c.hex)}" title="${esc(tx(c.nombre))}"></span>`).join("")}</div>` : ""}
      </div>
    </a>`;

  // ---------- Página: portada ----------
  function portada() {
    const P = D.portada;
    $("#hero").innerHTML = `
      ${P.video
        ? `<video class="hero-video" autoplay muted loop playsinline ${P.poster ? `poster="${esc(P.poster)}"` : ""}><source src="${esc(P.video)}" /></video>`
        : `<div class="hero-relleno"><span>Video de portada</span></div>`}
      <div class="hero-texto">
        <p class="hero-sub">${esc(tx(P.subtitulo))}</p>
        <h1>${esc(tx(P.titulo))}</h1>
        <a class="boton-claro" href="#catalogo">${t("verCatalogo")}</a>
      </div>`;

    const nuevos = D.prendas.filter((p) => p.etiqueta === "nuevo");
    $("#nuevos-bloque").hidden = nuevos.length === 0;
    $("#nuevos").innerHTML = nuevos.map(tarjeta).join("");

    // Filtros
    const filtro = { tipo: "", coleccion: "", genero: "" };
    const grupos = [
      ["tipo", D.tipos],
      ["coleccion", D.colecciones],
      ["genero", D.generos],
    ];
    $("#filtros").innerHTML = grupos.map(([clave, lista]) => {
      const usados = Object.keys(lista).filter((k) => D.prendas.some((p) => p[clave] === k));
      return `
        <label class="filtro">
          <span>${t(clave)}</span>
          <select data-filtro="${clave}">
            <option value="">${t("todos")}</option>
            ${usados.map((k) => `<option value="${esc(k)}">${esc(tx(lista[k]))}</option>`).join("")}
          </select>
        </label>`;
    }).join("");

    function pintar() {
      const lista = D.prendas.filter((p) => Object.entries(filtro).every(([k, v]) => !v || p[k] === v));
      $("#rejilla").innerHTML = lista.map(tarjeta).join("");
      $("#vacio").hidden = lista.length > 0;
      animar();
    }
    $("#filtros").addEventListener("change", (e) => {
      const s = e.target.closest("[data-filtro]");
      if (s) { filtro[s.dataset.filtro] = s.value; pintar(); }
    });
    pintar();
  }

  // ---------- Página: ficha de prenda ----------
  function ficha() {
    const id = new URLSearchParams(location.search).get("id");
    const p = D.prendas.find((x) => x.id === id);
    if (!p) {
      $("#ficha").innerHTML = `<div class="info"><p>${t("noEncontrada")}</p><a class="boton-gris" href="index.html">${t("volver")}</a></div>`;
      return;
    }
    const nombre = tx(p.nombre);
    document.title = `${nombre} — ${M.nombre}`;
    let colorActual = 0;

    const lista = (titulo, items) =>
      items?.length ? `<section class="seccion aparece"><h2>${titulo}</h2><ul class="lista">${items.map((i) => `<li>${esc(tx(i))}</li>`).join("")}</ul></section>` : "";

    const relacionadas = D.prendas.filter((x) => x.id !== p.id && (x.tipo === p.tipo || x.coleccion === p.coleccion)).slice(0, 2);

    $("#ficha").innerHTML = `
      <div class="ficha-foto"><div class="foto-grande" id="fotoGrande"></div></div>
      <div class="ficha-info">
        <section class="ficha-cabecera">
          ${etiqueta(p)}
          <h1>${esc(nombre)}</h1>
          <p class="sub">${esc([tx(D.tipos[p.tipo]), tx(D.colecciones[p.coleccion]), tx(D.generos[p.genero])].filter(Boolean).join(" · "))}</p>
          ${p.estilo?.length ? `<div class="estilo">${p.estilo.map((e) => `<div><div class="valor">${esc(tx(e.valor))}</div><div class="rotulo">${esc(tx(e.etiqueta))}</div></div>`).join("")}</div>` : ""}
          ${p.descripcion ? `<p class="descripcion">${esc(tx(p.descripcion))}</p>` : ""}
        </section>

        ${p.colores?.length ? `
        <section class="seccion">
          <h2>${t("color")}</h2>
          <div class="colores" id="colores">${p.colores.map((c, i) => `<button type="button" data-color="${i}" style="--c:${esc(c.hex)}" aria-label="${esc(tx(c.nombre))}"></button>`).join("")}</div>
          <p class="nombre-color" id="nombreColor"></p>
        </section>` : ""}

        ${lista(t("detalles"), p.detalles)}
        ${lista(t("cuidado"), p.cuidado)}

        <section class="seccion aparece">
          <h2 class="h2-chico">${t("enviosTitulo")}</h2>
          <p class="centrado">${t("enviosTexto")}</p>
          <a class="boton-gris" href="info.html?p=envios">${t("masInfo")}</a>
        </section>

        <section class="seccion final">
          <a class="boton-principal" id="whatsapp" href="#" target="_blank" rel="noopener">${t("preguntar")}</a>
          <button type="button" class="boton-gris ancho" id="compartir">${t("compartir")}</button>
        </section>

        ${relacionadas.length ? `
        <section class="seccion aparece">
          <h2>${t("otrasPrendas")}</h2>
          <div class="relacionadas">${relacionadas.map(tarjeta).join("")}</div>
        </section>` : ""}

        <p class="volver"><a href="index.html#catalogo">${t("volver")}</a></p>
      </div>`;

    function pintarColor() {
      const c = p.colores?.[colorActual];
      $("#fotoGrande").innerHTML = foto(c?.imagen, `${nombre}${c ? ` — ${tx(c.nombre)}` : ""}`);
      if (!c) return;
      $("#nombreColor").textContent = tx(c.nombre);
      document.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("activo", Number(b.dataset.color) === colorActual));
    }
    $("#ficha").addEventListener("click", (e) => {
      const b = e.target.closest("[data-color]");
      if (b) { colorActual = Number(b.dataset.color); pintarColor(); }
    });
    pintarColor();

    // WhatsApp: mensaje general con el nombre de la prenda
    const enlace = urlBase() + enlacePrenda(p);
    const mensaje = `${tx(TEXTOS.mensajeWa).replace("{p}", nombre)}\n${enlace}`;
    const wa = $("#whatsapp");
    wa.href = `https://wa.me/${(M.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
    if (!M.whatsapp) wa.title = "Falta el número de WhatsApp en datos.js";

    $("#compartir").addEventListener("click", async () => {
      if (navigator.share) {
        try { await navigator.share({ title: `${nombre} — ${M.nombre}`, url: enlace }); } catch {}
        return;
      }
      try { await navigator.clipboard.writeText(enlace); avisar(t("enlaceCopiado")); } catch { prompt("", enlace); }
    });
  }

  // ---------- Página: Sobre nosotros / Envíos ----------
  function info() {
    const clave = new URLSearchParams(location.search).get("p");
    const pg = D.paginas[clave] || D.paginas.nosotros;
    document.title = `${tx(pg.titulo)} — ${M.nombre}`;
    $("#info").innerHTML = `
      <h1>${esc(tx(pg.titulo))}</h1>
      ${pg.imagen !== undefined ? `<div class="info-foto aparece">${foto(pg.imagen, tx(pg.titulo))}</div>` : ""}
      ${(pg.parrafos || []).map((x) => `<p class="aparece">${esc(tx(x))}</p>`).join("")}
      ${M.whatsapp ? `<a class="boton-principal" href="https://wa.me/${M.whatsapp.replace(/\D/g, "")}" target="_blank" rel="noopener">WhatsApp</a>` : ""}`;
  }

  // ---------- Página: código QR ----------
  function qr() {
    const destino = urlBase();
    const q = window.qrcode(0, "M");
    q.addData(destino);
    q.make();
    const png = q.createDataURL(10, 4);
    $("#qr").innerHTML = `
      <h1>${t("qrTitulo")}</h1>
      <p>${t("qrTexto")}</p>
      <img class="qr-img" src="${png}" alt="QR" width="300" height="300" />
      <p class="qr-url">${esc(destino)}</p>
      <a class="boton-principal" href="${png}" download="spot-qr.png">${t("qrDescargar")}</a>
      ${M.url ? "" : `<p class="nota">${t("qrSinUrl")}</p>`}`;
  }

  // ---------- Aviso breve ----------
  function avisar(msg) {
    let el = $("#aviso");
    if (!el) { el = document.createElement("div"); el.id = "aviso"; el.className = "aviso"; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("visible");
    setTimeout(() => el.classList.remove("visible"), 1800);
  }

  // ---------- Estadísticas (GoatCounter, gratis y sin cookies) ----------
  if (M.estadisticas && !/^(localhost|127\.|file)/.test(location.hostname || "file")) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.dataset.goatcounter = `https://${M.estadisticas}.goatcounter.com/count`;
    document.head.appendChild(s);
  }

  // ---------- Arranque ----------
  pintarCabecera();
  pintarPie();
  document.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
  ({ portada, prenda: ficha, info, qr })[document.body.dataset.pagina]?.();
  animar();
})();
