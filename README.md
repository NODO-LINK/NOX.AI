# MojánYa — motorizados en El Moján

App web para contactar a los **motorizados activos** de El Moján (Mara, Zulia) por WhatsApp o llamada.
Muestra solo los que están activos y se pueden filtrar por sector.
Funciona en el teléfono como app ("Agregar a pantalla de inicio").

## Cómo cambiar el contenido

Todo está en **`datos.js`**:

- **Nombre y eslogan** → `marca`.
- **Mensaje de WhatsApp** que se escribe solo → `mensaje`.
- **Motorizados** → `motorizados`. Los que vienen son ejemplos: cámbialos por los reales.
  Pon `activo: true` para que aparezca y `activo: false` para ocultarlo. Fotos opcionales en `imagenes/`.

## Publicar gratis (GitHub Pages)

1. En GitHub: **Settings → Pages** → elige la rama y la carpeta `/ (root)` → **Save**.
2. Copia la dirección que te da GitHub y ponla en `url` dentro de `datos.js`.

Los enlaces a `estilos.css`, `datos.js` y `app.js` en `index.html` llevan `?v=número`:
súbelo cada vez que publiques cambios para que los teléfonos no muestren la versión vieja.
