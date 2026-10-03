# MojánYa — delivery en moto en El Moján

App web de delivery estilo Yummy para El Moján (Mara, Zulia): comercios con su menú, carrito,
mandados/encomiendas y registro de motorizados. Los pedidos llegan a la **central por WhatsApp**,
con el detalle, el total en dólares y bolívares, la dirección y la ubicación del cliente.

Funciona en el teléfono como app (se puede "Agregar a pantalla de inicio").

## Pantallas

| Ruta | Qué es |
|---|---|
| `#/` | Inicio: buscador, categorías, comercios abiertos/cerrados |
| `#/comercio/<id>` | Menú del comercio, agregar productos al carrito |
| `#/carrito` | Carrito, zona de entrega, dirección, ubicación, forma de pago y total |
| `#/mandado` | Pedir un motorizado para buscar/comprar/llevar algo |
| `#/pedidos` | Pedidos hechos desde ese teléfono |
| `#/motorizados` | Solicitud para trabajar como motorizado |

## Cómo cambiar el contenido

Todo está en **`datos.js`**:

- **Nombre, eslogan y WhatsApp de la central** → `marca`.
- **Tasa del día** → `tasaBs` (cámbiala cada día; los precios se escriben en dólares).
- **Horario** → `horario`.
- **Zonas y costo del delivery** → `zonas`.
- **Formas de pago** (pago móvil, Zelle…) → `pagos`.
- **Comercios y productos** → `comercios`. Los que vienen son ejemplos: cámbialos por los reales.
  Pon `abierto: false` para cerrar un comercio. Fotos opcionales en `imagenes/`.

## Publicar gratis (GitHub Pages)

1. En GitHub: **Settings → Pages** → elige la rama y la carpeta `/ (root)` → **Save**.
2. Copia la dirección que te da GitHub y ponla en `url` dentro de `datos.js`.

Los enlaces a `estilos.css`, `datos.js` y `app.js` en `index.html` llevan `?v=número`:
súbelo cada vez que publiques cambios para que los teléfonos no muestren la versión vieja.
