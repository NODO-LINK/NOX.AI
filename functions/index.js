// Whereapp — avisos push (llegan aunque la app esté cerrada).
// Se suben a Firebase con: npx firebase-tools deploy --only functions --project giftcard-aecf0
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 5 });
const db = admin.firestore();
const PAGINA = "https://nodo-link.github.io/NOX.AI/";
const usd = (n) => "$" + Number(n || 0).toFixed(2);
const nombre1 = (n) => String(n || "").split(" ")[0];

// Token que ya no sirve (desinstaló la app, borró datos o el texto no es un token): se borra.
const tokenMalo = (codigo) => ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(codigo);

// Envía un aviso a las personas (uids) que tienen un token guardado. Borra los tokens que ya no sirven.
async function avisar(uids, { titulo, cuerpo, url, tag, urgente = true, extra = {} }) {
  uids = [...new Set(uids.filter(Boolean))];
  if (!uids.length) return;
  const docs = await db.getAll(...uids.map((u) => db.doc(`tokens/${u}`)));
  const conToken = docs.filter((d) => d.exists && d.get("t"));
  if (!conToken.length) return;
  const r = await admin.messaging().sendEachForMulticast({
    tokens: conToken.map((d) => d.get("t")),
    data: { titulo, cuerpo, url, tag, urgente: urgente ? "1" : "", ...extra },
    webpush: { headers: { Urgency: "high", TTL: "600" } },
    android: { priority: "high" },
  });
  await Promise.all(r.responses.map((x, i) => {
    const codigo = x.error && x.error.code;
    if (tokenMalo(codigo)) return conToken[i].ref.delete();
    return null;
  }));
}

// Envía a una lista de documentos de tokens (en grupos de 500, como pide Firebase). Devuelve cuántos llegaron.
async function enviarATokens(docs, datos) {
  let ok = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const grupo = docs.slice(i, i + 500).filter((d) => d.get("t"));
    if (!grupo.length) continue;
    const r = await admin.messaging().sendEachForMulticast({
      tokens: grupo.map((d) => d.get("t")),
      data: { titulo: datos.titulo, cuerpo: datos.cuerpo, url: datos.url, tag: datos.tag, urgente: datos.urgente ? "1" : "" },
      webpush: { headers: { Urgency: datos.urgente ? "high" : "normal", TTL: "3600" } },
    });
    ok += r.successCount;
    await Promise.all(r.responses.map((x, k) => {
      const codigo = x.error && x.error.code;
      return tokenMalo(codigo) ? grupo[k].ref.delete() : null;
    }));
  }
  return ok;
}
const tokensDe = async (rol) => (await db.collection("tokens").where("rol", "==", rol).get()).docs;
const avisarAdmins = async (titulo, cuerpo, urgente = false) => enviarATokens(await tokensDe("admin"), { titulo, cuerpo, url: PAGINA + "admin.html", tag: "whereapp-admin-" + Date.now(), urgente });
// Hora de Venezuela (0-23) y fecha AAAA-MM-DD.
const horaVe = (d = new Date()) => Number(d.toLocaleString("en-US", { timeZone: "America/Caracas", hour: "numeric", hour12: false })) % 24;
const diaVe = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
// Promociones: no entre las 9 p.m. y las 7 a.m.
const horaSilencio = () => { const h = horaVe(); return h >= 21 || h < 7; };

