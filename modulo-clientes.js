// modulo-clientes.js — Tabla de clientes + ficha consolidada.
// Se carga después de app.js (usa `html`, `db`, componentes compartidos).

const ESTADOS_CLIENTE = {
  activo: { etiqueta: 'Activo', clase: 'etiqueta-activo' },
  pendiente: { etiqueta: 'Pendiente de instalación', clase: 'etiqueta-pendiente' },
  suspendido: { etiqueta: 'Suspendido', clase: 'etiqueta-suspendido' },
  baja: { etiqueta: 'Dado de baja', clase: 'etiqueta-inactivo' },
};

function EtiquetaEstadoCliente({ estado }) {
  const info = ESTADOS_CLIENTE[estado] ?? { etiqueta: estado, clase: 'etiqueta-info' };
  return html`<span class="etiqueta-estado ${info.clase}">${info.etiqueta}</span>`;
}

// ---------------------------------------------------------------------
// Hook de datos: carga paginada + filtros. Nunca trae "todos los
// clientes" de una — sección 30 de los lineamientos (rendimiento).
// ---------------------------------------------------------------------

function useClientes({ estadoFiltro, busqueda }) {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    setError(null);

    let ref = db.collection('clientes').orderBy('nombre').limit(50);

    if (estadoFiltro && estadoFiltro !== 'todos') {
      ref = db.collection('clientes')
        .where('estadoComercial', '==', estadoFiltro)
        .orderBy('nombre')
        .limit(50);
    }

    const unsub = ref.onSnapshot(
      (snap) => {
        let filas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Búsqueda simple del lado del cliente sobre los 50 ya
        // cargados. Para búsqueda global real (por documento, IP,
        // usuario PPPoE, etc.) se usa el buscador de la topbar, que
        // en el siguiente paso se conecta a una función de búsqueda
        // dedicada en vez de escanear colecciones completas.
        if (busqueda?.trim()) {
          const q = busqueda.trim().toLowerCase();
          filas = filas.filter(
            (c) =>
              c.nombre?.toLowerCase().includes(q) ||
              c.codigo?.toLowerCase().includes(q) ||
              c.documento?.toLowerCase().includes(q)
          );
        }

        setClientes(filas);
        setCargando(false);
      },
      (err) => {
        setError('No fue posible cargar la lista de clientes.');
        setCargando(false);
        console.error(err);
      }
    );

    return unsub;
  }, [estadoFiltro, busqueda]);

  return { clientes, cargando, error };
}

// ---------------------------------------------------------------------
// Tabla de clientes
// ---------------------------------------------------------------------

