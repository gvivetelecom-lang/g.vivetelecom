// modulo-lotes.js — Operaciones por lote (sección 15/53 del documento
// funcional): permite aplicar una acción a varios clientes a la vez,
// con resultado individual por cada uno. Se carga después de
// modulo-auditoria.js.
//
// Cada operación queda registrada en auditoria/ por separado (una
// entrada por cliente/servicio afectado, ya que auditoriaWriter.js
// escucha cambios documento por documento) — no hace falta un
// registro especial de "lote" acá.

const ACCIONES_LOTE = {
  suspender: {
    etiqueta: 'Suspender por mora',
    descripcion: 'Marca los clientes seleccionados como suspendidos y genera la orden de desconexión para cada servicio activo.',
    filtroBase: (c) => c.estadoComercial === 'activo',
  },
  rehabilitar: {
    etiqueta: 'Rehabilitar',
    descripcion: 'Reactiva clientes suspendidos y genera la orden de rehabilitación para cada servicio.',
    filtroBase: (c) => c.estadoComercial === 'suspendido',
  },
  corte: {
    etiqueta: 'Asignar grupo de corte',
    descripcion: 'Reasigna la fecha de vencimiento/corte de los servicios seleccionados a otro grupo.',
    filtroBase: () => true,
  },
};

function useClientesParaLote(accion) {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    const estado = accion === 'suspender' ? 'activo' : accion === 'rehabilitar' ? 'suspendido' : null;

    let ref = db.collection('clientes').orderBy('nombre').limit(200);
    if (estado) ref = db.collection('clientes').where('estadoComercial', '==', estado).orderBy('nombre').limit(200);

    const unsub = ref.onSnapshot(
      (snap) => { setClientes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false); },
      (err) => { console.error(err); setCargando(false); }
    );
    return unsub;
  }, [accion]);

  return { clientes, cargando };
}

