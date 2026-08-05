# Changelog — Repositorio público (frontend)

Registro de qué cambió en cada entrega, para saber siempre qué versión tenés instalada.

## v1.32 — Vistas globales de Cuentas y Pagos
- `modulo-pagos.js`: los ítems del menú "Cuentas" y "Pagos" nunca estaban conectados a nada (mostraban "en construcción") — la funcionalidad real solo vivía dentro de la ficha del cliente. Se agregan `ModuloCuentasGlobal` y `ModuloPagosGlobal`: listado con filtro por estado, entre todos los clientes, que lleva a la ficha correspondiente al hacer clic. Las acciones (nueva cuenta, registrar pago) se siguen haciendo desde ahí, como corresponde con un cliente ya elegido.
- (Servidor interno, entregado aparte) `monitorRouters.js`: nuevo 6° proceso que consulta CPU/memoria/uptime/sesiones/latencia de cada router cada 60s — el módulo de Routers mostraba todo en "—" porque nada escribía esos datos.

## v1.31 — Corrección: Direcciones IP mostraba el ID crudo del cliente
- `modulo-ips.js`: la columna "Cliente" en la tabla de Direcciones IP mostraba el ID de Firestore en vez del nombre. Se agrega la resolución de nombres, mismo patrón ya usado en Clientes/Servicios/Planes.

## v1.30 — Modificar PPPoE: cambio de IP en caliente (4 de 4 pendientes del negocio — completo)
- **`agenteMikrotik.js` (servidor interno)**: nuevo tipo de orden `MODIFICAR_PPPOE` — cambia el `remote-address` del PPP Secret en el router, reconecta la sesión si estaba activa, libera la IP vieja (con registro en `ip_asignaciones`) y confirma la nueva. Todo sin pasar por suspender/dar de baja/alta de nuevo.
- `modulo-clientes.js`: botón **"Cambiar IP"** por servicio, reutilizando el mismo buscador de IP con reserva transaccional que ya usa el alta — evita que dos operadores elijan la misma IP al mismo tiempo.
- **⚠️ Este ZIP toca los dos lados.** Reemplazá `agenteMikrotik.js` en el servidor interno y reiniciá ese proceso.

**Con esto se completan los 4 pendientes del negocio** que quedaron anotados: Dar de baja, Vencimientos y cortes, Generación mensual de cuentas, Modificar PPPoE. Los 7 tipos de orden documentados (alta, perfil PPP, suspender, rehabilitar, desconectar, cambiar plan, dar de baja, modificar PPPoE — son 8 en realidad) están construidos y con al menos una prueba real contra el Mk.

## v1.29 — Generación mensual de cuentas, automática (3 de 4 pendientes del negocio)
Decisiones de negocio confirmadas: generación **automática** en fecha/hora configurable, **un solo día para todos los clientes** (no por grupo de corte).

- **`generarCuentas.js` (servidor interno, nuevo — 5° proceso)**: corre en segundo plano, revisa cada minuto si coincide el día/hora configurado, y genera una cuenta por cliente agrupando todos sus servicios activos (separadas por moneda si hiciera falta). Evita duplicar si el cliente ya tiene cuenta ese período. También escucha un disparo manual para pruebas.
- `modulo-cortes.js`: tarjeta "Generación mensual de cuentas" con día/hora, días hasta vencimiento/corte, botón **"Generar ahora"** (manual, para pruebas) y el resultado de la última corrida.
- `firestore.rules`: nueva colección `configuracion` (solo superadmin/comercial pueden escribirla).
- `package.json` / `iniciar-servidor.bat`: se agrega la dependencia `node-cron` y el 5° proceso al arranque.
- **⚠️ Este ZIP toca los dos lados.** Instalá `node-cron` (`npm install`), reemplazá `firestore.rules` y `iniciar-servidor.bat`, agregá `generarCuentas.js`, redesplegá las rules, y arrancá el proceso nuevo.
- Van 3 de 4 pendientes del negocio: Dar de baja, Vencimientos y cortes, Generación mensual (listos). Falta Modificar PPPoE.

