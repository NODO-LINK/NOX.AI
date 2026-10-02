// ================================================================
//  CONTENIDO DE LA PÁGINA — edita solo este archivo
// ================================================================
//  La página se arma sola con lo que pongas aquí, de arriba a abajo.
//  Puedes quitar, repetir o cambiar de orden las secciones.
//  Las imágenes van en la carpeta "imagenes/". Si dejas una imagen
//  vacía (""), se muestra un recuadro gris de relleno.
// ================================================================

window.MARCA = "S P O T";

window.PRODUCTO = {
  imagenes: [""], // ej. ["imagenes/frente.png", "imagenes/lado.png"]

  titulo: "Nombre del producto",
  subtitulo: "Versión / modelo",

  // Tres datos destacados bajo el título
  datos: [
    { valor: "000", unidad: "u", etiqueta: "Dato 1" },
    { valor: "000", unidad: "u", etiqueta: "Dato 2" },
    { valor: "0.0", unidad: "u", etiqueta: "Dato 3" },
  ],
  nota: "Texto aclaratorio sobre los datos anteriores. Aquí puede ir una nota legal o una explicación breve.",

  secciones: [
    {
      tipo: "lista",
      titulo: "Detalles",
      elementos: ["Detalle 1", "Detalle 2", "Detalle 3", "Detalle 4", "Detalle 5", "Detalle 6"],
    },
    {
      tipo: "destacado",
      antetitulo: "Incluido",
      titulo: "Característica destacada",
      boton: { texto: "Ver video", enlace: "" },
      nota: "Descripción breve de la característica destacada.",
    },
    {
      tipo: "tarjetas",
      titulo: "Sección con tarjetas",
      texto: "Texto de introducción de la sección.",
      tarjetas: [
        { imagen: "", dato: "Dato", titulo: "Tarjeta 1", texto: "Descripción corta" },
        { imagen: "", dato: "Dato", titulo: "Tarjeta 2", texto: "Descripción corta" },
      ],
      nota: "Nota opcional bajo las tarjetas.",
      boton: { texto: "Más información", enlace: "" },
    },
    {
      tipo: "filas",
      titulo: "Sección con filas",
      filas: [
        { texto: "Elemento 1", dato: "Dato" },
        { texto: "Elemento 2", dato: "Dato" },
        { texto: "Elemento 3", dato: "Dato" },
      ],
      nota: "Nota opcional bajo las filas.",
      boton: { texto: "Más información", enlace: "" },
    },
    {
      tipo: "bloques",
      titulo: "Sección informativa",
      bloques: [
        { titulo: "Bloque 1", lineas: ["Línea de información"] },
        { titulo: "Bloque 2", lineas: ["Línea de información", "Línea de información"] },
        { titulo: "Bloque 3", lineas: ["Línea de información"] },
      ],
      boton: { texto: "Más información", enlace: "" },
    },
    {
      tipo: "lista",
      titulo: "Otra lista",
      elementos: ["Punto 1", "Punto 2", "Punto 3", "Punto 4"],
      boton: { texto: "Más información", enlace: "" },
    },
    {
      tipo: "ubicaciones",
      titulo: "Ubicaciones",
      texto: "Texto de introducción",
      lugares: [
        { nombre: "Ubicación 1", lineas: ["Dirección", "Ciudad"], extra: ["Dato adicional", "Dato adicional"] },
        { nombre: "Ubicación 2", lineas: ["Dirección", "Ciudad"], extra: ["Dato adicional", "Dato adicional"] },
      ],
    },
  ],

  // Botón final y texto de contacto (opcionales; borra la línea para quitarlos)
  botonFinal: { texto: "Botón principal", enlace: "" },
  contacto: { texto: "Para más información,", enlaceTexto: "contáctanos.", enlace: "" },
};
