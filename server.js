// NOX — servidor del asistente.
// Sirve la app web (carpeta /public) y hace de puente seguro hacia Claude:
// la clave ANTHROPIC_API_KEY nunca sale del servidor.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.NOX_MODEL || "claude-opus-5-5";
const USER_NAME = process.env.NOX_USER_NAME || "señor";
// Clave opcional para que solo tú puedas usar tu NOX si lo publicas en internet.
const ACCESS_KEY = process.env.NOX_ACCESS_KEY || "";

// Límite de gasto diario en dólares (0 = sin límite). Tú decides cuánto gasta NOX al día.
const DAILY_BUDGET_USD = Number(process.env.NOX_DAILY_BUDGET_USD ?? 1);
const USAGE_FILE = path.join(here, "usage.json");

const client = new Anthropic();

// ---------- Control de gasto diario ----------
// Precios en dólares por millón de tokens (entrada, salida, lectura de caché).
// La escritura en caché cuesta 1,25× la entrada. Revisa anthropic.com/pricing si cambian.
const PRICES = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2 },
  "claude-haiku-4-5": { in: 1, out: 5, cacheRead: 0.1 },
  "claude-fable-5-1": { in: 10, out: 50, cacheRead: 0.25 },
};
const WEB_SEARCH_USD = 0.01; // 10 $ por cada 1.000 búsquedas

function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: process.env.NOX_TIMEZONE || undefined });
}

let usage = { day: today(), usd: 0, requests: 0 };
try {
  const saved = JSON.parse(await fs.readFile(USAGE_FILE, "utf8"));
  if (saved.day === usage.day) usage = saved;
} catch {}

function currentUsage() {
  if (usage.day !== today()) usage = { day: today(), usd: 0, requests: 0 };
  return usage;
}

function costOf(model, u) {
  const p = PRICES[model] || PRICES["claude-opus-5-5"];
  const cacheWrite = u.cache_creation_input_tokens || 0;
  const cacheRead = u.cache_read_input_tokens || 0;
  return (
    ((u.input_tokens || 0) * p.in + cacheWrite * p.in * 1.25 + cacheRead * p.cacheRead + (u.output_tokens || 0) * p.out) / 1e6 +
    (u.server_tool_use?.web_search_requests || 0) * WEB_SEARCH_USD
  );
}

function recordUsage(message) {
  const u = currentUsage();
  u.usd += costOf(message.model || MODEL, message.usage || {});
  u.requests++;
  fs.writeFile(USAGE_FILE, JSON.stringify(u)).catch(() => {});
}

function budgetInfo() {
  const u = currentUsage();
  return {
    day: u.day,
    spentUsd: Number(u.usd.toFixed(4)),
    limitUsd: DAILY_BUDGET_USD,
    remainingUsd: DAILY_BUDGET_USD > 0 ? Number(Math.max(0, DAILY_BUDGET_USD - u.usd).toFixed(4)) : null,
  };
}

function overBudget() {
  return DAILY_BUDGET_USD > 0 && currentUsage().usd >= DAILY_BUDGET_USD;
}

// Prompt fijo (no cambia entre peticiones, así se aprovecha la caché de Claude).
const SYSTEM_PROMPT = `Eres NOX, el asistente personal de inteligencia artificial de ${USER_NAME}, inspirado en J.A.R.V.I.S. de Tony Stark.

Personalidad:
- Elegante, leal, ingenioso, con un toque de humor británico seco. Tratas al usuario de "${USER_NAME}".
- Eres proactivo: si ves algo útil (clima, tráfico, un recordatorio, un riesgo), lo mencionas brevemente.
- Hablas siempre en el idioma del usuario (por defecto, español).

Formato:
- Tus respuestas se LEEN EN VOZ ALTA. Sé conciso y natural: frases cortas, sin markdown, sin listas con viñetas, sin emojis, sin URLs largas.
- Da primero la respuesta directa; amplía solo si te lo piden.

Contexto:
- En cada turno recibirás un mensaje de sistema con la fecha, hora y ubicación actual del dispositivo del usuario. Úsalo cuando sea relevante (clima, lugares cercanos, "dónde estoy", distancias, hora local), sin repetirlo innecesariamente.
- Tienes búsqueda web para información actual: noticias, clima, horarios, lugares. Úsala cuando la pregunta lo necesite.
- Si no conoces la ubicación (permiso denegado), dilo con naturalidad y sigue ayudando.`;

// Conversaciones en memoria por dispositivo/sesión.
// Para producción, cámbialo por una base de datos.
const sessions = new Map();
const MAX_SESSIONS = 500;

function getHistory(sessionId) {
  if (!sessions.has(sessionId)) {
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId);
}

