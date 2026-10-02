# Spot — página informativa de producto

Plantilla de página informativa, con el estilo de las fichas de producto de Tesla:
imagen grande fija a la izquierda y la información en una columna a la derecha
(en el móvil, la imagen arriba y la información debajo). No es una tienda: no hay compras ni carrito.

## Archivos

| Archivo | Para qué |
|---|---|
| `contenido.js` | **Todo el contenido**: textos, imágenes y secciones. Es el único que hay que editar. |
| `imagenes/` | Fotos del producto y de las tarjetas. |
| `index.html`, `estilos.css`, `pagina.js` | Estructura, diseño y el código que arma la página. |

## Tipos de sección disponibles

En `contenido.js`, cada sección tiene un `tipo`. Se pueden quitar, repetir o cambiar de orden.

| Tipo | Cómo se ve |
|---|---|
| `lista` | Título y lista con viñetas |
| `destacado` | Antetítulo pequeño, título, botón gris y nota |
| `tarjetas` | Tarjetas de dos en dos, con imagen, dato, título y texto |
| `filas` | Filas con borde: texto a la izquierda y dato a la derecha |
| `bloques` | Bloques centrados: título en negrita y líneas de texto |
| `ubicaciones` | Recuadros seleccionables con nombre, dirección y datos |

Arriba de todo van el título, el subtítulo, tres datos destacados y una nota.
Al final, un botón azul opcional y un texto de contacto.

Los botones con `enlace` abren esa dirección; sin enlace se quedan como botón de muestra.

## Verlo

Abre `index.html` con doble clic.
