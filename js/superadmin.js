// ARCHIVO: js/superadmin.js
const PLANES_NEGOCIO = {
  basico: { label: 'Básico', badgeClass: 'bg-secondary-subtle text-dark border border-secondary-subtle' },
  pro: { label: 'Pro', badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle' },
  enterprise: { label: 'Enterprise', badgeClass: 'bg-dark text-warning border border-dark' }
};

const GIROS_NEGOCIO = {
  panaderia: { label: 'Panadería / Pastelería', badgeClass: 'bg-warning-subtle text-dark border border-warning-subtle' },
  restaurante: { label: 'Restaurante / Comida Rápida', badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle' },
  cafeteria: { label: 'Cafetería / Juguería', badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' },
  licoreria: { label: 'Licorería / Bodega de Licores', badgeClass: 'bg-dark-subtle text-dark border border-dark-subtle' },
  botica: { label: 'Botica / Farmacia', badgeClass: 'bg-info-subtle text-info-emphasis border border-info-subtle' },
  veterinaria: { label: 'Veterinaria / Pet Shop', badgeClass: 'bg-success-subtle text-success border border-success-subtle' },
  peluqueria: { label: 'Peluquería / Barbería / Spa', badgeClass: 'bg-danger-subtle text-danger-emphasis border border-danger-subtle' },
  minimarket: { label: 'Minimarket / Abarrotes', badgeClass: 'bg-success-subtle text-success-emphasis border border-success-subtle' },
  ropa: { label: 'Ropa / Boutique / Calzado', badgeClass: 'bg-dark text-white border border-dark' },
  libreria: { label: 'Librería / Bazar / Papelería', badgeClass: 'bg-info-subtle text-primary-emphasis border border-info-subtle' },
  ferreteria: { label: 'Ferretería / Construcción', badgeClass: 'bg-secondary-subtle text-dark border border-secondary-subtle' },
  taller: { label: 'Taller Mecánico / Repuestos', badgeClass: 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle' },
  general: { label: 'Tienda General / Otros', badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle' }
};

const ACCIONES_AUDITORIA = {
  CREAR_NEGOCIO: { label: 'CREAR NEGOCIO', badgeClass: 'bg-success-subtle text-success border border-success-subtle' },
  EDITAR_NEGOCIO: { label: 'EDITAR NEGOCIO', badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle' },
  ACTIVAR_NEGOCIO: { label: 'ACTIVAR NEGOCIO', badgeClass: 'bg-info-subtle text-info-emphasis border border-info-subtle' },
  SUSPENDER_NEGOCIO: { label: 'SUSPENDER NEGOCIO', badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle' },
  ELIMINAR_NEGOCIO: { label: 'ELIMINAR NEGOCIO', badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle' }
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

function mostrarErrorConfiguracion(mensaje) {
  ['#loginView', '#accessDeniedView', '#dashboardView'].forEach(sel => {
    const el = $(sel);
    if (el) el.classList.add('d-none');
  });
  const banner = $('#configErrorBanner');
  const msgEl = $('#configErrorBannerMsg');
  if (msgEl) msgEl.textContent = mensaje;
  if (banner) banner.classList.remove('d-none');
}

let supabaseClient = null;
try {
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } else {
    mostrarErrorConfiguracion('Faltan las llaves de conexión (SUPABASE_URL / SUPABASE_ANON_KEY) en js/config.js.');
  }
} catch (e) {
  mostrarErrorConfiguracion('No se pudo inicializar el cliente de Supabase: ' + (e?.message || 'Error desconocido'));
}

let allNegocios = [];
let filtroEstado = 'todos';
let textoBusqueda = '';
let slugEditadoManualmente = false;
let creacionEnCurso = false;
let edicionEnCurso = false;
let eliminacionEnCurso = false;
let ultimasCredenciales = null;
let currentSuperadminUser = null;
let evaluandoSesionSeq = 0;

const esUrlHttpsValida = (u) => {
  const s = String(u || '').trim();
  if (!s) return true;
  try {
    const parsed = new URL(s);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};
const esHexValido = (h) => /^#[0-9a-f]{6}$/i.test(String(h || '').trim());

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function parseFechaIsoLocal(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function fmtFechaCorta(dateStr) {
  const d = parseFechaIsoLocal(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function obtenerBadgeVencimientoPlan(fechaStr) {
  if (!fechaStr) {
    return '<span class="badge bg-light text-muted border rounded-pill">Sin vencimiento</span>';
  }
  const fechaVenc = parseFechaIsoLocal(fechaStr);
  if (!fechaVenc) {
    return '<span class="badge bg-light text-muted border rounded-pill">Sin vencimiento</span>';
  }
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.round((fechaVenc.getTime() - hoyLocal.getTime()) / 86400000);

  if (dias < 0) {
    return `<span class="badge bg-danger rounded-pill" title="Venció el ${esc(fmtFechaCorta(fechaStr))}">Vencido (${Math.abs(dias)}d)</span>`;
  }
  if (dias < 7) {
    return `<span class="badge bg-warning text-dark rounded-pill" title="Vence el ${esc(fmtFechaCorta(fechaStr))}">${dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`}</span>`;
  }
  return `<span class="badge bg-light text-dark border rounded-pill">Vence: ${esc(fmtFechaCorta(fechaStr))}</span>`;
}

function normalizarSlug(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizarSlugEnEscritura(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function truncarUuid(uuid) {
  const s = String(uuid || '').trim();
  if (s.length <= 14) return s || '—';
  return `${s.slice(0, 8)}...${s.slice(-4)}`;
}

function construirUrlRelativa(rutaRelativa) {
  try {
    if (window.location && window.location.href && /^https?:/i.test(window.location.href)) {
      return new URL(rutaRelativa, window.location.href).href;
    }
  } catch {
    // Fallback a ruta relativa simple
  }
  return rutaRelativa;
}

function toast(msg, type = 'success') {
  const container = $('#toastContainer');
  if (!container) return;
  const id = 't-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const bg = {
    success: 'text-bg-success',
    danger: 'text-bg-danger',
    warning: 'text-bg-warning'
  }[type] || 'text-bg-success';

  container.insertAdjacentHTML(
    'beforeend',
    `<div id="${id}" class="toast ${bg} border-0"><div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`
  );
  const toastEl = document.getElementById(id);
  if (toastEl && typeof bootstrap !== 'undefined' && bootstrap.Toast) {
    const t = new bootstrap.Toast(toastEl, { delay: 3200 });
    t.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  }
}

async function fetchConTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('La conexión tardó demasiado (timeout de 15 s). Verifica tu red e intenta nuevamente.');
    }
    throw new Error('Error de red al comunicarse con el servidor.');
  } finally {
    clearTimeout(timeoutId);
  }
}

function descargarRespaldoJson(slug, snapshot) {
  if (!snapshot) return;
  const ahora = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  const timestamp = `${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}_${pad(ahora.getHours())}${pad(ahora.getMinutes())}`;
  const slugLimpio = normalizarSlug(slug) || 'negocio';
  const nombreArchivo = `respaldo_${slugLimpio}_${timestamp}.json`;

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copiarAlPortapapeles(texto, mensajeExito = 'Copiado al portapapeles ✅') {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      toast(mensajeExito, 'success');
      return true;
    }
    if (typeof document !== 'undefined' && document.createElement && document.body) {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand && document.execCommand('copy');
      ta.remove();
      if (ok) {
        toast(mensajeExito, 'success');
        return true;
      }
    }
  } catch (err) {
    console.error('Error al copiar:', err);
  }
  toast('No se pudo copiar automáticamente', 'warning');
  return false;
}

function generarPasswordSegura(longitud = 12) {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minus = 'abcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const simbolos = '!@#$%&*';
  const todos = mayus + minus + nums + simbolos;

  const pick = (pool) => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return pool[arr[0] % pool.length];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const chars = [pick(mayus), pick(minus), pick(nums), pick(simbolos)];
  while (chars.length < longitud) {
    chars.push(pick(todos));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function cerrarModalesAbiertos() {
  if (typeof bootstrap === 'undefined' || !bootstrap.Modal) return;
  [
    '#modalCrearNegocio',
    '#modalCredencialesCreadas',
    '#modalEditarNegocio',
    '#modalAuditoria',
    '#modalEliminarNegocio'
  ].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    const inst = bootstrap.Modal.getInstance(el);
    if (inst) {
      try { inst.hide(); } catch (_) {}
    }
  });
}

// =============================================================================
// AUDITORÍA INMUTABLE (ISO 9001 / ISO 19011)
// =============================================================================
async function registrarAuditoria({ accion, entidad = 'negocios', entidad_id = null, detalles = {} }) {
  if (!supabaseClient || !currentSuperadminUser?.id) return;
  try {
    const { error } = await supabaseClient
      .from('logs_auditoria')
      .insert({
        actor_id: currentSuperadminUser.id,
        actor_email: currentSuperadminUser.email || null,
        accion,
        entidad,
        entidad_id: entidad_id ? String(entidad_id) : null,
        detalles: detalles && typeof detalles === 'object' ? detalles : {}
      });

    if (error) {
      console.warn('No se pudo registrar evento en logs_auditoria:', error);
    }
  } catch (err) {
    console.warn('Excepción registrando auditoría:', err);
  }
}

async function cargarLogsAuditoria() {
  if (!supabaseClient) return;
  const tbody = $('#auditoriaTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Cargando registros de auditoría...</td></tr>';
  }

  const { data, error } = await supabaseClient
    .from('logs_auditoria')
    .select('id, actor_id, actor_email, accion, entidad, entidad_id, detalles, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error cargando logs_auditoria:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error al cargar auditoría: ${esc(error.message)}</td></tr>`;
    }
    return;
  }

  renderTablaAuditoria(data || []);
}

function renderTablaAuditoria(logs) {
  const tbody = $('#auditoriaTableBody');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Aún no hay eventos registrados en la bitácora.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const infoAccion = ACCIONES_AUDITORIA[log.accion] || {
      label: log.accion || 'EVENTO',
      badgeClass: 'bg-secondary-subtle text-dark border border-secondary-subtle'
    };
    const det = log.detalles && typeof log.detalles === 'object' ? log.detalles : {};
    const nombreNeg = det.nombre ? esc(det.nombre) : '';
    const slugNeg = det.slug ? `<code>?tienda=${esc(det.slug)}</code>` : '';
    const entidadLabel = [nombreNeg, slugNeg].filter(Boolean).join(' · ')
      || `<span class="text-muted small">${esc(log.entidad || 'negocios')} #${esc(truncarUuid(log.entidad_id))}</span>`;
    const actorDisplay = log.actor_email
      ? `<span class="small fw-semibold">${esc(log.actor_email)}</span>`
      : `<code class="owner-id-code">${esc(truncarUuid(log.actor_id))}</code>`;
    const jsonPretty = esc(JSON.stringify(det, null, 2));

    return `
      <tr>
        <td><small class="text-muted text-nowrap">${esc(fmtDate(log.created_at))}</small></td>
        <td><span class="badge ${infoAccion.badgeClass} rounded-pill">${esc(infoAccion.label)}</span></td>
        <td>
          <div>${entidadLabel}</div>
          ${log.entidad_id ? `<small class="text-muted">ID: <code>${esc(truncarUuid(log.entidad_id))}</code></small>` : ''}
        </td>
        <td>${actorDisplay}</td>
        <td>
          <details>
            <summary class="btn btn-sm btn-outline-secondary py-0 px-2 small">Ver JSON</summary>
            <pre class="audit-json-pre bg-light border rounded p-2 mt-2 mb-0">${jsonPretty}</pre>
          </details>
        </td>
      </tr>
    `;
  }).join('');
}

// =============================================================================
// FLUJO DE ACCESO Y SEGURIDAD (ZERO-TRUST POR TABLA superadmins + RLS)
// =============================================================================
function mostrarVista(vista) {
  if ($('#loginView')) $('#loginView').classList.toggle('d-none', vista !== 'login');
  if ($('#accessDeniedView')) $('#accessDeniedView').classList.toggle('d-none', vista !== 'denied');
  if ($('#dashboardView')) $('#dashboardView').classList.toggle('d-none', vista !== 'dashboard');
}

function resetearEstadoSuperadmin() {
  allNegocios = [];
  ultimasCredenciales = null;
  currentSuperadminUser = null;
  cerrarModalesAbiertos();
  if ($('#userEmail')) $('#userEmail').textContent = '';
  if ($('#tenantsTableBody')) {
    $('#tenantsTableBody').innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Sin sesión activa.</td></tr>';
  }
}

async function evaluarSesion(session) {
  const seq = ++evaluandoSesionSeq;
  if (!supabaseClient) return;

  if (!session || !session.user?.id) {
    resetearEstadoSuperadmin();
    mostrarVista('login');
    return;
  }

  const { data: superadminRow, error: saError } = await supabaseClient
    .from('superadmins')
    .select('user_id, rol')
    .eq('user_id', session.user.id)
    .eq('activo', true)
    .maybeSingle();

  if (seq !== evaluandoSesionSeq) return;

  if (saError || !superadminRow) {
    resetearEstadoSuperadmin();
    if ($('#deniedUserEmail')) {
      $('#deniedUserEmail').textContent = session.user.email || truncarUuid(session.user.id);
    }
    mostrarVista('denied');
    return;
  }

  currentSuperadminUser = session.user;
  if ($('#userEmail')) $('#userEmail').textContent = session.user.email || truncarUuid(session.user.id);
  mostrarVista('dashboard');
  await cargarNegocios();
}

async function checkSession() {
  if (!supabaseClient) return;
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error || !session) {
    resetearEstadoSuperadmin();
    mostrarVista('login');
    return;
  }
  await evaluarSesion(session);
}

async function cerrarSesion() {
  if (!supabaseClient) return;
  evaluandoSesionSeq++;
  resetearEstadoSuperadmin();
  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error('Error cerrando sesión:', err);
  }
  if ($('#loginPassword')) $('#loginPassword').value = '';
  mostrarVista('login');
}

if (supabaseClient && supabaseClient.auth && typeof supabaseClient.auth.onAuthStateChange === 'function') {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session || !session.user) {
      evaluandoSesionSeq++;
      resetearEstadoSuperadmin();
      if ($('#loginPassword')) $('#loginPassword').value = '';
      mostrarVista('login');
      return;
    }

    if (event === 'TOKEN_REFRESHED' && currentSuperadminUser && String(session.user.id) === String(currentSuperadminUser.id)) {
      currentSuperadminUser = session.user;
      return;
    }

    if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && (!currentSuperadminUser || String(session.user.id) !== String(currentSuperadminUser.id))) {
      evaluarSesion(session);
    }
  });
}

if ($('#loginForm')) {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;

    const btn = $('#loginBtn');
    const origHtml = btn ? btn.innerHTML : '';
    const errEl = $('#loginError');
    if (errEl) errEl.classList.add('d-none');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Verificando...';
    }

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: ($('#loginEmail')?.value || '').trim(),
        password: $('#loginPassword')?.value || ''
      });

      if (error || !data?.session) {
        if (errEl) {
          errEl.textContent = '❌ Credenciales incorrectas';
          errEl.classList.remove('d-none');
        }
        return;
      }

      await evaluarSesion(data.session);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });
}

