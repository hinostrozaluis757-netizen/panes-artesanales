// ARCHIVO: js/script.js
// 1. INICIALIZACIÓN SEGURA Y ESTADO MULTI-TENANT
let supabaseClient = null;
try {
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
} catch (e) { console.error("Error al iniciar Supabase:", e); }

// Estado global del inquilino activo y plantilla de giro
window.negocioActual = null;
window.plantillaActual = null;
const WHATSAPP_NUMBER = window.WHATSAPP_NUMBER || '51926549398';

const PLANTILLAS_GIRO = {
  panaderia: {
    clave: 'panaderia',
    badge: 'HORNO DE BARRO TRADICIONAL',
    badgeIcon: 'bi-fire',
    titulo: 'Tradición en cada camino',
    subtitulo: 'Especialistas en pancitos artesanales rellenos recién salidos del horno y sánguches a la leña.',
    subtituloMarca: '• Panes Artesanales •',
    cartaSubtitulo: 'Horneados todos los días desde las 5:00 a.m.',
    cartaTitulo: 'Nuestra Carta Artesanal',
    textoNavCarta: 'Carta Completa',
    textoHeroBtn: 'Ver Carta Completa',
    icono: 'bi-shop',
    usaHornoSvg: true,
    descripcionFooter: 'Especialistas en pancitos artesanales al horno de barro y sánguches a la leña.',
    heroImagen: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1920&q=80',
    imagenProductoFallback: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    colores: {
      primario: '#1B4D3E',
      secundario: '#12352A',
      acento: '#D9822B',
      acentoHover: '#b86b1f',
      fondoSuave: '#F6F0E2',
      fondoClaro: '#FDFBF7'
    },
    categoriasDefault: ['Salados', 'Dulces', 'Sánguches', 'Bebidas'],
    etiquetasCategoria: {
      Salados: '🥖 Panes Salados',
      Dulces: '🥨 Panes Dulces',
      'Sánguches': '🥪 Sánguches',
      Bebidas: '☕ Combos y Bebidas'
    }
  },
  botica: {
    clave: 'botica',
    badge: 'Atención 24/7 • Delivery Rápido',
    badgeIcon: 'bi-capsule-pill',
    titulo: 'Salud y Bienestar a tu alcance',
    subtitulo: 'Medicamentos garantizados, vitaminas y productos de cuidado personal con envío seguro a tu hogar.',
    subtituloMarca: '• Salud y Bienestar •',
    cartaSubtitulo: 'Productos farmacéuticos verificados y atención inmediata',
    cartaTitulo: 'Catálogo de Salud y Cuidado',
    textoNavCarta: 'Catálogo',
    textoHeroBtn: 'Ver Catálogo',
    icono: 'bi-capsule',
    usaHornoSvg: false,
    descripcionFooter: 'Tu botica de confianza con despacho seguro y asesoría directa por WhatsApp.',
    heroImagen: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1920&q=80',
    imagenProductoFallback: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    colores: {
      primario: '#0F766E',
      secundario: '#0B4F4A',
      acento: '#0284C7',
      acentoHover: '#0369A1',
      fondoSuave: '#E6F4F1',
      fondoClaro: '#F7FCFB'
    },
    categoriasDefault: ['Medicamentos', 'Vitaminas y Suplementos', 'Cuidado Personal', 'Bebés y Mamá'],
    etiquetasCategoria: {
      Medicamentos: '💊 Medicamentos',
      'Vitaminas y Suplementos': '🧴 Vitaminas',
      'Cuidado Personal': '🧼 Cuidado Personal',
      'Bebés y Mamá': '👶 Bebés y Mamá'
    }
  },
  restaurante: {
    clave: 'restaurante',
    badge: 'Cocina al Momento • Delivery Express',
    badgeIcon: 'bi-fire',
    titulo: 'El mejor sabor de la ciudad',
    subtitulo: 'Platos preparados al instante con ingredientes frescos, porciones generosas y envío directo a tu mesa.',
    subtituloMarca: '• Cocina & Sabor •',
    cartaSubtitulo: 'Preparados al momento con ingredientes seleccionados',
    cartaTitulo: 'Nuestra Carta del Día',
    textoNavCarta: 'Carta Completa',
    textoHeroBtn: 'Ver Carta Completa',
    icono: 'bi-egg-fried',
    usaHornoSvg: false,
    descripcionFooter: 'Sabor casero y cocina al instante directo desde nuestra cocina a tu puerta.',
    heroImagen: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1920&q=80',
    imagenProductoFallback: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    colores: {
      primario: '#991B1B',
      secundario: '#6B1111',
      acento: '#D97706',
      acentoHover: '#B45309',
      fondoSuave: '#FDF2E9',
      fondoClaro: '#FFFBF7'
    },
    categoriasDefault: ['Entradas', 'Platos de Fondo', 'Parrillas y Brasas', 'Bebidas'],
    etiquetasCategoria: {
      Entradas: '🥗 Entradas',
      'Platos de Fondo': '🍽️ Platos de Fondo',
      'Parrillas y Brasas': '🔥 Parrillas y Brasas',
      Bebidas: '🥤 Bebidas'
    }
  },
  ferreteria: {
    clave: 'ferreteria',
    badge: 'Stock Garantizado • Asesoría Técnica',
    badgeIcon: 'bi-tools',
    titulo: 'Todo para tu obra y hogar',
    subtitulo: 'Herramientas profesionales, materiales eléctricos, pinturas y acabados con despacho directo a tu proyecto.',
    subtituloMarca: '• Ferretería & Obra •',
    cartaSubtitulo: 'Calidad industrial y precios competitivos para tu proyecto',
    cartaTitulo: 'Catálogo de Herramientas y Materiales',
    textoNavCarta: 'Catálogo',
    textoHeroBtn: 'Ver Catálogo',
    icono: 'bi-tools',
    usaHornoSvg: false,
    descripcionFooter: 'Soluciones en herramientas, gasfitería, electricidad y materiales de construcción.',
    heroImagen: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1920&q=80',
    imagenProductoFallback: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?auto=format&fit=crop&w=600&q=80',
    colores: {
      primario: '#1E293B',
      secundario: '#0F172A',
      acento: '#D97706',
      acentoHover: '#B45309',
      fondoSuave: '#F3F4F6',
      fondoClaro: '#FAFAFA'
    },
    categoriasDefault: ['Herramientas', 'Pinturas y Acabados', 'Electricidad y Gasfitería', 'Construcción'],
    etiquetasCategoria: {
      Herramientas: '🛠️ Herramientas',
      'Pinturas y Acabados': '🎨 Pinturas',
      'Electricidad y Gasfitería': '⚡ Electricidad y Gasfitería',
      Construcción: '🧱 Construcción'
    }
  }
};

const PLANTILLA_GENERAL_BASE = {
  clave: 'general',
  badge: 'Tienda Online • Compra Fácil',
  badgeIcon: 'bi-bag-heart-fill',
  titulo: 'Descubre productos elegidos para ti',
  subtitulo: 'Explora nuestro catálogo actualizado, arma tu carrito en segundos y confirma tu pedido directo por WhatsApp.',
  subtituloMarca: '• Tienda Online •',
  cartaSubtitulo: 'Productos seleccionados con entrega rápida',
  cartaTitulo: 'Nuestro Catálogo',
  textoNavCarta: 'Catálogo',
  textoHeroBtn: 'Ver Catálogo',
  icono: 'bi-shop',
  usaHornoSvg: false,
  descripcionFooter: 'Tu tienda de confianza con pedidos simples, rápidos y seguros por WhatsApp.',
  heroImagen: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1920&q=80',
  imagenProductoFallback: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80',
  colores: {
    primario: '#4F46E5',
    secundario: '#312E81',
    acento: '#F97316',
    acentoHover: '#EA580C',
    fondoSuave: '#EEF2FF',
    fondoClaro: '#F8FAFC'
  },
  categoriasDefault: ['Destacados', 'Novedades', 'Ofertas', 'Varios'],
  etiquetasCategoria: {
    Destacados: '⭐ Destacados',
    Novedades: '🆕 Novedades',
    Ofertas: '🔥 Ofertas',
    Varios: '🛍️ Varios'
  }
};

