// ARCHIVO: js/admin.js
let supabaseClient = null;
try {
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } else { alert("Faltan las llaves de conexión en config.js"); }
} catch (e) { alert("Error al iniciar Supabase: " + e.message); }

// Variables de estado global
window.negocioAdminActual = null;
let realtimeChannel = null;
let authResolutionSeq = 0;
let isSigningOut = false;
let cuentaSuspendidaAdmin = false;

const GIRO_CATEGORIAS_ADMIN = {
  panaderia: {
    tituloProductos: 'Gestión de Carta',
    categorias: [
      { value: 'Salados', label: 'Panes Salados' },
      { value: 'Dulces', label: 'Panes Dulces' },
      { value: 'Sánguches', label: 'Sánguches' },
      { value: 'Bebidas', label: 'Bebidas / Combos' }
    ]
  },
  botica: {
    tituloProductos: 'Gestión de Inventario y Farmacia',
    categorias: [
      { value: 'Medicamentos', label: 'Medicamentos' },
      { value: 'Cuidado Personal', label: 'Cuidado Personal' },
      { value: 'Vitaminas', label: 'Vitaminas' },
      { value: 'Bebés y Mamá', label: 'Bebés y Mamá' }
    ]
  },
  restaurante: {
    tituloProductos: 'Gestión de Carta',
    categorias: [
      { value: 'Entradas', label: 'Entradas' },
      { value: 'Fondos', label: 'Fondos' },
      { value: 'Postres', label: 'Postres' },
      { value: 'Bebidas', label: 'Bebidas' }
    ]
  },
  cafeteria: {
    tituloProductos: 'Gestión de Carta Cafetería',
    categorias: [
      { value: 'Cafés', label: 'Cafés' },
      { value: 'Jugos y Batidos', label: 'Jugos y Batidos' },
      { value: 'Postres', label: 'Postres' },
      { value: 'Sánguches', label: 'Sánguches' }
    ]
  },
  licoreria: {
    tituloProductos: 'Gestión de Cavas y Licores',
    categorias: [
      { value: 'Cervezas', label: 'Cervezas' },
      { value: 'Vinos', label: 'Vinos' },
      { value: 'Whisky y Ron', label: 'Whisky y Ron' },
      { value: 'Pisco y Espumantes', label: 'Pisco y Espumantes' },
      { value: 'Piqueos y Hielo', label: 'Piqueos y Hielo' }
    ]
  },
  veterinaria: {
    tituloProductos: 'Gestión de Pet Shop y Vet',
    categorias: [
      { value: 'Alimentos', label: 'Alimentos' },
      { value: 'Farmacia Vet', label: 'Farmacia Vet' },
      { value: 'Higiene y Baño', label: 'Higiene y Baño' },
      { value: 'Accesorios y Juguetes', label: 'Accesorios y Juguetes' }
    ]
  },
  peluqueria: {
    tituloProductos: 'Gestión de Servicios y Productos',
    categorias: [
      { value: 'Cortes y Peinados', label: 'Cortes y Peinados' },
      { value: 'Barbería', label: 'Barbería' },
      { value: 'Tratamientos Capilares', label: 'Tratamientos Capilares' },
      { value: 'Cuidado y Styling', label: 'Cuidado y Styling' }
    ]
  },
  minimarket: {
    tituloProductos: 'Gestión de Inventario Minimarket',
    categorias: [
      { value: 'Abarrotes', label: 'Abarrotes' },
      { value: 'Bebidas', label: 'Bebidas' },
      { value: 'Snacks', label: 'Snacks' },
      { value: 'Limpieza y Hogar', label: 'Limpieza y Hogar' },
      { value: 'Lácteos', label: 'Lácteos' }
    ]
  },
  ropa: {
    tituloProductos: 'Gestión de Colección y Prendas',
    categorias: [
      { value: 'Polos', label: 'Polos' },
      { value: 'Pantalones', label: 'Pantalones' },
      { value: 'Vestidos', label: 'Vestidos' },
      { value: 'Casacas', label: 'Casacas' },
      { value: 'Accesorios', label: 'Accesorios' }
    ]
  },
  libreria: {
    tituloProductos: 'Gestión de Librería y Bazar',
    categorias: [
      { value: 'Útiles Escolares', label: 'Útiles Escolares' },
      { value: 'Oficina', label: 'Oficina' },
      { value: 'Arte y Manualidades', label: 'Arte y Manualidades' },
      { value: 'Regalos y Detalles', label: 'Regalos y Detalles' }
    ]
  },
  ferreteria: {
    tituloProductos: 'Gestión de Catálogo e Inventario',
    categorias: [
      { value: 'Herramientas', label: 'Herramientas' },
      { value: 'Pinturas', label: 'Pinturas' },
      { value: 'Gasfitería', label: 'Gasfitería' },
      { value: 'Electricidad', label: 'Electricidad' }
    ]
  },
  taller: {
    tituloProductos: 'Gestión de Repuestos y Servicios',
    categorias: [
      { value: 'Lubricantes y Aceites', label: 'Lubricantes y Aceites' },
      { value: 'Repuestos', label: 'Repuestos' },
      { value: 'Baterías y Llantas', label: 'Baterías y Llantas' },
      { value: 'Accesorios Auto', label: 'Accesorios Auto' }
    ]
  },
  general: {
    tituloProductos: 'Gestión de Productos',
    categorias: [
      { value: 'Destacados', label: 'Destacados' },
      { value: 'Novedades', label: 'Novedades' },
      { value: 'Ofertas', label: 'Ofertas' },
      { value: 'Varios', label: 'Varios' }
    ]
  }
};

let allOrders = [], currentPeriod = 'hoy', chartInstance = null;
let allProducts = [], editingProduct = null;
let currentAdminCategory = 'Todos';
let currentCajaPeriod = 'hoy'; // Variable para el filtro de caja

// Variables de estado del módulo POS y Escáner QR
let html5QrCode = null;
let escanerActivo = false;
let escanerTransicionando = false;
let camaraPausadaPorModal = false;
let posLookupEnCurso = false;
let modalProductoDesdePOS = false;
let pendingPosModalFocusId = null;
let posCart = [];
let posAudioCtx = null;
const posScanCooldowns = new Map();
const POS_SCAN_COOLDOWN_MS = 1800;

// Variables de estado independientes del módulo Venta Rápida (Express)
let carritoExpress = [];
let productosExpressCache = [];
let procesandoVentaExpress = false;

// Variables de estado del módulo Métodos de Pago
let pagosSqlFaltanteAdmin = false;
let guardandoPagosAdmin = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const fmt = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const fmtDate = (iso) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => /^https:\/\//i.test(u || '') ? esc(u) : '';
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const getNegocioActivoId = () => (window.negocioAdminActual && window.negocioAdminActual.id)
  ? String(window.negocioAdminActual.id)
  : null;

function getTenantIdOrThrow() {
  const id = getNegocioActivoId();
  if (!id) {
    throw new Error('Acceso denegado: no existe un negocio activo autenticado.');
  }
  return id;
}

function obtenerConfigGiroAdmin(tipoNegocio) {
  const clave = String(tipoNegocio || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(GIRO_CATEGORIAS_ADMIN, clave)
    ? GIRO_CATEGORIAS_ADMIN[clave]
    : GIRO_CATEGORIAS_ADMIN.general;
}

function sincronizarCategoriasAdmin(extraCategoria = null) {
  const tipo = window.negocioAdminActual ? window.negocioAdminActual.tipo_negocio : 'general';
  const cfg = obtenerConfigGiroAdmin(tipo);

  const titleEl = $('#productosSectionTitle');
  if (titleEl) {
    titleEl.textContent = cfg.tituloProductos || 'Gestión de Productos';
  }

  const mapa = new Map();
  (cfg.categorias || []).forEach(c => {
    const val = String(c.value || '').trim();
    if (val) mapa.set(val.toLowerCase(), { value: val, label: c.label || val });
  });

  (allProducts || []).forEach(p => {
    const val = String(p.categoria || '').trim();
    if (val && !mapa.has(val.toLowerCase())) {
      mapa.set(val.toLowerCase(), { value: val, label: val });
    }
  });

  if (extraCategoria) {
    const val = String(extraCategoria).trim();
    if (val && !mapa.has(val.toLowerCase())) {
      mapa.set(val.toLowerCase(), { value: val, label: val });
    }
  }

  const listaCategorias = [...mapa.values()];

  const filterEl = $('#adminCategoryFilter');
  if (filterEl) {
    const existeActual = currentAdminCategory === 'Todos' || listaCategorias.some(c => c.value === currentAdminCategory);
    if (!existeActual) currentAdminCategory = 'Todos';

    filterEl.innerHTML = [
      `<button type="button" class="btn btn-outline-secondary ${currentAdminCategory === 'Todos' ? 'active' : ''}" data-filter="Todos">Todos</button>`,
      ...listaCategorias.map(c =>
        `<button type="button" class="btn btn-outline-secondary ${currentAdminCategory === c.value ? 'active' : ''}" data-filter="${esc(c.value)}">${esc(c.label)}</button>`
      )
    ].join('');
  }

  const selectEl = $('#pCat');
  if (selectEl) {
    const prevValue = extraCategoria ? String(extraCategoria).trim() : selectEl.value;
    selectEl.innerHTML = listaCategorias
      .map(c => `<option value="${esc(c.value)}">${esc(c.value)}</option>`)
      .join('');
    if (prevValue && listaCategorias.some(c => c.value === prevValue)) {
      selectEl.value = prevValue;
    } else if (listaCategorias.length > 0) {
      selectEl.value = listaCategorias[0].value;
    }
  }
}

function resetearEstadoAdmin() {
  if (realtimeChannel && supabaseClient) {
    try { supabaseClient.removeChannel(realtimeChannel); } catch (_) {}
  }
  realtimeChannel = null;
  window.negocioAdminActual = null;
  cuentaSuspendidaAdmin = false;

  const bannerSusp = $('#bannerSuspensionAdmin');
  if (bannerSusp) bannerSusp.remove();

  $$('[data-suspended-locked="1"]').forEach(el => {
    el.disabled = false;
    el.classList.remove('disabled');
    el.removeAttribute('aria-disabled');
    delete el.dataset.suspendedLocked;
  });

  allOrders = [];
  allProducts = [];
  editingProduct = null;
  currentAdminCategory = 'Todos';
  currentPeriod = 'hoy';
  currentCajaPeriod = 'hoy';
  posCart = [];
  posScanCooldowns.clear();
  posLookupEnCurso = false;
  modalProductoDesdePOS = false;
  pendingPosModalFocusId = null;

  carritoExpress = [];
  productosExpressCache = [];
  procesandoVentaExpress = false;

  pagosSqlFaltanteAdmin = false;
  guardandoPagosAdmin = false;

  if (chartInstance) {
    try { chartInstance.destroy(); } catch (_) {}
    chartInstance = null;
  }

  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    ['#productModal', '#acceptOrderModal', '#posGlobalLookupModal', '#modalLotesProducto'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      const inst = bootstrap.Modal.getInstance(el);
      if (inst) {
        try { inst.hide(); } catch (_) {}
      }
    });
  }

  document.title = 'Admin - Panel de Administración';
  const brandEl = $('#adminBrandTitle');
  if (brandEl) brandEl.innerHTML = '<i class="bi bi-shop"></i> Admin';
  const emailEl = $('#userEmail');
  if (emailEl) emailEl.textContent = '';

  const btnTienda = $('#btnVerTienda');
  if (btnTienda) {
    btnTienda.href = '#';
    btnTienda.classList.add('disabled');
    btnTienda.setAttribute('aria-disabled', 'true');
  }

  const setText = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  setText('#kpiIngresos', 'S/ 0.00');
  setText('#kpiPedidos', '0');
  setText('#kpiClientes', '0');
  setText('#kpiTicket', 'S/ 0.00');
  setText('#cajaTotalDigital', 'S/ 0.00');
  setText('#cajaEfectivo', 'S/ 0.00');
  setText('#cajaEfectivoCount', '0 pedidos');
  setText('#cajaYape', 'S/ 0.00');
  setText('#cajaYapeCount', '0 pedidos');
  setText('#cajaBanco', 'S/ 0.00');
  setText('#cajaBancoCount', '0 pedidos');

  if ($('#topProducts')) $('#topProducts').innerHTML = '<p class="text-muted text-center small mb-0">Sin ventas</p>';
  if ($('#ordersTable')) $('#ordersTable').innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Sin pedidos</td></tr>';
  if ($('#productsTable')) $('#productsTable').innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Sin productos</td></tr>';
  if ($('#cajaTableBody')) $('#cajaTableBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay movimientos en este período.</td></tr>';
  if ($('#posProductSuggestions')) $('#posProductSuggestions').innerHTML = '';
  if ($('#lotesProductoNombre')) $('#lotesProductoNombre').textContent = '';
  if ($('#lotesStockTotal')) $('#lotesStockTotal').textContent = 'Stock: 0 u.';
  if ($('#tablaLotesBody')) $('#tablaLotesBody').innerHTML = '';
  if ($('#searchOrders')) $('#searchOrders').value = '';

  const alertasBadge = $('#alertasVencimientoBadge');
  if (alertasBadge) {
    alertasBadge.className = 'badge bg-secondary rounded-pill px-3 py-2';
    alertasBadge.textContent = '0 alertas';
  }
  if ($('#alertasVencimientoList')) {
    $('#alertasVencimientoList').innerHTML = '<p class="text-muted small mb-0">Sin datos cargados.</p>';
  }

  $$('#periodFilter button').forEach(b => b.classList.toggle('active', b.dataset.period === 'hoy'));
  $$('#cajaPeriodFilter button').forEach(b => b.classList.toggle('active', b.dataset.period === 'hoy'));

  if ($('#productosSectionTitle')) $('#productosSectionTitle').textContent = 'Gestión de Productos';
  if ($('#adminCategoryFilter')) {
    $('#adminCategoryFilter').innerHTML = '<button type="button" class="btn btn-outline-secondary active" data-filter="Todos">Todos</button>';
  }
  if ($('#pCat')) $('#pCat').innerHTML = '';

  if ($('#ubicacionDireccion')) $('#ubicacionDireccion').value = '';
  if ($('#ubicacionMapsUrl')) $('#ubicacionMapsUrl').value = '';
  if ($('#ubicacionPreview')) $('#ubicacionPreview').innerHTML = '';
  if ($('#ubicacionPreviewBadge')) {
    $('#ubicacionPreviewBadge').className = 'badge bg-secondary-subtle text-dark';
    $('#ubicacionPreviewBadge').textContent = 'Sin configurar';
  }

  limpiarUiMetodosPagoAdmin();

  $$('#adminTabs .nav-link').forEach(b => b.classList.toggle('active', b.dataset.target === 'tabPedidos'));
  if ($('#tabPedidos')) $('#tabPedidos').classList.remove('d-none');
  ['#tabProductos', '#tabCaja', '#tabPOS', '#tabVentaExpress', '#tabUbicacion', '#tabMetodosPago'].forEach(sel => {
    const el = $(sel);
    if (el) el.classList.add('d-none');
  });

  if ($('#buscadorExpress')) $('#buscadorExpress').value = '';
  if ($('#gridProductosExpress')) $('#gridProductosExpress').innerHTML = '';
  renderPosCart();
  renderCarritoExpress();
}

async function obtenerUrlFirmada(valor) {
  if (!valor || !supabaseClient) return null;
  try {
    let path = String(valor).trim();
    if (/^https?:\/\//i.test(path)) {
      const marker = '/comprobantes/';
      const idx = path.indexOf(marker);
      if (idx === -1) return null;
      path = decodeURIComponent(path.slice(idx + marker.length).split('?')[0]);
    }
    path = path.replace(/^\/+/, '');
    if (!path || path.includes('..')) return null;
    const { data, error } = await supabaseClient.storage.from('comprobantes').createSignedUrl(path, 3600);
    if (error || !data || !data.signedUrl) {
      if (error) console.error('Error generando URL firmada:', error);
      return null;
    }
    return /^https:\/\//i.test(data.signedUrl) ? data.signedUrl : null;
  } catch (err) {
    console.error('Error en obtenerUrlFirmada:', err);
    return null;
  }
}

function toast(msg, type = 'success') {
  const id = 't-' + Date.now(), bg = { success: 'text-bg-success', danger: 'text-bg-danger', warning: 'text-bg-warning' }[type] || 'text-bg-success';
  $('#toastContainer').insertAdjacentHTML('beforeend', `<div id="${id}" class="toast ${bg} border-0"><div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`);
  const t = new bootstrap.Toast(document.getElementById(id), { delay: 3000 }); t.show();
  document.getElementById(id).addEventListener('hidden.bs.toast', () => document.getElementById(id).remove());
}

// =============================================================================
// LOGIN Y RESOLUCIÓN ZERO-TRUST DE NEGOCIO (MULTI-TENANT)
// =============================================================================
async function checkSession() {
  if (!supabaseClient) {
    resetearEstadoAdmin();
    showLogin();
    return;
  }
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user || !user.id) {
    resetearEstadoAdmin();
    showLogin();
    return;
  }
  await resolverNegocioYIniciar();
}

function showLogin() { 
  $('#loginView').classList.remove('d-none'); 
  $('#dashboardView').classList.add('d-none'); 
}