// Carrera nueva: a los motorizados de turno (o solo al que el cliente eligió).
exports.carreraNueva = onDocumentCreated("carreras/{id}", async (e) => {
  const c = e.data && e.data.data();
  if (!c || c.estado !== "esperando") return;
  return avisarMotos(e.params.id, c);
});
// También cuando un motorizado la cancela y vuelve a quedar disponible (menos al que la soltó).
async function avisarMotos(id, c, sinUid = null) {
  let uids;
  if (c.paraMoto) uids = [c.paraMoto];
  else {
    const s = await db.collection("motorizados").where("activo", "==", true).get();
    const ahora = Date.now();
    uids = s.docs.filter((d) => {
      const m = d.data();
      return m.deTurno !== false && !m.enCarrera && m.pagadoHasta && m.pagadoHasta.toMillis() > ahora;
    }).map((d) => d.id).filter((u) => u !== sinUid);
  }
  const ruta = `${(c.origen && c.origen.dir) || ""} → ${(c.destino && c.destino.dir) || ""}`;
  await avisar(uids, {
    titulo: c.paraMoto ? "¡Un cliente te pidió a ti!" : c.negocio ? `Pedido de ${c.negocio.nombre}` : "¡Carrera nueva!",
    cuerpo: `${usd(c.precio)} · ${c.km || 0} km\n${ruta}`,
    url: PAGINA + "moto.html", tag: "carrera-" + id,
  });
}

// Cambios de la carrera: aceptó, llegó, terminó (al cliente) y canceló (al motorizado).
exports.carreraCambio = onDocumentUpdated("carreras/{id}", async (e) => {
  const a = e.data.before.data(), c = e.data.after.data();
  if (!a || !c) return;
  const alCliente = (titulo, cuerpo) => avisar([c.clienteUid], { titulo, cuerpo, url: PAGINA, tag: "whereapp-alerta" });
  const quien = nombre1(c.motoNombre) || "Tu motorizado";
  // SOS del pasajero: al admin, urgente.
  if (c.sos && (!a.sos || !(a.sos.isEqual ? a.sos.isEqual(c.sos) : a.sos === c.sos)))
    await avisarAdmins(`SOS: ${c.clienteNombre}`, `En carrera con ${c.motoNombre || "un motorizado"}${c.motoPlaca ? ` (placa ${c.motoPlaca})` : ""}. Abre el panel.`, true);
  if (a.estado === "esperando" && c.estado === "aceptada")
    return alCliente(`¡${quien} aceptó tu ${c.negocio ? "pedido" : "carrera"}!`, `${c.motoMoto || "Moto"}${c.motoPlaca ? ` · Placa ${c.motoPlaca}` : ""}`);
  if (!a.llegoEn && c.llegoEn && !c.recogido)
    return alCliente(`¡${quien} llegó!`, c.negocio ? `Está en ${c.negocio.nombre} retirando tu pedido` : "Está afuera esperándote");
  if (a.estado === "aceptada" && (c.estado === "terminada" || c.estado === "cancelada" || c.estado === "esperando")) {
    // Fin del viaje en vivo: se marca primero, así un aviso "Faltan 2 min" que venía en camino ya no se manda.
    await db.doc(`seguimientoPush/${e.params.id}`).set({ fin: true, t: Date.now() });
    await avisar([c.clienteUid], { titulo: "-", cuerpo: "-", url: PAGINA, tag: "whereapp-cerrar", urgente: false, extra: { cerrar: "whereapp-carrera" } });
  }
  // El motorizado soltó la carrera: se avisa al pasajero y a los demás motorizados, y el admin vuelve a vigilarla.
  if (a.estado === "aceptada" && c.estado === "esperando") {
    await e.data.after.ref.update({ avisoAdmin: false });
    await alCliente(`${nombre1(a.motoNombre) || "El motorizado"} no puede ir`, "Ya estamos buscando otro motorizado para ti");
    return avisarMotos(e.params.id, c, a.motoUid);
  }
  if (a.estado === "aceptada" && c.estado === "terminada")
    return alCliente("¡Llegaste!", `Toca para calificar a ${quien}`);
  if (a.estado === "aceptada" && c.estado === "cancelada" && a.motoUid)
    return avisar([a.motoUid], { titulo: "Carrera cancelada", cuerpo: `${c.cancelacion && c.cancelacion.por === "admin" ? "El administrador" : "El cliente"} canceló la carrera`, url: PAGINA + "moto.html", tag: "whereapp-moto" });
  return null;
});

