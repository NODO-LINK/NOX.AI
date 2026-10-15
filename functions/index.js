// Whereapp — avisos push (llegan aunque la app esté cerrada).
// Se suben a Firebase con: npx firebase-tools deploy --only functions --project giftcard-aecf0
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 5 });
const db = admin.firestore();
const PAGINA = "https://nodo-link.github.io/NOX.AI/";
const usd = (n) => "$" + Number(n || 0).toFixed(2);
const nombre1 = (n) => String(n || "").split(" ")[0];

// Envía un aviso a las personas (uids) que tienen un token guardado. Borra los tokens que ya no sirven.
async function avisar(uids, { titulo, cuerpo, url, tag, urgente = true }) {
  uids = [...new Set(uids.filter(Boolean))];
  if (!uids.length) return;
  const docs = await db.getAll(...uids.map((u) => db.doc(`tokens/${u}`)));
  const conToken = docs.filter((d) => d.exists && d.get("t"));
  if (!conToken.length) return;
  const r = await admin.messaging().sendEachForMulticast({
    tokens: conToken.map((d) => d.get("t")),
    data: { titulo, cuerpo, url, tag, urgente: urgente ? "1" : "" },
    webpush: { headers: { Urgency: "high", TTL: "600" } },
    android: { priority: "high" },
  });
  await Promise.all(r.responses.map((x, i) => {
    const codigo = x.error && x.error.code;
    if (codigo === "messaging/registration-token-not-registered" || codigo === "messaging/invalid-registration-token") return conToken[i].ref.delete();
    return null;
  }));
}

// Carrera nueva: a los motorizados de turno (o solo al que el cliente eligió).
exports.carreraNueva = onDocumentCreated("carreras/{id}", async (e) => {
  const c = e.data && e.data.data();
  if (!c || c.estado !== "esperando") return;
  let uids;
  if (c.paraMoto) uids = [c.paraMoto];
  else {
    const s = await db.collection("motorizados").where("activo", "==", true).get();
    const ahora = Date.now();
    uids = s.docs.filter((d) => {
      const m = d.data();
      return m.deTurno !== false && !m.enCarrera && m.pagadoHasta && m.pagadoHasta.toMillis() > ahora;
    }).map((d) => d.id);
  }
  const ruta = `${(c.origen && c.origen.dir) || ""} → ${(c.destino && c.destino.dir) || ""}`;
  await avisar(uids, {
    titulo: c.paraMoto ? "🏍️ ¡Un cliente te pidió a ti!" : c.negocio ? `🛒 Pedido de ${c.negocio.nombre}` : "🏍️ ¡Carrera nueva!",
    cuerpo: `${usd(c.precio)} · ${c.km || 0} km\n${ruta}`,
    url: PAGINA + "moto.html", tag: "carrera-" + e.params.id,
  });
});

// Cambios de la carrera: aceptó, llegó, terminó (al cliente) y canceló (al motorizado).
exports.carreraCambio = onDocumentUpdated("carreras/{id}", async (e) => {
  const a = e.data.before.data(), c = e.data.after.data();
  if (!a || !c) return;
  const alCliente = (titulo, cuerpo) => avisar([c.clienteUid], { titulo, cuerpo, url: PAGINA, tag: "whereapp-alerta" });
  const quien = nombre1(c.motoNombre) || "Tu motorizado";
  if (a.estado === "esperando" && c.estado === "aceptada")
    return alCliente(`¡${quien} aceptó tu ${c.negocio ? "pedido" : "carrera"}!`, `${c.motoMoto || "Moto"}${c.motoPlaca ? ` · Placa ${c.motoPlaca}` : ""}`);
  if (!a.llegoEn && c.llegoEn && !c.recogido)
    return alCliente(`¡${quien} llegó!`, c.negocio ? `Está en ${c.negocio.nombre} retirando tu pedido` : "Está afuera esperándote");
  if (a.estado === "aceptada" && c.estado === "terminada")
    return alCliente("¡Llegaste!", `Toca para calificar a ${quien}`);
  if (a.estado === "aceptada" && c.estado === "cancelada" && a.motoUid)
    return avisar([a.motoUid], { titulo: "❌ Carrera cancelada", cuerpo: `${c.cancelacion && c.cancelacion.por === "admin" ? "El administrador" : "El cliente"} canceló la carrera`, url: PAGINA + "moto.html", tag: "whereapp-moto" });
  return null;
});

// Mensaje del chat: al otro.
exports.mensajeNuevo = onDocumentCreated("carreras/{cid}/mensajes/{mid}", async (e) => {
  const m = e.data && e.data.data();
  if (!m) return;
  const c = (await db.doc(`carreras/${e.params.cid}`).get()).data();
  if (!c) return;
  const paraCliente = m.de !== c.clienteUid;
  await avisar([paraCliente ? c.clienteUid : c.motoUid], {
    titulo: `Mensaje de ${nombre1(m.nombre)}`, cuerpo: String(m.texto || "").slice(0, 120),
    url: paraCliente ? PAGINA : PAGINA + "moto.html", tag: "whereapp-chat",
  });
});
