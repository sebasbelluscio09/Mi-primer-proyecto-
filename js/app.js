/* Agenda de Gira — versión 1
   Calendario de funciones + base de teatros + acceso de usuarios.
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
  const fechaLarga = (iso) => aFecha(iso).toLocaleDateString('es-AR',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const horaCorta = (h) => (h ? h.slice(0, 5) : '');
  const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const estadoLabel = (v) => (ESTADOS.find((e) => e.v === v) || { label: v }).label;
  const numero = (n) => (n == null ? '' : Number(n).toLocaleString('es-AR'));
  const telLink = (t) => `tel:${String(t).replace(/[^\d+]/g, '')}`;
  const mapaLink = (t) => 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent([t.nombre, t.direccion, t.ciudad, t.provincia, 'Argentina'].filter(Boolean).join(', '));

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
    if (/row-level security|permission denied/i.test(m)) return 'No tenés permiso para hacer este cambio.';
    if (/failed to fetch|network/i.test(m)) return 'Sin conexión. Revisá internet y probá de nuevo.';
    if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/same.*password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta de la anterior.';
    return 'Ocurrió un error: ' + m;
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

  // ---------- Estado ----------
  const ahora = new Date();
  const state = {
    user: null,
    isAdmin: false,
    cargado: false,
    teatros: [],
    funciones: [],
    vista: 'calendario',
    calModo: 'mes',
    mes: { y: ahora.getFullYear(), m: ahora.getMonth() },
    diaSel: null,
    filtroEstado: 'todos',
    verPasadas: false,
    buscaTeatro: '',
    provTeatro: '',
  };
  let canal = null;

  const teatroDe = (id) => state.teatros.find((t) => t.id === id);

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
    state.cargado = true;
  }

  let recargaTimer;
  function recargarPronto() {
    clearTimeout(recargaTimer);
    recargaTimer = setTimeout(async () => {
      try { await cargarDatos(); renderMain(); } catch (e) { console.error(e); }
    }, 300);
  }

  function suscribirTiempoReal() {
    if (canal) return;
    canal = sb.channel('cambios-gira')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'funciones' }, recargarPronto)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teatros' }, recargarPronto)
      .subscribe();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.user) recargarPronto();
  });

  // ---------- Sesión ----------
  let sesionUid = undefined;
  sb.auth.onAuthStateChange((_evento, session) => {
    const uid = session?.user?.id ?? null;
    if (uid === sesionUid) return; // solo actuar cuando cambia el usuario
    sesionUid = uid;
    setTimeout(() => manejarSesion(session), 0);
  });

  async function manejarSesion(session) {
    if (!session) {
      state.user = null; state.isAdmin = false; state.cargado = false;
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
      suscribirTiempoReal();
      render();
    } catch (e) {
      console.error(e);
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
    const tabs = [{ id: 'calendario', label: 'Calendario', ico: '📅' }];
    if (state.isAdmin) tabs.push({ id: 'teatros', label: 'Teatros', ico: '🎭' });
    tabs.push({ id: 'cuenta', label: 'Cuenta', ico: '👤' });

    $app.innerHTML = `
      <header class="topbar">
        <h1>Agenda de Gira</h1>
        <span class="rol">${state.isAdmin ? 'Administrador' : 'Equipo · solo lectura'}</span>
      </header>
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
    let html = '';
    let fab = '';
    if (state.vista === 'calendario') {
      html = vistaCalendario();
      if (state.isAdmin) fab = '<button class="fab" data-action="nuevaFuncion">+ Función</button>';
    } else if (state.vista === 'teatros') {
      html = vistaTeatros();
      fab = '<button class="fab" data-action="nuevoTeatro">+ Teatro</button>';
    } else {
      html = vistaCuenta();
    }
    $main.innerHTML = html;
    document.getElementById('fab').innerHTML = fab;
  }

  // ---------- Calendario ----------
  function vistaCalendario() {
    const seg = `<div class="segmented" role="tablist">
      <button data-action="calModo" data-modo="mes" class="${state.calModo === 'mes' ? 'activo' : ''}">Mes</button>
      <button data-action="calModo" data-modo="lista" class="${state.calModo === 'lista' ? 'activo' : ''}">Lista</button>
    </div>`;
    return seg + (state.calModo === 'mes' ? vistaMes() : vistaLista());
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
      const clases = ['dia', iso === hoy ? 'hoy' : '', iso === state.diaSel ? 'sel' : ''].join(' ');
      const chips = fs.slice(0, 2).map((f) =>
        `<span class="chip est-${f.estado}">${esc(f.ciudad)}</span>`).join('');
      const mas = fs.length > 2 ? `<span class="mas">+${fs.length - 2}</span>` : '';
      celdas += `<button class="${clases}" data-action="dia" data-dia="${iso}"
        aria-label="${esc(fechaLarga(iso))}${fs.length ? `, ${fs.length} función(es)` : ''}">
        <span class="num">${d}</span>${chips}${mas}</button>`;
    }

    const items = state.diaSel && state.diaSel.startsWith(prefijo) ? (porDia[state.diaSel] || []) : delMes;
    const titulo = state.diaSel && state.diaSel.startsWith(prefijo)
      ? fechaLarga(state.diaSel) : `Funciones de ${MESES[m]}`;
    const vacio = state.diaSel && state.diaSel.startsWith(prefijo)
      ? (state.isAdmin ? 'Sin funciones este día. Tocá “+ Función” para agregar una.' : 'Sin funciones este día.')
      : 'No hay funciones cargadas este mes.';

    return `
      <div class="mes-nav">
        <button class="btn-icono" data-action="mesAnt" aria-label="Mes anterior">‹</button>
        <h2>${MESES[m]} ${y}</h2>
        <button class="btn-icono" data-action="mesSig" aria-label="Mes siguiente">›</button>
      </div>
      <div class="grilla">${celdas}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        ${leyenda()}
        <button class="hoy btn-icono" style="width:auto;padding:0 12px;font-size:14px" data-action="irHoy">Hoy</button>
      </div>
      <div class="seccion-titulo">${esc(titulo)}</div>
      ${items.length ? `<div class="lista">${items.map(tarjetaFuncion).join('')}</div>`
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
    </div>`;

    if (!grupos.length) {
      return filtros + `<div class="vacio-msg">${state.funciones.length
        ? 'No hay funciones con estos filtros.'
        : (state.isAdmin ? 'Todavía no hay funciones. Tocá “+ Función” para cargar la primera.' : 'Todavía no hay funciones cargadas.')}</div>`;
    }
    return filtros + grupos.map((g) => {
      const [y, m] = g.clave.split('-').map(Number);
      return `<div class="seccion-titulo">${MESES[m - 1]} ${y} · ${g.items.length}</div>
        <div class="lista">${g.items.map(tarjetaFuncion).join('')}</div>`;
    }).join('');
  }

  function tarjetaFuncion(f) {
    const d = aFecha(f.fecha);
    const t = teatroDe(f.teatro_id);
    const sub = [t ? t.nombre : 'Teatro a definir', horaCorta(f.hora) && `${horaCorta(f.hora)} h`].filter(Boolean).join(' · ');
    return `<button class="card funcion est-${f.estado}" data-action="verFuncion" data-id="${f.id}">
      <div class="fecha-box">
        <span class="ds">${d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}</span>
        <span class="dn">${d.getDate()}</span>
        <span class="ma">${MESES[d.getMonth()].slice(0, 3)}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(f.ciudad)}</div>
        <div class="card-sub">${esc(sub)}</div>
      </div>
      <span class="badge est-${f.estado}">${estadoLabel(f.estado)}</span>
    </button>`;
  }

  // ---------- Detalle y formulario de función ----------
  function verFuncion(id) {
    const f = state.funciones.find((x) => x.id === id);
    if (!f) return;
    const t = teatroDe(f.teatro_id);
    const teatroHtml = t ? `
      <div class="dato"><div class="k">Teatro</div><div class="v"><b>${esc(t.nombre)}</b>
        ${t.a_verificar ? ' <span class="badge verificar">a verificar</span>' : ''}</div></div>
      ${t.direccion ? `<div class="dato"><div class="k">Dirección</div><div class="v">
        <a href="${mapaLink(t)}" target="_blank" rel="noopener">${esc(t.direccion)}, ${esc(t.ciudad)} ↗</a></div></div>` : ''}
      ${t.capacidad ? `<div class="dato"><div class="k">Capacidad</div><div class="v">${numero(t.capacidad)} personas</div></div>` : ''}
      ${contactoHtml(t)}` : `<div class="dato"><div class="k">Teatro</div><div class="v muted">A definir</div></div>`;

    abrirModal(`
      <div class="modal-cab">
        <div><h2>${esc(f.ciudad)}</h2><div class="sub">${esc(fechaLarga(f.fecha))}</div></div>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="datos">
        <div class="dato"><div class="k">Estado</div><div class="v"><span class="badge est-${f.estado}">${estadoLabel(f.estado)}</span></div></div>
        <div class="dato"><div class="k">Hora</div><div class="v">${f.hora ? horaCorta(f.hora) + ' h' : '<span class="muted">A definir</span>'}</div></div>
        ${teatroHtml}
        ${f.notas ? `<div class="dato"><div class="k">Notas</div><div class="v multilinea">${esc(f.notas)}</div></div>` : ''}
      </div>
      ${state.isAdmin ? `<div class="acciones">
        <button class="btn primario" data-action="editarFuncion" data-id="${f.id}">Editar</button>
        <button class="btn peligro" data-action="borrarFuncion" data-id="${f.id}">Borrar</button>
      </div>` : ''}`);
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

  function opcionesTeatros(seleccionado) {
    const porProv = {};
    state.teatros.forEach((t) => { (porProv[t.provincia] = porProv[t.provincia] || []).push(t); });
    return '<option value="">— A definir —</option>' + Object.keys(porProv).sort((a, b) => a.localeCompare(b, 'es'))
      .map((p) => `<optgroup label="${esc(p)}">${porProv[p].map((t) =>
        `<option value="${t.id}" ${t.id === seleccionado ? 'selected' : ''}>${esc(t.nombre)} (${esc(t.ciudad)})</option>`).join('')}</optgroup>`)
      .join('');
  }

  function formFuncion(id) {
    const f = id ? state.funciones.find((x) => x.id === id)
      : { fecha: state.diaSel || hoyISO(), hora: '21:00', estado: 'opcion', ciudad: '', teatro_id: null, notas: '' };
    if (!f) return;
    abrirModal(`
      <div class="modal-cab">
        <h2>${id ? 'Editar función' : 'Nueva función'}</h2>
        <button class="btn-icono" data-action="cerrar" aria-label="Cerrar">✕</button>
      </div>
      <form data-form="funcion" data-id="${id || ''}" novalidate>
        <div class="fila-2">
          <label class="campo"><span>Fecha *</span><input type="date" name="fecha" value="${esc(f.fecha)}" required></label>
          <label class="campo"><span>Hora</span><input type="time" name="hora" value="${esc(horaCorta(f.hora))}"></label>
        </div>
        <label class="campo"><span>Teatro</span>
          <select name="teatro_id" data-change="teatroFuncion">${opcionesTeatros(f.teatro_id)}</select></label>
        <label class="campo"><span>Ciudad *</span><input name="ciudad" value="${esc(f.ciudad)}" required
          placeholder="Se completa sola al elegir teatro"></label>
        <label class="campo"><span>Estado</span>
          <select name="estado">${ESTADOS.map((e) =>
            `<option value="${e.v}" ${f.estado === e.v ? 'selected' : ''}>${e.label}</option>`).join('')}</select></label>
        <label class="campo"><span>Notas</span><textarea name="notas">${esc(f.notas)}</textarea></label>
        <p class="error" id="form-error" hidden></p>
        <button class="btn primario bloque" type="submit">Guardar</button>
      </form>`);
  }

  async function guardarFuncion(form) {
    const fd = new FormData(form);
    const datos = {
      fecha: fd.get('fecha'),
      hora: fd.get('hora') || null,
      teatro_id: fd.get('teatro_id') || null,
      ciudad: String(fd.get('ciudad') || '').trim(),
      estado: fd.get('estado'),
      notas: String(fd.get('notas') || '').trim() || null,
    };
    if (!datos.fecha) return errorForm('Elegí una fecha.');
    if (!datos.ciudad) return errorForm('Escribí la ciudad (o elegí un teatro).');
    const id = form.dataset.id;
    const q = id ? sb.from('funciones').update(datos).eq('id', id) : sb.from('funciones').insert(datos);
    await guardar(form, q, async () => {
      const [y, m] = datos.fecha.split('-').map(Number);
      state.mes = { y, m: m - 1 };
      state.diaSel = datos.fecha;
    });
  }

  async function borrarFuncion(id) {
    const f = state.funciones.find((x) => x.id === id);
    if (!f || !confirm(`¿Borrar la función de ${f.ciudad} del ${fechaLarga(f.fecha)}?\nEsta acción no se puede deshacer.`)) return;
    const { error } = await sb.from('funciones').delete().eq('id', id);
    if (error) return toast(traducirError(error), true);
    cerrarModal();
    await cargarDatos(); renderMain();
    toast('Función borrada');
  }

  // ---------- Teatros ----------
  function teatrosFiltrados() {
    const q = normalizar(state.buscaTeatro.trim());
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
      <div class="lista">${ts.map((t) => `
        <button class="card" data-action="verTeatro" data-id="${t.id}">
          <div class="card-body">
            <div class="card-title">${esc(t.nombre)}</div>
            <div class="card-sub">${esc(t.ciudad)}, ${esc(t.provincia)}${t.capacidad ? ` · ${numero(t.capacidad)} lugares` : ''}</div>
          </div>
          ${t.a_verificar ? '<span class="badge verificar">a verificar</span>' : ''}
        </button>`).join('')}</div>`;
  }

  function verTeatro(id) {
    const t = teatroDe(id);
    if (!t) return;
    const fs = state.funciones.filter((f) => f.teatro_id === id).slice().reverse();
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
        ${t.notas ? `<div class="dato"><div class="k">Notas</div><div class="v multilinea">${esc(t.notas)}</div></div>` : ''}
      </div>
      <div class="acciones">
        <button class="btn primario" data-action="editarTeatro" data-id="${t.id}">Editar</button>
        <button class="btn peligro" data-action="borrarTeatro" data-id="${t.id}">Borrar</button>
      </div>
      <div class="seccion-titulo">Funciones en este teatro</div>
      ${fs.length ? `<div class="lista">${fs.map(tarjetaFuncion).join('')}</div>`
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
        <label class="campo"><span>Notas</span><textarea name="notas">${esc(t.notas)}</textarea></label>
        <label class="check"><input type="checkbox" name="a_verificar" ${t.a_verificar ? 'checked' : ''}> Datos a verificar</label>
        <p class="error" id="form-error" hidden></p>
        <button class="btn primario bloque" type="submit">Guardar</button>
      </form>`);
  }

  async function guardarTeatro(form) {
    const fd = new FormData(form);
    const txt = (k) => String(fd.get(k) || '').trim() || null;
    const cap = txt('capacidad');
    const datos = {
      nombre: txt('nombre'), ciudad: txt('ciudad'), provincia: txt('provincia'),
      direccion: txt('direccion'), capacidad: cap ? parseInt(cap, 10) : null,
      contacto_nombre: txt('contacto_nombre'), contacto_telefono: txt('contacto_telefono'),
      contacto_email: txt('contacto_email'), notas: txt('notas'),
      a_verificar: fd.get('a_verificar') === 'on',
    };
    if (!datos.nombre || !datos.ciudad || !datos.provincia) return errorForm('Completá nombre, ciudad y provincia.');
    if (datos.capacidad != null && (isNaN(datos.capacidad) || datos.capacidad < 0)) return errorForm('La capacidad debe ser un número.');
    const id = form.dataset.id;
    const q = id ? sb.from('teatros').update(datos).eq('id', id) : sb.from('teatros').insert(datos);
    await guardar(form, q);
  }

  async function borrarTeatro(id) {
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
    document.body.classList.remove('no-scroll');
  }
  function errorForm(msg) {
    const el = document.getElementById('form-error');
    if (el) { el.textContent = msg; el.hidden = false; } else toast(msg, true);
  }
  async function guardar(form, consulta, despues) {
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true; btn.textContent = 'Guardando…';
    const { error } = await consulta;
    if (error) {
      btn.disabled = false; btn.textContent = 'Guardar';
      return errorForm(traducirError(error));
    }
    if (despues) await despues();
    cerrarModal();
    await cargarDatos(); renderMain();
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
    verFuncion: (el) => verFuncion(el.dataset.id),
    nuevaFuncion: () => formFuncion(null),
    editarFuncion: (el) => formFuncion(el.dataset.id),
    borrarFuncion: (el) => borrarFuncion(el.dataset.id),
    verTeatro: (el) => verTeatro(el.dataset.id),
    nuevoTeatro: () => formTeatro(null),
    editarTeatro: (el) => formTeatro(el.dataset.id),
    borrarTeatro: (el) => borrarTeatro(el.dataset.id),
    cerrar: () => cerrarModal(),
    fondo: (el, e) => { if (e.target === el) cerrarModal(); },
    salir: async () => { await sb.auth.signOut(); },
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
    if (k === 'provTeatro') { state.provTeatro = e.target.value; document.getElementById('lista-teatros').innerHTML = listaTeatros(); }
    if (k === 'teatroFuncion') {
      const t = teatroDe(e.target.value);
      if (t) e.target.form.elements.ciudad.value = t.ciudad;
    }
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
      } else if (tipo === 'teatro') {
        await guardarTeatro(form);
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
