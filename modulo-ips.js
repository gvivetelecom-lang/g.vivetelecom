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
  const [totalDisponibles, setTotalDisponibles] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!routerId) { setDisponibles([]); setTotalDisponibles(null); return; }
    setCargando(true);

    // El conteo real (para mostrar en el mensaje) es una consulta
    // aparte y liviana — no listamos las 254 en el desplegable, serían
    // inmanejables para elegir a mano. contarDocumentos() nunca lanza
    // una excepción sincrónica, así que un fallo acá no puede colgar
    // el resto de la pantalla.
    contarDocumentos(
      db.collection('ip_direcciones').where('routerId', '==', routerId).where('estado', '==', 'disponible')
    ).then(setTotalDisponibles).catch((err) => console.error(err));

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
      <div class="ayuda">
        ${totalDisponibles != null && totalDisponibles > disponibles.length
          ? `Mostrando las primeras ${disponibles.length} de ${totalDisponibles} IP disponibles en este router.`
          : `${totalDisponibles ?? disponibles.length} IP disponibles en este router.`}
      </div>
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

// estiloTh y estiloTd ya están declarados en app.js (compartidos entre módulos)

// ---------------------------------------------------------------------
// Carga de bloque de IP — expande un CIDR a documentos individuales
// en ip_direcciones (ver sección 6 del modelo de datos). El ID de
// documento de destino ES la propia IP, lo que habilita la reserva
// transaccional que ya usa reservarIP().
// ---------------------------------------------------------------------

function ipAEntero(ip) {
  return ip.split('.').reduce((acc, octeto) => (acc << 8) + Number(octeto), 0) >>> 0;
}

function enteroAIP(entero) {
  return [24, 16, 8, 0].map((despl) => (entero >>> despl) & 255).join('.');
}

function expandirCIDR(cidr) {
  const [base, bitsStr] = cidr.split('/');
  const prefijo = Number(bitsStr);
  if (!base || Number.isNaN(prefijo) || prefijo < 0 || prefijo > 32) {
    throw new Error('CIDR inválido. Formato esperado: 10.20.30.0/24');
  }

  const baseInt = ipAEntero(base);
  const mascara = prefijo === 0 ? 0 : (0xFFFFFFFF << (32 - prefijo)) >>> 0;
  const red = baseInt & mascara;
  const tamano = 2 ** (32 - prefijo);
  const broadcast = red + tamano - 1;

  // Para /31 y /32 no hay red/broadcast que excluir (redes punto a
  // punto o IPs individuales); para el resto se excluyen las dos.
  const inicio = prefijo >= 31 ? red : red + 1;
  const fin = prefijo >= 31 ? broadcast : broadcast - 1;

  const ips = [];
  for (let i = inicio; i <= fin; i++) ips.push(enteroAIP(i));
  return ips;
}

