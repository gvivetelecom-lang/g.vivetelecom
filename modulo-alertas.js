// modulo-alertas.js — Centro de alertas (sección 19 de los lineamientos):
// cruza señales de distintas colecciones en una sola vista priorizada.
// Se carga después de modulo-routers.js.
//
// Nota de escala: algunas de estas consultas (sobre todo la de
// inconsistencia financiero/técnico) hacen lecturas adicionales por
// cada cliente candidato. Con decenas o pocos cientos de clientes
// suspendidos es perfectamente viable desde el navegador; si el
// volumen crece mucho, esto se recalcula mejor como un job del
// servidor interno que mantenga un documento de alertas ya resuelto.

const SEVERIDAD = {
  critica: { etiqueta: 'Crítica', clase: 'etiqueta-suspendido', orden: 0 },
  advertencia: { etiqueta: 'Advertencia', clase: 'etiqueta-pendiente', orden: 1 },
  info: { etiqueta: 'Info', clase: 'etiqueta-info', orden: 2 },
};

function EtiquetaSeveridad({ nivel }) {
  const info = SEVERIDAD[nivel] ?? SEVERIDAD.info;
  return html`<span class="etiqueta-estado ${info.clase}">${info.etiqueta}</span>`;
}

const MINUTOS_IP_ESTANCADA = 120; // más de 2hs reservada sin confirmarse = probable falla del agente

async function detectarRoutersSinRespuesta() {
  const snap = await db.collection('routers').where('estado', '==', 'sin_respuesta').limit(20).get();
  return snap.docs.map((d) => ({
    id: `router-${d.id}`,
    severidad: 'critica',
    titulo: `Router "${d.data().nombre}" sin respuesta`,
    detalle: `Sitio: ${d.data().sitio ?? '—'}`,
    ruta: 'routers',
  }));
}

async function detectarOrdenesConError() {
  const snap = await db.collection('ordenes_mikrotik').where('estado', '==', 'error').limit(30).get();

  const candidatas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const alertas = [];

  for (const orden of candidatas) {
    // Si ya se reintentó y una orden posterior para el mismo servicio
    // se completó bien, esta queda obsoleta — no tiene sentido seguir
    // alertando sobre algo que ya se resolvió.
    if (orden.servicioId) {
      const masReciente = await db.collection('ordenes_mikrotik')
        .where('servicioId', '==', orden.servicioId)
        .orderBy('fechaSolicitud', 'desc')
        .limit(1)
        .get();

      const ultimaEstado = masReciente.docs[0]?.data()?.estado;
      if (ultimaEstado && ultimaEstado !== 'error') continue; // ya se resolvió, se omite
    }

    alertas.push({
      id: `orden-${orden.id}`,
      severidad: 'advertencia',
      titulo: `Orden "${orden.tipo}" falló`,
      detalle: orden.error ?? 'Sin detalle de error',
      ruta: null,
    });
  }

  return alertas;
}

async function detectarIPsEstancadas() {
  const snap = await db.collection('ip_direcciones').where('estado', '==', 'reservada').limit(100).get();
  const ahora = Date.now();

  return snap.docs
    .filter((d) => {
      const fecha = d.data().fechaAsignacion;
      if (!fecha) return false;
      const minutos = (ahora - fecha.seconds * 1000) / 60000;
      return minutos > MINUTOS_IP_ESTANCADA;
    })
    .map((d) => ({
      id: `ip-${d.id}`,
      severidad: 'advertencia',
      titulo: `IP ${d.id} reservada hace más de ${MINUTOS_IP_ESTANCADA / 60}hs sin confirmarse`,
      detalle: 'Probable falla del agente al momento de la asignación. Revisar la orden asociada.',
      ruta: 'ips',
    }));
}