## v1.28 — Módulo de Vencimientos y cortes (2 de 4 pendientes del negocio)
- `modulo-cortes.js` (nuevo): alta y edición de grupos de corte (día de vencimiento, días de gracia, día de corte), con la cantidad de servicios asignados a cada uno.
- `modulo-clientes.js`: la edición de un servicio ahora incluye asignarle un grupo de corte directamente (además de por lote, que ya existía).
- Van 2 de 4 pendientes del negocio: Dar de baja (listo), Vencimientos y cortes (listo), Generación mensual de cuentas, Modificar PPPoE.

## v1.27 — Dar de baja (1 de 4 pendientes del negocio)
- **`agenteMikrotik.js` (servidor interno)**: nuevo tipo de orden `DAR_DE_BAJA` — borra el PPP Secret del router, desconecta la sesión activa si había, libera la IP (queda "disponible" de nuevo) y deja el registro en `ip_asignaciones` (inmutable, nunca se borra), y marca el servicio como `baja` en ambos estados (técnico y comercial).
- `modulo-clientes.js`: botón **"Dar de baja"** por servicio, con confirmación explícita antes de ejecutar (es irreversible con un clic). Los servicios ya dados de baja dejan de mostrar los botones de acción.
- **⚠️ Este ZIP toca los dos lados.** Reemplazá `agenteMikrotik.js` en el servidor interno y reiniciá ese proceso.
- Van 4 pendientes del negocio anotados: Dar de baja (listo), Vencimientos y cortes (pantalla), Generación mensual de cuentas, Modificar PPPoE.

## v1.26 — Cambio de plan real: se aplica en el router, no solo en el sistema
- **`agenteMikrotik.js` (servidor interno)**: nuevo tipo de orden `CAMBIAR_PLAN` — ya estaba en la lista blanca de las rules desde el principio, faltaba el handler. Busca la configuración del plan nuevo para ese router, actualiza el perfil PPP del secret real, y si el cliente tenía una sesión activa la reconecta (RouterOS no aplica un profile nuevo a una sesión ya establecida hasta que se reconecta).
- `modulo-clientes.js`: "Editar servicio" ahora dispara esa orden real al cambiar el plan, en vez de solo actualizar Firestore. Antes de encolarla, verifica que el plan elegido tenga configuración técnica para el router del servicio — si no la tiene, avisa al toque en vez de generar una orden condenada a fallar.
- El usuario PPPoE se sigue corrigiendo solo en el sistema (cambiar el nombre real del secret en el router es más delicado, queda para más adelante).
- Se quita el botón "Cambiar plan" de la barra superior de la ficha (quedaba ambiguo con qué servicio, si el cliente tuviera más de uno) — la edición real vive en cada servicio, donde tiene sentido.
- **⚠️ Este ZIP toca los dos lados.** Reemplazá `agenteMikrotik.js` en el servidor interno y reiniciá ese proceso.

## v1.25 — Corrección: pantalla en blanco al abrir la ficha de un cliente
- `modulo-clientes.js`: al restaurar `CampoInfo` en la v1.24, se perdió también el `<div>` contenedor que envolvía el contenido — quedó HTML mal formado (`h.push is not a function`, un error interno de `htm` ante tags sin cerrar correctamente), y como `CampoInfo` se usa en la sección "Información general" de **toda** ficha de cliente, rompía la pantalla completa apenas se abría cualquier cliente.
- Se agrega un chequeo extra antes de armar cada ZIP: además de `node --check` (sintaxis JS), ahora se verifica que la cantidad de etiquetas `<div>`, `<form>`, `<table>`, etc. abiertas y cerradas coincida en los 14 archivos, para agarrar este tipo de error de edición antes de entregarlo.

