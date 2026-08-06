// modulo-servicios-adicionales.js — Servicios no relacionados con
// internet (cableado, cámaras, correo, etc.), cotizados caso por
// caso, con seguimiento operativo propio (¿ya se hizo o falta?)
// separado del estado de facturación (que vive en la cuenta del
// cliente, junto con el internet). Se carga después de modulo-pagos.js.

const ESTADOS_OPERATIVOS = {
  pendiente: { etiqueta: 'Pendiente', clase: 'etiqueta-pendiente' },
  programado: { etiqueta: 'Programado', clase: 'etiqueta-info' },
  en_progreso: { etiqueta: 'En progreso', clase: 'etiqueta-proceso' },
  completado: { etiqueta: 'Completado', clase: 'etiqueta-activo' },
  cancelado: { etiqueta: 'Cancelado', clase: 'etiqueta-inactivo' },
};

function EtiquetaEstadoOperativo({ estado }) {
  const info = ESTADOS_OPERATIVOS[estado] ?? { etiqueta: estado, clase: 'etiqueta-info' };
  return html`<span class="etiqueta-estado ${info.clase}">${info.etiqueta}</span>`;
}

function useServiciosAdicionalesCliente(clienteId) {
  const [servicios, setServicios] = useState([]);
  useEffect(() => {
    const unsub = db.collection('servicios_adicionales')
      .where('clienteId', '==', clienteId)
      .onSnapshot(
        (snap) => setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error(err)
      );
    return unsub;
  }, [clienteId]);
  return servicios;
}

// ---------------------------------------------------------------------
// Alta — se cotiza a mano, sin catálogo de precios fijo
// ---------------------------------------------------------------------

function FormularioServicioAdicional({ clienteId, usuarioId, onCompletado, onCancelar }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('unico');
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState('PYG');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !precio) { setError('Nombre y precio son obligatorios.'); return; }

    setEnviando(true);
    setError(null);
    try {
      await db.collection('servicios_adicionales').add({
        clienteId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        tipo,
        precio: Number(precio),
        moneda,
        estadoOperativo: 'pendiente',
        fechaProgramada: null,
        tecnicoAsignado: null,
        notasOperativas: '',
        estado: 'activo',
        facturado: false,
        fechaInicio: firebase.firestore.FieldValue.serverTimestamp(),
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });
      onCompletado();
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para cargar servicios adicionales.' : 'No fue posible crearlo.');
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '480px', marginBottom: '16px' }}>
      <div class="card-titulo">Nuevo servicio adicional</div>

      ${error && html`<div class="login-error">${error}</div>`}

      <form onSubmit=${confirmar}>
        <div class="campo">
          <label>Nombre</label>
          <input type="text" value=${nombre} onInput=${(e) => setNombre(e.target.value)} placeholder="ej: Cableado interno oficina" />
        </div>
        <div class="campo">
          <label>Descripción (opcional)</label>
          <textarea value=${descripcion} onInput=${(e) => setDescripcion(e.target.value)} rows="2"></textarea>
        </div>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Tipo</label>
            <select value=${tipo} onChange=${(e) => setTipo(e.target.value)}>
              <option value="unico">Único (se factura una vez)</option>
              <option value="recurrente">Recurrente (se factura todos los meses)</option>
            </select>
          </div>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>Precio</label>
            <input type="number" value=${precio} onInput=${(e) => setPrecio(e.target.value)} />
          </div>
          <div class="campo" style=${{ flex: '1 1 100px' }}>
            <label>Moneda</label>
            <select value=${moneda} onChange=${(e) => setMoneda(e.target.value)}>
              <option value="PYG">PYG</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando}>${enviando ? 'Creando…' : 'Crear'}</button>
        </div>
      </form>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Seguimiento operativo — separado del estado de facturación
// ---------------------------------------------------------------------