function crearPlantillaDesdeBaseGeneral(personalizacion) {
  return {
    ...PLANTILLA_GENERAL_BASE,
    ...personalizacion,
    colores: {
      ...PLANTILLA_GENERAL_BASE.colores,
      ...(personalizacion.colores || {})
    }
  };
}

// Re-agregar referencia limpia sin vegetales en 'general' y cubrir los 13 rubros
PLANTILLAS_GIRO.general = PLANTILLA_GENERAL_BASE;

PLANTILLAS_GIRO.ropa = {
  clave: 'ropa',
  badge: 'Nueva Colección • Moda & Estilo',
  badgeIcon: 'bi-stars',
  titulo: 'Viste tu mejor versión',
  subtitulo: 'Prendas exclusivas, cortes actuales y accesorios seleccionados para elevar tu estilo cada día.',
  subtituloMarca: '• Moda & Boutique •',
  cartaSubtitulo: 'Tendencias y prendas listas para entrega',
  cartaTitulo: 'Catálogo de Temporada',
  textoNavCarta: 'Colección',
  textoHeroBtn: 'Ver Colección',
  icono: 'bi-handbag-fill',
  usaHornoSvg: false,
  descripcionFooter: 'Moda, estilo y prendas de calidad con atención personalizada y envíos rápidos.',
  heroImagen: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1920&q=80',
  imagenProductoFallback: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=600&q=80',
  colores: {
    primario: '#18181B',
    secundario: '#09090B',
    acento: '#D4AF37',
    acentoHover: '#EC4899',
    fondoSuave: '#F4F4F5',
    fondoClaro: '#FAFAFA'
  },
  categoriasDefault: ['Polos', 'Pantalones', 'Vestidos', 'Casacas', 'Accesorios'],
  etiquetasCategoria: {
    Polos: '👕 Polos',
    Pantalones: '👖 Pantalones',
    Vestidos: '👗 Vestidos',
    Casacas: '🧥 Casacas',
    Accesorios: '👜 Accesorios'
  }
};

PLANTILLAS_GIRO.licoreria = crearPlantillaDesdeBaseGeneral({
  clave: 'licoreria',
  badge: 'Delivery Nocturno • Licores Originales',
  badgeIcon: 'bi-stars',
  titulo: 'Brinda en cada ocasión especial',
  subtitulo: 'Cervezas bien heladas, vinos seleccionados, destilados y combos listos para tu reunión.',
  subtituloMarca: '• Licorería & Cavas •',
  cartaSubtitulo: 'Bebidas y combos listos para disfrutar',
  cartaTitulo: 'Carta de Licores y Combos',
  icono: 'bi-cup-straw',
  descripcionFooter: 'Licores originales, bebidas heladas y despacho rápido por WhatsApp.',
  heroImagen: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1920&q=80',
  colores: { primario: '#3B0764', secundario: '#1E1B4B', acento: '#F59E0B', acentoHover: '#D97706', fondoSuave: '#F5F3FF' },
  categoriasDefault: ['Cervezas', 'Vinos', 'Whisky y Ron', 'Pisco y Espumantes', 'Piqueos y Hielo'],
  etiquetasCategoria: {
    Cervezas: '🍺 Cervezas',
    Vinos: '🍷 Vinos',
    'Whisky y Ron': '🥃 Whisky y Ron',
    'Pisco y Espumantes': '🍾 Pisco y Espumantes',
    'Piqueos y Hielo': '🧊 Piqueos y Hielo'
  }
});

PLANTILLAS_GIRO.libreria = crearPlantillaDesdeBaseGeneral({
  clave: 'libreria',
  badge: 'Útiles • Oficina • Creatividad',
  badgeIcon: 'bi-journal-bookmark-fill',
  titulo: 'Todo para estudiar, trabajar y crear',
  subtitulo: 'Útiles escolares, papelería premium, artículos de oficina y detalles especiales en un solo lugar.',
  subtituloMarca: '• Librería & Bazar •',
  cartaSubtitulo: 'Stock actualizado para colegio y oficina',
  cartaTitulo: 'Catálogo Escolar y Oficina',
  icono: 'bi-book-half',
  descripcionFooter: 'Artículos escolares, oficina, arte y regalos con atención rápida por WhatsApp.',
  colores: { primario: '#0284C7', secundario: '#0369A1', acento: '#F59E0B', acentoHover: '#D97706', fondoSuave: '#E0F2FE' },
  categoriasDefault: ['Útiles Escolares', 'Oficina', 'Arte y Manualidades', 'Regalos y Detalles'],
  etiquetasCategoria: {
    'Útiles Escolares': '🎒 Útiles Escolares',
    Oficina: '📎 Oficina',
    'Arte y Manualidades': '🎨 Arte y Manualidades',
    'Regalos y Detalles': '🎁 Regalos y Detalles'
  }
});

PLANTILLAS_GIRO.minimarket = crearPlantillaDesdeBaseGeneral({
  clave: 'minimarket',
  badge: 'Tu Bodega Moderna • Delivery Rápido',
  badgeIcon: 'bi-lightning-charge-fill',
  titulo: 'Tu compra diaria sin hacer colas',
  subtitulo: 'Abarrotes, bebidas frías, lácteos, snacks y productos de limpieza directo a tu puerta.',
  subtituloMarca: '• Minimarket •',
  cartaSubtitulo: 'Despensa y conveniencia al mejor precio',
  cartaTitulo: 'Catálogo Minimarket',
  icono: 'bi-basket2-fill',
  descripcionFooter: 'Minimarket completo con entrega ágil y pedido directo por WhatsApp.',
  colores: { primario: '#047857', secundario: '#064E3B', acento: '#F97316', acentoHover: '#EA580C', fondoSuave: '#ECFDF5' },
  categoriasDefault: ['Abarrotes', 'Bebidas', 'Snacks', 'Limpieza y Hogar', 'Lácteos'],
  etiquetasCategoria: {
    Abarrotes: '🛒 Abarrotes',
    Bebidas: '🥤 Bebidas',
    Snacks: '🍿 Snacks',
    'Limpieza y Hogar': '🧹 Limpieza y Hogar',
    Lácteos: '🥛 Lácteos'
  }
});

PLANTILLAS_GIRO.cafeteria = crearPlantillaDesdeBaseGeneral({
  clave: 'cafeteria',
  badge: 'Café de Especialidad • Postres & Jugos',
  badgeIcon: 'bi-cup-hot-fill',
  titulo: 'Un respiro delicioso en tu día',
  subtitulo: 'Cafés recién pasados, jugos naturales, sánguches y postres artesanales preparados al momento.',
  subtituloMarca: '• Cafetería & Juguería •',
  cartaSubtitulo: 'Preparaciones frescas al instante',
  cartaTitulo: 'Nuestra Carta',
  textoNavCarta: 'Carta',
  textoHeroBtn: 'Ver Carta',
  icono: 'bi-cup-hot-fill',
  descripcionFooter: 'Café de calidad, jugos frescos y antojos dulces con pedido directo por WhatsApp.',
  heroImagen: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1920&q=80',
  colores: { primario: '#4A2C2A', secundario: '#2C1810', acento: '#D97706', acentoHover: '#B45309', fondoSuave: '#FEF3C7' },
  categoriasDefault: ['Cafés', 'Jugos y Batidos', 'Postres', 'Sánguches'],
  etiquetasCategoria: {
    Cafés: '☕ Cafés',
    'Jugos y Batidos': '🥤 Jugos y Batidos',
    Postres: '🍰 Postres',
    Sánguches: '🥪 Sánguches'
  }
});

