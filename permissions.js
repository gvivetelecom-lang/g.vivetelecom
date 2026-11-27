/**
 * permissions.js
 *
 * Espeja la matriz de permisos definida en firestore.rules, para uso
 * exclusivo de la interfaz (mostrar/ocultar menús y controles).
 *
 * IMPORTANTE: esto NUNCA reemplaza firestore.rules. Un usuario podría
 * editar este archivo en su navegador; la seguridad real siempre se
 * valida del lado de Firestore. Este archivo solo mejora la experiencia
 * de uso (no mostrar lo que el usuario no puede hacer).
 *
 * Roles iniciales (sección 12.1 de la especificación funcional):
 *   admin, gerencia, compras, cajero, vendedor, deposito, finanzas
 */

const ROLES = {
  ADMIN: "admin",
  GERENCIA: "gerencia",
  COMPRAS: "compras",
  CAJERO: "cajero",
  VENDEDOR: "vendedor",
  DEPOSITO: "deposito",
  FINANZAS: "finanzas",
};

/**
 * Matriz módulo → roles con acceso de lectura/navegación.
 * "*" significa "todos los roles autenticados".
 * Se usa para decidir qué entradas del menú lateral se muestran.
 */
const MODULE_ACCESS = {
  inicio: "*",
  stock: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.COMPRAS, ROLES.DEPOSITO, ROLES.VENDEDOR],
  compras: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.COMPRAS, ROLES.DEPOSITO],
  finanzas: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.FINANZAS],
  facturacion: [ROLES.ADMIN, ROLES.GERENCIA, ROLES.CAJERO, ROLES.VENDEDOR],
  online: [ROLES.ADMIN, ROLES.GERENCIA],
  contabilidad: [ROLES.ADMIN, ROLES.FINANZAS],
  informes: [ROLES.ADMIN, ROLES.GERENCIA],
  seguridad: [ROLES.ADMIN],
};

/**
 * Acciones sensibles por módulo (crear/editar/anular). Se usa para
 * habilitar o deshabilitar botones específicos, no solo el acceso al
 * módulo completo.
 */
const ACTION_ACCESS = {
  "stock.ajustar": [ROLES.ADMIN, ROLES.GERENCIA, ROLES.DEPOSITO],
  "stock.aprobar_perdida": [ROLES.ADMIN, ROLES.GERENCIA],
  "stock.anular_salida": [ROLES.ADMIN, ROLES.GERENCIA],
  "compras.aprobar_oc": [ROLES.ADMIN, ROLES.GERENCIA],
  "pos.descuento": [ROLES.ADMIN, ROLES.GERENCIA, ROLES.CAJERO],
  "pos.anular_venta": [ROLES.ADMIN, ROLES.GERENCIA],
  "finanzas.conciliar": [ROLES.ADMIN, ROLES.FINANZAS],
  "seguridad.gestionar_usuarios": [ROLES.ADMIN],
};

function hasModuleAccess(role, moduleKey) {
  const allowed = MODULE_ACCESS[moduleKey];
  if (!allowed) return false;
  if (allowed === "*") return true;
  return allowed.includes(role);
}

function hasActionAccess(role, actionKey) {
  const allowed = ACTION_ACCESS[actionKey];
  if (!allowed) return false;
  return allowed.includes(role);
}

function isAdminRole(role) {
  return role === ROLES.ADMIN;
}