if ($('#logoutBtn')) $('#logoutBtn').addEventListener('click', cerrarSesion);
if ($('#deniedLogoutBtn')) $('#deniedLogoutBtn').addEventListener('click', cerrarSesion);

// =============================================================================
// KPIs Y TABLA DE INQUILINOS
// =============================================================================
async function cargarNegocios() {
  if (!supabaseClient) return;
  const tbody = $('#tenantsTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Cargando negocios...</td></tr>';
  }

  const { data, error } = await supabaseClient
    .from('negocios')
    .select('id, nombre, slug, whatsapp, logo_url, tipo_negocio, hero_imagen_url, hero_titulo_custom, color_primario, color_secundario, plan, fecha_vencimiento_plan, motivo_suspension, activo, owner_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando negocios:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error al cargar negocios: ${esc(error.message)}</td></tr>`;
    }
    return;
  }

  allNegocios = data || [];
  actualizarKPIs();
  renderTablaNegocios();
}

function actualizarKPIs() {
  const total = allNegocios.length;
  const activos = allNegocios.filter(n => Boolean(n.activo)).length;
  const suspendidos = total - activos;

  if ($('#kpiTotalNegocios')) $('#kpiTotalNegocios').textContent = String(total);
  if ($('#kpiNegociosActivos')) $('#kpiNegociosActivos').textContent = String(activos);
  if ($('#kpiNegociosSuspendidos')) $('#kpiNegociosSuspendidos').textContent = String(suspendidos);
}