PLANTILLAS_GIRO.veterinaria = crearPlantillaDesdeBaseGeneral({
  clave: 'veterinaria',
  badge: 'Amor y Cuidado para tu Mascota',
  badgeIcon: 'bi-heart-fill',
  titulo: 'Todo para el bienestar de tu engreído',
  subtitulo: 'Alimento balanceado, farmacia veterinaria, higiene y accesorios para perros y gatos.',
  subtituloMarca: '• Veterinaria & Pet Shop •',
  cartaSubtitulo: 'Nutrición y cuidado para cada etapa',
  cartaTitulo: 'Catálogo Pet Shop',
  icono: 'bi-heart-pulse-fill',
  descripcionFooter: 'Nutrición, salud e higiene animal con envío rápido por WhatsApp.',
  heroImagen: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1920&q=80',
  colores: { primario: '#0D9488', secundario: '#115E59', acento: '#F97316', acentoHover: '#EA580C', fondoSuave: '#F0FDFA' },
  categoriasDefault: ['Alimentos', 'Farmacia Vet', 'Higiene y Baño', 'Accesorios y Juguetes'],
  etiquetasCategoria: {
    Alimentos: '🦴 Alimentos',
    'Farmacia Vet': '🩺 Farmacia Vet',
    'Higiene y Baño': '🛁 Higiene y Baño',
    'Accesorios y Juguetes': '🎾 Accesorios y Juguetes'
  }
});

PLANTILLAS_GIRO.peluqueria = crearPlantillaDesdeBaseGeneral({
  clave: 'peluqueria',
  badge: 'Estilo • Barbería • Belleza',
  badgeIcon: 'bi-scissors',
  titulo: 'Resalta tu mejor estilo hoy',
  subtitulo: 'Cortes modernos, barbería profesional, tratamientos capilares y productos de cuidado personal.',
  subtituloMarca: '• Peluquería & Spa •',
  cartaSubtitulo: 'Servicios y cuidado capilar profesional',
  cartaTitulo: 'Servicios y Productos',
  icono: 'bi-scissors',
  descripcionFooter: 'Imagen personal, barbería y belleza con reservas y compras por WhatsApp.',
  heroImagen: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1920&q=80',
  colores: { primario: '#3F1D38', secundario: '#240E20', acento: '#EC4899', acentoHover: '#DB2777', fondoSuave: '#FDF2F8' },
  categoriasDefault: ['Cortes y Peinados', 'Barbería', 'Tratamientos Capilares', 'Cuidado y Styling'],
  etiquetasCategoria: {
    'Cortes y Peinados': '✂️ Cortes y Peinados',
    Barbería: '💈 Barbería',
    'Tratamientos Capilares': '✨ Tratamientos',
    'Cuidado y Styling': '🧴 Cuidado y Styling'
  }
});

PLANTILLAS_GIRO.taller = crearPlantillaDesdeBaseGeneral({
  clave: 'taller',
  badge: 'Servicio Automotriz • Repuestos',
  badgeIcon: 'bi-gear-wide-connected',
  titulo: 'Potencia y seguridad para tu vehículo',
  subtitulo: 'Lubricantes certificados, repuestos, baterías y mantenimiento confiable para autos y motos.',
  subtituloMarca: '• Taller & Repuestos •',
  cartaSubtitulo: 'Repuestos y lubricantes en stock',
  cartaTitulo: 'Catálogo Automotriz',
  icono: 'bi-wrench-adjustable-circle-fill',
  descripcionFooter: 'Mantenimiento preventivo, lubricantes y repuestos con atención ágil por WhatsApp.',
  heroImagen: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1920&q=80',
  colores: { primario: '#1E293B', secundario: '#0F172A', acento: '#EF4444', acentoHover: '#DC2626', fondoSuave: '#F1F5F9' },
  categoriasDefault: ['Lubricantes y Aceites', 'Repuestos', 'Baterías y Llantas', 'Accesorios Auto'],
  etiquetasCategoria: {
    'Lubricantes y Aceites': '🛢️ Lubricantes',
    Repuestos: '🔩 Repuestos',
    'Baterías y Llantas': '🔋 Baterías y Llantas',
    'Accesorios Auto': '🚗 Accesorios Auto'
  }
});

const PAYMENT_INFO = {
  yape: { label: 'Yape', phone: '926 549 398', titular: 'Roberto Panes', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=YAPE-926549398' },
  plin: { label: 'Plin', phone: '926 549 398', titular: 'Roberto Panes' },
  bcp: { label: 'Transferencia BCP', banco: 'BCP', cuenta: '193-2345678-0-12', cci: '002-193-002345678012-15', titular: 'Roberto Panes SAC', color: '#FF6B00' },
  bbva: { label: 'BBVA Continental', banco: 'BBVA', cuenta: '0011-0234-0100456789', cci: '011-234-000100456789-12', titular: 'Roberto Panes SAC', color: '#004481' },
  contraentrega: { label: 'Contra entrega', nota: 'Pagas en efectivo al recibir tu pedido.' }
};

let cart = [];
let selectedPayment = null;
let comprobanteFile = null;
let catalogoProductos = [];
let categoriaActiva = 'Todos';
let textoBusquedaCatalogo = '';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const formatPrice = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));
const safeImgUrl = (url, fallback) => {
  const s = String(url || '').trim();
  return /^https?:\/\//i.test(s) ? s : fallback;
};

function obtenerPlantillaGiro(tipoNegocio) {
  const clave = String(tipoNegocio || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLANTILLAS_GIRO, clave)
    ? PLANTILLAS_GIRO[clave]
    : PLANTILLAS_GIRO.general;
}

