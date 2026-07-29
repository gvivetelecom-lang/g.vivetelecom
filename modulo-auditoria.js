// modulo-auditoria.js — Historial de cambios del sistema (sección 13
// del documento funcional). Se carga después de modulo-usuarios.js.
//
// Va a mostrarse vacío hasta que auditoriaWriter.js esté corriendo en
// el servidor interno — es esa pieza la que efectivamente escribe acá,
// esta pantalla solo lee.

const ENTIDADES_AUDITABLES = [
  'clientes', 'servicios', 'planes', 'routers', 'ip_direcciones',
  'cuentas', 'pagos', 'grupos_corte', 'prorrogas_convenios',
];

const ACCIONES = {
  creacion: { etiqueta: 'Creación', clase: 'etiqueta-activo' },
  modificacion: { etiqueta: 'Modificación', clase: 'etiqueta-info' },
  eliminacion: { etiqueta: 'Eliminación', clase: 'etiqueta-suspendido' },
};

function EtiquetaAccion({ accion }) {
  const info = ACCIONES[accion] ?? { etiqueta: accion, clase: 'etiqueta-info' };
  return html`<span class="etiqueta-estado ${info.clase}">${info.etiqueta}</span>`;
}

function useAuditoria({ entidadFiltro }) {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    let ref = db.collection('auditoria').orderBy('fecha', 'desc').limit(100);
    if (entidadFiltro && entidadFiltro !== 'todas') {
      // Combina igualdad + orderBy en campos distintos: la primera vez
      // que se use un filtro acá, Firestore va a pedir crear un índice
      // compuesto (auditoria: entidad + fecha). Se acepta una vez
      // desde el link del error y no vuelve a pasar.
      ref = db.collection('auditoria').where('entidad', '==', entidadFiltro).orderBy('fecha', 'desc').limit(100);
    }

    const unsub = ref.onSnapshot(
      (snap) => {
        setRegistros(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => { console.error(err); setCargando(false); }
    );
    return unsub;
  }, [entidadFiltro]);

  return { registros, cargando };
}

function DiferenciasCambio({ antes, despues }) {
  const claves = new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]);

  if (claves.size === 0) {
    return html`<p class="texto-secundario">Sin detalle de campos.</p>`;
  }

  return html`
    <table style=${{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--texto-secundario)' }}>
      <thead>
        <tr>
          <th style=${{ textAlign: 'left', padding: '4px 8px' }}>Campo</th>
          <th style=${{ textAlign: 'left', padding: '4px 8px' }}>Antes</th>
          <th style=${{ textAlign: 'left', padding: '4px 8px' }}>Después</th>
        </tr>
      </thead>
      <tbody>
        ${[...claves].map(
          (k) => html`
            <tr key=${k}>
              <td style=${{ padding: '4px 8px' }} class="mono">${k}</td>
              <td style=${{ padding: '4px 8px', color: 'var(--estado-suspendido)' }}>${JSON.stringify(antes?.[k] ?? null)}</td>
              <td style=${{ padding: '4px 8px', color: 'var(--estado-activo)' }}>${JSON.stringify(despues?.[k] ?? null)}</td>
            </tr>
          `
        )}
      </tbody>
    </table>
  `;
}

function FilaAuditoria({ registro }) {
  const [expandido, setExpandido] = useState(false);

  return html`
    <div style=${{ borderBottom: '1px solid var(--color-borde)' }}>
      <div
        class="flex items-center gap-16"
        style=${{ padding: '12px 16px', cursor: 'pointer' }}
        onClick=${() => setExpandido(!expandido)}
      >
        <i class="fa-solid ${expandido ? 'fa-chevron-down' : 'fa-chevron-right'} texto-secundario" style=${{ width: '14px' }}></i>
        <${EtiquetaAccion} accion=${registro.accion} />
        <div style=${{ flex: 1 }}>
          <span style=${{ fontWeight: 500 }}>${registro.entidad}</span>
          <span class="texto-secundario mono"> ${registro.entidadId}</span>
        </div>
        <span class="texto-secundario">${registro.usuarioId}</span>
        <span class="texto-secundario">
          ${registro.fecha ? new Date(registro.fecha.seconds * 1000).toLocaleString('es-PY') : '—'}
        </span>
      </div>
      ${expandido && html`
        <div style=${{ padding: '0 16px 16px 46px' }}>
          <${DiferenciasCambio} antes=${registro.valoresAntes} despues=${registro.valoresDespues} />
        </div>
      `}
    </div>
  `;
}

function ModuloAuditoria() {
  const [entidadFiltro, setEntidadFiltro] = useState('todas');
  const { registros, cargando } = useAuditoria({ entidadFiltro });

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Historial y auditoría</h1>
        <select value=${entidadFiltro} onChange=${(e) => setEntidadFiltro(e.target.value)} style=${{ maxWidth: '220px' }}>
          <option value="todas">Todas las entidades</option>
          ${ENTIDADES_AUDITABLES.map((e) => html`<option key=${e} value=${e}>${e}</option>`)}
        </select>
      </div>

      <div class="card" style=${{ padding: 0 }}>
        ${cargando
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">Cargando historial…</div>`
          : registros.length === 0
          ? html`
              <div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">
                No hay registros de auditoría todavía. Esto es normal si <code>auditoriaWriter.js</code> todavía no está corriendo en el servidor interno.
              </div>
            `
          : registros.map((r) => html`<${FilaAuditoria} key=${r.id} registro=${r} />`)}
      </div>
    </div>
  `;
}