## v1.24 — Editar servicio existente
- `modulo-clientes.js`: cada servicio en la ficha del cliente ahora tiene un botón **"Editar"** — permite cambiar el plan asociado y el usuario PPPoE. Marca con una advertencia que esto solo actualiza el registro en el sistema (no reconfigura el router — el tipo de orden `CAMBIAR_PLAN` para el agente sigue pendiente).
- Si el plan de un servicio fue borrado (por ejemplo con `eliminarPlanes.js`), ahora se muestra "(plan no encontrado — puede haber sido borrado)" en vez de solo el ID crudo, y el selector de edición lo deja elegir uno nuevo.
- **Corrección de sintaxis:** al insertar este bloque se perdió por error la declaración de `CampoInfo` (mismo tipo de bug que la v1.16) — corregido antes de armar el ZIP. Se verificaron los 14 archivos con `node --check` sin excepción.

## v1.23 — Cambio de modelo: una cuenta puede agrupar varios servicios
Antes: `cuentas/{id}.servicioId` — una cuenta = un solo servicio.
Ahora: `cuentas/{id}.lineas[]` — una cuenta pertenece al **cliente** y puede incluir uno o varios servicios (útil para corporativos con más de una conexión, que reciben una sola factura consolidada).

- `modulo-pagos.js`: "Nueva cuenta" ahora deja elegir varios servicios con checkboxes (valida que todos compartan la misma moneda), y la tabla de cuentas muestra cada fila expandible con el detalle de servicios incluidos.
- **`actualizarSaldos.js` (servidor interno)**: la rehabilitación automática ahora evalúa cada servicio de la cuenta por separado — un cliente con 2 servicios puede tener uno saldado y otro no, y no correspondía rehabilitar los dos a la vez solo porque el cliente en general no tuviera más deuda.
- **Compatibilidad:** las cuentas creadas antes de este cambio (con el `servicioId` viejo) se siguen leyendo sin problema — el código convierte automáticamente al formato nuevo al procesarlas.
- **⚠️ Este ZIP toca los dos lados.** Actualizá `actualizarSaldos.js` en el servidor interno y reiniciá ese proceso.
- Nota: la consulta de rehabilitación (`servicioIds array-contains` + `estado in`) va a pedir un índice compuesto la primera vez — normal, un clic desde el link del error.

## v1.22 — Corrección: cuentas en USD se mostraban como si fueran PYG
- `modulo-pagos.js`: al crear una cuenta manual, nunca se guardaba la moneda del plan (`moneda`) en el documento — la tabla asumía guaraníes siempre, así que un plan en USD (ej. "70 USD") aparecía como "Gs. 70". Ahora la cuenta guarda un snapshot de la moneda (igual que ya hacía con el precio) y la tabla la usa para formatear.
- **Cuentas ya creadas antes de este fix** van a seguir mostrando el símbolo incorrecto hasta que se les agregue el campo `moneda` a mano en Firestore, o se borren y recreen.

## v1.21 — Corrección: "Nueva cuenta" no aparecía en la lista
- `modulo-pagos.js`: `useCuentasCliente` no manejaba errores del listener de Firestore. Si la consulta (`clienteId` + `orderBy(periodo)`) necesitaba un índice compuesto todavía no creado, fallaba en silencio — la cuenta se creaba bien, pero la lista nunca se actualizaba ni avisaba por qué. Ahora muestra el error real, incluyendo el link para crear el índice si es ese el caso (Firestore lo pide una sola vez).
- Reportado con informe paso a paso — gracias por la claridad, ayudó a encontrarlo rápido.

## v1.20 — Creación manual de cuentas
- `modulo-pagos.js`: se agrega "Nueva cuenta" en la tarjeta de Cuentas de la ficha del cliente. Elegís el servicio, toma el precio del plan asociado automáticamente (con snapshot congelado, igual que se documentó desde el modelo de datos), y permite cargos/descuentos puntuales. Es un paso manual mientras se define la generación automática mensual (día del mes, manual vs. automática — sigue pendiente como decisión de negocio).

