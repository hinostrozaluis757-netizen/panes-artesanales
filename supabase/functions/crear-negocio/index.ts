// ARCHIVO: supabase/functions/crear-negocio/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLANES_PERMITIDOS = new Set(['basico', 'pro', 'enterprise']);

const TIPOS_NEGOCIO_PERMITIDOS = new Set([
  'panaderia',
  'botica',
  'restaurante',
  'ferreteria',
  'ropa',
  'general',
  'licoreria',
  'libreria',
  'minimarket',
  'cafeteria',
  'veterinaria',
  'peluqueria',
  'taller',
]);

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizarSlug(raw: string): string {
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

function parseFechaIsoOpcional(raw: unknown): { valida: boolean; valor: string | null } {
  if (raw === null || raw === undefined) return { valida: true, valor: null };
  const s = String(raw).trim();
  if (!s) return { valida: true, valor: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { valida: false, valor: null };
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const ok = dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  return ok ? { valida: true, valor: s } : { valida: false, valor: null };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Manejo completo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido. Usa POST.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(
      { error: 'Configuración incompleta del entorno en la Edge Function.' },
      500
    );
  }

  // 2. Verificación Zero-Trust del JWT del llamador
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse({ error: 'No autorizado' }, 403);
  }

  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return jsonResponse({ error: 'No autorizado' }, 403);
  }

  const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await supabaseAuthClient.auth.getUser(jwt);

  if (callerError || !caller?.id) {
    return jsonResponse({ error: 'No autorizado' }, 403);
  }

  // 3. Cliente administrativo privilegiado (service_role) y autorización por tabla superadmins
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: superadminRow, error: superadminError } = await supabaseAdmin
    .from('superadmins')
    .select('user_id, rol, activo')
    .eq('user_id', caller.id)
    .eq('activo', true)
    .maybeSingle();

  if (superadminError || !superadminRow) {
    return jsonResponse({ error: 'No autorizado' }, 403);
  }

  // 4. Parseo y validación de entrada
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'El cuerpo de la petición debe ser JSON válido.' }, 400);
  }

  const nombreNegocio = String(body?.nombre_negocio ?? '').trim();
  const slug = normalizarSlug(String(body?.slug ?? ''));
  const rawTipo = String(body?.tipo_negocio ?? 'general').trim().toLowerCase();
  const tipoNegocio = TIPOS_NEGOCIO_PERMITIDOS.has(rawTipo) ? rawTipo : 'general';
  const rawPlan = body?.plan === undefined || body?.plan === null || String(body.plan).trim() === ''
    ? 'basico'
    : String(body.plan).trim().toLowerCase();
  const fechaVenc = parseFechaIsoOpcional(body?.fecha_vencimiento_plan);
  const whatsappClean = String(body?.whatsapp ?? '').replace(/\D/g, '') || null;
  const emailDueno = String(body?.email_dueno ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!nombreNegocio) {
    return jsonResponse({ error: 'El nombre del negocio es obligatorio.' }, 400);
  }

  if (!slug) {
    return jsonResponse({ error: 'El slug es obligatorio y debe contener letras o números.' }, 400);
  }

  if (!PLANES_PERMITIDOS.has(rawPlan)) {
    return jsonResponse({ error: 'Plan inválido. Valores permitidos: basico, pro, enterprise.' }, 400);
  }

  if (!fechaVenc.valida) {
    return jsonResponse({ error: 'La fecha de vencimiento del plan debe tener formato YYYY-MM-DD.' }, 400);
  }

  if (!emailDueno || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDueno)) {
    return jsonResponse({ error: 'Ingresa un correo electrónico válido para el dueño.' }, 400);
  }

  if (!password || password.length < 6) {
    return jsonResponse(
      { error: 'La contraseña temporal debe tener al menos 6 caracteres.' },
      400
    );
  }

  // 5. Verificar unicidad de slug ANTES de tocar auth.users
  const { data: slugExistente, error: slugCheckError } = await supabaseAdmin
    .from('negocios')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (slugCheckError) {
    return jsonResponse(
      { error: `Error al validar el slug: ${slugCheckError.message}` },
      500
    );
  }

  if (slugExistente) {
    return jsonResponse(
      { error: `El slug "${slug}" ya existe. Elige un identificador diferente.` },
      400
    );
  }

  // 6. Crear usuario dueño en Supabase Auth (confirmado automáticamente)
  const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: emailDueno,
    password,
    email_confirm: true,
    user_metadata: {
      rol: 'owner',
      negocio_slug: slug,
    },
  });

  if (createUserError || !userData?.user?.id) {
    return jsonResponse(
      {
        error: createUserError?.message || 'No se pudo crear la cuenta del dueño en Auth.',
      },
      400
    );
  }

  const ownerId = userData.user.id;

  // 7. Insertar negocio en 'negocios' con rollback obligatorio si falla
  const { data: negocioCreado, error: insertNegocioError } = await supabaseAdmin
    .from('negocios')
    .insert({
      nombre: nombreNegocio,
      slug,
      whatsapp: whatsappClean,
      tipo_negocio: tipoNegocio,
      plan: rawPlan,
      fecha_vencimiento_plan: fechaVenc.valor,
      owner_id: ownerId,
      activo: true,
    })
    .select()
    .single();

  if (insertNegocioError || !negocioCreado) {
    const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(ownerId);
    const detalleError = insertNegocioError?.message || 'Error desconocido al insertar en negocios.';

    return jsonResponse(
      {
        error: `No se pudo registrar el negocio: ${detalleError}`,
        detail: detalleError,
        rollback_executed: true,
        rollback_ok: !rollbackError,
        rollback_error: rollbackError?.message ?? null,
      },
      insertNegocioError?.code === '23505' ? 400 : 500
    );
  }

  // 8. Registrar evento inmutable en bitácora de auditoría
  const { error: auditError } = await supabaseAdmin
    .from('logs_auditoria')
    .insert({
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      accion: 'CREAR_NEGOCIO',
      entidad: 'negocios',
      entidad_id: String(negocioCreado.id),
      detalles: {
        nombre: negocioCreado.nombre,
        slug: negocioCreado.slug,
        tipo_negocio: negocioCreado.tipo_negocio,
        plan: negocioCreado.plan,
        fecha_vencimiento_plan: negocioCreado.fecha_vencimiento_plan,
        owner_id: ownerId,
        owner_email: emailDueno,
      },
    });

  if (auditError) {
    console.error('Advertencia registrando auditoría CREAR_NEGOCIO:', auditError);
  }

  // 9. Éxito (201 Created)
  return jsonResponse(
    {
      negocio: negocioCreado,
      owner: {
        id: ownerId,
        email: userData.user.email,
      },
    },
    201
  );
});
