/* Agenda de Gira — versión 2
   Calendario + teatros + usuarios, y además: avisos de conflicto, mapa de la gira,
   logística, checklist técnico, entradas, historial por teatro, exportar a
   calendario, compartir por WhatsApp y documentos adjuntos.
   Sin herramientas de compilación: este archivo se sirve tal cual. */
(() => {
  'use strict';

  // ---------- Constantes ----------
  const ESTADOS = [
    { v: 'opcion', label: 'Opción' },
    { v: 'confirmada', label: 'Confirmada' },
    { v: 'cancelada', label: 'Cancelada' },
    { v: 'realizada', label: 'Realizada' },
  ];
  const PROVINCIAS = [
    'Ciudad de Buenos Aires', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
    'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza',
    'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
    'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
  ];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const CHECKLIST_BASE = [
    'Rider técnico enviado', 'Rider técnico confirmado por el teatro', 'Plano de luces enviado',
    'Sonido confirmado', 'Luces confirmadas', 'Pantalla / proyector', 'Camarín y catering',
    'Prueba de sonido realizada',
  ];
  const DISTANCIA_AVISO_KM = 600; // ciudades a más de esta distancia en días seguidos
  const DURACION_FUNCION_H = 2;
  const BUCKET = 'documentos';
  const CATERING = { teatro: '✅ Lo pone el teatro', llevar: '🧺 Hay que llevarlo' };

  const $app = document.getElementById('app');
  const $modal = document.getElementById('modal-root');
  const $toast = document.getElementById('toast');

  // ---------- Utilidades ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const isoDe = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m: 0-11
  const hoyISO = () => { const t = new Date(); return isoDe(t.getFullYear(), t.getMonth(), t.getDate()); };
  const aFecha = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const sumarDias = (iso, n) => { const d = aFecha(iso); d.setDate(d.getDate() + n); return isoDe(d.getFullYear(), d.getMonth(), d.getDate()); };
  const fechaLarga = (iso) => aFecha(iso).toLocaleDateString('es-AR',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fechaCorta = (iso) => aFecha(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  const horaCorta = (h) => (h ? h.slice(0, 5) : '');
  const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const estadoLabel = (v) => (ESTADOS.find((e) => e.v === v) || { label: v }).label;
  const numero = (n) => (n == null ? '' : Number(n).toLocaleString('es-AR'));
  const telLink = (t) => `tel:${String(t).replace(/[^\d+]/g, '')}`;
  const mapaLink = (t) => 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent([t.nombre, t.direccion, t.ciudad, t.provincia, 'Argentina'].filter(Boolean).join(', '));
  const ordenFunciones = (a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || ''));
  const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // Público de una función: asistentes reales si se cargaron, si no las entradas vendidas.
  const plata = (n) => (n == null ? '—' : Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }));
  const DIAS_RECORDATORIO = 7;
  const TIPOS_EVENTO = {
    empresa: 'Empresa / corporativo', privado: 'Fiesta privada', festival: 'Festival',
    municipio: 'Municipio / gobierno', otro: 'Otro',
  };
  const publico = (f) => (f.asistentes != null ? f.asistentes : f.entradas_vendidas);

  function distanciaKm([la1, lo1], [la2, lo2]) {
    const r = Math.PI / 180;
    const a = Math.sin((la2 - la1) * r / 2) ** 2 +
      Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
    return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)));
  }

  let toastTimer;
  function toast(msg, esError = false) {
    $toast.textContent = msg;
    $toast.className = 'toast' + (esError ? ' error-toast' : '');
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.hidden = true; }, esError ? 5000 : 2500);
  }

  function traducirError(err) {
    const m = (err && (err.message || err.error_description)) || String(err);
    if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
    if (/email not confirmed/i.test(m)) return 'El email todavía no fue confirmado.';
    if (/row-level security|permission denied|unauthorized/i.test(m)) return 'No tenés permiso para hacer este cambio.';
    if (/failed to fetch|network/i.test(m)) return 'Sin conexión. Revisá internet y probá de nuevo.';
    if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/same.*password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta de la anterior.';
    if (/bucket not found/i.test(m)) return 'Falta activar los documentos en Supabase (paso de actualización de la guía).';
    if (/column .* does not exist|could not find the .* column/i.test(m)) return 'Falta ejecutar la actualización de la base de datos (ver guía).';
    if (/exceeded the maximum allowed size|payload too large/i.test(m)) return 'El archivo es demasiado grande (máximo 50 MB).';
    return 'Ocurrió un error: ' + m;
  }

  function cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }
  function cargarCss(href) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }

  // ---------- Configuración ----------
  const cfg = window.APP_CONFIG || {};
  const configurado = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !/PEGAR_AQUI/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);

  if (!configurado) {
    $app.innerHTML = `<div class="login"><div class="login-card">
      <img class="logo" src="icon.svg" alt="">
      <h1>Agenda de Gira</h1>
      <p class="centro muted">Falta conectar la base de datos.<br>
      Completá <b>js/config.js</b> con los datos de Supabase (ver GUIA.md).</p>
    </div></div>`;
    return;
  }
  if (!window.supabase) {
    $app.innerHTML = '<div class="cargando">No se pudo cargar la aplicación. Revisá tu conexión y recargá la página.</div>';
    return;
  }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e)));
  }

  // ---------- Copia de los datos para usar sin internet ----------
  const CLAVE_COPIA = 'gira-copia-v1';
  const esErrorDeRed = (e) => !navigator.onLine ||
    /failed to fetch|load failed|network|fetch|timeout|offline/i.test((e && (e.message || e.name)) || String(e));

  function guardarCopia() {
    try {
      localStorage.setItem(CLAVE_COPIA, JSON.stringify({
        guardado: new Date().toISOString(), email: state.user?.email, isAdmin: state.isAdmin,
        teatros: state.teatros, funciones: state.funciones, finanzas: state.isAdmin ? state.finanzas : {},
      }));
    } catch (e) { /* almacenamiento lleno o bloqueado: se sigue sin copia */ }
  }
  function leerCopia() {
    try { return JSON.parse(localStorage.getItem(CLAVE_COPIA) || 'null'); } catch (e) { return null; }
  }
  function borrarCopia() {
    try { localStorage.removeItem(CLAVE_COPIA); } catch (e) { /* nada */ }
  }
  // Pasa la app a "modo sin conexión" con la última copia. Devuelve false si no hay copia.
  function usarCopia(emailEsperado) {
    const c = leerCopia();
    if (!c || (emailEsperado && c.email && c.email !== emailEsperado)) return false;
    state.teatros = c.teatros || []; state.funciones = c.funciones || []; state.finanzas = c.finanzas || {};
    state.isAdmin = !!c.isAdmin;
    if (!state.user) state.user = { email: c.email, deCopia: true };
    state.offline = true; state.copiaGuardada = c.guardado;
    calcularAvisos();
    return true;
  }
  function sinConexion() {
    if (navigator.onLine && !state.offline) return false;
    toast('📴 Sin conexión: los cambios se pueden hacer cuando vuelva la señal.', true);
    return true;
  }
  function barraOffline() {
    if (!state.offline) return '';
    const cuando = state.copiaGuardada ? new Date(state.copiaGuardada).toLocaleString('es-AR',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="offline-bar">📴 Sin conexión · solo lectura${cuando ? ` · datos del ${cuando}` : ''}</div>`;
  }
  function actualizarBarraOffline() {
    const $b = document.getElementById('offline');
    if ($b) $b.innerHTML = barraOffline();
  }

  window.addEventListener('offline', () => { if (state.user) { state.offline = true; actualizarBarraOffline(); } });
  window.addEventListener('online', () => {
    if (!state.user) return;
    if (state.user.deCopia) {
      sb.auth.getSession().then(({ data }) => {
        if (data.session) { sesionUid = data.session.user.id; manejarSesion(data.session); } else { state.user = null; renderLogin(); }
      });
    } else recargarPronto();
  });

  // ---------- Estado ----------
  const ahora = new Date();
  const state = {
    user: null,
    isAdmin: false,
    teatros: [],
    funciones: [],
    finanzas: {},
    avisos: [],
    avisosPorFuncion: {},
    offline: false,
    copiaGuardada: null,
    vista: 'calendario',
    calModo: 'mes',
    mes: { y: ahora.getFullYear(), m: ahora.getMonth() },
    diaSel: null,
    filtroEstado: 'todos',
    verPasadas: false,
    buscaTeatro: '',
    provTeatro: '',
    mapaRango: 'proximas',
    statsAnio: 'todos',
    modalFuncionId: null,
  };
  let canal = null;
  let mapa = null;

  const teatroDe = (id) => state.teatros.find((t) => t.id === id);
  const esPrivado = (f) => f.tipo === 'privado';
  // Lugar de una función con la misma forma que un teatro (nombre, dirección, ciudad, provincia).
  const lugarDe = (f) => (esPrivado(f)
    ? { nombre: f.lugar, direccion: f.direccion, ciudad: f.ciudad, provincia: f.provincia }
    : teatroDe(f.teatro_id));
  const nombreLugar = (f) => (esPrivado(f) ? (f.lugar || 'Lugar a definir') : (teatroDe(f.teatro_id)?.nombre || 'Teatro a definir'));
  const etiquetaPlata = (f) => (esPrivado(f) ? 'Cachet' : 'Recaudación');

  // Coordenadas de una función: las de su teatro o, si no tiene, las de otro teatro de la misma ciudad.
  function coordsDe(f) {
    if (f.latitud != null && f.longitud != null) return [f.latitud, f.longitud];
    const t = teatroDe(f.teatro_id);
    if (t && t.latitud != null && t.longitud != null) return [t.latitud, t.longitud];
    const c = normalizar(f.ciudad);
    const otro = state.teatros.find((x) => x.latitud != null && normalizar(x.ciudad) === c);
    return otro ? [otro.latitud, otro.longitud] : null;
  }

  // ---------- Avisos de conflicto ----------
  function calcularAvisos() {
    const activas = state.funciones.filter((f) => f.estado !== 'cancelada').sort(ordenFunciones);
    const porFecha = {};
    activas.forEach((f) => { (porFecha[f.fecha] = porFecha[f.fecha] || []).push(f); });
    const avisos = [];

    Object.keys(porFecha).sort().forEach((fecha) => {
      const fs = porFecha[fecha];
      if (fs.length > 1) {
        const ciudades = [...new Set(fs.map((f) => f.ciudad))];
        if (ciudades.length > 1) {
          avisos.push({ fecha, grave: true, ids: fs.map((f) => f.id),
            texto: `Funciones en ${ciudades.join(' y ')} el mismo día` });
        } else {
          avisos.push({ fecha, grave: false, ids: fs.map((f) => f.id),
            texto: `${fs.length} funciones el mismo día en ${ciudades[0]} (¿doble función?)` });
        }
      }
      const siguientes = porFecha[sumarDias(fecha, 1)];
      if (siguientes) {
        const a = fs[fs.length - 1];
        const b = siguientes[0];
        const ca = coordsDe(a); const cb = coordsDe(b);
        if (ca && cb) {
          const km = distanciaKm(ca, cb);
          if (km > DISTANCIA_AVISO_KM) {
            avisos.push({ fecha, grave: true, ids: [a.id, b.id],
              texto: `${a.ciudad} → ${b.ciudad}: unos ${numero(km)} km en días seguidos` });
          }
        }
      }
    });

    state.avisos = avisos;
    state.avisosPorFuncion = {};
    avisos.forEach((av) => av.ids.forEach((id) => {
      (state.avisosPorFuncion[id] = state.avisosPorFuncion[id] || []).push(av);
    }));
  }
  const avisosProximos = () => state.avisos.filter((a) => a.fecha >= hoyISO());

  // ---------- Datos ----------
  async function cargarDatos() {
    const [t, f] = await Promise.all([
      sb.from('teatros').select('*').order('provincia').order('ciudad').order('nombre'),
      sb.from('funciones').select('*').order('fecha').order('hora', { nullsFirst: true }),
    ]);
    if (t.error) throw t.error;
    if (f.error) throw f.error;
    state.teatros = t.data;
    state.funciones = f.data;
    state.finanzas = {};
    if (state.isAdmin) {
      const fin = await sb.from('finanzas').select('*');
      if (!fin.error) fin.data.forEach((r) => { state.finanzas[r.funcion_id] = r; });
    }
    calcularAvisos();
  }

  let recargaTimer;
  function recargarPronto() {
    clearTimeout(recargaTimer);
    recargaTimer = setTimeout(async () => {
      try {
        await cargarDatos(); guardarCopia();
        if (state.offline) { state.offline = false; actualizarBarraOffline(); }
        renderMain();
      } catch (e) {
        console.error(e);
        if (esErrorDeRed(e) && !state.offline) { state.offline = true; state.copiaGuardada = leerCopia()?.guardado; actualizarBarraOffline(); }
      }
    }, 300);
  }

  function suscribirTiempoReal() {
    if (canal) return;
    canal = sb.channel('cambios-gira')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'funciones' }, recargarPronto)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teatros' }, recargarPronto)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finanzas' }, recargarPronto)
      .subscribe();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.user) recargarPronto();
  });

  // ---------- Sesión ----------
  let sesionUid;
  let cerrandoSesion = false;
  sb.auth.onAuthStateChange((_evento, session) => {
    const uid = session?.user?.id ?? null;
    if (uid === sesionUid) return; // solo actuar cuando cambia el usuario
    sesionUid = uid;
    setTimeout(() => manejarSesion(session), 0);
  });

  async function manejarSesion(session) {
    if (!session) {
      if (!navigator.onLine && !cerrandoSesion && usarCopia()) { render(); return; }
      state.user = null; state.isAdmin = false; state.offline = false;
      if (canal) { sb.removeChannel(canal); canal = null; }
      renderLogin();
      return;
    }
    state.user = session.user;
    $app.innerHTML = '<div class="cargando">Cargando datos…</div>';
    try {
      const { data, error } = await sb.rpc('es_admin');
      if (error) throw error;
      state.isAdmin = !!data;
      await cargarDatos();
      state.offline = false;
      guardarCopia();
      suscribirTiempoReal();
      render();
    } catch (e) {
      console.error(e);
      if (esErrorDeRed(e) && usarCopia(session.user.email)) { render(); return; }
      $app.innerHTML = `<div class="login"><div class="login-card">
        <h1>No se pudieron cargar los datos</h1>
        <p class="centro muted">${esc(traducirError(e))}</p>
        <button class="btn primario bloque" data-action="reintentar">Reintentar</button>
        <p></p><button class="btn bloque" data-action="salir">Cerrar sesión</button>
      </div></div>`;
    }
  }

  // ---------- Pantalla de ingreso ----------
  function renderLogin(error = '') {
    cerrarModal();
    quitarMapa();
    $app.innerHTML = `<div class="login"><div class="login-card">
      <img class="logo" src="icon.svg" alt="">
      <h1>Agenda de Gira</h1>
      <p class="centro muted">Ingresá con tu email y contraseña</p>
      ${error ? `<p class="error">${esc(error)}</p>` : ''}
      <form data-form="login" novalidate>
        <label class="campo"><span>Email</span>
          <input type="email" name="email" autocomplete="email" inputmode="email" required></label>
        <label class="campo"><span>Contraseña</span>
          <input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn primario bloque" type="submit">Entrar</button>
      </form>
      <p class="small muted" style="text-align:center;margin:18px 0 0">
        ¿No tenés usuario o te olvidaste la contraseña?<br>Pedíselo al administrador de la gira.</p>
    </div></div>`;
  }

  // ---------- Estructura principal ----------
  function render() {
    if (!state.user) return renderLogin();
    if (!state.isAdmin && state.vista === 'teatros') state.vista = 'calendario';
    const tabs = [
      { id: 'calendario', label: 'Calendario', ico: '📅' },
      { id: 'mapa', label: 'Mapa', ico: '🗺️' },
      { id: 'estadisticas', label: 'Números', ico: '📊' },
    ];
    if (state.isAdmin) tabs.push({ id: 'teatros', label: 'Teatros', ico: '🎭' });
    tabs.push({ id: 'cuenta', label: 'Cuenta', ico: '👤' });

    $app.innerHTML = `
      <header class="topbar">
        <h1>Agenda de Gira</h1>
        <span class="rol">${state.isAdmin ? 'Administrador' : 'Equipo · solo lectura'}</span>
      </header>
      <div id="offline">${barraOffline()}</div>
      <main id="main"></main>
      <div id="fab"></div>
      <nav class="tabbar">
        ${tabs.map((t) => `<button data-action="tab" data-tab="${t.id}" class="${state.vista === t.id ? 'activo' : ''}">
          <span class="ico" aria-hidden="true">${t.ico}</span>${t.label}</button>`).join('')}
      </nav>`;
    renderMain();
  }

  function renderMain() {
    const $main = document.getElementById('main');
    if (!$main) return;
    quitarMapa();
    let html = '';
    let fab = '';
    if (state.vista === 'calendario') {
      html = vistaCalendario();
      if (state.isAdmin) fab = state.calModo === 'privados'
        ? '<button class="fab" data-action="nuevoPrivado">+ Privado</button>'
        : '<button class="fab" data-action="nuevaFuncion">+ Función</button>';
    } else if (state.vista === 'mapa') {
      html = vistaMapa();
    } else if (state.vista === 'estadisticas') {
      html = vistaEstadisticas();
    } else if (state.vista === 'teatros') {
      html = vistaTeatros();
      fab = '<button class="fab" data-action="nuevoTeatro">+ Teatro</button>';
    } else {
      html = vistaCuenta();
    }
    $main.innerHTML = html;
    document.getElementById('fab').innerHTML = fab;
    if (state.vista === 'mapa') dibujarMapa();
  }

  // ---------- Calendario ----------
  function bannerAvisos() {
    const av = avisosProximos();
    if (!av.length) return '';
    const graves = av.filter((a) => a.grave).length;
    return `<button class="aviso-banner ${graves ? 'grave' : ''}" data-action="verAvisos">
      ⚠️ ${av.length} aviso${av.length > 1 ? 's' : ''} en la gira <span>Ver ›</span></button>`;
  }

  // ---------- Recordatorios (solo administrador) ----------
  function recordatorios() {
    const hoy = hoyISO();
    const limite = sumarDias(hoy, DIAS_RECORDATORIO);
    const lista = [];
    state.funciones.filter((f) => f.fecha >= hoy && f.fecha <= limite && f.estado !== 'cancelada' && f.estado !== 'realizada')
      .sort(ordenFunciones).forEach((f) => {
        const faltan = [];
        if (f.estado === 'opcion') faltan.push('todavía es Opción: falta confirmar');
        if (esPrivado(f) ? !f.lugar : !f.teatro_id) faltan.push(esPrivado(f) ? 'falta el lugar del evento' : 'falta elegir el teatro');
        if (!f.hora) faltan.push('falta la hora');
        if (!f.prueba_sonido) faltan.push('falta la hora de prueba de sonido');
        const items = checklistDe(f);
        const pend = items.filter((i) => !i.hecho).length;
        if (pend) faltan.push(`checklist técnico: ${pend} de ${items.length} sin tildar`);
        if (faltan.length) lista.push({ f, faltan });
      });
    return lista;
  }

  function bannerRecordatorios() {
    if (!state.isAdmin) return '';
    const r = recordatorios();
    if (!r.length) return '';
    return `<button class="aviso-banner recordatorio" data-action="verRecordatorios">
      🔔 ${r.length === 1 ? '1 función' : `${r.length} funciones`} de esta semana con cosas pendientes <span>Ver ›</span></button>`;
  }

  function verRecordatorios() {
    const r = recordatorios();
    abrirModal(`
      <div class="modal-cab">
        <div><h2>🔔 Pendientes de la semana</h2><div class="sub">Funciones de los próximos ${DIAS_RECORDATORIO} días</div></div>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      ${r.length ? r.map(({ f, faltan }) => `<div class="aviso-box">
          ${tarjetaFuncion(f)}
          <ul class="faltan">${faltan.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>`).join('') : '<div class="vacio-msg">Nada pendiente. ¡Todo listo!</div>'}`);
  }

  // ---------- Cierre de funciones ----------
  const pendientesCierre = () => state.funciones
    .filter((f) => f.estado === 'confirmada' && f.fecha < hoyISO()).sort(ordenFunciones);

  function bannerCierre() {
    if (!state.isAdmin) return '';
    const p = pendientesCierre();
    if (!p.length) return '';
    return `<button class="aviso-banner cierre" data-action="verPendientes">
      🎬 ${p.length === 1 ? 'Tenés 1 función para cerrar' : `Tenés ${p.length} funciones para cerrar`} <span>Cargar público ›</span></button>`;
  }

  function verPendientes() {
    const p = pendientesCierre();
    abrirModal(`
      <div class="modal-cab">
        <div><h2>Funciones para cerrar</h2><div class="sub">Ya pasaron: cargá cuánta gente vino</div></div>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      ${p.length ? `<div class="lista">${p.map((f) => `
        <button class="card" data-action="cerrarFuncion" data-id="${f.id}">
          <div class="card-body"><div class="card-title">${esc(f.ciudad)}</div>
          <div class="card-sub">${esc(capitalizar(fechaLarga(f.fecha)))}</div></div>
          <span class="badge est-realizada">Cerrar ›</span></button>`).join('')}</div>`
        : '<div class="vacio-msg">No hay funciones pendientes de cierre.</div>'}`);
  }

  function formCierre(id) {
    const f = state.funciones.find((x) => x.id === id);
    if (!f) return;
    const t = teatroDe(f.teatro_id);
    abrirModal(`
      <div class="modal-cab">
        <div><h2>🎬 Cierre de función</h2><div class="sub">${esc(f.ciudad)} · ${esc(nombreLugar(f))} · ${esc(fechaCorta(f.fecha))}</div></div>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <form data-form="cierre" data-id="${f.id}" novalidate>
        <label class="campo"><span>Personas que vinieron${esPrivado(f) ? ' (aprox.)' : ' *'}</span><input type="number" name="asistentes" min="0" inputmode="numeric"
          value="${esc(f.asistentes ?? f.entradas_vendidas)}" placeholder="Ej: 950" ${esPrivado(f) ? '' : 'required'}></label>
        ${t && t.capacidad ? `<p class="small muted" style="margin-top:-8px">Capacidad de la sala: ${numero(t.capacidad)}</p>` : ''}
        ${esPrivado(f) ? '' : `<div class="fila-2">
          <label class="campo"><span>Entradas vendidas</span><input type="number" name="entradas_vendidas" min="0" inputmode="numeric" value="${esc(f.entradas_vendidas)}"></label>
          <label class="campo"><span>Invitaciones</span><input type="number" name="invitaciones" min="0" inputmode="numeric" value="${esc(f.invitaciones)}"></label>
        </div>`}
        <div class="panel privado">
          <h3>💰 ${etiquetaPlata(f)} <span class="solo-vos">🔒 solo vos</span></h3>
          <div class="fila-2">
            <label class="campo"><span>${etiquetaPlata(f)} ($)</span><input type="number" name="recaudacion" min="0" step="any" inputmode="decimal" value="${esc(state.finanzas[f.id]?.recaudacion)}"></label>
            <label class="campo"><span>Gastos ($)</span><input type="number" name="gastos" min="0" step="any" inputmode="decimal" value="${esc(state.finanzas[f.id]?.gastos)}"></label>
          </div>
        </div>
        <label class="campo"><span>¿Cómo fue?</span><textarea name="comentario_cierre"
          placeholder="Ej: sala muy cálida, buen sonido; el camarín era chico">${esc(f.comentario_cierre)}</textarea></label>
        <p class="small muted">Al guardar, la fecha queda como <b>Realizada</b>${esPrivado(f) ? '' : ' y suma al historial del teatro'}.</p>
        <p class="error" id="form-error" hidden></p>
        <button class="btn primario bloque" type="submit">Guardar cierre</button>
      </form>`);
  }

  async function guardarCierre(form) {
    if (sinConexion()) return;
    const fd = new FormData(form);
    const n = (k) => { const v = String(fd.get(k) || '').trim(); return v === '' ? null : parseInt(v, 10); };
    const f = state.funciones.find((x) => x.id === form.dataset.id) || {};
    const datos = {
      asistentes: n('asistentes'), comentario_cierre: String(fd.get('comentario_cierre') || '').trim() || null, estado: 'realizada',
    };
    if (!esPrivado(f)) { datos.entradas_vendidas = n('entradas_vendidas'); datos.invitaciones = n('invitaciones'); }
    if (datos.asistentes == null && !esPrivado(f)) return errorForm('Cargá cuántas personas vinieron.');
    if ([datos.asistentes, datos.entradas_vendidas, datos.invitaciones].some((v) => v != null && (isNaN(v) || v < 0))) {
      return errorForm('Los números no pueden ser negativos.');
    }
    const fin = { recaudacion: dinero(fd.get('recaudacion')), gastos: dinero(fd.get('gastos')) };
    if ([fin.recaudacion, fin.gastos].some((v) => v != null && (isNaN(v) || v < 0))) return errorForm('Revisá los montos.');
    const id = form.dataset.id;
    const tocaFinanzas = fin.recaudacion != null || fin.gastos != null || state.finanzas[id];
    if (tocaFinanzas) {
      const { error } = await sb.from('finanzas').upsert({ funcion_id: id, ...fin, notas: state.finanzas[id]?.notas ?? null });
      if (error) return errorForm(traducirError(error));
    }
    await guardar(form, sb.from('funciones').update(datos).eq('id', id));
  }

  const dinero = (v) => { const t = String(v ?? '').trim(); return t === '' ? null : Number(t); };

  // ---------- Recaudación (solo administrador) ----------
  function finanzasHtml(f) {
    const r = state.finanzas[f.id];
    const editar = `<button class="link-btn" data-action="editarFinanzas" data-id="${f.id}">✏️ ${r ? 'Editar' : `Cargar ${etiquetaPlata(f).toLowerCase()}`}</button>`;
    if (!r) return `<div class="vacio-msg chico">Sin datos. ${editar}</div>`;
    const neto = r.recaudacion != null ? Number(r.recaudacion) - Number(r.gastos || 0) : null;
    return `<div class="datos privado">
      <div class="dato"><div class="k">${etiquetaPlata(f)}</div><div class="v"><b>${plata(r.recaudacion)}</b></div></div>
      <div class="dato"><div class="k">Gastos</div><div class="v">${plata(r.gastos)}</div></div>
      <div class="dato"><div class="k">Neto</div><div class="v"><b>${plata(neto)}</b></div></div>
      ${r.notas ? `<div class="dato"><div class="k">Notas</div><div class="v multilinea">${esc(r.notas)}</div></div>` : ''}
      <div class="dato"><div class="v">${editar}</div></div>
    </div>`;
  }

  function formFinanzas(id) {
    const f = state.funciones.find((x) => x.id === id);
    if (!f) return;
    const r = state.finanzas[id] || {};
    abrirModal(`
      <div class="modal-cab">
        <div><h2>💰 ${etiquetaPlata(f)}</h2><div class="sub">${esc(f.ciudad)} · ${esc(fechaCorta(f.fecha))} · 🔒 solo vos</div></div>
        <button class="btn-icono" data-action="volverFuncion" data-id="${f.id}" aria-label="Volver">✕</button>
      </div>
      <form data-form="finanzas" data-id="${f.id}" novalidate>
        <div class="fila-2">
          <label class="campo"><span>${etiquetaPlata(f)} ($)</span><input type="number" name="recaudacion" min="0" step="any" inputmode="decimal" value="${esc(r.recaudacion)}"></label>
          <label class="campo"><span>Gastos ($)</span><input type="number" name="gastos" min="0" step="any" inputmode="decimal" value="${esc(r.gastos)}"></label>
        </div>
        <label class="campo"><span>Notas</span><textarea name="notas" placeholder="${esPrivado(f) ? 'Ej: 50% de adelanto, resto contra show' : 'Ej: 70/30 con el teatro, se cobra a 15 días'}">${esc(r.notas)}</textarea></label>
        <p class="small muted">Estos datos están protegidos en la base: tu equipo no puede verlos.</p>
        <p class="error" id="form-error" hidden></p>
        <button class="btn primario bloque" type="submit">Guardar</button>
      </form>`);
  }

  async function guardarFinanzas(form) {
    const fd = new FormData(form);
    const datos = { funcion_id: form.dataset.id, recaudacion: dinero(fd.get('recaudacion')), gastos: dinero(fd.get('gastos')),
      notas: String(fd.get('notas') || '').trim() || null };
    if ([datos.recaudacion, datos.gastos].some((v) => v != null && (isNaN(v) || v < 0))) return errorForm('Revisá los números.');
    await guardar(form, sb.from('finanzas').upsert(datos), async () => { await cargarDatos(); verFuncion(datos.funcion_id); });
  }

  function vistaCalendario() {
    const seg = `<div class="segmented" role="tablist">
      <button data-action="calModo" data-modo="mes" class="${state.calModo === 'mes' ? 'activo' : ''}">Mes</button>
      <button data-action="calModo" data-modo="lista" class="${state.calModo === 'lista' ? 'activo' : ''}">Lista</button>
      <button data-action="calModo" data-modo="privados" class="${state.calModo === 'privados' ? 'activo' : ''}">🎤 Privados</button>
    </div>`;
    const vista = state.calModo === 'mes' ? vistaMes() : state.calModo === 'lista' ? vistaLista() : vistaPrivados();
    return seg + bannerRecordatorios() + bannerCierre() + bannerAvisos() + vista;
  }

  function vistaPrivados() {
    const hoy = hoyISO();
    const ps = state.funciones.filter(esPrivado).sort(ordenFunciones);
    const prox = ps.filter((f) => f.fecha >= hoy);
    const pasados = ps.filter((f) => f.fecha < hoy).reverse();
    if (!ps.length) {
      return `<div class="vacio-msg">Todavía no hay eventos privados.${state.isAdmin
        ? '<br>Tocá “+ Privado” para cargar una contratación de empresa, fiesta, festival o municipio.' : ''}</div>`;
    }
    return `<p class="small muted">${prox.length} próximo(s) · ${pasados.length} realizado(s) o pasado(s)</p>
      <div class="seccion-titulo">Próximos</div>
      ${prox.length ? `<div class="lista">${prox.map((f) => tarjetaFuncion(f)).join('')}</div>` : '<div class="vacio-msg chico">No hay eventos privados próximos.</div>'}
      ${pasados.length ? `<div class="seccion-titulo">Anteriores</div><div class="lista">${pasados.map((f) => tarjetaFuncion(f, { conPublico: true })).join('')}</div>` : ''}`;
  }

  function leyenda() {
    return `<div class="leyenda">${ESTADOS.map((e) =>
      `<span class="badge est-${e.v}">${e.label}</span>`).join('')}</div>`;
  }

  function vistaMes() {
    const { y, m } = state.mes;
    const offset = (new Date(y, m, 1).getDay() + 6) % 7; // lunes primero
    const diasMes = new Date(y, m + 1, 0).getDate();
    const prefijo = `${y}-${pad(m + 1)}-`;
    const delMes = state.funciones.filter((f) => f.fecha.startsWith(prefijo));
    const porDia = {};
    delMes.forEach((f) => { (porDia[f.fecha] = porDia[f.fecha] || []).push(f); });
    const hoy = hoyISO();

    let celdas = DIAS.map((d) => `<div class="dsem">${d}</div>`).join('');
    for (let i = 0; i < offset; i++) celdas += '<div class="dia vacio"></div>';
    for (let d = 1; d <= diasMes; d++) {
      const iso = isoDe(y, m, d);
      const fs = porDia[iso] || [];
      const conAviso = fs.some((f) => state.avisosPorFuncion[f.id]);
      const clases = ['dia', iso === hoy ? 'hoy' : '', iso === state.diaSel ? 'sel' : '', conAviso ? 'con-aviso' : ''].join(' ');
      const chips = fs.slice(0, 2).map((f) =>
        `<span class="chip est-${f.estado}">${esPrivado(f) ? '🎤' : ''}${esc(f.ciudad)}</span>`).join('');
      const mas = fs.length > 2 ? `<span class="mas">+${fs.length - 2}</span>` : '';
      celdas += `<button class="${clases}" data-action="dia" data-dia="${iso}"
        aria-label="${esc(fechaLarga(iso))}${fs.length ? `, ${fs.length} función(es)` : ''}">
        <span class="num">${d}</span>${chips}${mas}</button>`;
    }

    const enEsteMes = state.diaSel && state.diaSel.startsWith(prefijo);
    const items = enEsteMes ? (porDia[state.diaSel] || []) : delMes;
    const titulo = enEsteMes ? fechaLarga(state.diaSel) : `Funciones de ${MESES[m]}`;
    const vacio = enEsteMes
      ? (state.isAdmin ? 'Sin funciones este día. Tocá “+ Función” para agregar una.' : 'Sin funciones este día.')
      : 'No hay funciones cargadas este mes.';

    return `
      <div class="mes-nav">
        <button class="btn-icono" data-action="mesAnt" aria-label="Mes anterior">‹</button>
        <h2>${MESES[m]} ${y}</h2>
        <button class="btn-icono" data-action="mesSig" aria-label="Mes siguiente">›</button>
      </div>
      <div class="grilla">${celdas}</div>
      <div class="fila-leyenda">
        ${leyenda()}
        <button class="btn-icono btn-hoy" data-action="irHoy">Hoy</button>
      </div>
      <div class="seccion-titulo">${esc(titulo)}</div>
      ${items.length ? `<div class="lista">${items.map((f) => tarjetaFuncion(f)).join('')}</div>`
        : `<div class="vacio-msg">${vacio}</div>`}`;
  }

  function vistaLista() {
    const hoy = hoyISO();
    let fs = state.funciones.filter((f) => state.verPasadas || f.fecha >= hoy);
    if (state.filtroEstado !== 'todos') fs = fs.filter((f) => f.estado === state.filtroEstado);

    const grupos = [];
    fs.forEach((f) => {
      const clave = f.fecha.slice(0, 7);
      let g = grupos[grupos.length - 1];
      if (!g || g.clave !== clave) { g = { clave, items: [] }; grupos.push(g); }
      g.items.push(f);
    });

    const filtros = `<div class="filtros">
      <select data-change="filtroEstado" aria-label="Filtrar por estado">
        <option value="todos">Todos los estados</option>
        ${ESTADOS.map((e) => `<option value="${e.v}" ${state.filtroEstado === e.v ? 'selected' : ''}>${e.label}</option>`).join('')}
      </select>
      <label class="check"><input type="checkbox" data-change="verPasadas" ${state.verPasadas ? 'checked' : ''}> Mostrar pasadas</label>
    </div>
    <button class="btn bloque" data-action="exportarTodo" style="margin-bottom:6px">📆 Exportar calendario (Google / iPhone)</button>`;

    if (!grupos.length) {
      return filtros + `<div class="vacio-msg">${state.funciones.length
        ? 'No hay funciones con estos filtros.'
        : (state.isAdmin ? 'Todavía no hay funciones. Tocá “+ Función” para cargar la primera.' : 'Todavía no hay funciones cargadas.')}</div>`;
    }
    return filtros + grupos.map((g) => {
      const [y, m] = g.clave.split('-').map(Number);
      return `<div class="seccion-titulo">${MESES[m - 1]} ${y} · ${g.items.length}</div>
        <div class="lista">${g.items.map((f) => tarjetaFuncion(f)).join('')}</div>`;
    }).join('');
  }

  function tarjetaFuncion(f, { conPublico = false } = {}) {
    const d = aFecha(f.fecha);
    const t = teatroDe(f.teatro_id);
    const partes = esPrivado(f)
      ? [f.cliente, f.lugar || 'Lugar a definir', horaCorta(f.hora) && `${horaCorta(f.hora)} h`]
      : [t ? t.nombre : 'Teatro a definir', horaCorta(f.hora) && `${horaCorta(f.hora)} h`];
    if (conPublico && publico(f) != null) partes.push(`${numero(publico(f))} personas`);
    const aviso = state.avisosPorFuncion[f.id] ? '<span class="marca-aviso" title="Tiene avisos">⚠️</span> ' : '';
    return `<button class="card funcion est-${f.estado}" data-action="verFuncion" data-id="${f.id}">
      <div class="fecha-box">
        <span class="ds">${d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}</span>
        <span class="dn">${d.getDate()}</span>
        <span class="ma">${MESES[d.getMonth()].slice(0, 3)}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${aviso}${esPrivado(f) ? '🎤 ' : ''}${esc(f.ciudad)}</div>
        <div class="card-sub">${esc(partes.filter(Boolean).join(' · '))}</div>
      </div>
      <span class="badge est-${f.estado}">${estadoLabel(f.estado)}</span>
    </button>`;
  }

  function verAvisos() {
    const av = avisosProximos();
    abrirModal(`
      <div class="modal-cab">
        <div><h2>Avisos de la gira</h2><div class="sub">Funciones canceladas no se tienen en cuenta</div></div>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      ${av.length ? av.map((a) => `
        <div class="aviso-box ${a.grave ? 'grave' : ''}">
          <b>${esc(capitalizar(fechaLarga(a.fecha)))}</b><br>${esc(a.texto)}
          <div class="lista" style="margin-top:8px">${a.ids.map((id) => state.funciones.find((f) => f.id === id))
            .filter(Boolean).map((f) => tarjetaFuncion(f)).join('')}</div>
        </div>`).join('') : '<div class="vacio-msg">No hay avisos. ¡Todo en orden!</div>'}`);
  }

  // ---------- Detalle de función ----------
  function verFuncion(id) {
    const f = state.funciones.find((x) => x.id === id);
    if (!f) return;
    state.modalFuncionId = id;
    const t = teatroDe(f.teatro_id);
    const avisos = state.avisosPorFuncion[f.id] || [];

    const teatroHtml = t ? `
      <div class="dato"><div class="k">Teatro</div><div class="v"><b>${esc(t.nombre)}</b>
        ${t.a_verificar ? ' <span class="badge verificar">a verificar</span>' : ''}
        ${state.isAdmin ? `<br><button class="link-btn" data-action="editarTeatro" data-id="${t.id}">✏️ Editar datos del teatro (contacto, catering…)</button>` : ''}</div></div>
      ${t.direccion ? `<div class="dato"><div class="k">Dirección</div><div class="v">
        <a href="${mapaLink(t)}" target="_blank" rel="noopener">${esc(t.direccion)}, ${esc(t.ciudad)} ↗</a></div></div>` : ''}
      ${contactoHtml(t)}
      ${cateringHtml(t)}` : '<div class="dato"><div class="k">Teatro</div><div class="v muted">A definir</div></div>';

    const privadoHtml = `
      <div class="dato"><div class="k">Tipo</div><div class="v"><b>🎤 Evento privado</b>${f.evento_tipo
        ? ` · ${esc(TIPOS_EVENTO[f.evento_tipo] || f.evento_tipo)}` : ''}</div></div>
      ${f.cliente ? `<div class="dato"><div class="k">Cliente</div><div class="v"><b>${esc(f.cliente)}</b></div></div>` : ''}
      <div class="dato"><div class="k">Lugar</div><div class="v">${f.lugar ? esc(f.lugar) : '<span class="muted">A definir</span>'}</div></div>
      ${f.direccion || f.lugar ? `<div class="dato"><div class="k">Dirección</div><div class="v">
        <a href="${mapaLink(lugarDe(f))}" target="_blank" rel="noopener">${esc(f.direccion || 'Ver en el mapa')}, ${esc(f.ciudad)} ↗</a></div></div>` : ''}
      ${contactoHtml(f).replace('>Contacto<', '>Organizador<')}`;

    const logistica = [
      f.prueba_sonido && `<div class="dato"><div class="k">Prueba de sonido</div><div class="v">${horaCorta(f.prueba_sonido)} h</div></div>`,
      f.traslado && `<div class="dato"><div class="k">Traslado</div><div class="v multilinea">${esc(f.traslado)}</div></div>`,
      f.hotel && `<div class="dato"><div class="k">Hotel</div><div class="v multilinea">${esc(f.hotel)}</div></div>`,
    ].filter(Boolean).join('');

    abrirModal(`
      <div class="modal-cab">
        <div><h2>${esc(f.ciudad)}</h2><div class="sub">${esc(capitalizar(fechaLarga(f.fecha)))}</div></div>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>

      ${avisos.map((a) => `<div class="aviso-box ${a.grave ? 'grave' : ''}">⚠️ ${esc(a.texto)}</div>`).join('')}

      <div class="acciones compartir">
        <a class="btn whatsapp" href="https://wa.me/?text=${encodeURIComponent(textoWhatsApp(f))}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <button class="btn" data-action="agendar" data-id="${f.id}">📆 Agendar</button>
      </div>

      <div class="datos">
        <div class="dato"><div class="k">Estado</div><div class="v"><span class="badge est-${f.estado}">${estadoLabel(f.estado)}</span></div></div>
        <div class="dato"><div class="k">Hora</div><div class="v">${f.hora ? horaCorta(f.hora) + ' h' : '<span class="muted">A definir</span>'}</div></div>
        ${esPrivado(f) ? privadoHtml : teatroHtml}
        ${f.notas ? `<div class="dato"><div class="k">Notas</div><div class="v multilinea">${esc(f.notas)}</div></div>` : ''}
      </div>

      ${state.isAdmin && f.estado === 'confirmada' && f.fecha < hoyISO()
        ? `<button class="btn primario bloque" data-action="cerrarFuncion" data-id="${f.id}" style="margin-bottom:14px">🎬 Cerrar función: cargar cuánta gente vino</button>` : ''}
      ${f.estado === 'realizada' ? `<h3 class="sub-titulo">🎬 Cómo fue</h3>${cierreHtml(f, t)}` : ''}

      ${esPrivado(f) ? '' : `<h3 class="sub-titulo">🎟️ Entradas</h3>${entradasHtml(f, t)}`}

      ${state.isAdmin ? `<h3 class="sub-titulo">💰 ${etiquetaPlata(f)} <span class="solo-vos">🔒 solo vos</span></h3>${finanzasHtml(f)}` : ''}

      <h3 class="sub-titulo">🚐 Logística</h3>
      ${logistica ? `<div class="datos">${logistica}</div>`
        : `<div class="vacio-msg chico">Sin datos de logística${state.isAdmin ? ' — cargalos con “Editar”' : ''}.</div>`}

      <h3 class="sub-titulo">✅ Checklist técnico</h3>
      <div id="checklist">${checklistHtml(f)}</div>

      <h3 class="sub-titulo">📎 Documentos</h3>
      <div id="docs"><div class="vacio-msg chico">Cargando documentos…</div></div>

      ${state.isAdmin ? `<div class="acciones" style="margin-top:18px">
        <button class="btn primario" data-action="editarFuncion" data-id="${f.id}">Editar</button>
        <button class="btn peligro" data-action="borrarFuncion" data-id="${f.id}">Borrar</button>
      </div>` : ''}`);
    cargarDocs(f.id);
  }

  function cierreHtml(f, t) {
    if (f.asistentes == null && !f.comentario_cierre) {
      return `<div class="vacio-msg chico">Sin datos de cierre.${state.isAdmin
        ? ` <button class="link-btn" data-action="cerrarFuncion" data-id="${f.id}">Cargarlos</button>` : ''}</div>`;
    }
    const cap = t && t.capacidad;
    return `<div class="datos">
      ${f.asistentes != null ? `<div class="dato"><div class="k">Vinieron</div><div class="v"><b>${numero(f.asistentes)}</b> personas${cap ? ` · ${Math.round(f.asistentes * 100 / cap)}% de la sala` : ''}</div></div>` : ''}
      ${f.invitaciones != null ? `<div class="dato"><div class="k">Invitaciones</div><div class="v">${numero(f.invitaciones)}</div></div>` : ''}
      ${f.comentario_cierre ? `<div class="dato"><div class="k">Comentario</div><div class="v multilinea">${esc(f.comentario_cierre)}</div></div>` : ''}
      ${state.isAdmin ? `<div class="dato"><div class="v"><button class="link-btn" data-action="cerrarFuncion" data-id="${f.id}">✏️ Editar cierre</button></div></div>` : ''}
    </div>`;
  }

  function entradasHtml(f, t) {
    const cap = t && t.capacidad;
    if (f.entradas_vendidas == null) {
      return `<div class="vacio-msg chico">Sin dato de entradas vendidas${cap ? ` · capacidad ${numero(cap)}` : ''}.</div>`;
    }
    if (!cap) return `<div class="datos"><div class="dato"><div class="k">Vendidas</div><div class="v"><b>${numero(f.entradas_vendidas)}</b> <span class="muted">(capacidad sin cargar)</span></div></div></div>`;
    const pct = Math.round(f.entradas_vendidas * 100 / cap);
    return `<div class="panel ocupacion">
      <div class="ocupacion-num"><b>${numero(f.entradas_vendidas)}</b> de ${numero(cap)} · <b>${pct}%</b></div>
      <div class="barra"><div style="width:${Math.min(pct, 100)}%"></div></div>
      <div class="small muted">${f.entradas_vendidas >= cap ? '¡Sala llena!' : `Quedan ${numero(cap - f.entradas_vendidas)} lugares`}</div>
    </div>`;
  }

  function contactoHtml(t) {
    if (!t.contacto_nombre && !t.contacto_telefono && !t.contacto_email) {
      return '<div class="dato"><div class="k">Contacto</div><div class="v muted">Sin cargar</div></div>';
    }
    return `<div class="dato"><div class="k">Contacto</div><div class="v">
      ${t.contacto_nombre ? `${esc(t.contacto_nombre)}<br>` : ''}
      ${t.contacto_telefono ? `<a href="${telLink(t.contacto_telefono)}">📞 ${esc(t.contacto_telefono)}</a><br>` : ''}
      ${t.contacto_email ? `<a href="mailto:${esc(t.contacto_email)}">✉️ ${esc(t.contacto_email)}</a>` : ''}
    </div></div>`;
  }

  function cateringHtml(t) {
    const txt = t.catering ? CATERING[t.catering] : '<span class="muted">Sin dato</span>';
    return `<div class="dato"><div class="k">Catering</div><div class="v"><b>${txt}</b>${t.catering_notas
      ? `<div class="multilinea small">${esc(t.catering_notas)}</div>` : ''}</div></div>`;
  }

  // ---------- Checklist técnico ----------
  const checklistDe = (f) => (Array.isArray(f.checklist) ? f.checklist
    : CHECKLIST_BASE.map((texto) => ({ texto, hecho: false })));

  function checklistHtml(f) {
    const items = checklistDe(f);
    const hechos = items.filter((i) => i.hecho).length;
    return `<div class="panel checklist">
      <div class="small muted" style="margin-bottom:8px">${hechos} de ${items.length} listos</div>
      ${items.map((it, i) => `<div class="check-item">
        <label class="check"><input type="checkbox" data-change="checkItem" data-i="${i}" ${it.hecho ? 'checked' : ''} ${state.isAdmin ? '' : 'disabled'}>
          <span class="${it.hecho ? 'tachado' : ''}">${esc(it.texto)}</span></label>
        ${state.isAdmin ? `<button class="x" data-action="quitarItem" data-i="${i}" aria-label="Quitar ítem">✕</button>` : ''}
      </div>`).join('')}
      ${state.isAdmin ? `<form data-form="checkNuevo" class="check-nuevo" novalidate>
        <input name="texto" placeholder="Agregar ítem…" aria-label="Nuevo ítem del checklist">
        <button class="btn" type="submit">Agregar</button>
      </form>` : ''}
    </div>`;
  }

  async function guardarChecklist(items) {
    const f = state.funciones.find((x) => x.id === state.modalFuncionId);
    if (!f) return;
    if (sinConexion()) { const $c = document.getElementById('checklist'); if ($c) $c.innerHTML = checklistHtml(f); return; }
    const anterior = f.checklist;
    f.checklist = items;
    const $c = document.getElementById('checklist');
    if ($c) $c.innerHTML = checklistHtml(f);
    const { error } = await sb.from('funciones').update({ checklist: items }).eq('id', f.id);
    if (error) {
      f.checklist = anterior;
      if ($c) $c.innerHTML = checklistHtml(f);
      toast(traducirError(error), true);
    }
  }

  // ---------- Documentos ----------
  const nombreSeguro = (n) => normalizar(n).replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'archivo';
  const nombreVisible = (n) => n.replace(/^\d+-/, '');

  async function cargarDocs(fid) {
    const $d = document.getElementById('docs');
    if (!$d) return;
    const subir = state.isAdmin ? `<label class="btn bloque subir">📤 Adjuntar contrato o documento
      <input type="file" data-change="subirDoc" multiple hidden></label>` : '';
    if (state.offline || !navigator.onLine) {
      $d.innerHTML = '<div class="vacio-msg chico">📴 Los documentos se pueden abrir cuando haya conexión.</div>';
      return;
    }
    const { data, error } = await sb.storage.from(BUCKET).list(fid, { sortBy: { column: 'created_at', order: 'desc' } });
    if (state.modalFuncionId !== fid || !document.getElementById('docs')) return;
    if (error) {
      $d.innerHTML = `<div class="vacio-msg chico">${esc(traducirError(error))}</div>`;
      return;
    }
    const archivos = (data || []).filter((a) => a.name && a.id);
    let lista = '<div class="vacio-msg chico">No hay documentos adjuntos.</div>';
    if (archivos.length) {
      const rutas = archivos.map((a) => `${fid}/${a.name}`);
      const { data: urls } = await sb.storage.from(BUCKET).createSignedUrls(rutas, 3600);
      lista = `<div class="datos">${archivos.map((a, i) => `
        <div class="dato doc">
          <a class="v" href="${esc(urls?.[i]?.signedUrl || '#')}" target="_blank" rel="noopener">📄 ${esc(nombreVisible(a.name))}</a>
          ${state.isAdmin ? `<button class="x" data-action="borrarDoc" data-ruta="${esc(rutas[i])}" aria-label="Borrar documento">✕</button>` : ''}
        </div>`).join('')}</div>`;
    }
    $d.innerHTML = lista + subir;
  }

  async function subirDocs(input) {
    if (sinConexion()) { input.value = ''; return; }
    const fid = state.modalFuncionId;
    const archivos = [...input.files];
    if (!fid || !archivos.length) return;
    const $d = document.getElementById('docs');
    if ($d) $d.insertAdjacentHTML('afterbegin', '<div class="vacio-msg chico">Subiendo…</div>');
    for (const a of archivos) {
      const ruta = `${fid}/${Date.now()}-${nombreSeguro(a.name)}`;
      const { error } = await sb.storage.from(BUCKET).upload(ruta, a, { contentType: a.type || undefined });
      if (error) { toast(traducirError(error), true); break; }
    }
    cargarDocs(fid);
    toast('Documento subido ✓');
  }

  async function borrarDoc(ruta) {
    if (sinConexion()) return;
    if (!confirm(`¿Borrar "${nombreVisible(ruta.split('/').pop())}"?`)) return;
    const { error } = await sb.storage.from(BUCKET).remove([ruta]);
    if (error) return toast(traducirError(error), true);
    cargarDocs(state.modalFuncionId);
    toast('Documento borrado');
  }

  // ---------- Compartir y exportar ----------
  function textoWhatsApp(f) {
    const t = lugarDe(f);
    const l = [`${esPrivado(f) ? '🎤' : '🎭'} *${f.ciudad}* — ${capitalizar(fechaLarga(f.fecha))}${f.hora ? `, ${horaCorta(f.hora)} h` : ''}`];
    if (esPrivado(f)) l.push(`Evento privado${f.evento_tipo ? ` (${TIPOS_EVENTO[f.evento_tipo] || f.evento_tipo})` : ''}${f.cliente ? ` — ${f.cliente}` : ''}`);
    if (t && (t.nombre || t.direccion)) l.push(`📍 ${[t.nombre, t.direccion].filter(Boolean).join(' — ')}`);
    l.push(`Estado: ${estadoLabel(f.estado)}`);
    if (f.prueba_sonido) l.push(`🎚️ Prueba de sonido: ${horaCorta(f.prueba_sonido)} h`);
    if (f.traslado) l.push(`🚐 Traslado: ${f.traslado}`);
    if (f.hotel) l.push(`🏨 Hotel: ${f.hotel}`);
    if (t && t.catering) l.push(`🍽️ Catering: ${CATERING[t.catering].replace(/^\S+ /, '')}${t.catering_notas ? ` — ${t.catering_notas}` : ''}`);
    if (f.notas) l.push(`📝 ${f.notas}`);
    if (t && (t.nombre || t.direccion)) l.push(`🗺️ ${mapaLink(t)}`);
    return l.join('\n');
  }

  const icsTexto = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fechaCompacta = (iso) => iso.replace(/-/g, '');

  // Argentina usa UTC-3 todo el año: se convierte la hora local a UTC sumando 3 h.
  function rangoFuncion(f) {
    if (!f.hora) return { todoElDia: true, ini: fechaCompacta(f.fecha), fin: fechaCompacta(sumarDias(f.fecha, 1)) };
    const [y, m, d] = f.fecha.split('-').map(Number);
    const [hh, mm] = f.hora.split(':').map(Number);
    const ini = new Date(Date.UTC(y, m - 1, d, hh + 3, mm));
    const fin = new Date(ini.getTime() + DURACION_FUNCION_H * 3600e3);
    return { todoElDia: false, ini: utc(ini), fin: utc(fin) };
  }

  function tituloEvento(f) {
    const nombre = esPrivado(f) ? (f.cliente || f.lugar) : teatroDe(f.teatro_id)?.nombre;
    return `${esPrivado(f) ? '🎤' : '🎭'} ${f.ciudad}${nombre ? ` – ${nombre}` : ''}${f.estado === 'opcion' ? ' (Opción)' : ''}${f.estado === 'cancelada' ? ' (CANCELADA)' : ''}`;
  }
  function lugarEvento(f) {
    const t = lugarDe(f);
    return t && (t.nombre || t.direccion) ? [t.nombre, t.direccion, t.ciudad, t.provincia].filter(Boolean).join(', ') : f.ciudad;
  }
  function detalleEvento(f) {
    const t = teatroDe(f.teatro_id);
    return [
      `Estado: ${estadoLabel(f.estado)}`,
      esPrivado(f) && `Evento privado${f.cliente ? `: ${f.cliente}` : ''}${f.contacto_nombre ? ` · Organizador: ${f.contacto_nombre}${f.contacto_telefono ? ` ${f.contacto_telefono}` : ''}` : ''}`,
      f.prueba_sonido && `Prueba de sonido: ${horaCorta(f.prueba_sonido)} h`,
      f.traslado && `Traslado: ${f.traslado}`,
      f.hotel && `Hotel: ${f.hotel}`,
      t && t.catering && `Catering: ${CATERING[t.catering].replace(/^\S+ /, '')}${t.catering_notas ? ` — ${t.catering_notas}` : ''}`,
      f.notas,
    ].filter(Boolean).join('\n');
  }

  function plegar(linea) {
    const partes = [];
    let resto = linea;
    while (resto.length > 70) { partes.push(resto.slice(0, 70)); resto = ' ' + resto.slice(70); }
    partes.push(resto);
    return partes.join('\r\n');
  }

  function generarIcs(funciones) {
    const ahoraUtc = utc(new Date());
    const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agenda de Gira//ES', 'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH', 'X-WR-CALNAME:Gira'];
    funciones.forEach((f) => {
      const r = rangoFuncion(f);
      lineas.push('BEGIN:VEVENT', `UID:${f.id}@agenda-gira`, `DTSTAMP:${ahoraUtc}`);
      if (r.todoElDia) lineas.push(`DTSTART;VALUE=DATE:${r.ini}`, `DTEND;VALUE=DATE:${r.fin}`);
      else lineas.push(`DTSTART:${r.ini}`, `DTEND:${r.fin}`);
      lineas.push(`SUMMARY:${icsTexto(tituloEvento(f))}`, `LOCATION:${icsTexto(lugarEvento(f))}`,
        `DESCRIPTION:${icsTexto(detalleEvento(f))}`,
        `STATUS:${{ confirmada: 'CONFIRMED', realizada: 'CONFIRMED', cancelada: 'CANCELLED' }[f.estado] || 'TENTATIVE'}`,
        'END:VEVENT');
    });
    lineas.push('END:VCALENDAR');
    return lineas.map(plegar).join('\r\n') + '\r\n';
  }

  function descargarIcs(funciones, nombre) {
    const blob = new Blob([generarIcs(funciones)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function linkGoogle(f) {
    const r = rangoFuncion(f);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(tituloEvento(f))}&dates=${r.ini}/${r.fin}` +
      `&details=${encodeURIComponent(detalleEvento(f))}&location=${encodeURIComponent(lugarEvento(f))}`;
  }

  function agendar(id) {
    const f = state.funciones.find((x) => x.id === id);
    if (!f) return;
    abrirModal(`
      <div class="modal-cab">
        <div><h2>Agendar función</h2><div class="sub">${esc(f.ciudad)} · ${esc(fechaCorta(f.fecha))}</div></div>
        <button class="btn-icono" data-action="volverFuncion" data-id="${f.id}" aria-label="Volver">✕</button>
      </div>
      <div class="lista">
        <a class="btn bloque" href="${linkGoogle(f)}" target="_blank" rel="noopener">Google Calendar</a>
        <button class="btn bloque" data-action="icsUna" data-id="${f.id}">iPhone / Outlook (archivo .ics)</button>
      </div>
      <p class="small muted">En iPhone: tocá el archivo descargado y después “Agregar al calendario”.</p>`);
  }

  function exportarTodo() {
    const hoy = hoyISO();
    const proximas = state.funciones.filter((f) => f.estado !== 'cancelada' && f.fecha >= hoy);
    const todas = state.funciones.filter((f) => f.estado !== 'cancelada');
    abrirModal(`
      <div class="modal-cab">
        <div><h2>Exportar calendario</h2><div class="sub">Funciones canceladas no se incluyen</div></div>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="lista">
        <button class="btn primario bloque" data-action="icsTodas" data-rango="proximas" ${proximas.length ? '' : 'disabled'}>
          Próximas funciones (${proximas.length})</button>
        <button class="btn bloque" data-action="icsTodas" data-rango="todas" ${todas.length ? '' : 'disabled'}>
          Todas, incluidas las pasadas (${todas.length})</button>
      </div>
      <div class="panel small" style="margin-top:14px">
        <b>iPhone:</b> abrí el archivo descargado y tocá “Agregar todo”.<br><br>
        <b>Google Calendar:</b> desde una computadora, entrá a calendar.google.com → ⚙️ Configuración →
        “Importar y exportar” → elegí el archivo <i>gira.ics</i> → Importar.<br><br>
        Si volvés a importar, las funciones que ya estaban se actualizan en lugar de duplicarse
        (en Google Calendar puede depender de la versión).
      </div>`);
  }

  // ---------- Formulario de función ----------
  function opcionesTeatros(seleccionado) {
    const porProv = {};
    state.teatros.forEach((t) => { (porProv[t.provincia] = porProv[t.provincia] || []).push(t); });
    return '<option value="">— A definir —</option>' + Object.keys(porProv).sort((a, b) => a.localeCompare(b, 'es'))
      .map((p) => `<optgroup label="${esc(p)}">${porProv[p].map((t) =>
        `<option value="${t.id}" ${t.id === seleccionado ? 'selected' : ''}>${esc(t.nombre)} (${esc(t.ciudad)})</option>`).join('')}</optgroup>`)
      .join('');
  }

  function formFuncion(id, tipoInicial = 'teatro') {
    const f = id ? state.funciones.find((x) => x.id === id)
      : { fecha: state.diaSel || hoyISO(), hora: '21:00', estado: 'opcion', ciudad: '', teatro_id: null, tipo: tipoInicial };
    if (!f) return;
    const priv = esPrivado(f);
    abrirModal(`
      <div class="modal-cab">
        <h2>${id ? 'Editar fecha' : 'Nueva fecha'}</h2>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <form data-form="funcion" data-id="${id || ''}" novalidate>
        <div class="segmented tipo-sel" role="radiogroup" aria-label="Tipo de fecha">
          <label><input type="radio" name="tipo" value="teatro" data-change="tipoFuncion" ${priv ? '' : 'checked'}>🎭 Teatro</label>
          <label><input type="radio" name="tipo" value="privado" data-change="tipoFuncion" ${priv ? 'checked' : ''}>🎤 Evento privado</label>
        </div>
        <div class="fila-2">
          <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(f.fecha)}" required></label>
          <label class="campo"><span>Hora</span><input type="time" name="hora" value="${esc(horaCorta(f.hora))}"></label>
        </div>
        <div class="bloque-teatro" ${priv ? 'hidden' : ''}>
          <label class="campo"><span>Teatro</span>
            <select name="teatro_id" data-change="teatroFuncion">${opcionesTeatros(f.teatro_id)}</select></label>
          <div id="info-teatro">${infoTeatroHtml(f.teatro_id, f.id)}</div>
        </div>
        <label class="campo"><span>Ciudad *</span><input name="ciudad" value="${esc(f.ciudad)}" required
          placeholder="Ej: Pilar (con teatro se completa sola)"></label>
        <div class="bloque-privado" ${priv ? '' : 'hidden'}>
          <label class="campo"><span>Tipo de evento</span><select name="evento_tipo">
            <option value="">Elegir…</option>
            ${Object.entries(TIPOS_EVENTO).map(([v, l]) => `<option value="${v}" ${f.evento_tipo === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
          <label class="campo"><span>Cliente / quien contrata</span><input name="cliente" value="${esc(f.cliente)}" placeholder="Ej: Banco Nación, Fiesta de la Vendimia"></label>
          <label class="campo"><span>Lugar</span><input name="lugar" value="${esc(f.lugar)}" placeholder="Ej: Salón Hotel Sheraton, Predio ferial"></label>
          <label class="campo"><span>Dirección</span><input name="direccion" value="${esc(f.direccion)}"></label>
          <label class="campo"><span>Provincia</span><select name="provincia">
            <option value="">Elegir…</option>
            ${PROVINCIAS.map((p) => `<option ${f.provincia === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select></label>
          <div class="panel">
            <h3>Organizador / contacto</h3>
            <label class="campo"><span>Nombre</span><input name="contacto_nombre" value="${esc(f.contacto_nombre)}"></label>
            <label class="campo"><span>Teléfono</span><input type="tel" name="contacto_telefono" value="${esc(f.contacto_telefono)}"></label>
            <label class="campo"><span>Email</span><input type="email" name="contacto_email" value="${esc(f.contacto_email)}"></label>
          </div>
        </div>
        <label class="campo"><span>Estado</span>
          <select name="estado">${ESTADOS.map((e) =>
            `<option value="${e.v}" ${f.estado === e.v ? 'selected' : ''}>${e.label}</option>`).join('')}</select></label>
        <label class="campo bloque-teatro" ${priv ? 'hidden' : ''}><span>Entradas vendidas</span><input type="number" name="entradas_vendidas" min="0"
          inputmode="numeric" value="${esc(f.entradas_vendidas)}" placeholder="Ej: 850"></label>
        <div class="panel">
          <h3>🚐 Logística</h3>
          <label class="campo"><span>Prueba de sonido</span><input type="time" name="prueba_sonido" value="${esc(horaCorta(f.prueba_sonido))}"></label>
          <label class="campo"><span>Traslado</span><textarea name="traslado" placeholder="Ej: Vuelo AR1234 sale 10:15 de Aeroparque. Remis al teatro.">${esc(f.traslado)}</textarea></label>
          <label class="campo"><span>Hotel</span><textarea name="hotel" placeholder="Ej: Hotel Costa Galana, 3 habitaciones, check-in 14 h">${esc(f.hotel)}</textarea></label>
        </div>
        <label class="campo"><span>Notas</span><textarea name="notas">${esc(f.notas)}</textarea></label>
        <p class="error" id="form-error" hidden></p>
        <button class="btn primario bloque" type="submit">Guardar</button>
      </form>`);
  }

  async function guardarFuncion(form) {
    const fd = new FormData(form);
    const txt = (k) => String(fd.get(k) || '').trim() || null;
    const ent = txt('entradas_vendidas');
    const priv = fd.get('tipo') === 'privado';
    const datos = {
      tipo: priv ? 'privado' : 'teatro',
      fecha: fd.get('fecha'),
      hora: fd.get('hora') || null,
      teatro_id: priv ? null : (fd.get('teatro_id') || null),
      ciudad: txt('ciudad'),
      estado: fd.get('estado'),
      entradas_vendidas: !priv && ent ? parseInt(ent, 10) : null,
      prueba_sonido: fd.get('prueba_sonido') || null,
      traslado: txt('traslado'),
      hotel: txt('hotel'),
      notas: txt('notas'),
    };
    const camposPrivado = ['evento_tipo', 'cliente', 'lugar', 'direccion', 'provincia', 'contacto_nombre', 'contacto_telefono', 'contacto_email'];
    camposPrivado.forEach((k) => { datos[k] = priv ? txt(k) : null; });
    if (!datos.fecha) return errorForm('Elegí una fecha.');
    if (!datos.ciudad) return errorForm(priv ? 'Escribí la ciudad del evento.' : 'Escribí la ciudad (o elegí un teatro).');
    const id0 = form.dataset.id;
    const previa = id0 ? state.funciones.find((x) => x.id === id0) : null;
    if (!priv) { datos.latitud = null; datos.longitud = null; }
    else if (previa && esPrivado(previa) && previa.latitud != null && previa.direccion === datos.direccion
      && previa.ciudad === datos.ciudad && previa.provincia === datos.provincia) {
      datos.latitud = previa.latitud; datos.longitud = previa.longitud;
    } else {
      datos.latitud = null; datos.longitud = null;
      try {
        const region = [datos.ciudad, datos.provincia].filter(Boolean).join(', ');
        const c = (datos.direccion && await buscarCoordenadas(`${datos.direccion}, ${region}`)) || await buscarCoordenadas(region);
        if (c) { datos.latitud = c.lat; datos.longitud = c.lng; }
      } catch (e) { /* sin conexión al buscador: se guarda sin ubicación */ }
    }
    if (datos.entradas_vendidas != null && (isNaN(datos.entradas_vendidas) || datos.entradas_vendidas < 0)) {
      return errorForm('Las entradas vendidas deben ser un número.');
    }
    const id = form.dataset.id;
    const q = id ? sb.from('funciones').update(datos).eq('id', id).select().single()
      : sb.from('funciones').insert(datos).select().single();
    await guardar(form, q, async (fila) => {
      const [y, m] = datos.fecha.split('-').map(Number);
      state.mes = { y, m: m - 1 };
      state.diaSel = datos.fecha;
      await cargarDatos();
      const nuevos = (state.avisosPorFuncion[fila?.id] || []).filter((a) => a.grave);
      if (nuevos.length) setTimeout(() => toast('⚠️ ' + nuevos.map((a) => a.texto).join(' · '), true), 2600);
    });
  }

  async function borrarFuncion(id) {
    if (sinConexion()) return;
    const f = state.funciones.find((x) => x.id === id);
    if (!f || !confirm(`¿Borrar ${esPrivado(f) ? 'el evento privado' : 'la función'} de ${f.ciudad} del ${fechaLarga(f.fecha)}?\nEsta acción no se puede deshacer.`)) return;
    const { error } = await sb.from('funciones').delete().eq('id', id);
    if (error) return toast(traducirError(error), true);
    // Borrar también sus documentos adjuntos (si los hay)
    const { data: docs } = await sb.storage.from(BUCKET).list(id);
    if (docs && docs.length) await sb.storage.from(BUCKET).remove(docs.map((d) => `${id}/${d.name}`));
    cerrarModal();
    await cargarDatos(); renderMain();
    toast('Función borrada');
  }

  // ---------- Mapa ----------
  function funcionesMapa() {
    const hoy = hoyISO();
    let fs = state.funciones.filter((f) => f.estado !== 'cancelada');
    if (state.mapaRango === 'proximas') fs = fs.filter((f) => f.fecha >= hoy);
    else if (state.mapaRango !== 'todas') fs = fs.filter((f) => f.fecha.startsWith(state.mapaRango));
    return fs.sort(ordenFunciones);
  }

  function vistaMapa() {
    const meses = [...new Set(state.funciones.map((f) => f.fecha.slice(0, 7)))].sort();
    const fs = funcionesMapa();
    const conCoords = fs.filter((f) => coordsDe(f));
    const sinCoords = fs.filter((f) => !coordsDe(f));
    let total = 0;
    const tramos = conCoords.map((f, i) => {
      if (i === 0) return '';
      const km = distanciaKm(coordsDe(conCoords[i - 1]), coordsDe(f));
      total += km;
      return km;
    });
    return `
      <div class="filtros">
        <select data-change="mapaRango" aria-label="Qué funciones mostrar">
          <option value="proximas" ${state.mapaRango === 'proximas' ? 'selected' : ''}>Próximas funciones</option>
          <option value="todas" ${state.mapaRango === 'todas' ? 'selected' : ''}>Todas (incluye pasadas)</option>
          ${meses.map((m) => { const [y, mm] = m.split('-').map(Number);
            return `<option value="${m}" ${state.mapaRango === m ? 'selected' : ''}>${capitalizar(MESES[mm - 1])} ${y}</option>`; }).join('')}
        </select>
      </div>
      <div id="mapa" class="mapa"><div class="cargando">Cargando mapa…</div></div>
      ${conCoords.length > 1 ? `<p class="small muted">Recorrido aproximado en línea recta: <b>${numero(total)} km</b></p>` : ''}
      ${conCoords.length ? `<div class="seccion-titulo">Recorrido</div>
        <ol class="recorrido">${conCoords.map((f, i) => `
          ${tramos[i] !== '' ? `<li class="tramo">↓ ${numero(tramos[i])} km</li>` : ''}
          <li><button class="parada" data-action="verFuncion" data-id="${f.id}">
            <span class="pin est-${f.estado}">${i + 1}</span>
            <span><b>${esc(f.ciudad)}</b> · ${esc(fechaCorta(f.fecha))}${f.hora ? ` · ${horaCorta(f.hora)} h` : ''}</span>
          </button></li>`).join('')}</ol>`
        : '<div class="vacio-msg">No hay funciones con ubicación para mostrar.</div>'}
      ${sinCoords.length ? `<div class="seccion-titulo">Sin ubicación en el mapa</div>
        <p class="small muted">Elegí un teatro con ubicación en estas funciones para que aparezcan.</p>
        <div class="lista">${sinCoords.map((f) => tarjetaFuncion(f)).join('')}</div>` : ''}`;
  }

  function quitarMapa() {
    if (mapa) { mapa.remove(); mapa = null; }
  }

  async function dibujarMapa() {
    try {
      if (!window.L) {
        cargarCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        await cargarScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
      }
    } catch (e) {
      const $m = document.getElementById('mapa');
      if ($m) $m.innerHTML = '<div class="cargando">No se pudo cargar el mapa. Revisá tu conexión.</div>';
      return;
    }
    const $m = document.getElementById('mapa');
    if (!$m || state.vista !== 'mapa') return;
    quitarMapa();
    $m.innerHTML = '';
    const L = window.L;
    mapa = L.map($m, { scrollWheelZoom: false }).setView([-38.4, -63.6], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    const fs = funcionesMapa().filter((f) => coordsDe(f));
    const puntos = fs.map(coordsDe);
    if (puntos.length > 1) {
      L.polyline(puntos, { color: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#7a1f2b',
        weight: 3, opacity: 0.8, dashArray: '6 6' }).addTo(mapa);
    }
    // Funciones en el mismo lugar comparten un solo marcador (ej.: "1,2")
    const grupos = new Map();
    fs.forEach((f, i) => {
      const clave = coordsDe(f).join(',');
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push({ f, n: i + 1 });
    });
    grupos.forEach((items) => {
      const { f } = items[0];
      const t = teatroDe(f.teatro_id);
      const nums = items.map((x) => x.n).join(',');
      const icono = L.divIcon({ className: '', html: `<span class="pin est-${f.estado}">${nums}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
      const lineas = items.map((x) => `${x.n}. ${esc(x.f.ciudad)} · ${esc(fechaCorta(x.f.fecha))}${x.f.hora ? ` ${horaCorta(x.f.hora)} h` : ''}`).join('<br>');
      L.marker(coordsDe(f), { icon: icono, title: `${nums}. ${f.ciudad}` }).addTo(mapa)
        .bindTooltip(lineas + (t ? `<br>${esc(t.nombre)}` : ''), { direction: 'top', offset: [0, -12] })
        .on('click', () => verFuncion(f.id));
    });
    if (puntos.length === 1) mapa.setView(puntos[0], 10);
    else if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [30, 30] });
  }

  // ---------- Estadísticas ----------
  function barras(filas, { pct = false, plata: esPlata = false } = {}) {
    const fmt = (v) => (pct ? v + '%' : esPlata ? plata(v) : numero(v));
    if (!filas.length) return '<div class="vacio-msg chico">Sin datos todavía.</div>';
    const max = Math.max(...filas.map((f) => f.valor), 1);
    return `<div class="barras">${filas.map((f) => `
      <div class="barra-fila" title="${esc(f.nombre)}: ${fmt(f.valor)}">
        <div class="barra-nombre">${esc(f.nombre)}${f.sub ? `<span>${esc(f.sub)}</span>` : ''}</div>
        <div class="barra-pista"><div class="barra-valor" style="width:${Math.max(2, f.valor * 100 / (pct ? Math.max(100, max) : max))}%"></div></div>
        <div class="barra-num">${fmt(f.valor)}</div>
      </div>`).join('')}</div>`;
  }

  function vistaEstadisticas() {
    const anios = [...new Set(state.funciones.filter((f) => f.estado === 'realizada').map((f) => f.fecha.slice(0, 4)))].sort().reverse();
    if (state.statsAnio !== 'todos' && !anios.includes(state.statsAnio)) state.statsAnio = 'todos';
    const enRango = (f) => state.statsAnio === 'todos' || f.fecha.startsWith(state.statsAnio);
    const hechas = state.funciones.filter((f) => f.estado === 'realizada' && enRango(f));
    const conPub = hechas.filter((f) => publico(f) != null);
    const total = conPub.reduce((a, f) => a + publico(f), 0);
    const ocup = conPub.map((f) => { const t = teatroDe(f.teatro_id); return t && t.capacidad ? publico(f) / t.capacidad : null; })
      .filter((x) => x != null);
    const ocupProm = ocup.length ? Math.round(ocup.reduce((a, b) => a + b, 0) * 100 / ocup.length) : null;
    const proximas = state.funciones.filter((f) => f.estado === 'confirmada' && f.fecha >= hoyISO()).length;
    const opciones = state.funciones.filter((f) => f.estado === 'opcion' && f.fecha >= hoyISO()).length;

    // Por provincia
    const porProv = {};
    conPub.forEach((f) => {
      const prov = teatroDe(f.teatro_id)?.provincia || f.provincia || 'Sin provincia';
      porProv[prov] = porProv[prov] || { valor: 0, n: 0 };
      porProv[prov].valor += publico(f); porProv[prov].n += 1;
    });
    const filasProv = Object.entries(porProv).sort((a, b) => b[1].valor - a[1].valor)
      .map(([nombre, d]) => ({ nombre, valor: d.valor, sub: `${d.n} función(es)` }));

    // Teatros por ocupación
    const porTeatro = {};
    conPub.forEach((f) => {
      const t = teatroDe(f.teatro_id);
      if (!t || !t.capacidad) return;
      porTeatro[t.id] = porTeatro[t.id] || { t, suma: 0, n: 0 };
      porTeatro[t.id].suma += publico(f) / t.capacidad; porTeatro[t.id].n += 1;
    });
    const filasTeatro = Object.values(porTeatro)
      .map((d) => ({ nombre: d.t.nombre, sub: `${d.t.ciudad} · ${d.n} función(es)`, valor: Math.round(d.suma * 100 / d.n) }))
      .sort((a, b) => b.valor - a.valor).slice(0, 8);

    // Por mes
    const porMes = {};
    conPub.forEach((f) => { const k = f.fecha.slice(0, 7); porMes[k] = (porMes[k] || 0) + publico(f); });
    const filasMes = Object.keys(porMes).sort().map((k) => {
      const [y, m] = k.split('-').map(Number);
      return { nombre: `${capitalizar(MESES[m - 1].slice(0, 3))} ${y}`, valor: porMes[k] };
    });

    return `
      <div class="filtros">
        <select data-change="statsAnio" aria-label="Año">
          <option value="todos">Todos los años</option>
          ${anios.map((a) => `<option ${state.statsAnio === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="tiles">
        <div class="tile"><b>${numero(hechas.length)}</b><span>funciones realizadas</span></div>
        <div class="tile"><b>${numero(total)}</b><span>personas en total</span></div>
        <div class="tile"><b>${conPub.length ? numero(Math.round(total / conPub.length)) : '—'}</b><span>promedio por función</span></div>
        <div class="tile"><b>${ocupProm != null ? ocupProm + '%' : '—'}</b><span>ocupación promedio</span></div>
      </div>
      <p class="small muted">${hechas.some(esPrivado) ? `Incluye ${hechas.filter(esPrivado).length} evento(s) privado(s). ` : ''}Próximamente: ${proximas} confirmada(s) y ${opciones} opción(es).
        ${hechas.length > conPub.length ? ` · ${hechas.length - conPub.length} función(es) realizada(s) sin público cargado.` : ''}</p>
      ${state.isAdmin ? statsPlata(enRango) : ''}
      <div class="seccion-titulo">Público por provincia</div>
      ${barras(filasProv)}
      <div class="seccion-titulo">Teatros con mejor ocupación</div>
      ${barras(filasTeatro, { pct: true })}
      <div class="seccion-titulo">Público por mes</div>
      ${barras(filasMes)}
      ${!hechas.length ? `<div class="vacio-msg" style="margin-top:14px">Las estadísticas se arman con las funciones <b>Realizadas</b>.
        Después de cada show usá “🎬 Cerrar función” para cargar cuánta gente vino.</div>` : ''}`;
  }

  function statsPlata(enRango) {
    const filas = state.funciones.filter((f) => enRango(f) && f.estado !== 'cancelada' && state.finanzas[f.id]?.recaudacion != null);
    if (!filas.length) {
      return `<div class="seccion-titulo">💰 Recaudación y cachets <span class="solo-vos">🔒 solo vos</span></div>
        <div class="vacio-msg chico">Todavía no cargaste recaudación. Se carga al cerrar cada función.</div>`;
    }
    const rec = filas.reduce((a, f) => a + Number(state.finanzas[f.id].recaudacion), 0);
    const gas = filas.reduce((a, f) => a + Number(state.finanzas[f.id].gastos || 0), 0);
    const porMes = {};
    filas.forEach((f) => { const k = f.fecha.slice(0, 7); porMes[k] = (porMes[k] || 0) + Number(state.finanzas[f.id].recaudacion); });
    const filasMes = Object.keys(porMes).sort().map((k) => {
      const [y, m] = k.split('-').map(Number);
      return { nombre: `${capitalizar(MESES[m - 1].slice(0, 3))} ${y}`, valor: Math.round(porMes[k]) };
    });
    return `<div class="seccion-titulo">💰 Recaudación y cachets <span class="solo-vos">🔒 solo vos</span></div>
      <div class="tiles privado">
        <div class="tile"><b>${plata(rec)}</b><span>total cobrado</span></div>
        <div class="tile"><b>${plata(rec - gas)}</b><span>neto (menos gastos)</span></div>
        <div class="tile"><b>${plata(rec / filas.length)}</b><span>promedio por función</span></div>
        <div class="tile"><b>${numero(filas.length)}</b><span>funciones con datos</span></div>
      </div>
      ${barras(filasMes, { plata: true })}`;
  }

  // ---------- Teatros ----------
  function teatrosFiltrados() {
    const q = normalizar(state.buscaTeatro);
    return state.teatros.filter((t) =>
      (!state.provTeatro || t.provincia === state.provTeatro) &&
      (!q || normalizar(`${t.nombre} ${t.ciudad} ${t.provincia}`).includes(q)));
  }

  function vistaTeatros() {
    const provs = [...new Set(state.teatros.map((t) => t.provincia))].sort((a, b) => a.localeCompare(b, 'es'));
    return `<div class="filtros">
        <input type="search" data-input="buscaTeatro" placeholder="Buscar por nombre o ciudad" value="${esc(state.buscaTeatro)}" aria-label="Buscar teatro">
        <select data-change="provTeatro" aria-label="Filtrar por provincia">
          <option value="">Todas las provincias</option>
          ${provs.map((p) => `<option ${state.provTeatro === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
        </select>
      </div>
      <div id="lista-teatros">${listaTeatros()}</div>`;
  }

  function listaTeatros() {
    const ts = teatrosFiltrados();
    const pendientes = ts.filter((t) => t.a_verificar).length;
    if (!ts.length) return '<div class="vacio-msg">No se encontraron teatros.</div>';
    return `<p class="small muted">${ts.length} teatro(s)${pendientes ? ` · ${pendientes} a verificar` : ''}</p>
      <div class="lista">${ts.map((t) => {
        const veces = state.funciones.filter((f) => f.teatro_id === t.id && f.estado !== 'cancelada').length;
        return `<button class="card" data-action="verTeatro" data-id="${t.id}">
          <div class="card-body">
            <div class="card-title">${esc(t.nombre)}</div>
            <div class="card-sub">${esc(t.ciudad)}, ${esc(t.provincia)}${t.capacidad ? ` · ${numero(t.capacidad)} lugares` : ''}${veces ? ` · ${veces} función(es)` : ''}</div>
          </div>
          ${t.a_verificar ? '<span class="badge verificar">a verificar</span>' : ''}
        </button>`;
      }).join('')}</div>`;
  }

  function resumenTeatro(t, fs) {
    const hechas = fs.filter((f) => f.estado === 'realizada').sort(ordenFunciones);
    const conPublico = hechas.filter((f) => publico(f) != null);
    const total = conPublico.reduce((acc, f) => acc + publico(f), 0);
    const prom = conPublico.length ? Math.round(total / conPublico.length) : null;
    return {
      hechas, conPublico, total, prom,
      mejor: conPublico.length ? Math.max(...conPublico.map(publico)) : null,
      ultima: hechas[hechas.length - 1] || null,
      pct: prom != null && t.capacidad ? Math.round(prom * 100 / t.capacidad) : null,
    };
  }

  function historialHtml(t, fs) {
    const r = resumenTeatro(t, fs);
    if (!r.hechas.length) return '';
    let html = `<div class="panel historial"><div class="stat"><b>${r.hechas.length}</b><span>${r.hechas.length > 1 ? 'veces' : 'vez'} que fuimos</span></div>`;
    if (r.conPublico.length) {
      html += `<div class="stat"><b>${numero(r.prom)}</b><span>personas promedio${r.pct != null ? ` (${r.pct}%)` : ''}</span></div>
        <div class="stat"><b>${numero(r.mejor)}</b><span>mejor función</span></div>
        <div class="stat"><b>${numero(r.total)}</b><span>personas en total</span></div>`;
    }
    return html + `</div><p class="small muted">Última vez: ${esc(fechaLarga(r.ultima.fecha))}</p>`;
  }

  // Resumen corto que se muestra al programar una función en ese teatro.
  function infoTeatroHtml(teatroId, excluirId) {
    const t = teatroDe(teatroId);
    if (!t) return '';
    const fs = state.funciones.filter((f) => f.teatro_id === t.id && f.id !== excluirId);
    const r = resumenTeatro(t, fs);
    const prox = fs.filter((f) => f.estado !== 'cancelada' && f.fecha >= hoyISO()).length;
    let txt;
    if (!r.hechas.length) txt = 'Primera vez en este teatro (no hay funciones realizadas cargadas).';
    else {
      const u = r.ultima;
      txt = `Fueron ${r.hechas.length} ${r.hechas.length > 1 ? 'veces' : 'vez'}. Última: ${fechaCorta(u.fecha)} ${u.fecha.slice(0, 4)}` +
        (publico(u) != null ? ` — vinieron <b>${numero(publico(u))}</b> personas${t.capacidad ? ` (${Math.round(publico(u) * 100 / t.capacidad)}%)` : ''}` : '') + '.' +
        (r.conPublico.length > 1 ? ` Promedio: ${numero(r.prom)} personas.` : '');
    }
    if (prox) txt += ` Ya hay ${prox} función(es) programada(s) ahí.`;
    if (t.catering) txt += ` Catering: ${CATERING[t.catering].replace(/^\S+ /, '').toLowerCase()}.`;
    return `<div class="info-teatro">📈 ${txt}</div>`;
  }

  function verTeatro(id) {
    const t = teatroDe(id);
    if (!t) return;
    state.modalFuncionId = null;
    const fs = state.funciones.filter((f) => f.teatro_id === id).sort(ordenFunciones);
    abrirModal(`
      <div class="modal-cab">
        <div><h2>${esc(t.nombre)}</h2><div class="sub">${esc(t.ciudad)}, ${esc(t.provincia)}</div></div>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      ${t.a_verificar ? '<p><span class="badge verificar">Datos a verificar</span></p>' : ''}
      <div class="datos">
        <div class="dato"><div class="k">Dirección</div><div class="v">${t.direccion
          ? `<a href="${mapaLink(t)}" target="_blank" rel="noopener">${esc(t.direccion)} ↗</a>`
          : `<a href="${mapaLink(t)}" target="_blank" rel="noopener" class="muted">Buscar en el mapa ↗</a>`}</div></div>
        <div class="dato"><div class="k">Capacidad</div><div class="v">${t.capacidad ? numero(t.capacidad) + ' personas' : '<span class="muted">Sin dato</span>'}</div></div>
        ${contactoHtml(t)}
        ${cateringHtml(t)}
        ${t.notas ? `<div class="dato"><div class="k">Notas</div><div class="v multilinea">${esc(t.notas)}</div></div>` : ''}
        <div class="dato"><div class="k">Mapa</div><div class="v">${t.latitud != null ? '✓ Con ubicación' : '<span class="muted">Sin ubicación (editá el teatro)</span>'}</div></div>
      </div>
      <div class="acciones">
        <button class="btn primario" data-action="editarTeatro" data-id="${t.id}">Editar</button>
        <button class="btn peligro" data-action="borrarTeatro" data-id="${t.id}">Borrar</button>
      </div>
      <div class="seccion-titulo">📈 Historial</div>
      ${historialHtml(t, fs)}
      ${fs.length ? `<div class="lista">${fs.slice().reverse().map((f) => tarjetaFuncion(f, { conPublico: true })).join('')}</div>`
        : '<div class="vacio-msg">Todavía no hay funciones en este teatro.</div>'}`);
  }

  function formTeatro(id) {
    const t = id ? teatroDe(id) : { a_verificar: false, provincia: state.provTeatro || '' };
    if (!t) return;
    const campo = (name, label, type = 'text', extra = '') =>
      `<label class="campo"><span>${label}</span><input type="${type}" name="${name}" value="${esc(t[name])}" ${extra}></label>`;
    abrirModal(`
      <div class="modal-cab">
        <h2>${id ? 'Editar teatro' : 'Nuevo teatro'}</h2>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <form data-form="teatro" data-id="${id || ''}" novalidate>
        ${campo('nombre', 'Nombre *', 'text', 'required')}
        <div class="fila-2">
          ${campo('ciudad', 'Ciudad *', 'text', 'required')}
          <label class="campo"><span>Provincia *</span><select name="provincia" required>
            <option value="">Elegir…</option>
            ${PROVINCIAS.map((p) => `<option ${t.provincia === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select></label>
        </div>
        ${campo('direccion', 'Dirección')}
        ${campo('capacidad', 'Capacidad (personas)', 'number', 'min="0" inputmode="numeric"')}
        <div class="panel">
          <h3>Contacto</h3>
          ${campo('contacto_nombre', 'Nombre')}
          ${campo('contacto_telefono', 'Teléfono', 'tel')}
          ${campo('contacto_email', 'Email', 'email')}
        </div>
        <div class="panel">
          <h3>🍽️ Catering</h3>
          <label class="campo"><span>¿Quién pone el catering?</span><select name="catering">
            <option value="">Sin dato</option>
            ${Object.entries(CATERING).map(([v, l]) => `<option value="${v}" ${t.catering === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
          <label class="campo"><span>Detalle del catering</span><textarea name="catering_notas"
            placeholder="Ej: el teatro pone agua y café; llevar sándwiches y frutas para 6 personas">${esc(t.catering_notas)}</textarea></label>
        </div>
        <div class="panel">
          <h3>📍 Ubicación en el mapa</h3>
          <p class="small muted" style="margin-top:-6px">Si la dejás vacía, se busca sola por ciudad al guardar.</p>
          <div class="fila-2">
            ${campo('latitud', 'Latitud', 'number', 'step="any" inputmode="decimal"')}
            ${campo('longitud', 'Longitud', 'number', 'step="any" inputmode="decimal"')}
          </div>
          <button type="button" class="btn bloque" data-action="geocodificar">Buscar ubicación por dirección</button>
        </div>
        <label class="campo"><span>Notas</span><textarea name="notas">${esc(t.notas)}</textarea></label>
        <label class="check"><input type="checkbox" name="a_verificar" ${t.a_verificar ? 'checked' : ''}> Datos a verificar</label>
        <p class="error" id="form-error" hidden></p>
        <button class="btn primario bloque" type="submit">Guardar</button>
      </form>`);
  }

  async function buscarCoordenadas(consulta) {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=' + encodeURIComponent(consulta);
    const r = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j[0] ? { lat: Number(Number(j[0].lat).toFixed(5)), lng: Number(Number(j[0].lon).toFixed(5)) } : null;
  }

  async function geocodificarForm(btn) {
    const form = btn.form;
    const v = (k) => form.elements[k].value.trim();
    if (!v('ciudad') || !v('provincia')) return errorForm('Primero completá ciudad y provincia.');
    btn.disabled = true; btn.textContent = 'Buscando…';
    try {
      let c = v('direccion') ? await buscarCoordenadas(`${v('direccion')}, ${v('ciudad')}, ${v('provincia')}`) : null;
      let aprox = false;
      if (!c) { c = await buscarCoordenadas(`${v('ciudad')}, ${v('provincia')}`); aprox = true; }
      if (!c) { errorForm('No se encontró la ubicación. Podés cargar latitud y longitud a mano.'); return; }
      form.elements.latitud.value = c.lat; form.elements.longitud.value = c.lng;
      toast(aprox ? 'Ubicación de la ciudad encontrada ✓' : 'Ubicación encontrada ✓');
    } catch (e) {
      errorForm('No se pudo buscar la ubicación. Revisá tu conexión.');
    } finally {
      btn.disabled = false; btn.textContent = 'Buscar ubicación por dirección';
    }
  }

  async function guardarTeatro(form) {
    const fd = new FormData(form);
    const txt = (k) => String(fd.get(k) || '').trim() || null;
    const num = (k) => { const v = txt(k); return v == null ? null : Number(v); };
    const cap = txt('capacidad');
    const datos = {
      nombre: txt('nombre'), ciudad: txt('ciudad'), provincia: txt('provincia'),
      direccion: txt('direccion'), capacidad: cap ? parseInt(cap, 10) : null,
      contacto_nombre: txt('contacto_nombre'), contacto_telefono: txt('contacto_telefono'),
      contacto_email: txt('contacto_email'), notas: txt('notas'),
      catering: txt('catering'), catering_notas: txt('catering_notas'),
      latitud: num('latitud'), longitud: num('longitud'),
      a_verificar: fd.get('a_verificar') === 'on',
    };
    if (!datos.nombre || !datos.ciudad || !datos.provincia) return errorForm('Completá nombre, ciudad y provincia.');
    if (datos.capacidad != null && (isNaN(datos.capacidad) || datos.capacidad < 0)) return errorForm('La capacidad debe ser un número.');
    if ((datos.latitud == null) !== (datos.longitud == null) || isNaN(datos.latitud) || isNaN(datos.longitud)) {
      return errorForm('Completá latitud y longitud, o dejá las dos vacías.');
    }
    if (datos.latitud == null) {
      try {
        const c = await buscarCoordenadas(`${datos.ciudad}, ${datos.provincia}`);
        if (c) { datos.latitud = c.lat; datos.longitud = c.lng; }
      } catch (e) { /* sin conexión al buscador: se guarda sin ubicación */ }
    }
    const id = form.dataset.id;
    const q = id ? sb.from('teatros').update(datos).eq('id', id) : sb.from('teatros').insert(datos);
    await guardar(form, q);
  }

  async function borrarTeatro(id) {
    if (sinConexion()) return;
    const t = teatroDe(id);
    if (!t) return;
    const n = state.funciones.filter((f) => f.teatro_id === id).length;
    const aviso = n ? `\n\nTiene ${n} función(es) asociada(s): no se borran, pero quedan con "teatro a definir".` : '';
    if (!confirm(`¿Borrar "${t.nombre}"?${aviso}\nEsta acción no se puede deshacer.`)) return;
    const { error } = await sb.from('teatros').delete().eq('id', id);
    if (error) return toast(traducirError(error), true);
    cerrarModal();
    await cargarDatos(); renderMain();
    toast('Teatro borrado');
  }

  // ---------- Cuenta ----------
  function vistaCuenta() {
    return `
      <div class="panel">
        <h3>Mi cuenta</h3>
        <div class="datos" style="margin:0">
          <div class="dato"><div class="k">Email</div><div class="v">${esc(state.user.email)}</div></div>
          <div class="dato"><div class="k">Permisos</div><div class="v">${state.isAdmin
            ? 'Administrador: puede ver y editar todo.'
            : 'Equipo: puede ver el calendario y los datos de cada función.'}</div></div>
        </div>
      </div>
      <div class="panel">
        <h3>Cambiar contraseña</h3>
        <form data-form="clave" novalidate>
          <label class="campo"><span>Nueva contraseña</span><input type="password" name="clave1" autocomplete="new-password" minlength="6" required></label>
          <label class="campo"><span>Repetir nueva contraseña</span><input type="password" name="clave2" autocomplete="new-password" minlength="6" required></label>
          <p class="error" id="form-error" hidden></p>
          <button class="btn primario bloque" type="submit">Cambiar contraseña</button>
        </form>
      </div>
      <button class="btn bloque" data-action="salir">Cerrar sesión</button>`;
  }

  // ---------- Modal y formularios ----------
  function abrirModal(html) {
    $modal.innerHTML = `<div class="modal-fondo" data-action="fondo"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    document.body.classList.add('no-scroll');
  }
  function cerrarModal() {
    $modal.innerHTML = '';
    state.modalFuncionId = null;
    document.body.classList.remove('no-scroll');
  }
  function errorForm(msg) {
    const el = document.getElementById('form-error');
    if (el) { el.textContent = msg; el.hidden = false; el.scrollIntoView({ block: 'center' }); } else toast(msg, true);
  }
  async function guardar(form, consulta, despues) {
    if (sinConexion()) return;
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Guardando…';
    const { data, error } = await consulta;
    if (error) {
      btn.disabled = false; btn.textContent = 'Guardar';
      return errorForm(traducirError(error));
    }
    cerrarModal();
    if (despues) await despues(data); else await cargarDatos();
    renderMain();
    toast('Guardado ✓');
  }

  // ---------- Eventos ----------
  const acciones = {
    tab: (el) => { state.vista = el.dataset.tab; render(); window.scrollTo(0, 0); },
    calModo: (el) => { state.calModo = el.dataset.modo; renderMain(); },
    mesAnt: () => { const { y, m } = state.mes; state.mes = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; state.diaSel = null; renderMain(); },
    mesSig: () => { const { y, m } = state.mes; state.mes = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; state.diaSel = null; renderMain(); },
    irHoy: () => { const t = new Date(); state.mes = { y: t.getFullYear(), m: t.getMonth() }; state.diaSel = hoyISO(); renderMain(); },
    dia: (el) => { state.diaSel = state.diaSel === el.dataset.dia ? null : el.dataset.dia; renderMain(); },
    verAvisos: () => verAvisos(),
    verPendientes: () => verPendientes(),
    verRecordatorios: () => verRecordatorios(),
    editarFinanzas: (el) => formFinanzas(el.dataset.id),
    cerrarFuncion: (el) => formCierre(el.dataset.id),
    verFuncion: (el, e) => { e.preventDefault(); verFuncion(el.dataset.id); },
    volverFuncion: (el) => verFuncion(el.dataset.id),
    nuevaFuncion: () => formFuncion(null),
    nuevoPrivado: () => formFuncion(null, 'privado'),
    editarFuncion: (el) => formFuncion(el.dataset.id),
    borrarFuncion: (el) => borrarFuncion(el.dataset.id),
    agendar: (el) => agendar(el.dataset.id),
    icsUna: (el) => {
      const f = state.funciones.find((x) => x.id === el.dataset.id);
      if (f) descargarIcs([f], `funcion-${nombreSeguro(f.ciudad)}-${f.fecha}.ics`);
    },
    exportarTodo: () => exportarTodo(),
    icsTodas: (el) => {
      const hoy = hoyISO();
      const fs = state.funciones.filter((f) => f.estado !== 'cancelada' && (el.dataset.rango === 'todas' || f.fecha >= hoy));
      descargarIcs(fs, 'gira.ics');
    },
    quitarItem: (el) => {
      const f = state.funciones.find((x) => x.id === state.modalFuncionId);
      if (!f) return;
      const items = checklistDe(f).slice();
      items.splice(Number(el.dataset.i), 1);
      guardarChecklist(items);
    },
    borrarDoc: (el) => borrarDoc(el.dataset.ruta),
    verTeatro: (el) => verTeatro(el.dataset.id),
    nuevoTeatro: () => formTeatro(null),
    editarTeatro: (el) => formTeatro(el.dataset.id),
    borrarTeatro: (el) => borrarTeatro(el.dataset.id),
    geocodificar: (el) => geocodificarForm(el),
    cerrar: () => cerrarModal(),
    fondo: (el, e) => { if (e.target === el) cerrarModal(); },
    salir: async () => {
      cerrandoSesion = true; borrarCopia();
      await sb.auth.signOut().catch(() => {});
      state.user = null; state.offline = false; sesionUid = null;
      cerrandoSesion = false;
      renderLogin();
    },
    reintentar: () => { sesionUid = undefined; sb.auth.getSession().then(({ data }) => manejarSesion(data.session)); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !acciones[el.dataset.action]) return;
    acciones[el.dataset.action](el, e);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $modal.innerHTML) cerrarModal();
  });

  document.addEventListener('change', (e) => {
    const k = e.target.dataset.change;
    if (!k) return;
    if (k === 'filtroEstado') { state.filtroEstado = e.target.value; renderMain(); }
    if (k === 'verPasadas') { state.verPasadas = e.target.checked; renderMain(); }
    if (k === 'statsAnio') { state.statsAnio = e.target.value; renderMain(); }
    if (k === 'mapaRango') { state.mapaRango = e.target.value; renderMain(); }
    if (k === 'provTeatro') { state.provTeatro = e.target.value; document.getElementById('lista-teatros').innerHTML = listaTeatros(); }
    if (k === 'tipoFuncion') {
      const priv = e.target.value === 'privado';
      e.target.form.querySelectorAll('.bloque-teatro').forEach((el) => { el.hidden = priv; });
      e.target.form.querySelectorAll('.bloque-privado').forEach((el) => { el.hidden = !priv; });
    }
    if (k === 'teatroFuncion') {
      const t = teatroDe(e.target.value);
      if (t) e.target.form.elements.ciudad.value = t.ciudad;
      const $i = document.getElementById('info-teatro');
      if ($i) $i.innerHTML = infoTeatroHtml(e.target.value, e.target.form.dataset.id);
    }
    if (k === 'checkItem') {
      const f = state.funciones.find((x) => x.id === state.modalFuncionId);
      if (!f) return;
      const items = checklistDe(f).map((it) => ({ ...it }));
      items[Number(e.target.dataset.i)].hecho = e.target.checked;
      guardarChecklist(items);
    }
    if (k === 'subirDoc') subirDocs(e.target);
  });

  document.addEventListener('input', (e) => {
    if (e.target.dataset.input === 'buscaTeatro') {
      state.buscaTeatro = e.target.value;
      document.getElementById('lista-teatros').innerHTML = listaTeatros();
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const tipo = form.dataset.form;
    try {
      if (tipo === 'login') {
        const email = form.email.value.trim();
        const password = form.password.value;
        if (!email || !password) return renderLogin('Completá email y contraseña.');
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true; btn.textContent = 'Entrando…';
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) renderLogin(traducirError(error));
      } else if (tipo === 'funcion') {
        await guardarFuncion(form);
      } else if (tipo === 'finanzas') {
        await guardarFinanzas(form);
      } else if (tipo === 'cierre') {
        await guardarCierre(form);
      } else if (tipo === 'teatro') {
        await guardarTeatro(form);
      } else if (tipo === 'checkNuevo') {
        const texto = form.texto.value.trim();
        const f = state.funciones.find((x) => x.id === state.modalFuncionId);
        if (!texto || !f) return;
        await guardarChecklist([...checklistDe(f), { texto, hecho: false }]);
        const inp = document.querySelector('form[data-form=checkNuevo] input');
        if (inp) inp.focus();
      } else if (tipo === 'clave') {
        const c1 = form.clave1.value; const c2 = form.clave2.value;
        if (c1.length < 6) return errorForm('La contraseña debe tener al menos 6 caracteres.');
        if (c1 !== c2) return errorForm('Las contraseñas no coinciden.');
        const { error } = await sb.auth.updateUser({ password: c1 });
        if (error) return errorForm(traducirError(error));
        form.reset();
        toast('Contraseña actualizada ✓');
      }
    } catch (err) {
      console.error(err);
      errorForm(traducirError(err));
    }
  });
})();
