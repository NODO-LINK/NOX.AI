# Whereapp — motorizados en El Moján

App de delivery y mototaxi para El Moján. Tiene tres partes:

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Clientes | Entran con su teléfono (código por SMS), marcan el punto A y el B en el mapa, ven el precio por km (Delivery o Mototaxi) y piden a todos o a un motorizado. Ven quién viene, su moto y placa, su ubicación en vivo, pueden llamarlo, cancelar con motivo y calificar al terminar. |
| `moto.html` | Motorizados | Entran con usuario y clave. Ven las carreras nuevas (con sonido), las aceptan, ven A y B y los abren en Google Maps, llaman al cliente, marcan "Terminé" o cancelan con motivo. Mientras tienen una carrera comparten su ubicación. |
| `admin.html` | Administrador | Crea motorizados, los activa o desactiva, registra la cuota quincenal y ve los avisos 3 días antes del vencimiento (con botón de WhatsApp). También ve las carreras y las cancelaciones, aprueba las reseñas, cambia las tarifas y ve los números (visitas, llamadas por motorizado y pagos por quincena). |

Un motorizado **solo sale en la app** si el admin lo activó **y** tiene la quincena pagada.
Las estrellas cuentan solo cuando el admin aprueba la reseña.

## Conectar con Firebase (una sola vez)

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) y abre tu proyecto.
2. **Agregar app web** (ícono `</>`). Copia los datos de `firebaseConfig` y pégalos en **`firebase-config.js`**.
3. **Authentication → Método de acceso**, activa:
   - **Correo electrónico/contraseña** (para motorizados y admin).
   - **Teléfono** (para clientes). Los SMS de Firebase requieren el **plan Blaze** (pago por uso) y cada SMS a Venezuela tiene costo.
4. **Authentication → Configuración → Dominios autorizados**: agrega el dominio donde publiques la app (ej. `tuusuario.github.io`).
5. **Firestore Database → Crear base de datos**. Luego, en **Reglas**, pega el contenido de **`firestore.rules`** y toca **Publicar**.
6. **Crea tu usuario de administrador:**
   - En **Authentication → Usuarios → Agregar usuario**, escribe `admin@whereapp.app` (o `TUUSUARIO@whereapp.app`) y una clave.
   - Copia el **UID** que aparece en la lista.
   - En **Firestore → Iniciar colección**, crea la colección `admins` con un documento cuyo ID sea ese UID (sin campos, o con `nombre`).
   - Entra a `admin.html` con usuario `admin` y tu clave.

A los motorizados los creas desde el panel: les pones usuario y clave, y entran por `moto.html`.

## Publicar gratis (GitHub Pages)

**Settings → Pages** → elige la rama y la carpeta `/ (root)` → **Save**. Comparte con los clientes la
dirección principal, con los motorizados `…/moto.html`, y guarda para ti `…/admin.html`.

Los enlaces a `estilos.css` y a los `.js` en los `.html` llevan `?v=número`. Súbelo cada vez que publiques cambios.

## Probar en la computadora

Abierta en `localhost`, la app usa el simulador de Firebase en lugar de los datos reales:
`firebase emulators:start --only auth,firestore --project demo-whereapp` y en otra terminal `python3 -m http.server 8765`.

## Créditos

Mapas: [Leaflet](https://leafletjs.com) (licencia BSD, en `vendor/leaflet`) con datos de © OpenStreetMap.
Distancias por calle: [OSRM](https://project-osrm.org). Si no responde, se usa la línea recta × 1,3.
