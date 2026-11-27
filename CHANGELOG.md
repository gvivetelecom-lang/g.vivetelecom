# Changelog

Versionado semántico informal: patch para correcciones, minor para
nuevas funcionalidades (sección 17.2 de la especificación funcional).

## [0.20.0] — Salidas de mercadería (obsequios y probadores)

### Agregado
- Stock → Salidas (obsequios y probadores): registro de productos que
  salen del depósito sin venta. Datos: tipo (obsequio o probador /
  muestra), depósito, a quién se entrega, C.I./RUC, motivo, quién
  autoriza, observaciones y productos con cantidad.
- Cada salida descuenta el stock del depósito en la misma operación,
  deja un movimiento de egreso en Movimientos de stock y toma el último
  costo de cada producto para valorizar la salida.
- Documento A4 para el legajo administrativo (PDF): empresa, número
  SL-000001, datos de la salida, detalle con costo, total y tres líneas
  de firma (entregado por, autorizado por, recibido por). Se puede
  reimprimir desde el listado. Las salidas anuladas salen con marca
  "ANULADO".
- Anulación (admin y gerencia): repone el stock y deja constancia del
  motivo.
- Listado con búsqueda, filtros por tipo y estado, y exportación a Excel
  (una fila por producto).
- firestore.rules: nueva colección `salidasProductos` (hay que
  republicar las reglas).
- permissions.js: acción `stock.anular_salida`.

## [0.19.0] — Bancos

### Agregado
- Finanzas → Bancos: alta y edición de cuentas bancarias (banco, alias,
  N° de cuenta, titular, tipo, saldo inicial) con saldo actualizado en
  cada movimiento; las cuentas se desactivan, no se borran.
- Movimientos bancarios: depósito, retiro / débito (comisiones, gastos) y
  transferencia entre cuentas propias (genera dos movimientos enlazados).
- Cobros a clientes y pagos a proveedores: si la forma de pago no es
  efectivo se elige la cuenta bancaria, y el movimiento se acredita o
  debita en la misma operación (guarda el vínculo para poder anular).
- Conciliación: tildar los movimientos que aparecen en el extracto
  (uno por uno o todos los visibles), saldo en libros vs. saldo
  conciliado y comparación contra el saldo del extracto bancario.
- Extracto de movimientos con saldo corrido, exportable a Excel y PDF.
- firestore.rules: nuevas colecciones `cuentasBancarias` y
  `movimientosBancarios` (solo la marca de conciliación es editable).

### Limitaciones conocidas
- Las ventas del POS pagadas por transferencia o tarjeta todavía no se
  acreditan solas en un banco: se registran con "Depósito".
- Los cobros y pagos hechos antes de esta versión no tienen cuenta.

## [0.18.1] — Buscador en Productos

### Agregado
- Productos: buscador (sin distinguir mayúsculas ni tildes; varias palabras
  a la vez) por nombre, código interno, códigos de barra, marca, línea o
  categoría; filtros por marca, categoría y estado, con contador y botón
  "Limpiar". Exportar PDF/Excel usa el resultado filtrado.

## [0.18.0] — Informes de Ventas, Stock y Compras

### Agregado
- Informes → Ventas: período a elegir (con atajos Hoy / Este mes / Mes
  anterior / Últimos 30 días) y agrupación por producto, cliente, forma
  de pago, día o usuario. Indicadores: total vendido, ticket promedio,
  descuentos, IVA incluido y ventas a crédito. Las anuladas no se cuentan.
- Informes → Stock: existencias por depósito (o todos, con una columna
  por depósito), valorizadas al último costo y al precio minorista, con
  unidades vendidas en los últimos 90 días. Filtros por depósito, marca,
  categoría, "solo con stock" y "baja rotación" (con stock y sin ventas
  en 90 días).
- Informes → Compras: recepciones del período agrupadas por proveedor,
  producto (con costo promedio), condición de pago o día; compras a
  crédito y saldo pendiente.
- Los tres informes se exportan a Excel y a PDF (con logo y nombre de la
  empresa, totales y numeración de páginas).
- Menú Informes: nueva entrada "Compras".

## [0.17.0] — Finanzas: Pagos a proveedores

### Agregado
- Recepción de mercadería: nueva "Condición de pago" (Contado o Crédito)
  y fecha de vencimiento opcional. Una recepción a crédito queda como
  factura abierta con `saldoPendiente`. La lista muestra la condición.
- Finanzas → Pagos a proveedores: deuda total y vencida, deuda por
  proveedor con su próximo vencimiento, y "Pagar": monto (total o
  parcial), forma de pago y observaciones. El pago se aplica primero a las
  facturas que vencen antes.