## v1.19 — Corrección: Suspender/Rehabilitar no estaban conectados
- `modulo-clientes.js`: los botones **Suspender**, **Rehabilitar**, **Cambiar plan** y **Ver historial** de la ficha del cliente eran maqueta visual desde la v1.0, sin `onClick`. Se implementan Suspender/Rehabilitar de verdad: actualizan el estado comercial del cliente y de sus servicios, y generan la orden correspondiente (`SUSPENDER_SERVICIO`/`REHABILITAR_SERVICIO`) para cada servicio activo.
- "Cambiar plan" y "Ver historial" quedan marcados como **"Próximamente"** (deshabilitados, con tooltip) en vez de simular que funcionan — así no vuelve a pasar que un botón no haga nada sin avisar.
- Se quita el botón "Registrar pago" duplicado de la barra superior (no hacía nada); el que sí funciona sigue estando en la tarjeta de Cuentas, más abajo en la misma ficha.
- La IP del cliente **no se libera** al suspender (se mantiene "asignada"), para que conserve la misma IP al rehabilitarse.

## v1.18 — Cache-busting: no más "Ctrl+Shift+R" a mano en cada entrega
- `index.html`: todos los `<script>` y el `<link>` de `styles.css` locales ahora cargan con `?v=1.18` al final. El navegador entiende que cambió el archivo y lo descarga de nuevo automáticamente, en vez de servir una copia vieja desde la caché — que fue la causa real del aviso de error que parecía "pegado" en la ficha del cliente.
- **A partir de ahora, cada entrega nueva va a traer ese número actualizado** en todos los archivos a la vez, así no hay que acordarse de hacer refresh forzado manualmente.

## v1.17 — Nombres en vez de IDs en la ficha del cliente
- `modulo-clientes.js`: el listado de servicios mostraba el ID del plan (`iPGqjNvbOfX3X4lsDf1B`) en vez de su nombre. Ahora resuelve y muestra el nombre real.
- `agenteMikrotik.js` (servidor interno): el mensaje de error de "plan sin configuración para este router" también usaba IDs crudos — ahora busca y muestra el nombre del plan y del router. **Requiere reemplazar `agenteMikrotik.js` en el servidor y reiniciar ese proceso** para que las próximas fallas ya salgan legibles (las órdenes viejas con error de antes de este fix van a seguir mostrando el ID, porque el texto ya quedó guardado así en Firestore — con "Reintentar" se genera una orden nueva que si vuelve a fallar, esta vez sí sale con nombres).

## v1.16 — Corrección: error de sintaxis que rompía todo el módulo de Clientes
- `modulo-clientes.js`: al insertar el bloque de `EstadoOrdenServicio` en la v1.15, se perdió por error la línea `function CampoInfo({ etiqueta, valor }) {`, dejando su cuerpo "suelto" — eso rompía la carga de **todo el archivo** (`SyntaxError: Illegal return statement`), no solo la ficha del cliente. Se restaura la declaración.
- Se agrega una verificación de sintaxis (`node --check`) sobre los 14 archivos `.js` del frontend antes de armar el ZIP, para evitar que esto se repita.

## v1.15 — Visibilidad de errores del agente en la ficha del cliente
- `modulo-clientes.js`: cada servicio en la ficha del cliente ahora muestra en tiempo real el estado de su última orden al agente — "en curso" mientras se procesa, o el mensaje de error exacto con un botón **"Reintentar"** si falló. Antes esto solo se podía ver entrando a Firestore Console o al módulo global de Alertas, sin contexto del cliente.
- "Reintentar" crea una orden nueva con los mismos datos (no se puede reescribir la fallida — las rules lo impiden a propósito, solo el agente transiciona estados de orden).
- Nota: esta consulta va a pedir crear un índice compuesto la primera vez (`ordenes_mikrotik`: `servicioId` + `fechaSolicitud`) — normal, un clic desde el link del error.