async function obtenerServiciosDeClientes(clienteIds) {
  const resultado = [];
  for (let i = 0; i < clienteIds.length; i += 30) {
    const lote = clienteIds.slice(i, i + 30);
    const snap = await db.collection('servicios').where('clienteId', 'in', lote).get();
    resultado.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return resultado;
}

async function ejecutarLoteSuspenderRehabilitar({ clienteIds, accion, usuarioId }) {
  const servicios = await obtenerServiciosDeClientes(clienteIds);
  const nuevoEstadoComercial = accion === 'suspender' ? 'suspendido' : 'activo';
  const nuevoEstadoComercialServicio = accion === 'suspender' ? 'suspendido_mora' : 'activo';
  const tipoOrden = accion === 'suspender' ? 'SUSPENDER_SERVICIO' : 'REHABILITAR_SERVICIO';
  const timestamp = firebase.firestore.FieldValue.serverTimestamp();

  // Firestore permite hasta 500 operaciones por batch — se divide si
  // el lote es más grande (poco probable para operación manual, pero
  // por las dudas).
  const operaciones = [];

  clienteIds.forEach((clienteId) => {
    operaciones.push({ tipo: 'cliente', ref: db.collection('clientes').doc(clienteId) });
  });
  servicios.forEach((s) => {
    operaciones.push({ tipo: 'servicio', ref: db.collection('servicios').doc(s.id), servicio: s });
  });

  let procesados = 0;
  for (let i = 0; i < operaciones.length; i += 400) {
    const trozo = operaciones.slice(i, i + 400);
    const batch = db.batch();

    trozo.forEach((op) => {
      if (op.tipo === 'cliente') {
        batch.update(op.ref, { estadoComercial: nuevoEstadoComercial, ultimaModificacion: { usuarioId, fecha: timestamp } });
      } else {
        batch.update(op.ref, { estadoComercial: nuevoEstadoComercialServicio, ultimaModificacion: { usuarioId, fecha: timestamp } });
      }
    });

    await batch.commit();
    procesados += trozo.length;
  }

  // Las órdenes al agente se crean aparte (con ID automático, no
  // sirven dentro de un batch.update genérico)
  const ordenesBatch = db.batch();
  servicios.forEach((s) => {
    const ref = db.collection('ordenes_mikrotik').doc();
    ordenesBatch.set(ref, {
      tipo: tipoOrden,
      servicioId: s.id,
      clienteId: s.clienteId,
      routerId: s.routerId,
      parametros: { motivo: 'operacion_por_lote' },
      estado: 'pendiente',
      pasosCompletados: [],
      usuarioSolicitante: usuarioId,
      fechaSolicitud: timestamp,
      fechaEjecucion: null,
      resultado: null,
      error: null,
    });
  });
  await ordenesBatch.commit();

  return { clientesAfectados: clienteIds.length, serviciosAfectados: servicios.length };
}

async function ejecutarLoteCorte({ clienteIds, grupoCorteId, usuarioId }) {
  const servicios = await obtenerServiciosDeClientes(clienteIds);
  const timestamp = firebase.firestore.FieldValue.serverTimestamp();

  for (let i = 0; i < servicios.length; i += 400) {
    const trozo = servicios.slice(i, i + 400);
    const batch = db.batch();
    trozo.forEach((s) => {
      batch.update(db.collection('servicios').doc(s.id), {
        grupoCorteId,
        ultimaModificacion: { usuarioId, fecha: timestamp },
      });
    });
    await batch.commit();
  }

  return { clientesAfectados: clienteIds.length, serviciosAfectados: servicios.length };
}

// ---------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------

function SelectorGrupoCorte({ value, onChange }) {
  const [grupos, setGrupos] = useState([]);
  useEffect(() => {
    const unsub = db.collection('grupos_corte').onSnapshot((snap) => setGrupos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  return html`
    <select value=${value} onChange=${(e) => onChange(e.target.value)}>
      <option value="">Seleccionar grupo…</option>
      ${grupos.map((g) => html`<option key=${g.id} value=${g.id}>${g.nombre} (vence día ${g.diaVencimiento})</option>`)}
    </select>
  `;
}

function ModuloLotes({ usuarioId }) {
  const [accion, setAccion] = useState('suspender');
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [grupoCorteId, setGrupoCorteId] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const { clientes, cargando } = useClientesParaLote(accion);

  const cambiarAccion = (nueva) => {
    setAccion(nueva);
    setSeleccionados(new Set());
    setResultado(null);
    setError(null);
  };

  const alternar = (id) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
  };

  const seleccionarTodos = () => {
    setSeleccionados(new Set(clientes.map((c) => c.id)));
  };

  const ejecutar = async () => {
    setEjecutando(true);
    setError(null);
    try {
      const ids = [...seleccionados];
      let res;
      if (accion === 'corte') {
        if (!grupoCorteId) { setError('Seleccioná un grupo de corte.'); setEjecutando(false); return; }
        res = await ejecutarLoteCorte({ clienteIds: ids, grupoCorteId, usuarioId });
      } else {
        res = await ejecutarLoteSuspenderRehabilitar({ clienteIds: ids, accion, usuarioId });
      }
      setResultado(res);
      setSeleccionados(new Set());
      setConfirmando(false);
    } catch (err) {
      setError('No fue posible completar la operación. Revisá la consola para más detalle.');
      console.error(err);
    } finally {
      setEjecutando(false);
    }
  };

  const infoAccion = ACCIONES_LOTE[accion];

  return html`
    <div>
      <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: '0 0 16px' }}>Operaciones por lote</h1>

      <div class="card" style=${{ marginBottom: '16px' }}>
        <div class="flex gap-8" style=${{ marginBottom: '12px' }}>
          ${Object.entries(ACCIONES_LOTE).map(
            ([key, info]) => html`
              <button
                key=${key}
                class="btn ${accion === key ? 'btn-principal' : 'btn-secundario'}"
                onClick=${() => cambiarAccion(key)}
              >
                ${info.etiqueta}
              </button>
            `
          )}
        </div>
        <p class="texto-secundario" style=${{ margin: 0 }}>${infoAccion.descripcion}</p>

        ${accion === 'corte' && html`
          <div class="campo" style=${{ marginTop: '12px', maxWidth: '320px' }}>
            <label>Nuevo grupo de corte</label>
            <${SelectorGrupoCorte} value=${grupoCorteId} onChange=${setGrupoCorteId} />
          </div>
        `}
      </div>

      ${error && html`<div class="login-error">${error}</div>`}

      ${resultado && html`
        <div class="card" style=${{ borderColor: 'var(--estado-activo)', background: 'rgba(25,135,84,0.05)', marginBottom: '16px' }}>
          <div class="flex items-center gap-8" style=${{ color: 'var(--estado-activo)', fontWeight: 600 }}>
            <i class="fa-solid fa-circle-check"></i>
            Operación completada: ${resultado.clientesAfectados} cliente(s), ${resultado.serviciosAfectados} servicio(s) afectados.
          </div>
        </div>
      `}

      <div class="card" style=${{ padding: 0 }}>
        <div class="flex items-center justify-between" style=${{ padding: '16px' }}>
          <span class="texto-secundario">${seleccionados.size} de ${clientes.length} seleccionados</span>
          <div class="flex gap-8">
            <button class="btn btn-secundario" onClick=${seleccionarTodos} disabled=${cargando || clientes.length === 0}>Seleccionar todos</button>
            <button class="btn btn-secundario" onClick=${() => setSeleccionados(new Set())} disabled=${seleccionados.size === 0}>Limpiar</button>
          </div>
        </div>

        ${cargando
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">Cargando clientes…</div>`
          : clientes.length === 0
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">No hay clientes que apliquen para esta acción.</div>`
          : html`
              <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  ${clientes.map(
                    (c) => html`
                      <tr key=${c.id} style=${{ borderTop: '1px solid var(--color-borde)', cursor: 'pointer' }} onClick=${() => alternar(c.id)}>
                        <td style=${{ padding: '10px 16px', width: '32px' }}>
                          <input type="checkbox" checked=${seleccionados.has(c.id)} onChange=${() => alternar(c.id)} onClick=${(e) => e.stopPropagation()} />
                        </td>
                        <td style=${{ padding: '10px 16px' }}>${c.nombre}</td>
                        <td style=${{ padding: '10px 16px' }} class="texto-secundario">${c.ciudad ?? '—'} ${c.zona ? '/ ' + c.zona : ''}</td>
                      </tr>
                    `
                  )}
                </tbody>
              </table>
            `}
      </div>

      ${seleccionados.size > 0 && html`
        <div class="flex justify-between" style=${{ marginTop: '16px' }}>
          <span></span>
          <button class="btn btn-principal" onClick=${() => setConfirmando(true)}>
            Aplicar "${infoAccion.etiqueta}" a ${seleccionados.size} cliente(s)
          </button>
        </div>
      `}

      ${confirmando && html`
        <div class="card" style=${{ marginTop: '16px', borderColor: 'var(--estado-pendiente)' }}>
          <div class="card-titulo">Confirmar operación</div>
          <p>
            Estás por aplicar <strong>${infoAccion.etiqueta}</strong> a <strong>${seleccionados.size}</strong> cliente(s).
            Esta acción genera órdenes reales hacia los routers correspondientes y no se puede deshacer con un solo clic.
          </p>
          <div class="flex justify-between">
            <button class="btn btn-secundario" onClick=${() => setConfirmando(false)} disabled=${ejecutando}>Cancelar</button>
            <button class="btn btn-peligro" onClick=${ejecutar} disabled=${ejecutando}>
              ${ejecutando ? 'Aplicando…' : 'Confirmar y aplicar'}
            </button>
          </div>
        </div>
      `}
    </div>
  `;
}
