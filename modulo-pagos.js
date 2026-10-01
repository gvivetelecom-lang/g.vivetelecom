// modulo-pagos.js — Cuentas del cliente + registro de pago con
// aplicación a uno o varios períodos (flujo 15.3 de la especificación
// funcional). Se carga después de modulo-alta-servicio.js.

const ESTADOS_CUENTA = {
  pendiente: { etiqueta: 'Pendiente', clase: 'etiqueta-pendiente' },
  parcial: { etiqueta: 'Pago parcial', clase: 'etiqueta-info' },
  pagada: { etiqueta: 'Pagada', clase: 'etiqueta-activo' },
  vencida: { etiqueta: 'Vencida', clase: 'etiqueta-suspendido' },
  anulada: { etiqueta: 'Anulada', clase: 'etiqueta-inactivo' },
  exonerada: { etiqueta: 'Exonerada', clase: 'etiqueta-inactivo' },
};

function EtiquetaEstadoCuenta({ estado }) {
  const info = ESTADOS_CUENTA[estado] ?? { etiqueta: estado, clase: 'etiqueta-info' };
  return html`<span class="etiqueta-estado ${info.clase}">${info.etiqueta}</span>`;
}

function formatoMoneda(valor, moneda = 'PYG') {
  if (valor == null) return '—';
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(valor);
}

function nombreEstadoCuenta(estado) {
  return ESTADOS_CUENTA[estado]?.etiqueta ?? estado ?? '';
}

function fechaLegible(timestamp) {
  return timestamp ? new Date(timestamp.seconds * 1000).toLocaleDateString('es-PY') : '';
}

function detalleLineas(cuenta) {
  return (cuenta.lineas ?? [])
    .map((l) => l.nombreSnapshot ?? l.planNombreSnapshot ?? '')
    .filter(Boolean);
}

// ---------------------------------------------------------------------
// Export del reporte de Cuentas — Excel (SheetJS) y PDF (jsPDF + autotable).
// Ambas librerías se cargan por <script> en index.html (sin build), y
// operan enteramente en el navegador: no hay backend/servidor interno
// involucrado, cada usuario exporta lo que tiene cargado en pantalla.
// ---------------------------------------------------------------------

function nombreArchivoReporte(extension, periodoFiltro) {
  const fecha = new Date().toISOString().slice(0, 10);
  const parte = periodoFiltro || 'todos-los-periodos';
  return `cuentas_${parte}_${fecha}.${extension}`;
}

function exportarCuentasExcel(cuentas, nombresClientes, periodoFiltro) {
  const filas = cuentas.map((c) => ({
    Cliente: nombresClientes[c.clienteId] ?? c.clienteId,
    Periodo: c.periodo ?? '',
    Detalle: detalleLineas(c).join('; '),
    Moneda: c.moneda ?? 'PYG',
    Total: c.total ?? 0,
    Pagado: c.pagado ?? 0,
    Saldo: c.saldo ?? 0,
    Vencimiento: fechaLegible(c.fechaVencimiento),
    Corte: fechaLegible(c.fechaCorte),
    Estado: nombreEstadoCuenta(c.estado),
  }));

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja['!cols'] = [
    { wch: 28 }, { wch: 9 }, { wch: 42 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Cuentas');
  XLSX.writeFile(libro, nombreArchivoReporte('xlsx', periodoFiltro));
}

function exportarCuentasPDF(cuentas, nombresClientes, periodoFiltro, estadoFiltro) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  const subtitulo = `${periodoFiltro || 'Todos los períodos'} — ${estadoFiltro === 'todos' ? 'todos los estados' : nombreEstadoCuenta(estadoFiltro)}`;

  doc.setFontSize(14);
  doc.text('Vive Telecom — Reporte de Cuentas', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`${subtitulo} · Generado ${new Date().toLocaleString('es-PY')} · ${cuentas.length} cuenta${cuentas.length === 1 ? '' : 's'}`, 14, 22);

  const filas = cuentas.map((c) => [
    nombresClientes[c.clienteId] ?? c.clienteId,
    c.periodo ?? '',
    detalleLineas(c).join(', '),
    formatoMoneda(c.total, c.moneda),
    formatoMoneda(c.pagado, c.moneda),
    formatoMoneda(c.saldo, c.moneda),
    fechaLegible(c.fechaVencimiento),
    nombreEstadoCuenta(c.estado),
  ]);

  doc.autoTable({
    startY: 28,
    head: [['Cliente', 'Periodo', 'Detalle', 'Total', 'Pagado', 'Saldo', 'Vence', 'Estado']],
    body: filas,
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [245, 73, 0] },
    columnStyles: { 2: { cellWidth: 75 } },
  });

  doc.save(nombreArchivoReporte('pdf', periodoFiltro));
}

