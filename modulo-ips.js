// modulo-ips.js — Inventario de IPs + selector controlado para altas
// de servicio. Se carga después de app.js.

const ESTADOS_IP = {
  disponible: { etiqueta: 'Disponible', clase: 'etiqueta-activo' },
  reservada: { etiqueta: 'Reservada', clase: 'etiqueta-proceso' },
  asignada: { etiqueta: 'Asignada', clase: 'etiqueta-info' }, // deliberadamente distinto del naranja de marca (ver nota de diseño)
  suspendida_reservada: { etiqueta: 'Suspendida (reservada)', clase: 'etiqueta-pendiente' },
  en_liberacion: { etiqueta: 'En liberación', clase: 'etiqueta-info' },
  bloqueada: { etiqueta: 'Bloqueada', clase: 'etiqueta-inactivo' },
};

function EtiquetaEstadoIP({ estado }) {
  const info = ESTADOS_IP[estado] ?? { etiqueta: estado, clase: 'etiqueta-info' };
  return html`<span class="etiqueta-estado ${info.clase}">${info.etiqueta}</span>`;
}

// ---------------------------------------------------------------------
// Reserva transaccional — la misma lógica que se documentó en el
// modelo de datos, ahora como función reutilizable desde la UI.
// ---------------------------------------------------------------------

async function reservarIP(ip, { servicioId, clienteId, usuarioId }) {
  const ipRef = db.collection('ip_direcciones').doc(ip);

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ipRef);

    if (!doc.exists) {
      throw new Error(`La IP ${ip} no existe en el inventario.`);
    }
    if (doc.data().estado !== 'disponible') {
      // Alguien más la tomó entre que se listó y que se confirmó.
      throw new Error('IP_NO_DISPONIBLE');
    }

    tx.update(ipRef, {
      estado: 'reservada',
      servicioId,
      clienteId,
      fechaAsignacion: firebase.firestore.FieldValue.serverTimestamp(),
      usuarioResponsable: usuarioId,
      ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
    });
  });
}

// ---------------------------------------------------------------------
// Selector controlado de IP — para usar dentro del alta de servicio.
// Nunca permite escribir una IP a mano (sección 14 de los lineamientos),
// solo elegir de la lista de disponibles del router seleccionado.
// ---------------------------------------------------------------------

function SelectorIP({ routerId, onSeleccionar }) {
  const [disponibles, setDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!routerId) { setDisponibles([]); return; }
    setCargando(true);

    const unsub = db.collection('ip_direcciones')
      .where('routerId', '==', routerId)
      .where('estado', '==', 'disponible')
      .orderBy(firebase.firestore.FieldPath.documentId())
      .limit(50)
      .onSnapshot((snap) => {
        setDisponibles(snap.docs.map((d) => d.id));
        setCargando(false);
      });

    return unsub;
  }, [routerId]);

  if (!routerId) {
    return html`<p class="texto-secundario">Seleccione un router para ver las IP disponibles.</p>`;
  }

  if (cargando) {
    return html`<p class="texto-secundario">Cargando IPs disponibles…</p>`;
  }

  if (disponibles.length === 0) {
    return html`
      <div class="login-error">
        No hay direcciones IP disponibles para este router. Cargue un nuevo bloque antes de continuar.
      </div>
    `;
  }

  return html`
    <div class="campo">
      <label>Dirección IP</label>
      <select onChange=${(e) => onSeleccionar(e.target.value)}>
        <option value="">Seleccionar…</option>
        ${disponibles.map((ip) => html`<option key=${ip} value=${ip} class="mono">${ip}</option>`)}
      </select>
      <div class="ayuda">${disponibles.length} IP disponibles en este router.</div>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Tabla de inventario de IPs
// ---------------------------------------------------------------------

function useInventarioIPs({ routerFiltro, estadoFiltro }) {
  const [ips, setIps] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    let ref = db.collection('ip_direcciones');

    if (routerFiltro && routerFiltro !== 'todos') {
      ref = ref.where('routerId', '==', routerFiltro);
    }
    if (estadoFiltro && estadoFiltro !== 'todos') {
      ref = ref.where('estado', '==', estadoFiltro);
    }

    const unsub = ref
      .orderBy(firebase.firestore.FieldPath.documentId())
      .limit(100)
      .onSnapshot(
        (snap) => {
          setIps(snap.docs.map((d) => ({ ip: d.id, ...d.data() })));
          setCargando(false);
        },
        (err) => { console.error(err); setCargando(false); }
      );

    return unsub;
  }, [routerFiltro, estadoFiltro]);

  return { ips, cargando };
}

function TablaIPs() {
  const [routerFiltro, setRouterFiltro] = useState('todos');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const { ips, cargando } = useInventarioIPs({ routerFiltro, estadoFiltro });
  const [routers, setRouters] = useState([]);

  useEffect(() => {
    const unsub = db.collection('routers').onSnapshot((snap) => {
      setRouters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  return html`
    <div>
      <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: '0 0 16px' }}>Direcciones IP</h1>

      <div class="card" style=${{ marginBottom: '16px' }}>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '0 1 220px', marginBottom: 0 }}>
            <label>Router</label>
            <select value=${routerFiltro} onChange=${(e) => setRouterFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              ${routers.map((r) => html`<option key=${r.id} value=${r.id}>${r.nombre}</option>`)}
            </select>
          </div>
          <div class="campo" style=${{ flex: '0 1 220px', marginBottom: 0 }}>
            <label>Estado</label>
            <select value=${estadoFiltro} onChange=${(e) => setEstadoFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              ${Object.entries(ESTADOS_IP).map(([valor, info]) => html`<option key=${valor} value=${valor}>${info.etiqueta}</option>`)}
            </select>
          </div>
        </div>
      </div>

      <div class="card" style=${{ padding: 0 }}>
        ${cargando
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">Cargando inventario…</div>`
          : ips.length === 0
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">No hay IPs con estos filtros.</div>`
          : html`
              <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style=${{ borderBottom: '1px solid var(--color-borde)', textAlign: 'left' }}>
                    <th style=${estiloTh}>IP</th>
                    <th style=${estiloTh}>Router</th>
                    <th style=${estiloTh}>Estado</th>
                    <th style=${estiloTh}>Cliente</th>
                    <th style=${estiloTh}>Fecha de asignación</th>
                  </tr>
                </thead>
                <tbody>
                  ${ips.map(
                    (ipRow) => html`
                      <tr key=${ipRow.ip} style=${{ borderBottom: '1px solid var(--color-borde)' }}>
                        <td style=${estiloTd} class="mono">${ipRow.ip}</td>
                        <td style=${estiloTd} class="texto-secundario">${ipRow.routerId}</td>
                        <td style=${estiloTd}><${EtiquetaEstadoIP} estado=${ipRow.estado} /></td>
                        <td style=${estiloTd} class="texto-secundario">${ipRow.clienteId ?? '—'}</td>
                        <td style=${estiloTd} class="texto-secundario">
                          ${ipRow.fechaAsignacion ? new Date(ipRow.fechaAsignacion.seconds * 1000).toLocaleDateString('es-PY') : '—'}
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

const estiloTh = { padding: '10px 16px', fontSize: 'var(--texto-etiqueta)', color: 'var(--color-texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.03em' };
const estiloTd = { padding: '12px 16px', fontSize: 'var(--texto-normal)' };

function ModuloIPs() {
  return html`<${TablaIPs} />`;
}
