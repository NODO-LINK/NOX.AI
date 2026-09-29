// NOX — cliente: voz, ubicación en tiempo real y chat en streaming.

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("nox." + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("nox." + k, JSON.stringify(v)); } catch {} },
};

let sessionId = store.get("session", null);
if (!sessionId) { sessionId = crypto.randomUUID(); store.set("session", sessionId); }

const settings = {
  wake: store.get("wake", false),
  voice: store.get("voice", true),
  voiceName: store.get("voiceName", ""),
  key: store.get("key", ""),
};

// ---------- Estado visual ----------
function setMode(mode, text) {
  document.body.classList.remove("listening", "thinking", "speaking");
  if (mode) document.body.classList.add(mode);
  if (text !== undefined) $("status").textContent = text;
}

function addMessage(role, text = "") {
  const el = document.createElement("div");
  el.className = "msg " + role;
  el.textContent = text;
  $("log").appendChild(el);
  $("log").scrollTop = $("log").scrollHeight;
  return el;
}

// ---------- Reloj ----------
function tick() {
  $("clock").textContent = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
tick();
setInterval(tick, 10_000);

// ---------- Ubicación en tiempo real ----------
const location_ = { current: null, lastGeocode: null };

function distanceM(a, b) {
  const R = 6371e3, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function reverseGeocode(loc) {
  // OpenStreetMap Nominatim (gratis). Solo se consulta si te mueves >150 m o cada 5 min.
  const last = location_.lastGeocode;
  if (last && distanceM(last, loc) < 150 && Date.now() - last.t < 5 * 60_000) return;
  location_.lastGeocode = { ...loc, t: Date.now() };
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${loc.lat}&lon=${loc.lon}&accept-language=es&zoom=18`
    );
    const j = await r.json();
    const a = j.address || {};
    const city = a.city || a.town || a.village || a.municipality || "";
    location_.current.address = j.display_name;
    location_.current.place = { city, region: a.state || "", countryCode: a.country_code || "" };
    $("place").textContent = [a.road, a.suburb || a.neighbourhood, city].filter(Boolean).join(", ") || j.display_name;
  } catch {
    $("place").textContent = `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`;
  }
}

if ("geolocation" in navigator) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const c = pos.coords;
      const prev = location_.current || {};
      location_.current = {
        ...prev,
        lat: c.latitude, lon: c.longitude,
        accuracy: c.accuracy, speed: c.speed ?? undefined,
      };
      if (!prev.address) $("place").textContent = `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`;
      reverseGeocode(location_.current);
    },
    (err) => { $("place").textContent = err.code === 1 ? "Ubicación sin permiso" : "Sin señal GPS"; },
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 }
  );
} else {
  $("place").textContent = "Ubicación no soportada";
}

let batteryLevel;
navigator.getBattery?.().then((b) => {
  batteryLevel = b.level;
  b.addEventListener("levelchange", () => (batteryLevel = b.level));
});

function context() {
  const ua = navigator.userAgent;
  const device = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "PC Windows" : "Otro";
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: location_.current,
    device,
    battery: batteryLevel,
  };
}

// ---------- Voz (síntesis) ----------
const synth = window.speechSynthesis;
let speakQueue = 0;

function pickVoice() {
  const voices = synth?.getVoices() || [];
  return voices.find((v) => v.name === settings.voiceName) || voices.find((v) => v.lang.startsWith("es")) || voices[0];
}

function fillVoiceList() {
  const sel = $("optVoiceName");
  const voices = synth?.getVoices() || [];
  sel.innerHTML = "";
  for (const v of voices.filter((v) => v.lang.startsWith("es")).concat(voices.filter((v) => !v.lang.startsWith("es")))) {
    const o = document.createElement("option");
    o.value = v.name;
    o.textContent = `${v.name} (${v.lang})`;
    if (v.name === settings.voiceName) o.selected = true;
    sel.appendChild(o);
  }
}
synth?.addEventListener?.("voiceschanged", fillVoiceList);

function speak(text) {
  if (!settings.voice || !synth || !text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "es-ES";
  u.rate = 1.05;
  speakQueue++;
  pauseListening();
  setMode("speaking");
  u.onend = u.onerror = () => {
    if (--speakQueue <= 0) {
      speakQueue = 0;
      setMode(null, settings.wake ? "Escuchando… di «Nox»" : "Toca el núcleo para hablar");
      resumeListening();
    }
  };
  synth.speak(u);
}

function stopSpeaking() {
  synth?.cancel();
  speakQueue = 0;
}

// ---------- Chat en streaming ----------
let busy = false;

async function ask(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true;
  stopSpeaking();
  addMessage("user", text);
  const out = addMessage("nox", "");
  setMode("thinking", "Procesando…");

  let pending = ""; // texto aún no leído en voz alta
  const flushSentences = (final = false) => {
    // Lee frase a frase mientras llega la respuesta: menos espera.
    const re = /[^.!?¿¡…]*[.!?…]+[\s"”)]*/g;
    let m, lastEnd = 0;
    while ((m = re.exec(pending))) lastEnd = re.lastIndex;
    if (final) lastEnd = pending.length;
    if (lastEnd > 0) { speak(pending.slice(0, lastEnd)); pending = pending.slice(lastEnd); }
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(settings.key && { "x-nox-key": settings.key }) },
      body: JSON.stringify({ message: text, sessionId, context: context() }),
    });
    if (!res.ok) throw new Error(res.status === 401 ? "Clave de acceso incorrecta (ajústala en ⚙)." : `Error ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const event = raw.match(/^event: (.*)$/m)?.[1];
        const data = JSON.parse(raw.match(/^data: (.*)$/m)?.[1] || "{}");
        if (event === "delta") {
          out.textContent += data.text;
          pending += data.text;
          flushSentences();
          $("log").scrollTop = $("log").scrollHeight;
        } else if (event === "usage") {
          showUsage(data);
        } else if (event === "status") {
          $("status").textContent = data.text;
        } else if (event === "error") {
          out.classList.add("error");
          out.textContent = data.text;
          speak(data.text);
        }
      }
    }
    flushSentences(true);
  } catch (err) {
    out.classList.add("error");
    out.textContent = err.message || "Sin conexión con el servidor.";
  } finally {
    busy = false;
    if (!speakQueue) setMode(null, settings.wake ? "Escuchando… di «Nox»" : "Toca el núcleo para hablar");
  }
}

