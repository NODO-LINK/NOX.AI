// Whereapp — página pública de seguimiento: el amigo del cliente ve en vivo cuánto falta para llegar.
// Se abre con seguir.html?c=<id de la carrera>. El id es largo y al azar, así que solo lo conoce quien recibe el enlace.

import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { fecha, auth, db, NOMBRE, $, esc, icono, ICONOS, nuevoMapa, marcarRecorrido, filasRecorrido, progreso, afinarEta, transicion, avisoSinConfigurar } from "./comun.js?v=61";

if (!avisoSinConfigurar()) iniciar();

function iniciar() {
  const L = window.L;
  const id = new URLSearchParams(location.search).get("c");
  let carrera = null, ubic = null, memoria = {}, quitarMoto = null, empezado = false;
  let mapa = null, marcaMoto = null, ultimaVista = "", limites = null;

  $("#cabecera").hidden = false;
  $("#cabecera").innerHTML = `<div class="dentro"><div><div class="logo">${NOMBRE}</div><div class="logo-sub">Seguimiento en vivo</div></div>
    <div class="derecha"><span class="pildora ok">En vivo</span></div></div>`;

  if (!id || !/^[A-Za-z0-9_-]{6,40}$/.test(id)) return mensaje("cerrar", "Enlace incompleto", "Pídele a tu amigo que te lo comparta otra vez.");
  mensaje("reloj", "Cargando la carrera…", "");

  onAuthStateChanged(auth, (u) => {
    if (!u) { signInAnonymously(auth).catch(() => mensaje("alerta", "No se pudo abrir el seguimiento", "Revisa tu internet e intenta de nuevo.")); return; }
    if (empezado) return;
    empezado = true;
    onSnapshot(doc(db, "carreras", id), (s) => {
      if (!s.exists()) return mensaje("cerrar", "Esta carrera no existe", "Puede que el enlace esté incompleto.");
      carrera = { id: s.id, ...s.data() };
      if (carrera.estado === "aceptada" && carrera.motoUid) seguirMoto(carrera.motoUid);
      else if (quitarMoto) { quitarMoto(); quitarMoto = null; }
      pintar();
    }, () => mensaje(carrera ? "check" : "alerta", carrera ? "El viaje terminó" : "No se pudo abrir el seguimiento",
      carrera ? "Este enlace ya no está disponible." : "Puede que el enlace ya no sea válido (dura 24 horas)."));
  });

  function seguirMoto(uid) {
    if (quitarMoto) return;
    // La posición en vivo está en "ubicaciones"; la de la ficha del motorizado sirve mientras tanto.
    let vivo = null, ficha = null;
    const elegir = () => { ubic = vivo && (!ficha || (fecha(vivo.t) || 0) >= (fecha(ficha.t) || 0)) ? vivo : ficha; pintar(); };
    const q1 = onSnapshot(doc(db, "motorizados", uid), (s) => { ficha = (s.data() && s.data().ubicacion) || null; elegir(); });
    const q2 = onSnapshot(doc(db, "ubicaciones", uid), (s) => { vivo = s.exists() ? s.data() : null; elegir(); }, () => {});
    quitarMoto = () => { q1(); q2(); };
  }

  function pie() { return `<div class="seguir-pie"><a class="boton secundario chico" href="./">${icono("moto")} ¿Necesitas una moto? Pide en ${NOMBRE}</a></div>`; }
  const primerNombre = (n) => String(n || "").split(" ")[0];

  function mensaje(ico, titulo, texto, extra = "") {
    if (mapa) { mapa.remove(); mapa = null; marcaMoto = null; }
    ultimaVista = "";
    $("#vista").innerHTML = `<div class="estado-carrera"><div class="grande ${ico === "moto" ? "latido" : ""}">${icono(ico)}</div>
      <h2>${esc(titulo)}</h2>${texto ? `<p class="nota">${esc(texto)}</p>` : ""}</div>${extra}${pie()}`;
    transicion();
  }

  function pintar() {
    const c = carrera;
    const quien = primerNombre(c.clienteNombre);
    if (c.estado === "esperando") return mensaje("moto", `Buscando motorizado para ${quien}…`, "Esta página se actualiza sola.");
    if (c.estado === "cancelada") return mensaje("cerrar", "Esta carrera fue cancelada", "");
    if (c.estado === "terminada") return mensaje("listo", `¡${quien} llegó a su destino!`, `Gracias por usar ${NOMBRE}.`);

    // En curso: se dibuja una vez y luego solo se actualizan la tarjeta y la moto en el mapa.
    if (memoria.recogido !== !!c.recogido) memoria = { recogido: !!c.recogido };
    const info = progreso(c, ubic, memoria, quien);
    afinarEta(c, ubic, memoria, () => carrera && pintar());
    const vista = `${c.id}-${c.motoUid}-${!!c.recogido}`;
    if (vista !== ultimaVista) {
      ultimaVista = vista;
      if (mapa) { mapa.remove(); mapa = null; marcaMoto = null; }
      $("#vista").innerHTML = `
        <p class="nota" style="margin-top:16px">Estás siguiendo ${c.tipo === "mototaxi" ? "el viaje" : "el pedido"} de <b>${esc(quien)}</b></p>
        <div class="vivo" id="vivo"></div>
        <article class="tarjeta">
          <div class="avatar">${esc(primerNombre(c.motoNombre).slice(0, 1).toUpperCase())}</div>
          <div class="info"><h3>${esc(c.motoNombre)}</h3>
            <p>${icono("moto")} ${esc(c.motoMoto || "")}${c.motoPlaca ? ` · Placa <b>${esc(c.motoPlaca)}</b>` : ""}</p></div>
        </article>
        <div class="mapa" id="mapa"></div>
        <div class="caja">
          ${filasRecorrido(c)}
        </div>${pie()}`;
      transicion();
      mapa = nuevoMapa("mapa");
      limites = marcarRecorrido(mapa, c);
      mapa.fitBounds(limites.pad(0.3), { animate: false });
    }
    $("#vivo").innerHTML = `
      <div class="vivo-cabeza"><span class="vivo-punto"></span>En vivo</div>
      <h2>${esc(info.titulo)}</h2>
      <div class="vivo-tiempo">${info.llego ? "¡Está afuera!" : info.min == null ? icono("reloj") : info.min === 0 ? "¡Ya llega!" : `${info.min}<small> min</small>`}</div>
      <p class="nota">${esc(info.detalle)}</p>
      <div class="pista"><i class="letra-a">A</i><div class="carril"><b style="width:${info.pct}%"></b><span class="moto-pista" style="left:${info.pct}%">${icono("moto")}</span></div><i class="letra-b">B</i></div>`;
    if (ubic && mapa) {
      if (!marcaMoto) {
        marcaMoto = L.marker([ubic.lat, ubic.lng], { icon: ICONOS.moto }).addTo(mapa);
        mapa.fitBounds(L.latLngBounds([limites.getSouthWest(), limites.getNorthEast(), [ubic.lat, ubic.lng]]).pad(0.3), { animate: false });
      } else marcaMoto.setLatLng([ubic.lat, ubic.lng]);
    }
  }
}
