// firebase-config.js
//
// Config pública del proyecto Firebase (g-vivetelecom) — NO es
// secreta, se puede commitear al repo público sin riesgo. Lo que
// protege los datos son las Firestore Security Rules
// (firestore.rules), no ocultar este archivo.
//
// Nota: se usa el SDK "compat" (v10, cargado con <script> normal en
// index.html) en vez del modular ESM que entrega por defecto la
// consola de Firebase, para mantener consistencia con el resto de los
// módulos de la app (db.collection(...), auth.signInWithEmailAndPassword(...)).
// Analytics se omite a propósito: es un sistema interno, no aporta
// nada acá y evita el banner de consentimiento de cookies.

const firebaseConfig = {
  apiKey: "AIzaSyD1lD23YzSCqC-1GoUXKb5bRONse1QUWQI",
  authDomain: "g-vivetelecom.firebaseapp.com",
  projectId: "g-vivetelecom",
  storageBucket: "g-vivetelecom.firebasestorage.app",
  messagingSenderId: "695130766213",
  appId: "1:695130766213:web:02792fc2383af6495de2ec",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Habilita persistencia offline básica: si se corta la conexión, la
// interfaz sigue mostrando el último dato conocido en vez de romperse.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('Persistencia offline no disponible:', err.code);
});

