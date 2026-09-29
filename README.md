# NOX — tu asistente personal estilo J.A.R.V.I.S.

NOX es un asistente de IA con el que hablas **por voz**, que **sabe dónde estás** en tiempo real y
funciona en **todos tus dispositivos** (móvil, tablet, PC) como una app instalable.
El "cerebro" es Claude (Anthropic), con búsqueda web para información actual.

## Qué hace

- 🎙️ **Conversación por voz**: toca el núcleo y habla; NOX responde en voz alta, frase a frase mientras piensa.
- 👂 **Palabra clave "Nox"** (opcional, en ⚙): escucha continua. Di *"Nox, ¿qué tiempo hace?"*. Si le llamas mientras habla, se calla y te escucha.
- 📍 **Ubicación en tiempo real**: GPS + dirección (calle, barrio, ciudad). NOX la usa para el clima, lugares cercanos, "¿dónde estoy?", la hora local…
- 🌐 **Búsqueda web**: noticias, clima, horarios, resultados; ajustada a tu ciudad.
- 🧠 **Memoria de la conversación** por dispositivo (botón "Borrar memoria" en ⚙).
- 📱 **App instalable (PWA)**: en el móvil, "Añadir a pantalla de inicio"; en el PC, el icono de instalar de Chrome/Edge.
- 🔒 La clave de la API vive solo en el servidor. Clave de acceso opcional para que nadie más use tu NOX.

## Puesta en marcha (5 minutos)

1. Instala [Node.js](https://nodejs.org) 18 o superior.
2. Consigue una clave de API en <https://console.anthropic.com>.
3. En esta carpeta:

   ```bash
   npm install
   export ANTHROPIC_API_KEY="sk-ant-..."     # en Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
   export NOX_USER_NAME="Tony"               # opcional: cómo quieres que te llame
   npm start
   ```

4. Abre <http://localhost:3000> en Chrome, Edge o Safari y acepta los permisos de **micrófono** y **ubicación**.

### Variables de configuración

| Variable | Para qué | Por defecto |
|---|---|---|
| `ANTHROPIC_API_KEY` | Tu clave de Claude (obligatoria) | — |
| `NOX_USER_NAME` | Cómo te llama NOX | `señor` |
| `NOX_ACCESS_KEY` | Contraseña para usar tu NOX si lo publicas en internet (se pone en ⚙ de cada dispositivo) | sin clave |
| `NOX_MODEL` | Modelo de Claude | `claude-opus-5-5` |
| `PORT` | Puerto | `3000` |

## Tenerlo en todos tus dispositivos

El micrófono y el GPS del navegador **solo funcionan con HTTPS** (o en `localhost`). Para usarlo desde
tu móvil fuera de casa, publícalo en un servicio con HTTPS, por ejemplo Render, Railway o Fly.io:

1. Sube este repositorio y crea un "Web Service" con Node (`npm install` / `npm start`).
2. Define `ANTHROPIC_API_KEY` y **`NOX_ACCESS_KEY`** (¡importante, o cualquiera podría gastar tu saldo!).
3. Abre la URL en cada dispositivo, pon la clave en ⚙ e instálala como app.

Para probar rápido en el móvil desde tu PC: `npx cloudflared tunnel --url http://localhost:3000` te da una URL HTTPS temporal.

## Sobre "saber dónde estoy siempre"

Una web/PWA solo puede leer tu ubicación **mientras la app está abierta** (en pantalla o recién minimizada).
Es una limitación de privacidad de iOS y Android. Para seguimiento continuo en segundo plano haría falta
una app nativa (por ejemplo con Capacitor o React Native) que envíe la ubicación al servidor. Es el siguiente
paso natural del proyecto.

## Arquitectura

```
[Móvil / PC / Tablet]  ── voz, GPS, texto ──▶  server.js (Node)  ──▶  Claude API
   public/ (PWA)       ◀── respuesta en streaming ──┘                  + búsqueda web
```

- `public/app.js`: reconocimiento y síntesis de voz (Web Speech API), GPS (`watchPosition`),
  dirección con OpenStreetMap, chat en streaming.
- `server.js`: añade fecha, hora y ubicación a cada turno, llama a Claude con búsqueda web y devuelve
  la respuesta en streaming (SSE).

## Ideas para seguir construyendo

- Voz más natural (ElevenLabs / OpenAI TTS) en lugar de la voz del sistema.
- Herramientas propias: calendario, correo, recordatorios, domótica (luces, enchufes), música.
- Memoria a largo plazo (gustos, personas, lugares habituales) guardada en base de datos.
- App nativa para ubicación en segundo plano y notificaciones proactivas.
- Cámara: "Nox, ¿qué estoy viendo?" (Claude entiende imágenes).
