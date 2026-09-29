# NOX — tu asistente personal estilo J.A.R.V.I.S.

NOX es un asistente de IA con el que hablas **por voz**, que **sabe dónde estás** en tiempo real y
funciona en **todos tus dispositivos** (móvil, tablet, PC) como una app instalable.
El "cerebro" puede ser **Gemini de Google (gratis)** o **Claude de Anthropic (de pago, el más inteligente)**,
los dos con búsqueda web para información actual.

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
2. Elige el cerebro y consigue su clave:
   - **Gemini (gratis, sin tarjeta):** crea la clave en <https://aistudio.google.com/apikey>.
   - **Claude (de pago, prepago):** crea la clave en <https://console.anthropic.com>.
3. En esta carpeta:

   ```bash
   npm install
   export GEMINI_API_KEY="AIza..."          # o bien: export ANTHROPIC_API_KEY="sk-ant-..."
   export NOX_USER_NAME="Tony"              # opcional: cómo quieres que te llame
   npm start
   ```

   En Windows PowerShell usa `$env:GEMINI_API_KEY="AIza..."` en lugar de `export`.

4. Abre <http://localhost:3000> en Chrome, Edge o Safari y acepta los permisos de **micrófono** y **ubicación**.

Si pones la clave de Gemini, NOX usa Gemini. Si solo pones la de Claude, usa Claude.
Puedes forzarlo con `NOX_PROVIDER=gemini` o `NOX_PROVIDER=claude`.

### Variables de configuración

| Variable | Para qué | Por defecto |
|---|---|---|
| `GEMINI_API_KEY` | Clave de Gemini (gratis) | — |
| `ANTHROPIC_API_KEY` | Clave de Claude (de pago) | — |
| `NOX_PROVIDER` | `gemini` o `claude` | `gemini` si hay `GEMINI_API_KEY` |
| `NOX_MODEL` | Modelo concreto | `gemini-flash-latest` / `claude-opus-5-5` |
| `NOX_USER_NAME` | Cómo te llama NOX | `señor` |
| `NOX_ACCESS_KEY` | Contraseña para usar tu NOX si lo publicas en internet (se pone en ⚙ de cada dispositivo) | sin clave |
| `NOX_DAILY_BUDGET_USD` | Solo Claude: máximo que puede gastar al día, en dólares (`0` = sin límite) | `1` |
| `NOX_TIMEZONE` | Zona horaria para saber cuándo empieza "hoy" (ej. `America/Mexico_City`) | la del servidor |
| `PORT` | Puerto | `3000` |

## Control de gasto

**Con Gemini en el plan gratuito no pagas nada.** Google no te pide tarjeta; cuando se acaban las
preguntas gratis del día o del minuto, NOX te avisa y vuelve a funcionar más tarde.
No actives la facturación en Google Cloud si quieres que siga siendo 100 % gratis.

**Con Claude:** la API es de prepago y va aparte de la suscripción de Claude.ai. NOX tiene **dos protecciones**:

1. **Límite diario dentro de NOX** (`NOX_DAILY_BUDGET_USD`, 1 $ por defecto). Cuando lo alcanza, NOX avisa
   y no responde más hasta el día siguiente. El gasto de hoy se ve en ⚙. Es una estimación calculada
   con los precios públicos; la última pregunta del día puede pasarse unos céntimos.
2. **Límite en la consola de Anthropic**: carga solo el crédito que quieras gastar, desactiva la
   recarga automática y pon un límite mensual. Esto es lo que de verdad garantiza que nunca se gaste más.

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
[Móvil / PC / Tablet]  ── voz, GPS, texto ──▶  server.js (Node)  ──▶  Gemini o Claude
   public/ (PWA)       ◀── respuesta en streaming ──┘                  + búsqueda web
```

- `public/app.js`: reconocimiento y síntesis de voz (Web Speech API), GPS (`watchPosition`),
  dirección con OpenStreetMap, chat en streaming.
- `server.js`: añade fecha, hora y ubicación a cada turno, llama a Gemini o Claude con búsqueda web y devuelve
  la respuesta en streaming (SSE).

## Ideas para seguir construyendo

- Voz más natural (ElevenLabs / OpenAI TTS) en lugar de la voz del sistema.
- Herramientas propias: calendario, correo, recordatorios, domótica (luces, enchufes), música.
- Memoria a largo plazo (gustos, personas, lugares habituales) guardada en base de datos.
- App nativa para ubicación en segundo plano y notificaciones proactivas.
- Cámara: "Nox, ¿qué estoy viendo?" (Claude entiende imágenes).