function normalizarHexColor(val) {
  const s = String(val || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return '';
}

function oscurecerHex(hex, factor = 0.2) {
  const norm = normalizarHexColor(hex);
  if (!norm) return hex;
  const darken = (start) => {
    const val = parseInt(norm.slice(start, start + 2), 16);
    return Math.max(0, Math.round(val * (1 - factor))).toString(16).padStart(2, '0');
  };
  return `#${darken(1)}${darken(3)}${darken(5)}`;
}

function hexToRgba(hex, alpha) {
  const norm = normalizarHexColor(hex);
  if (!norm) return `rgba(18, 53, 42, ${alpha})`;
  const clean = norm.slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function aplicarTemaVisual(plantilla) {
  if (!plantilla || !plantilla.colores || !document.documentElement) return;
  const c = plantilla.colores;
  const root = document.documentElement.style;
  root.setProperty('--color-primario', c.primario);
  root.setProperty('--color-secundario', c.acento);
  root.setProperty('--verde-bosque', c.primario);
  root.setProperty('--verde-oscuro', c.secundario);
  root.setProperty('--dorado-pan', c.acento);
  root.setProperty('--dorado-hover', c.acentoHover || c.acento);
  if (c.fondoSuave) root.setProperty('--crema-fondo', c.fondoSuave);
  if (c.fondoClaro) root.setProperty('--crema-claro', c.fondoClaro);
  root.setProperty('--hero-overlay-inicio', hexToRgba(c.secundario, 0.62));
  root.setProperty('--hero-overlay-fin', hexToRgba(c.secundario, 0.84));
  root.setProperty('--hero-badge-bg', hexToRgba(c.acento, 0.28));

  const metaTheme = $('#metaThemeColor');
  if (metaTheme) metaTheme.setAttribute('content', c.primario);
}

// Clave dinámica de carrito por tienda para aislar inventarios de clientes
function getCartKey() {
  const slug = (window.negocioActual && window.negocioActual.slug) ? window.negocioActual.slug : 'don-roberto';
  return `carrito_${slug}`;
}

function saveCart() {
  localStorage.setItem(getCartKey(), JSON.stringify(cart));
}

function loadCart() {
  const key = getCartKey();
  let stored = localStorage.getItem(key);
  // Retrocompatibilidad: si es don-roberto y aún no tiene carrito_don-roberto, migra desde donRobertoCart_v1
  if (!stored && (key === 'carrito_don-roberto' || !window.negocioActual)) {
    stored = localStorage.getItem('donRobertoCart_v1');
  }
  try {
    cart = stored ? JSON.parse(stored) : [];
  } catch (e) {
    cart = [];
  }
  renderCart();
  updateCartCount();
}

function formatPhone(num) {
  const clean = String(num || '').replace(/\D/g, '');
  if (clean.length === 9) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  if (clean.startsWith('51') && clean.length === 11) {
    const local = clean.slice(2);
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return num || '';
}

// =============================================================================
// RESOLUCIÓN DE INQUILINO (TENANT RESOLVER) POR URL
// =============================================================================
const TIMEOUT_CARGA_NEGOCIO_MS = 12000;
let pantallaErrorMostrada = false;

async function initTenant() {
  const params = new URLSearchParams(window.location.search);
  const slugActual = (params.get('tienda') || 'don-roberto').trim().toLowerCase();

  if (!supabaseClient) {
    console.error('Cliente de Supabase no disponible.');
    mostrarTiendaNoDisponible(slugActual, 'conexion');
    return;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId = null;
  let cargaNegocioResuelta = false;
  const sentinelTimeout = { __timeout: true };

  let consulta = supabaseClient
    .from('negocios')
    .select('id, nombre, slug, whatsapp, logo_url, tipo_negocio, direccion, google_maps_url, hero_imagen_url, hero_titulo_custom, color_primario, color_secundario, activo')
    .eq('slug', slugActual)
    .eq('activo', true);

  if (controller && typeof consulta.abortSignal === 'function') {
    consulta = consulta.abortSignal(controller.signal);
  }

  const consultaPromise = Promise.resolve(consulta.maybeSingle());
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      if (cargaNegocioResuelta || pantallaErrorMostrada) return;
      resolve(sentinelTimeout);
      if (controller) controller.abort();
    }, TIMEOUT_CARGA_NEGOCIO_MS);
  });

  try {
    const resultado = await Promise.race([consultaPromise, timeoutPromise]);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (pantallaErrorMostrada) return;

    // Caso 1a: Tiempo máximo de espera (12 s) agotado -> fallo de conexión
    if (resultado && resultado.__timeout) {
      consultaPromise.catch(() => {});
      cargaNegocioResuelta = true;
      console.error('Tiempo de espera agotado (12 s) al cargar la tienda.');
      mostrarTiendaNoDisponible(slugActual, 'conexion');
      return;
    }

    cargaNegocioResuelta = true;
    const { data: negocio, error } = resultado || {};

    // Caso 1b: Error de red o de la API -> fallo de conexión
    if (error) {
      console.error('Error de conexión o API al cargar la tienda:', error);
      mostrarTiendaNoDisponible(slugActual, 'conexion');
      return;
    }

    // Caso 2: Respuesta correcta sin filas (tienda inexistente o inactiva por RLS)
    if (!negocio) {
      console.warn('Tienda no disponible o inactiva.');
      mostrarTiendaNoDisponible(slugActual);
      return;
    }

    // Caso 3: Tienda activa cargada correctamente
    window.negocioActual = negocio;

    // Hidratar plantilla visual, colores, hero y categorías iniciales antes de renderizar catálogo
    hidratarDOM(negocio);

    // Cargar carrito específico para esta tienda
    loadCart();
  } catch (err) {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    cargaNegocioResuelta = true;
    if (pantallaErrorMostrada) return;
    // Caso 1c: Promesa rechazada por fallo de red o cliente
    console.error('Error al inicializar la tienda:', err);
    mostrarTiendaNoDisponible(slugActual, 'conexion');
    return;
  }

  // Cargar catálogo de productos filtrado por negocio_id
  try {
    await loadProducts();
  } catch (prodErr) {
    console.error('Error al cargar productos del negocio:', prodErr);
    showToast('Error cargando el catálogo', 'danger');
  }
}

function mostrarTiendaNoDisponible(slug, motivo = 'no-disponible') {
  if (pantallaErrorMostrada) return;
  pantallaErrorMostrada = true;

  aplicarTemaVisual(PLANTILLAS_GIRO.general);

  const esConexion = motivo === 'conexion';
  const titulo = esConexion ? 'No pudimos cargar la tienda' : 'Tienda no disponible';
  const tituloDocumento = esConexion ? 'No se pudo cargar la tienda' : 'Tienda no disponible';
  const mensaje = esConexion
    ? 'Revisa tu conexión a internet e inténtalo de nuevo.'
    : 'El enlace que abriste no corresponde a una tienda activa. Puede que la dirección esté mal escrita o que la tienda esté temporalmente fuera de servicio.';
  const textoBoton = esConexion ? 'Reintentar' : 'Intentar de nuevo';
  const icono = esConexion ? '📡' : '🏪';

  document.title = tituloDocumento;

  if (document.head && !document.querySelector('meta[name="robots"]')) {
    const metaRobots = document.createElement('meta');
    metaRobots.setAttribute('name', 'robots');
    metaRobots.setAttribute('content', 'noindex');
    document.head.appendChild(metaRobots);
  }

  // Ocultar catálogo, hero, locales y delivery para prevenir errores de referencia nula
  ['#carta', '#locales', '#delivery'].forEach(sel => {
    const el = $(sel);
    if (el) el.classList.add('d-none');
  });

  const heroSection = $('#inicio');
  if (heroSection) heroSection.classList.add('d-none');

  const existente = $('#tiendaNoDisponibleBanner');
  if (existente) existente.remove();

  // Insertar contenedor neutral accesible sin exponer slug ni detalles técnicos
  const alertDiv = document.createElement('div');
  alertDiv.id = 'tiendaNoDisponibleBanner';
  alertDiv.className = 'container my-5 py-5 text-center';
  alertDiv.setAttribute('role', 'alert');
  alertDiv.innerHTML = `
    <div class="card shadow-sm border-0 p-5 mx-auto" style="max-width: 540px; border-radius: 16px; background-color: #ffffff;">
      <div class="mb-3" id="tiendaEstadoIcono" style="font-size: 3.5rem;" aria-hidden="true"></div>
      <h2 class="fw-bold mb-2" id="tiendaEstadoTitulo" style="color: var(--verde-bosque);"></h2>
      <p class="text-muted mb-4" id="tiendaEstadoMensaje"></p>
      <div class="d-flex justify-content-center">
        <button type="button" id="btnReintentarTienda" class="btn btn-whatsapp-nav px-4 py-2">
          <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i> <span id="btnReintentarTiendaTexto"></span>
        </button>
      </div>
      <p class="text-muted small mt-3 mb-0 d-none" id="tiendaEstadoNota"></p>
    </div>
  `;

  $('#tiendaEstadoIcono', alertDiv).textContent = icono;
  $('#tiendaEstadoTitulo', alertDiv).textContent = titulo;
  $('#tiendaEstadoMensaje', alertDiv).textContent = mensaje;
  $('#btnReintentarTiendaTexto', alertDiv).textContent = textoBoton;

  if (!esConexion) {
    const notaEl = $('#tiendaEstadoNota', alertDiv);
    notaEl.textContent = 'Si el problema continúa, contacta al negocio que te compartió el enlace.';
    notaEl.classList.remove('d-none');
  }

  const btnReintentar = $('#btnReintentarTienda', alertDiv);
  if (btnReintentar) {
    btnReintentar.addEventListener('click', () => {
      window.location.reload();
    });
  }

  const mainNav = $('nav.navbar');
  if (mainNav && mainNav.parentNode) {
    mainNav.parentNode.insertBefore(alertDiv, mainNav.nextSibling);
  } else {
    document.body.prepend(alertDiv);
  }
}

