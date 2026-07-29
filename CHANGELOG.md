# Changelog — Repositorio público (frontend)

Registro de qué cambió en cada entrega, para saber siempre qué versión tenés instalada.

## v1.6 — Corrección: formulario de alta de cliente
- `modulo-clientes.js`: el botón "Crear cliente" nunca tenía el formulario conectado (quedó pendiente sin terminar en una entrega anterior). Se agrega `FormularioAltaCliente` completo y se conecta el botón.
- `modulo-clientes.js`: mensajes de error más claros cuando falla por falta de permisos (sugiere revisar `roleSync.js` / rol asignado) en vez de un genérico "no fue posible cargar".

## v1.5 — Módulo de Auditoría + número de versión visible
- `modulo-auditoria.js` (nuevo): historial de cambios con filtro por entidad y vista expandible de diferencias (antes/después) por registro. Va a estar vacío hasta que `auditoriaWriter.js` esté corriendo en el servidor interno — no es un error.
- `app.js`: se agrega `VERSION_SISTEMA`, visible al pie del menú lateral y en la pantalla de login. Se actualiza en cada entrega junto con este changelog.
- Nota: filtrar auditoría por entidad va a pedir crear un índice compuesto la primera vez (normal, un clic desde el link del error).

## v1.4 — Módulo de Usuarios y Permisos
- `modulo-usuarios.js` (nuevo): alta de usuarios (crea el login en Firebase Auth + el documento en Firestore sin perder la sesión del administrador, usando una app secundaria de Firebase descartable), cambio de rol, activar/desactivar. Solo visible para el rol `superadmin`.
- Recordatorio incluido en la propia pantalla: un usuario recién creado o con el rol recién cambiado no ve reflejado el cambio hasta que `roleSync.js` (servidor interno) lo sincronice y el usuario reingrese sesión.
- `app.js`: se conecta la ruta `usuarios` del menú lateral.

## v1.3 — Módulo de Alertas
- `modulo-alertas.js` (nuevo): centro de alertas que cruza routers sin respuesta, órdenes al agente con error, IPs reservadas hace más de 2hs sin confirmarse, y clientes suspendidos por mora que igual figuran conectados. Se refresca solo cada 60s o con el botón de recarga.
- `app.js`: los indicadores de la topbar ("X operativos" / "X sin respuesta") ya no son valores fijos — se calculan de Firestore, y el de "sin respuesta" lleva directo al módulo de Alertas al hacer clic.
- Nota: la consulta de inconsistencia financiero/técnico va a pedir crear un índice compuesto en Firestore la primera vez que corra (es normal, un solo clic desde el link de error).

## v1.2 — Panel principal con datos reales
- `modulo-dashboard.js` (nuevo): los indicadores del panel principal ahora se calculan desde Firestore (conteos de clientes, cuentas vencidas, monto pendiente, routers operativos/sin respuesta, órdenes pendientes al agente). Se refresca solo cada 60s o con el botón de recarga.
- `app.js`: se saca el `PanelPrincipal` de datos simulados; queda solo `TarjetaIndicador` como componente compartido.
- `index.html`: se agrega la carga de `modulo-dashboard.js`.

## v1.1 — Corrección de errores de despliegue
- `app.js`: se centralizan `estiloTh` / `estiloTd` acá (antes se declaraban también en `modulo-clientes.js`, `modulo-ips.js` y `modulo-pagos.js`, lo que rompía la carga con `SyntaxError: Identifier 'estiloTh' has already been declared`, porque los scripts clásicos comparten un mismo scope global).
- `modulo-clientes.js`, `modulo-ips.js`, `modulo-pagos.js`: se quita la declaración duplicada.
- `firebase-config.js`: se corrige — debía usar el SDK compat (`firebase.initializeApp(...)`), no la sintaxis de módulo ES (`import { initializeApp } from ...`), que rompía con `Cannot use import statement outside a module` porque el `<script>` que lo carga no es `type="module"`.

## v1.0 — Primera versión funcional
- Shell: login, topbar, sidebar, panel principal (con datos de ejemplo).
- Módulo de Clientes: tabla con filtros/búsqueda + ficha consolidada, con detección de inconsistencia financiero/técnico.
- Módulo de Direcciones IP: inventario + selector controlado + reserva transaccional.
- Módulo de alta de servicio PPPoE (wizard de 3 pasos).
- Módulo de Cuentas y Pagos, integrado a la ficha del cliente.
- Módulo de Routers (estado + métricas).
- Deploy automático a GitHub Pages vía GitHub Actions.

---

**Convención de versión:** el número sube en la primera cifra decimal (v1.1 → v1.2) cuando se agrega o completa un módulo. Sube en la segunda cuando es una corrección de bug sobre algo ya entregado. Cuando el sistema tenga todos los módulos base completos, pasa a v2.0.
