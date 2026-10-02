# Spot — catálogo de ropa

Catálogo informativo de la marca **Spot**: portada con video, filtros, fichas de prenda estilo Tesla,
español e inglés, y consultas por WhatsApp. No hay compras ni precios.
Las decisiones de diseño están en [`ESPECIFICACION.md`](ESPECIFICACION.md).

## Páginas

| Archivo | Qué es |
|---|---|
| `index.html` | Portada: video, "Recién llegado" y catálogo con filtros (tipo, colección, género) |
| `prenda.html?id=…` | Ficha de cada prenda: foto, colores, estilo, detalles, cuidado, WhatsApp y compartir |
| `info.html?p=nosotros` / `info.html?p=envios` | Sobre nosotros y Envíos |
| `qr.html` | Código QR del catálogo, para descargar |

## Cómo cambiar el contenido

Todo está en **`datos.js`**: marca, WhatsApp, redes, video, filtros, prendas y textos de las páginas.
Las fotos y el video van en `imagenes/`. Lo que está vacío se muestra como relleno gris.

- **Prenda nueva:** copia un bloque de `prendas` y cambia el `id` (sin espacios, ej. `"sudadera-negra"`).
- **Colores:** cada color lleva su `hex` (el círculo) y su `imagen` (la foto en ese color).
- **Etiquetas:** `"nuevo"`, `"agotado"`, `"limitada"`, `"proximamente"` o `""`. Las de `"nuevo"` salen en "Recién llegado".
- **Fotos:** con fondo blanco o transparente, en formato vertical (4:5).
- **Vista previa al compartir:** pon una imagen en `imagenes/compartir.jpg` (1200 × 630).

## Publicar gratis (GitHub Pages)

1. En GitHub: **Settings → Pages** → elige la rama y la carpeta `/ (root)` → **Save**.
2. Copia la dirección que te da GitHub y ponla en `url` dentro de `datos.js`, para que el QR y los enlaces compartidos apunten ahí.

## Estadísticas de visitas

Crea una cuenta gratis en [goatcounter.com](https://www.goatcounter.com) y pon tu código en `estadisticas` dentro de `datos.js`.

## Créditos

Generador de QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase (licencia MIT), en `vendor/qrcode.js`.