// =============================================================================
// HIDRATACIÓN DINÁMICA DEL DOM (PLANTILLA DE GIRO, MARCA, LOGO Y CONTACTO)
// =============================================================================
function obtenerCategoriasCatalogo(productos, plantilla) {
  const sugeridas = Array.isArray(plantilla?.categoriasDefault) ? plantilla.categoriasDefault : [];
  const reales = [];
  const vistos = new Set();

  const agregarUnica = (cat) => {
    const limpia = String(cat || '').trim();
    if (!limpia) return;
    const key = limpia.toLowerCase();
    if (vistos.has(key)) return;
    vistos.add(key);
    reales.push(limpia);
  };

  if (!productos || productos.length === 0) {
    sugeridas.forEach(agregarUnica);
    return reales;
  }

  if (plantilla.clave === 'panaderia') {
    sugeridas.forEach(agregarUnica);
    productos.forEach(p => agregarUnica(p.categoria));
  } else {
    productos.forEach(p => agregarUnica(p.categoria));
    sugeridas.forEach(agregarUnica);
  }

  return reales;
}

function obtenerEtiquetaCategoria(categoria, plantilla) {
  if (categoria === 'Todos') return 'Todos';
  if (plantilla?.etiquetasCategoria && plantilla.etiquetasCategoria[categoria]) {
    return plantilla.etiquetasCategoria[categoria];
  }
  return categoria;
}

function renderCategoryPills(categorias, plantilla) {
  const menu = $('#category-menu');
  if (!menu) return;

  const opciones = ['Todos', ...categorias];
  if (!opciones.some(c => c.toLowerCase() === String(categoriaActiva || '').toLowerCase())) {
    categoriaActiva = 'Todos';
  }

  menu.innerHTML = opciones.map(cat => {
    const active = cat.toLowerCase() === categoriaActiva.toLowerCase() ? 'active' : '';
    const label = obtenerEtiquetaCategoria(cat, plantilla);
    return `<button type="button" class="category-pill ${active}" data-category="${escHtml(cat)}">${escHtml(label)}</button>`;
  }).join('');
}

function analizarUrlMapaTienda(valorBruto) {
  let raw = String(valorBruto || '').trim();
  if (!raw) return { url: '', modo: 'vacio' };

  const iframeMatch = raw.match(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    raw = iframeMatch[1].trim();
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return { url: '', modo: 'vacio' };
  }

  if (parsed.protocol !== 'https:') return { url: '', modo: 'vacio' };

  const host = parsed.hostname.toLowerCase();
  const esHostGoogle = /(^|\.)google\.[a-z.]{2,}$/i.test(host) || host === 'goo.gl' || host === 'maps.app.goo.gl';
  const esEmbed = esHostGoogle && (
    /\/maps\/embed/i.test(parsed.pathname) ||
    parsed.searchParams.get('output') === 'embed'
  );

  return {
    url: parsed.href,
    modo: esEmbed ? 'embed' : 'link'
  };
}