async function resolverNegocioYIniciar() {
  const seq = ++authResolutionSeq;
  try {
    try { await detenerEscanerPOS(); } catch (_) {}
    resetearEstadoAdmin();

    if (!supabaseClient) {
      showLogin();
      return;
    }

    // Zero-Trust: obtener usuario autenticado directo del servidor Auth (sin depender de caché)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (seq !== authResolutionSeq) return;

    if (userError || !user || !user.id) {
      try { await supabaseClient.auth.signOut(); } catch (_) {}
      resetearEstadoAdmin();
      showLogin();
      return;
    }

    // Consulta estricta filtrando exclusivamente por el owner_id del JWT real
    const { data: negocios, error } = await supabaseClient
      .from('negocios')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    if (seq !== authResolutionSeq) return;

    if (error) {
      console.error('Error al consultar negocios asignados:', error);
      alert('Error de conexión al consultar el negocio: ' + error.message);
      try { await supabaseClient.auth.signOut(); } catch (_) {}
      resetearEstadoAdmin();
      showLogin();
      return;
    }

    // Validación Zero-Trust en cliente: solo aceptar registros cuyo owner_id coincida exactamente con user.id
    const negociosPropios = (negocios || []).filter(
      n => n && n.id && String(n.owner_id || '') === String(user.id)
    );

    if (negociosPropios.length === 0) {
      alert('⚠️ Este usuario no tiene un negocio asignado en el sistema.');
      try { await supabaseClient.auth.signOut(); } catch (_) {}
      resetearEstadoAdmin();
      showLogin();
      return;
    }

    const negocioElegido = negociosPropios.find(n => n.activo !== false) || negociosPropios[0];
    if (negocioElegido.activo === false) {
      window.negocioAdminActual = negocioElegido;
      await aplicarBloqueoSuspension(negocioElegido, user.email || '');
      return;
    }

    window.negocioAdminActual = negocioElegido;

    // Mostrar el dashboard una vez resuelto y validado el negocio
    showDashboard(user.email || '');
  } catch (err) {
    console.error('Excepción al resolver negocio:', err);
    try { if (supabaseClient) await supabaseClient.auth.signOut(); } catch (_) {}
    resetearEstadoAdmin();
    alert('Ocurrió un error inesperado al resolver tu negocio.');
    showLogin();
  }
}

async function aplicarBloqueoSuspension(negocio, email = '') {
  cuentaSuspendidaAdmin = true;

  try { await detenerEscanerPOS(); } catch (_) {}
  if (realtimeChannel && supabaseClient) {
    try { supabaseClient.removeChannel(realtimeChannel); } catch (_) {}
    realtimeChannel = null;
  }

  if ($('#loginView')) $('#loginView').classList.add('d-none');
  if ($('#dashboardView')) $('#dashboardView').classList.remove('d-none');
  if ($('#userEmail')) $('#userEmail').textContent = email;

  actualizarIdentidadPanel();

  let motivo = '';
  if (supabaseClient && negocio && negocio.id) {
    try {
      const { data: gob } = await supabaseClient
        .from('negocios_gobierno')
        .select('motivo_suspension')
        .eq('negocio_id', negocio.id)
        .maybeSingle();
      if (gob && gob.motivo_suspension) {
        motivo = String(gob.motivo_suspension).trim();
      }
    } catch (_) {
      // Ignorar si negocios_gobierno aún no existe o falla
    }
  }

  const mainContainer = $('#dashboardView .container-fluid.py-4');
  if (mainContainer) {
    const prev = $('#bannerSuspensionAdmin');
    if (prev) prev.remove();
    const banner = document.createElement('div');
    banner.id = 'bannerSuspensionAdmin';
    banner.className = 'alert alert-danger border-0 shadow-sm d-flex align-items-start gap-3 mb-4';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
      <i class="bi bi-shield-lock-fill fs-3 text-danger"></i>
      <div>
        <h5 class="fw-bold mb-1">Tu cuenta está suspendida. Contacta al administrador de la plataforma.</h5>
        ${motivo ? `<p class="mb-0 small"><strong>Motivo:</strong> ${esc(motivo)}</p>` : ''}
      </div>
    `;
    mainContainer.prepend(banner);
  }

  $$('#adminTabs .nav-link').forEach(btn => {
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.setAttribute('aria-disabled', 'true');
    btn.dataset.suspendedLocked = '1';
  });

  const btnTienda = $('#btnVerTienda');
  if (btnTienda) {
    btnTienda.href = '#';
    btnTienda.classList.add('disabled');
    btnTienda.setAttribute('aria-disabled', 'true');
  }

  $$('#dashboardView .container-fluid button, #dashboardView .container-fluid input, #dashboardView .container-fluid select').forEach(el => {
    if (el.id === 'logoutBtn') return;
    if (!el.disabled) {
      el.disabled = true;
      el.dataset.suspendedLocked = '1';
    }
  });

  aplicarModoSoloLecturaPagos(true);
}

function showDashboard(email) {
  if (!getNegocioActivoId()) {
    resetearEstadoAdmin();
    showLogin();
    return;
  }

  $('#loginView').classList.add('d-none'); 
  $('#dashboardView').classList.remove('d-none'); 
  $('#userEmail').textContent = email; 

  // Hidratar identidad visual y categorías del giro del negocio en el panel
  actualizarIdentidadPanel();

  // Suscribir eventos en tiempo real exclusivamente para este negocio_id
  setupRealtimeOrders();

  // Carga asíncrona aislada de pedidos, productos y alertas de vencimiento
  loadOrders(); 
  loadProducts();
  cargarAlertasVencimiento();
}

function actualizarIdentidadPanel() {
  if (!window.negocioAdminActual) return;
  const { nombre, logo_url, slug } = window.negocioAdminActual;
  const nombreSeguro = String(nombre || 'Mi Negocio').trim();

  // Actualizar título de la pestaña
  document.title = `${nombreSeguro} · Admin`;

  // Actualizar brand en la barra de navegación
  const brandEl = $('#adminBrandTitle');
  if (brandEl) {
    const cleanLogo = safeUrl(logo_url);
    if (cleanLogo) {
      brandEl.innerHTML = `<img src="${cleanLogo}" alt="${esc(nombreSeguro)}" style="width:28px; height:28px; border-radius:6px; object-fit:contain;"> ${esc(nombreSeguro)} · Admin`;
    } else {
      brandEl.innerHTML = `<i class="bi bi-shop"></i> ${esc(nombreSeguro)} · Admin`;
    }
  }

  // Actualizar enlace a la tienda pública (sin fallback a ningún otro negocio)
  const btnTienda = $('#btnVerTienda');
  if (btnTienda) {
    const slugLimpio = String(slug || '').trim();
    if (slugLimpio) {
      btnTienda.href = `index.html?tienda=${encodeURIComponent(slugLimpio)}`;
      btnTienda.classList.remove('disabled');
      btnTienda.removeAttribute('aria-disabled');
    } else {
      btnTienda.href = '#';
      btnTienda.classList.add('disabled');
      btnTienda.setAttribute('aria-disabled', 'true');
    }
  }

  // Sincronizar título, categorías del catálogo y formulario de ubicación
  sincronizarCategoriasAdmin();
  sincronizarFormularioUbicacion();
}

// Suscripción Realtime filtrada estrictamente por negocio_id
function setupRealtimeOrders() {
  if (!supabaseClient || !getNegocioActivoId()) return;
  if (realtimeChannel) {
    try { supabaseClient.removeChannel(realtimeChannel); } catch (_) {}
    realtimeChannel = null;
  }

  const negocioIdCanal = getNegocioActivoId();
  realtimeChannel = supabaseClient
    .channel('pedidos-admin-' + negocioIdCanal)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'pedidos',
      filter: 'negocio_id=eq.' + negocioIdCanal
    }, (payload) => {
      const activeId = getNegocioActivoId();
      if (!activeId || activeId !== negocioIdCanal) return;
      const rowNegId = payload?.new?.negocio_id || payload?.old?.negocio_id;
      if (rowNegId && String(rowNegId) !== activeId) return;

      loadOrders();
      if (payload.eventType === 'INSERT' && payload.new && payload.new.tipo_entrega !== 'Presencial') {
        toast(`🔔 ¡Nuevo pedido recibido! (#${esc(payload.new.numero_pedido || '')})`, 'success');
      }
    })
    .subscribe();
}

if (supabaseClient && supabaseClient.auth && typeof supabaseClient.auth.onAuthStateChange === 'function') {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (isSigningOut) return;
    if (event === 'SIGNED_OUT') {
      authResolutionSeq++;
      try { detenerEscanerPOS(); } catch (_) {}
      resetearEstadoAdmin();
      showLogin();
      return;
    }
    if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session && session.user) {
      const ownerActual = window.negocioAdminActual ? String(window.negocioAdminActual.owner_id || '') : '';
      if (ownerActual && String(session.user.id) !== ownerActual) {
        resolverNegocioYIniciar();
      }
    }
  });
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  resetearEstadoAdmin();
  const btn = $('#loginBtn'), orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = 'Verificando...'; $('#loginError').classList.add('d-none');
  const { error } = await supabaseClient.auth.signInWithPassword({ 
    email: $('#loginEmail').value.trim(), 
    password: $('#loginPassword').value 
  });
  btn.disabled = false; btn.innerHTML = orig;
  if (error) { 
    $('#loginError').textContent = '❌ Credenciales incorrectas'; 
    $('#loginError').classList.remove('d-none'); 
  } else {
    await resolverNegocioYIniciar();
  }
});

$('#logoutBtn').addEventListener('click', async () => { 
  isSigningOut = true;
  authResolutionSeq++;
  try {
    try { await detenerEscanerPOS(); } catch (_) {}
    if (supabaseClient) {
      try { await supabaseClient.auth.signOut(); } catch (_) {}
    }
  } finally {
    resetearEstadoAdmin();
    showLogin();
    isSigningOut = false;
  }
});

// NAVEGACIÓN PESTAÑAS PRINCIPALES
$$('#adminTabs .nav-link').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false) return;
    const target = btn.dataset.target;
    if (!target) return;
    $$('#adminTabs .nav-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Ocultar todas las pestañas
    $('#tabPedidos').classList.add('d-none'); 
    $('#tabProductos').classList.add('d-none'); 
    $('#tabCaja').classList.add('d-none');
    if ($('#tabPOS')) $('#tabPOS').classList.add('d-none');
    if ($('#tabVentaExpress')) $('#tabVentaExpress').classList.add('d-none');
    if ($('#tabUbicacion')) $('#tabUbicacion').classList.add('d-none');
    if ($('#tabMetodosPago')) $('#tabMetodosPago').classList.add('d-none');
    // Mostrar la seleccionada
    const targetEl = $('#' + target);
    if (targetEl) targetEl.classList.remove('d-none');
    if (target === 'tabUbicacion') {
      sincronizarFormularioUbicacion();
    }
    if (target === 'tabMetodosPago') {
      await cargarMetodosPagoAdmin();
    }
    if (target === 'tabVentaExpress') {
      await cargarProductosExpress();
    }
    // Iniciar o liberar la cámara según la pestaña activa
    if (target === 'tabPOS') {
      await iniciarEscanerPOS();
    } else {
      await detenerEscanerPOS();
    }
  });
});

// =============================================================================
// PEDIDOS Y DASHBOARD (FILTRADOS POR negocio_id)
// =============================================================================
async function loadOrders() {
  if (cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false) return;
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('pedidos')
    .select('*, pedido_items(*)')
    .eq('negocio_id', negocioId)
    .order('fecha', { ascending: false })
    .limit(1000);

  if (getNegocioActivoId() !== negocioId) return;

  if (error) {
    console.error(error);
    allOrders = [];
    renderDashboard();
    renderCaja();
    toast('Error cargando pedidos', 'danger');
    return;
  }

  allOrders = (data || []).filter(o => String(o.negocio_id || '') === negocioId);
  renderDashboard();
  renderCaja(); // Actualizar la caja al cargar pedidos
}

function getPeriodRange(p) {
  const now = new Date(), start = new Date(now); start.setHours(0,0,0,0);
  if (p === 'semana') start.setDate(start.getDate() - ((start.getDay()+6)%7));
  if (p === 'mes') start.setDate(1); if (p === 'ano') start.setMonth(0,1);
  if (p === 'todo') return { start: new Date(0), end: now };
  return { start, end: now };
}

function filterByPeriod(orders, p) {
  const { start, end } = getPeriodRange(p);
  return orders.filter(o => { const d = new Date(o.fecha); return d >= start && d <= end; });
}

function renderDashboard() {
  const period = filterByPeriod(allOrders, currentPeriod);
  const valid = period.filter(o => o.estado !== 'cancelado');
  const ingresos = valid.reduce((s, o) => s + Number(o.total), 0);
  $('#kpiIngresos').textContent = fmt(ingresos);
  $('#kpiPedidos').textContent = valid.length;
  $('#kpiClientes').textContent = new Set(valid.map(o => o.cliente_telefono)).size;
  $('#kpiTicket').textContent = valid.length > 0 ? fmt(ingresos / valid.length) : 'S/ 0.00';
  renderChart(valid); renderTopProducts(valid); renderOrders(period);
}