## (servidor interno, sin cambio de versión de frontend) — Activación automática del cliente
- `agenteMikrotik.js`: al completar con éxito el alta de un servicio PPPoE, si el cliente todavía estaba en estado "pendiente de instalación", ahora pasa automáticamente a "activo". Antes se quedaba en "pendiente" para siempre, aunque el servicio ya estuviera configurado y funcionando — no había nada que hiciera esa transición.
- **Clientes dados de alta antes de este fix quedan con el estado viejo** y hay que corregirlos a mano una vez (Firestore Console → `clientes/{id}` → `estadoComercial: "activo"`).
- Solo afecta `agenteMikrotik.js` — no requiere reinstalar el repo público ni redesplegar `firestore.rules`.

## v1.14 — Corrección: errores silenciosos al configurar un plan por router
- `modulo-planes.js`: `ConfiguracionPorRouter` fallaba en silencio si el guardado o el envío de la orden al agente daban error — solo quedaba registrado en la consola del navegador, la pantalla no mostraba nada y el formulario se quedaba abierto sin explicación. Ahora muestra el error real (incluyendo el caso típico de `firestore.rules` desactualizado en el servidor).
- **Recordatorio:** si en la v1.13 todavía no corriste `firebase deploy --only firestore:rules`, hacelo ahora — es la causa más probable de que "Guardar" se quedara colgado sin avisar.

## v1.13 — El perfil PPP se crea solo en el router, sin tocar Winbox
- **`agenteMikrotik.js`** (servidor interno): nuevo tipo de orden `CREAR_PERFIL_PPP` — crea el perfil PPP en el router si no existe, o le actualiza la velocidad si ya estaba, con el rate-limit calculado a partir de las velocidades cargadas en el plan.
- **`firestore.rules`** (servidor interno): se agrega `CREAR_PERFIL_PPP` a la lista de tipos de orden permitidos.
- **`modulo-planes.js`** (repo público): al guardar la configuración de un plan para un router, además de guardar el documento en Firestore, se envía automáticamente la orden al agente. La fila muestra "Orden enviada al agente" como confirmación.
- **⚠️ Este ZIP toca los dos lados otra vez.** Actualizá `firestore.rules` en el servidor interno y corré `firebase deploy --only firestore:rules`, y reiniciá el proceso `agenteMikrotik` (Ctrl+C y volver a correrlo) para que tome el nuevo handler.
- Nota sobre `rate-limit`: se arma como `subida/bajada` en Mbps (ej. `50M/50M`), que es el orden que espera RouterOS. Si necesitás asimetría real entre subida y bajada, ya están los dos campos separados en el formulario del plan.

## v1.12 — Selector de IP: búsqueda y "cargar más" en vez de un desplegable fijo a 50
- `modulo-ips.js`: `SelectorIP` deja de ser un `<select>` nativo (tope de 50, sin forma de buscar) y pasa a ser un buscador propio: escribís parte de la IP y filtra contra Firestore por prefijo sin traer todo el bloque, y un botón "Cargar más" permite seguir recorriendo la lista completa página por página.
- **Nota de orden conocida, no corregida todavía:** las IPs se ordenan alfabéticamente como texto (por eso `.100` aparece antes que `.11`), porque el ID del documento es la IP en formato de texto plano. Corregirlo de raíz implicaría cambiar el esquema de ID de documento en toda la colección `ip_direcciones` (usado también por la reserva transaccional y el agente) — lo dejamos pendiente como mejora futura, no bloquea el uso normal ya que ahora se puede buscar directamente.