- Cada pago es un registro inmutable (PG-000001, contador atómico) y, en
  la misma transacción, baja el saldo de las facturas y genera un
  movimiento financiero de egreso.
- Comprobante de pago en A4 (PDF, sin validez fiscal), al pagar y desde
  "Últimos pagos". Comparte el diseño del recibo de cobro.
- Dashboard: "Cuentas a pagar" con datos reales (total, facturas y vencidas).
- Reglas: nueva colección `pagosProveedores`; `recepciones` admite una
  actualización que solo reduce `saldoPendiente` (admin/gerencia/finanzas).

### Nota
- Las recepciones cargadas antes de esta versión no tienen condición de
  pago: se consideran contado (sin deuda).

## [0.16.0] — IVA por producto y liquidación en ventas

### Agregado
- Productos: nuevo campo IVA (10 %, 5 % o Exenta). Por defecto 10 %; los
  productos existentes sin dato se tratan como 10 %. Los precios de
  venta incluyen el IVA. Columna IVA en la lista y en las exportaciones
  a Excel y PDF.
- Ventas: cada ítem guarda su tasa (`ivaTasa`) y la venta guarda la
  liquidación (`liquidacionIva`: exentas, gravadas y IVA 5 %, gravadas e
  IVA 10 %, total IVA). El descuento se reparte proporcionalmente entre
  los ítems antes de calcular el IVA (10 % = neto/11, 5 % = neto/21).
- Comprobante A4: columnas de valor de venta Exentas / 5 % / 10 %, fila
  de subtotales por tasa y liquidación del IVA con total IVA. El ticket
  de 80 mm y el detalle en Ventas también muestran el IVA.
- Las ventas anteriores a esta versión se calculan como 10 % al imprimir.

### Cambiado
- El campo reservado `iva: null` por ítem se reemplazó por `ivaTasa`.
  Los campos de facturación electrónica (SIFEN) siguen sin implementarse
  (`fiscal: null` queda reservado en la venta).

## [0.15.0] — Dashboard con datos reales

### Agregado
- Inicio: indicadores en tiempo real — ventas del día y del mes (con
  cantidad de ventas), ticket promedio del mes, productos con stock bajo
  (y agotados), cuentas a cobrar (total y clientes).
- Gráfico de ventas de los últimos 7 días, ranking de los 5 productos
  más vendidos del mes y tabla de stock bajo/agotado.
- Las ventas anuladas no se cuentan. Si el rol no puede leer ventas, los
  indicadores de ventas se muestran como "—".
- Stock bajo = hasta 5 unidades (constante `UMBRAL_STOCK_BAJO`); solo
  cuenta productos que alguna vez tuvieron stock cargado.
- "Cuentas a pagar" queda en "—" hasta que exista Pagos a proveedores.

## [0.14.0] — Finanzas: Cuentas a cobrar

### Agregado
- Finanzas → Cuentas a cobrar: lista de clientes con saldo pendiente
  (total a cobrar), y "Cobrar" por cliente: monto (por defecto todo el
  saldo, o un cobro parcial), forma de pago y observaciones. El monto se
  imputa automáticamente a las ventas a crédito más antiguas.
- Cada cobro es un registro inmutable (CB-000001, contador atómico) y, en
  la misma transacción, baja el saldo de las ventas y del cliente y
  genera un movimiento financiero de ingreso (base para Bancos/Finanzas).
- Recibo de cobro en A4 (PDF, sin validez fiscal) al cobrar y desde el
  historial "Últimos cobros".
- Al anular una venta a crédito que ya tuvo cobros, el sistema avisa que
  ese dinero hay que devolverlo al cliente aparte y lo registra en la
  venta (`cobradoAlAnular`).
- Reglas: nueva colección `cobros` (admin/gerencia/finanzas, inmutable);
  `ventas` admite una actualización que solo reduce `saldoPendiente`.

## [0.13.0] — Anulación de ventas

### Agregado
- Ventas → Ver → "Anular venta" (solo admin y gerencia), con motivo obligatorio.
  En una sola transacción: devuelve el stock al depósito de la venta
  (movimiento "ingreso" con motivo "Anulación de venta V-…"), descuenta el
  crédito pendiente del saldo del cliente y marca la venta como anulada
  (quién, cuándo y por qué). Una venta solo se puede anular una vez.
- Las ventas anuladas se ven con su estado en el historial, tienen filtro
  "Anuladas", no suman al total mostrado, y su comprobante A4 sale con la
  marca "ANULADO".
