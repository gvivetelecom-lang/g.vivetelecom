# Sistema de Gestión Comercial — Carlos Gomes

Fase 1 · Base — login, seguridad, layout, menú, patrón de maestros.

Arquitectura: sin build, sin servidor propio. Archivos estáticos
(HTML/JS/CSS) servidos desde GitHub Pages, conectados directamente a
Firebase (Authentication + Firestore). Ver la especificación funcional
completa para el detalle de todos los módulos.

## Qué incluye esta entrega

- Pantalla de login (Firebase Authentication, email/contraseña).
- Layout general: sidebar colapsable con el menú completo del sistema,
  barra superior con contexto de empresa/sucursal y usuario.
- Módulo **Seguridad → Usuarios**: listado y edición de perfil (nombre,
  rol, activo) de usuarios ya existentes.
- Módulo **Stock → Marcas**: maestro CRUD completo, funcionando de punta
  a punta contra Firestore. Sirve como **patrón** para el resto de los
  maestros (Líneas, Categorías, Colores, Depósitos, etc.) — ver más abajo.
- `firestore.rules` con el modelo de permisos por rol y las colecciones
  transaccionales marcadas como inmutables.
- Módulos que todavía no se ejecutan (Tienda Online, Contabilidad,
  Facturación electrónica) aparecen en el menú pero muestran una
  pantalla de "módulo no activado", tal como se acordó.

## Qué falta (próximas entregas, según fases del documento)

Compras, Finanzas, POS operativo, Informes, y el resto de los maestros
de Stock. El **patrón de Marcas** (`MaestroCRUD` en `app.js`) ya resuelve
la mayoría de estos casos — activarlos es mayormente repetir el mismo
componente con otra colección y otros campos.

## Cómo agregar un maestro nuevo (ej. Líneas)

En `app.js`, dentro de `PageContent`, agregar un bloque como:

```jsx
if (moduleKey === "stock" && pageKey === "lineas") {
  return (
    <MaestroCRUD
      collectionName="lineas"
      title="Líneas"
      description="Maestro de líneas de producto."
      fields={[{ name: "nombre", label: "Nombre", required: true }]}
    />
  );
}
```

Y en `MENU`, quitar `soon: true` de la entrada correspondiente. La
colección `lineas` ya tiene reglas de seguridad definidas en
`firestore.rules` (mismo patrón que `marcas`).

## Puesta en marcha (checklist de la sección 17.3)

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com).
2. Habilitar **Authentication → Email/contraseña**.
3. Crear la base de datos **Cloud Firestore** (modo producción).
4. Copiar las credenciales del proyecto (Configuración del proyecto →
   Tus apps → Web) y pegarlas en `firebase-config.js`.
5. Definir la matriz de roles y permisos antes de programar más módulos
   (ya está la base en `permissions.js` y `firestore.rules`).
6. Publicar `firestore.rules`:
   ```
   firebase deploy --only firestore:rules
   ```
   (requiere `firebase-tools` instalado y `firebase init` corrido una vez
   sobre esta carpeta — solo hace falta para publicar las reglas, no para
   correr la app).
7. Crear el primer usuario administrador **manualmente**:
   - En Firebase Authentication → Users → Add user (email + contraseña).
   - En Firestore → colección `usuarios` → documento con **ID igual al
     UID** que generó Authentication, con estos campos:
     ```json
     { "nombre": "Carlos Gomes", "email": "...", "rol": "admin", "activo": true }
     ```
8. Crear un repositorio en GitHub, subir estos archivos, y activar
   **GitHub Pages** (Settings → Pages → Deploy from branch).
9. En Firebase Authentication → Settings → Authorized domains, agregar
   el dominio de GitHub Pages (ej. `usuario.github.io`).
10. Abrir la URL de GitHub Pages e iniciar sesión con el usuario
    administrador creado en el paso 7.

## Estructura de archivos

```
index.html          orden de carga de scripts (sección 17.1)
firebase-config.js   credenciales del proyecto Firebase (completar)
permissions.js       matriz de permisos para la UI (espejo de firestore.rules)
app.js               aplicación React (JSX, transformado en el navegador con Babel)
styles.css           estilos globales
firestore.rules      reglas de seguridad reales
CHANGELOG.md          historial de versiones
```

## Cómo agregar un nuevo usuario del equipo

1. Firebase Authentication → Users → Add user.
2. Firestore → colección `usuarios` → nuevo documento con ID = UID
   generado, con `nombre`, `email`, `rol` (uno de: admin, gerencia,
   compras, cajero, vendedor, deposito, finanzas) y `activo: true`.

No hace falta tocar código para dar de alta usuarios del día a día.