function obtenerNegociosFiltrados() {
  const q = textoBusqueda.trim().toLowerCase();
  return allNegocios.filter(n => {
    const activo = Boolean(n.activo);
    if (filtroEstado === 'activos' && !activo) return false;
    if (filtroEstado === 'suspendidos' && activo) return false;
    if (!q) return true;
    const giroInfo = GIROS_NEGOCIO[n.tipo_negocio] || GIROS_NEGOCIO.general;
    const planInfo = PLANES_NEGOCIO[n.plan] || PLANES_NEGOCIO.basico;
    const hay = `${n.nombre || ''} ${n.slug || ''} ${n.whatsapp || ''} ${n.owner_id || ''} ${n.tipo_negocio || ''} ${giroInfo.label} ${n.plan || ''} ${planInfo.label}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderTablaNegocios() {
  const tbody = $('#tenantsTableBody');
  if (!tbody) return;

  const lista = obtenerNegociosFiltrados();
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No se encontraron negocios para el filtro actual.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(n => {
    const activo = Boolean(n.activo);
    const tiendaUrlRel = `index.html?tienda=${encodeURIComponent(n.slug)}`;
    const badgeEstado = activo
      ? '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill">Activo</span>'
      : '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">Suspendido</span>';
    const giroKey = Object.prototype.hasOwnProperty.call(GIROS_NEGOCIO, n.tipo_negocio) ? n.tipo_negocio : 'general';
    const giro = GIROS_NEGOCIO[giroKey];
    const badgeGiro = `<span class="badge ${giro.badgeClass} rounded-pill">${esc(giro.label)}</span>`;

    const planKey = Object.prototype.hasOwnProperty.call(PLANES_NEGOCIO, n.plan) ? n.plan : 'basico';
    const planCfg = PLANES_NEGOCIO[planKey];
    const badgePlan = `<span class="badge ${planCfg.badgeClass} rounded-pill">${esc(planCfg.label)}</span>`;
    const badgeVencimiento = obtenerBadgeVencimientoPlan(n.fecha_vencimiento_plan);

    const tieneBrandingCustom = Boolean(
      String(n.logo_url || '').trim() ||
      String(n.hero_imagen_url || '').trim() ||
      String(n.hero_titulo_custom || '').trim() ||
      esHexValido(n.color_primario) ||
      esHexValido(n.color_secundario)
    );
    const badgeCustom = tieneBrandingCustom
      ? '<span class="badge bg-dark-subtle text-dark border border-dark-subtle rounded-pill" title="Identidad visual personalizada"><i class="bi bi-palette-fill me-1"></i>Custom</span>'
      : '';

    const motivoHtml = !activo && n.motivo_suspension
      ? `<div class="small text-danger mt-1"><i class="bi bi-info-circle me-1"></i>${esc(n.motivo_suspension)}</div>`
      : '';

    const waHtml = n.whatsapp
      ? `<a href="https://wa.me/${encodeURIComponent(String(n.whatsapp).replace(/\D/g, ''))}" target="_blank" rel="noopener" class="text-decoration-none text-success fw-semibold"><i class="bi bi-whatsapp me-1"></i>${esc(n.whatsapp)}</a>`
      : '<span class="text-muted small">—</span>';

    return `
      <tr>
        <td>
          <div class="fw-bold text-dark">${esc(n.nombre)}</div>
          <div class="d-flex flex-wrap gap-1 mt-1">${badgeEstado}${badgeGiro}${badgeCustom}</div>
          ${motivoHtml}
        </td>
        <td>
          <a href="${tiendaUrlRel}" target="_blank" rel="noopener" class="text-decoration-none fw-semibold" style="color: #1B4D3E;">
            <code>?tienda=${esc(n.slug)}</code> <i class="bi bi-box-arrow-up-right small ms-1"></i>
          </a>
        </td>
        <td>
          <div class="d-flex flex-column align-items-start gap-1">
            ${badgePlan}
            ${badgeVencimiento}
          </div>
        </td>
        <td>${waHtml}</td>
        <td><small class="text-muted">${esc(fmtDate(n.created_at))}</small></td>
        <td>
          <div class="d-inline-flex align-items-center gap-1">
            <code class="owner-id-code" title="${esc(n.owner_id)}">${esc(truncarUuid(n.owner_id))}</code>
            <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2 btn-copy-owner" data-owner-id="${esc(n.owner_id)}" title="Copiar Owner ID completo">
              <i class="bi bi-clipboard"></i>
            </button>
          </div>
        </td>
        <td>
          <div class="form-check form-switch d-flex align-items-center gap-2 mb-0">
            <input class="form-check-input switch-estado-negocio" type="checkbox" role="switch"
              data-id="${esc(n.id)}" aria-label="Activar o suspender ${esc(n.nombre)}" ${activo ? 'checked' : ''}>
            <span class="small fw-semibold ${activo ? 'text-success' : 'text-danger'}">
              ${activo ? 'Activo' : 'Suspendido'}
            </span>
          </div>
        </td>
        <td class="text-end">
          <div class="d-inline-flex gap-1">
            <button type="button" class="btn btn-sm btn-outline-success rounded-pill px-2 btn-copy-store-url" data-slug="${esc(n.slug)}" title="Copiar enlace de tienda">
              <i class="bi bi-link-45deg"></i> Link
            </button>
            <a href="${tiendaUrlRel}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-dark rounded-pill px-2" title="Abrir tienda">
              <i class="bi bi-shop"></i>
            </a>
            <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-2 btn-editar-negocio" data-id="${esc(n.id)}" title="Editar identidad, plan y datos">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-2 btn-eliminar-negocio" data-id="${esc(n.id)}" title="Eliminar negocio">
              <i class="bi bi-trash3-fill"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  $$('#tenantsTableBody .btn-copy-owner').forEach(btn => {
    btn.addEventListener('click', () => copiarAlPortapapeles(btn.dataset.ownerId, 'Owner ID copiado ✅'));
  });

  $$('#tenantsTableBody .btn-copy-store-url').forEach(btn => {
    btn.addEventListener('click', () => {
      const fullUrl = construirUrlRelativa(`index.html?tienda=${encodeURIComponent(btn.dataset.slug)}`);
      copiarAlPortapapeles(fullUrl, 'Enlace de tienda copiado ✅');
    });
  });

  $$('#tenantsTableBody .switch-estado-negocio').forEach(sw => {
    sw.addEventListener('change', () => alternarEstadoNegocio(sw.dataset.id, sw.checked, sw));
  });

  $$('#tenantsTableBody .btn-editar-negocio').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarNegocio(btn.dataset.id));
  });

  $$('#tenantsTableBody .btn-eliminar-negocio').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEliminarNegocio(btn.dataset.id));
  });
}