function renderChart(orders) {
  const byDay = {};
  orders.forEach(o => { const k = dayKey(new Date(o.fecha)); byDay[k] = (byDay[k]||0) + Number(o.total); });
  const labels = [], values = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d);
    labels.push(d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })); values.push(byDay[k] || 0);
  }
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart($('#chartDaily'), {
    type: 'line', data: { labels, datasets: [{ label: 'Ingresos', data: values, borderColor: '#1B4D3E', backgroundColor: 'rgba(27,77,62,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointBackgroundColor: '#D9822B' }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => `S/ ${v}` } } } }
  });
}

function renderTopProducts(orders) {
  const counts = {};
  orders.forEach(o => (o.pedido_items || []).forEach(it => { counts[it.producto_nombre] = (counts[it.producto_nombre]||0) + it.cantidad; }));
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,6);
  if (!sorted.length) return $('#topProducts').innerHTML = '<p class="text-muted text-center small mb-0">Sin ventas</p>';
  $('#topProducts').innerHTML = sorted.map(([name, qty], i) => `<div class="top-product-item"><div class="d-flex align-items-center"><span class="rank">${i+1}</span><span>${esc(name)}</span></div><span class="fw-bold">${esc(qty)} u.</span></div>`).join('');
}

async function renderOrders(orders) {
  const negocioIdRender = getNegocioActivoId();
  const search = $('#searchOrders').value.toLowerCase().trim();
  const filtered = search ? orders.filter(o => (o.cliente_nombre || '').toLowerCase().includes(search) || (o.cliente_telefono || '').includes(search)) : orders;
  if (!filtered.length) return $('#ordersTable').innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Sin pedidos</td></tr>';
  const signedUrls = await Promise.all(filtered.map(o => obtenerUrlFirmada(o.comprobante_url)));
  if (getNegocioActivoId() !== negocioIdRender) return;
  $('#ordersTable').innerHTML = filtered.map((o, idx) => {
    const signedHref = safeUrl(signedUrls[idx]);
    return `
    <tr>
      <td><span class="badge bg-dark">#${esc(o.numero_pedido)}</span></td><td><small>${fmtDate(o.fecha)}</small></td><td><strong>${esc(o.cliente_nombre)}</strong></td>
      <td><small>${esc(o.cliente_telefono)}</small></td><td><small>${esc(o.tipo_entrega)}</small></td><td><small>${esc(o.metodo_pago)}</small></td>
      <td class="text-end fw-bold">${fmt(o.total)}</td>
      <td>
        <select class="form-select form-select-sm badge-estado estado-${esc(o.estado)}" data-id="${esc(o.id)}" data-prev="${esc(o.estado)}" style="width: auto; min-width: 100px;">
          <option value="pendiente" ${o.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="aceptado" ${o.estado === 'aceptado' ? 'selected' : ''}>Aceptado</option><option value="en_camino" ${o.estado === 'en_camino' ? 'selected' : ''}>En camino</option><option value="pagado" ${o.estado === 'pagado' ? 'selected' : ''}>Pagado</option>
          <option value="entregado" ${o.estado === 'entregado' ? 'selected' : ''}>Entregado</option><option value="cancelado" ${o.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>${o.estado === 'pendiente' ? `<button type="button" class="btn btn-sm btn-outline-success ms-1 py-1 px-2 btn-accept-order" data-id="${esc(o.id)}" data-num="${esc(o.numero_pedido)}">Aceptar</button>` : (o.estado === 'aceptado' && o.tiempo_estimado_min ? `<small class="text-muted ms-1">(${esc(o.tiempo_estimado_min)} min)</small>` : '')}
      </td>
      <td>${signedHref ? `<a href="${signedHref}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary"><i class="bi bi-image"></i></a>` : '<span class="text-muted">—</span>'}</td>
    </tr>`;
  }).join('');
  $$('#ordersTable .btn-accept-order').forEach(btn => btn.addEventListener('click', () => openAcceptOrderModal(btn.dataset.id, btn.dataset.num)));
  $$('#ordersTable select').forEach(sel => sel.addEventListener('change', async () => {
    const id = sel.dataset.id, newState = sel.value;
    const negocioId = getNegocioActivoId();
    if (!negocioId) { sel.value = sel.dataset.prev; return toast('No hay negocio activo', 'danger'); }
    if (sel.dataset.prev === 'pendiente' && newState === 'aceptado') { sel.value = 'pendiente'; return openAcceptOrderModal(id); }
    sel.disabled = true;
    const { data: updData, error } = await supabaseClient
      .from('pedidos')
      .update({ estado: newState })
      .eq('id', id)
      .eq('negocio_id', negocioId)
      .select('id');

    sel.disabled = false;
    if (error || !updData || updData.length === 0) {
      if (error) console.error(error);
      sel.value = sel.dataset.prev;
      return toast('Error al actualizar el estado', 'danger');
    }
    const order = allOrders.find(o => String(o.id) === String(id)); if (order) order.estado = newState;
    sel.className = `form-select form-select-sm badge-estado estado-${newState}`;
    sel.dataset.prev = newState;
    toast(`Pedido actualizado a ${newState}`); renderDashboard(); renderCaja();
  }));
}

function openAcceptOrderModal(id, num) {
  const order = allOrders.find(o => String(o.id) === String(id));
  $('#acceptOrderId').value = id;
  $('#acceptOrderMinutes').value = '30';
  $('#acceptOrderTitle').textContent = `Aceptar Pedido #${num || (order ? order.numero_pedido : '')}`;
  bootstrap.Modal.getOrCreateInstance($('#acceptOrderModal')).show();
}

if ($('#btnConfirmAcceptOrder')) {
  $('#btnConfirmAcceptOrder').addEventListener('click', async () => {
    const id = $('#acceptOrderId').value;
    const minutos = parseInt($('#acceptOrderMinutes').value, 10);
    const negocioId = getNegocioActivoId();
    if (!id || !minutos || !negocioId) return;
    const btn = $('#btnConfirmAcceptOrder'), orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Aceptando...';
    const ahoraIso = new Date().toISOString();
    const { data, error } = await supabaseClient
      .from('pedidos')
      .update({ estado: 'aceptado', tiempo_estimado_min: minutos, aceptado_en: ahoraIso })
      .eq('id', id)
      .eq('negocio_id', negocioId)
      .eq('estado', 'pendiente')
      .select();

    btn.disabled = false; btn.textContent = orig;
    bootstrap.Modal.getOrCreateInstance($('#acceptOrderModal')).hide();
    if (error) { console.error(error); return toast('Error al aceptar el pedido: ' + esc(error.message), 'danger'); }
    if (!data || data.length === 0) {
      toast('No se pudo aceptar: el pedido ya no está en estado pendiente.', 'warning');
      return loadOrders();
    }
    const order = allOrders.find(o => String(o.id) === String(id));
    if (order) { order.estado = 'aceptado'; order.tiempo_estimado_min = minutos; order.aceptado_en = ahoraIso; }
    toast(`Pedido aceptado (${minutos} min)`);
    renderDashboard(); renderCaja();
  });
}

$$('#periodFilter button').forEach(btn => btn.addEventListener('click', () => { $$('#periodFilter button').forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentPeriod = btn.dataset.period; renderDashboard(); }));
$('#searchOrders').addEventListener('input', () => renderOrders(filterByPeriod(allOrders, currentPeriod)));

$('#btnExportCSV').addEventListener('click', () => {
  const orders = filterByPeriod(allOrders, currentPeriod); if (!orders.length) return toast('Sin datos', 'warning');
  const rows = [['N°','Fecha','Cliente','Teléfono','Entrega','Dirección','Pago','Total','Estado']];
  orders.forEach(o => {
    const fechaLimpia = new Date(o.fecha).toLocaleString('es-PE').replace(',', ''); 
    rows.push([o.numero_pedido, fechaLimpia, o.cliente_nombre, o.cliente_telefono, o.tipo_entrega, o.direccion || '', o.metodo_pago, Number(o.total).toFixed(2), o.estado]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const slug = (window.negocioAdminActual && window.negocioAdminActual.slug) ? window.negocioAdminActual.slug : 'tienda';
  const a = document.createElement('a'); 
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })); 
  a.download = `${slug}-${currentPeriod}-${new Date().toISOString().slice(0,10)}.csv`; 
  a.click(); 
  toast('CSV descargado correctamente');
});

// =============================================================================
// GESTIÓN DE PRODUCTOS (CRUD AISLADO POR negocio_id)
// =============================================================================
async function loadProducts() {
  if (cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false) return;
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('productos')
    .select('*')
    .eq('negocio_id', negocioId)
    .order('nombre');

  if (getNegocioActivoId() !== negocioId) return;

  if (error) {
    console.error(error);
    allProducts = [];
    sincronizarCategoriasAdmin();
    renderAdminProducts();
    actualizarSugerenciasPOS();
    toast('Error cargando productos', 'danger');
    return;
  }

  allProducts = (data || []).filter(p => String(p.negocio_id || '') === negocioId);
  sincronizarCategoriasAdmin();
  renderAdminProducts();
  actualizarSugerenciasPOS();
}

function renderAdminProducts() {
  const filtered = currentAdminCategory === 'Todos' ? allProducts : allProducts.filter(p => p.categoria === currentAdminCategory);
  if (!filtered.length) { $('#productsTable').innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No hay productos en esta categoría.</td></tr>'; return; }
  $('#productsTable').innerHTML = filtered.map(p => {
    const stockVal = Number(p.stock ?? 0);
    const stockBadge = stockVal <= 0
      ? '<span class="badge bg-danger"><i class="bi bi-exclamation-triangle me-1"></i>Sin stock (0)</span>'
      : (stockVal <= 5
        ? `<span class="badge bg-warning text-dark">${esc(stockVal)} u.</span>`
        : `<span class="badge bg-success">${esc(stockVal)} u.</span>`);
    const qrHtml = p.codigo_qr
      ? `<code class="small bg-light px-2 py-1 rounded border text-dark">${esc(p.codigo_qr)}</code>`
      : '<span class="text-muted small">—</span>';
    const imgSrc = safeUrl(p.imagen_url) || 'https://via.placeholder.com/50';
    return `
    <tr>
      <td><img src="${imgSrc}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;"></td>
      <td><strong>${esc(p.nombre)}</strong></td>
      <td>${fmt(p.precio)}</td>
      <td>${stockBadge}</td>
      <td>${qrHtml}</td>
      <td><span class="badge bg-secondary">${esc(p.categoria)}</span></td>
      <td>
        <div class="d-inline-flex gap-1 flex-nowrap">
          <button type="button" class="btn btn-sm btn-outline-success" onclick="abrirModalLotes('${esc(p.id)}')" title="Lotes / Ingreso"><i class="bi bi-boxes me-1"></i>Lotes / Ingreso</button>
          <button type="button" class="btn btn-sm btn-outline-primary" onclick="editProduct('${esc(p.id)}')" title="Editar"><i class="bi bi-pencil"></i></button>
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${esc(p.id)}')" title="Eliminar"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

if ($('#adminCategoryFilter')) {
  $('#adminCategoryFilter').addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('button[data-filter]') : null;
    if (!btn) return;
    $$('#adminCategoryFilter button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAdminCategory = btn.dataset.filter;
    renderAdminProducts();
  });
}

window.clearForm = () => {
  editingProduct = null;
  modalProductoDesdePOS = false;
  pendingPosModalFocusId = null;
  sincronizarCategoriasAdmin();
  $('#pId').value = ''; $('#pNombre').value = ''; $('#pDesc').value = ''; $('#pPrecio').value = '';
  if ($('#pCat') && $('#pCat').options.length > 0) $('#pCat').selectedIndex = 0;
  if ($('#pCodigoQR')) $('#pCodigoQR').value = '';
  if ($('#pImagenUrlExterna')) $('#pImagenUrlExterna').value = '';
  if ($('#pStockInfo')) {
    $('#pStockInfo').innerHTML = '<i class="bi bi-info-circle me-1"></i>El producto se creará con stock <strong>0</strong>. Luego podrás ingresar lotes desde el botón <strong>Lotes / Ingreso</strong>.';
  }
  $('#pImagen').value = '';
  $('#pPreview').removeAttribute('src');
  $('#pPreview').style.display = 'none';
  $('#modalTitle').textContent = 'Nuevo Producto';
};

window.editProduct = (id) => {
  const negocioId = getNegocioActivoId();
  if (!negocioId) return toast('No hay negocio activo', 'danger');
  const p = allProducts.find(x => String(x.id) === String(id) && String(x.negocio_id || '') === negocioId);
  if (!p) return toast('Producto no encontrado', 'warning');
  editingProduct = p;
  modalProductoDesdePOS = false;
  pendingPosModalFocusId = null;
  sincronizarCategoriasAdmin(p.categoria);
  $('#pId').value = p.id; $('#pNombre').value = p.nombre; $('#pDesc').value = p.descripcion || ''; $('#pPrecio').value = p.precio; $('#pCat').value = p.categoria; $('#pImagen').value = '';
  if ($('#pCodigoQR')) $('#pCodigoQR').value = p.codigo_qr || '';
  if ($('#pImagenUrlExterna')) $('#pImagenUrlExterna').value = '';
  if ($('#pStockInfo')) {
    $('#pStockInfo').innerHTML = `<i class="bi bi-boxes me-1"></i>El stock se gestiona desde el botón <strong>Lotes</strong> (Stock actual: <strong>${esc(p.stock ?? 0)} u.</strong>).`;
  }
  if (p.imagen_url) { $('#pPreview').src = p.imagen_url; $('#pPreview').style.display = 'block'; }
  else { $('#pPreview').removeAttribute('src'); $('#pPreview').style.display = 'none'; }
  $('#modalTitle').textContent = 'Editar Producto'; bootstrap.Modal.getOrCreateInstance($('#productModal')).show();
};

function generarCodigoQRUnico() {
  const existentes = new Set(allProducts.map(p => String(p.codigo_qr || '').trim().toUpperCase()));
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let intento = 0; intento < 50; intento++) {
    let sufijo = '';
    for (let i = 0; i < 4; i++) sufijo += chars[Math.floor(Math.random() * chars.length)];
    const candidato = `PROD-${sufijo}`;
    if (!existentes.has(candidato)) return candidato;
  }
  return `PROD-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

if ($('#btnGenerarQR')) {
  $('#btnGenerarQR').addEventListener('click', () => {
    if ($('#pCodigoQR')) {
      $('#pCodigoQR').value = generarCodigoQRUnico();
    }
  });
}

window.deleteProduct = async (id) => {
  if (!confirm('¿Eliminar producto?')) return;
  const negocioId = getNegocioActivoId();
  if (!negocioId) return toast('Error: No hay negocio activo', 'danger');
  const { data: delRows, error } = await supabaseClient
    .from('productos')
    .delete()
    .eq('id', id)
    .eq('negocio_id', negocioId)
    .select('id');

  if (error) { console.error(error); return toast('No se pudo eliminar: ' + esc(error.message), 'danger'); }
  if (!delRows || delRows.length === 0) return toast('No se encontró el producto en este negocio', 'warning');
  loadProducts(); toast('Producto eliminado');
};

$('#pImagen').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) { const reader = new FileReader(); reader.onload = (ev) => { $('#pPreview').src = ev.target.result; $('#pPreview').style.display = 'block'; }; reader.readAsDataURL(file); }
});

$('#btnSaveProduct').addEventListener('click', async () => {
  const negocioId = getNegocioActivoId();
  if (!negocioId) return alert('No hay sesión de negocio activa.');
  if (editingProduct && editingProduct.negocio_id && String(editingProduct.negocio_id) !== negocioId) {
    return alert('El producto no pertenece al negocio activo.');
  }
  const id = $('#pId').value, nombre = $('#pNombre').value.trim(), desc = $('#pDesc').value.trim();
  const precio = parseFloat($('#pPrecio').value), cat = $('#pCat').value, file = $('#pImagen').files[0];
  const codigo_qr = $('#pCodigoQR') ? ($('#pCodigoQR').value.trim() || null) : null;
  const urlExterna = $('#pImagenUrlExterna') ? $('#pImagenUrlExterna').value.trim() : '';
  if (!nombre || isNaN(precio) || precio < 0) return alert('Nombre y precio válidos obligatorios');
  const btn = $('#btnSaveProduct'); btn.textContent = 'Guardando...'; btn.disabled = true;
  let imagen_url = editingProduct
    ? editingProduct.imagen_url
    : (/^https:\/\//i.test(urlExterna) ? urlExterna : null);
  try {
    if (file) {
      const path = `${negocioId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const { error: err } = await supabaseClient.storage.from('productos').upload(path, file);
      if (err) throw err;
      const { data } = supabaseClient.storage.from('productos').getPublicUrl(path);
      imagen_url = data.publicUrl;
    }
    const payload = { 
      nombre, 
      descripcion: desc, 
      precio, 
      codigo_qr,
      categoria: cat, 
      imagen_url,
      negocio_id: negocioId 
    };
    // Productos nuevos inician con stock 0 (el stock se incrementa vía Lotes)
    if (!id) {
      payload.stock = 0;
    }

    const { data: savedRows, error: dbErr } = id 
      ? await supabaseClient.from('productos').update(payload).eq('id', id).eq('negocio_id', negocioId).select() 
      : await supabaseClient.from('productos').insert(payload).select();

    if (dbErr) {
      if (dbErr.code === '23505') {
        throw new Error('Ya existe otro producto con ese código QR en tu negocio.');
      }
      throw dbErr;
    }

    const creadoDesdePOS = modalProductoDesdePOS && !id;
    const productoGuardado = (savedRows && savedRows[0]) || { ...payload };
    modalProductoDesdePOS = false;
    pendingPosModalFocusId = null;

    const modalInst = bootstrap.Modal.getInstance($('#productModal')) || bootstrap.Modal.getOrCreateInstance($('#productModal'));
    modalInst.hide();

    await loadProducts();
    toast('Producto guardado ✅');

    // Hook post-guardado POS: agregar 1 unidad al carrito físico si tiene stock > 0 y reactivar escáner
    if (creadoDesdePOS) {
      const productoParaCarrito = allProducts.find(p => String(p.id) === String(productoGuardado.id))
        || (codigo_qr ? allProducts.find(p => String(p.codigo_qr || '') === String(codigo_qr)) : null)
        || productoGuardado;

      if (productoParaCarrito && productoParaCarrito.id) {
        if (Number(productoParaCarrito.stock ?? 0) > 0) {
          agregarProductoAlCarritoPOS(productoParaCarrito, true);
        } else {
          toast(`"${esc(productoParaCarrito.nombre)}" guardado con stock 0. Ingresa un lote desde Productos → Lotes / Ingreso para venderlo.`, 'warning');
        }
      }
      if ($('#posManualInput')) $('#posManualInput').value = '';
      await reanudarEscanerPOS();
    }
  } catch (error) { alert("Error al guardar: " + error.message); } finally { btn.textContent = 'Guardar'; btn.disabled = false; }
});

// =============================================================================
// LÓGICA DE CIERRE DE CAJA
// =============================================================================
async function renderCaja() {
  const orders = filterByPeriod(allOrders, currentCajaPeriod);
  const validOrders = orders.filter(o => o.estado !== 'cancelado');

  let totalEfectivo = 0, countEfectivo = 0;
  let totalYape = 0, countYape = 0;
  let totalBanco = 0, countBanco = 0;

  validOrders.forEach(o => {
    const monto = Number(o.total);
    const metodo = o.metodo_pago.toLowerCase();

    if (metodo.includes('contra entrega') || metodo.includes('efectivo')) {
      totalEfectivo += monto; countEfectivo++;
    } else if (metodo.includes('yape') || metodo.includes('plin')) {
      totalYape += monto; countYape++;
    } else if (metodo.includes('bcp') || metodo.includes('bbva') || metodo.includes('transferencia') || metodo.includes('tarjeta')) {
      totalBanco += monto; countBanco++;
    }
  });

  $('#cajaEfectivo').textContent = fmt(totalEfectivo);
  $('#cajaEfectivoCount').textContent = `${countEfectivo} pedidos`;
  $('#cajaYape').textContent = fmt(totalYape);
  $('#cajaYapeCount').textContent = `${countYape} pedidos`;
  $('#cajaBanco').textContent = fmt(totalBanco);
  $('#cajaBancoCount').textContent = `${countBanco} pedidos`;

  const elDigital = document.getElementById('cajaTotalDigital');
  if (elDigital) elDigital.textContent = fmt(totalYape + totalBanco);

  if (!validOrders.length) {
    $('#cajaTableBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay movimientos en este período.</td></tr>';
    return;
  }

  const sorted = [...validOrders].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  const negocioIdRender = getNegocioActivoId();
  const signedUrls = await Promise.all(sorted.map(o => obtenerUrlFirmada(o.comprobante_url)));
  if (getNegocioActivoId() !== negocioIdRender) return;

  $('#cajaTableBody').innerHTML = sorted.map((o, idx) => {
    const hora = new Date(o.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const signedHref = safeUrl(signedUrls[idx]);
    return `
      <tr>
        <td><span class="badge bg-dark">#${esc(o.numero_pedido)}</span></td>
        <td>${hora}</td>
        <td>${esc(o.cliente_nombre)}</td>
        <td><span class="badge bg-secondary">${esc(o.metodo_pago)}</span></td>
        <td class="text-end fw-bold">${fmt(o.total)}</td>
        <td class="text-center">
          ${signedHref ? `<a href="${signedHref}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary"><i class="bi bi-image"></i></a>` : '<span class="text-muted small">Sin foto</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

$$('#cajaPeriodFilter button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('#cajaPeriodFilter button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCajaPeriod = btn.dataset.period;
    renderCaja();
  });
});

// =============================================================================
// FUNCIÓN PARA IMPRIMIR EL CIERRE DE CAJA (BOUCHER)
// =============================================================================
function imprimirCierreCaja() {
  if (!getNegocioActivoId()) return toast('No hay negocio activo', 'danger');
  const orders = filterByPeriod(allOrders, currentCajaPeriod);
  const validOrders = orders.filter(o => o.estado !== 'cancelado');

  let totalEfectivo = 0, countEfectivo = 0;
  let totalYape = 0, countYape = 0;
  let totalBanco = 0, countBanco = 0;
  let totalGeneral = 0;

  validOrders.forEach(o => {
    const monto = Number(o.total);
    const metodo = o.metodo_pago.toLowerCase();
    totalGeneral += monto;

    if (metodo.includes('contra entrega') || metodo.includes('efectivo')) {
      totalEfectivo += monto; countEfectivo++;
    } else if (metodo.includes('yape') || metodo.includes('plin')) {
      totalYape += monto; countYape++;
    } else if (metodo.includes('bcp') || metodo.includes('bbva') || metodo.includes('transferencia') || metodo.includes('tarjeta')) {
      totalBanco += monto; countBanco++;
    }
  });

  // Formatear el texto del período
  let textoPeriodo = 'Hoy';
  if (currentCajaPeriod === 'semana') textoPeriodo = 'Esta Semana';
  if (currentCajaPeriod === 'mes') textoPeriodo = 'Este Mes';
  const fechaActual = new Date().toLocaleString('es-PE');
  const nombreNegocio = (window.negocioAdminActual && window.negocioAdminActual.nombre)
    ? String(window.negocioAdminActual.nombre).trim()
    : 'Mi Negocio';

  // Construir el HTML del boucher
  const ventanaImpresion = window.open('', '_blank');
  if (!ventanaImpresion) return toast('Permite ventanas emergentes para imprimir el cierre', 'warning');
  ventanaImpresion.document.write(`
    <html>
      <head>
        <title>Cierre de Caja - ${esc(nombreNegocio)}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 400px; margin: auto; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header h2 { margin: 0; font-size: 18px; }
          .header p { margin: 5px 0; font-size: 12px; }
          .info { font-size: 12px; margin-bottom: 15px; }
          .box { border: 1px solid #000; padding: 10px; margin-bottom: 10px; font-size: 12px; }
          .box h4 { margin: 0 0 5px 0; font-size: 13px; }
          .total-general { font-size: 16px; font-weight: bold; text-align: right; border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
          .total-digital { font-size: 14px; font-weight: bold; text-align: right; margin-top: 5px; color: #198754; }
          table { width: 100%; font-size: 10px; border-collapse: collapse; margin-top: 10px; }
          th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 3px; }
          td { padding: 3px 0; }
          .footer { text-align: center; font-size: 10px; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${esc(nombreNegocio.toUpperCase())}</h2>
          <p>CIERRE DE CAJA</p>
        </div>
        
        <div class="info">
          <strong>Fecha de Emisión:</strong> ${fechaActual}<br>
          <strong>Período:</strong> ${textoPeriodo}<br>
          <strong>Total Pedidos Válidos:</strong> ${validOrders.length}
        </div>

        <div class="box">
          <h4>💵 EFECTIVO (Contra entrega)</h4>
          <div>Pedidos: ${countEfectivo}</div>
          <div><strong>Total: S/ ${totalEfectivo.toFixed(2)}</strong></div>
        </div>

        <div class="box">
          <h4>📱 YAPE / PLIN</h4>
          <div>Pedidos: ${countYape}</div>
          <div><strong>Total: S/ ${totalYape.toFixed(2)}</strong></div>
        </div>

        <div class="box">
          <h4>🏦 TRANSFERENCIAS (BCP / BBVA)</h4>
          <div>Pedidos: ${countBanco}</div>
          <div><strong>Total: S/ ${totalBanco.toFixed(2)}</strong></div>
        </div>

        <div class="total-general">
          TOTAL GENERAL: S/ ${totalGeneral.toFixed(2)}
        </div>

        <div class="total-digital">
          TOTAL DIGITAL (Yape + Banco): S/ ${(totalYape + totalBanco).toFixed(2)}
        </div>

        <table>
          <tr><th>Pedido</th><th>Hora</th><th>Monto</th></tr>
          ${validOrders.map(o => {
            const hora = new Date(o.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
            return `<tr><td>#${o.numero_pedido}</td><td>${hora}</td><td>S/ ${Number(o.total).toFixed(2)}</td></tr>`;
          }).join('')}
        </table>

        <div class="footer">
          Generado por el Sistema de ${esc(nombreNegocio)}<br>
          ¡Gracias por su trabajo hoy!
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);
  ventanaImpresion.document.close();
}

// =============================================================================
// MÓDULO POS FÍSICO, ESCÁNER QR Y VALIDACIÓN DE STOCK
// =============================================================================
function setEstadoEscanerPOS(mensaje, alertTipo = 'secondary', badgeTexto = null, badgeClase = 'bg-secondary') {
  const statusEl = $('#posScannerStatus');
  if (statusEl) {
    statusEl.className = `alert alert-${alertTipo} small py-2 mb-3`;
    statusEl.textContent = mensaje;
  }
  const badgeEl = $('#posScannerBadge');
  if (badgeEl && badgeTexto) {
    badgeEl.className = `badge ${badgeClase} rounded-pill px-3 py-2`;
    badgeEl.textContent = badgeTexto;
  }
}

function actualizarSugerenciasPOS() {
  const datalist = $('#posProductSuggestions');
  if (!datalist) return;
  datalist.innerHTML = allProducts
    .map(p => {
      const qrOpt = p.codigo_qr ? `<option value="${esc(p.codigo_qr)}">${esc(p.nombre)} (Stock: ${esc(p.stock ?? 0)})</option>` : '';
      const nomOpt = `<option value="${esc(p.nombre)}">${p.codigo_qr ? esc(p.codigo_qr) + ' · ' : ''}Stock: ${esc(p.stock ?? 0)}</option>`;
      return qrOpt + nomOpt;
    })
    .join('');
}

function reproducirBeepPOS() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!posAudioCtx) posAudioCtx = new AudioCtx();
    if (posAudioCtx.state === 'suspended') {
      posAudioCtx.resume();
    }
    const ahora = posAudioCtx.currentTime;
    const osc = posAudioCtx.createOscillator();
    const gain = posAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ahora);
    gain.gain.setValueAtTime(0.15, ahora);
    gain.gain.exponentialRampToValueAtTime(0.001, ahora + 0.12);
    osc.connect(gain);
    gain.connect(posAudioCtx.destination);
    osc.start(ahora);
    osc.stop(ahora + 0.12);
  } catch (e) {
    console.warn('No se pudo reproducir beep:', e);
  }
}

