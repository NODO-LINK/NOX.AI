// MojánYa — TODO el contenido de la app está aquí.
// Cambia nombres, teléfonos y motorizados en este archivo. No hace falta tocar app.js.

window.APP = {
  marca: {
    nombre: "MojánYa",
    eslogan: "Motorizados en El Moján",
    // Dirección pública de la app (la que te da GitHub Pages).
    url: "",
  },

  // Mensaje que se escribe solo al abrir WhatsApp con un motorizado. {nombre} se cambia por el del motorizado.
  mensaje: "Hola {nombre}, te escribo desde MojánYa. Necesito un servicio de delivery.",

  // Motorizados. Los de abajo son EJEMPLOS: cámbialos por los reales.
  // activo: true  → aparece en la app.   activo: false → no aparece (está libre de turno, de reposo, etc.).
  // telefono: con código de país, sin + ni espacios (ej. 584141234567).
  motorizados: [
    { nombre: "Carlos (ejemplo)", telefono: "584140000001", sector: "Casco central", moto: "Bera SBR 150", foto: "", activo: true },
    { nombre: "José (ejemplo)", telefono: "584140000002", sector: "Santa Cruz de Mara", moto: "Empire Owen 150", foto: "", activo: true },
    { nombre: "Luis (ejemplo)", telefono: "584140000003", sector: "Casco central", moto: "Suzuki GN 125", foto: "", activo: true },
    { nombre: "Pedro (ejemplo)", telefono: "584140000004", sector: "Carrasquero", moto: "Bera Socialista", foto: "", activo: false },
  ],
};
