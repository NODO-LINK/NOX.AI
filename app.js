// MojánYa — arma la app a partir de datos.js.
// Normalmente no hace falta tocar este archivo.

(() => {
  const D = window.APP;
  const M = D.marca;
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const activos = D.motorizados.filter((m) => m.activo);
  const sectores = [...new Set(activos.map((m) => m.sector).filter(Boolean))];
  let filtro = null;

  const sinNota = (n) => n.replace(/\s*\(.*?\)/g, "").trim();
  const iniciales = (n) => sinNota(n).split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
  const whatsapp = (m) => `https://wa.me/${m.telefono}?text=${encodeURIComponent(D.mensaje.replace("{nombre}", sinNota(m.nombre)))}`;

  $("#cabecera").innerHTML = `<div class="dentro">
    <div><div class="logo">${esc(M.nombre)}</div><div class="sub">${esc(M.eslogan)}</div></div>
    <span class="estado">${activos.length ? `🟢 ${activos.length} activo${activos.length === 1 ? "" : "s"}` : "🔴 Ninguno activo"}</span>
  </div>`;

  function pintar() {
    const lista = activos.filter((m) => !filtro || m.sector === filtro);
    $("#vista").innerHTML = `
      <h1 class="titulo">Motorizados activos</h1>
      <p class="nota">Escríbele o llama directo al motorizado que prefieras.</p>
      ${sectores.length > 1 ? `<div class="filtros">
        <button class="filtro ${filtro ? "" : "activa"}" data-s="">Todos</button>
        ${sectores.map((s) => `<button class="filtro ${s === filtro ? "activa" : ""}" data-s="${esc(s)}">${esc(s)}</button>`).join("")}
      </div>` : ""}
      <div class="lista">${lista.length ? lista.map((m) => `
        <article class="moto">
          <div class="foto">${m.foto ? `<img src="${esc(m.foto)}" alt="" loading="lazy">` : esc(iniciales(m.nombre))}</div>
          <div class="info"><h2>${esc(m.nombre)}</h2>
            <p>${m.sector ? `📍 ${esc(m.sector)}` : ""}${m.moto ? ` · 🏍️ ${esc(m.moto)}` : ""}</p>
            <span class="chip">● Disponible</span></div>
          <div class="acciones">
            <a class="btn wa" href="${esc(whatsapp(m))}" target="_blank" rel="noopener">WhatsApp</a>
            <a class="btn llamar" href="tel:+${esc(m.telefono)}">Llamar</a>
          </div>
        </article>`).join("") : `<div class="vacio"><span>🛵</span>No hay motorizados activos en este momento.<br>Intenta más tarde.</div>`}
      </div>`;
    document.querySelectorAll(".filtro").forEach((b) => b.addEventListener("click", () => { filtro = b.dataset.s || null; pintar(); }));
  }

  document.title = `${M.nombre} — ${M.eslogan}`;
  pintar();
})();