function crearInstanciaEscanerPOS() {
  if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
    const formatos = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128
    ].filter(f => f !== undefined);

    if (formatos.length > 0) {
      return new Html5Qrcode('reader', { formatsToSupport: formatos, verbose: false });
    }
  }
  return new Html5Qrcode('reader');
}

async function iniciarEscanerPOS() {
  if (escanerActivo || escanerTransicionando) return;
  if (typeof Html5Qrcode === 'undefined') {
    setEstadoEscanerPOS(
      'No se pudo cargar la librería de escáner QR/barras. Usa el ingreso manual como respaldo.',
      'warning',
      'Escáner no disponible',
      'bg-warning text-dark'
    );
    return;
  }

  escanerTransicionando = true;
  setEstadoEscanerPOS('Solicitando permiso de cámara trasera...', 'info', 'Iniciando...', 'bg-info text-dark');

  try {
    if (!html5QrCode) {
      html5QrCode = crearInstanciaEscanerPOS();
    }

    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 180 } },
      onPosScanSuccess,
      () => {}
    );

    escanerActivo = true;
    camaraPausadaPorModal = false;
    setEstadoEscanerPOS(
      'Cámara activa. Apunta un código QR o código de barras dentro del recuadro.',
      'success',
      'Escáner activo',
      'bg-success'
    );

    // Si el usuario cambió de pestaña mientras esperaba permisos, liberar el hardware
    const tabPos = $('#tabPOS');
    if (tabPos && tabPos.classList.contains('d-none')) {
      escanerTransicionando = false;
      await detenerEscanerPOS();
      return;
    }
  } catch (err) {
    escanerActivo = false;
    camaraPausadaPorModal = false;
    const errMsg = String(err?.message || err || '');
    const errName = String(err?.name || '');
    let detalle = 'No se pudo iniciar la cámara. Usa el ingreso manual como respaldo.';
    if (/NotAllowedError|Permission/i.test(errName + ' ' + errMsg)) {
      detalle = 'Permiso de cámara denegado. Habilítalo en tu navegador o usa el ingreso manual.';
    } else if (/NotFoundError|OverconstrainedError|Requested device not found/i.test(errName + ' ' + errMsg)) {
      detalle = 'No se encontró cámara disponible en este dispositivo. Usa el ingreso manual.';
    }
    console.warn('Error al iniciar cámara POS:', err);
    setEstadoEscanerPOS(detalle, 'warning', 'Sin cámara', 'bg-warning text-dark');
  } finally {
    escanerTransicionando = false;
  }
}

async function detenerEscanerPOS() {
  posLookupEnCurso = false;
  camaraPausadaPorModal = false;
  modalProductoDesdePOS = false;
  pendingPosModalFocusId = null;
  mostrarLoaderCatalogoGlobalPOS(false);
  if (!html5QrCode || !escanerActivo) return;
  escanerTransicionando = true;
  try {
    await html5QrCode.stop();
    try { html5QrCode.clear(); } catch (_) {}
  } catch (err) {
    console.warn('Error al detener la cámara POS:', err);
  } finally {
    escanerActivo = false;
    escanerTransicionando = false;
    setEstadoEscanerPOS('Cámara detenida al salir del POS.', 'secondary', 'Cámara inactiva', 'bg-secondary');
  }
}

function pausarEscanerPOS() {
  if (!html5QrCode || !escanerActivo || camaraPausadaPorModal) return;
  try {
    if (typeof html5QrCode.pause === 'function') {
      html5QrCode.pause(true);
    }
    camaraPausadaPorModal = true;
    setEstadoEscanerPOS('Escáner pausado mientras completas el registro...', 'info', 'En pausa', 'bg-info text-dark');
  } catch (err) {
    console.warn('No se pudo pausar el escáner POS:', err);
    camaraPausadaPorModal = true;
  }
}

async function reanudarEscanerPOS() {
  if (!camaraPausadaPorModal) return;
  camaraPausadaPorModal = false;

  const tabPos = $('#tabPOS');
  if (!html5QrCode || !escanerActivo || !tabPos || tabPos.classList.contains('d-none')) {
    return;
  }

  try {
    if (typeof html5QrCode.resume === 'function') {
      html5QrCode.resume();
    }
    setEstadoEscanerPOS(
      'Cámara activa. Apunta un código QR o código de barras dentro del recuadro.',
      'success',
      'Escáner activo',
      'bg-success'
    );
  } catch (err) {
    console.warn('No se pudo reanudar el escáner POS:', err);
  }
}

function mostrarLoaderCatalogoGlobalPOS(visible) {
  const loader = $('#posLookupLoader');
  if (!loader) return;
  if (visible) {
    loader.classList.remove('d-none');
    loader.classList.add('d-flex');
  } else {
    loader.classList.add('d-none');
    loader.classList.remove('d-flex');
  }
}

function normalizarTextoComparacionPOS(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatearNombreOpenFoodFacts(product) {
  if (!product) return '';
  const nombreBase = String(product.product_name_es || product.product_name || '').trim();
  const marcaRaw = String(product.brands || '')
    .split(',')
    .map(b => b.trim())
    .find(Boolean) || '';

  if (!nombreBase) return marcaRaw;
  if (!marcaRaw) return nombreBase;

  const nombreNorm = normalizarTextoComparacionPOS(nombreBase);
  const marcaNorm = normalizarTextoComparacionPOS(marcaRaw);
  if (!marcaNorm) return nombreBase;

  if (nombreNorm.includes(marcaNorm)) return nombreBase;

  const palabrasNombre = new Set(nombreNorm.split(' ').filter(Boolean));
  const palabrasMarca = marcaNorm.split(' ').filter(w => w.length >= 2);
  if (palabrasMarca.length > 0 && palabrasMarca.every(w => palabrasNombre.has(w))) {
    return nombreBase;
  }

  return `${nombreBase} - ${marcaRaw}`;
}

async function buscarEnCatalogoGlobalPOS(codigo) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(codigo)}.json`;
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!resp.ok) return { encontrado: false, errorRed: true, nombre: '', imagenUrl: '' };

    const data = await resp.json();
    if (data && data.status === 1 && data.product) {
      const nombre = formatearNombreOpenFoodFacts(data.product);
      const rawImg = String(data.product.image_front_url || data.product.image_url || '').trim();
      const imagenUrl = /^https:\/\//i.test(rawImg)
        ? rawImg
        : (/^http:\/\//i.test(rawImg) ? rawImg.replace(/^http:\/\//i, 'https://') : '');

      if (nombre || imagenUrl) {
        return { encontrado: true, errorRed: false, nombre: nombre || codigo, imagenUrl };
      }
    }
    return { encontrado: false, errorRed: false, nombre: '', imagenUrl: '' };
  } catch (err) {
    console.warn('Error o timeout consultando Open Food Facts:', err);
    return { encontrado: false, errorRed: true, nombre: '', imagenUrl: '' };
  } finally {
    clearTimeout(timeoutId);
  }
}

function confirmarRegistroGlobalPOS({ codigo, encontrado, nombre, imagenUrl }) {
  const modalEl = $('#posGlobalLookupModal');
  if (!modalEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
    const msg = encontrado
      ? `Producto detectado en catálogo global: "${nombre}". ¿Deseas agregarlo a tu inventario?`
      : `El código "${codigo}" no existe en tu inventario ni en el catálogo global. ¿Deseas registrarlo desde cero?`;
    return Promise.resolve(confirm(msg));
  }

  const titleEl = $('#posLookupModalTitle');
  const msgEl = $('#posLookupMessage');
  const codeEl = $('#posLookupCodeBadge');
  const imgEl = $('#posLookupImg');
  const btnConfirm = $('#btnPosLookupConfirm');
  const btnCancel = $('#btnPosLookupCancel');
  const btnClose = $('#btnPosLookupClose');

  if (titleEl) {
    titleEl.innerHTML = encontrado
      ? '<i class="bi bi-globe2 me-2 text-info"></i>Producto detectado en catálogo global'
      : '<i class="bi bi-upc-scan me-2 text-warning"></i>Producto no registrado';
  }
  if (msgEl) {
    msgEl.innerHTML = encontrado
      ? `Producto detectado en catálogo global: <strong>${esc(nombre)}</strong>. ¿Deseas agregarlo a tu inventario?`
      : `El código <strong>${esc(codigo)}</strong> no existe en tu inventario ni en el catálogo global. ¿Deseas registrarlo desde cero?`;
  }
  if (codeEl) codeEl.textContent = `Código: ${codigo}`;
  if (imgEl) {
    if (imagenUrl && /^https:\/\//i.test(imagenUrl)) {
      imgEl.src = imagenUrl;
      imgEl.classList.remove('d-none');
    } else {
      imgEl.removeAttribute('src');
      imgEl.classList.add('d-none');
    }
  }
  if (btnConfirm) {
    btnConfirm.className = encontrado ? 'btn btn-sm btn-success fw-bold' : 'btn btn-sm btn-primary fw-bold';
    btnConfirm.textContent = encontrado ? 'Agregar al inventario' : 'Registrar desde cero';
  }

  return new Promise((resolve) => {
    let resuelto = false;
    let aceptado = false;
    const modalInst = bootstrap.Modal.getOrCreateInstance(modalEl);

    const cleanup = () => {
      if (btnConfirm) btnConfirm.removeEventListener('click', onConfirm);
      if (btnCancel) btnCancel.removeEventListener('click', onCancel);
      if (btnClose) btnClose.removeEventListener('click', onCancel);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
    };

    const finish = (ok) => {
      if (resuelto) return;
      resuelto = true;
      cleanup();
      resolve(ok);
    };

    const onConfirm = () => {
      aceptado = true;
      modalInst.hide();
    };
    const onCancel = () => {
      aceptado = false;
      modalInst.hide();
    };
    const onHidden = () => {
      finish(aceptado);
    };

    if (btnConfirm) btnConfirm.addEventListener('click', onConfirm);
    if (btnCancel) btnCancel.addEventListener('click', onCancel);
    if (btnClose) btnClose.addEventListener('click', onCancel);
    modalEl.addEventListener('hidden.bs.modal', onHidden);

    modalInst.show();
  });
}

function abrirModalProductoDesdePOS({ codigo_qr, nombre, imagen_url }) {
  clearForm();
  modalProductoDesdePOS = true;

  if ($('#pCodigoQR')) $('#pCodigoQR').value = codigo_qr || '';
  if ($('#pNombre')) $('#pNombre').value = nombre || '';

  if (imagen_url && /^https:\/\//i.test(imagen_url)) {
    if ($('#pImagenUrlExterna')) $('#pImagenUrlExterna').value = imagen_url;
    if ($('#pPreview')) {
      $('#pPreview').src = imagen_url;
      $('#pPreview').style.display = 'block';
    }
  }

  if ($('#modalTitle')) {
    $('#modalTitle').textContent = nombre ? 'Nuevo Producto (Catálogo Global)' : 'Nuevo Producto (POS)';
  }

  pendingPosModalFocusId = nombre ? '#pPrecio' : '#pNombre';
  const modalEl = $('#productModal');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

async function manejarCodigoNoEncontradoEnPOS(codigo) {
  const codigoLimpio = String(codigo || '').trim();
  if (!codigoLimpio || posLookupEnCurso) return;

  posLookupEnCurso = true;
  pausarEscanerPOS();
  mostrarLoaderCatalogoGlobalPOS(true);

  let resultadoGlobal = { encontrado: false, errorRed: false, nombre: '', imagenUrl: '' };
  try {
    resultadoGlobal = await buscarEnCatalogoGlobalPOS(codigoLimpio);
  } finally {
    mostrarLoaderCatalogoGlobalPOS(false);
  }

  const aceptaRegistrar = await confirmarRegistroGlobalPOS({
    codigo: codigoLimpio,
    encontrado: resultadoGlobal.encontrado,
    nombre: resultadoGlobal.nombre || '',
    imagenUrl: resultadoGlobal.imagenUrl || ''
  });

  posLookupEnCurso = false;

  if (!aceptaRegistrar) {
    await reanudarEscanerPOS();
    return;
  }

  abrirModalProductoDesdePOS({
    codigo_qr: codigoLimpio,
    nombre: resultadoGlobal.encontrado ? resultadoGlobal.nombre : '',
    imagen_url: resultadoGlobal.encontrado ? resultadoGlobal.imagenUrl : ''
  });
}

async function onPosScanSuccess(decodedText) {
  if (posLookupEnCurso || camaraPausadaPorModal || modalProductoDesdePOS) return;
  const codigo = String(decodedText || '').trim();
  if (!codigo) return;

  // Anti-rebote: cooldown de 1.8 segundos por código escaneado
  const ahora = Date.now();
  const ultimoEscaneo = posScanCooldowns.get(codigo) || 0;
  if (ahora - ultimoEscaneo < POS_SCAN_COOLDOWN_MS) return;
  posScanCooldowns.set(codigo, ahora);

  await buscarYAgregarPorCodigoQR(codigo);
}

async function buscarYAgregarPorCodigoQR(codigoEscaneado) {
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return;
  const codigoLimpio = String(codigoEscaneado || '').trim();
  if (!codigoLimpio) return;

  const { data: producto, error } = await supabaseClient
    .from('productos')
    .select('*')
    .eq('codigo_qr', codigoLimpio)
    .eq('negocio_id', negocioId)
    .maybeSingle();

  if (getNegocioActivoId() !== negocioId) return;

  if (error) {
    console.error('Error buscando producto QR:', error);
    toast('Error al consultar producto en Supabase', 'danger');
    return;
  }

  if (!producto || String(producto.negocio_id || '') !== negocioId) {
    await manejarCodigoNoEncontradoEnPOS(codigoLimpio);
    return;
  }

  agregarProductoAlCarritoPOS(producto, true);
}

async function manejarIngresoManualPOS(e) {
  e.preventDefault();
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return toast('No hay negocio activo', 'danger');

  const inputEl = $('#posManualInput');
  const termino = inputEl ? inputEl.value.trim() : '';
  if (!termino) return;

  try {
    // 1. Buscar primero por coincidencia exacta de codigo_qr en este negocio
    const { data: porQr, error: qrErr } = await supabaseClient
      .from('productos')
      .select('*')
      .eq('codigo_qr', termino)
      .eq('negocio_id', negocioId)
      .maybeSingle();

    if (qrErr) throw qrErr;
    if (getNegocioActivoId() !== negocioId) return;

    let productoSeleccionado = (porQr && String(porQr.negocio_id || '') === negocioId) ? porQr : null;

    // 2. Si no coincide por codigo_qr, buscar por nombre en este negocio
    if (!productoSeleccionado) {
      const patron = termino.replace(/[\\%_]/g, '\\$&');
      const { data: porNombre, error: nomErr } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('negocio_id', negocioId)
        .ilike('nombre', `%${patron}%`)
        .order('nombre')
        .limit(10);

      if (nomErr) throw nomErr;
      if (getNegocioActivoId() !== negocioId) return;

      const filtrados = (porNombre || []).filter(p => String(p.negocio_id || '') === negocioId);
      if (filtrados.length > 0) {
        const exacto = filtrados.find(p => p.nombre.trim().toLowerCase() === termino.toLowerCase());
        if (exacto) {
          productoSeleccionado = exacto;
        } else if (filtrados.length === 1) {
          productoSeleccionado = filtrados[0];
        } else {
          toast(`Varios productos coinciden con "${esc(termino)}". Selecciona uno exacto o usa su QR.`, 'warning');
          return;
        }
      }
    }

    if (!productoSeleccionado) {
      await manejarCodigoNoEncontradoEnPOS(termino);
      return;
    }

    const agregado = agregarProductoAlCarritoPOS(productoSeleccionado, true);
    if (agregado && inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
  } catch (err) {
    console.error('Error en búsqueda manual POS:', err);
    toast('Error al buscar producto', 'danger');
  }
}

function obtenerStockDisponiblePOS(producto) {
  const enLista = allProducts.find(p => String(p.id) === String(producto.id));
  return Number((enLista ? enLista.stock : producto.stock) ?? 0);
}

function agregarProductoAlCarritoPOS(producto, conBeep = true) {
  const stockDisponible = Number(producto.stock ?? 0);
  const existente = posCart.find(i => String(i.id) === String(producto.id));
  const cantidadEnCarrito = existente ? existente.cantidad : 0;

  if ((cantidadEnCarrito + 1) > stockDisponible) {
    toast(`Stock insuficiente para "${esc(producto.nombre)}" (Disponible: ${stockDisponible})`, 'warning');
    return false;
  }

  if (existente) {
    existente.cantidad += 1;
    existente.stock = stockDisponible;
    existente.precio = Number(producto.precio);
  } else {
    posCart.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      cantidad: 1,
      stock: stockDisponible,
      codigo_qr: producto.codigo_qr || ''
    });
  }

  if (conBeep) reproducirBeepPOS();
  renderPosCart();
  toast(`+1 ${esc(producto.nombre)}`, 'success');
  return true;
}

function cambiarCantidadPOS(id, delta) {
  const idx = posCart.findIndex(i => String(i.id) === String(id));
  if (idx === -1) return;

  const item = posCart[idx];
  const nuevaCantidad = item.cantidad + delta;

  if (nuevaCantidad <= 0) {
    posCart.splice(idx, 1);
    renderPosCart();
    return;
  }

  const stockDisponible = obtenerStockDisponiblePOS(item);
  if (nuevaCantidad > stockDisponible) {
    toast(`Stock insuficiente para "${esc(item.nombre)}" (Disponible: ${stockDisponible})`, 'warning');
    return;
  }

  item.cantidad = nuevaCantidad;
  item.stock = stockDisponible;
  renderPosCart();
}

function eliminarItemPOS(id) {
  posCart = posCart.filter(i => String(i.id) !== String(id));
  renderPosCart();
}

function renderPosCart() {
  const tbody = $('#posCartBody');
  const totalEl = $('#posTotal');
  const btnCheckout = $('#btnPosCheckout');
  if (!tbody || !totalEl || !btnCheckout) return;

  if (!posCart.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">Escanea un producto o agrégalo manualmente para iniciar la venta.</td></tr>';
    totalEl.textContent = fmt(0);
    btnCheckout.disabled = true;
    return;
  }

  const total = posCart.reduce((sum, i) => sum + (Number(i.precio) * Number(i.cantidad)), 0);

  tbody.innerHTML = posCart.map(item => `
    <tr>
      <td>
        <div class="fw-bold">${esc(item.nombre)}</div>
        <small class="text-muted">Stock disp.: ${esc(obtenerStockDisponiblePOS(item))}${item.codigo_qr ? ` · QR: ${esc(item.codigo_qr)}` : ''}</small>
      </td>
      <td>${fmt(item.precio)}</td>
      <td class="text-center">
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn btn-outline-secondary pos-qty-btn" data-id="${esc(item.id)}" data-delta="-1">−</button>
          <span class="btn btn-light disabled fw-bold text-dark px-3">${esc(item.cantidad)}</span>
          <button type="button" class="btn btn-outline-secondary pos-qty-btn" data-id="${esc(item.id)}" data-delta="1">+</button>
        </div>
      </td>
      <td class="text-end fw-bold">${fmt(Number(item.precio) * Number(item.cantidad))}</td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-outline-danger pos-del-btn" data-id="${esc(item.id)}" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  totalEl.textContent = fmt(total);
  btnCheckout.disabled = false;

  $$('#posCartBody .pos-qty-btn').forEach(b => {
    b.addEventListener('click', () => cambiarCantidadPOS(b.dataset.id, parseInt(b.dataset.delta, 10)));
  });
  $$('#posCartBody .pos-del-btn').forEach(b => {
    b.addEventListener('click', () => eliminarItemPOS(b.dataset.id));
  });
}

