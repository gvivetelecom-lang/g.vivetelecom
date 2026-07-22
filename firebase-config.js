// firebase-config.js
//
// Config pública del proyecto Firebase — NO es secreta, se puede
// commitear al repo público sin riesgo. Lo que protege los datos son
// las Firestore Security Rules (firestore.rules), no ocultar este
// archivo.
//
// Reemplazar con los valores reales del proyecto (Firebase Console >
// Configuración del proyecto > Tus apps > Config del SDK).

const firebaseConfig = {
  apiKey: "REEMPLAZAR",
  authDomain: "REEMPLAZAR.firebaseapp.com",
  projectId: "REEMPLAZAR",
  storageBucket: "REEMPLAZAR.appspot.com",
  messagingSenderId: "REEMPLAZAR",
  appId: "REEMPLAZAR",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Habilita persistencia offline básica: si se corta la conexión, la
// interfaz sigue mostrando el último dato conocido en vez de romperse.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('Persistencia offline no disponible:', err.code);
});