async function alternarEstadoNegocio(negocioId, nuevoEstado, switchEl) {
  if (!supabaseClient) return;
  const negocioPrevio = allNegocios.find(n => String(n.id) === String(negocioId));
  if (switchEl) switchEl.disabled = true;

  try {
    const { data, error } = await supabaseClient
      .from('negocios')
      .update({ activo: nuevoEstado })
      .eq('id', negocioId)
      .select('id, activo')
      .single();

    if (error || !data) {
      throw error || new Error('No se pudo actualizar el estado del negocio.');
    }

    if (negocioPrevio) {
      negocioPrevio.activo = Boolean(data.activo);
    }

    await registrarAuditoria({
      accion: nuevoEstado ? 'ACTIVAR_NEGOCIO' : 'SUSPENDER_NEGOCIO',
      entidad: 'negocios',
      entidad_id: negocioId,
      detalles: {
        nombre: negocioPrevio?.nombre || null,
        slug: negocioPrevio?.slug || null,
        activo_nuevo: Boolean(data.activo),
        motivo_suspension: negocioPrevio?.motivo_suspension || null
      }
    });

    actualizarKPIs();
    renderTablaNegocios();
    toast(
      nuevoEstado ? 'Negocio activado correctamente ✅' : 'Negocio suspendido correctamente ⚠️',
      nuevoEstado ? 'success' : 'warning'
    );
  } catch (err) {
    console.error('Error actualizando estado:', err);
    if (switchEl) switchEl.checked = !nuevoEstado;
    toast('Error al cambiar estado: ' + esc(err?.message || 'Desconocido'), 'danger');
  } finally {
    if (switchEl) switchEl.disabled = false;
  }
}