function TablaClientes({ onSeleccionar }) {
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const { clientes, cargando, error } = useClientes({ estadoFiltro, busqueda });

  return html`
    <div>
      <div class="flex items-center justify-between gap-16" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Clientes</h1>
        <button class="btn btn-principal">
          <i class="fa-solid fa-plus"></i> Crear cliente
        </button>
      </div>

      <div class="card" style=${{ marginBottom: '16px' }}>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 240px', marginBottom: 0 }}>
            <label>Buscar</label>
            <input
              type="text"
              placeholder="Nombre, código o documento…"
              value=${busqueda}
              onInput=${(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div class="campo" style=${{ flex: '0 1 220px', marginBottom: 0 }}>
            <label>Estado</label>
            <select value=${estadoFiltro} onChange=${(e) => setEstadoFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="pendiente">Pendientes de instalación</option>
              <option value="suspendido">Suspendidos</option>
              <option value="baja">Dados de baja</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card" style=${{ padding: 0 }}>
        ${error && html`<div class="login-error" style=${{ margin: '16px' }}>${error}</div>`}

        ${cargando
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">Cargando clientes…</div>`
          : clientes.length === 0
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">No se encontraron clientes con estos filtros.</div>`
          : html`
              <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style=${{ borderBottom: '1px solid var(--color-borde)', textAlign: 'left' }}>
                    <th style=${estiloTh}>Código</th>
                    <th style=${estiloTh}>Cliente</th>
                    <th style=${estiloTh}>Documento</th>
                    <th style=${estiloTh}>Ciudad / Zona</th>
                    <th style=${estiloTh}>Estado</th>
                    <th style=${estiloTh}></th>
                  </tr>
                </thead>
                <tbody>
                  ${clientes.map(
                    (c) => html`
                      <tr key=${c.id} style=${{ borderBottom: '1px solid var(--color-borde)', cursor: 'pointer' }} onClick=${() => onSeleccionar(c.id)}>
                        <td style=${estiloTd} class="mono">${c.codigo}</td>
                        <td style=${estiloTd}>${c.nombre}</td>
                        <td style=${estiloTd} class="texto-secundario">${c.documento || c.ruc || '—'}</td>
                        <td style=${estiloTd} class="texto-secundario">${c.ciudad ?? '—'} ${c.zona ? `/ ${c.zona}` : ''}</td>
                        <td style=${estiloTd}><${EtiquetaEstadoCliente} estado=${c.estadoComercial} /></td>
                        <td style=${estiloTd}><i class="fa-solid fa-chevron-right texto-secundario"></i></td>
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

const estiloTh = { padding: '10px 16px', fontSize: 'var(--texto-etiqueta)', color: 'var(--color-texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.03em' };
const estiloTd = { padding: '12px 16px', fontSize: 'var(--texto-normal)' };

// ---------------------------------------------------------------------
// Ficha consolidada del cliente — sección 12-13 de los lineamientos
// ---------------------------------------------------------------------

function useCliente(clienteId) {
  const [cliente, setCliente] = useState(undefined);
  const [servicios, setServicios] = useState([]);

  useEffect(() => {
    const unsubCliente = db.collection('clientes').doc(clienteId).onSnapshot((doc) => {
      setCliente(doc.exists ? { id: doc.id, ...doc.data() } : null);
    });

    const unsubServicios = db.collection('servicios')
      .where('clienteId', '==', clienteId)
      .onSnapshot((snap) => {
        setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

    return () => { unsubCliente(); unsubServicios(); };
  }, [clienteId]);

  return { cliente, servicios };
}

function inconsistenciaFinancieroTecnico(cliente, servicios) {
  // Sección 13 de los lineamientos: alerta visible cuando el estado
  // financiero y el técnico no coinciden (ej. suspendido por mora pero
  // todavía conectado).
  const suspendidoComercial = cliente?.estadoComercial === 'suspendido';
  const algunServicioConectado = servicios.some((s) => s.estadoTecnico === 'configurado');
  return suspendidoComercial && algunServicioConectado;
}

function FichaCliente({ clienteId, volver, usuarioId }) {
  const { cliente, servicios } = useCliente(clienteId);
  const [mostrarAlta, setMostrarAlta] = useState(false);

  if (cliente === undefined) {
    return html`<div class="texto-secundario">Cargando ficha del cliente…</div>`;
  }

  if (cliente === null) {
    return html`
      <div class="card">
        <p>Este cliente no existe o fue removido.</p>
        <button class="btn btn-secundario" onClick=${volver}>Volver</button>
      </div>
    `;
  }

  const hayInconsistencia = inconsistenciaFinancieroTecnico(cliente, servicios);

  return html`
    <div>
      <div class="flex items-center gap-8" style=${{ marginBottom: '16px' }}>
        <button class="btn btn-secundario" onClick=${volver}><i class="fa-solid fa-arrow-left"></i></button>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>${cliente.nombre}</h1>
        <span class="mono texto-secundario">${cliente.codigo}</span>
      </div>

      ${hayInconsistencia && html`
        <div class="card" style=${{ borderColor: 'var(--estado-suspendido)', background: 'rgba(220,38,38,0.05)', marginBottom: '16px' }}>
          <div class="flex items-center gap-8" style=${{ color: 'var(--estado-suspendido)', fontWeight: 600 }}>
            <i class="fa-solid fa-triangle-exclamation"></i>
            Inconsistencia detectada: el cliente está suspendido por mora pero tiene un servicio marcado como configurado.
          </div>
        </div>
      `}

      <div class="flex gap-16" style=${{ flexWrap: 'wrap', marginBottom: '16px' }}>
        <button class="btn btn-secundario"><i class="fa-solid fa-money-bill"></i> Registrar pago</button>
        <button class="btn btn-advertencia"><i class="fa-solid fa-arrows-rotate"></i> Cambiar plan</button>
        <button class="btn btn-advertencia"><i class="fa-solid fa-ban"></i> Suspender</button>
        <button class="btn btn-positivo"><i class="fa-solid fa-check"></i> Rehabilitar</button>
        <button class="btn btn-secundario"><i class="fa-solid fa-clock-rotate-left"></i> Ver historial</button>
      </div>

      <div class="card" style=${{ marginBottom: '16px' }}>
        <div class="card-titulo">Información general</div>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <${CampoInfo} etiqueta="Documento" valor=${cliente.documento || cliente.ruc} />
          <${CampoInfo} etiqueta="Teléfono" valor=${cliente.telefono} />
          <${CampoInfo} etiqueta="Correo" valor=${cliente.email} />
          <${CampoInfo} etiqueta="Dirección" valor=${cliente.direccion} />
          <${CampoInfo} etiqueta="Ciudad / Zona" valor=${`${cliente.ciudad ?? ''} ${cliente.zona ? '/ ' + cliente.zona : ''}`} />
        </div>
      </div>

      <div class="card" style=${{ marginBottom: '16px' }}>
        <div class="card-titulo">Estado</div>
        <div class="flex gap-16">
          <div>
            <div class="texto-secundario" style=${{ marginBottom: '4px' }}>Estado comercial</div>
            <${EtiquetaEstadoCliente} estado=${cliente.estadoComercial} />
          </div>
        </div>
      </div>

      ${mostrarAlta && html`
        <div style=${{ marginBottom: '16px' }}>
          <${AltaServicioPPPoE}
            clienteId=${clienteId}
            clienteNombre=${cliente.nombre}
            usuarioId=${usuarioId}
            onCancelar=${() => setMostrarAlta(false)}
            onCompletado=${() => setMostrarAlta(false)}
          />
        </div>
      `}

      <div style=${{ marginBottom: '16px' }}>
        <${TablaCuentasCliente} clienteId=${clienteId} usuarioId=${usuarioId} />
      </div>

      <div class="card">
        <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
          <div class="card-titulo" style=${{ margin: 0 }}>Servicios (${servicios.length})</div>
          <button class="btn btn-principal" onClick=${() => setMostrarAlta(true)}>
            <i class="fa-solid fa-plus"></i> Nuevo servicio PPPoE
          </button>
        </div>
        ${servicios.length === 0
          ? html`<p class="texto-secundario">Este cliente todavía no tiene servicios cargados.</p>`
          : servicios.map(
              (s) => html`
                <div key=${s.id} class="flex items-center justify-between" style=${{ padding: '10px 0', borderBottom: '1px solid var(--color-borde)' }}>
                  <div>
                    <div style=${{ fontWeight: 500 }}>${s.tipoConexion?.toUpperCase()} — ${s.planId}</div>
                    <div class="texto-secundario mono">${s.ipAsignadaId ?? 'sin IP asignada'}</div>
                  </div>
                  <span class="etiqueta-estado etiqueta-info">${s.estadoTecnico}</span>
                </div>
              `
            )}
      </div>
    </div>
  `;
}

function CampoInfo({ etiqueta, valor }) {
  return html`
    <div style=${{ minWidth: '160px' }}>
      <div class="texto-secundario" style=${{ marginBottom: '2px' }}>${etiqueta}</div>
      <div>${valor || '—'}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Contenedor del módulo: alterna entre tabla y ficha
// ---------------------------------------------------------------------

function ModuloClientes({ usuarioId }) {
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  if (clienteSeleccionado) {
    return html`<${FichaCliente} clienteId=${clienteSeleccionado} volver=${() => setClienteSeleccionado(null)} usuarioId=${usuarioId} />`;
  }

  return html`<${TablaClientes} onSeleccionar=${setClienteSeleccionado} />`;
}