// ---------------------------------------------------------------------
// Cuentas del cliente
// ---------------------------------------------------------------------

function useCuentasCliente(clienteId) {
  const [cuentas, setCuentas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    // where(clienteId) + orderBy(periodo) en campos distintos: la
    // primera vez que corre esta consulta, Firestore va a pedir crear
    // un índice compuesto. Sin manejar el error acá, el listener
    // fallaba en silencio — la cuenta se creaba bien, pero esta lista
    // nunca se enteraba de que había algo nuevo, ni avisaba por qué.
    const unsub = db.collection('cuentas')
      .where('clienteId', '==', clienteId)
      .orderBy('periodo', 'desc')
      .limit(24)
      .onSnapshot(
        (snap) => setCuentas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => {
          console.error(err);
          setError(
            err.code === 'failed-precondition'
              ? 'Firestore necesita crear un índice para esta consulta. Revisá la consola del navegador (F12): el mensaje trae un link para crearlo con un clic — después de eso, esta pantalla funciona sola.'
              : 'No fue posible cargar las cuentas de este cliente.'
          );
        }
      );
    return unsub;
  }, [clienteId]);

  return { cuentas, error };
}

// ---------------------------------------------------------------------
// Wizard de registro de pago — permite aplicar a una o varias cuentas
// (pago parcial, múltiples períodos, anticipos)
// ---------------------------------------------------------------------