function renderUbicacion(negocio, waUrl) {
  const container = $('#localesContainer');
  if (!container) return;

  const direccion = String(negocio?.direccion || '').trim();
  const nombreNegocio = String(negocio?.nombre || 'Nuestra Tienda').trim();
  const mapa = analizarUrlMapaTienda(negocio?.google_maps_url || '');
  const kicker = $('#localesKicker');
  const titulo = $('#localesTitulo');

  if (mapa.modo === 'embed') {
    if (kicker) kicker.textContent = 'Ubicación Exacta';
    if (titulo) titulo.textContent = 'Visítanos en Nuestro Local';
    container.innerHTML = `
      <div class="col-lg-8">
        <div class="card-location">
          <h3 class="h4 fw-bold mb-2">${escHtml(nombreNegocio)}</h3>
          ${direccion
            ? `<p class="text-muted mb-3"><i class="bi bi-geo-alt-fill text-danger me-1"></i> <strong>${escHtml(direccion)}</strong></p>`
            : '<p class="text-muted mb-3"><i class="bi bi-geo-alt-fill text-danger me-1"></i> Ubícanos fácilmente en el mapa</p>'}
          <div class="map-container">
            <iframe src="${escHtml(mapa.url)}" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (mapa.modo === 'link') {
    if (kicker) kicker.textContent = 'Ubicación Exacta';
    if (titulo) titulo.textContent = 'Cómo Llegar a Nuestro Local';
    container.innerHTML = `
      <div class="col-lg-8">
        <div class="card-location text-center p-4 p-md-5">
          <i class="bi bi-geo-alt-fill text-danger fs-1 mb-3 d-block"></i>
          <h3 class="h4 fw-bold mb-2">${escHtml(nombreNegocio)}</h3>
          ${direccion
            ? `<p class="text-muted mb-4">${escHtml(direccion)}</p>`
            : '<p class="text-muted mb-4">Encuentra nuestra ubicación exacta en Google Maps.</p>'}
          <a href="${escHtml(mapa.url)}" target="_blank" rel="noopener noreferrer" class="btn rounded-pill px-4 py-2 fw-bold text-white" style="background-color: var(--verde-bosque); border-color: var(--verde-bosque);">
            <i class="bi bi-map-fill me-2"></i>Abrir ubicación en Google Maps
          </a>
        </div>
      </div>
    `;
    return;
  }

  if (direccion) {
    if (kicker) kicker.textContent = 'Ubicación Exacta';
    if (titulo) titulo.textContent = 'Dirección del Local';
    container.innerHTML = `
      <div class="col-lg-8">
        <div class="card-location text-center p-4 p-md-5">
          <i class="bi bi-shop fs-1 mb-3 d-block" style="color: var(--verde-bosque);"></i>
          <h3 class="h4 fw-bold mb-2">${escHtml(nombreNegocio)}</h3>
          <p class="fs-5 text-muted mb-4"><i class="bi bi-geo-alt-fill text-danger me-1"></i> ${escHtml(direccion)}</p>
          ${waUrl
            ? `<a href="${escHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-success rounded-pill px-4 py-2 fw-semibold"><i class="bi bi-whatsapp me-2"></i>Consultar referencias por WhatsApp</a>`
            : ''}
        </div>
      </div>
    `;
    return;
  }

  if (kicker) kicker.textContent = 'Modalidad de Atención';
  if (titulo) titulo.textContent = 'Pedidos y Entregas';
  container.innerHTML = `
    <div class="col-lg-8">
      <div class="card-location text-center p-4 p-md-5">
        <i class="bi bi-truck fs-1 mb-3 d-block" style="color: var(--dorado-pan);"></i>
        <h3 class="h4 fw-bold mb-2">Atención Online y Delivery</h3>
        <p class="text-muted mb-4">Coordina tu entrega directamente por WhatsApp.</p>
        ${waUrl
          ? `<a href="${escHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-success rounded-pill px-4 py-2 fw-bold"><i class="bi bi-whatsapp me-2"></i>Coordinar por WhatsApp</a>`
          : ''}
      </div>
    </div>
  `;
}

function aplicarCustomOverrides(negocio) {
  if (!negocio || !document.documentElement) return;
  const root = document.documentElement.style;
  const logoBadge = $('#navbarLogoBadge') || $('.logo-badge-circle');
  const heroEmblemVisual = $('#heroEmblemVisual');

  // 1. Sobrescritura de Logo en Header y Emblema del Hero
  const customLogo = String(negocio.logo_url || '').trim() ? safeImgUrl(negocio.logo_url, '') : '';
  if (customLogo) {
    if (logoBadge) {
      logoBadge.innerHTML = `<img src="${escHtml(customLogo)}" alt="${escHtml(negocio.nombre)}" style="width: 38px; height: 38px; object-fit: contain; border-radius: 50%;">`;
    }
    if (heroEmblemVisual) {
      heroEmblemVisual.innerHTML = `<img src="${escHtml(customLogo)}" alt="${escHtml(negocio.nombre)}" style="width: 58px; height: 58px; object-fit: contain; border-radius: 50%; margin-bottom: 4px;">`;
    }
  }

  // 2. Sobrescritura de Color Primario (marca, top-bar, títulos, pills y fondo oscuro derivado)
  const customPrimario = normalizarHexColor(negocio.color_primario);
  if (customPrimario) {
    const primarioOscuro = oscurecerHex(customPrimario, 0.22);
    root.setProperty('--color-primario', customPrimario);
    root.setProperty('--verde-bosque', customPrimario);
    root.setProperty('--verde-oscuro', primarioOscuro);
    root.setProperty('--hero-overlay-inicio', hexToRgba(primarioOscuro, 0.62));
    root.setProperty('--hero-overlay-fin', hexToRgba(primarioOscuro, 0.84));
    const metaTheme = $('#metaThemeColor');
    if (metaTheme) metaTheme.setAttribute('content', customPrimario);
  }

  // 3. Sobrescritura de Color Secundario (botones, badges y acentos derivados)
  const customSecundario = normalizarHexColor(negocio.color_secundario);
  if (customSecundario) {
    root.setProperty('--color-secundario', customSecundario);
    root.setProperty('--dorado-pan', customSecundario);
    root.setProperty('--dorado-hover', oscurecerHex(customSecundario, 0.16));
    root.setProperty('--hero-badge-bg', hexToRgba(customSecundario, 0.28));
  }

  // 4. Sobrescritura de Imagen de Portada (Hero)
  const customHeroImg = String(negocio.hero_imagen_url || '').trim()
    ? safeImgUrl(negocio.hero_imagen_url, '')
    : '';
  const heroBg = $('#heroImagenFondo');
  if (customHeroImg && heroBg) {
    const safeCssHeroUrl = customHeroImg.replace(/['"()\\]/g, encodeURIComponent);
    heroBg.style.backgroundImage = `linear-gradient(var(--hero-overlay-inicio), var(--hero-overlay-fin)), url('${safeCssHeroUrl}')`;
  }

  // 5. Sobrescritura de Título del Hero
  const customTitulo = String(negocio.hero_titulo_custom || '').trim();
  if (customTitulo && $('#heroTitulo')) {
    $('#heroTitulo').textContent = customTitulo;
  }
}

function hidratarDOM(negocio) {
  // FASE 1 (Base): Evaluar rubro y aplicar plantilla por defecto (cero cambios si overrides están en NULL)
  const plantilla = obtenerPlantillaGiro(negocio.tipo_negocio);
  window.plantillaActual = plantilla;
  categoriaActiva = 'Todos';
  textoBusquedaCatalogo = '';
  if ($('#catalogSearchInput')) $('#catalogSearchInput').value = '';

  // 0. Aplicar paleta de colores base de la plantilla en :root
  aplicarTemaVisual(plantilla);

  // 1. Título y meta descripción de la pestaña
  document.title = `${negocio.nombre} - Catálogo Online`;
  const metaDesc = $('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', `${negocio.nombre} - ${plantilla.subtitulo}`);
  }

  // 2. Nombre de la marca y subtítulo en Navbar
  const brandName = $('.brand-main-name');
  if (brandName) brandName.textContent = negocio.nombre;

  const brandSubName = $('#brandSubName');
  if (brandSubName) brandSubName.textContent = plantilla.subtituloMarca;

  // 3. Logo fallback base en Header y Emblema del Hero (Fase 2 lo sobrescribe si hay logo_url)
  const logoBadge = $('#navbarLogoBadge') || $('.logo-badge-circle');
  const heroEmblemVisual = $('#heroEmblemVisual');
  if (plantilla.usaHornoSvg) {
    if (logoBadge) logoBadge.innerHTML = '<svg width="38" height="26"><use href="#horno-don-roberto"></use></svg>';
    if (heroEmblemVisual) heroEmblemVisual.innerHTML = '<svg width="65" height="42"><use href="#horno-don-roberto"></use></svg>';
  } else {
    if (logoBadge) logoBadge.innerHTML = `<i class="bi ${escHtml(plantilla.icono)} fs-5"></i>`;
    if (heroEmblemVisual) heroEmblemVisual.innerHTML = `<i class="bi ${escHtml(plantilla.icono)} fs-1"></i>`;
  }

  // 4. Hidratación base del Hero (sin parpadeo)
  const heroBg = $('#heroImagenFondo');
  if (heroBg) {
    heroBg.style.backgroundImage = `linear-gradient(var(--hero-overlay-inicio), var(--hero-overlay-fin)), url('${plantilla.heroImagen}')`;
  }

  const heroEmblemTitle = $('.hero-logo-emblem .emblem-title');
  if (heroEmblemTitle) heroEmblemTitle.textContent = negocio.nombre;
  const heroEmblemSub = $('#heroEmblemSub');
  if (heroEmblemSub) heroEmblemSub.textContent = plantilla.subtituloMarca.replace(/•/g, '').trim();

  const heroBadge = $('#heroBadge');
  if (heroBadge) {
    heroBadge.innerHTML = `<i class="bi ${escHtml(plantilla.badgeIcon)} text-warning me-1"></i> ${escHtml(plantilla.badge)}`;
  }

  const heroTitulo = $('#heroTitulo');
  if (heroTitulo) heroTitulo.textContent = plantilla.titulo;

  const heroSubtitulo = $('#heroSubtitulo');
  if (heroSubtitulo) heroSubtitulo.textContent = plantilla.subtitulo;

  const heroPrimaryBtn = $('#heroPrimaryBtn');
  if (heroPrimaryBtn) {
    heroPrimaryBtn.innerHTML = `<i class="bi bi-journal-richtext me-1"></i> ${escHtml(plantilla.textoHeroBtn)}`;
  }

  const navCartaLink = $('#navCartaLink');
  if (navCartaLink) navCartaLink.textContent = plantilla.textoNavCarta;

  // FASE 2 (Custom Overrides): Sobrescribir selectivamente solo campos personalizados no vacíos
  aplicarCustomOverrides(negocio);

  const heroSection = $('#inicio');
  if (heroSection) heroSection.classList.add('is-hydrated');

  // 5. Encabezado del catálogo y pestañas iniciales desde categoriasDefault
  if ($('#cartaSubtitulo')) $('#cartaSubtitulo').textContent = plantilla.cartaSubtitulo;
  if ($('#cartaTitulo')) $('#cartaTitulo').textContent = plantilla.cartaTitulo;
  renderCategoryPills(plantilla.categoriasDefault, plantilla);

  // 6. Configuración dinámica de enlaces, Top Bar, Footer y WhatsApp
  const rawPhone = negocio.whatsapp || window.WHATSAPP_NUMBER || '51926549398';
  const cleanPhone = String(rawPhone).replace(/\D/g, '');
  const formattedPhone = formatPhone(cleanPhone);
  const waBaseUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Hola ' + negocio.nombre + ', quisiera hacer un pedido')}`;

  if (negocio.slug === 'don-roberto') {
    if ($('#topBarLeft')) {
      const nombreSeguro = escHtml((negocio && negocio.nombre) || 'Catálogo Digital');
      $('#topBarLeft').innerHTML = String(negocio.direccion || '').trim()
        ? `<i class="bi bi-geo-alt-fill text-warning me-1"></i> ${escHtml(negocio.direccion.trim())}`
        : `<i class="bi bi-award-fill text-warning me-1"></i> <strong>${nombreSeguro}</strong> · Productos Artesanales y Pedidos Online`;
    }
    if ($('#topBarRight')) {
      $('#topBarRight').innerHTML = '<span class="me-3"><i class="bi bi-star-fill text-warning me-1"></i> Calidad artesanal todos los días</span><span><i class="bi bi-envelope-fill text-warning me-1"></i> panes.donroberto@gmail.com</span>';
    }
  } else {
    if ($('#topBarLeft')) {
      $('#topBarLeft').innerHTML = String(negocio.direccion || '').trim()
        ? `<i class="bi bi-geo-alt-fill text-warning me-1"></i> ${escHtml(negocio.direccion.trim())}`
        : `<i class="bi ${escHtml(plantilla.icono)} text-warning me-1"></i> <strong>${escHtml(negocio.nombre)}</strong> · Catálogo Online`;
    }
    if ($('#topBarRight')) {
      $('#topBarRight').innerHTML = `<span><i class="bi bi-whatsapp text-warning me-1"></i> Pedidos directos al ${escHtml(formattedPhone)}</span>`;
    }
  }

  renderUbicacion(negocio, waBaseUrl);

  const navWaBtn = $('.navbar .btn-whatsapp-nav');
  if (navWaBtn) {
    navWaBtn.href = waBaseUrl;
    navWaBtn.innerHTML = `<i class="bi bi-whatsapp me-1"></i> Pedir al ${formattedPhone}`;
  }

  const floatWa = $('.whatsapp-float');
  if (floatWa) floatWa.href = waBaseUrl;

  const deliveryWaText = $('#delivery .fs-3.fw-bold');
  if (deliveryWaText) {
    deliveryWaText.innerHTML = `<i class="bi bi-whatsapp text-success me-1"></i> ${formattedPhone}`;
  }
  const deliveryWaLink = $('#delivery a.btn-whatsapp-nav');
  if (deliveryWaLink) deliveryWaLink.href = `https://wa.me/${cleanPhone}`;

  const footerTitle = $('footer h4');
  if (footerTitle) footerTitle.textContent = negocio.nombre;

  const footerBrandSub = $('#footerBrandSub');
  if (footerBrandSub) footerBrandSub.textContent = plantilla.subtituloMarca.replace(/•/g, '').trim().toUpperCase();

  const footerDescripcion = $('#footerDescripcion');
  if (footerDescripcion) footerDescripcion.textContent = plantilla.descripcionFooter;

  const footerLogoIcon = $('#footerLogoIcon');
  if (footerLogoIcon) {
    footerLogoIcon.innerHTML = plantilla.usaHornoSvg
      ? '<svg width="52" height="36"><use href="#horno-don-roberto"></use></svg>'
      : `<i class="bi ${escHtml(plantilla.icono)} fs-1"></i>`;
  }

  const footerCopy = $('footer .opacity-75.small');
  if (footerCopy) {
    footerCopy.textContent = `© ${new Date().getFullYear()} ${negocio.nombre}. Todos los derechos reservados.`;
  }

  const footerEmailLi = $('#footerEmailLi');
  if (footerEmailLi) {
    if (negocio.slug === 'don-roberto') {
      footerEmailLi.classList.remove('d-none');
      footerEmailLi.innerHTML = '<i class="bi bi-envelope me-2 text-warning"></i> panes.donroberto@gmail.com';
    } else {
      footerEmailLi.classList.add('d-none');
    }
  }

  const footerUbicacionLi = $('#footerUbicacionLi');
  if (footerUbicacionLi) {
    const textoUbicacionFooter = String(negocio.direccion || '').trim() || 'Atención Online y Delivery';
    footerUbicacionLi.innerHTML = `<i class="bi bi-geo-alt me-2 text-warning"></i> ${escHtml(textoUbicacionFooter)}`;
  }

  $$('footer ul li').forEach(li => {
    if (li.querySelector('.bi-whatsapp')) {
      li.innerHTML = `<i class="bi bi-whatsapp me-2 text-warning"></i> ${formattedPhone}`;
    }
  });
}

// =============================================================================
// CARGA DE PRODUCTOS Y RENDERIZADO DINÁMICO POR PLANTILLA DE GIRO
// =============================================================================
function crearTarjetaProductoHtml(prod, imgFallback) {
  const imgUrl = safeImgUrl(prod.imagen_url, imgFallback);
  const categoriaBadge = prod.categoria
    ? `<span class="badge-floating">${escHtml(prod.categoria)}</span>`
    : '';

  return `
    <div class="col-sm-6 col-lg-3">
      <div class="product-card">
        <div class="product-img-wrapper">
          ${categoriaBadge}
          <img src="${escHtml(imgUrl)}" alt="${escHtml(prod.nombre)}" onerror="this.onerror=null;this.src='${escHtml(imgFallback)}';">
        </div>
        <div class="product-body">
          <div>
            <h4 class="product-title">${escHtml(prod.nombre)}</h4>
            <p class="text-muted small">${escHtml(prod.descripcion || '')}</p>
          </div>
          <div class="product-footer">
            <span class="product-price">${formatPrice(prod.precio)}</span>
            <button type="button" class="btn-order-item btn-add-cart" data-id="${escHtml(prod.id)}" data-name="${escHtml(prod.nombre)}" data-price="${escHtml(prod.precio)}" data-img="${escHtml(imgUrl)}"><i class="bi bi-cart-plus"></i> Agregar</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCatalogo() {
  const container = $('#catalogSectionsContainer');
  if (!container) return;

  const plantilla = window.plantillaActual || PLANTILLAS_GIRO.general;
  const imgFallback = plantilla.imagenProductoFallback;
  const q = textoBusquedaCatalogo.trim().toLowerCase();

  const filtrados = catalogoProductos.filter(prod => {
    if (categoriaActiva !== 'Todos') {
      const catProd = String(prod.categoria || '').trim().toLowerCase();
      if (catProd !== categoriaActiva.toLowerCase()) return false;
    }
    if (!q) return true;
    const hay = `${prod.nombre || ''} ${prod.descripcion || ''} ${prod.categoria || ''}`.toLowerCase();
    return hay.includes(q);
  });

  if (!catalogoProductos.length) {
    container.innerHTML = '<div class="text-center text-muted py-5"><p class="mb-0">No hay productos registrados en este catálogo.</p></div>';
    return;
  }

  if (!filtrados.length) {
    container.innerHTML = '<div class="text-center text-muted py-5"><p class="mb-0">No encontramos productos en esta categoría o búsqueda.</p></div>';
    return;
  }

  if (categoriaActiva === 'Todos') {
    const grupos = [];
    const categoriasOrden = obtenerCategoriasCatalogo(filtrados, plantilla);
    categoriasOrden.forEach(cat => {
      const items = filtrados.filter(p => String(p.categoria || '').trim().toLowerCase() === cat.toLowerCase());
      if (items.length) {
        grupos.push({ categoria: cat, items });
      }
    });

    const sinCategoria = filtrados.filter(p => !String(p.categoria || '').trim());
    if (sinCategoria.length) {
      grupos.push({ categoria: 'Otros Productos', items: sinCategoria });
    }

    container.innerHTML = grupos.map(g => `
      <div class="category-section">
        <div class="category-header">
          <h3 class="h3 fw-bold mb-1" style="color: var(--verde-bosque);">${escHtml(obtenerEtiquetaCategoria(g.categoria, plantilla))}</h3>
        </div>
        <div class="row g-4 mb-5">
          ${g.items.map(p => crearTarjetaProductoHtml(p, imgFallback)).join('')}
        </div>
      </div>
    `).join('');
  } else {
    container.innerHTML = `
      <div class="category-section">
        <div class="category-header">
          <h3 class="h3 fw-bold mb-1" style="color: var(--verde-bosque);">${escHtml(obtenerEtiquetaCategoria(categoriaActiva, plantilla))}</h3>
        </div>
        <div class="row g-4 mb-5">
          ${filtrados.map(p => crearTarjetaProductoHtml(p, imgFallback)).join('')}
        </div>
      </div>
    `;
  }

  $$('.btn-add-cart', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const prodObj = catalogoProductos.find(p => String(p.id) === String(btn.dataset.id));
      if (prodObj) {
        addToCart({
          id: String(prodObj.id),
          name: prodObj.nombre,
          price: Number(prodObj.precio),
          img: safeImgUrl(prodObj.imagen_url, imgFallback)
        });
      } else {
        addToCart({
          id: btn.dataset.id,
          name: btn.dataset.name,
          price: parseFloat(btn.dataset.price),
          img: btn.dataset.img
        });
      }
    });
  });
}

async function loadProducts() {
  if (!supabaseClient || !window.negocioActual) return;
  const { data: productos, error } = await supabaseClient
    .from('productos')
    .select('*')
    .eq('activo', true)
    .eq('negocio_id', window.negocioActual.id);

  if (error) {
    console.error("Error al cargar productos del negocio:", error);
    showToast('Error cargando el catálogo', 'danger');
    return;
  }

  catalogoProductos = productos || [];
  const plantilla = window.plantillaActual || obtenerPlantillaGiro(window.negocioActual.tipo_negocio);
  const categoriasCombinadas = obtenerCategoriasCatalogo(catalogoProductos, plantilla);

  renderCategoryPills(categoriasCombinadas, plantilla);
  renderCatalogo();
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

// =============================================================================
// 6. CONFIRMAR PEDIDO (CREACIÓN CON negocio_id Y CHECKOUT WHATSAPP)
// =============================================================================
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
    if (!window.negocioActual || !window.negocioActual.id) {
      showToast('Error: No se ha identificado la tienda activa.', 'danger');
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

    // REGISTRO DEL PEDIDO MULTI-TENANT
    let numeroPedido = null;
    let pedidoId = null;

    // 1. Inserción directa en tabla 'pedidos' vinculando obligatoriamente negocio_id
    const pedidoPayload = {
      negocio_id: window.negocioActual.id,
      cliente_nombre: nombre,
      cliente_telefono: telefonoLimpio,
      tipo_entrega: tipo,
      direccion: tipo === 'Delivery' ? direccion : null,
      metodo_pago: pagoLabel,
      total: total,
      comprobante_url: comprobantePath
    };

    const { data: pedidoData, error: pedidoErr } = await supabaseClient
      .from('pedidos')
      .insert(pedidoPayload)
      .select('id, numero_pedido')
      .single();

    if (!pedidoErr && pedidoData) {
      pedidoId = pedidoData.id;
      numeroPedido = pedidoData.numero_pedido;

      // Inserción de los items del pedido
      const itemsPayload = cart.map(i => ({
        pedido_id: pedidoId,
        producto_id: String(i.id),
        producto_nombre: i.name,
        precio_unitario: Number(i.price),
        cantidad: Number(i.qty),
        subtotal: Number(i.price * i.qty)
      }));

      const { error: itemsErr } = await supabaseClient
        .from('pedido_items')
        .insert(itemsPayload);

      if (itemsErr) console.warn('Advertencia al registrar pedido_items:', itemsErr);
    } else {
      // Fallback a función RPC si estuviera configurada en Supabase
      const itemsRpcPayload = cart.map(i => ({ producto_id: String(i.id), cantidad: Number(i.qty) }));
      const { data: rpcPedido, error: rpcErr } = await supabaseClient.rpc('registrar_pedido_seguro', {
        p_negocio_id: window.negocioActual.id,
        p_nombre: nombre,
        p_telefono: telefonoLimpio,
        p_tipo_entrega: tipo,
        p_direccion: tipo === 'Delivery' ? direccion : null,
        p_metodo_pago: pagoLabel,
        p_comprobante_url: comprobantePath,
        p_items: itemsRpcPayload
      });

      if (rpcErr || !rpcPedido) {
        console.error('Error registrando pedido:', pedidoErr || rpcErr);
        showToast((pedidoErr && pedidoErr.message) || (rpcErr && rpcErr.message) || 'No se pudo registrar el pedido. Intenta nuevamente.', 'danger');
        return;
      }
      numeroPedido = rpcPedido.numero_pedido;
    }

    // CHECKOUT WHATSAPP DINÁMICO
    const storeName = window.negocioActual.nombre || 'Tienda';
    const storeWa = (window.negocioActual.whatsapp || window.WHATSAPP_NUMBER || '').replace(/\D/g, '');
    let msg = `🛒 *NUEVO PEDIDO #${numeroPedido || ''} - ${storeName}*\n👤 ${nombre}\n📱 ${telefono}\n📍 ${tipo}\n`;
    if (tipo === 'Delivery') msg += `🏠 ${direccion}\n`;
    cart.forEach(i => { msg += `• ${i.qty}× ${i.name} — ${formatPrice(i.price * i.qty)}\n`; });
    msg += `\n*TOTAL: ${formatPrice(total)}*\nPago: ${pagoLabel}`;
    const waUrl = `https://wa.me/${storeWa}?text=${encodeURIComponent(msg)}`;
    const waWin = window.open(waUrl, '_blank');
    if (!waWin) { cart = []; saveCart(); window.location.href = waUrl; return; }
    showToast(`Pedido enviado ✅`);
    setTimeout(() => {
      cart = []; saveCart(); renderCart(); updateCartCount(); resetComprobante();
      const m = bootstrap.Modal.getInstance($('#checkoutModal')); if(m) m.hide();
      const o = bootstrap.Offcanvas.getInstance($('#cartOffcanvas')); if(o) o.hide();
    }, 1000);
  } catch (err) { console.error(err); showToast('Error procesando el pedido', 'danger'); }
  finally { btn.disabled = false; btn.innerHTML = orig; }
}

// =============================================================================
// 7. INICIALIZACIÓN DE LA APLICACIÓN
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar inquilino por URL (?tienda=slug)
  initTenant();

  // --- LÓGICA DE LAS PESTAÑAS Y BUSCADOR DEL CATÁLOGO (DELEGACIÓN DINÁMICA) ---
  const categoryMenu = $('#category-menu');
  if (categoryMenu) {
    categoryMenu.addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('.category-pill') : null;
      if (!btn || !btn.dataset.category) return;
      e.preventDefault();
      categoriaActiva = btn.dataset.category;
      $$('#category-menu .category-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCatalogo();
    });
  }

  const catalogSearch = $('#catalogSearchInput');
  if (catalogSearch) {
    catalogSearch.addEventListener('input', (e) => {
      textoBusquedaCatalogo = e.target.value || '';
      renderCatalogo();
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

// =============================================================================
// MODAL: MI PEDIDO (SEGUIMIENTO Y CONSULTA POR TELÉFONO)
// =============================================================================
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