- Reglas: `ventas` permite solo esa actualización (emitida → anulada, con
  campos acotados); sigue sin permitir editar ni borrar.

## [0.12.0] — Comprobante de venta en A4

### Agregado
- Comprobante de venta en hoja A4 (PDF), con el orden de campos de una
  factura: franja "sin validez fiscal", encabezado de empresa (logo,
  dirección de la sucursal predeterminada, ciudad, teléfono, correo,
  RUC) y número de comprobante, datos del cliente, fecha, condición de
  venta y moneda, detalle (código, descripción, unidad, cantidad, precio,
  valor de venta; varias páginas si hace falta), forma de pago, saldo a
  cobrar, subtotal, descuento, total y total en letras, y pie con
  usuario y numeración de páginas.
- Se imprime desde el POS al terminar la venta y desde Ventas → Ver.
  El ticket de 80 mm sigue disponible como alternativa.
- Configuración → Empresa: nuevos datos RUC, ciudad, teléfono y correo
  (todos opcionales) para el encabezado del comprobante.

### Nota
- Todavía no hay columnas de IVA (exentas / 5% / 10%): los productos aún
  no tienen tasa de IVA. Se agregan junto con la factura electrónica.

## [0.11.0] — Facturación / POS: Punto de venta, Ventas y Clientes

### Agregado
- Facturación / POS → Clientes: maestro (nombre, RUC/C.I., teléfono,
  email, dirección) con baja lógica. Acumula `saldoPendiente` por ventas a crédito.
- Facturación / POS → Punto de venta: buscador por nombre/código y
  lector de código de barra (Enter agrega directo), carrito con cantidades,
  precio mayorista automático al llegar a la cantidad mínima, descuento
  (solo admin/gerencia/cajero), pagos divididos (efectivo, tarjeta,
  transferencia, crédito a cobrar), vuelto de efectivo y selección de
  depósito de salida.
- La venta se registra en una sola transacción: código V-000001, precios
  tomados del producto en ese momento, valida stock suficiente, descuenta
  `stockPorDeposito`/`stockTotal`, genera movimientos de stock tipo
  "egreso" y suma el crédito al saldo del cliente.
- Ticket interno de 80 mm en PDF (con logo), descargable al vender y
  desde el historial. Sin validez fiscal.
- Facturación / POS → Ventas: historial con filtro contado/crédito, detalle y reimpresión.
- Campos reservados en cada venta para después: `fiscal: null` (SIFEN),
  `cajaId: null` (cajas), `iva: null` por ítem.
- Finanzas → "Clientes" pasó a llamarse "Cuentas a cobrar" (pronto).

### Reglas de seguridad
- Cajero y vendedor pueden actualizar en productos solo `stockPorDeposito`,
  `stockTotal` y `actualizadoEn`, y crear movimientos de stock solo de
  tipo egreso. Vendedor puede crear ventas.

## [0.10.1] — Migración a nuevo proyecto Firebase

### Cambiado
- `firebase-config.js` apunta al proyecto `erp-carlosg-2` (nueva cuenta
  de Google). Sitio: https://gvivetelecom-lang.github.io/erp-carlosg-2/
- Se agregaron scripts de respaldo/migración en `migracion/`
  (exportar e importar toda la base, conservando IDs y contadores).

## [0.10.0] — Compras: Órdenes de compra

### Agregado
- Compras → Órdenes de compra: pedido al proveedor (proveedor, depósito
  de destino, fecha estimada, ítems con cantidad y costo; sugiere el
  último costo del producto). Código OC-000001 con contador atómico.
  No mueve stock.
- Estados: Pendiente → Recibida parcial → Recibida, o Anulada (solo si
  aún no recibió mercadería). Filtro por estado y detalle con cantidad
  pedida vs. recibida.
- Recepción de mercadería ahora puede vincularse a una orden abierta:
  precarga proveedor, depósito y lo pendiente; valida que no se reciba
  más de lo pedido; actualiza la orden (parcial/recibida) en la misma
  transacción que suma el stock.
- Reglas: nueva colección `ordenesCompra` (sin borrado físico).

## [0.9.0] — Compras: Proveedores y Recepción de mercadería

### Agregado
- Compras → Proveedores: maestro (razón social, RUC, teléfono, email,
  dirección, condiciones de pago) con baja lógica.
- Compras → Recepción de mercadería: ingreso de stock contra la factura
  del proveedor (proveedor, depósito destino, N° de factura, ítems con
  cantidad y costo unitario, total). Código RC-000001 con contador
  atómico; suma stock por depósito, guarda `costoUltimo` en el producto
  y genera un movimiento de tipo "ingreso" visible en Movimientos de stock.
