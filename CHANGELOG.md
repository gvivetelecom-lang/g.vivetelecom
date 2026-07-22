# Changelog — Repositorio público (frontend)

Registro de qué cambió en cada entrega, para saber siempre qué versión tenés instalada.

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
