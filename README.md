# Catálogo de El Spot

Catálogo web de la tienda **El Spot**. Los clientes ven los productos, arman su pedido y lo envían
por **WhatsApp** con un toque. Funciona en móvil y en ordenador, y no necesita servidor ni base de datos.

## Cómo cambiar los productos

Todo se edita en **`productos.js`**:

- **Datos de la tienda:** nombre, eslogan, número de WhatsApp (con código de país, solo dígitos), moneda, horario, dirección e Instagram.
- **Productos:** cada producto es un bloque `{ … }`. Copia uno para añadir otro y borra los de ejemplo.

| Campo | Qué es | Ejemplo |
|---|---|---|
| `nombre` | Nombre del producto | `"Gorra Snapback"` |
| `categoria` | Sale como filtro arriba | `"Accesorios"` |
| `precio` | Precio sin símbolo | `249` |
| `precioAntes` | Opcional: precio tachado (oferta) | `299` |
| `descripcion` | Texto corto | `"Ajustable, bordado frontal."` |
| `imagen` | Foto en la carpeta `imagenes/` | `"imagenes/gorra.jpg"` |
| `emoji` | Se muestra si no hay foto | `"🧢"` |
| `disponible` | `false` = agotado | `true` |
| `destacado` | Sale primero con etiqueta | `true` |

**Fotos:** súbelas a la carpeta `imagenes/`, cuadradas si puedes y de menos de 300 KB, para que cargue rápido.

## Verlo

Abre `index.html` con doble clic en tu ordenador.

## Publicarlo gratis con GitHub Pages

1. En GitHub, entra al repositorio → **Settings** → **Pages**.
2. En "Branch", elige la rama del catálogo y la carpeta `/ (root)` → **Save**.
3. En un par de minutos tendrás un enlace tipo `https://usuario.github.io/repositorio/` para compartir
   en Instagram, WhatsApp o un código QR.
