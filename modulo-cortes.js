// modulo-cortes.js — Gestión de grupos de vencimiento/corte
// (grupos_corte, ver modelo de datos sección 8). Se carga después de
// modulo-lotes.js.
//
// Un "grupo de corte" define el día del mes en que vence la cuenta,
// cuántos días de gracia tiene antes de suspenderse, y en qué día
// efectivamente se corta el servicio. Los servicios se asignan a un
// grupo desde Operaciones por lote (o al crear la cuenta).

function useGruposCorte() {
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const unsub = db.collection('grupos_corte').orderBy('diaVencimiento').onSnapshot(
      (snap) => { setGrupos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setCargando(false); },
      (err) => { console.error(err); setCargando(false); }
    );
    return unsub;
  }, []);
  return { grupos, cargando };
}

function useConteoServiciosPorGrupo(grupoId) {
  const [total, setTotal] = useState(null);
  useEffect(() => {
    contarDocumentos(db.collection('servicios').where('grupoCorteId', '==', grupoId))
      .then(setTotal)
      .catch((err) => console.error(err));
  }, [grupoId]);
  return total;
}

function FormularioGrupoCorte({ grupo, usuarioId, onCompletado, onCancelar }) {
  const esEdicion = !!grupo;
  const [nombre, setNombre] = useState(grupo?.nombre ?? '');
  const [diaVencimiento, setDiaVencimiento] = useState(grupo?.diaVencimiento ?? 10);
  const [diasGracia, setDiasGracia] = useState(grupo?.diasGracia ?? 5);
  const [diaCorte, setDiaCorte] = useState(grupo?.diaCorte ?? 15);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('Ponele un nombre al grupo.'); return; }

    setEnviando(true);
    setError(null);
    try {
      const datos = {
        nombre: nombre.trim(),
        diaVencimiento: Number(diaVencimiento),
        diasGracia: Number(diasGracia),
        diaCorte: Number(diaCorte),
        ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
      };

      if (esEdicion) {
        await db.collection('grupos_corte').doc(grupo.id).update(datos);
      } else {
        await db.collection('grupos_corte').add(datos);
      }
      onCompletado();
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para esta acción.' : 'No fue posible guardar el grupo.');
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '460px', marginBottom: '16px' }}>
      <div class="card-titulo">${esEdicion ? 'Editar grupo de corte' : 'Nuevo grupo de corte'}</div>

      ${error && html`<div class="login-error">${error}</div>`}

      <form onSubmit=${confirmar}>
        <div class="campo">
          <label>Nombre</label>
          <input type="text" value=${nombre} onInput=${(e) => setNombre(e.target.value)} placeholder="ej: Corte día 10" />
        </div>

        <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>Día de vencimiento</label>
            <input type="number" min="1" max="31" value=${diaVencimiento} onInput=${(e) => setDiaVencimiento(e.target.value)} />
          </div>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>Días de gracia</label>
            <input type="number" min="0" value=${diasGracia} onInput=${(e) => setDiasGracia(e.target.value)} />
          </div>
          <div class="campo" style=${{ flex: '1 1 120px' }}>
            <label>Día de corte</label>
            <input type="number" min="1" max="31" value=${diaCorte} onInput=${(e) => setDiaCorte(e.target.value)} />
          </div>
        </div>
        <p class="texto-secundario" style=${{ marginTop: '-8px' }}>
          Vence el día ${diaVencimiento} → ${diasGracia} día(s) de gracia → se corta el día ${diaCorte} si sigue sin pagar.
        </p>

        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando}>${enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear grupo'}</button>
        </div>
      </form>
    </div>
  `;
}

function TarjetaGrupoCorte({ grupo, usuarioId, onEditar }) {
  const totalServicios = useConteoServiciosPorGrupo(grupo.id);

  return html`
    <div class="card">
      <div class="flex items-center justify-between">
        <div>
          <div style=${{ fontWeight: 600 }}>${grupo.nombre}</div>
          <div class="texto-secundario">
            Vence día ${grupo.diaVencimiento} · ${grupo.diasGracia} día(s) de gracia · corte día ${grupo.diaCorte}
          </div>
        </div>
        <div class="flex items-center gap-16">
          <div style=${{ textAlign: 'right' }}>
            <div style=${{ fontWeight: 600 }}>${totalServicios ?? '—'}</div>
            <div class="texto-secundario">servicio(s)</div>
          </div>
          <button class="btn btn-secundario" onClick=${() => onEditar(grupo)}>Editar</button>
        </div>
      </div>
    </div>
  `;
}

function useConfigFacturacion() {
  const [config, setConfig] = useState(undefined);
  useEffect(() => {
    const unsub = db.collection('configuracion').doc('facturacion').onSnapshot(
      (doc) => setConfig(doc.exists ? doc.data() : null),
      (err) => console.error(err)
    );
    return unsub;
  }, []);
  return config;
}

function ConfiguracionFacturacion({ usuarioId }) {
  const config = useConfigFacturacion();
  const [diaGeneracion, setDiaGeneracion] = useState(1);
  const [horaGeneracion, setHoraGeneracion] = useState('03:00');
  const [diasHastaVencimiento, setDiasHastaVencimiento] = useState(10);
  const [diasHastaCorte, setDiasHastaCorte] = useState(15);
  const [guardando, setGuardando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!config) return;
    setDiaGeneracion(config.diaGeneracion ?? 1);
    setHoraGeneracion(config.horaGeneracion ?? '03:00');
    setDiasHastaVencimiento(config.diasHastaVencimiento ?? 10);
    setDiasHastaCorte(config.diasHastaCorte ?? 15);
  }, [config]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await db.collection('configuracion').doc('facturacion').set(
        {
          diaGeneracion: Number(diaGeneracion),
          horaGeneracion,
          diasHastaVencimiento: Number(diasHastaVencimiento),
          diasHastaCorte: Number(diasHastaCorte),
          ultimaModificacion: { usuarioId, fecha: firebase.firestore.FieldValue.serverTimestamp() },
        },
        { merge: true }
      );
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para cambiar esta configuración.' : 'No fue posible guardar.');
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  const generarAhora = async () => {
    setDisparando(true);
    setError(null);
    try {
      await db.collection('configuracion').doc('facturacion').set({ disparoManual: true }, { merge: true });
    } catch (err) {
      setError(err.code === 'permission-denied' ? 'Sin permiso para esta acción.' : 'No fue posible disparar la generación.');
      console.error(err);
    } finally {
      setDisparando(false);
    }
  };

  if (config === undefined) return null;

  return html`
    <div class="card" style=${{ marginBottom: '16px' }}>
      <div class="card-titulo">Generación mensual de cuentas</div>
      <p class="texto-secundario" style=${{ marginTop: '-8px' }}>
        Automática: el día y hora que configures acá, <code>generarCuentas.js</code> (servidor interno) genera una cuenta por cliente con todos sus servicios activos, siempre que ya no tenga una para ese período.
      </p>

      ${error && html`<div class="login-error">${error}</div>`}

      <div class="flex gap-16" style=${{ flexWrap: 'wrap' }}>
        <div class="campo" style=${{ flex: '1 1 140px' }}>
          <label>Día del mes</label>
          <input type="number" min="1" max="28" value=${diaGeneracion} onInput=${(e) => setDiaGeneracion(e.target.value)} />
          <div class="ayuda">1 a 28, para que exista en todos los meses.</div>
        </div>
        <div class="campo" style=${{ flex: '1 1 140px' }}>
          <label>Hora</label>
          <input type="time" value=${horaGeneracion} onInput=${(e) => setHoraGeneracion(e.target.value)} />
        </div>
        <div class="campo" style=${{ flex: '1 1 160px' }}>
          <label>Días hasta vencimiento</label>
          <input type="number" min="0" value=${diasHastaVencimiento} onInput=${(e) => setDiasHastaVencimiento(e.target.value)} />
        </div>
        <div class="campo" style=${{ flex: '1 1 160px' }}>
          <label>Días hasta corte</label>
          <input type="number" min="0" value=${diasHastaCorte} onInput=${(e) => setDiasHastaCorte(e.target.value)} />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <button class="btn btn-principal" onClick=${guardar} disabled=${guardando}>${guardando ? 'Guardando…' : 'Guardar configuración'}</button>
        <button class="btn btn-secundario" onClick=${generarAhora} disabled=${disparando}>
          ${disparando ? 'Disparando…' : 'Generar ahora (manual, para pruebas)'}
        </button>
      </div>

      ${config?.ultimaEjecucion && html`
        <p class="texto-secundario" style=${{ marginTop: '12px', marginBottom: 0 }}>
          Última corrida: período ${config.ultimaEjecucion.periodo} —
          ${config.ultimaEjecucion.cuentasCreadas} cuenta(s) creada(s),
          ${config.ultimaEjecucion.clientesOmitidos} cliente(s) ya tenían cuenta,
          ${config.ultimaEjecucion.serviciosSinPlan ?? 0} servicio(s) sin plan válido.
        </p>
      `}
    </div>
  `;
}

function ModuloCortes({ usuarioId, navegarA }) {
  const { grupos, cargando } = useGruposCorte();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [grupoEditando, setGrupoEditando] = useState(null);

  const abrirNuevo = () => { setGrupoEditando(null); setMostrarForm(true); };
  const abrirEdicion = (grupo) => { setGrupoEditando(grupo); setMostrarForm(true); };
  const cerrar = () => { setMostrarForm(false); setGrupoEditando(null); };

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Vencimientos y cortes</h1>
        <button class="btn btn-principal" onClick=${abrirNuevo}>
          <i class="fa-solid fa-plus"></i> Nuevo grupo
        </button>
      </div>

      <${ConfiguracionFacturacion} usuarioId=${usuarioId} />

      <div class="card" style=${{ marginBottom: '16px', background: 'rgba(37,99,235,0.05)', borderColor: 'rgba(37,99,235,0.2)' }}>
        <p style=${{ margin: 0 }} class="texto-secundario">
          Un servicio se asigna a un grupo de corte desde <a onClick=${() => navegarA('lotes')} style=${{ color: 'var(--estado-proceso)', cursor: 'pointer' }}>Operaciones por lote</a> (para asignar varios a la vez) o editando el servicio puntual en la ficha del cliente. Los grupos de corte hoy son informativos — la generación mensual usa el mismo día para todos los clientes (configuración de arriba).
        </p>
      </div>

      ${mostrarForm && html`
        <${FormularioGrupoCorte} grupo=${grupoEditando} usuarioId=${usuarioId} onCancelar=${cerrar} onCompletado=${cerrar} />
      `}

      ${cargando
        ? html`<p class="texto-secundario">Cargando grupos…</p>`
        : grupos.length === 0
        ? html`<div class="card"><p class="texto-secundario">Todavía no hay grupos de corte cargados.</p></div>`
        : html`<div class="flex-col gap-16">${grupos.map((g) => html`<${TarjetaGrupoCorte} key=${g.id} grupo=${g} usuarioId=${usuarioId} onEditar=${abrirEdicion} />`)}</div>`}
    </div>
  `;
}
