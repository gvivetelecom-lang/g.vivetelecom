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
        db.collection('clientes').count().get(),
        db.collection('clientes').where('estadoComercial', '==', 'activo').count().get(),
        db.collection('clientes').where('estadoComercial', '==', 'suspendido').count().get(),
        db.collection('clientes').where('estadoComercial', '==', 'pendiente').count().get(),
        db.collection('cuentas').where('estado', '==', 'vencida').count().get(),
        db.collection('routers').where('estado', '==', 'operativo').count().get(),
        db.collection('routers').where('estado', '==', 'sin_respuesta').count().get(),
        db.collection('ordenes_mikrotik').where('estado', '==', 'pendiente').count().get(),
        // El monto pendiente se suma del lado del cliente porque la
        // agregación sum() sobre un campo todavía no está disponible
        // en todas las versiones del SDK compat. Con un límite de 500
        // alcanza sobradamente para el volumen de un ISP regional; si
        // se supera, conviene mover este cálculo al servidor interno.
        db.collection('cuentas').where('estado', 'in', ['pendiente', 'parcial', 'vencida']).limit(500).get(),
      ]);

      const montoPendiente = cuentasConSaldo.docs.reduce((sum, d) => sum + (d.data().saldo || 0), 0);

      setDatos({
        clientesTotal: clientesTotal.data().count,
        clientesActivos: clientesActivos.data().count,
        clientesSuspendidos: clientesSuspendidos.data().count,
        pendientesInstalacion: pendientesInstalacion.data().count,
        cuentasVencidas: cuentasVencidas.data().count,
        montoPendiente,
        routersOperativos: routersOperativos.data().count,
        routersSinRespuesta: routersSinRespuesta.data().count,
        ordenesPendientes: ordenesPendientes.data().count,
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

function formatoMonedaPY(valor) {
  if (valor == null) return '—';
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(valor);
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
        <${TarjetaIndicador} valor=${ind.montoPendiente != null ? formatoMonedaPY(ind.montoPendiente) : null} etiqueta="Monto pendiente de cobro" />
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
