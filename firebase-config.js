/**
 * firebase-config.js
 *
 * Proyecto Firebase: erp-carlosg-2.
 *
 * Nota: esta app usa el SDK "compat" de Firebase (scripts <script> clásicos,
 * variable global `firebase`) porque así está armado el resto del sistema
 * (sin build, sin import de módulos ES) — ver index.html, sección 17.1 de
 * la especificación funcional. Por eso esta versión no usa `import {...}
 * from "firebase-app.js"` como en el snippet del panel de Firebase (ese es
 * para el SDK modular); los valores son los mismos, solo cambia la forma
 * de inicializar.
 *
 * La "apiKey" de una app web de Firebase no es secreta: identifica el
 * proyecto, no autoriza nada por sí sola. La seguridad real vive en
 * firestore.rules, no acá.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAEHWssvMg4ypJJG8hmd2fhIOzoVCZ4L5k",
  authDomain: "erp-carlosg-2.firebaseapp.com",
  projectId: "erp-carlosg-2",
  storageBucket: "erp-carlosg-2.firebasestorage.app",
  messagingSenderId: "403699945741",
  appId: "1:403699945741:web:8b158feec35b1601c36044",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Habilita persistencia offline básica (opcional, mejora la experiencia
// en conexiones inestables; no reemplaza reglas de seguridad).
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Persistencia offline no disponible:", err.code);
});

const APP_VERSION = "0.20.0";

// Analytics (measurementId incluido en el proyecto) no se está usando en
// esta app: es un sistema interno de gestión, no un sitio con visitantes
// anónimos que valga la pena medir con Google Analytics. Si en algún
// momento se quiere activar, hay que agregar el script compat
// "firebase-analytics-compat.js" en index.html y descomentar:
//
// const analytics = firebase.analytics();