function RegistrarPago({ clienteId, cuentas, usuarioId, onCompletado, onCancelar }) {
  const cuentasPendientes = cuentas.filter((c) => ['pendiente', 'parcial', 'vencida'].includes(c.estado));

  const [importe, setImporte] = useState('');
  const [medio, setMedio] = useState('efectivo');
  const [comprobante, setComprobante] = useState('');
  const [aplicaciones, setAplicaciones] = useState({}); // { cuentaId: monto }
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const totalAplicado = Object.values(aplicaciones).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const importeNum = Number(importe) || 0;
  const saldoSinAplicar = importeNum - totalAplicado;

  const setMontoAplicacion = (cuentaId, saldoCuenta, valor) => {
    const num = Math.max(0, Math.min(Number(valor) || 0, saldoCuenta));
    setAplicaciones((prev) => ({ ...prev, [cuentaId]: num }));
  };

  const aplicarAutomaticamente = () => {
    // Distribuye el importe de más antigua a más nueva, típico en
    // cobranza de servicios recurrentes.
    let restante = importeNum;
    const nuevo = {};
    for (const c of [...cuentasPendientes].sort((a, b) => a.periodo.localeCompare(b.periodo))) {
      if (restante <= 0) break;
      const aplicar = Math.min(restante, c.saldo);
      nuevo[c.id] = aplicar;
      restante -= aplicar;
    }
    setAplicaciones(nuevo);
  };

  const confirmar = async () => {
    if (importeNum <= 0) { setError('Ingrese un importe válido.'); return; }
    if (totalAplicado <= 0) { setError('Aplique el pago a al menos una cuenta.'); return; }
    if (totalAplicado > importeNum) { setError('El monto aplicado no puede superar el importe del pago.'); return; }

    setEnviando(true);
    setError(null);

    try {
      const pagoRef = db.collection('pagos').doc();
      await pagoRef.set({
        clienteId,
        fechaPago: firebase.firestore.FieldValue.serverTimestamp(),
        fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
        importe: importeNum,
        moneda: 'PYG',
        medio,
        comprobanteUrl: comprobante || null,
        usuario: usuarioId,
        estado: 'confirmado',
        observaciones: null,
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });

      // Cada aplicación se crea como documento independiente —
      // actualizarSaldos.js (servidor interno) las escucha y actualiza
      // el saldo/estado de cada cuenta en tiempo real.
      const lote = db.batch();
      Object.entries(aplicaciones).forEach(([cuentaId, monto]) => {
        if (monto <= 0) return;
        const ref = db.collection('aplicaciones_pago').doc();
        lote.set(ref, {
          pagoId: pagoRef.id,
          cuentaId,
          montoAplicado: monto,
          fecha: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
      await lote.commit();

      onCompletado();
    } catch (err) {
      setError('No fue posible registrar el pago. Intente nuevamente.');
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '620px' }}>
      <div class="card-titulo">Registrar pago</div>

      ${error && html`<div class="login-error">${error}</div>`}

      <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
        <div class="campo" style=${{ flex: '1 1 160px' }}>
          <label>Importe</label>
          <input type="number" min="0" value=${importe} onInput=${(e) => setImporte(e.target.value)} placeholder="0" />
        </div>
        <div class="campo" style=${{ flex: '1 1 160px' }}>
          <label>Medio de pago</label>
          <select value=${medio} onChange=${(e) => setMedio(e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="giro">Giro / billetera</option>
          </select>
        </div>
        <div class="campo" style=${{ flex: '1 1 160px' }}>
          <label>N° de comprobante</label>
          <input type="text" value=${comprobante} onInput=${(e) => setComprobante(e.target.value)} />
        </div>
      </div>

      <div class="flex items-center justify-between" style=${{ margin: '8px 0 12px' }}>
        <label style=${{ margin: 0 }}>Aplicar a cuentas</label>
        <button class="btn btn-secundario" onClick=${aplicarAutomaticamente} disabled=${importeNum <= 0}>
          Aplicar automáticamente (más antigua primero)
        </button>
      </div>

      ${cuentasPendientes.length === 0
        ? html`<p class="texto-secundario">Este cliente no tiene cuentas pendientes.</p>`
        : cuentasPendientes.map(
            (c) => html`
              <div key=${c.id} class="flex items-center justify-between gap-16" style=${{ padding: '8px 0', borderBottom: '1px solid var(--color-borde)' }}>
                <div>
                  <div style=${{ fontWeight: 500 }}>${c.periodo}</div>
                  <div class="texto-secundario">Saldo: ${formatoMoneda(c.saldo, c.moneda)}</div>
                </div>
                <input
                  type="number"
                  min="0"
                  max=${c.saldo}
                  style=${{ width: '140px' }}
                  value=${aplicaciones[c.id] ?? ''}
                  onInput=${(e) => setMontoAplicacion(c.id, c.saldo, e.target.value)}
                />
              </div>
            `
          )}

      <div class="flex justify-between" style=${{ margin: '16px 0', fontSize: 'var(--texto-secundario)' }} class="texto-secundario">
        <span>Total aplicado: ${formatoMoneda(totalAplicado)}</span>
        <span>${saldoSinAplicar > 0 ? `Sin aplicar: ${formatoMoneda(saldoSinAplicar)} (queda como anticipo)` : ''}</span>
      </div>

      <div class="flex justify-between">
        <button class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
        <button class="btn btn-principal" onClick=${confirmar} disabled=${enviando}>
          ${enviando ? 'Registrando…' : 'Confirmar pago'}
        </button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Tabla de cuentas del cliente
// ---------------------------------------------------------------------

function useServiciosCliente(clienteId) {
  const [servicios, setServicios] = useState([]);
  useEffect(() => {
    const unsub = db.collection('servicios').where('clienteId', '==', clienteId).onSnapshot((snap) => {
      setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [clienteId]);
  return servicios;
}

function hoyMasDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function periodoActual() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
}

function useServiciosAdicionalesFacturables(clienteId) {
  const [servicios, setServicios] = useState([]);
  useEffect(() => {
    const unsub = db.collection('servicios_adicionales')
      .where('clienteId', '==', clienteId)
      .where('estado', '==', 'activo')
      .onSnapshot(
        (snap) => setServicios(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            // Los "único" ya facturados no se ofrecen de nuevo
            .filter((s) => s.tipo === 'recurrente' || !s.facturado)
        ),
        (err) => console.error(err)
      );
    return unsub;
  }, [clienteId]);
  return servicios;
}

function FormularioCrearCuenta({ clienteId, usuarioId, onCompletado, onCancelar }) {
  const servicios = useServiciosCliente(clienteId);
  const adicionales = useServiciosAdicionalesFacturables(clienteId);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [adicionalesSeleccionados, setAdicionalesSeleccionados] = useState(new Set());
  const [planesPorId, setPlanesPorId] = useState({}); // planId -> plan
  const [periodo, setPeriodo] = useState(periodoActual());
  const [fechaVencimiento, setFechaVencimiento] = useState(hoyMasDias(10));
  const [fechaCorte, setFechaCorte] = useState(hoyMasDias(15));
  const [cargos, setCargos] = useState('0');
  const [descuentos, setDescuentos] = useState('0');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Carga (una vez por planId) los planes de todos los servicios del cliente
  useEffect(() => {
    servicios.forEach((s) => {
      if (!s.planId || planesPorId[s.planId]) return;
      db.collection('planes').doc(s.planId).get().then((doc) => {
        if (doc.exists) setPlanesPorId((prev) => ({ ...prev, [doc.id]: { id: doc.id, ...doc.data() } }));
      });
    });
  }, [servicios]);

  const alternar = (servicioId) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(servicioId) ? nuevo.delete(servicioId) : nuevo.add(servicioId);
      return nuevo;
    });
  };

  const alternarAdicional = (id) => {
    setAdicionalesSeleccionados((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
  };

  const lineasInternet = servicios
    .filter((s) => seleccionados.has(s.id))
    .map((s) => ({ origen: 'internet', referencia: s, plan: planesPorId[s.planId] }))
    .filter((l) => l.plan);

  const lineasAdicionales = adicionales
    .filter((a) => adicionalesSeleccionados.has(a.id))
    .map((a) => ({ origen: 'adicional', referencia: a, plan: { nombre: a.nombre, precio: a.precio, moneda: a.moneda, impuestos: 0 } }));

  const lineas = [...lineasInternet, ...lineasAdicionales];

  const monedas = new Set(lineas.map((l) => l.plan.moneda));
  const monedaMixta = monedas.size > 1;
  const moneda = lineas[0]?.plan.moneda ?? 'PYG';

  const subtotal = lineas.reduce((sum, l) => sum + l.plan.precio, 0);
  const impuestosMonto = lineas.reduce((sum, l) => sum + (l.plan.precio * (l.plan.impuestos || 0)) / 100, 0);
  const total = subtotal + impuestosMonto + (Number(cargos) || 0) - (Number(descuentos) || 0);

  const confirmar = async (e) => {
    e.preventDefault();
    if (lineas.length === 0) { setError('Seleccioná al menos un servicio.'); return; }
    if (monedaMixta) { setError('Los servicios elegidos tienen precios en monedas distintas — no se pueden combinar en la misma cuenta.'); return; }

    setEnviando(true);
    setError(null);
    try {
      const lineasParaGuardar = lineas.map((l) => ({
        origen: l.origen,
        referenciaId: l.referencia.id,
        nombreSnapshot: l.origen === 'internet' ? l.plan.nombre : l.referencia.nombre,
        importeSnapshot: l.plan.precio,
      }));

      await db.collection('cuentas').add({
        clienteId,
        servicioIds: lineasInternet.map((l) => l.referencia.id), // para array-contains del internet (suspensión/rehabilitación)
        serviciosAdicionalesIds: lineasAdicionales.map((l) => l.referencia.id),
        lineas: lineasParaGuardar,
        periodo,
        fechaEmision: firebase.firestore.FieldValue.serverTimestamp(),
        fechaVencimiento: firebase.firestore.Timestamp.fromDate(new Date(fechaVencimiento)),
        fechaCorte: firebase.firestore.Timestamp.fromDate(new Date(fechaCorte)),
        moneda,
        cargos: Number(cargos) || 0,
        descuentos: Number(descuentos) || 0,
        impuestos: impuestosMonto,
        total,
        pagado: 0,
        saldo: total,
        estado: 'pendiente',
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });

      // Los "único" ya incluidos se marcan facturados para no ofrecerlos de nuevo
      const marcasFacturado = lineasAdicionales
        .filter((l) => l.referencia.tipo === 'unico')
        .map((l) => db.collection('servicios_adicionales').doc(l.referencia.id).update({ facturado: true }));
      await Promise.all(marcasFacturado);

      onCompletado();
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para crear cuentas.' : 'No fue posible crear la cuenta.');
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '520px', marginBottom: '16px' }}>
      <div class="card-titulo">Nueva cuenta (manual)</div>
      <p class="texto-secundario" style=${{ marginTop: '-8px' }}>
        Podés incluir servicios de internet y servicios adicionales en la misma cuenta.
      </p>

      ${error && html`<div class="login-error">${error}</div>`}

      <form onSubmit=${confirmar}>
        <div class="campo">
          <label>Internet</label>
          ${servicios.length === 0
            ? html`<p class="texto-secundario">Este cliente no tiene servicios de internet.</p>`
            : servicios.map((s) => {
                const plan = planesPorId[s.planId];
                return html`
                  <label key=${s.id} class="flex items-center gap-8" style=${{ fontWeight: 400, padding: '6px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked=${seleccionados.has(s.id)} onChange=${() => alternar(s.id)} style=${{ width: 'auto' }} />
                    <span>${s.tipoConexion?.toUpperCase()} — ${s.usuarioPPPoE ?? s.id}</span>
                    <span class="texto-secundario">${plan ? `— ${plan.nombre} (${plan.precio} ${plan.moneda})` : 'sin plan asociado'}</span>
                  </label>
                `;
              })}
        </div>

        ${adicionales.length > 0 && html`
          <div class="campo">
            <label>Servicios adicionales</label>
            ${adicionales.map((a) => html`
              <label key=${a.id} class="flex items-center gap-8" style=${{ fontWeight: 400, padding: '6px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked=${adicionalesSeleccionados.has(a.id)} onChange=${() => alternarAdicional(a.id)} style=${{ width: 'auto' }} />
                <span>${a.nombre}</span>
                <span class="texto-secundario">— ${a.precio} ${a.moneda} (${a.tipo === 'unico' ? 'único' : 'mensual'})</span>
              </label>
            `)}
          </div>
        `}

        ${monedaMixta && html`<div class="login-error">Lo elegido tiene precios en monedas distintas — no se pueden combinar en la misma cuenta.</div>`}

        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>Período</label>
            <input type="text" value=${periodo} onInput=${(e) => setPeriodo(e.target.value)} placeholder="2026-08" />
          </div>
          <div class="campo" style=${{ flex: '1 1 140px' }}>
            <label>Vencimiento</label>
            <input type="date" value=${fechaVencimiento} onInput=${(e) => setFechaVencimiento(e.target.value)} />
          </div>
          <div class="campo" style=${{ flex: '1 1 140px' }}>
            <label>Corte</label>
            <input type="date" value=${fechaCorte} onInput=${(e) => setFechaCorte(e.target.value)} />
          </div>
        </div>

        <div class="flex gap-16">
          <div class="campo" style=${{ flex: 1 }}>
            <label>Cargos extra</label>
            <input type="number" value=${cargos} onInput=${(e) => setCargos(e.target.value)} />
          </div>
          <div class="campo" style=${{ flex: 1 }}>
            <label>Descuentos</label>
            <input type="number" value=${descuentos} onInput=${(e) => setDescuentos(e.target.value)} />
          </div>
        </div>

        ${lineas.length > 0 && !monedaMixta && html`
          <p><strong>Total: ${formatoMoneda(total, moneda)}</strong> <span class="texto-secundario">(${lineas.length} servicio${lineas.length > 1 ? 's' : ''})</span></p>
        `}

        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando || lineas.length === 0 || monedaMixta}>${enviando ? 'Creando…' : 'Crear cuenta'}</button>
        </div>
      </form>
    </div>
  `;
}

function puedeExonerar(rol) {
  return rol === 'superadmin' || rol === 'comercial';
}

async function exonerarCuenta(cuenta, usuarioId, motivo) {
  await db.collection('cuentas').doc(cuenta.id).update({
    estado: 'exonerada',
    observaciones: `Exonerada por ${usuarioId} el ${new Date().toLocaleString('es-PY')}. Motivo: ${motivo}`,
  });
}

function TablaCuentasCliente({ clienteId, usuarioId, rol }) {
  const { cuentas, error } = useCuentasCliente(clienteId);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [mostrarNuevaCuenta, setMostrarNuevaCuenta] = useState(false);

  return html`
    <div>
      ${mostrarNuevaCuenta && html`
        <${FormularioCrearCuenta}
          clienteId=${clienteId}
          usuarioId=${usuarioId}
          onCancelar=${() => setMostrarNuevaCuenta(false)}
          onCompletado=${() => setMostrarNuevaCuenta(false)}
        />
      `}

      ${mostrarPago && html`
        <div style=${{ marginBottom: '16px' }}>
          <${RegistrarPago}
            clienteId=${clienteId}
            cuentas=${cuentas}
            usuarioId=${usuarioId}
            onCancelar=${() => setMostrarPago(false)}
            onCompletado=${() => setMostrarPago(false)}
          />
        </div>
      `}

      <div class="card">
        <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
          <div class="card-titulo" style=${{ margin: 0 }}>Cuentas</div>
          <div class="flex gap-8">
            <button class="btn btn-secundario" onClick=${() => setMostrarNuevaCuenta(true)}>
              <i class="fa-solid fa-plus"></i> Nueva cuenta
            </button>
            <button class="btn btn-principal" onClick=${() => setMostrarPago(true)}>
              <i class="fa-solid fa-money-bill"></i> Registrar pago
            </button>
          </div>
        </div>

        ${error && html`<div class="login-error" style=${{ marginBottom: '16px' }}>${error}</div>`}

        ${cuentas.length === 0
          ? html`<p class="texto-secundario">Todavía no hay cuentas generadas para este cliente.</p>`
          : html`
              <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style=${{ borderBottom: '1px solid var(--color-borde)', textAlign: 'left' }}>
                    <th style=${estiloTh}>Período</th>
                    <th style=${estiloTh}>Total</th>
                    <th style=${estiloTh}>Pagado</th>
                    <th style=${estiloTh}>Saldo</th>
                    <th style=${estiloTh}>Vencimiento</th>
                    <th style=${estiloTh}>Estado</th>
                    <th style=${estiloTh}></th>
                  </tr>
                </thead>
                <tbody>
                  ${cuentas.map((c) => html`<${FilaCuenta} key=${c.id} cuenta=${c} usuarioId=${usuarioId} rol=${rol} />`)}
                </tbody>
              </table>
            `}
      </div>
    </div>
  `;
}

function FilaCuenta({ cuenta: c, usuarioId, rol }) {
  const [expandido, setExpandido] = useState(false);
  const [mostrarExonerar, setMostrarExonerar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const lineas = c.lineas ?? [];
  const puedeExpandir = lineas.length > 0;

  const estadosExonerables = ['pendiente', 'parcial', 'vencida'];
  const mostrarBotonExonerar = puedeExonerar(rol) && estadosExonerables.includes(c.estado);

  const confirmarExoneracion = async () => {
    if (!motivo.trim()) { setError('Ingresá un motivo.'); return; }
    setEnviando(true);
    setError(null);
    try {
      await exonerarCuenta(c, usuarioId, motivo.trim());
      setMostrarExonerar(false);
      setMotivo('');
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para exonerar cuentas.' : 'No fue posible exonerar la cuenta.');
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <${React.Fragment}>
      <tr style=${{ borderBottom: expandido || mostrarExonerar ? 'none' : '1px solid var(--color-borde)' }}>
        <td style=${{ ...estiloTd, cursor: puedeExpandir ? 'pointer' : 'default' }} onClick=${() => puedeExpandir && setExpandido(!expandido)}>
          <div class="flex items-center gap-8">
            ${puedeExpandir && html`<i class="fa-solid ${expandido ? 'fa-chevron-down' : 'fa-chevron-right'} texto-secundario" style=${{ fontSize: '0.7em' }}></i>`}
            <span>${c.periodo}</span>
            ${lineas.length > 1 && html`<span class="texto-secundario">(${lineas.length} servicios)</span>`}
          </div>
        </td>
        <td style=${estiloTd}>${formatoMoneda(c.total, c.moneda)}</td>
        <td style=${estiloTd} class="texto-secundario">${formatoMoneda(c.pagado, c.moneda)}</td>
        <td style=${estiloTd} style=${{ fontWeight: 600 }}>${formatoMoneda(c.saldo, c.moneda)}</td>
        <td style=${estiloTd} class="texto-secundario">
          ${c.fechaVencimiento ? new Date(c.fechaVencimiento.seconds * 1000).toLocaleDateString('es-PY') : '—'}
        </td>
        <td style=${estiloTd}><${EtiquetaEstadoCuenta} estado=${c.estado} /></td>
        <td style=${estiloTd}>
          ${mostrarBotonExonerar && html`
            <button class="btn btn-secundario" style=${{ padding: '4px 10px', fontSize: 'var(--texto-etiqueta)' }} onClick=${() => setMostrarExonerar(!mostrarExonerar)}>
              Exonerar
            </button>
          `}
        </td>
      </tr>
      ${expandido && html`
        <tr style=${{ borderBottom: '1px solid var(--color-borde)' }}>
          <td colspan="7" style=${{ padding: '0 16px 12px 40px', background: 'var(--color-fondo)' }}>
            ${lineas.map((l) => html`
              <div key=${l.referenciaId ?? l.servicioId} class="flex items-center justify-between" style=${{ padding: '4px 0' }}>
                <span class="texto-secundario">${l.nombreSnapshot ?? l.planNombreSnapshot}</span>
                <span class="mono texto-secundario">${formatoMoneda(l.importeSnapshot, c.moneda)}</span>
              </div>
            `)}
          </td>
        </tr>
      `}
      ${mostrarExonerar && html`
        <tr style=${{ borderBottom: '1px solid var(--color-borde)' }}>
          <td colspan="7" style=${{ padding: '12px 16px', background: 'var(--color-fondo)' }}>
            <div class="flex items-center gap-8" style=${{ flexWrap: 'wrap' }}>
              <span class="texto-secundario" style=${{ flex: '0 0 auto' }}>
                Exonerar el período <strong>${c.periodo}</strong> (saldo ${formatoMoneda(c.saldo, c.moneda)}). Esto anula el cobro pero deja el registro visible en el historial.
              </span>
            </div>
            <div class="flex items-center gap-8" style=${{ marginTop: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Motivo (obligatorio)"
                value=${motivo}
                onInput=${(e) => setMotivo(e.target.value)}
                style=${{ flex: '1 1 260px' }}
              />
              <button class="btn btn-secundario" onClick=${() => { setMostrarExonerar(false); setMotivo(''); setError(null); }} disabled=${enviando}>Cancelar</button>
              <button class="btn btn-peligro" onClick=${confirmarExoneracion} disabled=${enviando}>${enviando ? 'Exonerando…' : 'Confirmar exoneración'}</button>
            </div>
            ${error && html`<div class="login-error" style=${{ marginTop: '8px' }}>${error}</div>`}
          </td>
        </tr>
      `}
    <//>
  `;
}


// ---------------------------------------------------------------------
// Vistas globales — Cuentas y Pagos como items propios del menu
// (distintos de la tarjeta dentro de la ficha del cliente, que sigue
// funcionando igual). Solo lectura + navegacion al cliente, las
// acciones (registrar pago, nueva cuenta) siguen viviendo en la ficha.
// ---------------------------------------------------------------------

function useNombresClientesGlobal() {
  const [clientes, setClientes] = useState({});
  useEffect(() => {
    const unsub = db.collection('clientes').onSnapshot((snap) => {
      const mapa = {};
      snap.docs.forEach((d) => { mapa[d.id] = d.data().nombre; });
      setClientes(mapa);
    });
    return unsub;
  }, []);
  return clientes;
}

function useCuentasGlobal(estadoFiltro, periodoFiltro) {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    setError(null);

    // Sin filtro de período: los 100 más recientes (vista general).
    // Con período elegido (ej: cierre de mes), el límite sube a 500
    // porque ahí sí se quiere el universo completo de ese mes, no un
    // recorte arbitrario de "los últimos".
    let ref = db.collection('cuentas');
    if (estadoFiltro !== 'todos') ref = ref.where('estado', '==', estadoFiltro);
    if (periodoFiltro) ref = ref.where('periodo', '==', periodoFiltro);
    ref = ref.orderBy('fechaEmision', 'desc').limit(periodoFiltro ? 500 : 100);

    const unsub = ref.onSnapshot(
      (snap) => { setCuentas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false); },
      (err) => {
        console.error(err);
        setError(err.code === 'failed-precondition' ? 'Falta crear un indice - revisa la consola del navegador (F12) por el link.' : 'No fue posible cargar las cuentas.');
        setCargando(false);
      }
    );
    return unsub;
  }, [estadoFiltro, periodoFiltro]);

  return { cuentas, cargando, error };
}

function ModuloCuentasGlobal({ navegarACliente }) {
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [periodoFiltro, setPeriodoFiltro] = useState('');
  const { cuentas, cargando, error } = useCuentasGlobal(estadoFiltro, periodoFiltro);
  const nombresClientes = useNombresClientesGlobal();
  const hayDatos = !cargando && cuentas.length > 0;

  return html`
    <div>
      <div class="flex items-center justify-between gap-16" style=${{ marginBottom: '16px', flexWrap: 'wrap' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Cuentas</h1>
        <div class="flex items-center gap-8" style=${{ flexWrap: 'wrap' }}>
          <input
            type="month"
            value=${periodoFiltro}
            onChange=${(e) => setPeriodoFiltro(e.target.value)}
            title="Filtrar por período (para el cierre de mes)"
            style=${{ maxWidth: '150px' }}
          />
          ${periodoFiltro && html`
            <button class="btn btn-secundario" onClick=${() => setPeriodoFiltro('')} title="Quitar filtro de período">
              <i class="fa-solid fa-xmark"></i>
            </button>
          `}
          <select value=${estadoFiltro} onChange=${(e) => setEstadoFiltro(e.target.value)} style=${{ maxWidth: '200px' }}>
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Pago parcial</option>
            <option value="pagada">Pagada</option>
            <option value="vencida">Vencida</option>
            <option value="anulada">Anulada</option>
            <option value="exonerada">Exonerada</option>
          </select>
          <button
            class="btn btn-secundario"
            disabled=${!hayDatos}
            onClick=${() => exportarCuentasExcel(cuentas, nombresClientes, periodoFiltro)}
            title="Exportar el listado de abajo a Excel"
          >
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
          <button
            class="btn btn-secundario"
            disabled=${!hayDatos}
            onClick=${() => exportarCuentasPDF(cuentas, nombresClientes, periodoFiltro, estadoFiltro)}
            title="Exportar el listado de abajo a PDF"
          >
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
        </div>
      </div>

      ${periodoFiltro && cuentas.length === 500 && html`
        <div class="login-error" style=${{ marginBottom: '16px', background: 'rgba(217,119,6,0.08)', color: 'var(--estado-pendiente)', borderColor: 'rgba(217,119,6,0.25)' }}>
          Se alcanzó el límite de 500 cuentas para este período. Si hay más, avisame para subir el límite.
        </div>
      `}

      ${error && html`<div class="login-error" style=${{ marginBottom: '16px' }}>${error}</div>`}

      <div class="card" style=${{ padding: 0 }}>
        ${cargando
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">Cargando cuentas...</div>`
          : cuentas.length === 0
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">No hay cuentas con este filtro.</div>`
          : html`
              <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style=${{ borderBottom: '1px solid var(--color-borde)', textAlign: 'left' }}>
                    <th style=${estiloTh}>Cliente</th>
                    <th style=${estiloTh}>Periodo</th>
                    <th style=${estiloTh}>Total</th>
                    <th style=${estiloTh}>Saldo</th>
                    <th style=${estiloTh}>Vencimiento</th>
                    <th style=${estiloTh}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${cuentas.map(
                    (c) => html`
                      <tr key=${c.id} style=${{ borderBottom: '1px solid var(--color-borde)', cursor: 'pointer' }} onClick=${() => navegarACliente(c.clienteId)}>
                        <td style=${estiloTd}>${nombresClientes[c.clienteId] ?? c.clienteId}</td>
                        <td style=${estiloTd}>${c.periodo}</td>
                        <td style=${estiloTd}>${formatoMoneda(c.total, c.moneda)}</td>
                        <td style=${estiloTd} style=${{ fontWeight: 600 }}>${formatoMoneda(c.saldo, c.moneda)}</td>
                        <td style=${estiloTd} class="texto-secundario">${c.fechaVencimiento ? new Date(c.fechaVencimiento.seconds * 1000).toLocaleDateString('es-PY') : '-'}</td>
                        <td style=${estiloTd}><${EtiquetaEstadoCuenta} estado=${c.estado} /></td>
                      </tr>
                    `
                  )}
                </tbody>
              </table>
            `}
      </div>
    </div>
  `;
}

function usePagosGlobal(estadoFiltro) {
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    let ref = db.collection('pagos').orderBy('fechaPago', 'desc').limit(100);
    if (estadoFiltro !== 'todos') {
      ref = db.collection('pagos').where('estado', '==', estadoFiltro).orderBy('fechaPago', 'desc').limit(100);
    }

    const unsub = ref.onSnapshot(
      (snap) => { setPagos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false); },
      (err) => {
        console.error(err);
        setError(err.code === 'failed-precondition' ? 'Falta crear un indice - revisa la consola del navegador (F12) por el link.' : 'No fue posible cargar los pagos.');
        setCargando(false);
      }
    );
    return unsub;
  }, [estadoFiltro]);

  return { pagos, cargando, error };
}

function ModuloPagosGlobal({ navegarACliente }) {
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const { pagos, cargando, error } = usePagosGlobal(estadoFiltro);
  const nombresClientes = useNombresClientesGlobal();

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Pagos</h1>
        <select value=${estadoFiltro} onChange=${(e) => setEstadoFiltro(e.target.value)} style=${{ maxWidth: '200px' }}>
          <option value="todos">Todos los estados</option>
          <option value="confirmado">Confirmado</option>
          <option value="pendiente_conciliacion">Pendiente de conciliacion</option>
          <option value="anulado">Anulado</option>
        </select>
      </div>

      ${error && html`<div class="login-error" style=${{ marginBottom: '16px' }}>${error}</div>`}

      <div class="card" style=${{ padding: 0 }}>
        ${cargando
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">Cargando pagos...</div>`
          : pagos.length === 0
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">No hay pagos con este filtro.</div>`
          : html`
              <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style=${{ borderBottom: '1px solid var(--color-borde)', textAlign: 'left' }}>
                    <th style=${estiloTh}>Cliente</th>
                    <th style=${estiloTh}>Fecha</th>
                    <th style=${estiloTh}>Importe</th>
                    <th style=${estiloTh}>Medio</th>
                    <th style=${estiloTh}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${pagos.map(
                    (p) => html`
                      <tr key=${p.id} style=${{ borderBottom: '1px solid var(--color-borde)', cursor: 'pointer' }} onClick=${() => navegarACliente(p.clienteId)}>
                        <td style=${estiloTd}>${nombresClientes[p.clienteId] ?? p.clienteId}</td>
                        <td style=${estiloTd} class="texto-secundario">${p.fechaPago ? new Date(p.fechaPago.seconds * 1000).toLocaleDateString('es-PY') : '-'}</td>
                        <td style=${estiloTd} style=${{ fontWeight: 600 }}>${formatoMoneda(p.importe, p.moneda)}</td>
                        <td style=${estiloTd} class="texto-secundario">${p.medio}</td>
                        <td style=${estiloTd}>
                          <span class="etiqueta-estado ${p.estado === 'confirmado' ? 'etiqueta-activo' : p.estado === 'anulado' ? 'etiqueta-suspendido' : 'etiqueta-pendiente'}">${p.estado}</span>
                        </td>
                      </tr>
                    `
                  )}
                </tbody>
              </table>
            `}
      </div>
    </div>
  `;
}

// estiloTh y estiloTd ya están declarados en app.js (compartidos entre módulos)
