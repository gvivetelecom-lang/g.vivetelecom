// firebase-config.js
//
// Config pública del proyecto Firebase — NO es secreta, se puede
// commitear al repo público sin riesgo. Lo que protege los datos son
// las Firestore Security Rules (firestore.rules), no ocultar este
// archivo.
//
// Reemplazar con los valores reales del proyecto (Firebase Console >
// Configuración del proyecto > Tus apps > Config del SDK).

// Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyD1lD23YzSCqC-1GoUXKb5bRONse1QUWQI",
    authDomain: "g-vivetelecom.firebaseapp.com",
    projectId: "g-vivetelecom",
    storageBucket: "g-vivetelecom.firebasestorage.app",
    messagingSenderId: "695130766213",
    appId: "1:695130766213:web:02792fc2383af6495de2ec",
    measurementId: "G-0BC3K74DMD"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);

// Habilita persistencia offline básica: si se corta la conexión, la
// interfaz sigue mostrando el último dato conocido en vez de romperse.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('Persistencia offline no disponible:', err.code);
});
