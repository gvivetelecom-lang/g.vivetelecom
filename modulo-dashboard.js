// modulo-dashboard.js — Panel principal con datos reales. Reemplaza
// los placeholders que tenía app.js. Se carga después de app.js.
//
// Nota técnica: las consultas de conteo (`.count().get()`) y la suma
// de saldos pendientes NO son en tiempo real (Firestore no soporta
// listeners `onSnapshot` sobre agregaciones todavía) — se recalculan
// al entrar al panel y cada 60 segundos, o al tocar "Actualizar".
// Cuando el sistema crezca en volumen de datos, lo ideal es que un
// proceso del servidor interno mantenga un documento
// `indicadores/resumen` actualizado, y que el panel simplemente
// escuche ese documento en tiempo real en vez de recalcular acá.

function useIndicadoresReales() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const [
        clientesTotal,
        clientesActivos,
        clientesSuspendidos,
        pendientesInstalacion,
        cuentasVencidas,
        routersOperativos,
        routersSinRespuesta,
        ordenesPendientes,
        cuentasConSaldo,
      ] = await Promise.all([
        contarDocumentos(db.collection('clientes')),
        contarDocumentos(db.collection('clientes').where('estadoComercial', '==', 'activo')),
        contarDocumentos(db.collection('clientes').where('estadoComercial', '==', 'suspendido')),
        contarDocumentos(db.collection('clientes').where('estadoComercial', '==', 'pendiente')),
        contarDocumentos(db.collection('cuentas').where('estado', '==', 'vencida')),
        contarDocumentos(db.collection('routers').where('estado', '==', 'operativo')),
        contarDocumentos(db.collection('routers').where('estado', '==', 'sin_respuesta')),
        contarDocumentos(db.collection('ordenes_mikrotik').where('estado', '==', 'pendiente')),
        // El monto pendiente se suma del lado del cliente porque no es
        // un conteo simple, sino una suma de campo (no cubierta por
        // contarDocumentos). Con un límite de 500 alcanza sobradamente
        // para el volumen de un ISP regional.
        db.collection('cuentas').where('estado', 'in', ['pendiente', 'parcial', 'vencida']).limit(500).get(),
      ]);

      // Las cuentas pueden estar en distintas monedas (ej: planes en
      // USD y planes en PYG) — sumar todo junto y mostrarlo como un
      // solo número en guaraníes está mal tanto en el valor como en
      // la etiqueta. Se agrupa por moneda y se muestra cada una aparte.
      const montoPendientePorMoneda = {};
      cuentasConSaldo.docs.forEach((d) => {
        const data = d.data();
        const moneda = data.moneda || 'PYG';
        montoPendientePorMoneda[moneda] = (montoPendientePorMoneda[moneda] || 0) + (data.saldo || 0);
      });

      setDatos({
        clientesTotal, clientesActivos, clientesSuspendidos, pendientesInstalacion,
        cuentasVencidas, montoPendientePorMoneda, routersOperativos, routersSinRespuesta, ordenesPendientes,
      });
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error(err);
      setError('No fue posible calcular los indicadores.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 60000); // se refresca solo cada 60s
    return () => clearInterval(intervalo);
  }, []);

  return { datos, cargando, error, ultimaActualizacion, recargar: cargar };
}

function formatoMonedaPorTipo(valor, moneda) {
  if (valor == null) return '—';
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: moneda || 'PYG', maximumFractionDigits: 0 }).format(valor);
}

function valorMontoPendiente(montoPendientePorMoneda) {
  if (montoPendientePorMoneda == null) return null;

  const entradas = Object.entries(montoPendientePorMoneda).filter(([, v]) => v > 0);

  if (entradas.length === 0) return formatoMonedaPorTipo(0, 'PYG');

  if (entradas.length === 1) {
    const [moneda, valor] = entradas[0];
    return formatoMonedaPorTipo(valor, moneda);
  }

  // Más de una moneda con saldo pendiente: se muestran todas apiladas,
  // en letra más chica para que entren en la tarjeta.
  return html`
    <div class="flex flex-col" style=${{ fontSize: '1.15rem', lineHeight: 1.4 }}>
      ${entradas.map(([moneda, valor]) => html`<span key=${moneda}>${formatoMonedaPorTipo(valor, moneda)}</span>`)}
    </div>
  `;
}

function PanelPrincipalReal({ navegarA }) {
  const { datos, cargando, error, ultimaActualizacion, recargar } = useIndicadoresReales();
  const ind = datos ?? {};

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '20px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Panel principal</h1>
        <div class="flex items-center gap-8">
          ${ultimaActualizacion && html`
            <span class="texto-secundario">Actualizado ${ultimaActualizacion.toLocaleTimeString('es-PY')}</span>
          `}
          <button class="btn btn-secundario" onClick=${recargar} disabled=${cargando}>
            <i class="fa-solid fa-arrows-rotate ${cargando ? 'fa-spin' : ''}"></i>
          </button>
        </div>
      </div>

      ${error && html`<div class="login-error">${error}</div>`}

      <div class="grid-indicadores">
        <${TarjetaIndicador} valor=${ind.clientesTotal} etiqueta="Total de clientes" onClick=${() => navegarA('clientes')} />
        <${TarjetaIndicador} valor=${ind.clientesActivos} etiqueta="Clientes activos" onClick=${() => navegarA('clientes')} />
        <${TarjetaIndicador} valor=${ind.clientesSuspendidos} etiqueta="Clientes suspendidos" onClick=${() => navegarA('clientes')} />
        <${TarjetaIndicador} valor=${ind.pendientesInstalacion} etiqueta="Pendientes de instalación" onClick=${() => navegarA('clientes')} />
      </div>

      <div class="grid-indicadores">
        <${TarjetaIndicador} valor=${ind.cuentasVencidas} etiqueta="Cuentas vencidas" onClick=${() => navegarA('cuentas')} />
        <${TarjetaIndicador} valor=${valorMontoPendiente(ind.montoPendientePorMoneda)} etiqueta="Monto pendiente de cobro" />
        <${TarjetaIndicador} valor=${ind.routersOperativos} etiqueta="Routers operativos" onClick=${() => navegarA('routers')} />
        <${TarjetaIndicador} valor=${ind.routersSinRespuesta} etiqueta="Routers sin respuesta" onClick=${() => navegarA('routers')} />
      </div>

      <div class="card">
        <div class="card-titulo">Órdenes al agente MikroTik</div>
        ${ind.ordenesPendientes > 0
          ? html`
              <p>
                Hay <strong>${ind.ordenesPendientes}</strong> orden(es) esperando ser procesadas.
                ${ind.ordenesPendientes > 0 && html`<span class="texto-secundario"> — revisá que el proceso <code>agente-mikrotik</code> esté corriendo en el servidor interno.</span>`}
              </p>
            `
          : html`<p class="texto-secundario">No hay órdenes pendientes en este momento.</p>`}
      </div>
    </div>
  `;
}