if ($('#btnRecargarNegocios')) {
  $('#btnRecargarNegocios').addEventListener('click', cargarNegocios);
}

if ($('#btnAbrirAuditoria')) {
  $('#btnAbrirAuditoria').addEventListener('click', async () => {
    const modalEl = $('#modalAuditoria');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    await cargarLogsAuditoria();
  });
}

if ($('#btnRecargarAuditoria')) {
  $('#btnRecargarAuditoria').addEventListener('click', cargarLogsAuditoria);
}

if ($('#searchTenants')) {
  $('#searchTenants').addEventListener('input', (e) => {
    textoBusqueda = e.target.value || '';
    renderTablaNegocios();
  });
}

$$('#tenantStatusFilter button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('#tenantStatusFilter button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroEstado = btn.dataset.status || 'todos';
    renderTablaNegocios();
  });
});

// =============================================================================
// MODAL CREAR NUEVO NEGOCIO + EDGE FUNCTION 'crear-negocio'
// =============================================================================
function actualizarVistaPreviaSlug(slugVal) {
  const preview = $('#slugUrlPreview');
  if (!preview) return;
  const limpio = normalizarSlug(slugVal);
  preview.textContent = limpio
    ? `URL resultante: index.html?tienda=${limpio}`
    : 'Se autogenera desde el nombre, puedes editarlo manualmente.';
}

function limpiarFormularioCrearNegocio() {
  slugEditadoManualmente = false;
  if ($('#formCrearNegocio')) $('#formCrearNegocio').reset();
  if ($('#negTipo')) $('#negTipo').value = 'general';
  if ($('#negPlan')) $('#negPlan').value = 'basico';
  if ($('#negFechaVencimiento')) $('#negFechaVencimiento').value = '';
  if ($('#crearNegocioError')) {
    $('#crearNegocioError').textContent = '';
    $('#crearNegocioError').classList.add('d-none');
  }
  if ($('#negPassword')) $('#negPassword').type = 'text';
  if ($('#iconTogglePassword')) $('#iconTogglePassword').className = 'bi bi-eye-slash';
  actualizarVistaPreviaSlug('');
}

if ($('#btnAbrirCrearNegocio')) {
  $('#btnAbrirCrearNegocio').addEventListener('click', () => {
    limpiarFormularioCrearNegocio();
    const modalEl = $('#modalCrearNegocio');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  });
}

if ($('#negNombre')) {
  $('#negNombre').addEventListener('input', (e) => {
    if (!slugEditadoManualmente && $('#negSlug')) {
      const generado = normalizarSlug(e.target.value);
      $('#negSlug').value = generado;
      actualizarVistaPreviaSlug(generado);
    }
  });
}

if ($('#negSlug')) {
  $('#negSlug').addEventListener('input', (e) => {
    const val = e.target.value;
    slugEditadoManualmente = val.trim().length > 0;
    const limpioEscritura = sanitizarSlugEnEscritura(val);
    if (limpioEscritura !== val) {
      e.target.value = limpioEscritura;
    }
    actualizarVistaPreviaSlug(e.target.value);
  });

  $('#negSlug').addEventListener('blur', (e) => {
    const finalSlug = normalizarSlug(e.target.value);
    e.target.value = finalSlug;
    actualizarVistaPreviaSlug(finalSlug);
  });
}

if ($('#btnGenerarPassword')) {
  $('#btnGenerarPassword').addEventListener('click', () => {
    if ($('#negPassword')) {
      $('#negPassword').value = generarPasswordSegura(12);
      $('#negPassword').type = 'text';
    }
    if ($('#iconTogglePassword')) {
      $('#iconTogglePassword').className = 'bi bi-eye-slash';
    }
  });
}

if ($('#btnTogglePassword')) {
  $('#btnTogglePassword').addEventListener('click', () => {
    const input = $('#negPassword');
    const icon = $('#iconTogglePassword');
    if (!input) return;
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    if (icon) icon.className = mostrar ? 'bi bi-eye-slash' : 'bi bi-eye';
  });
}

