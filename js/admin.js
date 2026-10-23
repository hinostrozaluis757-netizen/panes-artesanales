let supabaseClient = null;
try {
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } else { alert("Faltan las llaves de conexión en config.js"); }
} catch (e) { alert("Error al iniciar Supabase: " + e.message); }

let allOrders = [], currentPeriod = 'hoy', chartInstance = null;
let allProducts = [], editingProduct = null;
let currentAdminCategory = 'Todos';
let currentCajaPeriod = 'hoy'; // Variable para el filtro de caja

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const fmt = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const fmtDate = (iso) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => /^https:\/\//i.test(u || '') ? esc(u) : '';
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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

// LOGIN Y SESIÓN
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) showDashboard(session.user.email); else showLogin();
}
function showLogin() { $('#loginView').classList.remove('d-none'); $('#dashboardView').classList.add('d-none'); }
function showDashboard(email) { 
  $('#loginView').classList.add('d-none'); $('#dashboardView').classList.remove('d-none'); 
  $('#userEmail').textContent = email; 
  loadOrders(); loadProducts(); 
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn'), orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = 'Verificando...'; $('#loginError').classList.add('d-none');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: $('#loginEmail').value, password: $('#loginPassword').value });
  btn.disabled = false; btn.innerHTML = orig;
  if (error) { $('#loginError').textContent = '❌ Credenciales incorrectas'; $('#loginError').classList.remove('d-none'); }
  else showDashboard(data.user.email);
});
$('#logoutBtn').addEventListener('click', async () => { await supabaseClient.auth.signOut(); showLogin(); });

// NAVEGACIÓN PESTAÑAS PRINCIPALES
$$('#adminTabs .nav-link').forEach(btn => {
  btn.addEventListener('click', (e) => {
    $$('#adminTabs .nav-link').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    // Ocultar todas las pestañas
    $('#tabPedidos').classList.add('d-none'); 
    $('#tabProductos').classList.add('d-none'); 
    $('#tabCaja').classList.add('d-none');
    // Mostrar la seleccionada
    $('#' + e.target.dataset.target).classList.remove('d-none');
  });
});

// --- PEDIDOS Y DASHBOARD ---
async function loadOrders() {
  const { data, error } = await supabaseClient.from('pedidos').select('*, pedido_items(*)').order('fecha', { ascending: false }).limit(1000);
  if (error) { console.error(error); toast('Error cargando pedidos', 'danger'); return; }
  allOrders = data || []; 
  renderDashboard();
  renderCaja(); // <-- Actualizar la caja al cargar pedidos
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
  const search = $('#searchOrders').value.toLowerCase().trim();
  const filtered = search ? orders.filter(o => (o.cliente_nombre || '').toLowerCase().includes(search) || (o.cliente_telefono || '').includes(search)) : orders;
  if (!filtered.length) return $('#ordersTable').innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Sin pedidos</td></tr>';
  const signedUrls = await Promise.all(filtered.map(o => obtenerUrlFirmada(o.comprobante_url)));
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
    if (sel.dataset.prev === 'pendiente' && newState === 'aceptado') { sel.value = 'pendiente'; return openAcceptOrderModal(id); }
    sel.disabled = true;
    const { error } = await supabaseClient.from('pedidos').update({ estado: newState }).eq('id', id);
    sel.disabled = false;
    if (error) { console.error(error); sel.value = sel.dataset.prev; return toast('Error al actualizar el estado', 'danger'); }
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
    if (!id || !minutos) return;
    const btn = $('#btnConfirmAcceptOrder'), orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Aceptando...';
    const ahoraIso = new Date().toISOString();
    const { data, error } = await supabaseClient
      .from('pedidos')
      .update({ estado: 'aceptado', tiempo_estimado_min: minutos, aceptado_en: ahoraIso })
      .eq('id', id)
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })); a.download = `don-roberto-${currentPeriod}-${new Date().toISOString().slice(0,10)}.csv`; a.click(); toast('CSV descargado correctamente');
});

// --- GESTIÓN DE PRODUCTOS ---
async function loadProducts() {
  const { data, error } = await supabaseClient.from('productos').select('*').order('nombre');
  if (error) { console.error(error); toast('Error cargando productos', 'danger'); return; }
  allProducts = data || [];
  renderAdminProducts();
}

