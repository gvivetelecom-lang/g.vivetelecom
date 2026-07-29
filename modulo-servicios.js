// modulo-servicios.js — Vista global de todos los servicios, con
// filtros. El alta se sigue haciendo desde la ficha del cliente
// (AltaServicioPPPoE en modulo-alta-servicio.js) porque un servicio
// no tiene sentido sin un cliente ya seleccionado — acá solo se
// consulta y se navega al cliente dueño de cada uno.
// Se carga después de modulo-alta-servicio.js.

const ESTADOS_TECNICOS = {
  pendiente_config: { etiqueta: 'Pendiente de configurar', clase: 'etiqueta-pendiente' },
  configurado: { etiqueta: 'Configurado', clase: 'etiqueta-activo' },
  suspendido: { etiqueta: 'Suspendido', clase: 'etiqueta-suspendido' },
  error: { etiqueta: 'Error', clase: 'etiqueta-suspendido' },
  baja: { etiqueta: 'Dado de baja', clase: 'etiqueta-inactivo' },
};

function EtiquetaEstadoTecnico({ estado }) {
  const info = ESTADOS_TECNICOS[estado] ?? { etiqueta: estado, clase: 'etiqueta-info' };
  return html`<span class="etiqueta-estado ${info.clase}">${info.etiqueta}</span>`;
}

function useServiciosGlobal({ estadoFiltro, routerFiltro }) {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    let ref = db.collection('servicios').limit(100);

    if (estadoFiltro !== 'todos' && routerFiltro !== 'todos') {
      ref = db.collection('servicios').where('estadoTecnico', '==', estadoFiltro).where('routerId', '==', routerFiltro).limit(100);
    } else if (estadoFiltro !== 'todos') {
      ref = db.collection('servicios').where('estadoTecnico', '==', estadoFiltro).limit(100);
    } else if (routerFiltro !== 'todos') {
      ref = db.collection('servicios').where('routerId', '==', routerFiltro).limit(100);
    }

    const unsub = ref.onSnapshot(
      (snap) => { setServicios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false); },
      (err) => { console.error(err); setCargando(false); }
    );
    return unsub;
  }, [estadoFiltro, routerFiltro]);

  return { servicios, cargando };
}

function ModuloServicios({ navegarACliente }) {
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [routerFiltro, setRouterFiltro] = useState('todos');
  const [routers, setRouters] = useState([]);
  const { servicios, cargando } = useServiciosGlobal({ estadoFiltro, routerFiltro });

  useEffect(() => {
    const unsub = db.collection('routers').onSnapshot((snap) => setRouters(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  return html`
    <div>
      <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: '0 0 16px' }}>Servicios</h1>

      <div class="card" style=${{ marginBottom: '16px' }}>
        <p class="texto-secundario" style=${{ margin: '0 0 12px' }}>
          Para dar de alta un servicio nuevo, entrá a la ficha del cliente correspondiente → "Nuevo servicio PPPoE".
        </p>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '0 1 220px', marginBottom: 0 }}>
            <label>Estado técnico</label>
            <select value=${estadoFiltro} onChange=${(e) => setEstadoFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              ${Object.entries(ESTADOS_TECNICOS).map(([v, info]) => html`<option key=${v} value=${v}>${info.etiqueta}</option>`)}
            </select>
          </div>
          <div class="campo" style=${{ flex: '0 1 220px', marginBottom: 0 }}>
            <label>Router</label>
            <select value=${routerFiltro} onChange=${(e) => setRouterFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              ${routers.map((r) => html`<option key=${r.id} value=${r.id}>${r.nombre}</option>`)}
            </select>
          </div>
        </div>
      </div>

      <div class="card" style=${{ padding: 0 }}>
        ${cargando
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">Cargando servicios…</div>`
          : servicios.length === 0
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">No hay servicios con estos filtros.</div>`
          : html`
              <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style=${{ borderBottom: '1px solid var(--color-borde)', textAlign: 'left' }}>
                    <th style=${estiloTh}>Usuario PPPoE</th>
                    <th style=${estiloTh}>IP</th>
                    <th style=${estiloTh}>Router</th>
                    <th style=${estiloTh}>Estado técnico</th>
                    <th style=${estiloTh}>Estado comercial</th>
                    <th style=${estiloTh}></th>
                  </tr>
                </thead>
                <tbody>
                  ${servicios.map(
                    (s) => html`
                      <tr key=${s.id} style=${{ borderBottom: '1px solid var(--color-borde)', cursor: 'pointer' }} onClick=${() => navegarACliente(s.clienteId)}>
                        <td style=${estiloTd} class="mono">${s.usuarioPPPoE ?? '—'}</td>
                        <td style=${estiloTd} class="mono texto-secundario">${s.ipAsignadaId ?? '—'}</td>
                        <td style=${estiloTd} class="texto-secundario">${s.routerId}</td>
                        <td style=${estiloTd}><${EtiquetaEstadoTecnico} estado=${s.estadoTecnico} /></td>
                        <td style=${estiloTd} class="texto-secundario">${s.estadoComercial}</td>
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