function EdicionOperativa({ servicio, usuarioId, onCerrar }) {
  const [estadoOperativo, setEstadoOperativo] = useState(servicio.estadoOperativo);
  const [fechaProgramada, setFechaProgramada] = useState(
    servicio.fechaProgramada ? new Date(servicio.fechaProgramada.seconds * 1000).toISOString().slice(0, 10) : ''
  );
  const [tecnicoAsignado, setTecnicoAsignado] = useState(servicio.tecnicoAsignado ?? '');
  const [notasOperativas, setNotasOperativas] = useState(servicio.notasOperativas ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await db.collection('servicios_adicionales').doc(servicio.id).update({
        estadoOperativo,
        fechaProgramada: fechaProgramada ? firebase.firestore.Timestamp.fromDate(new Date(fechaProgramada)) : null,
        tecnicoAsignado: tecnicoAsignado.trim() || null,
        notasOperativas: notasOperativas.trim(),
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });
      onCerrar();
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para actualizar esto.' : 'No fue posible guardar.');
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  return html`
    <div style=${{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-borde)' }}>
      ${error && html`<div class="login-error">${error}</div>`}
      <div class="flex gap-16" style=${{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div class="campo" style=${{ flex: '1 1 160px', marginBottom: 0 }}>
          <label>Estado</label>
          <select value=${estadoOperativo} onChange=${(e) => setEstadoOperativo(e.target.value)}>
            ${Object.entries(ESTADOS_OPERATIVOS).map(([v, info]) => html`<option key=${v} value=${v}>${info.etiqueta}</option>`)}
          </select>
        </div>
        <div class="campo" style=${{ flex: '1 1 150px', marginBottom: 0 }}>
          <label>Fecha programada</label>
          <input type="date" value=${fechaProgramada} onInput=${(e) => setFechaProgramada(e.target.value)} />
        </div>
        <div class="campo" style=${{ flex: '1 1 160px', marginBottom: 0 }}>
          <label>Técnico asignado</label>
          <input type="text" value=${tecnicoAsignado} onInput=${(e) => setTecnicoAsignado(e.target.value)} />
        </div>
      </div>
      <div class="campo">
        <label>Notas</label>
        <textarea value=${notasOperativas} onInput=${(e) => setNotasOperativas(e.target.value)} rows="2"></textarea>
      </div>
      <div class="flex justify-between">
        <button class="btn btn-secundario" onClick=${onCerrar} disabled=${guardando}>Cancelar</button>
        <button class="btn btn-principal" onClick=${guardar} disabled=${guardando}>${guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  `;
}

function FilaServicioAdicional({ servicio, usuarioId, mostrarCliente, nombreCliente, onClickCliente }) {
  const [editando, setEditando] = useState(false);

  return html`
    <div style=${{ padding: '12px 0', borderBottom: '1px solid var(--color-borde)' }}>
      <div class="flex items-center justify-between">
        <div style=${{ cursor: mostrarCliente ? 'pointer' : 'default' }} onClick=${() => mostrarCliente && onClickCliente()}>
          <div style=${{ fontWeight: 500 }}>
            ${servicio.nombre}
            ${mostrarCliente && html`<span class="texto-secundario"> — ${nombreCliente ?? servicio.clienteId}</span>`}
          </div>
          <div class="texto-secundario">
            ${servicio.tipo === 'recurrente' ? 'Mensual' : 'Único'} · ${servicio.precio} ${servicio.moneda}
            ${servicio.tecnicoAsignado && html` · Asignado a ${servicio.tecnicoAsignado}`}
          </div>
        </div>
        <div class="flex items-center gap-8">
          <${EtiquetaEstadoOperativo} estado=${servicio.estadoOperativo} />
          <button class="btn btn-secundario" style=${{ padding: '4px 10px' }} onClick=${() => setEditando(!editando)}>
            ${editando ? 'Cerrar' : 'Actualizar'}
          </button>
        </div>
      </div>
      ${servicio.notasOperativas && !editando && html`<div class="texto-secundario" style=${{ marginTop: '4px' }}>${servicio.notasOperativas}</div>`}
      ${editando && html`<${EdicionOperativa} servicio=${servicio} usuarioId=${usuarioId} onCerrar=${() => setEditando(false)} />`}
    </div>
  `;
}

// ---------------------------------------------------------------------
// Tarjeta para la ficha del cliente
// ---------------------------------------------------------------------

function TarjetaServiciosAdicionales({ clienteId, usuarioId }) {
  const servicios = useServiciosAdicionalesCliente(clienteId);
  const [mostrarAlta, setMostrarAlta] = useState(false);

  return html`
    <div style=${{ marginBottom: '16px' }}>
      ${mostrarAlta && html`
        <${FormularioServicioAdicional} clienteId=${clienteId} usuarioId=${usuarioId} onCancelar=${() => setMostrarAlta(false)} onCompletado=${() => setMostrarAlta(false)} />
      `}
      <div class="card">
        <div class="flex items-center justify-between" style=${{ marginBottom: '12px' }}>
          <div class="card-titulo" style=${{ margin: 0 }}>Servicios adicionales (${servicios.length})</div>
          <button class="btn btn-secundario" onClick=${() => setMostrarAlta(true)}>
            <i class="fa-solid fa-plus"></i> Nuevo
          </button>
        </div>
        ${servicios.length === 0
          ? html`<p class="texto-secundario">Cableado, cámaras, correo u otro servicio que no sea de internet, se carga acá.</p>`
          : servicios.map((s) => html`<${FilaServicioAdicional} key=${s.id} servicio=${s} usuarioId=${usuarioId} mostrarCliente=${false} />`)}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Tablero global — para ver de un vistazo qué trabajos faltan, entre
// todos los clientes, sin entrar uno por uno
// ---------------------------------------------------------------------

function useServiciosAdicionalesGlobal(estadoFiltro) {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    let ref = db.collection('servicios_adicionales').where('estado', '==', 'activo').limit(100);
    if (estadoFiltro !== 'todos') {
      ref = db.collection('servicios_adicionales')
        .where('estado', '==', 'activo')
        .where('estadoOperativo', '==', estadoFiltro)
        .limit(100);
    }

    const unsub = ref.onSnapshot(
      (snap) => { setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false); },
      (err) => { console.error(err); setCargando(false); }
    );
    return unsub;
  }, [estadoFiltro]);

  return { servicios, cargando };
}

function ModuloServiciosAdicionales({ usuarioId, navegarACliente }) {
  const [estadoFiltro, setEstadoFiltro] = useState('pendiente');
  const { servicios, cargando } = useServiciosAdicionalesGlobal(estadoFiltro);
  const nombresClientes = useNombresClientesGlobal();

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Servicios adicionales</h1>
        <select value=${estadoFiltro} onChange=${(e) => setEstadoFiltro(e.target.value)} style=${{ maxWidth: '200px' }}>
          <option value="todos">Todos los estados</option>
          ${Object.entries(ESTADOS_OPERATIVOS).map(([v, info]) => html`<option key=${v} value=${v}>${info.etiqueta}</option>`)}
        </select>
      </div>

      <div class="card" style=${{ padding: servicios.length === 0 ? '32px' : 0, marginTop: '16px' }}>
        ${cargando
          ? html`<p class="texto-secundario" style=${{ textAlign: 'center' }}>Cargando…</p>`
          : servicios.length === 0
          ? html`<p class="texto-secundario" style=${{ textAlign: 'center', margin: 0 }}>Nada con este filtro.</p>`
          : html`<div style=${{ padding: '0 16px' }}>${servicios.map(
              (s) => html`
                <${FilaServicioAdicional}
                  key=${s.id}
                  servicio=${s}
                  usuarioId=${usuarioId}
                  mostrarCliente=${true}
                  nombreCliente=${nombresClientes[s.clienteId]}
                  onClickCliente=${() => navegarACliente(s.clienteId)}
                />
              `
            )}</div>`}
      </div>
    </div>
  `;
}