function describeContext(ctx = {}) {
  const lines = [];
  const now = new Date();
  const tz = ctx.timezone || "UTC";
  try {
    lines.push(`Fecha y hora local: ${now.toLocaleString("es-ES", { timeZone: tz, dateStyle: "full", timeStyle: "short" })} (${tz})`);
  } catch {
    lines.push(`Fecha y hora (UTC): ${now.toISOString()}`);
  }
  const loc = ctx.location;
  if (loc && typeof loc.lat === "number" && typeof loc.lon === "number") {
    lines.push(`Ubicación GPS: ${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} (precisión ±${Math.round(loc.accuracy || 0)} m)`);
    if (loc.address) lines.push(`Dirección aproximada: ${loc.address}`);
    if (typeof loc.speed === "number" && loc.speed > 0.5) {
      lines.push(`Velocidad: ${(loc.speed * 3.6).toFixed(0)} km/h`);
    }
  } else {
    lines.push("Ubicación: no disponible (el usuario no ha dado permiso o no hay señal).");
  }
  if (ctx.device) lines.push(`Dispositivo: ${ctx.device}`);
  if (typeof ctx.battery === "number") lines.push(`Batería: ${Math.round(ctx.battery * 100)}%`);
  return lines.join("\n");
}

function webSearchTool(ctx = {}) {
  const tool = { type: "web_search_20260209", name: "web_search", max_uses: 5 };
  const place = ctx.location?.place;
  if (place && (place.city || place.country)) {
    tool.user_location = {
      type: "approximate",
      ...(place.city && { city: place.city }),
      ...(place.region && { region: place.region }),
      ...(place.countryCode && { country: place.countryCode.toUpperCase() }),
      ...(ctx.timezone && { timezone: ctx.timezone }),
    };
  }
  return tool;
}

async function readJson(req, limit = 1_000_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Petición demasiado grande");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function handleChat(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: err.message }));
  }
  const text = String(body.message || "").trim().slice(0, 8000);
  const sessionId = String(body.sessionId || "").slice(0, 100) || crypto.randomUUID();
  if (!text) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Mensaje vacío" }));
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (overBudget()) {
    sse(res, "delta", { text: `He alcanzado el límite de gasto de hoy, ${USER_NAME}. Volveré a estar disponible mañana, o puede subir el límite en la configuración.` });
    sse(res, "usage", budgetInfo());
    sse(res, "done", { sessionId });
    return res.end();
  }

  const history = getHistory(sessionId);
  // Historial solo-añadir: el mensaje de contexto se guarda junto al turno,
  // así nunca se edita lo ya enviado (mantiene la caché y el razonamiento previo).
  const turn = [
    { role: "user", content: text },
    { role: "system", content: describeContext(body.context) },
  ];
  const messages = [...history, ...turn];

  try {
    let response;
    // Las búsquedas web largas pueden pausar el turno (pause_turn): se continúa.
    for (let i = 0; i < 4; i++) {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "low" }, // conversación en voz: rápido y fluido
        tools: [webSearchTool(body.context)],
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages,
      });
      stream.on("text", (delta) => sse(res, "delta", { text: delta }));
      stream.on("streamEvent", (event) => {
        if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
          sse(res, "status", { text: "Buscando en la red…" });
        }
      });
      response = await stream.finalMessage();
      recordUsage(response);
      messages.push({ role: "assistant", content: response.content });
      if (response.stop_reason !== "pause_turn") break;
    }

    if (response.stop_reason === "refusal") {
      sse(res, "delta", { text: "Lo siento, no puedo ayudar con eso." });
    }
    // Solo guardamos el turno cuando terminó bien.
    history.length = 0;
    history.push(...messages);
    sse(res, "usage", budgetInfo());
    sse(res, "done", { sessionId });
  } catch (err) {
    console.error("Error de Claude:", err);
    let msg = "Tengo problemas para conectar con mis sistemas.";
    if (err instanceof Anthropic.AuthenticationError || /authentication/i.test(err.message)) msg = "Falta o es inválida la clave ANTHROPIC_API_KEY en el servidor.";
    else if (err instanceof Anthropic.RateLimitError) msg = "Demasiadas peticiones; dame un momento.";
    else if (err instanceof Anthropic.APIConnectionError) msg = "No puedo conectar con la red.";
    sse(res, "error", { text: msg });
  }
  res.end();
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("No encontrado");
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    if (ACCESS_KEY && req.headers["x-nox-key"] !== ACCESS_KEY) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Clave de acceso incorrecta" }));
    }
    if (req.method === "POST" && req.url === "/api/chat") return handleChat(req, res);
    if (req.method === "GET" && req.url === "/api/usage") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(budgetInfo()));
    }
    if (req.method === "POST" && req.url === "/api/reset") {
      const { sessionId } = await readJson(req).catch(() => ({}));
      sessions.delete(String(sessionId));
      res.writeHead(204);
      return res.end();
    }
    res.writeHead(404);
    return res.end();
  }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`NOX en línea → http://localhost:${PORT}  (modelo: ${MODEL})`);
  console.log(DAILY_BUDGET_USD > 0 ? `Límite diario: ${DAILY_BUDGET_USD} $ (gastado hoy: ${budgetInfo().spentUsd} $)` : "Sin límite diario de gasto");
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠  ANTHROPIC_API_KEY no está definida. Consíguela en https://console.anthropic.com");
  }
});
