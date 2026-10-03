// Moto Mandados — TODO el contenido de la app está aquí.
// Cambia nombres, precios, teléfonos y comercios en este archivo. No hace falta tocar app.js.

window.APP = {
  marca: {
    nombre: "MojánYa",
    eslogan: "Delivery en moto en El Moján",
    // Número de la central que recibe los pedidos por WhatsApp (con código de país, sin + ni espacios).
    whatsapp: "584140000000",
    instagram: "", // ej. "mojanya"
    // Dirección pública de la app (la que te da GitHub Pages).
    url: "",
  },

  // Tasa del día (Bs por 1 USD). Cámbiala cada día; los precios se escriben en USD.
  tasaBs: 40.0,

  // Horario de la central (24 h). Fuera de horario la app avisa que no hay motorizados.
  horario: { abre: "08:00", cierra: "22:00" },

  // Zonas y costo del delivery en USD.
  zonas: [
    { id: "centro", nombre: "El Moján — casco central", costo: 1.0 },
    { id: "moj-afueras", nombre: "El Moján — sectores alejados", costo: 1.5 },
    { id: "santacruz", nombre: "Santa Cruz de Mara", costo: 2.5 },
    { id: "carrasquero", nombre: "Carrasquero", costo: 4.0 },
  ],

  // Formas de pago que aceptas.
  pagos: [
    { id: "efectivo-usd", nombre: "Efectivo en dólares" },
    { id: "efectivo-bs", nombre: "Efectivo en bolívares" },
    { id: "pago-movil", nombre: "Pago móvil", detalle: "Banco 0000 · C.I. V-00.000.000 · 0414-0000000" },
    { id: "zelle", nombre: "Zelle", detalle: "correo@ejemplo.com" },
  ],

  categorias: [
    { id: "comida", nombre: "Comida", icono: "🍔" },
    { id: "pizza", nombre: "Pizza", icono: "🍕" },
    { id: "pollo", nombre: "Pollo", icono: "🍗" },
    { id: "mercado", nombre: "Mercado", icono: "🛒" },
    { id: "farmacia", nombre: "Farmacia", icono: "💊" },
    { id: "bebidas", nombre: "Bebidas", icono: "🥤" },
  ],

  // Comercios. Los de abajo son EJEMPLOS: cámbialos por los reales.
  // abierto: false lo muestra como "Cerrado". tiempo: minutos aproximados de entrega.
  comercios: [
    {
      id: "burger-moj",
      nombre: "Burger del Malecón (ejemplo)",
      categoria: "comida",
      descripcion: "Hamburguesas y perros calientes",
      tiempo: "25–35",
      abierto: true,
      imagen: "", // ej. "imagenes/burger.jpg"
      productos: [
        { id: "h1", nombre: "Hamburguesa clásica", detalle: "Carne, queso, tomate, lechuga y papas", precio: 4.5, seccion: "Hamburguesas" },
        { id: "h2", nombre: "Hamburguesa doble", detalle: "Doble carne, doble queso, tocineta", precio: 6.5, seccion: "Hamburguesas" },
        { id: "p1", nombre: "Perro caliente", detalle: "Con todo", precio: 2.0, seccion: "Perros" },
        { id: "b1", nombre: "Refresco 1,5 L", detalle: "", precio: 2.0, seccion: "Bebidas" },
      ],
    },
    {
      id: "pizzeria-mara",
      nombre: "Pizzería Mara (ejemplo)",
      categoria: "pizza",
      descripcion: "Pizzas artesanales al horno",
      tiempo: "35–45",
      abierto: true,
      imagen: "",
      productos: [
        { id: "z1", nombre: "Pizza margarita mediana", detalle: "Salsa de tomate, mozzarella y albahaca", precio: 7.0, seccion: "Pizzas" },
        { id: "z2", nombre: "Pizza pepperoni mediana", detalle: "", precio: 8.5, seccion: "Pizzas" },
        { id: "z3", nombre: "Pizza familiar mixta", detalle: "Jamón, maíz, pepperoni y champiñones", precio: 13.0, seccion: "Pizzas" },
      ],
    },
    {
      id: "pollos-guajira",
      nombre: "Pollos La Guajira (ejemplo)",
      categoria: "pollo",
      descripcion: "Pollo a la brasa y contornos",
      tiempo: "30–40",
      abierto: true,
      imagen: "",
      productos: [
        { id: "c1", nombre: "Pollo entero", detalle: "Con yuca, ensalada y salsas", precio: 12.0, seccion: "Pollo" },
        { id: "c2", nombre: "Medio pollo", detalle: "Con yuca y ensalada", precio: 6.5, seccion: "Pollo" },
        { id: "c3", nombre: "Porción de tajadas", detalle: "", precio: 1.5, seccion: "Contornos" },
      ],
    },
    {
      id: "farmacia-moj",
      nombre: "Farmacia Central (ejemplo)",
      categoria: "farmacia",
      descripcion: "Medicinas y cuidado personal",
      tiempo: "20–30",
      abierto: false,
      imagen: "",
      productos: [
        { id: "f1", nombre: "Acetaminofén 500 mg (10 tab.)", detalle: "", precio: 1.2, seccion: "Medicinas" },
        { id: "f2", nombre: "Suero oral", detalle: "", precio: 1.8, seccion: "Medicinas" },
      ],
    },
    {
      id: "bodegon-moj",
      nombre: "Bodegón El Puerto (ejemplo)",
      categoria: "mercado",
      descripcion: "Víveres, charcutería y licores",
      tiempo: "25–40",
      abierto: true,
      imagen: "",
      productos: [
        { id: "m1", nombre: "Harina de maíz 1 kg", detalle: "", precio: 1.3, seccion: "Víveres" },
        { id: "m2", nombre: "Arroz 1 kg", detalle: "", precio: 1.4, seccion: "Víveres" },
        { id: "m3", nombre: "Hielo (bolsa)", detalle: "", precio: 1.0, seccion: "Bebidas" },
        { id: "m4", nombre: "Agua mineral 5 L", detalle: "", precio: 2.0, seccion: "Bebidas" },
      ],
    },
  ],

  // Mandados: el cliente pide que un motorizado busque y lleve algo (encomiendas, compras, documentos).
  mandados: {
    titulo: "Mandados y encomiendas",
    texto: "Un motorizado busca lo que necesites y te lo lleva. El costo depende de la zona de entrega.",
  },

  // Formulario para motorizados que quieran trabajar con ustedes.
  motorizados: {
    titulo: "¿Tienes moto? Trabaja con nosotros",
    requisitos: ["Moto propia en buen estado", "Licencia y cédula vigentes", "Teléfono con WhatsApp", "Conocer El Moján y sus alrededores"],
  },
};