- El documento `recepciones` incluye `ordenCompraId: null`, reservado
  para vincular la futura Orden de compra sin migrar datos.
- Reglas: nueva colección `recepciones` (inmutable); `compras` puede
  crear movimientos de stock; `deposito` puede leer proveedores y ve el
  módulo Compras.

### Corregido
- Traslado y Recepción rechazan el mismo producto repetido en una sola
  operación (antes el segundo renglón pisaba el stock calculado del primero).
- Texto de ayuda de Productos actualizado (ya no dice "no disponible").

## [0.8.0] — Exportar Productos a PDF y Excel

### Agregado
- En Stock → Productos: botones "Exportar PDF" y "Exportar Excel" junto
  al título. Ambos exportan exactamente lo que está cargado en pantalla
  (código interno, nombre, código de barra, marca, línea, categoría,
  precios mayorista/minorista, stock y estado).
- El PDF incluye el logo de la empresa (el mismo que se subió en
  Configuración) arriba de la tabla, junto con el nombre de la empresa
  y la fecha de generación.
- Todo corre en el navegador, sin backend: se agregaron las librerías
  SheetJS (Excel) y jsPDF + autoTable (PDF) vía CDN en `index.html`.

## [0.7.0] — Traslado de mercadería + auditoría de stock

*(Reemplaza por completo el enfoque de la versión 0.7.0 anterior — esa
no llegó a subirse al repositorio.)*

### Agregado
- **Stock → Traslado de mercadería**: mueve stock entre depósitos con
  una nota de remisión (código autogenerado `R-000001`, depósito de
  origen y destino, observaciones, y una lista de productos con
  cantidad). Se puede agregar más de un producto por remisión. Valida
  que haya stock suficiente en el origen para cada producto antes de
  confirmar.
- **Stock → Movimientos de stock** pasó a ser una pantalla de solo
  lectura: un historial de auditoría de todo lo que se movió, con
  filtros por tipo y por producto. Ya no tiene botón para crear
  movimientos sueltos a mano — los movimientos se generan
  automáticamente desde Traslado de mercadería (y, más adelante, desde
  Compras y Facturación cuando se construyan esos módulos).
- Colección `remisiones` (inmutable, mismo patrón que
  `movimientosStock`): cada traslado confirmado genera un movimiento de
  tipo "Transferencia" por cada producto, todo en una sola transacción
  junto con la actualización de `producto.stockPorDeposito`.

### Quitado
- Se sacó el formulario genérico de "Nuevo movimiento" (que permitía
  crear Ingreso/Egreso/Transferencia/Ajuste sueltos a mano) — no
  encajaba con la idea de que Movimientos de stock sea un registro de
  auditoría, no un lugar para cargar movimientos manualmente.

## [0.6.1] — Corrección de bug

### Corregido
- En páginas con tablas anchas (como Productos), toda la pantalla se
  corría hacia la derecha en vez de que solo la tabla scrolleara —
  bug clásico de CSS Grid: la columna de contenido no tenía
  `min-width: 0`, así que crecía para acomodar la tabla y empujaba todo
  lo demás (barra superior incluida) fuera de la pantalla. Se agregó
  la clase `.main-panel` con `min-width: 0` para que ahora sea
  `.table-scroll` la única parte que scrollea horizontalmente.

## [0.6.0] — Responsive + imagen de producto

### Agregado
- **Imagen de producto**: se puede subir una foto (PNG/JPG) por producto,
  con el mismo mecanismo que el logo de la empresa — se redimensiona y
  comprime en el navegador (JPEG, hasta 480px de lado mayor) y se guarda
  como imagen chica en el propio documento de Firestore, sin necesitar
  Firebase Storage. Se ve como miniatura en la tabla y en grande dentro
  del formulario.
- **Layout responsive**: por debajo de 860px de ancho, el menú lateral
  pasa a ser un panel deslizable que se abre con el botón ☰ en la barra
  superior (antes directamente desaparecía y no había forma de navegar
  desde el celular). Se ajustaron además el padding del contenido, las
  tarjetas de KPIs/módulos, el tamaño de las tablas y la barra superior
  para pantallas angostas.

### Notas técnicas
- El helper `redimensionarImagenADataUrl` ahora acepta formato y calidad
  de salida (antes siempre PNG) para poder comprimir mejor las fotos de
  producto sin tocar el comportamiento del logo.

## [0.5.0] — Ficha de Productos ampliada

### Agregado
- Código interno autogenerado (formato `P-000001`), usando un contador
  atómico en `contadores/productos` (sección 15.5 de la especificación)
  para que nunca se repita o se pierda un código aunque dos personas
  creen productos al mismo tiempo. No es editable una vez creado.
