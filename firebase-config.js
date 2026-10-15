// Datos de tu proyecto de Firebase.
// Los copias de: Consola de Firebase → Configuración del proyecto → Tus apps → App web → "Configuración".
export const firebaseConfig = {
  apiKey: "AIzaSyD4a3YW1KJeURbqnaAKLllYWOqpif0fFf8",
  authDomain: "giftcard-aecf0.firebaseapp.com",
  projectId: "giftcard-aecf0",
  storageBucket: "giftcard-aecf0.firebasestorage.app",
  messagingSenderId: "774042478509",
  appId: "1:774042478509:web:643775ddca658774aba324",
};

// App Check (protección extra): pega aquí la "clave del sitio" de reCAPTCHA v3 entre las comillas.
// Mientras esté vacía, App Check queda apagado y la app funciona igual.
export const appCheckClave = "6LdeFOQtAAAAANqUXqGagMnYL8WBRl2j2Sw1nYzb";

// Avisos push (con la app cerrada): pega aquí la "Clave pública" del par de claves de Web Push.
// Se saca en: Consola de Firebase → Configuración del proyecto → Cloud Messaging → Certificados push web → Generar par de claves.
// Mientras esté vacía, los avisos solo llegan con la app abierta (como antes).
export const vapidClave = "";

// Mapa y buscador de Google: pega aquí la "clave de API" de Google Maps (Google Cloud → APIs y servicios → Credenciales).
// Necesita activadas "Map Tiles API" y "Places API (New)". Restríngela a tu página (nodo-link.github.io).
// Mientras esté vacía, se usa el mapa gratis de siempre.
export const mapsClave = "";
