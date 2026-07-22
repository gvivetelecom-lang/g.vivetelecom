// app.js — Shell de la aplicación. Sin proceso de build: usa React vía
// CDN + htm (sintaxis tipo JSX con template literals, sin compilador).

const html = htm.bind(React.createElement);
const { useState, useEffect, useMemo } = React;

// Estilos compartidos por las tablas de todos los módulos (Clientes,
// IPs, Pagos). Se declaran una sola vez acá porque app.js siempre
// carga primero — declararlos también en cada módulo rompe la carga,
// ya que los scripts clásicos comparten un mismo scope global y
// `const` no admite redeclaración.
const estiloTh = { padding: '10px 16px', fontSize: 'var(--texto-etiqueta)', color: 'var(--color-texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.03em' };
const estiloTd = { padding: '12px 16px', fontSize: 'var(--texto-normal)' };

// ---------------------------------------------------------------------
// Menú lateral — sección 6 de los lineamientos de interfaz
// ---------------------------------------------------------------------

const MENU = [
  { id: 'inicio', icono: 'fa-house', label: 'Inicio' },
  { id: 'clientes', icono: 'fa-users', label: 'Clientes' },
  { id: 'servicios', icono: 'fa-network-wired', label: 'Servicios' },
  { id: 'planes', icono: 'fa-signal', label: 'Planes' },
  { id: 'ips', icono: 'fa-hashtag', label: 'Direcciones IP' },
  { id: 'routers', icono: 'fa-server', label: 'Routers' },
  { id: 'cuentas', icono: 'fa-file-invoice', label: 'Cuentas' },
  { id: 'pagos', icono: 'fa-money-bill', label: 'Pagos' },
  { id: 'cortes', icono: 'fa-calendar-days', label: 'Vencimientos y cortes' },
  { id: 'lotes', icono: 'fa-layer-group', label: 'Operaciones por lote' },
  { id: 'alertas', icono: 'fa-triangle-exclamation', label: 'Alertas' },
  { id: 'auditoria', icono: 'fa-clock-rotate-left', label: 'Historial y auditoría' },
  { id: 'usuarios', icono: 'fa-user-shield', label: 'Usuarios y permisos', permiso: 'usuarios.ver' },
];

// ---------------------------------------------------------------------
// Utilidades de rol / permisos (el rol llega en el custom claim del
// token, sincronizado por roleSync.js en el servidor interno)
// ---------------------------------------------------------------------

function useSesion() {
  const [usuario, setUsuario] = useState(undefined); // undefined = cargando, null = sin sesión
  const [rol, setRol] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setUsuario(null);
        setRol(null);
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      setRol(tokenResult.claims.rol ?? null);
      setUsuario(user);
    });
    return unsub;
  }, []);

  return { usuario, rol };
}

function puedeVerModulo(item, rol) {
  // Placeholder simple: todos los roles ven todo salvo lo marcado con
  // permiso explícito. La validación real de escritura siempre vive
  // en Firestore Rules — esto solo evita mostrar botones que el
  // usuario no podría ejecutar (sección 28 de los lineamientos).
  if (item.permiso === 'usuarios.ver') {
    return rol === 'superadmin';
  }
  return true;
}

// ---------------------------------------------------------------------
// Pantalla de login
// ---------------------------------------------------------------------

function PantallaLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Usuario o contraseña incorrectos.'
          : 'No fue posible iniciar sesión. Intente nuevamente.'
      );
    } finally {
      setCargando(false);
    }
  };

  return html`
    <div class="login-pantalla">
      <div class="login-card">
        <div class="marca">VIVE TELECOM</div>
        <div class="subtitulo">Gestión de clientes, servicios y red</div>

        ${error && html`<div class="login-error">${error}</div>`}

        <form onSubmit=${enviar}>
          <div class="campo">
            <label>Correo electrónico</label>
            <input
              type="email"
              required
              value=${email}
              onInput=${(e) => setEmail(e.target.value)}
              placeholder="usuario@vivetelecom.com.py"
            />
          </div>
          <div class="campo">
            <label>Contraseña</label>
            <input
              type="password"
              required
              value=${password}
              onInput=${(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" class="btn btn-principal" style=${{ width: '100%', justifyContent: 'center' }} disabled=${cargando}>
            ${cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Indicadores del panel principal — el hook con datos reales vive en
// modulo-dashboard.js; acá queda solo la tarjeta, que se reutiliza ahí.
// ---------------------------------------------------------------------

function TarjetaIndicador({ valor, etiqueta, onClick }) {
  return html`
    <div class="indicador ${onClick ? 'clicable' : ''}" onClick=${onClick}>
      <div class="valor">${valor ?? '—'}</div>
      <div class="etiqueta">${etiqueta}</div>
    </div>
  `;
}

function PantallaEnConstruccion({ titulo }) {
  return html`
    <div class="card">
      <div class="card-titulo">${titulo}</div>
      <p class="texto-secundario">Este módulo se construye en el siguiente paso.</p>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Shell principal (topbar + sidebar + contenido)
// ---------------------------------------------------------------------

function AppShell({ usuario, rol }) {
  const [ruta, setRuta] = useState('inicio');
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  const itemActivo = useMemo(() => MENU.find((m) => m.id === ruta), [ruta]);

  const cerrarSesion = () => auth.signOut();

  return html`
    <div class="app-shell">
      <aside class="sidebar ${sidebarAbierto ? 'abierto' : ''}">
        <div class="sidebar-seccion">Vive Telecom</div>
        ${MENU.filter((item) => puedeVerModulo(item, rol)).map(
          (item) => html`
            <a
              key=${item.id}
              class="sidebar-item ${item.id === ruta ? 'activo' : ''}"
              onClick=${() => { setRuta(item.id); setSidebarAbierto(false); }}
            >
              <i class="icono fa-solid ${item.icono}"></i>
              <span>${item.label}</span>
            </a>
          `
        )}
      </aside>

      <header class="topbar">
        <span class="nombre-sistema">VIVE TELECOM</span>
        <span class="modulo-activo">/ ${itemActivo?.label ?? ''}</span>

        <div class="buscador">
          <input type="text" placeholder="Buscar cliente, IP, servicio, router…" />
        </div>

        <div class="topbar-derecha">
          <span class="topbar-indicador"><i class="fa-solid fa-server"></i> 24 operativos</span>
          <span class="topbar-indicador critico"><i class="fa-solid fa-triangle-exclamation"></i> 1 sin respuesta</span>
          <div class="usuario-conectado">
            <div>
              <div>${usuario.email}</div>
              <div class="rol">${rol ?? 'sin rol asignado'}</div>
            </div>
            <button class="btn btn-secundario" onClick=${cerrarSesion} title="Cerrar sesión">
              <i class="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      <main class="main-content">
        ${ruta === 'inicio'
          ? html`<${PanelPrincipalReal} navegarA=${setRuta} />`
          : ruta === 'clientes'
          ? html`<${ModuloClientes} usuarioId=${usuario.uid} />`
          : ruta === 'ips'
          ? html`<${ModuloIPs} />`
          : ruta === 'routers'
          ? html`<${ModuloRouters} />`
          : html`<${PantallaEnConstruccion} titulo=${itemActivo?.label ?? ruta} />`}
      </main>
    </div>
  `;
}

// ---------------------------------------------------------------------
// Raíz de la app
// ---------------------------------------------------------------------

function App() {
  const { usuario, rol } = useSesion();

  if (usuario === undefined) {
    return html`<div class="login-pantalla"><span style=${{ color: '#fff' }}>Cargando…</span></div>`;
  }

  if (usuario === null) {
    return html`<${PantallaLogin} />`;
  }

  return html`<${AppShell} usuario=${usuario} rol=${rol} />`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
