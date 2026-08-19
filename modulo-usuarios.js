// modulo-usuarios.js — Alta y administración de usuarios (solo
// visible para superadmin, ver puedeVerModulo en app.js). Se carga
// después de modulo-alertas.js.
//
// El rol que se guarda acá en usuarios/{uid}.rol se sincroniza al
// custom claim de Firebase Auth por roleSync.js, que corre en el
// servidor interno — hasta que ese proceso esté levantado, un usuario
// recién creado no va a poder entrar al sistema (Firestore Rules le
// va a negar todo). Es esperado, no un bug de esta pantalla.

function useUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  useEffect(() => {
    const unsub = db.collection('usuarios').orderBy('nombre').onSnapshot((snap) => {
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);
  return usuarios;
}

function useRoles() {
  const [roles, setRoles] = useState([]);
  useEffect(() => {
    const unsub = db.collection('roles').onSnapshot((snap) => {
      setRoles(snap.docs.map((d) => d.id));
    });
    return unsub;
  }, []);
  return roles;
}

// ---------------------------------------------------------------------
// Alta de usuario — usa una app secundaria de Firebase para no perder
// la sesión del administrador que está creando el usuario.
// ---------------------------------------------------------------------

async function crearUsuario({ nombre, email, password, rol }) {
  const nombreApp = `secundaria-${Date.now()}`;
  const appSecundaria = firebase.initializeApp(firebaseConfig, nombreApp);

  try {
    const credencial = await appSecundaria.auth().createUserWithEmailAndPassword(email, password);
    const uid = credencial.user.uid;

    await appSecundaria.auth().signOut();

    await db.collection('usuarios').doc(uid).set({
      nombre,
      email,
      rol,
      activo: true,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      ultimoAcceso: null,
    });

    return uid;
  } finally {
    await appSecundaria.delete();
  }
}

function FormularioAltaUsuario({ roles, onCompletado, onCancelar }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState(roles[0] ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const generarPassword = () => {
    const nueva = Math.random().toString(36).slice(-10) + 'A1!';
    setPassword(nueva);
  };

  const confirmar = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !password || !rol) {
      setError('Complete todos los campos.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña temporal debe tener al menos 8 caracteres.');
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await crearUsuario({ nombre: nombre.trim(), email: email.trim(), password, rol });
      onCompletado();
    } catch (err) {
      setError(
        err.code === 'auth/email-already-in-use'
          ? 'Ya existe un usuario con ese correo.'
          : 'No fue posible crear el usuario. Intente nuevamente.'
      );
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  return html`
    <div class="card" style=${{ maxWidth: '480px' }}>
      <div class="card-titulo">Nuevo usuario</div>

      ${error && html`<div class="login-error">${error}</div>`}

      <form onSubmit=${confirmar}>
        <div class="campo">
          <label>Nombre completo</label>
          <input type="text" value=${nombre} onInput=${(e) => setNombre(e.target.value)} />
        </div>
        <div class="campo">
          <label>Correo electrónico</label>
          <input type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} />
        </div>
        <div class="campo">
          <label>Contraseña temporal</label>
          <div class="flex gap-8">
            <input type="text" value=${password} onInput=${(e) => setPassword(e.target.value)} style=${{ flex: 1 }} class="mono" />
            <button type="button" class="btn btn-secundario" onClick=${generarPassword}>Generar</button>
          </div>
          <div class="ayuda">Comunicásela al usuario por un canal seguro. Se recomienda que la cambie en su primer ingreso.</div>
        </div>
        <div class="campo">
          <label>Rol</label>
          <select value=${rol} onChange=${(e) => setRol(e.target.value)}>
            ${roles.map((r) => html`<option key=${r} value=${r}>${r}</option>`)}
          </select>
        </div>

        <div class="flex justify-between">
          <button type="button" class="btn btn-secundario" onClick=${onCancelar} disabled=${enviando}>Cancelar</button>
          <button type="submit" class="btn btn-principal" disabled=${enviando}>
            ${enviando ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Edición de rol / activación
// ---------------------------------------------------------------------

function FilaUsuario({ usuario, roles, esUsuarioActual }) {
  const [editando, setEditando] = useState(false);
  const [rol, setRol] = useState(usuario.rol);
  const [guardando, setGuardando] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [resetEnviado, setResetEnviado] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await db.collection('usuarios').doc(usuario.id).update({ rol });
      setEditando(false);
    } catch (err) {
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async () => {
    if (esUsuarioActual) return; // no te podés desactivar a vos mismo por error
    await db.collection('usuarios').doc(usuario.id).update({ activo: !usuario.activo });
  };

  const enviarResetContrasena = async () => {
    setEnviandoReset(true);
    setResetEnviado(false);
    try {
      // No hace falta tocar el servidor interno ni saber la contraseña
      // actual — Firebase Auth le manda al usuario un link para que la
      // cambie él mismo. Es lo mismo aunque quien lo dispare sea otro
      // usuario logueado (el admin), no hace falta estar deslogueado.
      await auth.sendPasswordResetEmail(usuario.email);
      setResetEnviado(true);
    } catch (err) {
      console.error(err);
    } finally {
      setEnviandoReset(false);
    }
  };

  return html`
    <tr style=${{ borderBottom: '1px solid var(--color-borde)' }}>
      <td style=${estiloTd}>${usuario.nombre}</td>
      <td style=${estiloTd} class="texto-secundario">${usuario.email}</td>
      <td style=${estiloTd}>
        ${editando
          ? html`
              <select value=${rol} onChange=${(e) => setRol(e.target.value)} style=${{ padding: '4px 8px' }}>
                ${roles.map((r) => html`<option key=${r} value=${r}>${r}</option>`)}
              </select>
            `
          : html`<span class="mono">${usuario.rol}</span>`}
      </td>
      <td style=${estiloTd}>
        <span class="etiqueta-estado ${usuario.activo ? 'etiqueta-activo' : 'etiqueta-inactivo'}">
          ${usuario.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td style=${estiloTd}>
        <div class="flex gap-8" style=${{ flexWrap: 'wrap' }}>
          ${editando
            ? html`
                <button class="btn btn-positivo" style=${{ padding: '4px 10px' }} onClick=${guardar} disabled=${guardando}>Guardar</button>
                <button class="btn btn-secundario" style=${{ padding: '4px 10px' }} onClick=${() => setEditando(false)}>Cancelar</button>
              `
            : html`
                <button class="btn btn-secundario" style=${{ padding: '4px 10px' }} onClick=${() => setEditando(true)}>Cambiar rol</button>
                <button
                  class="btn ${usuario.activo ? 'btn-peligro' : 'btn-positivo'}"
                  style=${{ padding: '4px 10px' }}
                  onClick=${alternarActivo}
                  disabled=${esUsuarioActual}
                  title=${esUsuarioActual ? 'No podés desactivarte a vos mismo' : ''}
                >
                  ${usuario.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  class="btn btn-secundario"
                  style=${{ padding: '4px 10px' }}
                  onClick=${enviarResetContrasena}
                  disabled=${enviandoReset}
                >
                  ${enviandoReset ? 'Enviando…' : resetEnviado ? '✓ Enviado' : 'Restablecer contraseña'}
                </button>
              `}
        </div>
      </td>
    </tr>
  `;
}

// ---------------------------------------------------------------------
// Contenedor del módulo
// ---------------------------------------------------------------------

function ModuloUsuarios({ usuarioActualUid }) {
  const usuarios = useUsuarios();
  const roles = useRoles();
  const [mostrarAlta, setMostrarAlta] = useState(false);

  return html`
    <div>
      <div class="flex items-center justify-between" style=${{ marginBottom: '16px' }}>
        <h1 style=${{ fontSize: 'var(--texto-titulo-principal)', margin: 0 }}>Usuarios y permisos</h1>
        <button class="btn btn-principal" onClick=${() => setMostrarAlta(true)}>
          <i class="fa-solid fa-user-plus"></i> Nuevo usuario
        </button>
      </div>

      ${roles.length === 0 && html`
        <div class="login-error">
          No hay roles cargados en la colección <code>roles</code> todavía. Creá al menos uno (ej. "superadmin") desde Firestore Console antes de poder dar de alta usuarios.
        </div>
      `}

      ${mostrarAlta && html`
        <div style=${{ marginBottom: '16px' }}>
          <${FormularioAltaUsuario} roles=${roles} onCancelar=${() => setMostrarAlta(false)} onCompletado=${() => setMostrarAlta(false)} />
        </div>
      `}

      <div class="card" style=${{ padding: 0 }}>
        ${usuarios.length === 0
          ? html`<div style=${{ padding: '32px', textAlign: 'center' }} class="texto-secundario">Todavía no hay usuarios cargados.</div>`
          : html`
              <table style=${{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style=${{ borderBottom: '1px solid var(--color-borde)', textAlign: 'left' }}>
                    <th style=${estiloTh}>Nombre</th>
                    <th style=${estiloTh}>Correo</th>
                    <th style=${estiloTh}>Rol</th>
                    <th style=${estiloTh}>Estado</th>
                    <th style=${estiloTh}></th>
                  </tr>
                </thead>
                <tbody>
                  ${usuarios.map(
                    (u) => html`<${FilaUsuario} key=${u.id} usuario=${u} roles=${roles} esUsuarioActual=${u.id === usuarioActualUid} />`
                  )}
                </tbody>
              </table>
            `}
      </div>

      <p class="texto-secundario" style=${{ marginTop: '12px' }}>
        Los cambios de rol tardan unos segundos en tomar efecto (los sincroniza <code>roleSync.js</code> en el servidor interno), y el usuario afectado tiene que cerrar y volver a iniciar sesión para verlos reflejados.
      </p>
    </div>
  `;
}
