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

// ---------------------------------------------------------------------
// Cuentas del cliente
// ---------------------------------------------------------------------

function useCuentasCliente(clienteId) {
  const [cuentas, setCuentas] = useState([]);
  useEffect(() => {
    const unsub = db.collection('cuentas')
      .where('clienteId', '==', clienteId)
      .orderBy('periodo', 'desc')
      .limit(24)
      .onSnapshot((snap) => setCuentas(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [clienteId]);
  return cuentas;
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
                  <div class="texto-secundario">Saldo: ${formatoMoneda(c.saldo)}</div>
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

function FormularioCrearCuenta({ clienteId, usuarioId, onCompletado, onCancelar }) {
  const servicios = useServiciosCliente(clienteId);
  const [servicioId, setServicioId] = useState('');
  const [plan, setPlan] = useState(null);
  const [periodo, setPeriodo] = useState(periodoActual());
  const [fechaVencimiento, setFechaVencimiento] = useState(hoyMasDias(10));
  const [fechaCorte, setFechaCorte] = useState(hoyMasDias(15));
  const [cargos, setCargos] = useState('0');
  const [descuentos, setDescuentos] = useState('0');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!servicioId) { setPlan(null); return; }
    const servicio = servicios.find((s) => s.id === servicioId);
    if (!servicio) return;
    db.collection('planes').doc(servicio.planId).get().then((doc) => {
      setPlan(doc.exists ? { id: doc.id, ...doc.data() } : null);
    });
  }, [servicioId]);

  const total = plan ? plan.precio + (Number(cargos) || 0) - (Number(descuentos) || 0) + (plan.precio * (plan.impuestos || 0)) / 100 : 0;

  const confirmar = async (e) => {
    e.preventDefault();
    if (!servicioId || !plan) { setError('Seleccioná un servicio (necesita tener un plan asociado).'); return; }

    setEnviando(true);
    setError(null);
    try {
      await db.collection('cuentas').add({
        clienteId,
        servicioId,
        periodo,
        fechaEmision: firebase.firestore.FieldValue.serverTimestamp(),
        fechaVencimiento: firebase.firestore.Timestamp.fromDate(new Date(fechaVencimiento)),
        fechaCorte: firebase.firestore.Timestamp.fromDate(new Date(fechaCorte)),
        planId: plan.id,
        planNombreSnapshot: plan.nombre,
        importeSnapshot: plan.precio,
        cargos: Number(cargos) || 0,
        descuentos: Number(descuentos) || 0,
        impuestos: plan.impuestos || 0,
        total,
        pagado: 0,
        saldo: total,
        estado: 'pendiente',
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });
      onCompletado();
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para crear cuentas.' : 'No fue posible crear la cuenta.');
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '480px', marginBottom: '16px' }}>
      <div class="card-titulo">Nueva cuenta (manual)</div>
      <p class="texto-secundario" style=${{ marginTop: '-8px' }}>
        La generación automática mensual todavía no está definida — esto es para cargar una cuenta puntual mientras tanto.
      </p>

      ${error && html`<div class="login-error">${error}</div>`}

      <form onSubmit=${confirmar}>
        <div class="campo">
          <label>Servicio</label>
          <select value=${servicioId} onChange=${(e) => setServicioId(e.target.value)}>
            <option value="">Seleccionar…</option>
            ${servicios.map((s) => html`<option key=${s.id} value=${s.id}>${s.tipoConexion?.toUpperCase()} — ${s.usuarioPPPoE ?? s.id}</option>`)}
          </select>
        </div>

        ${plan && html`
          <div class="ayuda" style=${{ marginBottom: '12px' }}>Plan: <strong>${plan.nombre}</strong> — ${plan.precio} ${plan.moneda} (+${plan.impuestos || 0}% impuestos)</div>
        `}

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

        ${plan && html`<p><strong>Total: ${formatoMoneda(total, plan.moneda)}</strong></p>`}

        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando || !plan}>${enviando ? 'Creando…' : 'Crear cuenta'}</button>
        </div>
      </form>
    </div>
  `;
}

function TablaCuentasCliente({ clienteId, usuarioId }) {
  const cuentas = useCuentasCliente(clienteId);
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
                  </tr>
                </thead>
                <tbody>
                  ${cuentas.map(
                    (c) => html`
                      <tr key=${c.id} style=${{ borderBottom: '1px solid var(--color-borde)' }}>
                        <td style=${estiloTd}>${c.periodo}</td>
                        <td style=${estiloTd}>${formatoMoneda(c.total)}</td>
                        <td style=${estiloTd} class="texto-secundario">${formatoMoneda(c.pagado)}</td>
                        <td style=${estiloTd} style=${{ fontWeight: 600 }}>${formatoMoneda(c.saldo)}</td>
                        <td style=${estiloTd} class="texto-secundario">
                          ${c.fechaVencimiento ? new Date(c.fechaVencimiento.seconds * 1000).toLocaleDateString('es-PY') : '—'}
                        </td>
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

// estiloTh y estiloTd ya están declarados en app.js (compartidos entre módulos)
