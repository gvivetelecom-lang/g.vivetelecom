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
        setError(
          err.code === 'permission-denied'
            ? 'Sin permisos para leer clientes: tu usuario no tiene un rol asignado todavía (revisá roleSync.js) o cerrá y volvé a iniciar sesión.'
            : 'No fue posible cargar la lista de clientes.'
        );
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

function FormularioAltaCliente({ usuarioId, onCompletado, onCancelar }) {
  const [form, setForm] = useState({
    codigo: `CLI-${Date.now().toString().slice(-6)}`,
    nombre: '', documento: '', ruc: '', tipoCliente: 'residencial',
    telefono: '', email: '', direccion: '', ciudad: '', zona: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const confirmar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.documento.trim()) {
      setError('Nombre y documento son obligatorios.');
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await db.collection('clientes').add({
        ...form,
        ruc: form.ruc || null,
        email: form.email || null,
        coordenadas: null,
        estadoComercial: 'pendiente',
        ejecutivoResponsable: usuarioId,
        fechaAlta: firebase.firestore.FieldValue.serverTimestamp(),
        fechaBaja: null,
        motivoBaja: null,
        observaciones: '',
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });
      onCompletado();
    } catch (err) {
      setError(
        err.code === 'permission-denied'
          ? 'Tu usuario no tiene permiso para crear clientes (revisá que tenga un rol asignado — ver roleSync.js).'
          : 'No fue posible crear el cliente. Intente nuevamente.'
      );
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '620px', marginBottom: '16px' }}>
      <div class="card-titulo">Nuevo cliente</div>

      ${error && html`<div class="login-error">${error}</div>`}

      <form onSubmit=${confirmar}>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Código</label>
            <input type="text" value=${form.codigo} onInput=${set('codigo')} class="mono" />
          </div>
          <div class="campo" style=${{ flex: '2 1 260px' }}>
            <label>Nombre completo</label>
            <input type="text" value=${form.nombre} onInput=${set('nombre')} required />
          </div>
        </div>

        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Documento</label>
            <input type="text" value=${form.documento} onInput=${set('documento')} required />
          </div>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>RUC (opcional)</label>
            <input type="text" value=${form.ruc} onInput=${set('ruc')} />
          </div>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Tipo de cliente</label>
            <select value=${form.tipoCliente} onChange=${set('tipoCliente')}>
              <option value="residencial">Residencial</option>
              <option value="corporativo">Corporativo</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Teléfono</label>
            <input type="tel" value=${form.telefono} onInput=${set('telefono')} />
          </div>
          <div class="campo" style=${{ flex: '1 1 200px' }}>
            <label>Correo (opcional)</label>
            <input type="email" value=${form.email} onInput=${set('email')} />
          </div>
        </div>

        <div class="campo">
          <label>Dirección</label>
          <input type="text" value=${form.direccion} onInput=${set('direccion')} />
        </div>

        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Ciudad</label>
            <input type="text" value=${form.ciudad} onInput=${set('ciudad')} />
          </div>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Zona</label>
            <input type="text" value=${form.zona} onInput=${set('zona')} />
          </div>
        </div>

        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando}>
            ${enviando ? 'Creando…' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function TablaClientes({ onSeleccionar, usuarioId }) {
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const { clientes, cargando, error } = useClientes({ estadoFiltro, busqueda });

  return html`
    <div>
      <div class="flex items-center justify-between gap-16" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Clientes</h1>
        <button class="btn btn-principal" onClick=${() => setMostrarAlta(true)}>
          <i class="fa-solid fa-plus"></i> Crear cliente
        </button>
      </div>

      ${mostrarAlta && html`
        <${FormularioAltaCliente}
          usuarioId=${usuarioId}
          onCancelar=${() => setMostrarAlta(false)}
          onCompletado=${() => setMostrarAlta(false)}
        />
      `}

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

// estiloTh y estiloTd ya están declarados en app.js (compartidos entre módulos)

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
  const { planes: nombresPlanes, routers: nombresRouters } = useNombresPlanesYRouters();
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);

  const cambiarEstadoCliente = async (accion) => {
    setAccionEnCurso(accion);
    setErrorAccion(null);

    const nuevoEstadoComercial = accion === 'suspender' ? 'suspendido' : 'activo';
    const nuevoEstadoServicio = accion === 'suspender' ? 'suspendido_mora' : 'activo';
    const tipoOrden = accion === 'suspender' ? 'SUSPENDER_SERVICIO' : 'REHABILITAR_SERVICIO';
    const serviciosAfectados = servicios.filter((s) => s.estadoTecnico !== 'baja');

    try {
      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();

      batch.update(db.collection('clientes').doc(clienteId), {
        estadoComercial: nuevoEstadoComercial,
        ultimaModificacion: { usuarioId, fecha: timestamp },
      });
      serviciosAfectados.forEach((s) => {
        batch.update(db.collection('servicios').doc(s.id), {
          estadoComercial: nuevoEstadoServicio,
          ultimaModificacion: { usuarioId, fecha: timestamp },
        });
      });
      await batch.commit();

      const ordenesBatch = db.batch();
      serviciosAfectados.forEach((s) => {
        ordenesBatch.set(db.collection('ordenes_mikrotik').doc(), {
          tipo: tipoOrden,
          servicioId: s.id,
          clienteId,
          routerId: s.routerId,
          parametros: { motivo: accion === 'suspender' ? 'suspension_manual' : 'rehabilitacion_manual' },
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
    } catch (err) {
      setErrorAccion(
        err.code === 'permission-denied'
          ? 'Tu rol no tiene permiso para esta acción.'
          : 'No fue posible completar la acción. Revisá la consola para más detalle.'
      );
      console.error(err);
    } finally {
      setAccionEnCurso(null);
    }
  };

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

      ${errorAccion && html`<div class="login-error" style=${{ marginBottom: '16px' }}>${errorAccion}</div>`}

      <div class="flex gap-16" style=${{ flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          class="btn btn-advertencia"
          onClick=${() => cambiarEstadoCliente('suspender')}
          disabled=${!!accionEnCurso || cliente.estadoComercial === 'suspendido' || servicios.length === 0}
        >
          <i class="fa-solid fa-ban"></i> ${accionEnCurso === 'suspender' ? 'Suspendiendo…' : 'Suspender'}
        </button>
        <button
          class="btn btn-positivo"
          onClick=${() => cambiarEstadoCliente('rehabilitar')}
          disabled=${!!accionEnCurso || cliente.estadoComercial !== 'suspendido'}
        >
          <i class="fa-solid fa-check"></i> ${accionEnCurso === 'rehabilitar' ? 'Rehabilitando…' : 'Rehabilitar'}
        </button>
        <button class="btn btn-secundario" disabled title="Próximamente"><i class="fa-solid fa-arrows-rotate"></i> Cambiar plan</button>
        <button class="btn btn-secundario" disabled title="Próximamente"><i class="fa-solid fa-clock-rotate-left"></i> Ver historial</button>
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
          : servicios.map((s) => html`<${FilaServicio} key=${s.id} servicio=${s} usuarioId=${usuarioId} nombresPlanes=${nombresPlanes} />`)}
      </div>
    </div>
  `;
}

function useUltimaOrdenServicio(servicioId) {
  const [orden, setOrden] = useState(null);
  useEffect(() => {
    const unsub = db.collection('ordenes_mikrotik')
      .where('servicioId', '==', servicioId)
      .orderBy('fechaSolicitud', 'desc')
      .limit(1)
      .onSnapshot(
        (snap) => setOrden(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
        (err) => console.error(err)
      );
    return unsub;
  }, [servicioId]);
  return orden;
}

function EstadoOrdenServicio({ servicio, usuarioId }) {
  const orden = useUltimaOrdenServicio(servicio.id);
  const [reintentando, setReintentando] = useState(false);

  if (!orden) return null;

  if (['pendiente', 'validando', 'procesando'].includes(orden.estado)) {
    return html`<div class="texto-secundario" style=${{ color: 'var(--estado-proceso)' }}><i class="fa-solid fa-spinner fa-spin"></i> ${orden.tipo} en curso…</div>`;
  }

  if (orden.estado !== 'error') return null;

  const reintentar = async () => {
    setReintentando(true);
    try {
      // No se puede reescribir la orden fallida (las rules lo impiden
      // a propósito, solo el agente transiciona estados) — se crea
      // una orden nueva con los mismos datos.
      await db.collection('ordenes_mikrotik').add({
        tipo: orden.tipo,
        servicioId: orden.servicioId,
        clienteId: orden.clienteId,
        routerId: orden.routerId,
        parametros: orden.parametros,
        estado: 'pendiente',
        pasosCompletados: [],
        usuarioSolicitante: usuarioId,
        fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
        fechaEjecucion: null,
        resultado: null,
        error: null,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setReintentando(false);
    }
  };

  return html`
    <div class="login-error" style=${{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
      <span><strong>${orden.tipo} falló:</strong> ${orden.error ?? 'sin detalle'}</span>
      <button class="btn btn-secundario" style=${{ padding: '4px 10px', flexShrink: 0 }} onClick=${reintentar} disabled=${reintentando}>
        ${reintentando ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  `;
}

function useNombresPlanesYRouters() {
  const [planes, setPlanes] = useState({});
  const [routers, setRouters] = useState({});

  useEffect(() => {
    const unsubPlanes = db.collection('planes').onSnapshot((snap) => {
      const mapa = {};
      snap.docs.forEach((d) => { mapa[d.id] = d.data().nombre; });
      setPlanes(mapa);
    });
    const unsubRouters = db.collection('routers').onSnapshot((snap) => {
      const mapa = {};
      snap.docs.forEach((d) => { mapa[d.id] = d.data().nombre; });
      setRouters(mapa);
    });
    return () => { unsubPlanes(); unsubRouters(); };
  }, []);

  return { planes, routers };
}

function usePlanesActivos() {
  const [planes, setPlanes] = useState([]);
  useEffect(() => {
    const unsub = db.collection('planes').where('estado', '==', 'activo').onSnapshot((snap) => {
      setPlanes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);
  return planes;
}

function FilaServicio({ servicio: s, usuarioId, nombresPlanes }) {
  const [editando, setEditando] = useState(false);
  const [planId, setPlanId] = useState(s.planId);
  const [usuarioPPPoE, setUsuarioPPPoE] = useState(s.usuarioPPPoE ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const planesActivos = usePlanesActivos();

  const planDesconocido = !nombresPlanes[s.planId];

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await db.collection('servicios').doc(s.id).update({
        planId,
        usuarioPPPoE: usuarioPPPoE.trim(),
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });
      setEditando(false);
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para editar este servicio.' : 'No fue posible guardar los cambios.');
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  return html`
    <div style=${{ padding: '10px 0', borderBottom: '1px solid var(--color-borde)' }}>
      <div class="flex items-center justify-between">
        <div>
          <div style=${{ fontWeight: 500 }}>
            ${s.tipoConexion?.toUpperCase()} — ${nombresPlanes[s.planId] ?? s.planId}
            ${planDesconocido && html`<span class="texto-secundario"> (plan no encontrado — puede haber sido borrado)</span>`}
          </div>
          <div class="texto-secundario mono">${s.ipAsignadaId ?? 'sin IP asignada'}</div>
        </div>
        <div class="flex items-center gap-8">
          <span class="etiqueta-estado etiqueta-info">${s.estadoTecnico}</span>
          <button class="btn btn-secundario" style=${{ padding: '4px 10px' }} onClick=${() => setEditando(!editando)}>
            ${editando ? 'Cerrar' : 'Editar'}
          </button>
        </div>
      </div>

      ${editando && html`
        <div style=${{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-borde)' }}>
          <div class="login-error" style=${{ background: 'rgba(217,119,6,0.08)', borderColor: 'rgba(217,119,6,0.25)', color: 'var(--estado-pendiente)', marginBottom: '10px' }}>
            Esto solo actualiza el registro en el sistema. Si el plan realmente cambia, el perfil PPP en el router hay que ajustarlo a mano en Winbox por ahora (el tipo de orden "Cambiar plan" para el agente todavía no está construido).
          </div>
          ${error && html`<div class="login-error" style=${{ marginBottom: '10px' }}>${error}</div>`}
          <div class="flex gap-16" style=${{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div class="campo" style=${{ flex: '1 1 200px', marginBottom: 0 }}>
              <label>Plan</label>
              <select value=${planId} onChange=${(e) => setPlanId(e.target.value)}>
                ${!nombresPlanes[planId] && html`<option value=${planId}>${planId} (no encontrado)</option>`}
                ${planesActivos.map((p) => html`<option key=${p.id} value=${p.id}>${p.nombre}</option>`)}
              </select>
            </div>
            <div class="campo" style=${{ flex: '1 1 200px', marginBottom: 0 }}>
              <label>Usuario PPPoE</label>
              <input type="text" value=${usuarioPPPoE} onInput=${(e) => setUsuarioPPPoE(e.target.value)} />
            </div>
            <button class="btn btn-principal" onClick=${guardar} disabled=${guardando}>${guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      `}

      <${EstadoOrdenServicio} servicio=${s} usuarioId=${usuarioId} />
    </div>
  `;
}

function CampoInfo({ etiqueta, valor }) {
  return html`
      <div class="texto-secundario" style=${{ marginBottom: '2px' }}>${etiqueta}</div>
      <div>${valor || '—'}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Contenedor del módulo: alterna entre tabla y ficha
// ---------------------------------------------------------------------

function ModuloClientes({ usuarioId, clienteInicial }) {
  const [clienteSeleccionado, setClienteSeleccionado] = useState(clienteInicial ?? null);

  useEffect(() => {
    if (clienteInicial) setClienteSeleccionado(clienteInicial);
  }, [clienteInicial]);

  if (clienteSeleccionado) {
    return html`<${FichaCliente} clienteId=${clienteSeleccionado} volver=${() => setClienteSeleccionado(null)} usuarioId=${usuarioId} />`;
  }

  return html`<${TablaClientes} onSeleccionar=${setClienteSeleccionado} usuarioId=${usuarioId} />`;
}
