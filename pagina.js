// Arma la página a partir de contenido.js. Normalmente no necesitas tocar este archivo.

(() => {
  const P = window.PRODUCTO;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const ICONO_IMAGEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>`;
  const imagen = (src, alt = "") =>
    src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />` : `<div class="relleno">${ICONO_IMAGEN}</div>`;

  const boton = (b, clase = "boton-gris") =>
    !b ? "" : b.enlace
      ? `<a class="${clase}" href="${esc(b.enlace)}" target="_blank" rel="noopener">${esc(b.texto)}</a>`
      : `<button type="button" class="${clase}">${esc(b.texto)}</button>`;

  const nota = (t) => (t ? `<p class="nota">${esc(t)}</p>` : "");

  document.title = `${P.titulo} — ${window.MARCA.replace(/\s+/g, "")}`;
  $("marca").textContent = window.MARCA;

  // ---------- Galería ----------
  const fotos = P.imagenes?.length ? P.imagenes : [""];
  let actual = 0;
  function pintarGaleria() {
    $("galeria").innerHTML =
      `<div class="principal">${imagen(fotos[actual], P.titulo)}</div>` +
      (fotos.length > 1
        ? `<div class="miniaturas">${fotos.map((_, i) => `<button data-foto="${i}" class="${i === actual ? "activa" : ""}" aria-label="Imagen ${i + 1}"></button>`).join("")}</div>`
        : "");
  }
  $("galeria").addEventListener("click", (e) => {
    const b = e.target.closest("[data-foto]");
    if (b) { actual = Number(b.dataset.foto); pintarGaleria(); }
  });
  pintarGaleria();

  // ---------- Secciones ----------
  const tipos = {
    lista: (s) => `
      <h2>${esc(s.titulo)}</h2>
      <ul class="lista">${s.elementos.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      ${boton(s.boton)}`,

    destacado: (s) => `
      ${s.antetitulo ? `<p class="antetitulo">${esc(s.antetitulo)}</p>` : ""}
      <h2>${esc(s.titulo)}</h2>
      ${boton(s.boton)}
      ${nota(s.nota)}`,

    tarjetas: (s) => `
      <h2>${esc(s.titulo)}</h2>
      ${s.texto ? `<p class="intro">${esc(s.texto)}</p>` : ""}
      <div class="tarjetas">${s.tarjetas.map((t) => `
        <div class="tarjeta">
          <div class="img">${imagen(t.imagen, t.titulo)}</div>
          ${t.dato ? `<b>${esc(t.dato)}</b>` : ""}
          <span class="t">${esc(t.titulo)}</span>
          ${t.texto ? `<p>${esc(t.texto)}</p>` : ""}
        </div>`).join("")}
      </div>
      ${nota(s.nota)}
      ${boton(s.boton)}`,

    filas: (s) => `
      <h2>${esc(s.titulo)}</h2>
      <div class="filas">${s.filas.map((f) => `<div class="fila"><span>${esc(f.texto)}</span><span>${esc(f.dato)}</span></div>`).join("")}</div>
      ${nota(s.nota)}
      ${boton(s.boton)}`,

    bloques: (s) => `
      <h2>${esc(s.titulo)}</h2>
      <div class="bloques">${s.bloques.map((b) => `
        <div class="bloque"><b>${esc(b.titulo)}</b>${b.lineas.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`).join("")}
      </div>
      ${boton(s.boton)}`,

    ubicaciones: (s) => `
      <h2>${esc(s.titulo)}</h2>
      ${s.texto ? `<p class="intro">${esc(s.texto)}</p>` : ""}
      <div class="lugares">${s.lugares.map((l, i) => `
        <button type="button" class="lugar ${i === 0 ? "activo" : ""}" data-lugar>
          <b>${esc(l.nombre)}</b>
          ${(l.lineas || []).map((x) => `<p>${esc(x)}</p>`).join("")}
          ${l.extra?.length ? `<div class="extra">${l.extra.map((x) => `<p>${esc(x)}</p>`).join("")}</div>` : ""}
        </button>`).join("")}
      </div>`,
  };

  const cabecera = `
    <section class="cabecera">
      <h1>${esc(P.titulo)}</h1>
      ${P.subtitulo ? `<p class="sub">${esc(P.subtitulo)}</p>` : ""}
      ${P.datos?.length ? `<div class="datos">${P.datos.map((d) => `
        <div><div class="valor">${esc(d.valor)}<small>${esc(d.unidad)}</small></div><div class="etiqueta">${esc(d.etiqueta)}</div></div>`).join("")}
      </div>` : ""}
      ${nota(P.nota)}
    </section>`;

  const secciones = (P.secciones || [])
    .filter((s) => tipos[s.tipo])
    .map((s) => `<section class="seccion s-${s.tipo}">${tipos[s.tipo](s)}</section>`)
    .join("");

  const final = P.botonFinal || P.contacto ? `
    <section class="final">
      ${boton(P.botonFinal, "boton-azul")}
      ${P.contacto ? `<p>${esc(P.contacto.texto)}<br />${P.contacto.enlace ? `<a href="${esc(P.contacto.enlace)}">${esc(P.contacto.enlaceTexto)}</a>` : `<u>${esc(P.contacto.enlaceTexto)}</u>`}</p>` : ""}
    </section>` : "";

  $("info").innerHTML = cabecera + secciones + final;

  // Seleccionar una ubicación la resalta
  $("info").addEventListener("click", (e) => {
    const l = e.target.closest("[data-lugar]");
    if (!l) return;
    l.parentElement.querySelectorAll("[data-lugar]").forEach((x) => x.classList.toggle("activo", x === l));
  });
})();