function CargarBloqueIP({ usuarioId, onCompletado, onCancelar }) {
  const [cidr, setCidr] = useState('');
  const [routerId, setRouterId] = useState('');
  const [pool, setPool] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [routers, setRouters] = useState([]);
  const [previsualizacion, setPrevisualizacion] = useState(null);
  const [progreso, setProgreso] = useState(null); // { hecho, total }
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = db.collection('routers').onSnapshot((snap) => setRouters(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const previsualizar = () => {
    setError(null);
    try {
      const ips = expandirCIDR(cidr.trim());
      setPrevisualizacion(ips);
    } catch (err) {
      setError(err.message);
      setPrevisualizacion(null);
    }
  };

  const confirmar = async () => {
    if (!routerId) { setError('Seleccioná el router al que pertenece este bloque.'); return; }
    if (!previsualizacion) { setError('Primero verificá el bloque con "Previsualizar".'); return; }

    setError(null);
    const ips = previsualizacion;
    setProgreso({ hecho: 0, total: ips.length });

    try {
      const bloqueRef = await db.collection('ip_bloques').add({
        cidr: cidr.trim(),
        routerId,
        pool: pool.trim() || null,
        descripcion: descripcion.trim(),
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });

      // 450 por batch para dejar margen bajo el límite de 500 de Firestore
      for (let i = 0; i < ips.length; i += 450) {
        const trozo = ips.slice(i, i + 450);
        const batch = db.batch();
        trozo.forEach((ip) => {
          batch.set(db.collection('ip_direcciones').doc(ip), {
            bloqueId: bloqueRef.id,
            routerId,
            pool: pool.trim() || null,
            estado: 'disponible',
            servicioId: null,
            clienteId: null,
            fechaAsignacion: null,
            usuarioResponsable: null,
          });
        });
        await batch.commit();
        setProgreso({ hecho: Math.min(i + 450, ips.length), total: ips.length });
      }

      onCompletado();
    } catch (err) {
      setError(
        err.code === 'permission-denied'
          ? 'Sin permiso para cargar bloques de IP (se requiere admin_red o superadmin).'
          : 'Ocurrió un error a mitad de la carga. Revisá cuántas IPs quedaron creadas antes de reintentar (para no duplicar).'
      );
      console.error(err);
      setProgreso(null);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '520px', marginBottom: '16px' }}>
      <div class="card-titulo">Cargar bloque de IP</div>

      ${error && html`<div class="login-error">${error}</div>`}

      <div class="campo">
        <label>Router</label>
        <select value=${routerId} onChange=${(e) => setRouterId(e.target.value)}>
          <option value="">Seleccionar…</option>
          ${routers.map((r) => html`<option key=${r.id} value=${r.id}>${r.nombre}</option>`)}
        </select>
      </div>

      <div class="campo">
        <label>CIDR</label>
        <input type="text" value=${cidr} onInput=${(e) => { setCidr(e.target.value); setPrevisualizacion(null); }} placeholder="10.20.30.0/24" class="mono" />
        <div class="ayuda">Bloques típicos de ISP (/24 a /20). Evitá cargar de una algo mayor a /20 (más de 4.000 IPs) desde el navegador.</div>
      </div>

      <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
        <div class="campo" style=${{ flex: 1 }}>
          <label>Pool (opcional)</label>
          <input type="text" value=${pool} onInput=${(e) => setPool(e.target.value)} />
        </div>
        <div class="campo" style=${{ flex: 1 }}>
          <label>Descripción</label>
          <input type="text" value=${descripcion} onInput=${(e) => setDescripcion(e.target.value)} />
        </div>
      </div>

      ${!previsualizacion
        ? html`<button type="button" class="btn btn-secundario" onClick=${previsualizar}>Previsualizar</button>`
        : html`
            <div class="login-error" style=${{ background: 'rgba(37,99,235,0.06)', borderColor: 'rgba(37,99,235,0.25)', color: 'var(--estado-proceso)' }}>
              Este bloque va a crear <strong>${previsualizacion.length}</strong> direcciones IP disponibles, desde ${previsualizacion[0]} hasta ${previsualizacion[previsualizacion.length - 1]}.
            </div>
          `}

      ${progreso && html`
        <div class="campo">
          <div class="ayuda">Cargando ${progreso.hecho} / ${progreso.total}…</div>
          <div style=${{ height: '6px', background: 'var(--color-borde)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style=${{ height: '100%', width: `${(progreso.hecho / progreso.total) * 100}%`, background: 'var(--color-naranja)' }}></div>
          </div>
        </div>
      `}

      <div class="flex justify-between" style=${{ marginTop: '12px' }}>
        <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${!!progreso}>Cancelar</button>
        <button type="button" class="btn btn-principal" onClick=${confirmar} disabled=${!previsualizacion || !!progreso}>
          ${progreso ? 'Cargando…' : 'Confirmar y cargar'}
        </button>
      </div>
    </div>
  `;
}

function ModuloIPs({ usuarioId }) {
  const [mostrarCarga, setMostrarCarga] = useState(false);

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Direcciones IP</h1>
        <button class="btn btn-principal" onClick=${() => setMostrarCarga(true)}>
          <i class="fa-solid fa-plus"></i> Cargar bloque
        </button>
      </div>

      ${mostrarCarga && html`
        <${CargarBloqueIP} usuarioId=${usuarioId} onCancelar=${() => setMostrarCarga(false)} onCompletado=${() => setMostrarCarga(false)} />
      `}

      <${TablaIPs} />
    </div>
  `;
}
