// modulo-alta-servicio.js — Alta de servicio PPPoE (flujo 15.1 de la
// especificación funcional). Se carga después de modulo-ips.js.

function useListaSimple(coleccion, filtro) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let ref = db.collection(coleccion);
    if (filtro) ref = filtro(ref);
    const unsub = ref.onSnapshot((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [coleccion]);
  return items;
}

function AltaServicioPPPoE({ clienteId, clienteNombre, onCompletado, onCancelar, usuarioId }) {
  const [paso, setPaso] = useState(1); // 1: plan/router, 2: IP, 3: confirmación
  const [planId, setPlanId] = useState('');
  const [routerId, setRouterId] = useState('');
  const [ipSeleccionada, setIpSeleccionada] = useState('');
  const [usuarioPPPoE, setUsuarioPPPoE] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const planes = useListaSimple('planes', (ref) => ref.where('estado', '==', 'activo'));
  const routers = useListaSimple('routers');

  const planSeleccionado = planes.find((p) => p.id === planId);
  const routerSeleccionado = routers.find((r) => r.id === routerId);

  const avanzarAPaso2 = () => {
    if (!planId || !routerId || !usuarioPPPoE.trim()) {
      setError('Complete plan, router y usuario PPPoE antes de continuar.');
      return;
    }
    setError(null);
    setPaso(2);
  };

  const confirmar = async () => {
    setEnviando(true);
    setError(null);

    try {
      // 1. Reserva de IP — transaccional, puede fallar si alguien más
      //    la tomó justo antes (regla crítica de concurrencia)
      const servicioRef = db.collection('servicios').doc();

      await reservarIP(ipSeleccionada, {
        servicioId: servicioRef.id,
        clienteId,
        usuarioId,
      });

      // 2. Crea el servicio con estado técnico pendiente de configurar
      await servicioRef.set({
        clienteId,
        tipoConexion: 'pppoe',
        planId,
        routerId,
        nodoId: null,
        estadoTecnico: 'pendiente_config',
        estadoComercial: 'activo',
        usuarioPPPoE: usuarioPPPoE.trim(),
        passwordPPPoE_ref: null, // el agente genera y guarda la referencia real
        perfilPPP: null,
        callerIdMac: null,
        mac: null, vlan: null, interfaz: null, queue: null, addressList: null,
        ipAsignadaId: ipSeleccionada,
        fechaInstalacion: null,
        fechaAlta: firebase.firestore.FieldValue.serverTimestamp(),
        fechaBaja: null,
        ultimaActividad: null,
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });

      // 3. Crea la orden para que el agente interno configure el router
      await db.collection('ordenes_mikrotik').add({
        tipo: 'CREAR_CLIENTE_PPPOE',
        servicioId: servicioRef.id,
        clienteId,
        routerId,
        parametros: { usuarioPPPoE: usuarioPPPoE.trim(), planId, ip: ipSeleccionada },
        estado: 'pendiente',
        pasosCompletados: [],
        usuarioSolicitante: usuarioId,
        fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
        fechaEjecucion: null,
        resultado: null,
        error: null,
      });

      onCompletado(servicioRef.id);
    } catch (err) {
      if (err.message === 'IP_NO_DISPONIBLE') {
        setError('Esa IP fue tomada por otro operador justo ahora. Elija otra de la lista.');
        setIpSeleccionada('');
      } else {
        setError('No fue posible completar el alta. Intente nuevamente.');
        console.error(err);
      }
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '560px' }}>
      <div class="card-titulo">Alta de servicio PPPoE — ${clienteNombre}</div>

      <div class="flex gap-8" style=${{ marginBottom: '20px' }}>
        ${[1, 2, 3].map(
          (n) => html`
            <div key=${n} style=${{
              flex: 1, height: '4px', borderRadius: '2px',
              background: n <= paso ? 'var(--color-naranja)' : 'var(--color-borde)',
            }} />
          `
        )}
      </div>

      ${error && html`<div class="login-error">${error}</div>`}

      ${paso === 1 && html`
        <div>
          <div class="campo">
            <label>Plan</label>
            <select value=${planId} onChange=${(e) => setPlanId(e.target.value)}>
              <option value="">Seleccionar…</option>
              ${planes.map((p) => html`<option key=${p.id} value=${p.id}>${p.nombre} — ${p.precio} ${p.moneda}</option>`)}
            </select>
          </div>
          <div class="campo">
            <label>Router concentrador</label>
            <select value=${routerId} onChange=${(e) => { setRouterId(e.target.value); setIpSeleccionada(''); }}>
              <option value="">Seleccionar…</option>
              ${routers.map((r) => html`<option key=${r.id} value=${r.id}>${r.nombre}</option>`)}
            </select>
          </div>
          <div class="campo">
            <label>Usuario PPPoE</label>
            <input type="text" value=${usuarioPPPoE} onInput=${(e) => setUsuarioPPPoE(e.target.value)} placeholder="ej: jperez.fibra300" />
            <div class="ayuda">La contraseña se genera automáticamente y nunca queda visible en el navegador.</div>
          </div>

          <div class="flex justify-between">
            <button class="btn btn-secundario" onClick=${onCancelar}>Cancelar</button>
            <button class="btn btn-principal" onClick=${avanzarAPaso2}>Continuar</button>
          </div>
        </div>
      `}

      ${paso === 2 && html`
        <div>
          <p class="texto-secundario">Router: <strong>${routerSeleccionado?.nombre}</strong> · Plan: <strong>${planSeleccionado?.nombre}</strong></p>

          <${SelectorIP} routerId=${routerId} onSeleccionar=${setIpSeleccionada} />

          <div class="flex justify-between" style=${{ marginTop: '16px' }}>
            <button class="btn btn-secundario" onClick=${() => setPaso(1)}>Volver</button>
            <button class="btn btn-principal" disabled=${!ipSeleccionada} onClick=${() => setPaso(3)}>Continuar</button>
          </div>
        </div>
      `}

      ${paso === 3 && html`
        <div>
          <p>Está a punto de crear el siguiente servicio:</p>
          <ul style=${{ fontSize: 'var(--texto-normal)', lineHeight: 1.8 }}>
            <li>Cliente: <strong>${clienteNombre}</strong></li>
            <li>Plan: <strong>${planSeleccionado?.nombre}</strong></li>
            <li>Router: <strong>${routerSeleccionado?.nombre}</strong></li>
            <li>Usuario PPPoE: <span class="mono">${usuarioPPPoE}</span></li>
            <li>IP: <span class="mono">${ipSeleccionada}</span></li>
          </ul>
          <p class="texto-secundario">Se generará una orden para que el agente interno configure el router. El servicio quedará como "pendiente de configuración" hasta que se confirme el resultado.</p>

          <div class="flex justify-between">
            <button class="btn btn-secundario" onClick=${() => setPaso(2)} disabled=${enviando}>Volver</button>
            <button class="btn btn-principal" onClick=${confirmar} disabled=${enviando}>
              ${enviando ? 'Creando…' : 'Confirmar y crear'}
            </button>
          </div>
        </div>
      `}
    </div>
  `;
}
