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

function FormularioAltaRouter({ usuarioId, onCompletado, onCancelar }) {
  const [form, setForm] = useState({
    codigo: '', nombre: '', modelo: '', numeroSerie: '', routerOS: '',
    funcion: 'concentrador', sitio: '', ciudad: '', zona: '',
    ipGestion: '', puertoApi: '8729', tipoConexion: 'api-ssl',
    agenteResponsable: '', estado: 'mantenimiento',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const confirmar = async (e) => {
    e.preventDefault();
    if (!form.codigo.trim() || !form.nombre.trim() || !form.ipGestion.trim()) {
      setError('Código, nombre e IP de gestión son obligatorios.');
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      // El código elegido acá tiene que coincidir EXACTAMENTE con la
      // clave que uses en routersCredentials.json del servidor interno
      // — es lo que usa agenteMikrotik.js para encontrar las
      // credenciales de conexión reales.
      await db.collection('routers').doc(form.codigo.trim()).set({
        ...form,
        puertoApi: Number(form.puertoApi) || 8729,
        coordenadas: null,
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });
      onCompletado();
    } catch (err) {
      setError(
        err.code === 'permission-denied'
          ? 'Tu usuario no tiene permiso para crear routers (se requiere admin_red o superadmin).'
          : 'No fue posible crear el router. Intente nuevamente.'
      );
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '620px', marginBottom: '16px' }}>
      <div class="card-titulo">Nuevo router</div>

      ${error && html`<div class="login-error">${error}</div>`}

      <form onSubmit=${confirmar}>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Código (ID único)</label>
            <input type="text" value=${form.codigo} onInput=${set('codigo')} placeholder="ej: RTR-CDE" class="mono" required />
            <div class="ayuda">Debe coincidir con la clave en routersCredentials.json del servidor interno.</div>
          </div>
          <div class="campo" style=${{ flex: '2 1 220px' }}>
            <label>Nombre</label>
            <input type="text" value=${form.nombre} onInput=${set('nombre')} required />
          </div>
        </div>

        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Modelo</label>
            <input type="text" value=${form.modelo} onInput=${set('modelo')} placeholder="ej: CCR2004-1G-12S+2XS" />
          </div>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>N° de serie</label>
            <input type="text" value=${form.numeroSerie} onInput=${set('numeroSerie')} />
          </div>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>RouterOS</label>
            <input type="text" value=${form.routerOS} onInput=${set('routerOS')} placeholder="7.15" />
          </div>
        </div>

        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Función</label>
            <select value=${form.funcion} onChange=${set('funcion')}>
              <option value="concentrador">Concentrador</option>
              <option value="distribucion">Distribución</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Sitio</label>
            <input type="text" value=${form.sitio} onInput=${set('sitio')} />
          </div>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Ciudad / Zona</label>
            <input type="text" value=${form.ciudad} onInput=${set('ciudad')} placeholder="Ciudad" />
          </div>
        </div>

        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>IP de gestión</label>
            <input type="text" value=${form.ipGestion} onInput=${set('ipGestion')} placeholder="10.0.0.1" class="mono" required />
          </div>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>Puerto API</label>
            <input type="number" value=${form.puertoApi} onInput=${set('puertoApi')} />
          </div>
          <div class="campo" style=${{ flex: '1 1 140px' }}>
            <label>Conexión</label>
            <select value=${form.tipoConexion} onChange=${set('tipoConexion')}>
              <option value="api-ssl">API-SSL</option>
              <option value="api">API</option>
            </select>
          </div>
        </div>

        <div class="campo">
          <label>Estado inicial</label>
          <select value=${form.estado} onChange=${set('estado')}>
            <option value="mantenimiento">En mantenimiento (recomendado hasta conectar el agente)</option>
            <option value="operativo">Operativo</option>
            <option value="deshabilitado">Deshabilitado</option>
          </select>
          <div class="ayuda">Una vez que el agente MikroTik esté corriendo, este estado se actualiza solo según pueda o no comunicarse con el router.</div>
        </div>

        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando}>
            ${enviando ? 'Creando…' : 'Crear router'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function ModuloRouters({ usuarioId }) {
  const { routers, cargando } = useRoutersConMetricas();
  const [mostrarAlta, setMostrarAlta] = useState(false);

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Routers</h1>
        <button class="btn btn-principal" onClick=${() => setMostrarAlta(true)}>
          <i class="fa-solid fa-plus"></i> Nuevo router
        </button>
      </div>

      ${mostrarAlta && html`
        <${FormularioAltaRouter} usuarioId=${usuarioId} onCancelar=${() => setMostrarAlta(false)} onCompletado=${() => setMostrarAlta(false)} />
      `}

      ${cargando
        ? html`<p class="texto-secundario">Cargando infraestructura…</p>`
        : routers.length === 0
        ? html`<div class="card"><p class="texto-secundario">Todavía no hay routers cargados.</p></div>`
        : html`<div class="flex-col gap-16">${routers.map((r) => html`<${TarjetaRouter} key=${r.id} router=${r} />`)}</div>`}
    </div>
  `;
}
