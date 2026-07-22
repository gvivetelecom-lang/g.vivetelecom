// modulo-routers.js — Vista general de infraestructura MikroTik.
// Se carga después de modulo-pagos.js.

const ESTADOS_ROUTER = {
  operativo: { etiqueta: 'Operativo', clase: 'etiqueta-activo', icono: 'fa-circle-check' },
  alerta: { etiqueta: 'Con alerta', clase: 'etiqueta-pendiente', icono: 'fa-triangle-exclamation' },
  sin_respuesta: { etiqueta: 'Sin respuesta', clase: 'etiqueta-suspendido', icono: 'fa-plug-circle-xmark' },
  mantenimiento: { etiqueta: 'En mantenimiento', clase: 'etiqueta-proceso', icono: 'fa-screwdriver-wrench' },
  deshabilitado: { etiqueta: 'Deshabilitado', clase: 'etiqueta-inactivo', icono: 'fa-power-off' },
};

// Orden de prioridad para que los routers con problemas aparezcan
// primero (sección 15 de los lineamientos: "Los routers sin respuesta
// o con alertas deberán aparecer en primer lugar").
const PRIORIDAD_ESTADO = { sin_respuesta: 0, alerta: 1, mantenimiento: 2, operativo: 3, deshabilitado: 4 };

function EtiquetaEstadoRouter({ estado }) {
  const info = ESTADOS_ROUTER[estado] ?? { etiqueta: estado, clase: 'etiqueta-info', icono: 'fa-circle-question' };
  return html`<span class="etiqueta-estado ${info.clase}"><i class="fa-solid ${info.icono}"></i> ${info.etiqueta}</span>`;
}

function useRoutersConMetricas() {
  const [routers, setRouters] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsub = db.collection('routers').onSnapshot(async (snap) => {
      const base = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Trae la métrica actual de cada router. Con pocas decenas de
      // routers esto es liviano; si la cantidad crece mucho, conviene
      // desnormalizar las métricas clave dentro del propio documento
      // del router en vez de leer la subcolección aparte.
      const conMetricas = await Promise.all(
        base.map(async (r) => {
          const metricaDoc = await db.collection('routers').doc(r.id).collection('metricas').doc('actual').get();
          return { ...r, metricas: metricaDoc.exists ? metricaDoc.data() : null };
        })
      );

      conMetricas.sort((a, b) => (PRIORIDAD_ESTADO[a.estado] ?? 9) - (PRIORIDAD_ESTADO[b.estado] ?? 9));
      setRouters(conMetricas);
      setCargando(false);
    });

    return unsub;
  }, []);

  return { routers, cargando };
}

function TarjetaRouter({ router }) {
  const m = router.metricas;
  return html`
    <div class="card">
      <div class="flex items-center justify-between" style=${{ marginBottom: '12px' }}>
        <div>
          <div style=${{ fontWeight: 600, fontSize: 'var(--texto-subtitulo)' }}>${router.nombre}</div>
          <div class="texto-secundario mono">${router.codigo} · ${router.modelo}</div>
        </div>
        <${EtiquetaEstadoRouter} estado=${router.estado} />
      </div>

      <div class="flex gap-16" style=${{ flexWrap: 'wrap', fontSize: 'var(--texto-secundario)' }}>
        <${MetricaMini} etiqueta="Uptime" valor=${m ? formatoUptime(m.uptime) : '—'} />
        <${MetricaMini} etiqueta="CPU" valor=${m ? `${m.cpu}%` : '—'} alerta=${m?.cpu > 85} />
        <${MetricaMini} etiqueta="Memoria" valor=${m ? `${m.memoria}%` : '—'} alerta=${m?.memoria > 85} />
        <${MetricaMini} etiqueta="Sesiones" valor=${m?.sesionesActivas ?? '—'} />
        <${MetricaMini} etiqueta="Latencia" valor=${m ? `${m.latencia} ms` : '—'} />
      </div>

      <div class="texto-secundario" style=${{ marginTop: '10px' }}>
        Última respuesta: ${m?.ultimaConsulta ? new Date(m.ultimaConsulta.seconds * 1000).toLocaleString('es-PY') : 'sin datos aún'}
      </div>
    </div>
  `;
}

function MetricaMini({ etiqueta, valor, alerta }) {
  return html`
    <div>
      <div style=${{ color: alerta ? 'var(--estado-suspendido)' : 'var(--color-texto)', fontWeight: 600 }}>${valor}</div>
      <div class="texto-secundario">${etiqueta}</div>
    </div>
  `;
}

function formatoUptime(segundos) {
  if (!segundos) return '—';
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  return `${dias}d ${horas}h`;
}

function ModuloRouters() {
  const { routers, cargando } = useRoutersConMetricas();

  return html`
    <div>
      <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: '0 0 16px' }}>Routers</h1>

      ${cargando
        ? html`<p class="texto-secundario">Cargando infraestructura…</p>`
        : routers.length === 0
        ? html`<div class="card"><p class="texto-secundario">Todavía no hay routers cargados.</p></div>`
        : html`<div class="flex-col gap-16">${routers.map((r) => html`<${TarjetaRouter} key=${r.id} router=${r} />`)}</div>`}
    </div>
  `;
}