- Código de barra principal + botón para agregar códigos de barra
  adicionales (variantes, presentaciones, códigos viejos, etc.).
- Precio de venta mayorista y minorista por separado, más "Cantidad
  mayorista": a partir de cuántas unidades se aplica el precio
  mayorista (ese cálculo se usará más adelante en el POS, todavía no
  construido).

### Cambiado
- Se sacaron los campos viejos "Código / SKU" y "Precio de venta"
  únicos — quedan reemplazados por los de arriba. Si ya habías cargado
  productos con el formulario anterior, esos registros no van a tener
  código interno (se asigna solo al crear, no al editar) — avisame si
  los querés migrar y armamos un script para asignárselo.

## [0.4.3] — Corrección de bug

### Corregido
- El logo en el sidebar se desbordaba del encabezado (rompía el layout,
  tapando "Buscar página" e "Inicio"). Se le dio un alto fijo de 36px a
  la imagen y `overflow: hidden` al contenedor, en vez de depender solo
  de `max-height`, que no lo estaba conteniendo de forma confiable.

## [0.4.2] — Corrección de bug

### Corregido
- Alta de registros nuevos en Marcas, Líneas, Categorías y Depósitos
  fallaba con el error "Unsupported field value: undefined" porque el
  formulario mandaba un campo `id: undefined` dentro del documento
  nuevo. El mensaje en pantalla decía "revisá los permisos", pero el
  problema no era de permisos — era este bug. Corregido en
  `MaestroCRUD` (app.js).

## [0.4.1] — Ajuste visual

### Corregido
- Logo en la pantalla de login: se agrandó (de 56px a 96px de alto) y
  se centró horizontalmente arriba del formulario.

## [0.4.0] — Fase 2 · Maestros de Stock completos

### Agregado
- Stock → Categorías (maestro CRUD, mismo patrón que Marcas/Líneas).
- Stock → Depósitos (maestro CRUD, con campo de dirección opcional).
- Stock → Productos: ficha propia (no usa el patrón genérico) con
  selects a Marca, Línea y Categoría, código/SKU opcional y precio de
  venta. El stock por depósito queda para el módulo de Movimientos de
  stock, todavía pendiente.

### Notas de versionado
- El número de versión vive en `firebase-config.js` (`APP_VERSION`) y
  se refleja en el pie del menú lateral de la app. Cada entrega que
  agrega o cambia funcionalidad suma una versión "minor" (0.X.0) acá en
  el changelog; los ajustes menores sin funcionalidad nueva sumarían un
  "patch" (0.X.Y).

## [0.3.0] — Fase 1 · Base (continuación)

### Agregado
- Logo de la empresa: se puede subir un PNG o JPG desde Seguridad →
  Empresa y sucursales. Se redimensiona en el navegador (sin subirlo a
  ningún servidor) y se guarda como imagen chica dentro del mismo
  documento de configuración en Firestore. Se muestra en la barra
  lateral y en la pantalla de login.
- `configuracion/general` ahora se puede leer sin haber iniciado sesión
  (nombre de la empresa + logo no son datos sensibles y hacen falta en
  la pantalla de login).

## [0.2.0] — Fase 1 · Base (continuación)

### Agregado
- Alta de usuarios nuevos desde la app (Seguridad → Usuarios → "+ Nuevo"):
  crea la cuenta en Firebase Authentication y su perfil en Firestore en
  un solo paso, sin cerrar la sesión del admin que lo está creando.
- Módulo Seguridad → Empresa y sucursales: nombre de la empresa y CRUD
  de sucursales (con una marcada como predeterminada). La barra superior
  ahora lee estos valores de Firestore en vez de mostrarlos fijos.
- Módulo Stock → Líneas (mismo patrón de maestro que Marcas).
- Reglas de Firestore para `configuracion` y `sucursales`.

## [0.1.0] — Fase 1 · Base

### Agregado
- Login con Firebase Authentication (email/contraseña).
- Layout general: sidebar colapsable con el menú completo del sistema,
  barra superior con contexto de empresa/sucursal y usuario.
- Módulo Seguridad → Usuarios (listado y edición de perfil).
- Módulo Stock → Marcas (maestro CRUD completo, patrón replicable).
- `firestore.rules` con matriz de permisos por rol y colecciones
  transaccionales inmutables.
- Pantallas de "módulo no activado" para Tienda Online, Contabilidad y
  Facturación electrónica.
- Pantallas de "en construcción" para el resto de las páginas del menú.
