// 1. INICIALIZACIÓN SEGURA
let supabaseClient = null;
try {
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
} catch (e) { console.error("Error al iniciar Supabase:", e); }

const WHATSAPP_NUMBER = window.WHATSAPP_NUMBER || '51926549398';
const CART_KEY = 'donRobertoCart_v1';

const PAYMENT_INFO = {
  yape: { label: 'Yape', phone: '926 549 398', titular: 'Roberto Panes', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=YAPE-926549398' },
  plin: { label: 'Plin', phone: '926 549 398', titular: 'Roberto Panes' },
  bcp: { label: 'Transferencia BCP', banco: 'BCP', cuenta: '193-2345678-0-12', cci: '002-193-002345678012-15', titular: 'Roberto Panes SAC', color: '#FF6B00' },
  bbva: { label: 'BBVA Continental', banco: 'BBVA', cuenta: '0011-0234-0100456789', cci: '011-234-000100456789-12', titular: 'Roberto Panes SAC', color: '#004481' },
  contraentrega: { label: 'Contra entrega', nota: 'Pagas en efectivo al recibir tu pedido.' }
};

let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
let selectedPayment = null;
let comprobanteFile = null;

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const formatPrice = (n) => `S/ ${n.toFixed(2)}`;
const saveCart = () => localStorage.setItem(CART_KEY, JSON.stringify(cart));

// --- NUEVO: CARGAR PRODUCTOS DESDE SUPABASE ---
async function loadProducts() {
  if (!supabaseClient) return;
  const { data: productos, error } = await supabaseClient.from('productos').select('*').eq('activo', true);
  if (error) { console.error(error); return; }

  ['salados', 'dulces', 'sanguches', 'bebidas'].forEach(cat => {
    const el = $(`#lista-${cat}`);
    if (el) el.innerHTML = '';
  });

  productos.forEach(prod => {
    let contenedor = null;
    if (prod.categoria === 'Salados') contenedor = $('#lista-salados');
    else if (prod.categoria === 'Dulces') contenedor = $('#lista-dulces');
    else if (prod.categoria === 'Sánguches') contenedor = $('#lista-sanguches');
    else contenedor = $('#lista-bebidas');

    if (contenedor) {
      contenedor.insertAdjacentHTML('beforeend', `
        <div class="col-sm-6 col-lg-3">
          <div class="product-card">
            <div class="product-img-wrapper">
              <img src="${prod.imagen_url || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80'}" alt="${prod.nombre}">
            </div>
            <div class="product-body">
              <div>
                <h4 class="product-title">${prod.nombre}</h4>
                <p class="text-muted small">${prod.descripcion || ''}</p>
              </div>
              <div class="product-footer">
                <span class="product-price">${formatPrice(prod.precio)}</span>
                <button class="btn-order-item btn-add-cart" data-id="${prod.id}" data-name="${prod.nombre}" data-price="${prod.precio}" data-img="${prod.imagen_url || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80'}"><i class="bi bi-cart-plus"></i> Agregar</button>
              </div>
            </div>
          </div>
        </div>
      `);
    }
  });

  // Reactivar botones de agregar
  $$('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCart({ id: btn.dataset.id, name: btn.dataset.name, price: parseFloat(btn.dataset.price), img: btn.dataset.img });
    });
  });
}

// 2. NOTIFICACIONES (TOASTS)
function showToast(message, type = 'success') {
  const container = $('#toastContainer');
  if (!container) return;
  const bg = { success: 'text-bg-success', warning: 'text-bg-warning', danger: 'text-bg-danger' }[type] || 'text-bg-success';
  const id = 'toast-' + Date.now();
  container.insertAdjacentHTML('beforeend', `<div id="${id}" class="toast align-items-center ${bg} border-0"><div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`);
  new bootstrap.Toast(document.getElementById(id), { delay: 2600 }).show();
}

// 3. LÓGICA DEL CARRITO
function addToCart(product) {
  const existing = cart.find((i) => i.id === product.id);
  if (existing) { existing.qty += 1; } else { cart.push({ ...product, qty: 1 }); }
  saveCart(); renderCart(); updateCartCount(); showToast(`<strong>${product.name}</strong> agregado`);
}

function updateQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((i) => i.id !== id);
  saveCart(); renderCart(); updateCartCount();
}