function mostrarResumenCredenciales({ nombre, slug, whatsapp, email, password }) {
  const adminUrl = construirUrlRelativa('admin.html');
  const tiendaUrl = construirUrlRelativa(`index.html?tienda=${encodeURIComponent(slug)}`);

  ultimasCredenciales = {
    nombre,
    slug,
    whatsapp: String(whatsapp || '').replace(/\D/g, ''),
    email,
    password,
    adminUrl,
    tiendaUrl
  };

  if ($('#credNegocioNombre')) $('#credNegocioNombre').textContent = nombre;
  if ($('#credAdminUrl')) $('#credAdminUrl').textContent = adminUrl;
  if ($('#credTiendaUrl')) $('#credTiendaUrl').textContent = tiendaUrl;
  if ($('#credEmail')) $('#credEmail').textContent = email;
  if ($('#credPassword')) $('#credPassword').textContent = password;

  const btnWa = $('#btnEnviarWhatsAppDirecto');
  if (btnWa) {
    if (ultimasCredenciales.whatsapp) {
      btnWa.href = `https://wa.me/${ultimasCredenciales.whatsapp}?text=${encodeURIComponent(construirTextoWhatsAppCredenciales(ultimasCredenciales))}`;
      btnWa.classList.remove('d-none');
    } else {
      btnWa.href = '#';
      btnWa.classList.add('d-none');
    }
  }

  const modalEl = $('#modalCredencialesCreadas');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

function construirTextoWhatsAppCredenciales(creds) {
  return [
    `¡Hola! Tu tienda *${creds.nombre}* ya está activa en la plataforma:`,
    '',
    `🔐 *Panel Administrativo:* ${creds.adminUrl}`,
    `🛍️ *Tu Tienda Pública:* ${creds.tiendaUrl}`,
    `📧 *Correo:* ${creds.email}`,
    `🔑 *Contraseña temporal:* ${creds.password}`,
    '',
    'Te recomendamos cambiar o guardar tu contraseña al ingresar.'
  ].join('\n');
}

if ($('#btnCopiarWhatsAppCreds')) {
  $('#btnCopiarWhatsAppCreds').addEventListener('click', () => {
    if (!ultimasCredenciales) return;
    copiarAlPortapapeles(
      construirTextoWhatsAppCredenciales(ultimasCredenciales),
      'Credenciales listas para pegar en WhatsApp ✅'
    );
  });
}

if ($('#formCrearNegocio')) {
  $('#formCrearNegocio').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (creacionEnCurso || !supabaseClient) return;

    const errEl = $('#crearNegocioError');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('d-none');
    }

    const nombre_negocio = ($('#negNombre')?.value || '').trim();
    const slug = normalizarSlug($('#negSlug')?.value || '');
    const tipo_negocio = ($('#negTipo')?.value || 'general').trim().toLowerCase();
    const rawPlan = ($('#negPlan')?.value || 'basico').trim().toLowerCase();
    const plan = Object.prototype.hasOwnProperty.call(PLANES_NEGOCIO, rawPlan) ? rawPlan : 'basico';
    const fecha_vencimiento_plan = ($('#negFechaVencimiento')?.value || '').trim() || null;
    const whatsapp = ($('#negWhatsapp')?.value || '').replace(/\D/g, '');
    const email_dueno = ($('#negEmailDueno')?.value || '').trim().toLowerCase();
    const password = $('#negPassword')?.value || '';

    if (!nombre_negocio || !slug || !email_dueno || password.length < 6) {
      if (errEl) {
        errEl.textContent = 'Completa nombre, slug válido, correo y contraseña (mín. 6 caracteres).';
        errEl.classList.remove('d-none');
      }
      return;
    }

    creacionEnCurso = true;
    const btn = $('#btnSubmitCrearNegocio');
    const spinner = $('#spinnerCrearNegocio');
    const txtBtn = $('#txtBtnCrearNegocio');
    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    if (txtBtn) txtBtn.textContent = 'Creando negocio...';

    try {
      const { data: { session }, error: sessError } = await supabaseClient.auth.getSession();
      if (sessError || !session || !session.access_token) {
        throw new Error('Sesión no válida o expirada. Vuelve a iniciar sesión.');
      }

      const baseUrl = String(window.SUPABASE_URL || '').replace(/\/+$/, '');
      const resp = await fetchConTimeout(`${baseUrl}/functions/v1/crear-negocio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': window.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          nombre_negocio,
          slug,
          tipo_negocio,
          plan,
          fecha_vencimiento_plan,
          whatsapp: whatsapp || null,
          email_dueno,
          password
        })
      }, 15000);

      const resJson = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(resJson.error || `Error del servidor (${resp.status})`);
      }

      const modalCrearEl = $('#modalCrearNegocio');
      if (modalCrearEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const inst = bootstrap.Modal.getInstance(modalCrearEl) || bootstrap.Modal.getOrCreateInstance(modalCrearEl);
        inst.hide();
      }

      toast(`Negocio "${esc(nombre_negocio)}" creado con éxito ✅`, 'success');
      await cargarNegocios();

      mostrarResumenCredenciales({
        nombre: (resJson.negocio && resJson.negocio.nombre) || nombre_negocio,
        slug: (resJson.negocio && resJson.negocio.slug) || slug,
        whatsapp: (resJson.negocio && resJson.negocio.whatsapp) || whatsapp,
        email: email_dueno,
        password
      });
    } catch (err) {
      console.error('Error creando negocio:', err);
      if (errEl) {
        errEl.textContent = err?.message || 'Ocurrió un error al crear el negocio.';
        errEl.classList.remove('d-none');
      }
    } finally {
      creacionEnCurso = false;
      if (btn) btn.disabled = false;
      if (spinner) spinner.classList.add('d-none');
      if (txtBtn) txtBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Dar de Alta Negocio';
    }
  });
}

// =============================================================================
// MODAL EDITAR IDENTIDAD, PLAN Y DATOS DEL NEGOCIO
// =============================================================================
function actualizarPreviewImagenEditor(inputSel, wrapSel, imgSel) {
  const raw = String($(inputSel)?.value || '').trim();
  const wrap = $(wrapSel);
  const img = $(imgSel);
  if (!wrap || !img) return;

  if (raw && esUrlHttpsValida(raw)) {
    img.src = raw;
    img.onerror = () => wrap.classList.add('d-none');
    wrap.classList.remove('d-none');
  } else {
    img.src = '';
    wrap.classList.add('d-none');
  }
}

function sincronizarControlesColorEditor() {
  const activar = Boolean($('#editActivarColores')?.checked);
  const pickersWrap = $('#editColoresPickers');
  const pInput = $('#editColorPrimario');
  const sInput = $('#editColorSecundario');
  const pCode = $('#editColorPrimarioCode');
  const sCode = $('#editColorSecundarioCode');

  if (pInput) pInput.disabled = !activar;
  if (sInput) sInput.disabled = !activar;
  if (pickersWrap) pickersWrap.style.opacity = activar ? '1' : '0.5';

  if (pCode && pInput) pCode.textContent = activar ? pInput.value.toUpperCase() : 'Plantilla';
  if (sCode && sInput) sCode.textContent = activar ? sInput.value.toUpperCase() : 'Plantilla';
}

function abrirModalEditarNegocio(negocioId) {
  const n = allNegocios.find(item => String(item.id) === String(negocioId));
  if (!n) return;

  if ($('#editarNegocioError')) {
    $('#editarNegocioError').textContent = '';
    $('#editarNegocioError').classList.add('d-none');
  }

  if ($('#editNegId')) $('#editNegId').value = n.id;
  if ($('#editNegSlugBadge')) $('#editNegSlugBadge').textContent = `?tienda=${n.slug || ''}`;
  if ($('#editNegNombre')) $('#editNegNombre').value = n.nombre || '';
  if ($('#editNegWhatsapp')) $('#editNegWhatsapp').value = n.whatsapp || '';
  if ($('#editNegTipo')) {
    $('#editNegTipo').value = Object.prototype.hasOwnProperty.call(GIROS_NEGOCIO, n.tipo_negocio)
      ? n.tipo_negocio
      : 'general';
  }
  if ($('#editNegPlan')) {
    $('#editNegPlan').value = Object.prototype.hasOwnProperty.call(PLANES_NEGOCIO, n.plan)
      ? n.plan
      : 'basico';
  }
  if ($('#editNegFechaVencimiento')) {
    $('#editNegFechaVencimiento').value = n.fecha_vencimiento_plan ? String(n.fecha_vencimiento_plan).slice(0, 10) : '';
  }
  if ($('#editNegMotivoSuspension')) {
    $('#editNegMotivoSuspension').value = n.motivo_suspension || '';
  }
  if ($('#editLogoUrl')) $('#editLogoUrl').value = n.logo_url || '';
  if ($('#editHeroImagenUrl')) $('#editHeroImagenUrl').value = n.hero_imagen_url || '';
  if ($('#editHeroTituloCustom')) $('#editHeroTituloCustom').value = n.hero_titulo_custom || '';

  const tieneColoresGuardados = esHexValido(n.color_primario) || esHexValido(n.color_secundario);
  if ($('#editActivarColores')) $('#editActivarColores').checked = tieneColoresGuardados;
  if ($('#editColorPrimario')) {
    $('#editColorPrimario').value = esHexValido(n.color_primario) ? n.color_primario : '#1B4D3E';
  }
  if ($('#editColorSecundario')) {
    $('#editColorSecundario').value = esHexValido(n.color_secundario) ? n.color_secundario : '#D9822B';
  }

  actualizarPreviewImagenEditor('#editLogoUrl', '#editLogoPreviewWrap', '#editLogoPreview');
  actualizarPreviewImagenEditor('#editHeroImagenUrl', '#editHeroPreviewWrap', '#editHeroPreview');
  sincronizarControlesColorEditor();

  const modalEl = $('#modalEditarNegocio');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

if ($('#editLogoUrl')) {
  $('#editLogoUrl').addEventListener('input', () => actualizarPreviewImagenEditor('#editLogoUrl', '#editLogoPreviewWrap', '#editLogoPreview'));
}
if ($('#btnLimpiarLogoUrl')) {
  $('#btnLimpiarLogoUrl').addEventListener('click', () => {
    if ($('#editLogoUrl')) $('#editLogoUrl').value = '';
    actualizarPreviewImagenEditor('#editLogoUrl', '#editLogoPreviewWrap', '#editLogoPreview');
  });
}
if ($('#editHeroImagenUrl')) {
  $('#editHeroImagenUrl').addEventListener('input', () => actualizarPreviewImagenEditor('#editHeroImagenUrl', '#editHeroPreviewWrap', '#editHeroPreview'));
}
if ($('#btnLimpiarHeroUrl')) {
  $('#btnLimpiarHeroUrl').addEventListener('click', () => {
    if ($('#editHeroImagenUrl')) $('#editHeroImagenUrl').value = '';
    actualizarPreviewImagenEditor('#editHeroImagenUrl', '#editHeroPreviewWrap', '#editHeroPreview');
  });
}
if ($('#editActivarColores')) {
  $('#editActivarColores').addEventListener('change', sincronizarControlesColorEditor);
}
if ($('#editColorPrimario')) {
  $('#editColorPrimario').addEventListener('input', sincronizarControlesColorEditor);
}
if ($('#editColorSecundario')) {
  $('#editColorSecundario').addEventListener('input', sincronizarControlesColorEditor);
}

if ($('#formEditarNegocio')) {
  $('#formEditarNegocio').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (edicionEnCurso || !supabaseClient) return;

    const errEl = $('#editarNegocioError');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('d-none');
    }

    const negId = String($('#editNegId')?.value || '').trim();
    const negocioPrevio = allNegocios.find(item => String(item.id) === negId);
    const nombre = String($('#editNegNombre')?.value || '').trim();
    const whatsappClean = String($('#editNegWhatsapp')?.value || '').replace(/\D/g, '') || null;
    const rawTipo = String($('#editNegTipo')?.value || 'general').trim().toLowerCase();
    const tipo_negocio = Object.prototype.hasOwnProperty.call(GIROS_NEGOCIO, rawTipo) ? rawTipo : 'general';
    const rawPlan = String($('#editNegPlan')?.value || 'basico').trim().toLowerCase();
    const plan = Object.prototype.hasOwnProperty.call(PLANES_NEGOCIO, rawPlan) ? rawPlan : 'basico';
    const fecha_vencimiento_plan = String($('#editNegFechaVencimiento')?.value || '').trim() || null;
    const motivo_suspension = String($('#editNegMotivoSuspension')?.value || '').trim() || null;
    const logo_url = String($('#editLogoUrl')?.value || '').trim() || null;
    const hero_imagen_url = String($('#editHeroImagenUrl')?.value || '').trim() || null;
    const hero_titulo_custom = String($('#editHeroTituloCustom')?.value || '').trim() || null;

    if (!negId || !nombre) {
      if (errEl) {
        errEl.textContent = 'El nombre del negocio es obligatorio.';
        errEl.classList.remove('d-none');
      }
      return;
    }

    if ((logo_url && !esUrlHttpsValida(logo_url)) || (hero_imagen_url && !esUrlHttpsValida(hero_imagen_url))) {
      if (errEl) {
        errEl.textContent = 'Las URLs de logo y portada deben comenzar con https://.';
        errEl.classList.remove('d-none');
      }
      return;
    }

    // Regla crítica: si el checkbox está desmarcado, enviar siempre null para no dañar las plantillas
    const usarColoresCustom = Boolean($('#editActivarColores')?.checked);
    const color_primario = usarColoresCustom ? String($('#editColorPrimario')?.value || '').trim() || null : null;
    const color_secundario = usarColoresCustom ? String($('#editColorSecundario')?.value || '').trim() || null : null;

    edicionEnCurso = true;
    const btn = $('#btnSubmitEditarNegocio');
    const spinner = $('#spinnerEditarNegocio');
    const txtBtn = $('#txtBtnEditarNegocio');
    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    if (txtBtn) txtBtn.textContent = 'Guardando...';

    try {
      const payload = {
        nombre,
        whatsapp: whatsappClean,
        tipo_negocio,
        plan,
        fecha_vencimiento_plan,
        motivo_suspension,
        logo_url,
        hero_imagen_url,
        hero_titulo_custom,
        color_primario,
        color_secundario
      };

      const { data, error } = await supabaseClient
        .from('negocios')
        .update(payload)
        .eq('id', negId)
        .select('id')
        .single();

      if (error || !data) {
        throw error || new Error('No se pudo actualizar la identidad del negocio.');
      }

      await registrarAuditoria({
        accion: 'EDITAR_NEGOCIO',
        entidad: 'negocios',
        entidad_id: negId,
        detalles: {
          nombre,
          slug: negocioPrevio?.slug || null,
          tipo_negocio,
          plan,
          fecha_vencimiento_plan,
          motivo_suspension,
          branding_custom: usarColoresCustom || Boolean(logo_url || hero_imagen_url || hero_titulo_custom)
        }
      });

      const modalEl = $('#modalEditarNegocio');
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const inst = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
        inst.hide();
      }

      toast(`Negocio "${esc(nombre)}" actualizado correctamente ✅`, 'success');
      await cargarNegocios();
    } catch (err) {
      console.error('Error actualizando negocio:', err);
      if (errEl) {
        errEl.textContent = err?.message || 'Error al guardar los cambios.';
        errEl.classList.remove('d-none');
      }
    } finally {
      edicionEnCurso = false;
      if (btn) btn.disabled = false;
      if (spinner) spinner.classList.add('d-none');
      if (txtBtn) txtBtn.innerHTML = '<i class="bi bi-save me-1"></i> Guardar Cambios';
    }
  });
}

// =============================================================================
// MODAL ELIMINACIÓN SEGURA DE NEGOCIO + RESPALDO + EDGE FUNCTION 'eliminar-negocio'
// =============================================================================
function abrirModalEliminarNegocio(negocioId) {
  const n = allNegocios.find(item => String(item.id) === String(negocioId));
  if (!n) return;

  if ($('#eliminarNegocioError')) {
    $('#eliminarNegocioError').textContent = '';
    $('#eliminarNegocioError').classList.add('d-none');
  }
  if ($('#deleteNegId')) $('#deleteNegId').value = n.id || '';
  if ($('#deleteNegOwnerId')) $('#deleteNegOwnerId').value = n.owner_id || '';
  if ($('#deleteNegSlugEsperado')) $('#deleteNegSlugEsperado').value = n.slug || '';
  if ($('#deleteNegNombreDisplay')) $('#deleteNegNombreDisplay').textContent = n.nombre || '';
  if ($('#deleteSlugTarget')) $('#deleteSlugTarget').textContent = n.slug || '';
  if ($('#deleteConfirmSlugInput')) $('#deleteConfirmSlugInput').value = '';
  if ($('#btnConfirmarEliminarNegocio')) $('#btnConfirmarEliminarNegocio').disabled = true;

  const modalEl = $('#modalEliminarNegocio');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

if ($('#deleteConfirmSlugInput')) {
  $('#deleteConfirmSlugInput').addEventListener('input', (e) => {
    const esperado = String($('#deleteNegSlugEsperado')?.value || '').trim();
    const escrito = String(e.target.value || '').trim();
    if ($('#btnConfirmarEliminarNegocio')) {
      $('#btnConfirmarEliminarNegocio').disabled = !esperado || escrito !== esperado;
    }
  });
}

if ($('#formEliminarNegocio')) {
  $('#formEliminarNegocio').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (eliminacionEnCurso || !supabaseClient) return;

    const errEl = $('#eliminarNegocioError');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('d-none');
    }

    const negocio_id = String($('#deleteNegId')?.value || '').trim();
    const owner_id = String($('#deleteNegOwnerId')?.value || '').trim() || null;
    const expectedSlug = String($('#deleteNegSlugEsperado')?.value || '').trim();
    const typedSlug = String($('#deleteConfirmSlugInput')?.value || '').trim();

    if (!negocio_id || !expectedSlug || typedSlug !== expectedSlug) {
      if (errEl) {
        errEl.textContent = `Debes escribir exactamente "${expectedSlug}" para confirmar la eliminación.`;
        errEl.classList.remove('d-none');
      }
      return;
    }

    eliminacionEnCurso = true;
    const btn = $('#btnConfirmarEliminarNegocio');
    const spinner = $('#spinnerEliminarNegocio');
    const txtBtn = $('#txtBtnEliminarNegocio');
    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    if (txtBtn) txtBtn.textContent = 'Respaldando y eliminando...';

    try {
      const { data: { session }, error: sessError } = await supabaseClient.auth.getSession();
      if (sessError || !session || !session.access_token) {
        throw new Error('Sesión no válida o expirada. Vuelve a iniciar sesión.');
      }

      const baseUrl = String(window.SUPABASE_URL || '').replace(/\/+$/, '');
      const resp = await fetchConTimeout(`${baseUrl}/functions/v1/eliminar-negocio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': window.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ negocio_id, owner_id })
      }, 15000);

      const resJson = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(resJson.error || `Error del servidor (${resp.status})`);
      }

      if (resJson.deleted && resJson.snapshot) {
        descargarRespaldoJson(resJson.slug || expectedSlug, resJson.snapshot);
      }

      const modalEl = $('#modalEliminarNegocio');
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const inst = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
        inst.hide();
      }

      toast(`Negocio "${esc(expectedSlug)}" respaldado y eliminado permanentemente ✅`, 'success');
      await cargarNegocios();
    } catch (err) {
      console.error('Error eliminando negocio:', err);
      if (errEl) {
        errEl.textContent = err?.message || 'No se pudo eliminar el negocio.';
        errEl.classList.remove('d-none');
      }
    } finally {
      eliminacionEnCurso = false;
      const sigueCoincidiendo = String($('#deleteConfirmSlugInput')?.value || '').trim() === expectedSlug;
      if (btn) btn.disabled = !sigueCoincidiendo;
      if (spinner) spinner.classList.add('d-none');
      if (txtBtn) txtBtn.innerHTML = '<i class="bi bi-trash3-fill me-1"></i> Eliminar Permanentemente';
    }
  });
}

// Inicialización al cargar
checkSession();
