// modulo-planes.js — Planes comerciales + su mapeo técnico por router
// (planes/{id}/configuracionPorRouter/{routerId}, ver modelo de
// datos). Se carga después de modulo-routers.js.

function usePlanes() {
  const [planes, setPlanes] = useState([]);
  useEffect(() => {
    const unsub = db.collection('planes').orderBy('nombre').onSnapshot((snap) => {
      setPlanes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);
  return planes;
}

function FormularioAltaPlan({ usuarioId, onCompletado, onCancelar }) {
  const [form, setForm] = useState({
    codigo: '', nombre: '', precio: '', moneda: 'PYG', segmento: 'residencial',
    impuestos: '0', descuentosPermitidos: true,
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const confirmar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.precio) {
      setError('Nombre y precio son obligatorios.');
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await db.collection('planes').add({
        codigo: form.codigo.trim() || form.nombre.trim().toUpperCase().replace(/\s+/g, '-'),
        nombre: form.nombre.trim(),
        precio: Number(form.precio),
        moneda: form.moneda,
        segmento: form.segmento,
        estado: 'activo',
        vigenciaDesde: firebase.firestore.FieldValue.serverTimestamp(),
        impuestos: Number(form.impuestos) || 0,
        descuentosPermitidos: form.descuentosPermitidos,
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });
      onCompletado();
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para crear planes.' : 'No fue posible crear el plan.');
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '480px', marginBottom: '16px' }}>
      <div class="card-titulo">Nuevo plan</div>
      ${error && html`<div class="login-error">${error}</div>`}
      <form onSubmit=${confirmar}>
        <div class="campo">
          <label>Nombre</label>
          <input type="text" value=${form.nombre} onInput=${set('nombre')} placeholder="ej: Fibra 300" required />
        </div>
        <div class="flex gap-16">
          <div class="campo" style=${{ flex: 1 }}>
            <label>Precio</label>
            <input type="number" value=${form.precio} onInput=${set('precio')} required />
          </div>
          <div class="campo" style=${{ flex: 1 }}>
            <label>Moneda</label>
            <select value=${form.moneda} onChange=${set('moneda')}>
              <option value="PYG">PYG</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div class="campo">
          <label>Segmento</label>
          <select value=${form.segmento} onChange=${set('segmento')}>
            <option value="residencial">Residencial</option>
            <option value="corporativo">Corporativo</option>
          </select>
        </div>
        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando}>${enviando ? 'Creando…' : 'Crear plan'}</button>
        </div>
      </form>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Configuración técnica por router — esto es lo que agenteMikrotik.js
// lee para saber qué perfil PPP usar en cada router al dar de alta un
// servicio con este plan.
// ---------------------------------------------------------------------

function ConfiguracionPorRouter({ planId, usuarioId }) {
  const [routers, setRouters] = useState([]);
  const [configs, setConfigs] = useState({});
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ perfilPPP: '', velocidadBajada: '', velocidadSubida: '', pool: '' });
  const [guardando, setGuardando] = useState(false);
  const [avisoEnviado, setAvisoEnviado] = useState(null);

  useEffect(() => {
    const unsub = db.collection('routers').onSnapshot((snap) => setRouters(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = db.collection('planes').doc(planId).collection('configuracionPorRouter').onSnapshot((snap) => {
      const mapa = {};
      snap.docs.forEach((d) => { mapa[d.id] = d.data(); });
      setConfigs(mapa);
    });
    return unsub;
  }, [planId]);

  const abrirEdicion = (routerId) => {
    const actual = configs[routerId];
    setForm({
      perfilPPP: actual?.perfilPPP ?? '',
      velocidadBajada: actual?.velocidadBajada ?? '',
      velocidadSubida: actual?.velocidadSubida ?? '',
      pool: actual?.pool ?? '',
    });
    setEditando(routerId);
    setAvisoEnviado(null);
  };

  const guardar = async (routerId) => {
    setGuardando(true);
    try {
      await db.collection('planes').doc(planId).collection('configuracionPorRouter').doc(routerId).set({
        perfilPPP: form.perfilPPP.trim(),
        velocidadBajada: Number(form.velocidadBajada) || null,
        velocidadSubida: Number(form.velocidadSubida) || null,
        pool: form.pool.trim() || null,
        queueTipo: null,
        burst: null,
      });

      // Dispara la creación/actualización real del perfil PPP en el
      // router — no hace falta crearlo a mano en Winbox.
      await db.collection('ordenes_mikrotik').add({
        tipo: 'CREAR_PERFIL_PPP',
        servicioId: null,
        clienteId: null,
        routerId,
        parametros: {
          perfilPPP: form.perfilPPP.trim(),
          velocidadBajada: Number(form.velocidadBajada) || null,
          velocidadSubida: Number(form.velocidadSubida) || null,
        },
        estado: 'pendiente',
        pasosCompletados: [],
        usuarioSolicitante: usuarioId,
        fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
        fechaEjecucion: null,
        resultado: null,
        error: null,
      });

      setEditando(null);
      setAvisoEnviado(routerId);
    } catch (err) {
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  if (routers.length === 0) {
    return html`<p class="texto-secundario">Cargá al menos un router antes de configurar este plan.</p>`;
  }

  return html`
    <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style=${{ borderBottom: '1px solid var(--color-borde)', textAlign: 'left' }}>
          <th style=${{ padding: '8px' }}>Router</th>
          <th style=${{ padding: '8px' }}>Perfil PPP</th>
          <th style=${{ padding: '8px' }}>Bajada/Subida</th>
          <th style=${{ padding: '8px' }}></th>
        </tr>
      </thead>
      <tbody>
        ${routers.map((r) => {
          const cfg = configs[r.id];
          return html`
            <tr key=${r.id} style=${{ borderBottom: '1px solid var(--color-borde)' }}>
              <td style=${{ padding: '8px' }}>${r.nombre}</td>
              ${editando === r.id
                ? html`
                    <td style=${{ padding: '8px' }}><input type="text" value=${form.perfilPPP} onInput=${(e) => setForm((f) => ({ ...f, perfilPPP: e.target.value }))} placeholder="ej: perfil-300M" /></td>
                    <td style=${{ padding: '8px' }}>
                      <div class="flex gap-8">
                        <input type="number" value=${form.velocidadBajada} onInput=${(e) => setForm((f) => ({ ...f, velocidadBajada: e.target.value }))} placeholder="Mbps ↓" style=${{ width: '80px' }} />
                        <input type="number" value=${form.velocidadSubida} onInput=${(e) => setForm((f) => ({ ...f, velocidadSubida: e.target.value }))} placeholder="Mbps ↑" style=${{ width: '80px' }} />
                      </div>
                    </td>
                    <td style=${{ padding: '8px' }}>
                      <button class="btn btn-positivo" style=${{ padding: '4px 10px' }} onClick=${() => guardar(r.id)} disabled=${guardando}>Guardar</button>
                      <button class="btn btn-secundario" style=${{ padding: '4px 10px' }} onClick=${() => setEditando(null)}>Cancelar</button>
                    </td>
                  `
                : html`
                    <td style=${{ padding: '8px' }} class="mono">${cfg?.perfilPPP ?? '—'}</td>
                    <td style=${{ padding: '8px' }} class="texto-secundario">${cfg ? `${cfg.velocidadBajada ?? '—'}/${cfg.velocidadSubida ?? '—'} Mbps` : 'sin configurar'}</td>
                    <td style=${{ padding: '8px' }}>
                      <button class="btn btn-secundario" style=${{ padding: '4px 10px' }} onClick=${() => abrirEdicion(r.id)}>
                        ${cfg ? 'Editar' : 'Configurar'}
                      </button>
                      ${avisoEnviado === r.id && html`
                        <div class="texto-secundario" style=${{ color: 'var(--estado-activo)', marginTop: '4px' }}>
                          <i class="fa-solid fa-paper-plane"></i> Orden enviada al agente
                        </div>
                      `}
                    </td>
                  `}
            </tr>
          `;
        })}
      </tbody>
    </table>
  `;
}

function FormularioEdicionPlan({ plan, usuarioId, onCompletado, onCancelar }) {
  const [form, setForm] = useState({
    nombre: plan.nombre, precio: plan.precio, moneda: plan.moneda,
    segmento: plan.segmento, estado: plan.estado,
    impuestos: plan.impuestos ?? 0, descuentosPermitidos: plan.descuentosPermitidos ?? true,
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.precio) {
      setError('Nombre y precio son obligatorios.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await db.collection('planes').doc(plan.id).update({
        nombre: form.nombre.trim(),
        precio: Number(form.precio),
        moneda: form.moneda,
        segmento: form.segmento,
        estado: form.estado,
        impuestos: Number(form.impuestos) || 0,
        descuentosPermitidos: form.descuentosPermitidos,
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      });
      onCompletado();
    } catch (err) {
      setError(
        err.code === 'permission-denied'
          ? 'Tu rol no tiene permiso para editar este campo del plan (admin_red solo puede cambiar el estado).'
          : 'No fue posible guardar los cambios.'
      );
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div style=${{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-borde)' }}>
      ${error && html`<div class="login-error">${error}</div>`}
      <form onSubmit=${guardar}>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '2 1 200px' }}>
            <label>Nombre</label>
            <input type="text" value=${form.nombre} onInput=${set('nombre')} required />
          </div>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>Precio</label>
            <input type="number" value=${form.precio} onInput=${set('precio')} required />
          </div>
          <div class="campo" style=${{ flex: '1 1 100px' }}>
            <label>Moneda</label>
            <select value=${form.moneda} onChange=${set('moneda')}>
              <option value="PYG">PYG</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Segmento</label>
            <select value=${form.segmento} onChange=${set('segmento')}>
              <option value="residencial">Residencial</option>
              <option value="corporativo">Corporativo</option>
            </select>
          </div>
          <div class="campo" style=${{ flex: '1 1 160px' }}>
            <label>Estado</label>
            <select value=${form.estado} onChange=${set('estado')}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>Impuestos (%)</label>
            <input type="number" value=${form.impuestos} onInput=${set('impuestos')} />
          </div>
        </div>
        <div class="campo">
          <label class="flex items-center gap-8" style=${{ fontWeight: 400 }}>
            <input type="checkbox" checked=${form.descuentosPermitidos} onChange=${set('descuentosPermitidos')} style=${{ width: 'auto' }} />
            Permite descuentos manuales
          </label>
        </div>
        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando}>${enviando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  `;
}

function TarjetaPlan({ plan, usuarioId }) {
  const [expandido, setExpandido] = useState(false);
  const [editando, setEditando] = useState(false);

  return html`
    <div class="card">
      <div class="flex items-center justify-between">
        <div style=${{ cursor: 'pointer', flex: 1 }} onClick=${() => setExpandido(!expandido)}>
          <div class="flex items-center gap-8">
            <span style=${{ fontWeight: 600 }}>${plan.nombre}</span>
            ${plan.estado === 'inactivo' && html`<span class="etiqueta-estado etiqueta-inactivo">Inactivo</span>`}
          </div>
          <div class="texto-secundario">${plan.precio} ${plan.moneda} · ${plan.segmento}</div>
        </div>
        <div class="flex gap-8 items-center">
          <button class="btn btn-secundario" style=${{ padding: '6px 12px' }} onClick=${() => { setEditando(!editando); setExpandido(false); }}>
            ${editando ? 'Cerrar edición' : 'Editar'}
          </button>
          <i class="fa-solid ${expandido ? 'fa-chevron-up' : 'fa-chevron-down'} texto-secundario" style=${{ cursor: 'pointer' }} onClick=${() => setExpandido(!expandido)}></i>
        </div>
      </div>

      ${editando && html`
        <${FormularioEdicionPlan} plan=${plan} usuarioId=${usuarioId} onCancelar=${() => setEditando(false)} onCompletado=${() => setEditando(false)} />
      `}

      ${expandido && html`
        <div style=${{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-borde)' }}>
          <div class="texto-secundario" style=${{ marginBottom: '8px' }}>Configuración técnica por router</div>
          <${ConfiguracionPorRouter} planId=${plan.id} usuarioId=${usuarioId} />
        </div>
      `}
    </div>
  `;
}

function ModuloPlanes({ usuarioId }) {
  const planes = usePlanes();
  const [mostrarAlta, setMostrarAlta] = useState(false);

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Planes</h1>
        <button class="btn btn-principal" onClick=${() => setMostrarAlta(true)}>
          <i class="fa-solid fa-plus"></i> Nuevo plan
        </button>
      </div>

      ${mostrarAlta && html`<${FormularioAltaPlan} usuarioId=${usuarioId} onCancelar=${() => setMostrarAlta(false)} onCompletado=${() => setMostrarAlta(false)} />`}

      ${planes.length === 0
        ? html`<div class="card"><p class="texto-secundario">Todavía no hay planes cargados.</p></div>`
        : html`<div class="flex-col gap-16">${planes.map((p) => html`<${TarjetaPlan} key=${p.id} plan=${p} usuarioId=${usuarioId} />`)}</div>`}
    </div>
  `;
}