async function detectarInconsistenciasFinancieroTecnico() {
  const clientesSnap = await db.collection('clientes').where('estadoComercial', '==', 'suspendido').limit(50).get();
  const clientesIds = clientesSnap.docs.map((d) => d.id);
  if (clientesIds.length === 0) return [];

  const alertas = [];
  // Firestore permite hasta 30 valores por consulta "in" — se agrupa
  // en lotes si hay más de 30 clientes suspendidos a la vez.
  //
  // OJO: esta consulta combina "in" + igualdad en dos campos distintos,
  // así que la primera vez que corra Firestore va a tirar un error
  // "failed-precondition" con un link para crear el índice compuesto
  // necesario (servicios: clienteId + estadoTecnico). Es normal, se
  // acepta una sola vez desde ese link y no vuelve a pasar.
  for (let i = 0; i < clientesIds.length; i += 30) {
    const lote = clientesIds.slice(i, i + 30);
    const serviciosSnap = await db.collection('servicios')
      .where('clienteId', 'in', lote)
      .where('estadoTecnico', '==', 'configurado')
      .get();

    serviciosSnap.docs.forEach((s) => {
      const cliente = clientesSnap.docs.find((c) => c.id === s.data().clienteId);
      alertas.push({
        id: `inconsistencia-${s.id}`,
        severidad: 'critica',
        titulo: `${cliente?.data()?.nombre ?? 'Cliente'} suspendido por mora pero conectado`,
        detalle: 'El servicio figura como "configurado" en el router pese a que el cliente está suspendido.',
        ruta: 'clientes',
        clienteId: s.data().clienteId,
      });
    });
  }
  return alertas;
}

function useAlertas() {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const resultados = await Promise.all([
        detectarRoutersSinRespuesta(),
        detectarOrdenesConError(),
        detectarIPsEstancadas(),
        detectarInconsistenciasFinancieroTecnico(),
      ]);
      const todas = resultados.flat().sort(
        (a, b) => (SEVERIDAD[a.severidad]?.orden ?? 9) - (SEVERIDAD[b.severidad]?.orden ?? 9)
      );
      setAlertas(todas);
    } catch (err) {
      console.error(err);
      setError('No fue posible calcular las alertas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 60000);
    return () => clearInterval(intervalo);
  }, []);

  return { alertas, cargando, error, recargar: cargar };
}

function ModuloAlertas({ navegarA }) {
  const { alertas, cargando, error, recargar } = useAlertas();

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Alertas</h1>
        <button class="btn btn-secundario" onClick=${recargar} disabled=${cargando}>
          <i class="fa-solid fa-arrows-rotate ${cargando ? 'fa-spin' : ''}"></i> Actualizar
        </button>
      </div>

      ${error && html`<div class="login-error">${error}</div>`}

      ${cargando
        ? html`<p class="texto-secundario">Analizando el sistema…</p>`
        : alertas.length === 0
        ? html`
            <div class="card" style=${{ textAlign: 'center', padding: '40px' }}>
              <i class="fa-solid fa-circle-check" style=${{ fontSize: '2rem', color: 'var(--estado-activo)', marginBottom: '12px' }}></i>
              <p>No hay alertas activas en este momento.</p>
            </div>
          `
        : html`
            <div class="card" style=${{ padding: 0 }}>
              ${alertas.map(
                (a) => html`
                  <div
                    key=${a.id}
                    class="flex items-center gap-16"
                    style=${{ padding: '14px 16px', borderBottom: '1px solid var(--color-borde)', cursor: a.ruta ? 'pointer' : 'default' }}
                    onClick=${() => a.ruta && navegarA(a.ruta)}
                  >
                    <${EtiquetaSeveridad} nivel=${a.severidad} />
                    <div style=${{ flex: 1 }}>
                      <div style=${{ fontWeight: 500 }}>${a.titulo}</div>
                      <div class="texto-secundario">${a.detalle}</div>
                    </div>
                    ${a.ruta && html`<i class="fa-solid fa-chevron-right texto-secundario"></i>`}
                  </div>
                `
              )}
            </div>
          `}
    </div>
  `;
}
