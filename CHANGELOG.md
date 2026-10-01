# CHANGELOG — Sistema Integral de Gestión de Clientes y Red MikroTik (Vive Telecom)

## v1.40

⚠️ Solo toca el lado público. No hay cambios en el servidor interno.

- **Fix: "Monto pendiente de cobro" en el Panel principal mezclaba monedas.** Sumaba el saldo de todas las cuentas pendientes/parciales/vencidas sin distinguir moneda, y lo mostraba siempre formateado en guaraníes — así que una cuenta en USD aparecía sumada como si fueran guaraníes. Ahora se agrupa por moneda: si todo el saldo pendiente está en una sola moneda, se muestra un número con su símbolo correcto (Gs. o US$); si hay saldo pendiente en más de una moneda, se muestran ambos montos apilados en la misma tarjeta.

## v1.39

⚠️ Solo toca el lado público. No hay cambios en el servidor interno ni en `firestore.rules` (la regla que permite este cambio ya existía desde antes, simplemente no había botón en la interfaz para usarla).

- **Exonerar una cuenta**: en la ficha del cliente, tabla de Cuentas, las cuentas en estado pendiente/parcial/vencida ahora tienen un botón "Exonerar". Pide un motivo obligatorio y, al confirmar, cambia el estado de la cuenta a "Exonerada" y guarda quién y cuándo la exoneró (y el motivo) en las observaciones de la cuenta.
- Solo visible para roles **comercial** y **superadmin** (mismo criterio que ya aplicaba en las reglas para quién puede tocar el estado de una cuenta).
- Bump de versión a v1.39.

## v1.38

⚠️ Solo toca el lado público (repositorio-github-publico). No hay cambios en el servidor interno — no hace falta redesplegar reglas ni reiniciar el agente.

- **Reporte de Cuentas exportable a Excel o PDF.** En el módulo global "Cuentas" (menú lateral, no la vista dentro de la ficha del cliente):
  - Nuevo filtro de **período** (selector mes/año) para acotar el reporte al mes que se quiere facturar/cerrar, combinable con el filtro de estado ya existente.
  - Botón **Excel**: genera un `.xlsx` con una fila por cuenta (cliente, período, detalle de servicios, moneda, total, pagado, saldo, vencimiento, corte, estado), usando SheetJS — se arma enteramente en el navegador, sin pasar por el servidor interno.
  - Botón **PDF**: genera un PDF con el mismo detalle en una tabla, con encabezado, fecha de generación y cantidad de cuentas, usando jsPDF + autotable.
  - Cuando se filtra por período, el límite de cuentas cargadas sube de 100 a 500 (para no cortar un mes con muchos clientes); si se llega a ese límite se muestra un aviso.
- Bump de versión a v1.38 (sidebar, login, cache-busting de todos los scripts).

## v1.37

⚠️ Este ZIP toca los dos lados — hay que reemplazar `firestore.rules` y `agenteMikrotik.js` en el servidor interno, redesplegar las reglas (`firebase deploy --only firestore:rules`) y reiniciar el agente en PM2.

- **S/N de la ONU**: nuevo campo opcional en el alta de servicio y en la edición de un servicio existente. Se muestra junto a la IP asignada en la ficha del cliente.
- **Ver / rotar contraseña PPPoE** desde la ficha del cliente, dentro de cada servicio:
  - "Ver contraseña": dispara una orden al agente (`CONSULTAR_PASSWORD_PPPOE`), que expone la contraseña guardada localmente en el servidor interno vía una subcolección temporal y auditada (`servicios/{id}/secreto/actual`), legible solo por roles técnicos (superadmin, admin_red, operador, soporte_tecnico) — nunca comercial ni auditor.
  - "Generar contraseña nueva" (`CAMBIAR_PASSWORD_PPPOE`): rota la contraseña en el router, desconecta la sesión activa si la hubiera, y guarda la nueva contraseña localmente.
  - Nuevas reglas de Firestore para la subcolección `secreto` (lectura restringida, escritura siempre `false` — solo la escribe el agente vía Admin SDK).

## Versiones anteriores

El historial detallado de v1.0 a v1.36 quedó en versiones previas de este archivo. En resumen, hasta acá el sistema cubre: alta y gestión de clientes (incl. razón social / nombre de fantasía), servicios PPPoE / IP directa / DHCP, planes con configuración por router, inventario de IP con reserva atómica, routers y monitoreo, suspensión/rehabilitación individual y por lote, cuentas y pagos multi-línea (internet + servicios adicionales no relacionados a internet como cableado o cámaras), facturación mensual automática configurable, grupos de corte, usuarios y roles con reseteo de contraseña, auditoría, y alertas de errores de órdenes MikroTik.