function renderAdminProducts() {
  const filtered = currentAdminCategory === 'Todos' ? allProducts : allProducts.filter(p => p.categoria === currentAdminCategory);
  if (!filtered.length) { $('#productsTable').innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay productos en esta categoría.</td></tr>'; return; }
  $('#productsTable').innerHTML = filtered.map(p => `
    <tr>
      <td><img src="${p.imagen_url || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;"></td>
      <td><strong>${p.nombre}</strong></td><td>${fmt(p.precio)}</td><td><span class="badge bg-secondary">${p.categoria}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="editProduct('${p.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${p.id}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

$$('#adminCategoryFilter button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('#adminCategoryFilter button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAdminCategory = btn.dataset.filter;
    renderAdminProducts();
  });
});

window.clearForm = () => {
  editingProduct = null; $('#pId').value = ''; $('#pNombre').value = ''; $('#pDesc').value = ''; $('#pPrecio').value = ''; $('#pImagen').value = ''; $('#pPreview').style.display = 'none';
  $('#modalTitle').textContent = 'Nuevo Producto';
};

window.editProduct = (id) => {
  const p = allProducts.find(x => String(x.id) === String(id));
  if (!p) return toast('Producto no encontrado', 'warning');
  editingProduct = p;
  $('#pId').value = p.id; $('#pNombre').value = p.nombre; $('#pDesc').value = p.descripcion || ''; $('#pPrecio').value = p.precio; $('#pCat').value = p.categoria; $('#pImagen').value = '';
  if (p.imagen_url) { $('#pPreview').src = p.imagen_url; $('#pPreview').style.display = 'block'; }
  else { $('#pPreview').removeAttribute('src'); $('#pPreview').style.display = 'none'; }
  $('#modalTitle').textContent = 'Editar Producto'; bootstrap.Modal.getOrCreateInstance($('#productModal')).show();
};

window.deleteProduct = async (id) => {
  if (!confirm('¿Eliminar producto?')) return;
  const { error } = await supabaseClient.from('productos').delete().eq('id', id);
  if (error) { console.error(error); return toast('No se pudo eliminar: ' + esc(error.message), 'danger'); }
  loadProducts(); toast('Producto eliminado');
};

$('#pImagen').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) { const reader = new FileReader(); reader.onload = (ev) => { $('#pPreview').src = ev.target.result; $('#pPreview').style.display = 'block'; }; reader.readAsDataURL(file); }
});

$('#btnSaveProduct').addEventListener('click', async () => {
  const id = $('#pId').value, nombre = $('#pNombre').value, desc = $('#pDesc').value;
  const precio = parseFloat($('#pPrecio').value), cat = $('#pCat').value, file = $('#pImagen').files[0];
  if (!nombre || !precio) return alert('Nombre y precio obligatorios');
  const btn = $('#btnSaveProduct'); btn.textContent = 'Guardando...'; btn.disabled = true;
  let imagen_url = editingProduct ? editingProduct.imagen_url : null;
  try {
    if (file) {
      const path = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
      const { error: err } = await supabaseClient.storage.from('productos').upload(path, file);
      if (err) throw err;
      const { data } = supabaseClient.storage.from('productos').getPublicUrl(path);
      imagen_url = data.publicUrl;
    }
    const payload = { nombre, descripcion: desc, precio, categoria: cat, imagen_url };
    const { error: dbErr } = id ? await supabaseClient.from('productos').update(payload).eq('id', id) : await supabaseClient.from('productos').insert(payload);
    if (dbErr) throw dbErr;
    bootstrap.Modal.getInstance($('#productModal')).hide(); loadProducts(); toast('Producto guardado ✅');
  } catch (error) { alert("Error al guardar: " + error.message); } finally { btn.textContent = 'Guardar'; btn.disabled = false; }
});

// ==========================================
// LÓGICA DE CIERRE DE CAJA
// ==========================================
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
    } else if (metodo.includes('bcp') || metodo.includes('bbva') || metodo.includes('transferencia')) {
      totalBanco += monto; countBanco++;
    }
  });

  $('#cajaEfectivo').textContent = fmt(totalEfectivo);
  $('#cajaEfectivoCount').textContent = `${countEfectivo} pedidos`;
  $('#cajaYape').textContent = fmt(totalYape);
  $('#cajaYapeCount').textContent = `${countYape} pedidos`;
  $('#cajaBanco').textContent = fmt(totalBanco);
  $('#cajaBancoCount').textContent = `${countBanco} pedidos`;

  // --- INICIO: AGREGADO PARA TOTAL DIGITAL ---
  const elDigital = document.getElementById('cajaTotalDigital');
  if (elDigital) elDigital.textContent = fmt(totalYape + totalBanco);
  // --- FIN: AGREGADO PARA TOTAL DIGITAL ---

  if (!validOrders.length) {
    $('#cajaTableBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay movimientos en este período.</td></tr>';
    return;
  }

  const sorted = [...validOrders].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  const signedUrls = await Promise.all(sorted.map(o => obtenerUrlFirmada(o.comprobante_url)));

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

checkSession();
// ==========================================
// FUNCIÓN PARA IMPRIMIR EL CIERRE DE CAJA (BOUCHER)
// ==========================================
function imprimirCierreCaja() {
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
    } else if (metodo.includes('bcp') || metodo.includes('bbva') || metodo.includes('transferencia')) {
      totalBanco += monto; countBanco++;
    }
  });

  // Formatear el texto del período
  let textoPeriodo = 'Hoy';
  if (currentCajaPeriod === 'semana') textoPeriodo = 'Esta Semana';
  if (currentCajaPeriod === 'mes') textoPeriodo = 'Este Mes';
  const fechaActual = new Date().toLocaleString('es-PE');

  // Construir el HTML del boucher
  const ventanaImpresion = window.open('', '_blank');
  if (!ventanaImpresion) return toast('Permite ventanas emergentes para imprimir el cierre', 'warning');
  ventanaImpresion.document.write(`
    <html>
      <head>
        <title>Cierre de Caja - Don Roberto</title>
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
          <h2>DON ROBERTO</h2>
          <p>PANES ARTESANALES</p>
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
          Generado por el Sistema de Don Roberto<br>
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