## v1.11 — Corrección importante: la interfaz se colgaba al usar el alta de servicio
- **Causa:** `.count()` (agregación de Firestore) se estaba llamando de forma directa dentro de una cadena `.then()`, sin estar envuelto en una función `async`. Cuando esa llamada falla en el entorno del usuario, JavaScript la tira como una excepción sincrónica dentro de un `useEffect` — y como no hay un límite (Error Boundary) que la contenga, React deja de renderizar toda la pantalla.
- **Corrección:** se agrega `contarDocumentos()` en `app.js`, una función compartida que envuelve el conteo en una función `async` (cualquier falla se vuelve una promesa rechazada, nunca una excepción no controlada) y hace *fallback* a un conteo manual si la agregación no está disponible. Se reemplazan todos los usos directos de `.count()` en `app.js`, `modulo-dashboard.js` y `modulo-ips.js`.
- Si en la consola del navegador seguís viendo `[failed-precondition]: The query requires an index`, eso es un aviso aparte y normal — hacé clic en el link que trae el error una sola vez para crear el índice.

## v1.10 — Corrección: mensaje engañoso en el selector de IP
- `modulo-ips.js`: el selector de IP del alta de servicio mostraba "50 IP disponibles" cuando en realidad esa era solo la cantidad que trae la consulta (limitada a 50 a propósito, para no listar cientos en un desplegable). Ahora consulta el total real por separado y aclara "Mostrando las primeras 50 de 254 IP disponibles" cuando corresponde.

## v1.9 — Corrección: faltaba editar Planes y Routers
- `modulo-planes.js`: se agrega "Editar" en cada plan (nombre, precio, moneda, segmento, estado, impuestos, descuentos permitidos). Antes solo se podía crear y configurar por router, no modificar los datos base.
- `modulo-routers.js`: se agrega "Editar" en cada router (mismo patrón). El campo "Código" no es editable a propósito, porque es el ID del documento y tiene que seguir coincidiendo con `routersCredentials.json`.

## v1.8 — Corrección importante: faltaban las pantallas de carga de datos base
Se detectó que Routers, Planes y Direcciones IP solo tenían vistas de consulta, sin forma de cargar datos desde la web — y Servicios no tenía pantalla propia. Sin esto, no había manera de probar el alta de un cliente de punta a punta. Se completan las cuatro:

- `modulo-routers.js`: se agrega "Nuevo router" (formulario completo). El campo "Código" tiene que coincidir con la clave usada en `routersCredentials.json` del servidor interno.
- `modulo-planes.js` (nuevo): alta de planes + configuración técnica por router (perfil PPP, velocidades) directamente desde la web — antes esto solo estaba documentado, no tenía pantalla.
- `modulo-ips.js`: se agrega "Cargar bloque" — convierte un CIDR (ej. `10.20.30.0/24`) en las direcciones IP individuales, con previsualización antes de confirmar y barra de progreso durante la carga.
- `modulo-servicios.js` (nuevo): vista global de todos los servicios con filtros por estado/router, que lleva a la ficha del cliente dueño al hacer clic. El alta en sí se sigue haciendo desde la ficha del cliente (eso ya funcionaba).
- `app.js`: se conectan las rutas `servicios` y `planes`, y se agrega la navegación cruzada entre Servicios → ficha del cliente.

## v1.7 — Módulo de Operaciones por lote
- `modulo-lotes.js` (nuevo): permite suspender, rehabilitar o reasignar grupo de corte a varios clientes a la vez, con selección por checkbox y confirmación explícita antes de ejecutar. Genera una orden individual al agente por cada servicio afectado (no una orden "grupal").
- **⚠️ Requiere actualizar `firestore.rules` también en el servidor interno** (no solo el repo público): se agregó el campo `grupoCorteId` a `servicios`, habilitado para `admin_red`/`operador`/`superadmin` y también para `comercial`. Sin este cambio, la reasignación de corte por lote va a fallar con `permission-denied` para el rol comercial.
- Redeploy: `firebase deploy --only firestore:rules` desde la carpeta del servidor interno.

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