function removeItem(id) { cart = cart.filter((i) => i.id !== id); saveCart(); renderCart(); updateCartCount(); }

function clearCart() {
  if (!cart.length) return;
  if (!confirm('¿Vaciar el carrito completo?')) return;
  cart = []; saveCart(); renderCart(); updateCartCount(); showToast('Carrito vaciado', 'info');
}

function getCartTotal() { return cart.reduce((sum, i) => sum + i.price * i.qty, 0); }

function updateCartCount() {
  const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
  const badge = $('#cartCount');
  if (badge) { badge.textContent = totalQty; badge.style.display = totalQty > 0 ? 'flex' : 'none'; }
}

function renderCart() {
  const container = $('#cartItems'), empty = $('#cartEmpty'), footer = $('#cartFooter');
  if (!container) return;
  if (!cart.length) { container.innerHTML = ''; empty.style.display = 'block'; footer.style.display = 'none'; return; }
  empty.style.display = 'none'; footer.style.display = 'block';
  container.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <img src="${item.img}" alt="${item.name}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatPrice(item.price)}</div>
        <div class="qty-control">
          <button class="qty-btn" data-action="dec" data-id="${item.id}">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
          <button class="btn-remove-item ms-auto" data-action="remove" data-id="${item.id}"><i class="bi bi-trash"></i></button>
        </div>
      </div>
      <div class="fw-bold" style="color: var(--verde-bosque);">${formatPrice(item.price * item.qty)}</div>
    </div>
  `).join('');
  $('#cartSubtotal').textContent = formatPrice(getCartTotal());
  $$('.qty-btn', container).forEach((btn) => btn.addEventListener('click', () => updateQty(btn.dataset.id, btn.dataset.action === 'inc' ? 1 : -1)));
  $$('.btn-remove-item', container).forEach((btn) => btn.addEventListener('click', () => removeItem(btn.dataset.id)));
}

// 4. CHECKOUT
function renderCheckoutSummary() {
  const container = $('#checkoutSummary');
  if (!container) return;
  container.innerHTML = `${cart.map((i) => `<div class="checkout-item-row"><span>${i.qty}× ${i.name}</span><strong>${formatPrice(i.price * i.qty)}</strong></div>`).join('')}<div class="checkout-item-row mt-2" style="font-size: 1.05rem;"><strong>TOTAL</strong><strong style="color: var(--dorado-pan);">${formatPrice(getCartTotal())}</strong></div>`;
}

function renderPaymentPanel(method) {
  const panel = $('#paymentPanel');
  if (!panel) return;
  if (!method) { panel.style.display = 'none'; return; }
  const info = PAYMENT_INFO[method]; let html = '';
  if (method === 'yape') html = `<h6 class="fw-bold mb-2">Pago con Yape</h6><div class="qr-box mb-2"><img src="${info.qr}"><div class="mt-2 small"><strong>Titular:</strong> ${info.titular}</div></div><div class="d-flex justify-content-between bg-white p-2 rounded"><span class="small"><strong>Número:</strong> ${info.phone}</span></div>`;
  else if (method === 'plin') html = `<h6 class="fw-bold mb-2">Pago con Plin</h6><div class="bg-white p-3 rounded mb-2"><div class="small text-muted">Número</div><div class="fw-bold">${info.phone}</div></div>`;
  else if (method === 'bcp' || method === 'bbva') html = `<h6 class="fw-bold mb-2">Transferencia ${info.banco}</h6><div class="bg-white p-3 rounded mb-2"><div class="small text-muted">Cuenta</div><div class="fw-bold mb-2">${info.cuenta}</div><div class="small text-muted">CCI</div><div class="fw-bold">${info.cci}</div></div>`;
  else html = `<h6 class="fw-bold mb-2">Contra entrega</h6><p class="mb-0 small">${info.nota}</p>`;
  panel.innerHTML = `<div class="payment-detail">${html}</div>`; panel.style.display = 'block';
  const req = ['yape', 'plin', 'bcp', 'bbva'].includes(method);
  $('#comprobanteSection').style.display = req ? 'block' : 'none';
  if (!req) resetComprobante();
}

// 5. COMPROBANTE
function handleComprobanteSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  comprobanteFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => { $('#comprobanteImg').src = ev.target.result; $('#comprobanteLabel').style.display = 'none'; $('#comprobantePreview').style.display = 'block'; };
  reader.readAsDataURL(file);
}

function resetComprobante() {
  comprobanteFile = null;
  if ($('#comprobanteInput')) $('#comprobanteInput').value = '';
  if ($('#comprobanteLabel')) $('#comprobanteLabel').style.display = 'block';
  if ($('#comprobantePreview')) $('#comprobantePreview').style.display = 'none';
}

// 6. CONFIRMAR PEDIDO
async function confirmOrder() {
  const nombre = $('#cNombre').value.trim(), telefono = $('#cTelefono').value.trim();
  const tipo = $('#cTipoEntrega').value, direccion = $('#cDireccion').value.trim();
  if (!nombre || !telefono) return showToast('Completa nombre y teléfono', 'warning');
  if (tipo === 'Delivery' && !direccion) return showToast('Ingresa dirección', 'warning');
  if (!selectedPayment) return showToast('Selecciona un método de pago', 'warning');
  if (['yape', 'plin', 'bcp', 'bbva'].includes(selectedPayment) && !comprobanteFile) return showToast('Adjunta la captura de tu pago', 'warning');

  const total = getCartTotal(), pagoLabel = PAYMENT_INFO[selectedPayment].label;
  const btn = $('#btnConfirmOrder'), orig = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = 'Procesando...';

  try {
    if (!supabaseClient) {
      showToast('Error de conexión con el servidor. Intenta nuevamente.', 'danger');
      return;
    }
    const telefonoLimpio = telefono.replace(/[\s\-()]/g, '').replace(/^\+?51(?=\d{9}$)/, '');
    let comprobantePath = null;
    if (comprobanteFile) {
      const rawExt = (comprobanteFile.name.split('.').pop() || '').toLowerCase();
      const allowedExts = { jpg: 'jpg', jpeg: 'jpeg', png: 'png', webp: 'webp' };
      const mimeExts = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      const ext = allowedExts[rawExt] || mimeExts[comprobanteFile.type];
      if (!ext) {
        showToast('Formato de imagen no válido. Usa JPG, PNG o WEBP.', 'warning');
        return;
      }
      const uuid = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
      comprobantePath = `pedidos/${uuid}.${ext}`;
      const { error: upErr } = await supabaseClient.storage
        .from('comprobantes')
        .upload(comprobantePath, comprobanteFile, { upsert: false, contentType: comprobanteFile.type || `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      if (upErr) {
        console.error('Error subiendo comprobante:', upErr);
        showToast('No se pudo subir el comprobante (máx. 5 MB, JPG/PNG/WEBP).', 'danger');
        return;
      }
    }
    const itemsPayload = cart.map(i => ({ producto_id: String(i.id), cantidad: Number(i.qty) }));
    const { data: pedido, error } = await supabaseClient.rpc('registrar_pedido_seguro', {
      p_nombre: nombre,
      p_telefono: telefonoLimpio,
      p_tipo_entrega: tipo,
      p_direccion: tipo === 'Delivery' ? direccion : null,
      p_metodo_pago: pagoLabel,
      p_comprobante_url: comprobantePath,
      p_items: itemsPayload
    });
    if (error || !pedido) {
      console.error('Error en registrar_pedido_seguro:', error);
      showToast((error && error.message) ? error.message : 'No se pudo registrar el pedido. Intenta nuevamente.', 'danger');
      return;
    }
    const numeroPedido = pedido.numero_pedido;
    let msg = `🛒 *NUEVO PEDIDO #${numeroPedido}*\n👤 ${nombre}\n📱 ${telefono}\n📍 ${tipo}\n`;
    if (tipo === 'Delivery') msg += `🏠 ${direccion}\n`;
    cart.forEach(i => { msg += `• ${i.qty}× ${i.name} — ${formatPrice(i.price * i.qty)}\n`; });
    msg += `\n*TOTAL: ${formatPrice(total)}*\nPago: ${pagoLabel}`;
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    const waWin = window.open(waUrl, '_blank');
    if (!waWin) { cart = []; saveCart(); window.location.href = waUrl; return; } // Fallback si el navegador bloquea la ventana (iPhone)
    showToast(`Pedido enviado ✅`);
    setTimeout(() => {
      cart = []; saveCart(); renderCart(); updateCartCount(); resetComprobante();
      const m = bootstrap.Modal.getInstance($('#checkoutModal')); if(m) m.hide();
      const o = bootstrap.Offcanvas.getInstance($('#cartOffcanvas')); if(o) o.hide();
    }, 1000);
  } catch (err) { console.error(err); showToast('Error procesando el pedido', 'danger'); }
  finally { btn.disabled = false; btn.innerHTML = orig; }
}

