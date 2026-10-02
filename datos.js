// ================================================================
//  SPOT — DATOS DEL CATÁLOGO (es el único archivo que hay que editar)
// ================================================================
//  Los textos con { es: "…", en: "…" } se muestran según el idioma.
//  Las fotos y el video van en la carpeta "imagenes/".
//  Lo que está vacío ("") se muestra como relleno gris.
// ================================================================

window.SPOT = {
  marca: {
    nombre: "SPOT",
    logo: "", // ej. "imagenes/logo.svg" — si está vacío se muestra el nombre
    colorAcento: "#111111", // color de botones y detalles
    whatsapp: "", // con código de país, solo dígitos. ej. "5215512345678"
    instagram: "", // usuario sin @
    tiktok: "", // usuario sin @
    // Estadísticas gratis con GoatCounter (goatcounter.com): pon aquí tu código, ej. "spot"
    estadisticas: "",
    // Dirección pública del sitio cuando esté publicado (para el QR y compartir)
    url: "",
  },

  portada: {
    video: "", // ej. "imagenes/portada.mp4" (corto, sin sonido, menos de 10 MB)
    poster: "", // imagen que se ve mientras carga el video
    titulo: { es: "Encuentra tu estilo", en: "Find your style" },
    subtitulo: { es: "Nueva colección", en: "New collection" },
  },

  // Listas para los filtros
  tipos: {
    camisetas: { es: "Camisetas", en: "T-shirts" },
    sudaderas: { es: "Sudaderas", en: "Hoodies" },
    pantalones: { es: "Pantalones", en: "Pants" },
    chaquetas: { es: "Chaquetas", en: "Jackets" },
  },
  colecciones: {
    temporada: { es: "Temporada", en: "Season" },
    basicos: { es: "Básicos", en: "Essentials" },
  },
  generos: {
    hombre: { es: "Hombre", en: "Men" },
    mujer: { es: "Mujer", en: "Women" },
    unisex: { es: "Unisex", en: "Unisex" },
  },

  // ---------------- PRENDAS ----------------
  // etiqueta: "nuevo" | "agotado" | "limitada" | "proximamente" | ""
  // colores: cada color tiene su foto; el primero es el que se ve al entrar.
  prendas: [
    {
      id: "prenda-1",
      nombre: { es: "Nombre de la prenda 1", en: "Garment name 1" },
      tipo: "camisetas",
      coleccion: "temporada",
      genero: "unisex",
      etiqueta: "nuevo",
      estilo: [
        { valor: { es: "Casual", en: "Casual" }, etiqueta: { es: "Estilo", en: "Style" } },
        { valor: { es: "Diario", en: "Everyday" }, etiqueta: { es: "Ocasión", en: "Occasion" } },
        { valor: { es: "Verano", en: "Summer" }, etiqueta: { es: "Temporada", en: "Season" } },
      ],
      colores: [
        { nombre: { es: "Negro", en: "Black" }, hex: "#1a1a1a", imagen: "" },
        { nombre: { es: "Blanco", en: "White" }, hex: "#f4f4f2", imagen: "" },
        { nombre: { es: "Beige", en: "Beige" }, hex: "#d8c8b0", imagen: "" },
      ],
      descripcion: { es: "Descripción breve de la prenda.", en: "Short description of the garment." },
      detalles: [
        { es: "Detalle 1", en: "Detail 1" },
        { es: "Detalle 2", en: "Detail 2" },
        { es: "Detalle 3", en: "Detail 3" },
      ],
      cuidado: [
        { es: "Indicación de cuidado 1", en: "Care instruction 1" },
        { es: "Indicación de cuidado 2", en: "Care instruction 2" },
      ],
    },
    {
      id: "prenda-2",
      nombre: { es: "Nombre de la prenda 2", en: "Garment name 2" },
      tipo: "sudaderas",
      coleccion: "temporada",
      genero: "unisex",
      etiqueta: "limitada",
      estilo: [
        { valor: { es: "Urbano", en: "Urban" }, etiqueta: { es: "Estilo", en: "Style" } },
        { valor: { es: "Salir", en: "Going out" }, etiqueta: { es: "Ocasión", en: "Occasion" } },
        { valor: { es: "Invierno", en: "Winter" }, etiqueta: { es: "Temporada", en: "Season" } },
      ],
      colores: [
        { nombre: { es: "Gris", en: "Grey" }, hex: "#9a9a96", imagen: "" },
        { nombre: { es: "Negro", en: "Black" }, hex: "#1a1a1a", imagen: "" },
      ],
      descripcion: { es: "Descripción breve de la prenda.", en: "Short description of the garment." },
      detalles: [{ es: "Detalle 1", en: "Detail 1" }, { es: "Detalle 2", en: "Detail 2" }],
      cuidado: [{ es: "Indicación de cuidado 1", en: "Care instruction 1" }],
    },
    {
      id: "prenda-3",
      nombre: { es: "Nombre de la prenda 3", en: "Garment name 3" },
      tipo: "pantalones",
      coleccion: "basicos",
      genero: "hombre",
      etiqueta: "",
      estilo: [
        { valor: { es: "Clásico", en: "Classic" }, etiqueta: { es: "Estilo", en: "Style" } },
        { valor: { es: "Oficina", en: "Office" }, etiqueta: { es: "Ocasión", en: "Occasion" } },
      ],
      colores: [{ nombre: { es: "Azul marino", en: "Navy" }, hex: "#1f2a44", imagen: "" }],
      descripcion: { es: "Descripción breve de la prenda.", en: "Short description of the garment." },
      detalles: [{ es: "Detalle 1", en: "Detail 1" }],
      cuidado: [{ es: "Indicación de cuidado 1", en: "Care instruction 1" }],
    },
    {
      id: "prenda-4",
      nombre: { es: "Nombre de la prenda 4", en: "Garment name 4" },
      tipo: "chaquetas",
      coleccion: "temporada",
      genero: "mujer",
      etiqueta: "nuevo",
      estilo: [
        { valor: { es: "Elegante", en: "Elegant" }, etiqueta: { es: "Estilo", en: "Style" } },
        { valor: { es: "Noche", en: "Evening" }, etiqueta: { es: "Ocasión", en: "Occasion" } },
        { valor: { es: "Otoño", en: "Fall" }, etiqueta: { es: "Temporada", en: "Season" } },
      ],
      colores: [
        { nombre: { es: "Camel", en: "Camel" }, hex: "#b08a5a", imagen: "" },
        { nombre: { es: "Negro", en: "Black" }, hex: "#1a1a1a", imagen: "" },
      ],
      descripcion: { es: "Descripción breve de la prenda.", en: "Short description of the garment." },
      detalles: [{ es: "Detalle 1", en: "Detail 1" }, { es: "Detalle 2", en: "Detail 2" }],
      cuidado: [{ es: "Indicación de cuidado 1", en: "Care instruction 1" }],
    },
    {
      id: "prenda-5",
      nombre: { es: "Nombre de la prenda 5", en: "Garment name 5" },
      tipo: "camisetas",
      coleccion: "basicos",
      genero: "mujer",
      etiqueta: "agotado",
      estilo: [{ valor: { es: "Básico", en: "Basic" }, etiqueta: { es: "Estilo", en: "Style" } }],
      colores: [{ nombre: { es: "Blanco", en: "White" }, hex: "#f4f4f2", imagen: "" }],
      descripcion: { es: "Descripción breve de la prenda.", en: "Short description of the garment." },
      detalles: [{ es: "Detalle 1", en: "Detail 1" }],
      cuidado: [{ es: "Indicación de cuidado 1", en: "Care instruction 1" }],
    },
    {
      id: "prenda-6",
      nombre: { es: "Nombre de la prenda 6", en: "Garment name 6" },
      tipo: "sudaderas",
      coleccion: "temporada",
      genero: "hombre",
      etiqueta: "proximamente",
      estilo: [{ valor: { es: "Deportivo", en: "Sporty" }, etiqueta: { es: "Estilo", en: "Style" } }],
      colores: [{ nombre: { es: "Verde oliva", en: "Olive" }, hex: "#5b6142", imagen: "" }],
      descripcion: { es: "Descripción breve de la prenda.", en: "Short description of the garment." },
      detalles: [{ es: "Detalle 1", en: "Detail 1" }],
      cuidado: [{ es: "Indicación de cuidado 1", en: "Care instruction 1" }],
    },
  ],

  // ---------------- PÁGINAS EXTRA ----------------
  paginas: {
    nosotros: {
      titulo: { es: "Sobre nosotros", en: "About us" },
      imagen: "",
      parrafos: [
        { es: "Aquí va la historia de Spot: cómo empezó y qué la hace diferente.", en: "Spot's story goes here: how it started and what makes it different." },
        { es: "Segundo párrafo sobre la idea y los valores de la marca.", en: "Second paragraph about the brand's idea and values." },
      ],
    },
    envios: {
      titulo: { es: "Envíos", en: "Shipping" },
      imagen: "",
      parrafos: [
        { es: "Enviamos a todo el país.", en: "We ship nationwide." },
        { es: "Tiempos y forma de envío: escribe aquí los detalles.", en: "Shipping times and methods: write the details here." },
        { es: "¿Dudas? Escríbenos por WhatsApp.", en: "Questions? Message us on WhatsApp." },
      ],
    },
  },
};
