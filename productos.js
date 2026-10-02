// ================================================================
//  CATÁLOGO DE EL SPOT — edita solo este archivo
// ================================================================
//  1. Cambia los datos de la tienda (nombre, WhatsApp, moneda…).
//  2. Cambia la lista de productos. Copia un bloque { … } para añadir uno.
//  3. Las fotos van en la carpeta "imagenes/". Si un producto no tiene
//     foto, se muestra su emoji.
// ================================================================

window.TIENDA = {
  nombre: "El Spot",
  eslogan: "Todo lo que buscas, en un solo lugar",
  // Número de WhatsApp con código de país, solo dígitos (ej. México 52…, Colombia 57…, España 34…)
  whatsapp: "5210000000000",
  moneda: "$",
  // Formato de los números: "es-MX", "es-CO", "es-ES", "es-AR"…
  formato: "es-MX",
  horario: "Lunes a sábado, 10:00 a 20:00",
  direccion: "Tu dirección aquí",
  instagram: "", // ej. "elspot.oficial" (sin @). Déjalo vacío si no tienes.
};

window.PRODUCTOS = [
  {
    nombre: "Camiseta Oversize",
    categoria: "Ropa",
    precio: 299,
    descripcion: "Algodón 100 %, corte holgado. Tallas S a XL.",
    imagen: "", // ej. "imagenes/camiseta.jpg"
    emoji: "👕",
    disponible: true,
    destacado: true,
  },
  {
    nombre: "Sudadera con capucha",
    categoria: "Ropa",
    precio: 649,
    precioAntes: 799, // opcional: muestra el precio tachado (oferta)
    descripcion: "Felpa suave por dentro, ideal para el frío.",
    imagen: "",
    emoji: "🧥",
    disponible: true,
  },
  {
    nombre: "Gorra Snapback",
    categoria: "Accesorios",
    precio: 249,
    descripcion: "Ajustable, bordado frontal.",
    imagen: "",
    emoji: "🧢",
    disponible: true,
  },
  {
    nombre: "Tenis urbanos",
    categoria: "Calzado",
    precio: 1299,
    descripcion: "Suela cómoda para todo el día. Tallas 24 a 29.",
    imagen: "",
    emoji: "👟",
    disponible: true,
    destacado: true,
  },
  {
    nombre: "Mochila",
    categoria: "Accesorios",
    precio: 549,
    descripcion: "Compartimento para laptop de 15\".",
    imagen: "",
    emoji: "🎒",
    disponible: false, // agotado: se muestra pero no se puede pedir
  },
  {
    nombre: "Lentes de sol",
    categoria: "Accesorios",
    precio: 199,
    descripcion: "Protección UV400.",
    imagen: "",
    emoji: "🕶️",
    disponible: true,
  },
];