// 7. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  loadProducts(); 
  renderCart(); updateCartCount();

  // --- LÓGICA DE LAS PESTAÑAS (MENÚ) ---
  const categoryButtons = document.querySelectorAll('#category-menu .category-pill');
  const categorySections = document.querySelectorAll('.category-section');

  if (categoryButtons.length > 0) {
    categoryButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que el botón recargue la página
        
        // 1. Quitar la clase 'active' de todos los botones
        categoryButtons.forEach(b => b.classList.remove('active'));
        // 2. Poner 'active' al botón seleccionado
        btn.classList.add('active');
        
        // 3. Ocultar todas las secciones
        categorySections.forEach(section => section.classList.add('d-none'));
        // 4. Mostrar la sección seleccionada
        const targetId = btn.dataset.target;
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.remove('d-none');
      });
    });
  }

  if ($('#btnClearCart')) $('#btnClearCart').addEventListener('click', clearCart);
  if ($('#btnCheckout')) $('#btnCheckout').addEventListener('click', () => {
    if (!cart.length) return;
    renderCheckoutSummary(); selectedPayment = null;
    $$('.payment-option').forEach(el => el.classList.remove('selected'));
    renderPaymentPanel(null);
    const offcanvas = bootstrap.Offcanvas.getInstance($('#cartOffcanvas')); if (offcanvas) offcanvas.hide();
    new bootstrap.Modal($('#checkoutModal')).show();
  });
  $$('.payment-option').forEach(opt => opt.addEventListener('click', () => {
    $$('.payment-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected'); selectedPayment = opt.dataset.pay; renderPaymentPanel(selectedPayment);
  }));
  if ($('#cTipoEntrega')) $('#cTipoEntrega').addEventListener('change', (e) => { $('#direccionGroup').style.display = e.target.value === 'Delivery' ? 'block' : 'none'; });
  if ($('#btnConfirmOrder')) $('#btnConfirmOrder').addEventListener('click', confirmOrder);
  if ($('#comprobanteInput')) $('#comprobanteInput').addEventListener('change', handleComprobanteSelect);
  if ($('#btnRemoveComprobante')) $('#btnRemoveComprobante').addEventListener('click', resetComprobante);
});