// ---------- Voz (reconocimiento) ----------
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let listening = false;   // el micro está abierto
let wantListen = false;  // el usuario quiere que esté abierto
let paused = false;      // cerrado temporalmente mientras NOX habla
const WAKE = /\b(nox|knox|nocs)\b[,.]?\s*/i;

function startRecognition(continuous) {
  if (!Recognition) {
    $("status").textContent = "Tu navegador no soporta voz. Usa Chrome, Edge o Safari.";
    return;
  }
  rec = new Recognition();
  rec.lang = navigator.language?.startsWith("es") ? navigator.language : "es-ES";
  rec.continuous = continuous;
  rec.interimResults = true;

  rec.onstart = () => { listening = true; if (!busy && !speakQueue) setMode("listening", continuous ? "Escuchando… di «Nox»" : "Te escucho…"); };
  rec.onresult = (e) => {
    const r = e.results[e.results.length - 1];
    const said = r[0].transcript;
    if (!continuous) {
      $("input").value = said;
      if (r.isFinal) { $("input").value = ""; ask(said); }
      return;
    }
    if (!r.isFinal) return;
    const m = said.match(WAKE);
    if (m) {
      // interrupción: si NOX está hablando y le llamas, se calla
      stopSpeaking();
      const command = said.slice(m.index + m[0].length).trim();
      if (command) ask(command);
      else speak("¿Sí, señor?");
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed") { wantListen = false; $("status").textContent = "Permiso de micrófono denegado."; }
  };
  rec.onend = () => {
    listening = false;
    if (wantListen && !paused && settings.wake) setTimeout(() => startRecognition(true), 250);
    else if (!busy && !speakQueue) setMode(null, settings.wake ? "Escucha en pausa" : "Toca el núcleo para hablar");
  };
  rec.start();
}

function pauseListening() {
  if (listening && rec) { paused = true; rec.abort(); }
}
function resumeListening() {
  if (paused) { paused = false; if (wantListen && settings.wake) startRecognition(true); }
}

$("core").addEventListener("click", () => {
  if (speakQueue) { stopSpeaking(); setMode(null); return; }
  if (settings.wake) {
    wantListen = !wantListen;
    if (wantListen) startRecognition(true); else rec?.abort();
    return;
  }
  if (listening) { rec?.stop(); return; }
  wantListen = false;
  startRecognition(false);
});

$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("input").value;
  $("input").value = "";
  ask(t);
});

// ---------- Ajustes ----------
function showUsage(u) {
  if (u?.free) { $("usage").textContent = "Cerebro: Gemini (plan gratuito)"; return; }
  if (!u || typeof u.spentUsd !== "number") return;
  $("usage").textContent = u.limitUsd > 0
    ? `Gasto de hoy: ${u.spentUsd.toFixed(3)} $ de ${u.limitUsd} $ (quedan ${u.remainingUsd.toFixed(3)} $)`
    : `Gasto de hoy: ${u.spentUsd.toFixed(3)} $ (sin límite)`;
}
async function refreshUsage() {
  try {
    const r = await fetch("/api/usage", { headers: settings.key ? { "x-nox-key": settings.key } : {} });
    if (r.ok) showUsage(await r.json());
  } catch {}
}

$("optWake").checked = settings.wake;
$("optVoice").checked = settings.voice;
$("optKey").value = settings.key;
$("settingsBtn").addEventListener("click", () => { fillVoiceList(); refreshUsage(); $("settings").showModal(); });
$("settings").addEventListener("close", () => {
  settings.wake = $("optWake").checked;
  settings.voice = $("optVoice").checked;
  settings.voiceName = $("optVoiceName").value;
  settings.key = $("optKey").value;
  for (const k of ["wake", "voice", "voiceName", "key"]) store.set(k, settings[k]);
  if (!settings.wake) { wantListen = false; rec?.abort(); }
  setMode(null, settings.wake ? "Toca el núcleo para activar la escucha continua" : "Toca el núcleo para hablar");
});
$("resetBtn").addEventListener("click", async () => {
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(settings.key && { "x-nox-key": settings.key }) },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {});
  sessionId = crypto.randomUUID();
  store.set("session", sessionId);
  $("log").innerHTML = "";
});

// ---------- App instalable (PWA) ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

addMessage("nox", "Sistemas en línea. A su servicio. Toque el núcleo y hábleme, o escriba abajo.");