// Solicitud para trabajar como motorizado: aviso al admin cuando llega (o la reenvían) y a la persona cuando se decide.
exports.solicitudCambio = onDocumentWritten("solicitudes/{uid}", async (e) => {
  const a = e.data.before.exists ? e.data.before.data() : null, s = e.data.after.exists ? e.data.after.data() : null;
  if (!s) return null;
  if (s.estado === "pendiente" && (!a || a.estado !== "pendiente"))
    return avisarAdmins("Quieren trabajar contigo", `${s.nombre} · ${s.moto} · Placa ${s.placa}. Revisa la solicitud en Motos.`, true);
  if (a && a.estado === "pendiente" && s.estado === "aprobada")
    return avisar([e.params.uid], { titulo: "¡Fuiste aprobado!", cuerpo: "Te enviamos por WhatsApp tu usuario y clave de motorizado.", url: PAGINA + "moto.html", tag: "whereapp-alerta" });
  if (a && a.estado === "pendiente" && s.estado === "rechazada")
    return avisar([e.params.uid], { titulo: "Tu solicitud no fue aprobada", cuerpo: s.motivo || "Escríbenos para saber más.", url: PAGINA + "moto.html", tag: "whereapp-alerta" });
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

// Pago reportado por un motorizado: al admin.
exports.pagoReportado = onDocumentCreated("reportesPago/{id}", async (e) => {
  const r = e.data && e.data.data();
  if (!r) return;
  await avisarAdmins("Pago reportado", `${r.nombre}: ${r.moneda === "bs" ? "Bs " : "$"}${r.monto} · ref. ${r.referencia}. Apruébalo en Pagos.`);
});

// Reseña mala o reporte de seguridad: al admin.
exports.resenaNueva = onDocumentCreated("resenas/{id}", async (e) => {
  const r = e.data && e.data.data();
  if (!r) return;
  const mala = r.estrellas <= 2 || r.seguro === false || (r.malos || []).length > 0;
  if (mala) await avisarAdmins(r.seguro === false ? "Reporte: viaje no seguro" : `Reseña de ${r.estrellas} estrella${r.estrellas === 1 ? "" : "s"}`,
    `${r.clienteNombre} sobre ${r.motoNombre}${r.comentario ? `: "${String(r.comentario).slice(0, 80)}"` : ""}`);
});

// Aviso a todos los pasajeros (lo escribe el admin; puede ser patrocinado por un negocio).
async function enviarPromo(ref, p) {
  const n = String(p.telefono || "").replace(/\D/g, "");
  const wa = n.length === 11 && n.startsWith("0") ? "58" + n.slice(1) : n.length === 10 ? "58" + n : n;
  const url = p.negocio && wa.length === 12 ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${p.negocio}, vi su aviso en Whereapp.`)}` : PAGINA;
  try {
    const enviados = await enviarATokens(await tokensDe("cliente"), { titulo: p.titulo, cuerpo: p.negocio ? `${p.cuerpo} · Publicidad de ${p.negocio}` : p.cuerpo, url, tag: "whereapp-promo-" + ref.id });
    await ref.update({ estado: "enviado", enviados, enviado: admin.firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.error(err);
    await ref.update({ estado: "error" });
  }
}
exports.promoNueva = onDocumentCreated("promos/{id}", async (e) => {
  const p = e.data && e.data.data();
  if (!p || p.estado !== "pendiente") return;
  if (horaSilencio()) return e.data.ref.update({ estado: "programado" });
  return enviarPromo(e.data.ref, p);
});

// Cada minuto: carreras que nadie aceptó en 3 minutos (aviso al admin, una sola vez por carrera).
exports.sinAceptar = onSchedule({ schedule: "every 1 minutes", timeZone: "America/Caracas" }, async () => {
  const s = await db.collection("carreras").where("estado", "==", "esperando").get();
  const limite = Date.now() - 3 * 60000;
  const viejas = s.docs.filter((d) => !d.get("avisoAdmin") && d.get("creada") && d.get("creada").toMillis() < limite);
  if (!viejas.length) return;
  await avisarAdmins(viejas.length > 1 ? `${viejas.length} carreras sin aceptar` : "Carrera sin aceptar (3 min)",
    viejas.map((d) => `${d.get("clienteNombre")}: ${(d.get("origen") || {}).dir || ""}`).join(" · ").slice(0, 160), true);
  await Promise.all(viejas.map((d) => d.ref.update({ avisoAdmin: true })));
});

// Cada hora (hora de Venezuela): promos programadas (7 a.m.), recordatorios a motorizados (8 a.m.),
// tasa del día (9 a.m.) y "te extrañamos" (6 p.m.).
exports.cadaHora = onSchedule({ schedule: "0 * * * *", timeZone: "America/Caracas" }, async () => {
  const h = horaVe(), hoy = diaVe();
  if (h === 7) {
    const s = await db.collection("promos").where("estado", "==", "programado").get();
    for (const d of s.docs) await enviarPromo(d.ref, d.data());
  }
  if (h === 8) await recordarMotorizados(hoy);
  if (h === 9) {
    const g = (await db.doc("config/general").get()).data() || {};
    const f = g.tasaFecha && g.tasaFecha.toDate ? diaVe(g.tasaFecha.toDate()) : null;
    if (f !== hoy) await avisarAdmins("Actualiza la tasa del día", "Todavía no pusiste la tasa de hoy (Más → Tarifas).");
  }
  if (h === 18) await teExtranamos();
});

const DOCS = { licencia: "licencia de conducir", medico: "certificado médico", rcv: "RCV", trimestres: "trimestres" };
const diasEntre = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5);
async function recordarMotorizados(hoy) {
  const motos = (await db.collection("motorizados").get()).docs;
  const lunes = new Date(hoy + "T12:00").getDay() === 1;
  for (const m of motos) {
    const d = m.data();
    if (d.usuario === "prueba") continue;
    const avisos = [];
    // Cuota: 2 días antes y el día que vence.
    if (d.activo && d.pagadoHasta) {
      const faltan = diasEntre(hoy, diaVe(d.pagadoHasta.toDate()));
      if (faltan === 2) avisos.push(["Tu quincena vence en 2 días", "Paga y repórtalo en la app para seguir recibiendo carreras."]);
      if (faltan === 0) avisos.push(["Tu quincena vence hoy", "Paga y repórtalo en la app para no dejar de salir."]);
    }
    // Documentos: 7 días antes, 3 días antes, el día que vencen y, si están vencidos, cada lunes.
    const docs = (await db.doc(`documentos/${m.id}`).get()).data() || {};
    const malos = Object.entries(DOCS).map(([k, t]) => {
      const v = docs[k] && docs[k].vence;
      if (!v) return null;
      const n = diasEntre(hoy, v);
      return n < 0 ? (lunes ? `${t} vencido` : null) : [7, 3, 0].includes(n) ? `${t} vence ${n === 0 ? "hoy" : `en ${n} días`}` : null;
    }).filter(Boolean);
    if (malos.length) avisos.push(["Documentos por renovar", `${malos.join(", ")}. Mándale la foto nueva al administrador.`]);
    for (const [titulo, cuerpo] of avisos) await avisar([m.id], { titulo, cuerpo, url: PAGINA + "moto.html", tag: "whereapp-recordatorio", urgente: false });
  }
}

// Pasajeros que no piden hace 7 días (como mucho un aviso cada 14 días por persona).
async function teExtranamos() {
  const corte = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 864e5);
  const hace14 = Date.now() - 14 * 864e5;
  // Se recorren todos en grupos de 300 (antes siempre salían los mismos 400 y los demás nunca recibían el aviso).
  const todos = [];
  for (let ultimo = null; ;) {
    let q = db.collection("clientes").where("ultimaVez", "<", corte).orderBy("ultimaVez").limit(300);
    if (ultimo) q = q.startAfter(ultimo);
    const s = await q.get();
    todos.push(...s.docs);
    if (s.size < 300) break;
    ultimo = s.docs[s.docs.length - 1];
  }
  for (const c of todos) {
    const u = c.get("ultimaCarrera");
    if (u && u.toMillis() > corte.toMillis()) continue;
    const r = db.doc(`recordatorios/${c.id}`);
    const prev = (await r.get()).data();
    if (prev && prev.extranado && prev.extranado.toMillis() > hace14) continue;
    const nombre = String(c.get("nombre") || "").split(" ")[0];
    await avisar([c.id], { titulo: `${nombre}, te extrañamos`, cuerpo: "¿A dónde vas hoy? Pide tu mototaxi o tu comida en Whereapp.", url: PAGINA, tag: "whereapp-promo", urgente: false });
    await r.set({ extranado: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
}

// ---------- Viaje en vivo en la barra de notificaciones del pasajero ----------
// Cada vez que el motorizado manda su ubicación (cada ~8 s), como mucho cada 30 s se actualiza
// la notificación fija del pasajero: minutos que faltan y barra de progreso (el "(NN%)" lo dibuja la APK).
const kmEntre = (a, b) => {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.3;
};
exports.viajeEnVivo = onDocumentWritten("ubicaciones/{uid}", async (e) => {
  const u = e.data && e.data.after && e.data.after.data();
  if (!u || typeof u.lat !== "number") return;
  const s = await db.collection("carreras").where("motoUid", "==", e.params.uid).where("estado", "==", "aceptada").limit(1).get();
  if (s.empty) return;
  const d = s.docs[0], c = d.data();
  const ref = db.doc(`seguimientoPush/${d.id}`);
  let prev = (await ref.get()).data() || {};
  // Otro motorizado (la anterior la soltó) o un viaje ya cerrado: se empieza de cero.
  if (prev.moto !== e.params.uid) prev = {};
  if (prev.t && Date.now() - prev.t < 30000 && prev.recogido === !!c.recogido && prev.llego === !!c.llegoEn) return;
  const meta = c.recogido ? c.destino : c.origen;
  const km = kmEntre(u, meta);
  const min = Math.max(1, Math.round((km / 25) * 60));
  // Progreso: hasta A es la primera mitad de la barra; de A a B, la segunda.
  const inicial = c.recogido ? prev.inicial : Math.max(prev.inicial || 0, km, 0.05);
  let pct = c.recogido ? 50 + 50 * (1 - km / Math.max(Number(c.km) || km, 0.1)) : 50 * (1 - km / inicial);
  pct = Math.round(Math.min(100, Math.max(0, pct)));
  const quien = nombre1(c.motoNombre) || "Tu motorizado";
  const titulo = c.llegoEn && !c.recogido ? `¡${quien} llegó!` : c.recogido ? (c.negocio ? "Tu pedido va en camino" : "En camino a tu destino")
    : `${quien} va a buscar${c.negocio ? " tu pedido" : "te"}`;
  const textoKm = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  const cuerpo = (c.llegoEn && !c.recogido ? "Está afuera esperándote" : km < 0.1 ? "Está llegando" : `Faltan ${min} min · ${textoKm}`)
    + `${c.motoPlaca ? ` · Placa ${c.motoPlaca}` : ""} (${pct}%)`;
  // Justo antes de mandar: si la carrera ya terminó o la soltó, no se manda (no queda una notificación pegada).
  const sigue = await db.runTransaction(async (tx) => {
    const [cAhora, pAhora] = await Promise.all([tx.get(d.ref), tx.get(ref)]);
    if (cAhora.get("estado") !== "aceptada" || cAhora.get("motoUid") !== e.params.uid) return false;
    if (pAhora.exists && pAhora.get("fin") && pAhora.get("moto") === e.params.uid) return false;
    tx.set(ref, { t: Date.now(), inicial: inicial || km, recogido: !!c.recogido, llego: !!c.llegoEn, moto: e.params.uid });
    return true;
  });
  if (!sigue) return;
  const enlace = `${PAGINA}seguir.html?c=${d.id}`;
  await avisar([c.clienteUid], {
    titulo, cuerpo, url: PAGINA, tag: "whereapp-carrera", urgente: false,
    extra: { tel: c.motoTel || "", compartir: `https://wa.me/?text=${encodeURIComponent(`Sigue mi viaje en Whereapp: ${enlace}`)}` },
  });
});