// ===== MI PEDIDO =====
/*
  Documentación SQL (columnas y políticas RLS ya configuradas en Supabase):
  ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS tiempo_estimado_min integer,
    ADD COLUMN IF NOT EXISTS aceptado_en timestamptz;

  -- Si existe restricción CHECK en pedidos.estado, incluir 'aceptado' y 'en_camino':
  -- ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
  -- ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  --   CHECK (estado IN ('pendiente','aceptado','en_camino','pagado','entregado','cancelado'));

  -- Políticas RLS para usuarios anónimos:
  CREATE POLICY "anon_select_pedidos"
    ON pedidos FOR SELECT TO anon
    USING (true);

  CREATE POLICY "anon_cancel_pending_pedidos"
    ON pedidos FOR UPDATE TO anon
    USING (estado = 'pendiente')
    WITH CHECK (estado = 'cancelado');
*/
(() => {
  const TRACK_PHONE_KEY = 'donRobertoTrackPhone_v1';
  let trackRefreshTimer = null;
  let lastSearchedPhone = '';

  function normalizePhone(raw) {
    return String(raw || '')
      .trim()
      .replace(/[\s\-]/g, '')
      .replace(/^\+?51(?=\d{9}$)/, '');
  }

  function stopTrackRefresh() {
    if (trackRefreshTimer) {
      clearInterval(trackRefreshTimer);
      trackRefreshTimer = null;
    }
  }

  function startTrackRefresh() {
    stopTrackRefresh();
    trackRefreshTimer = setInterval(() => {
      const modalEl = $('#trackOrderModal');
      if (modalEl && modalEl.classList.contains('show') && lastSearchedPhone) {
        buscarMiPedido(true);
      } else {
        stopTrackRefresh();
      }
    }, 30000);
  }

  function getBadgeInfo(estado) {
    switch (estado) {
      case 'pendiente': return { label: 'Pendiente', cls: 'bg-warning text-dark' };
      case 'aceptado': return { label: 'Aceptado', cls: 'bg-primary text-white' };
      case 'en_camino': return { label: 'En camino', cls: 'bg-info text-dark' };
      case 'entregado': return { label: 'Entregado', cls: 'bg-success text-white' };
      case 'cancelado': return { label: 'Cancelado', cls: 'bg-danger text-white' };
      case 'pagado': return { label: 'Pagado', cls: 'bg-success text-white' };
      default: return { label: String(estado || ''), cls: 'bg-secondary text-white' };
    }
  }

  function getStatusMessage(pedido) {
    const estado = pedido.estado;
    if (estado === 'pendiente') {
      return 'Recibimos tu pedido. Esperando confirmación.';
    }
    if (estado === 'aceptado') {
      const aceptadoMs = pedido.aceptado_en ? new Date(pedido.aceptado_en).getTime() : NaN;
      const min = Number(pedido.tiempo_estimado_min || 0);
      if (!isNaN(aceptadoMs) && min > 0) {
        const llegadaMs = aceptadoMs + min * 60000;
        const restanteMin = Math.ceil((llegadaMs - Date.now()) / 60000);
        if (restanteMin > 0) {
          const horaEstimada = new Date(llegadaMs).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
          return `¡Tu pedido fue aceptado! Llegará en aprox. ${restanteMin} min (hora estimada: ${horaEstimada})`;
        }
      }
      return 'Tu pedido está por llegar';
    }
    if (estado === 'en_camino') return 'Tu pedido va en camino';
    if (estado === 'entregado') return 'Pedido entregado. ¡Gracias!';
    if (estado === 'cancelado') return 'Pedido cancelado';
    if (estado === 'pagado') return 'Pago confirmado. Estamos preparando tu pedido.';
    return '';
  }

  function renderOrderCard(pedido) {
    const card = document.createElement('div');
    card.className = 'card mb-3 shadow-sm border-0';
    card.style.backgroundColor = 'var(--crema-claro)';

    const body = document.createElement('div');
    body.className = 'card-body p-3';

    const topRow = document.createElement('div');
    topRow.className = 'd-flex justify-content-between align-items-center mb-1';

    const title = document.createElement('h6');
    title.className = 'fw-bold mb-0';
    title.style.color = 'var(--verde-bosque)';
    title.textContent = `Pedido #${pedido.numero_pedido}`;

    const badgeInfo = getBadgeInfo(pedido.estado);
    const badge = document.createElement('span');
    badge.className = `badge rounded-pill ${badgeInfo.cls}`;
    badge.textContent = badgeInfo.label;

    topRow.appendChild(title);
    topRow.appendChild(badge);

    const metaRow = document.createElement('div');
    metaRow.className = 'd-flex justify-content-between align-items-center small text-muted mb-2';

    const fechaSpan = document.createElement('span');
    fechaSpan.textContent = new Date(pedido.fecha).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const totalStrong = document.createElement('strong');
    totalStrong.className = 'text-dark';
    totalStrong.textContent = `S/ ${Number(pedido.total || 0).toFixed(2)}`;

    metaRow.appendChild(fechaSpan);
    metaRow.appendChild(totalStrong);

    const msgP = document.createElement('p');
    msgP.className = 'small mb-0 p-2 rounded';
    msgP.style.backgroundColor = 'var(--crema-fondo)';
    msgP.textContent = getStatusMessage(pedido);

    body.appendChild(topRow);
    body.appendChild(metaRow);
    body.appendChild(msgP);

    if (pedido.estado === 'pendiente') {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'mt-2 text-end';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-sm btn-outline-danger rounded-pill px-3';
      cancelBtn.textContent = 'Cancelar Pedido';
      cancelBtn.addEventListener('click', () => cancelarMiPedido(pedido.id, cancelBtn));

      actionsDiv.appendChild(cancelBtn);
      body.appendChild(actionsDiv);
    }

    card.appendChild(body);
    return card;
  }

  async function buscarMiPedido(silent = false) {
    const input = $('#trackPhoneInput');
    const container = $('#trackOrderResults');
    if (!input || !container) return;

    const telefonoNormalizado = normalizePhone(input.value);
    if (!telefonoNormalizado) {
      stopTrackRefresh();
      container.textContent = '';
      const alertEl = document.createElement('div');
      alertEl.className = 'alert alert-warning small mb-0';
      alertEl.textContent = 'Por favor, ingresa tu número de teléfono para buscar tu pedido.';
      container.appendChild(alertEl);
      return;
    }

    input.value = telefonoNormalizado;
    lastSearchedPhone = telefonoNormalizado;
    localStorage.setItem(TRACK_PHONE_KEY, telefonoNormalizado);

    if (!supabaseClient) {
      container.textContent = '';
      const errEl = document.createElement('div');
      errEl.className = 'alert alert-danger small mb-0';
      errEl.textContent = 'No hay conexión con el sistema en este momento.';
      container.appendChild(errEl);
      return;
    }

    if (!silent) {
      container.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-success me-2" role="status"></div><span class="small text-muted">Buscando tus pedidos...</span></div>';
    }

    const { data, error } = await supabaseClient.rpc('obtener_mis_pedidos', {
      telefono_input: telefonoNormalizado
    });

    if (error) {
      console.error(error);
      stopTrackRefresh();
      container.textContent = '';
      const errEl = document.createElement('div');
      errEl.className = 'alert alert-danger small mb-0';
      errEl.textContent = 'Ocurrió un error al consultar tus pedidos. Intenta nuevamente.';
      container.appendChild(errEl);
      return;
    }

    container.textContent = '';
    if (!data || data.length === 0) {
      stopTrackRefresh();
      const emptyEl = document.createElement('div');
      emptyEl.className = 'text-center text-muted py-4 small';
      emptyEl.textContent = 'No encontramos pedidos recientes con ese número de teléfono.';
      container.appendChild(emptyEl);
      return;
    }

    data.forEach(pedido => {
      container.appendChild(renderOrderCard(pedido));
    });

    const modalEl = $('#trackOrderModal');
    if (modalEl && modalEl.classList.contains('show')) {
      startTrackRefresh();
    }
  }

  async function cancelarMiPedido(id, btnEl) {
    if (!confirm('¿Deseas cancelar este pedido?')) return;
    const telefonoNormalizado = lastSearchedPhone || normalizePhone($('#trackPhoneInput') ? $('#trackPhoneInput').value : '');
    if (!id || !telefonoNormalizado || !supabaseClient) return;

    const origText = btnEl ? btnEl.textContent : '';
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = 'Cancelando...';
    }

    try {
      const { data: canceladoOk, error } = await supabaseClient.rpc('cancelar_pedido', {
        p_id: String(id),
        p_telefono: telefonoNormalizado
      });

      if (error) {
        console.error('Error en cancelar_pedido:', error);
        showToast('Error al intentar cancelar el pedido', 'danger');
        return;
      }

      if (canceladoOk !== true) {
        showToast('No se pudo cancelar: el pedido ya fue aceptado o procesado.', 'warning');
        await buscarMiPedido();
        return;
      }

      showToast('Pedido cancelado correctamente');
      await buscarMiPedido();
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = origText;
      }
    }
  }

  window.buscarMiPedido = buscarMiPedido;
  window.cancelarMiPedido = cancelarMiPedido;

  document.addEventListener('DOMContentLoaded', () => {
    const modalEl = $('#trackOrderModal');
    const inputEl = $('#trackPhoneInput');
    const btnEl = $('#btnTrackOrder');

    if (btnEl) btnEl.addEventListener('click', () => buscarMiPedido(false));
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          buscarMiPedido(false);
        }
      });
    }
    if (modalEl) {
      modalEl.addEventListener('show.bs.modal', () => {
        const saved = localStorage.getItem(TRACK_PHONE_KEY);
        if (saved && inputEl && !inputEl.value) {
          inputEl.value = saved;
        }
      });
      modalEl.addEventListener('hidden.bs.modal', () => {
        stopTrackRefresh();
      });
    }
  });
})();