async function revertirStockPOS(descontados, negocioIdObjetivo = null) {
  const negocioId = negocioIdObjetivo || getNegocioActivoId();
  if (!descontados || !descontados.length || !negocioId) return;
  for (const reg of descontados) {
    try {
      const { data: loteRec } = await supabaseClient
        .from('lotes')
        .select('id, cantidad_actual')
        .eq('producto_id', reg.id)
        .eq('negocio_id', negocioId)
        .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
        .order('fecha_ingreso', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (loteRec) {
        await supabaseClient
          .from('lotes')
          .update({ cantidad_actual: Number(loteRec.cantidad_actual) + Number(reg.cantidad) })
          .eq('id', loteRec.id)
          .eq('negocio_id', negocioId);
      } else {
        const { data: prodActual } = await supabaseClient
          .from('productos')
          .select('stock')
          .eq('id', reg.id)
          .eq('negocio_id', negocioId)
          .maybeSingle();

        if (prodActual) {
          await supabaseClient
            .from('productos')
            .update({ stock: Number(prodActual.stock) + Number(reg.cantidad) })
            .eq('id', reg.id)
            .eq('negocio_id', negocioId);
        }
      }
    } catch (revertErr) {
      console.error('Error al revertir stock POS:', revertErr);
    }
  }
}

async function procesarVentaPOS() {
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return toast('No hay negocio activo', 'danger');
  if (!posCart.length) return toast('El carrito POS está vacío', 'warning');

  const btn = $('#btnPosCheckout');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Registrando venta...';

  const descontados = [];

  try {
    // 1. Verificar stock real actualizado en Supabase antes de cobrar
    const ids = posCart.map(i => i.id);
    const { data: productosDb, error: prodErr } = await supabaseClient
      .from('productos')
      .select('id, negocio_id, nombre, precio, stock')
      .in('id', ids)
      .eq('negocio_id', negocioId);

    if (prodErr) throw prodErr;
    if (getNegocioActivoId() !== negocioId) return;

    const mapProductos = new Map(
      (productosDb || [])
        .filter(p => String(p.negocio_id || '') === negocioId)
        .map(p => [String(p.id), p])
    );
    for (const item of posCart) {
      const prodDb = mapProductos.get(String(item.id));
      if (!prodDb) {
        throw new Error(`El producto "${item.nombre}" ya no existe en el catálogo.`);
      }
      const stockReal = Number(prodDb.stock ?? 0);
      if (item.cantidad > stockReal) {
        item.stock = stockReal;
        renderPosCart();
        throw new Error(`Stock insuficiente para "${prodDb.nombre}". Disponible actual: ${stockReal}`);
      }
    }

    // 2. Descontar stock por producto (RPC atómica con respaldo UPDATE filtrado por id + negocio_id)
    for (const item of posCart) {
      const prodDb = mapProductos.get(String(item.id));
      const { error: rpcErr } = await supabaseClient.rpc('descontar_stock_pos', {
        p_producto_id: item.id,
        p_negocio_id: negocioId,
        p_cantidad: item.cantidad
      });

      if (rpcErr) {
        const rpcNoDisponible = rpcErr.code === 'PGRST202' || /Could not find the function/i.test(rpcErr.message || '');
        if (!rpcNoDisponible) {
          throw new Error(rpcErr.message || `No se pudo descontar stock de "${item.nombre}".`);
        }

        const nuevoStock = Number(prodDb.stock) - Number(item.cantidad);
        const { data: updRows, error: updErr } = await supabaseClient
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', item.id)
          .eq('negocio_id', negocioId)
          .gte('stock', item.cantidad)
          .select('id, stock');

        if (updErr) throw updErr;
        if (!updRows || updRows.length === 0) {
          throw new Error(`Stock insuficiente para "${item.nombre}" al confirmar el cobro.`);
        }
      }

      descontados.push({ id: item.id, cantidad: item.cantidad });
    }

    // 3. Registrar pedido presencial en 'pedidos' y sus detalles en 'pedido_items'
    const total = posCart.reduce((sum, i) => sum + (Number(i.precio) * Number(i.cantidad)), 0);
    const metodoPago = $('#posMetodoPago') ? $('#posMetodoPago').value : 'Efectivo';

    const pedidoPayload = {
      negocio_id: negocioId,
      cliente_nombre: 'Cliente POS',
      cliente_telefono: 'Presencial',
      tipo_entrega: 'Presencial',
      direccion: null,
      metodo_pago: metodoPago,
      total: Number(total.toFixed(2)),
      estado: 'entregado'
    };

    const { data: pedidoCreado, error: pedidoErr } = await supabaseClient
      .from('pedidos')
      .insert(pedidoPayload)
      .select('id, numero_pedido')
      .single();

    if (pedidoErr || !pedidoCreado) {
      throw pedidoErr || new Error('No se pudo registrar el pedido POS.');
    }

    const itemsPayload = posCart.map(i => ({
      pedido_id: pedidoCreado.id,
      producto_id: String(i.id),
      producto_nombre: i.nombre,
      precio_unitario: Number(i.precio),
      cantidad: Number(i.cantidad),
      subtotal: Number((Number(i.precio) * Number(i.cantidad)).toFixed(2))
    }));

    const { error: itemsErr } = await supabaseClient
      .from('pedido_items')
      .insert(itemsPayload);

    if (itemsErr) {
      console.warn('Advertencia al insertar pedido_items POS:', itemsErr);
    }

    // 4. Limpiar carrito POS y refrescar productos, pedidos, métricas y alertas de vencimiento
    posCart = [];
    renderPosCart();
    toast(`Venta POS #${pedidoCreado.numero_pedido || ''} registrada (${fmt(total)}) ✅`, 'success');
    await Promise.all([loadProducts(), loadOrders(), cargarAlertasVencimiento()]);
  } catch (err) {
    console.error('Error procesando venta POS:', err);
    if (descontados.length > 0) {
      await revertirStockPOS(descontados, negocioId);
      await loadProducts();
    }
    toast(esc(err?.message || 'Error al registrar la venta POS'), 'danger');
  } finally {
    btn.innerHTML = origHtml;
    btn.disabled = posCart.length === 0;
  }
}

if ($('#posManualForm')) {
  $('#posManualForm').addEventListener('submit', manejarIngresoManualPOS);
}
if ($('#btnPosClearCart')) {
  $('#btnPosClearCart').addEventListener('click', () => {
    if (!posCart.length) return;
    posCart = [];
    renderPosCart();
    toast('Carrito POS vaciado', 'warning');
  });
}
if ($('#btnPosCheckout')) {
  $('#btnPosCheckout').addEventListener('click', procesarVentaPOS);
}
if ($('#btnPosRestartCamera')) {
  $('#btnPosRestartCamera').addEventListener('click', async () => {
    await detenerEscanerPOS();
    await iniciarEscanerPOS();
  });
}
if ($('#productModal')) {
  $('#productModal').addEventListener('shown.bs.modal', () => {
    if (pendingPosModalFocusId) {
      const targetInput = $(pendingPosModalFocusId);
      pendingPosModalFocusId = null;
      if (targetInput) {
        targetInput.focus();
        if (typeof targetInput.select === 'function') targetInput.select();
      }
    }
  });
  $('#productModal').addEventListener('hidden.bs.modal', async () => {
    modalProductoDesdePOS = false;
    pendingPosModalFocusId = null;
    if (camaraPausadaPorModal) {
      await reanudarEscanerPOS();
    }
  });
}
renderPosCart();

// =============================================================================
// MÓDULO ERP: CONTROL DE LOTES, COSTOS Y ALERTAS DE VENCIMIENTO (FEFO / FIFO)
// =============================================================================
function parseFechaLocal(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function calcularDiasHastaVencimiento(dateStr) {
  const fechaVenc = parseFechaLocal(dateStr);
  if (!fechaVenc) return null;
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((fechaVenc.getTime() - hoyLocal.getTime()) / 86400000);
}

function fmtFechaCorta(dateStr) {
  const d = parseFechaLocal(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function obtenerEstadoBadgeLote(lote) {
  if (Number(lote.cantidad_actual) <= 0) {
    return '<span class="badge bg-secondary">Agotado</span>';
  }
  if (!lote.fecha_vencimiento) {
    return '<span class="badge bg-success">Vigente</span>';
  }
  const dias = calcularDiasHastaVencimiento(lote.fecha_vencimiento);
  if (dias === null) return '<span class="badge bg-success">Vigente</span>';
  if (dias < 0) {
    return `<span class="badge bg-danger">Vencido (${Math.abs(dias)}d)</span>`;
  }
  if (dias <= 30) {
    return `<span class="badge bg-warning text-dark">Por vencer (${dias === 0 ? 'hoy' : `${dias}d`})</span>`;
  }
  return '<span class="badge bg-success">Vigente</span>';
}

window.abrirModalLotes = async (productoId) => {
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return toast('No hay negocio activo', 'danger');
  const prod = allProducts.find(p => String(p.id) === String(productoId) && String(p.negocio_id || '') === negocioId);
  if (!prod) return toast('Producto no encontrado', 'warning');

  if ($('#loteProductoId')) $('#loteProductoId').value = prod.id;
  if ($('#lotesProductoNombre')) $('#lotesProductoNombre').textContent = prod.nombre;
  if ($('#lotesStockTotal')) $('#lotesStockTotal').textContent = `Stock total: ${Number(prod.stock ?? 0)} u.`;

  if ($('#formNuevoLote')) $('#formNuevoLote').reset();
  if ($('#loteProductoId')) $('#loteProductoId').value = prod.id;
  if ($('#loteCostoUnitario')) $('#loteCostoUnitario').value = '0.00';

  const modalEl = $('#modalLotesProducto');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  await cargarLotesProducto(prod.id);
};

async function cargarLotesProducto(productoId) {
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return;
  const tbody = $('#tablaLotesBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Cargando lotes...</td></tr>';
  }

  const { data: lotes, error } = await supabaseClient
    .from('lotes')
    .select('*')
    .eq('negocio_id', negocioId)
    .eq('producto_id', productoId)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .order('fecha_ingreso', { ascending: true });

  if (getNegocioActivoId() !== negocioId) return;

  if (error) {
    console.error('Error cargando lotes:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">Error al cargar lotes.</td></tr>';
    }
    return;
  }

  const lista = (lotes || []).filter(l => String(l.negocio_id || '') === negocioId);
  const totalCalculado = lista.reduce((acc, l) => acc + Number(l.cantidad_actual || 0), 0);
  if ($('#lotesStockTotal')) {
    $('#lotesStockTotal').textContent = `Stock total: ${totalCalculado} u.`;
  }

  renderTablaLotes(lista);
}

function renderTablaLotes(lotes) {
  const tbody = $('#tablaLotesBody');
  if (!tbody) return;

  if (!lotes.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Este producto aún no tiene lotes registrados.</td></tr>';
    return;
  }

  tbody.innerHTML = lotes.map(l => `
    <tr>
      <td>
        <div class="fw-bold">${l.codigo_lote ? esc(l.codigo_lote) : '<span class="text-muted fst-italic">Sin código</span>'}</div>
        <small class="text-muted">Ing.: ${fmtDate(l.fecha_ingreso)}</small>
      </td>
      <td><strong>${esc(l.cantidad_actual)}</strong> / ${esc(l.cantidad_inicial)} u.</td>
      <td>${fmt(l.costo_unitario)}</td>
      <td>${l.fecha_vencimiento ? esc(fmtFechaCorta(l.fecha_vencimiento)) : '<span class="text-muted">No vence</span>'}</td>
      <td>${obtenerEstadoBadgeLote(l)}</td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-outline-danger btn-del-lote" data-lote-id="${esc(l.id)}" data-prod-id="${esc(l.producto_id)}" title="Dar de baja / eliminar lote">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  $$('#tablaLotesBody .btn-del-lote').forEach(btn => {
    btn.addEventListener('click', () => eliminarLoteProducto(btn.dataset.loteId, btn.dataset.prodId));
  });
}

async function eliminarLoteProducto(loteId, productoId) {
  if (!confirm('¿Eliminar este lote del historial? El stock total del producto se recalculará automáticamente.')) return;
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return;

  const { data: delRows, error } = await supabaseClient
    .from('lotes')
    .delete()
    .eq('id', loteId)
    .eq('negocio_id', negocioId)
    .eq('producto_id', productoId)
    .select('id');

  if (error) {
    console.error('Error eliminando lote:', error);
    return toast('No se pudo eliminar el lote: ' + esc(error.message), 'danger');
  }
  if (!delRows || delRows.length === 0) {
    return toast('No se encontró el lote en este negocio.', 'warning');
  }

  toast('Lote eliminado y stock recalculado ✅');
  await Promise.all([cargarLotesProducto(productoId), loadProducts(), cargarAlertasVencimiento()]);
}

if ($('#formNuevoLote')) {
  $('#formNuevoLote').addEventListener('submit', async (e) => {
    e.preventDefault();
    const negocioId = getNegocioActivoId();
    if (!negocioId || !supabaseClient) return toast('No hay negocio activo', 'danger');

    const productoId = $('#loteProductoId') ? $('#loteProductoId').value : '';
    const cantidad = parseInt($('#loteCantidad') ? $('#loteCantidad').value : '0', 10);
    const costoUnitario = parseFloat($('#loteCostoUnitario') ? $('#loteCostoUnitario').value : '0');
    const codigoLote = $('#loteCodigo') ? $('#loteCodigo').value.trim() : '';
    const fechaVenc = $('#loteFechaVencimiento') ? $('#loteFechaVencimiento').value.trim() : '';

    if (!productoId) return toast('Producto inválido', 'danger');
    if (isNaN(cantidad) || cantidad <= 0) return toast('La cantidad ingresada debe ser mayor a 0', 'warning');
    if (isNaN(costoUnitario) || costoUnitario < 0) return toast('El costo unitario no puede ser negativo', 'warning');

    const prod = allProducts.find(p => String(p.id) === String(productoId) && String(p.negocio_id || '') === negocioId);
    if (!prod) return toast('El producto no pertenece al negocio activo', 'danger');

    const btn = $('#btnGuardarLote');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Guardando...';
    }

    try {
      const payload = {
        negocio_id: negocioId,
        producto_id: productoId,
        codigo_lote: codigoLote || null,
        cantidad_inicial: cantidad,
        cantidad_actual: cantidad,
        costo_unitario: Number(costoUnitario.toFixed(2)),
        precio_venta: Number(prod.precio),
        fecha_vencimiento: fechaVenc || null
      };

      const { error } = await supabaseClient.from('lotes').insert(payload);
      if (error) throw error;

      if ($('#formNuevoLote')) $('#formNuevoLote').reset();
      if ($('#loteProductoId')) $('#loteProductoId').value = productoId;
      if ($('#loteCostoUnitario')) $('#loteCostoUnitario').value = '0.00';

      toast(`Lote registrado (+${cantidad} u.) ✅`);
      await Promise.all([cargarLotesProducto(productoId), loadProducts(), cargarAlertasVencimiento()]);
    } catch (err) {
      console.error('Error guardando lote:', err);
      toast('Error al guardar lote: ' + esc(err?.message || 'Desconocido'), 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  });
}

async function cargarAlertasVencimiento() {
  if (cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false) return;
  const negocioId = getNegocioActivoId();
  if (!negocioId || !supabaseClient) return;
  const listEl = $('#alertasVencimientoList');
  const badgeEl = $('#alertasVencimientoBadge');
  if (!listEl) return;

  const hoy = new Date();
  const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30);
  const limiteIso = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabaseClient
    .from('lotes')
    .select('id, negocio_id, producto_id, codigo_lote, cantidad_actual, fecha_vencimiento, productos(nombre, codigo_qr)')
    .eq('negocio_id', negocioId)
    .gt('cantidad_actual', 0)
    .not('fecha_vencimiento', 'is', null)
    .lte('fecha_vencimiento', limiteIso)
    .order('fecha_vencimiento', { ascending: true });

  if (getNegocioActivoId() !== negocioId) return;

  if (error) {
    console.error('Error cargando alertas de vencimiento:', error);
    if (badgeEl) {
      badgeEl.className = 'badge bg-secondary rounded-pill px-3 py-2';
      badgeEl.textContent = 'Sin datos';
    }
    listEl.innerHTML = '<div class="text-muted small">No se pudieron consultar las alertas de vencimiento.</div>';
    return;
  }

  const filtrados = (data || []).filter(l => String(l.negocio_id || '') === negocioId);
  renderAlertasVencimiento(filtrados);
}

function renderAlertasVencimiento(lotesAlerta) {
  const listEl = $('#alertasVencimientoList');
  const badgeEl = $('#alertasVencimientoBadge');
  if (!listEl) return;

  if (!lotesAlerta || !lotesAlerta.length) {
    if (badgeEl) {
      badgeEl.className = 'badge bg-success rounded-pill px-3 py-2';
      badgeEl.textContent = '0 alertas';
    }
    listEl.innerHTML = `
      <div class="alert alert-success d-flex align-items-center gap-2 mb-0 py-2 small">
        <i class="bi bi-check-circle-fill"></i>
        <span>Inventario sin vencimientos próximos</span>
      </div>
    `;
    return;
  }

  const vencidosCount = lotesAlerta.filter(l => {
    const dias = calcularDiasHastaVencimiento(l.fecha_vencimiento);
    return dias !== null && dias < 0;
  }).length;

  if (badgeEl) {
    badgeEl.className = vencidosCount > 0
      ? 'badge bg-danger rounded-pill px-3 py-2'
      : 'badge bg-warning text-dark rounded-pill px-3 py-2';
    badgeEl.textContent = `${lotesAlerta.length} ${lotesAlerta.length === 1 ? 'lote' : 'lotes'} en alerta`;
  }

  listEl.innerHTML = `
    <div class="list-group list-group-flush">
      ${lotesAlerta.map(l => {
        const dias = calcularDiasHastaVencimiento(l.fecha_vencimiento);
        const esVencido = dias !== null && dias < 0;
        const nombreProd = l.productos ? l.productos.nombre : 'Producto';
        const qrProd = l.productos && l.productos.codigo_qr ? ` · QR: ${esc(l.productos.codigo_qr)}` : '';
        const estadoBadge = esVencido
          ? `<span class="badge bg-danger">Vencido hace ${Math.abs(dias)}d</span>`
          : `<span class="badge bg-warning text-dark">${dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`}</span>`;
        const rowClass = esVencido ? 'border-start border-4 border-danger bg-danger-subtle' : 'border-start border-4 border-warning';

        return `
          <div class="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 py-2 ${rowClass}">
            <div>
              <div class="d-flex align-items-center flex-wrap gap-2">
                ${estadoBadge}
                <strong>${esc(nombreProd)}</strong>
                <span class="badge bg-dark">${esc(l.cantidad_actual)} u. en riesgo</span>
              </div>
              <small class="text-muted">
                ${l.codigo_lote ? `Lote: ${esc(l.codigo_lote)}` : 'Lote sin código'} · Vence: ${esc(fmtFechaCorta(l.fecha_vencimiento))}${qrProd}
              </small>
            </div>
            <button type="button" class="btn btn-sm btn-outline-dark rounded-pill px-3 btn-alerta-lote" data-prod-id="${esc(l.producto_id)}">
              <i class="bi bi-boxes me-1"></i>Ver lotes
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;

  $$('#alertasVencimientoList .btn-alerta-lote').forEach(btn => {
    btn.addEventListener('click', () => abrirModalLotes(btn.dataset.prodId));
  });
}

// =============================================================================
// GESTIÓN DE UBICACIÓN Y GOOGLE MAPS POR INQUILINO (ZERO-TRUST)
// =============================================================================
function analizarEnlaceMapaAdmin(valorBruto) {
  let raw = String(valorBruto || '').trim();
  if (!raw) return { ok: true, url: '', modo: 'vacio' };

  const iframeMatch = raw.match(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    raw = iframeMatch[1].trim();
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return { ok: false, url: '', modo: 'invalido' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, url: '', modo: 'invalido' };
  }

  const host = parsed.hostname.toLowerCase();
  const esHostGoogle = /(^|\.)google\.[a-z.]{2,}$/i.test(host) || host === 'goo.gl' || host === 'maps.app.goo.gl';
  const esEmbed = esHostGoogle && (
    /\/maps\/embed/i.test(parsed.pathname) ||
    parsed.searchParams.get('output') === 'embed'
  );

  return {
    ok: true,
    url: parsed.href,
    modo: esEmbed ? 'embed' : 'link'
  };
}

function renderPreviewUbicacionAdmin() {
  const previewEl = $('#ubicacionPreview');
  const badgeEl = $('#ubicacionPreviewBadge');
  if (!previewEl) return;

  const direccion = String($('#ubicacionDireccion')?.value || '').trim();
  const analisis = analizarEnlaceMapaAdmin($('#ubicacionMapsUrl')?.value || '');

  if (!analisis.ok) {
    if (badgeEl) {
      badgeEl.className = 'badge bg-danger-subtle text-danger';
      badgeEl.textContent = 'Enlace inválido';
    }
    previewEl.innerHTML = `
      <div class="alert alert-warning mb-0 small">
        <i class="bi bi-exclamation-triangle-fill me-1"></i>
        Ingresa una URL segura de Google Maps (<code>https://...</code>) o pega el código <code>&lt;iframe&gt;</code> completo de "Insertar un mapa".
      </div>
    `;
    return;
  }

  if (analisis.modo === 'embed') {
    if (badgeEl) {
      badgeEl.className = 'badge bg-success-subtle text-success';
      badgeEl.textContent = 'Mapa interactivo (iframe)';
    }
    previewEl.innerHTML = `
      <div class="border rounded-3 p-3 bg-light">
        ${direccion ? `<p class="mb-2 small fw-semibold"><i class="bi bi-geo-alt-fill text-danger me-1"></i>${esc(direccion)}</p>` : ''}
        <div class="ratio ratio-16x9 rounded overflow-hidden border bg-white">
          <iframe src="${esc(analisis.url)}" style="border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
        </div>
      </div>
    `;
    return;
  }

  if (analisis.modo === 'link') {
    if (badgeEl) {
      badgeEl.className = 'badge bg-primary-subtle text-primary';
      badgeEl.textContent = 'Tarjeta + Botón Google Maps';
    }
    previewEl.innerHTML = `
      <div class="border rounded-3 p-4 bg-light text-center">
        <i class="bi bi-geo-alt-fill text-danger fs-2 mb-2 d-block"></i>
        ${direccion
          ? `<p class="fw-bold mb-2">${esc(direccion)}</p>`
          : '<p class="text-muted small mb-2">Ubicación disponible en Google Maps</p>'}
        <a href="${esc(analisis.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-dark btn-sm rounded-pill px-4">
          <i class="bi bi-map me-1"></i> Abrir ubicación en Google Maps
        </a>
        <div class="form-text small mt-2">Los enlaces cortos o normales se abren en una nueva pestaña para evitar bloqueos de navegador.</div>
      </div>
    `;
    return;
  }

  if (direccion) {
    if (badgeEl) {
      badgeEl.className = 'badge bg-info-subtle text-info-emphasis';
      badgeEl.textContent = 'Solo dirección física';
    }
    previewEl.innerHTML = `
      <div class="border rounded-3 p-4 bg-light text-center">
        <i class="bi bi-shop text-primary fs-2 mb-2 d-block"></i>
        <p class="fw-bold mb-1">${esc(direccion)}</p>
        <p class="text-muted small mb-0">Si deseas mostrar mapa o botón "Cómo llegar", agrega un enlace de Google Maps.</p>
      </div>
    `;
    return;
  }

  if (badgeEl) {
    badgeEl.className = 'badge bg-secondary-subtle text-dark';
    badgeEl.textContent = 'Atención Online';
  }
  previewEl.innerHTML = `
    <div class="border rounded-3 p-4 bg-light text-center">
      <i class="bi bi-truck text-success fs-2 mb-2 d-block"></i>
      <p class="fw-bold mb-1">Atención Online y Delivery</p>
      <p class="text-muted small mb-0">Coordina tu entrega directamente por WhatsApp</p>
    </div>
  `;
}

function sincronizarFormularioUbicacion() {
  const dirEl = $('#ubicacionDireccion');
  const mapEl = $('#ubicacionMapsUrl');
  if (!dirEl || !mapEl) return;

  const negocio = window.negocioAdminActual || {};
  dirEl.value = String(negocio.direccion || '').trim();
  mapEl.value = String(negocio.google_maps_url || '').trim();
  renderPreviewUbicacionAdmin();
}

async function guardarUbicacionNegocio(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  if (!supabaseClient) return;

  let tenantId;
  try {
    tenantId = getTenantIdOrThrow();
  } catch (err) {
    toast(err.message || 'Sesión de negocio inválida.', 'danger');
    return;
  }

  const direccion = String($('#ubicacionDireccion')?.value || '').trim();
  const analisis = analizarEnlaceMapaAdmin($('#ubicacionMapsUrl')?.value || '');
  if (!analisis.ok) {
    toast('⚠️ Ingresa una URL segura de Google Maps (https://...) o el código iframe completo.', 'warning');
    return;
  }

  if ($('#ubicacionMapsUrl') && analisis.url !== String($('#ubicacionMapsUrl').value || '').trim()) {
    $('#ubicacionMapsUrl').value = analisis.url;
  }

  const btn = $('#btnGuardarUbicacion');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
  }

  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    }

    const payload = {
      direccion: direccion || null,
      google_maps_url: analisis.url || null
    };

    const { data, error } = await supabaseClient
      .from('negocios')
      .update(payload)
      .eq('id', tenantId)
      .eq('owner_id', user.id)
      .select('id, direccion, google_maps_url')
      .single();

    if (error || !data || String(data.id) !== tenantId) {
      throw new Error(error?.message || 'No se pudo actualizar la ubicación del negocio.');
    }

    if (window.negocioAdminActual && String(window.negocioAdminActual.id) === tenantId) {
      window.negocioAdminActual.direccion = data.direccion || null;
      window.negocioAdminActual.google_maps_url = data.google_maps_url || null;
    }

    renderPreviewUbicacionAdmin();
    toast('✅ Ubicación actualizada en tu tienda pública.', 'success');
  } catch (err) {
    console.error('Error guardando ubicación:', err);
    toast(`❌ ${err.message || 'Error al guardar la ubicación'}`, 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

if ($('#ubicacionDireccion')) {
  $('#ubicacionDireccion').addEventListener('input', renderPreviewUbicacionAdmin);
}
if ($('#ubicacionMapsUrl')) {
  $('#ubicacionMapsUrl').addEventListener('input', renderPreviewUbicacionAdmin);
}
if ($('#formMiUbicacion')) {
  $('#formMiUbicacion').addEventListener('submit', guardarUbicacionNegocio);
}
if ($('#btnLimpiarUbicacion')) {
  $('#btnLimpiarUbicacion').addEventListener('click', () => {
    if ($('#ubicacionDireccion')) $('#ubicacionDireccion').value = '';
    if ($('#ubicacionMapsUrl')) $('#ubicacionMapsUrl').value = '';
    renderPreviewUbicacionAdmin();
  });
}

// =============================================================================
// MÓDULO ADICIONAL: VENTA RÁPIDA (EXPRESS) CON PRECIOS EDITABLES Y FEFO
// =============================================================================
const roundCentsExpress = (n) => Math.max(0, Math.round(Number(n || 0) * 100));
const roundMoneyExpress = (n) => roundCentsExpress(n) / 100;

function calcularTotalExpressCents() {
  return carritoExpress.reduce((sum, item) => sum + roundCentsExpress(item.subtotal), 0);
}

async function cargarProductosExpress() {
  if (cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false) return;
  if (!supabaseClient) return;
  let tenantId;
  try {
    tenantId = getTenantIdOrThrow();
  } catch (_) {
    productosExpressCache = [];
    renderGridProductosExpress();
    renderCarritoExpress();
    return;
  }

  const gridEl = $('#gridProductosExpress');
  if (gridEl && !productosExpressCache.length) {
    gridEl.innerHTML = '<div class="col-12 text-center text-muted py-4">Cargando productos...</div>';
  }

  const { data, error } = await supabaseClient
    .from('productos')
    .select('id, negocio_id, nombre, precio, stock, categoria, activo')
    .eq('negocio_id', tenantId)
    .order('nombre', { ascending: true });

  if (getNegocioActivoId() !== tenantId) return;

  if (error) {
    console.error('Error cargando productos Express:', error);
    if (gridEl) {
      gridEl.innerHTML = '<div class="col-12 text-center text-danger py-4">No se pudieron cargar los productos.</div>';
    }
    toast('Error al cargar productos de Venta Rápida', 'danger');
    return;
  }

  productosExpressCache = (data || []).filter(p => String(p.negocio_id || '') === tenantId && p.activo !== false);

  // Sincronizar límites de stock si el carrito ya tenía ítems previos
  const mapaActual = new Map(productosExpressCache.map(p => [String(p.id), p]));
  carritoExpress = carritoExpress
    .map(item => {
      const prod = mapaActual.get(String(item.id));
      if (!prod || Number(prod.stock || 0) <= 0) return null;
      const stockReal = Number(prod.stock || 0);
      const nuevaCant = Math.min(item.cantidad, stockReal);
      if (nuevaCant !== item.cantidad) {
        const nuevoSub = roundMoneyExpress(item.precioUnitario * nuevaCant);
        return { ...item, cantidad: nuevaCant, stock: stockReal, subtotal: nuevoSub };
      }
      return { ...item, stock: stockReal };
    })
    .filter(Boolean);

  renderGridProductosExpress();
  renderCarritoExpress();
}

function renderGridProductosExpress() {
  const gridEl = $('#gridProductosExpress');
  if (!gridEl) return;

  const q = String($('#buscadorExpress')?.value || '').trim().toLowerCase();
  const filtrados = q
    ? productosExpressCache.filter(p =>
        String(p.nombre || '').toLowerCase().includes(q) ||
        String(p.categoria || '').toLowerCase().includes(q)
      )
    : productosExpressCache;

  if (!filtrados.length) {
    gridEl.innerHTML = `
      <div class="col-12">
        <div class="alert alert-light border text-center text-muted py-4 mb-0">
          ${q ? 'No hay productos que coincidan con tu búsqueda.' : 'No hay productos registrados en este negocio.'}
        </div>
      </div>
    `;
    return;
  }

  const mapaCarrito = new Map(carritoExpress.map(i => [String(i.id), Number(i.cantidad || 0)]));

  gridEl.innerHTML = filtrados.map(prod => {
    const idStr = String(prod.id);
    const enCarrito = mapaCarrito.get(idStr) || 0;
    const stockReal = Number(prod.stock ?? 0);
    const disponible = Math.max(0, stockReal - enCarrito);
    const sinStock = disponible <= 0;
    const badgeClass = sinStock
      ? 'badge bg-secondary'
      : 'badge bg-success-subtle text-success border border-success-subtle';
    const badgeTexto = sinStock ? 'Agotado' : `Stock: ${disponible}`;
    const btnClasses = sinStock
      ? 'btn btn-light border w-100 h-100 text-start p-3 d-flex flex-column justify-content-between btn-producto-express opacity-50'
      : 'btn btn-light border shadow-sm w-100 h-100 text-start p-3 d-flex flex-column justify-content-between btn-producto-express';

    return `
      <div class="col">
        <button
          type="button"
          class="${btnClasses}"
          data-id="${esc(idStr)}"
          ${sinStock ? 'disabled' : ''}
        >
          <div class="fw-bold text-dark lh-sm mb-2">${esc(prod.nombre)}</div>
          <div class="d-flex justify-content-between align-items-end flex-wrap gap-1 w-100">
            <span class="fw-bold text-success fs-5">${fmt(prod.precio)}</span>
            <span class="${badgeClass}">${esc(badgeTexto)}</span>
          </div>
        </button>
      </div>
    `;
  }).join('');

  $$('#gridProductosExpress .btn-producto-express').forEach(btn => {
    btn.addEventListener('click', () => agregarProductoExpress(btn.dataset.id));
  });
}

function agregarProductoExpress(prodId) {
  if (procesandoVentaExpress) return;
  const prod = productosExpressCache.find(p => String(p.id) === String(prodId));
  if (!prod) return;

  const stockReal = Number(prod.stock ?? 0);
  const existente = carritoExpress.find(i => String(i.id) === String(prod.id));
  const nuevaCant = (existente ? existente.cantidad : 0) + 1;

  if (nuevaCant > stockReal) {
    toast(`⚠️ Stock insuficiente para "${esc(prod.nombre)}" (disponible: ${stockReal}).`, 'warning');
    return;
  }

  navigator.vibrate?.(30);

  if (existente) {
    existente.cantidad = nuevaCant;
    existente.stock = stockReal;
    existente.subtotal = roundMoneyExpress(existente.precioUnitario * existente.cantidad);
  } else {
    const precioBase = roundMoneyExpress(prod.precio);
    carritoExpress.push({
      id: String(prod.id),
      nombre: prod.nombre,
      precioOriginal: precioBase,
      precioUnitario: precioBase,
      subtotal: precioBase,
      cantidad: 1,
      stock: stockReal
    });
  }

  renderGridProductosExpress();
  renderCarritoExpress();
}

function cambiarCantidadExpress(prodId, delta) {
  if (procesandoVentaExpress) return;
  const idx = carritoExpress.findIndex(i => String(i.id) === String(prodId));
  if (idx < 0) return;

  const item = carritoExpress[idx];
  const nuevaCant = item.cantidad + delta;

  if (nuevaCant <= 0) {
    carritoExpress.splice(idx, 1);
  } else if (nuevaCant > item.stock) {
    toast(`⚠️ Stock máximo disponible: ${item.stock} u.`, 'warning');
    return;
  } else {
    item.cantidad = nuevaCant;
    item.subtotal = roundMoneyExpress(item.precioUnitario * nuevaCant);
  }

  renderGridProductosExpress();
  renderCarritoExpress();
}

function quitarItemExpress(prodId) {
  if (procesandoVentaExpress) return;
  carritoExpress = carritoExpress.filter(i => String(i.id) !== String(prodId));
  renderGridProductosExpress();
  renderCarritoExpress();
}

function vaciarCarritoExpress() {
  if (procesandoVentaExpress || !carritoExpress.length) return;
  carritoExpress = [];
  renderGridProductosExpress();
  renderCarritoExpress();
}

function findExpressInput(selector, prodId) {
  return $$(selector).find(el => String(el.dataset?.id || '') === String(prodId)) || null;
}

function parseInputNumeroExpress(rawVal) {
  const s = String(rawVal ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const num = Number(s);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function actualizarDisplayTotalExpress() {
  const totalInput = $('#totalExpressInput');
  if (totalInput) {
    totalInput.value = (calcularTotalExpressCents() / 100).toFixed(2);
    totalInput.disabled = carritoExpress.length === 0 || procesandoVentaExpress;
  }
}

function editarPrecioUnitarioExpress(prodId, rawVal) {
  if (procesandoVentaExpress) return;
  const item = carritoExpress.find(i => String(i.id) === String(prodId));
  if (!item) return;

  const unitInput = findExpressInput('#carritoExpressContainer .input-express-precio', prodId);
  const subInput = findExpressInput('#carritoExpressContainer .input-express-subtotal', prodId);
  const num = parseInputNumeroExpress(rawVal);

  if (num === null) {
    if (unitInput) unitInput.value = Number(item.precioUnitario).toFixed(2);
    return;
  }

  item.precioUnitario = num;
  item.subtotal = +(item.cantidad * num).toFixed(2);

  if (unitInput) unitInput.value = item.precioUnitario.toFixed(2);
  if (subInput) subInput.value = item.subtotal.toFixed(2);
  actualizarDisplayTotalExpress();
}

function editarSubtotalLineaExpress(prodId, rawVal) {
  if (procesandoVentaExpress) return;
  const item = carritoExpress.find(i => String(i.id) === String(prodId));
  if (!item) return;

  const unitInput = findExpressInput('#carritoExpressContainer .input-express-precio', prodId);
  const subInput = findExpressInput('#carritoExpressContainer .input-express-subtotal', prodId);
  const num = parseInputNumeroExpress(rawVal);

  if (num === null) {
    if (subInput) subInput.value = Number(item.subtotal).toFixed(2);
    return;
  }

  item.subtotal = roundMoneyExpress(num);
  item.precioUnitario = item.cantidad > 0
    ? +(item.subtotal / item.cantidad).toFixed(4)
    : 0;

  if (unitInput) unitInput.value = item.precioUnitario.toFixed(2);
  if (subInput) subInput.value = item.subtotal.toFixed(2);
  actualizarDisplayTotalExpress();
}

function editarTotalGlobalExpress(rawVal) {
  if (procesandoVentaExpress || !carritoExpress.length) return;
  const num = parseInputNumeroExpress(rawVal);
  if (num === null) {
    actualizarDisplayTotalExpress();
    return;
  }

  const targetCents = roundCentsExpress(num);
  const currentCents = calcularTotalExpressCents();
  const weights = carritoExpress.map(item =>
    currentCents > 0 ? roundCentsExpress(item.subtotal) : Number(item.cantidad || 1)
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Prorrateo proporcional a 2 decimales asignando el ajuste residual de céntimos al último ítem
  let restanteCents = targetCents;
  for (let idx = 0; idx < carritoExpress.length - 1; idx++) {
    const prorrateado = totalWeight > 0
      ? Math.round((weights[idx] * targetCents) / totalWeight)
      : 0;
    const asignado = Math.min(restanteCents, Math.max(0, prorrateado));
    carritoExpress[idx].subtotal = asignado / 100;
    carritoExpress[idx].precioUnitario = carritoExpress[idx].cantidad > 0
      ? +(carritoExpress[idx].subtotal / carritoExpress[idx].cantidad).toFixed(4)
      : 0;
    restanteCents -= asignado;
  }

  const ultimo = carritoExpress[carritoExpress.length - 1];
  ultimo.subtotal = restanteCents / 100;
  ultimo.precioUnitario = ultimo.cantidad > 0
    ? +(ultimo.subtotal / ultimo.cantidad).toFixed(4)
    : 0;

  // Actualizar inputs de cada línea sin reconstruir ni destruir los <input>
  $$('#carritoExpressContainer .input-express-precio').forEach(inp => {
    const it = carritoExpress.find(i => String(i.id) === String(inp.dataset.id));
    if (it) inp.value = it.precioUnitario.toFixed(2);
  });
  $$('#carritoExpressContainer .input-express-subtotal').forEach(inp => {
    const it = carritoExpress.find(i => String(i.id) === String(inp.dataset.id));
    if (it) inp.value = it.subtotal.toFixed(2);
  });

  actualizarDisplayTotalExpress();
}

function renderCarritoExpress() {
  const container = $('#carritoExpressContainer');
  const badgeEl = $('#expressItemsBadge');
  const btnEf = $('#btnCobrarExpressEfectivo');
  const btnYp = $('#btnCobrarExpressYape');
  const vaciarBtn = $('#btnVaciarExpress');

  const totalUnidades = carritoExpress.reduce((s, i) => s + Number(i.cantidad || 0), 0);
  if (badgeEl) badgeEl.textContent = `${totalUnidades} u. en carrito`;

  actualizarDisplayTotalExpress();

  const deshabilitar = carritoExpress.length === 0 || procesandoVentaExpress;
  if (btnEf) btnEf.disabled = deshabilitar;
  if (btnYp) btnYp.disabled = deshabilitar;
  if (vaciarBtn) vaciarBtn.disabled = deshabilitar;

  if (!container) return;

  if (!carritoExpress.length) {
    container.innerHTML = `
      <div class="text-center text-muted py-4 border rounded-3 bg-light">
        <i class="bi bi-hand-index-thumb fs-2 d-block mb-1"></i>
        <span class="small">Toca un producto de la lista para iniciar la venta rápida.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = carritoExpress.map(item => `
    <div class="border rounded-3 p-2 mb-2 bg-white">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <div>
          <div class="fw-bold text-dark lh-sm">${esc(item.nombre)}</div>
          <small class="text-muted">Catálogo: ${fmt(item.precioOriginal)} · Stock: ${esc(item.stock)}</small>
        </div>
        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-express-del" data-id="${esc(item.id)}" title="Quitar ítem">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="row g-2 align-items-center">
        <div class="col-5">
          <label class="form-label small text-muted mb-1">Cantidad</label>
          <div class="btn-group btn-group-sm w-100" role="group">
            <button type="button" class="btn btn-outline-secondary fw-bold btn-express-dec" data-id="${esc(item.id)}">−</button>
            <span class="btn btn-light border disabled fw-bold text-dark opacity-100">${esc(item.cantidad)}</span>
            <button type="button" class="btn btn-outline-secondary fw-bold btn-express-inc" data-id="${esc(item.id)}">+</button>
          </div>
        </div>
        <div class="col-3">
          <label class="form-label small text-muted mb-1">P. Unit.</label>
          <input
            type="number"
            step="0.10"
            min="0"
            inputmode="decimal"
            onfocus="this.select()"
            class="form-control form-control-sm text-end fw-semibold input-express-precio"
            data-id="${esc(item.id)}"
            value="${Number(item.precioUnitario).toFixed(2)}"
          >
        </div>
        <div class="col-4">
          <label class="form-label small text-muted mb-1">Subtotal</label>
          <input
            type="number"
            step="0.10"
            min="0"
            inputmode="decimal"
            onfocus="this.select()"
            class="form-control form-control-sm text-end fw-bold text-success input-express-subtotal"
            data-id="${esc(item.id)}"
            value="${Number(item.subtotal).toFixed(2)}"
          >
        </div>
      </div>
    </div>
  `).join('');

  $$('#carritoExpressContainer .btn-express-dec').forEach(b =>
    b.addEventListener('click', () => cambiarCantidadExpress(b.dataset.id, -1))
  );
  $$('#carritoExpressContainer .btn-express-inc').forEach(b =>
    b.addEventListener('click', () => cambiarCantidadExpress(b.dataset.id, 1))
  );
  $$('#carritoExpressContainer .btn-express-del').forEach(b =>
    b.addEventListener('click', () => quitarItemExpress(b.dataset.id))
  );

  const confirmarAlEnter = (e) => { if (e.key === 'Enter') e.target.blur(); };

  $$('#carritoExpressContainer .input-express-precio').forEach(inp => {
    inp.addEventListener('change', (e) => editarPrecioUnitarioExpress(inp.dataset.id, e.target.value));
    inp.addEventListener('keydown', confirmarAlEnter);
  });
  $$('#carritoExpressContainer .input-express-subtotal').forEach(inp => {
    inp.addEventListener('change', (e) => editarSubtotalLineaExpress(inp.dataset.id, e.target.value));
    inp.addEventListener('keydown', confirmarAlEnter);
  });
}

async function procesarVentaExpress(metodoPago) {
  const activeEl = document.activeElement;
  if (activeEl && activeEl.matches && activeEl.matches('#totalExpressInput, .input-express-precio, .input-express-subtotal')) {
    activeEl.blur();
  }

  if (!carritoExpress.length || procesandoVentaExpress || !supabaseClient) return;

  let tenantId;
  try {
    tenantId = getTenantIdOrThrow();
  } catch (err) {
    return toast(err.message || 'No hay negocio activo', 'danger');
  }

  procesandoVentaExpress = true;
  const btnEf = $('#btnCobrarExpressEfectivo');
  const btnYp = $('#btnCobrarExpressYape');
  const totalInput = $('#totalExpressInput');
  const vaciarBtn = $('#btnVaciarExpress');
  const origEf = btnEf ? btnEf.innerHTML : '';
  const origYp = btnYp ? btnYp.innerHTML : '';

  const btnActivo = metodoPago === 'Yape' ? btnYp : btnEf;
  if (btnEf) btnEf.disabled = true;
  if (btnYp) btnYp.disabled = true;
  if (totalInput) totalInput.disabled = true;
  if (vaciarBtn) vaciarBtn.disabled = true;
  if (btnActivo) {
    btnActivo.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Registrando...';
  }

  const descontados = [];
  let pedidoCreadoId = null;

  try {
    // 0. Verificar stock real actualizado antes de emitir el pedido
    const ids = carritoExpress.map(i => i.id);
    const { data: productosDb, error: prodErr } = await supabaseClient
      .from('productos')
      .select('id, negocio_id, nombre, precio, stock')
      .in('id', ids)
      .eq('negocio_id', tenantId);

    if (prodErr) throw prodErr;
    if (getNegocioActivoId() !== tenantId) return;

    const mapProductos = new Map(
      (productosDb || [])
        .filter(p => String(p.negocio_id || '') === tenantId)
        .map(p => [String(p.id), p])
    );

    for (const item of carritoExpress) {
      const prodDb = mapProductos.get(String(item.id));
      if (!prodDb) {
        throw new Error(`El producto "${item.nombre}" ya no existe en el catálogo.`);
      }
      const stockReal = Number(prodDb.stock ?? 0);
      if (item.cantidad > stockReal) {
        throw new Error(`Stock insuficiente para "${prodDb.nombre}" (disponible: ${stockReal}).`);
      }
    }

    // 1. Registrar el pedido en 'pedidos' con cuadre contable exacto
    const totalFinal = Number((calcularTotalExpressCents() / 100).toFixed(2));
    const metodoNormalizado = metodoPago === 'Yape' ? 'Yape' : 'Efectivo';

    const pedidoPayload = {
      negocio_id: tenantId,
      cliente_nombre: 'Venta Express',
      cliente_telefono: 'Presencial',
      tipo_entrega: 'Presencial',
      direccion: null,
      metodo_pago: metodoNormalizado,
      total: totalFinal,
      estado: 'entregado'
    };

    const { data: pedidoCreado, error: pedidoErr } = await supabaseClient
      .from('pedidos')
      .insert(pedidoPayload)
      .select('id, numero_pedido')
      .single();

    if (pedidoErr || !pedidoCreado) {
      throw pedidoErr || new Error('No se pudo registrar la Venta Express.');
    }
    pedidoCreadoId = pedidoCreado.id;

    // 2. Registrar los ítems con los precios unitarios efectivos y subtotales exactos
    const itemsPayload = carritoExpress.map(i => {
      const subtotalItem = Number(Number(i.subtotal || 0).toFixed(2));
      const precioEfectivo = i.cantidad > 0 ? Number((subtotalItem / i.cantidad).toFixed(2)) : 0;
      return {
        pedido_id: pedidoCreado.id,
        producto_id: String(i.id),
        producto_nombre: i.nombre,
        precio_unitario: precioEfectivo,
        cantidad: Number(i.cantidad),
        subtotal: subtotalItem
      };
    });

    const { error: itemsErr } = await supabaseClient
      .from('pedido_items')
      .insert(itemsPayload);

    if (itemsErr) {
      throw itemsErr;
    }

    // 3. Descontar stock por producto usando la RPC FEFO descontar_stock_pos
    for (const item of carritoExpress) {
      const prodDb = mapProductos.get(String(item.id));
      const { error: rpcErr } = await supabaseClient.rpc('descontar_stock_pos', {
        p_producto_id: item.id,
        p_negocio_id: tenantId,
        p_cantidad: item.cantidad
      });

      if (rpcErr) {
        const rpcNoDisponible = rpcErr.code === 'PGRST202' || /Could not find the function/i.test(rpcErr.message || '');
        if (!rpcNoDisponible) {
          throw new Error(rpcErr.message || `No se pudo descontar stock de "${item.nombre}".`);
        }

        const nuevoStock = Number(prodDb.stock) - Number(item.cantidad);
        const { data: updRows, error: updErr } = await supabaseClient
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', item.id)
          .eq('negocio_id', tenantId)
          .gte('stock', item.cantidad)
          .select('id, stock');

        if (updErr) throw updErr;
        if (!updRows || updRows.length === 0) {
          throw new Error(`Stock insuficiente para "${item.nombre}" al confirmar el cobro.`);
        }
      }

      descontados.push({ id: item.id, cantidad: item.cantidad });
    }

    // 4. Limpiar carrito Express, recargar grid y métricas del Dashboard
    carritoExpress = [];
    if ($('#buscadorExpress')) $('#buscadorExpress').value = '';
    renderCarritoExpress();
    toast('¡Venta registrada!', 'success');
    await Promise.all([cargarProductosExpress(), loadProducts(), loadOrders(), cargarAlertasVencimiento()]);
  } catch (err) {
    console.error('Error procesando Venta Express:', err);
    if (descontados.length > 0) {
      await revertirStockPOS(descontados, tenantId);
    }
    if (pedidoCreadoId) {
      try {
        await supabaseClient
          .from('pedidos')
          .delete()
          .eq('id', pedidoCreadoId)
          .eq('negocio_id', tenantId);
      } catch (_) {}
    }
    toast(esc(err?.message || 'Error al registrar la Venta Express'), 'danger');
  } finally {
    procesandoVentaExpress = false;
    if (btnEf) btnEf.innerHTML = origEf;
    if (btnYp) btnYp.innerHTML = origYp;
    const vacio = carritoExpress.length === 0;
    if (btnEf) btnEf.disabled = vacio;
    if (btnYp) btnYp.disabled = vacio;
    if (totalInput) totalInput.disabled = vacio;
    if (vaciarBtn) vaciarBtn.disabled = vacio;
  }
}

if ($('#buscadorExpress')) {
  $('#buscadorExpress').addEventListener('input', renderGridProductosExpress);
}
if ($('#btnRecargarExpress')) {
  $('#btnRecargarExpress').addEventListener('click', cargarProductosExpress);
}
if ($('#btnVaciarExpress')) {
  $('#btnVaciarExpress').addEventListener('click', vaciarCarritoExpress);
}
if ($('#totalExpressInput')) {
  $('#totalExpressInput').addEventListener('change', (e) => editarTotalGlobalExpress(e.target.value));
  $('#totalExpressInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
}
if ($('#btnCobrarExpressEfectivo')) {
  $('#btnCobrarExpressEfectivo').addEventListener('click', () => procesarVentaExpress('Efectivo'));
}
if ($('#btnCobrarExpressYape')) {
  $('#btnCobrarExpressYape').addEventListener('click', () => procesarVentaExpress('Yape'));
}

// =============================================================================
// MÓDULO ADICIONAL: MÉTODOS DE PAGO POR NEGOCIO (negocios_pagos)
// =============================================================================
const PAGOS_INPUT_IDS = [
  '#pagoTitularNombre',
  '#pagoYapeNumero',
  '#pagoYapeQrUrl',
  '#pagoPlinNumero',
  '#pagoBcpCuenta',
  '#pagoBcpCci',
  '#pagoBbvaCuenta',
  '#pagoBbvaCci'
];

function mostrarAlertaMetodosPago(mensaje, tipo = 'warning') {
  const el = $('#pagosEstadoAlerta');
  if (!el) return;
  if (!mensaje) {
    el.textContent = '';
    el.className = 'alert d-none small mb-3';
    return;
  }
  const claseTipo = tipo === 'danger'
    ? 'alert-danger'
    : (tipo === 'info' ? 'alert-info' : 'alert-warning');
  el.textContent = mensaje;
  el.className = `alert ${claseTipo} small mb-3`;
}

function aplicarModoSoloLecturaPagos(soloLectura) {
  PAGOS_INPUT_IDS.forEach(sel => {
    const inp = $(sel);
    if (!inp) return;
    inp.readOnly = !!soloLectura;
    inp.disabled = !!soloLectura;
  });
  const btnGuardar = $('#btnGuardarMetodosPago');
  const btnLimpiar = $('#btnLimpiarMetodosPago');
  if (btnGuardar) btnGuardar.disabled = !!soloLectura || pagosSqlFaltanteAdmin;
  if (btnLimpiar) btnLimpiar.disabled = !!soloLectura || pagosSqlFaltanteAdmin;
}

function renderQrPreviewPagos() {
  const url = String($('#pagoYapeQrUrl')?.value || '').trim();
  const wrap = $('#pagoYapeQrPreviewWrap');
  const img = $('#pagoYapeQrPreview');
  const status = $('#pagoYapeQrPreviewStatus');
  if (!wrap || !img || !status) return;

  if (!url) {
    img.removeAttribute('src');
    delete img.dataset.previewUrl;
    wrap.classList.add('d-none');
    status.textContent = 'Sin URL de QR ingresada.';
    return;
  }

  let urlValida = url.length <= 500 && /^https:\/\/[^\s]+$/i.test(url);
  if (urlValida) {
    try {
      urlValida = new URL(url).protocol === 'https:';
    } catch (_) {
      urlValida = false;
    }
  }

  if (!urlValida) {
    img.removeAttribute('src');
    delete img.dataset.previewUrl;
    wrap.classList.add('d-none');
    status.textContent = 'La URL debe empezar con https:// (máx. 500 caracteres sin espacios) para previsualizar el QR.';
    return;
  }

  img.dataset.previewUrl = url;
  img.src = url;
  wrap.classList.remove('d-none');
  status.textContent = 'Cargando vista previa del QR...';
}

function limpiarUiMetodosPagoAdmin() {
  PAGOS_INPUT_IDS.forEach(sel => {
    const inp = $(sel);
    if (inp) inp.value = '';
  });
  mostrarAlertaMetodosPago('');
  const badge = $('#pagosConfigBadge');
  if (badge) {
    badge.className = 'badge bg-light text-dark border rounded-pill px-3 py-2';
    badge.textContent = 'Sin cargar';
  }
  aplicarModoSoloLecturaPagos(false);
  renderQrPreviewPagos();
}

function hidratarFormularioMetodosPago(row) {
  const r = row || {};
  const setVal = (sel, val) => {
    const el = $(sel);
    if (el) el.value = String(val || '');
  };
  setVal('#pagoTitularNombre', r.pago_titular_nombre);
  setVal('#pagoYapeNumero', r.pago_yape_numero);
  setVal('#pagoYapeQrUrl', r.pago_yape_qr_url);
  setVal('#pagoPlinNumero', r.pago_plin_numero);
  setVal('#pagoBcpCuenta', r.pago_banco_bcp_cuenta);
  setVal('#pagoBcpCci', r.pago_banco_bcp_cci);
  setVal('#pagoBbvaCuenta', r.pago_banco_bbva_cuenta);
  setVal('#pagoBbvaCci', r.pago_banco_bbva_cci);

  const hayDigital = Boolean(
    r.pago_yape_numero || r.pago_yape_qr_url || r.pago_plin_numero ||
    r.pago_banco_bcp_cuenta || r.pago_banco_bcp_cci ||
    r.pago_banco_bbva_cuenta || r.pago_banco_bbva_cci
  );
  const badge = $('#pagosConfigBadge');
  if (badge) {
    badge.className = hayDigital
      ? 'badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-2'
      : 'badge bg-secondary-subtle text-dark rounded-pill px-3 py-2';
    badge.textContent = hayDigital ? 'Métodos digitales activos' : 'Solo Contra entrega';
  }

  renderQrPreviewPagos();
}

function esErrorTablaPagosInexistente(error) {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  if (code === '42P01' || code === 'PGRST205') return true;
  const texto = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return /negocios_pagos.*(does not exist|no existe)|could not find the table/i.test(texto);
}

function mapearErrorDbPagos(error) {
  if (esErrorTablaPagosInexistente(error)) {
    return 'Falta ejecutar la actualización de base de datos (sql/11)';
  }
  const code = String(error?.code || '');
  const raw = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (code === '42501' || raw.includes('row-level security') || raw.includes('permission denied')) {
    return 'Tu cuenta está suspendida o no tienes permisos para editar estos datos.';
  }
  if (code === '23514') {
    const mapaCheck = [
      ['pagos_yape_fmt', 'El celular de Yape debe tener 9 dígitos y empezar con 9.'],
      ['pagos_plin_fmt', 'El celular de Plin debe tener 9 dígitos y empezar con 9.'],
      ['pagos_qr_fmt', 'La URL del QR Yape debe iniciar con https:// y tener máximo 500 caracteres sin espacios.'],
      ['pagos_bcp_cta_fmt', 'La cuenta BCP debe tener entre 8 y 20 caracteres (solo dígitos y guiones).'],
      ['pagos_bcp_cci_fmt', 'El CCI BCP debe tener exactamente 20 dígitos.'],
      ['pagos_bbva_cta_fmt', 'La cuenta BBVA debe tener entre 8 y 20 caracteres (solo dígitos y guiones).'],
      ['pagos_bbva_cci_fmt', 'El CCI BBVA debe tener exactamente 20 dígitos.'],
      ['pagos_titular_len', 'El nombre del titular debe tener entre 2 y 100 caracteres.']
    ];
    for (const [nombreCheck, msgLegible] of mapaCheck) {
      if (raw.includes(nombreCheck)) return msgLegible;
    }
    return 'Alguno de los datos ingresados no cumple con el formato permitido.';
  }
  return 'No se pudieron guardar los métodos de pago. Verifica tu conexión e intenta nuevamente.';
}

function normalizarCelularPago(raw, etiqueta) {
  const limpio = String(raw || '')
    .trim()
    .replace(/[\s\-()]+/g, '')
    .replace(/^\+?51(?=\d{9}$)/, '');
  if (!limpio) return { ok: true, valor: null };
  if (!/^9\d{8}$/.test(limpio)) {
    return {
      ok: false,
      error: `El celular de ${etiqueta} debe tener 9 dígitos y empezar con 9 (ej. 987654321).`
    };
  }
  return { ok: true, valor: limpio };
}

function validarCuentaBancariaPago(raw, banco) {
  const val = String(raw || '').trim();
  if (!val) return { ok: true, valor: null };
  if (!/^[0-9-]{8,20}$/.test(val)) {
    return {
      ok: false,
      error: `La cuenta ${banco} debe tener entre 8 y 20 caracteres (solo dígitos y guiones).`
    };
  }
  return { ok: true, valor: val };
}

function validarCciPago(raw, banco) {
  const val = String(raw || '').trim();
  if (!val) return { ok: true, valor: null };
  if (!/^\d{20}$/.test(val)) {
    return {
      ok: false,
      error: `El CCI ${banco} debe tener exactamente 20 dígitos numéricos (sin guiones ni espacios).`
    };
  }
  return { ok: true, valor: val };
}

function validarQrHttpsPago(raw) {
  const val = String(raw || '').trim();
  if (!val) return { ok: true, valor: null };
  if (val.length > 500 || !/^https:\/\/[^\s]+$/i.test(val)) {
    return {
      ok: false,
      error: 'La URL del QR Yape debe iniciar con https:// y tener máximo 500 caracteres sin espacios.'
    };
  }
  try {
    if (new URL(val).protocol !== 'https:') {
      return { ok: false, error: 'La URL del QR Yape debe usar protocolo https://.' };
    }
  } catch (_) {
    return { ok: false, error: 'La URL del QR Yape no es válida.' };
  }
  return { ok: true, valor: val };
}

async function cargarMetodosPagoAdmin() {
  if (!supabaseClient) return;
  let tenantId;
  try {
    tenantId = getTenantIdOrThrow();
  } catch (_) {
    limpiarUiMetodosPagoAdmin();
    return;
  }

  pagosSqlFaltanteAdmin = false;
  mostrarAlertaMetodosPago('');
  const suspendido = cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false;

  try {
    const { data, error } = await supabaseClient
      .from('negocios_pagos')
      .select('*')
      .eq('negocio_id', tenantId)
      .maybeSingle();

    if (getNegocioActivoId() !== tenantId) return;

    if (error) {
      console.error('Error consultando negocios_pagos:', error);
      if (esErrorTablaPagosInexistente(error)) {
        pagosSqlFaltanteAdmin = true;
        mostrarAlertaMetodosPago('Falta ejecutar la actualización de base de datos (sql/11)', 'danger');
        aplicarModoSoloLecturaPagos(true);
      } else {
        mostrarAlertaMetodosPago('No se pudieron cargar tus métodos de pago. Intenta nuevamente.', 'danger');
      }
      return;
    }

    hidratarFormularioMetodosPago(data);
    aplicarModoSoloLecturaPagos(suspendido);
    if (suspendido) {
      mostrarAlertaMetodosPago('Tu negocio está suspendido: los métodos de pago están en modo solo lectura.', 'warning');
    }
  } catch (err) {
    if (getNegocioActivoId() !== tenantId) return;
    console.error('Excepción cargando métodos de pago:', err);
    mostrarAlertaMetodosPago('No se pudieron cargar tus métodos de pago. Revisa tu conexión.', 'danger');
  }
}

async function guardarMetodosPagoAdmin(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  if (!supabaseClient || guardandoPagosAdmin) return;

  if (cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false) {
    aplicarModoSoloLecturaPagos(true);
    mostrarAlertaMetodosPago('Tu negocio está suspendido: no puedes modificar métodos de pago.', 'danger');
    return;
  }

  if (pagosSqlFaltanteAdmin) {
    mostrarAlertaMetodosPago('Falta ejecutar la actualización de base de datos (sql/11)', 'danger');
    return;
  }

  let tenantId;
  try {
    tenantId = getTenantIdOrThrow();
  } catch (err) {
    toast(esc(err.message || 'Sesión de negocio inválida.'), 'danger');
    return;
  }

  const yape = normalizarCelularPago($('#pagoYapeNumero')?.value, 'Yape');
  if (!yape.ok) {
    mostrarAlertaMetodosPago(yape.error, 'warning');
    $('#pagoYapeNumero')?.focus();
    return;
  }
  const qr = validarQrHttpsPago($('#pagoYapeQrUrl')?.value);
  if (!qr.ok) {
    mostrarAlertaMetodosPago(qr.error, 'warning');
    $('#pagoYapeQrUrl')?.focus();
    return;
  }
  const plin = normalizarCelularPago($('#pagoPlinNumero')?.value, 'Plin');
  if (!plin.ok) {
    mostrarAlertaMetodosPago(plin.error, 'warning');
    $('#pagoPlinNumero')?.focus();
    return;
  }
  const bcpCuenta = validarCuentaBancariaPago($('#pagoBcpCuenta')?.value, 'BCP');
  if (!bcpCuenta.ok) {
    mostrarAlertaMetodosPago(bcpCuenta.error, 'warning');
    $('#pagoBcpCuenta')?.focus();
    return;
  }
  const bcpCci = validarCciPago($('#pagoBcpCci')?.value, 'BCP');
  if (!bcpCci.ok) {
    mostrarAlertaMetodosPago(bcpCci.error, 'warning');
    $('#pagoBcpCci')?.focus();
    return;
  }
  const bbvaCuenta = validarCuentaBancariaPago($('#pagoBbvaCuenta')?.value, 'BBVA');
  if (!bbvaCuenta.ok) {
    mostrarAlertaMetodosPago(bbvaCuenta.error, 'warning');
    $('#pagoBbvaCuenta')?.focus();
    return;
  }
  const bbvaCci = validarCciPago($('#pagoBbvaCci')?.value, 'BBVA');
  if (!bbvaCci.ok) {
    mostrarAlertaMetodosPago(bbvaCci.error, 'warning');
    $('#pagoBbvaCci')?.focus();
    return;
  }

  const hayMetodoDigital = Boolean(
    yape.valor || qr.valor || plin.valor ||
    bcpCuenta.valor || bcpCci.valor || bbvaCuenta.valor || bbvaCci.valor
  );

  const titularLimpio = String($('#pagoTitularNombre')?.value || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();

  if (hayMetodoDigital && !titularLimpio) {
    mostrarAlertaMetodosPago('Ingresa el nombre del titular (obligatorio si configuras al menos un método digital).', 'warning');
    $('#pagoTitularNombre')?.focus();
    return;
  }

  if (titularLimpio && (titularLimpio.length < 2 || titularLimpio.length > 100)) {
    mostrarAlertaMetodosPago('El nombre del titular debe tener entre 2 y 100 caracteres.', 'warning');
    $('#pagoTitularNombre')?.focus();
    return;
  }

  mostrarAlertaMetodosPago('');
  guardandoPagosAdmin = true;
  const btn = $('#btnGuardarMetodosPago');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
  }

  try {
    const payload = {
      negocio_id: tenantId,
      pago_titular_nombre: titularLimpio || null,
      pago_yape_numero: yape.valor || null,
      pago_yape_qr_url: qr.valor || null,
      pago_plin_numero: plin.valor || null,
      pago_banco_bcp_cuenta: bcpCuenta.valor || null,
      pago_banco_bcp_cci: bcpCci.valor || null,
      pago_banco_bbva_cuenta: bbvaCuenta.valor || null,
      pago_banco_bbva_cci: bbvaCci.valor || null
    };

    const { data, error } = await supabaseClient
      .from('negocios_pagos')
      .upsert(payload, { onConflict: 'negocio_id' })
      .select()
      .single();

    if (error) {
      if (esErrorTablaPagosInexistente(error)) {
        pagosSqlFaltanteAdmin = true;
      }
      console.error('Error guardando negocios_pagos:', error);
      const msg = mapearErrorDbPagos(error);
      mostrarAlertaMetodosPago(msg, 'danger');
      toast(esc(msg), 'danger');
      return;
    }

    if (getNegocioActivoId() !== tenantId) return;
    if (!data || String(data.negocio_id) !== tenantId) {
      mostrarAlertaMetodosPago('No se pudo confirmar el guardado para este negocio.', 'danger');
      return;
    }

    hidratarFormularioMetodosPago(data);
    toast('✅ Métodos de pago guardados correctamente.', 'success');
  } catch (err) {
    console.error('Excepción guardando negocios_pagos:', err);
    const msg = mapearErrorDbPagos(err);
    mostrarAlertaMetodosPago(msg, 'danger');
    toast(esc(msg), 'danger');
  } finally {
    guardandoPagosAdmin = false;
    if (btn) {
      btn.innerHTML = origHtml;
      btn.disabled = cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false || pagosSqlFaltanteAdmin;
    }
  }
}

if ($('#pagoYapeQrUrl')) {
  $('#pagoYapeQrUrl').addEventListener('input', renderQrPreviewPagos);
}
if ($('#pagoYapeQrPreview')) {
  $('#pagoYapeQrPreview').addEventListener('load', () => {
    const status = $('#pagoYapeQrPreviewStatus');
    if (status && $('#pagoYapeQrPreview')?.getAttribute('src')) {
      status.textContent = 'Vista previa del QR lista.';
    }
  });
  $('#pagoYapeQrPreview').addEventListener('error', () => {
    const wrap = $('#pagoYapeQrPreviewWrap');
    const img = $('#pagoYapeQrPreview');
    const status = $('#pagoYapeQrPreviewStatus');
    if (img && img.getAttribute('src')) {
      img.removeAttribute('src');
      delete img.dataset.previewUrl;
      if (wrap) wrap.classList.add('d-none');
      if (status) status.textContent = 'No se pudo cargar la imagen desde esa URL.';
    }
  });
}
if ($('#formMetodosPago')) {
  $('#formMetodosPago').addEventListener('submit', guardarMetodosPagoAdmin);
}
if ($('#btnLimpiarMetodosPago')) {
  $('#btnLimpiarMetodosPago').addEventListener('click', () => {
    if (cuentaSuspendidaAdmin || window.negocioAdminActual?.activo === false || pagosSqlFaltanteAdmin || guardandoPagosAdmin) return;
    PAGOS_INPUT_IDS.forEach(sel => {
      const el = $(sel);
      if (el) el.value = '';
    });
    mostrarAlertaMetodosPago('Campos limpiados. Pulsa "Guardar Métodos de Pago" para aplicar el cambio en tu tienda.', 'info');
    renderQrPreviewPagos();
  });
}

// Inicialización de la sesión al cargar el archivo
checkSession();
