// ARCHIVO: supabase/functions/crear-negocio/index.ts
// TODO: fijar versión exacta @supabase/supabase-js@2.x.y verificada contra esm.sh antes del despliegue
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://hinostrozaluis757-netizen.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

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

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonResponse(req: Request, payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(req),
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
    return new Response('ok', { status: 200, headers: buildCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Método no permitido. Usa POST.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    console.error('Faltan variables de entorno requeridas en crear-negocio.');
    return jsonResponse(
      req,
      { error: 'Configuración incompleta del servicio en el servidor.' },
      500
    );
  }

  // 2. Verificación Zero-Trust del JWT del llamador
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse(req, { error: 'No autorizado.' }, 403);
  }

  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return jsonResponse(req, { error: 'No autorizado.' }, 403);
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
    if (callerError) console.error('Error validando JWT en crear-negocio:', callerError);
    return jsonResponse(req, { error: 'No autorizado.' }, 403);
  }

  // 3. Cliente service_role y verificación en tabla public.superadmins
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
    if (superadminError) console.error('Error verificando superadmins en crear-negocio:', superadminError);
    return jsonResponse(req, { error: 'No autorizado.' }, 403);
  }

  // 4. Parseo y validación estricta de entrada
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'El cuerpo de la petición debe ser JSON válido.' }, 400);
  }

  const nombreNegocio = String(body?.nombre_negocio ?? '').trim();
  const slug = normalizarSlug(String(body?.slug ?? ''));
  const rawTipo = body?.tipo_negocio === undefined || body?.tipo_negocio === null || String(body.tipo_negocio).trim() === ''
    ? 'general'
    : String(body.tipo_negocio).trim().toLowerCase();
  const rawPlan = body?.plan === undefined || body?.plan === null || String(body.plan).trim() === ''
    ? 'basico'
    : String(body.plan).trim().toLowerCase();
  const fechaVenc = parseFechaIsoOpcional(body?.fecha_vencimiento_plan);
  const rawWhatsapp = String(body?.whatsapp ?? '').trim();
  const whatsappDigits = rawWhatsapp.replace(/\D/g, '');
  const whatsappClean = whatsappDigits ? whatsappDigits : null;
  const emailDueno = String(body?.email_dueno ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!nombreNegocio || nombreNegocio.length > 100) {
    return jsonResponse(
      req,
      { error: 'El nombre del negocio es obligatorio y debe tener máximo 100 caracteres.' },
      400
    );
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 40) {
    return jsonResponse(
      req,
      { error: 'El slug debe tener entre 3 y 40 caracteres (solo minúsculas, números y guiones internos).' },
      400
    );
  }

  if (!TIPOS_NEGOCIO_PERMITIDOS.has(rawTipo)) {
    return jsonResponse(req, { error: 'El giro comercial indicado no es válido.' }, 400);
  }

  if (!PLANES_PERMITIDOS.has(rawPlan)) {
    return jsonResponse(
      req,
      { error: 'Plan inválido. Valores permitidos: basico, pro, enterprise.' },
      400
    );
  }

  if (!fechaVenc.valida) {
    return jsonResponse(
      req,
      { error: 'La fecha de vencimiento del plan debe tener formato YYYY-MM-DD válido.' },
      400
    );
  }

  if (whatsappClean !== null && !/^\d{9,15}$/.test(whatsappClean)) {
    return jsonResponse(
      req,
      { error: 'El WhatsApp debe contener entre 9 y 15 dígitos o dejarse vacío.' },
      400
    );
  }

  if (!emailDueno || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDueno)) {
    return jsonResponse(req, { error: 'Ingresa un correo electrónico válido para el dueño.' }, 400);
  }

  if (password.length < 12 || password.length > 72) {
    return jsonResponse(
      req,
      { error: 'La contraseña temporal debe tener entre 12 y 72 caracteres.' },
      400
    );
  }

  // 5. Verificar unicidad de slug ANTES de crear usuario en Auth
  const { data: slugExistente, error: slugCheckError } = await supabaseAdmin
    .from('negocios')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (slugCheckError) {
    console.error('Error comprobando unicidad de slug en crear-negocio:', slugCheckError);
    return jsonResponse(req, { error: 'No se pudo validar la disponibilidad del slug.' }, 500);
  }

  if (slugExistente) {
    return jsonResponse(
      req,
      { error: `El slug "${slug}" ya existe. Elige un identificador diferente.` },
      400
    );
  }

  // 6. Crear usuario dueño en Supabase Auth (sin user_metadata.rol)
  const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: emailDueno,
    password,
    email_confirm: true,
  });

  if (createUserError || !userData?.user?.id) {
    console.error('Error creando usuario en Auth:', createUserError);
    const msgAuth = String(createUserError?.message || '').toLowerCase();
    const yaExiste = msgAuth.includes('already') || msgAuth.includes('registered') || msgAuth.includes('exists');
    return jsonResponse(
      req,
      {
        error: yaExiste
          ? 'Ya existe una cuenta registrada con ese correo electrónico.'
          : 'No se pudo crear la cuenta del dueño en el sistema de autenticación.',
      },
      400
    );
  }

  const ownerId = userData.user.id;

  // 7. Insertar en public.negocios con rollback obligatorio si falla
  const { data: negocioCreado, error: insertNegocioError } = await supabaseAdmin
    .from('negocios')
    .insert({
      nombre: nombreNegocio,
      slug,
      whatsapp: whatsappClean,
      tipo_negocio: rawTipo,
      owner_id: ownerId,
      activo: true,
    })
    .select()
    .single();

  if (insertNegocioError || !negocioCreado) {
    console.error('Error insertando en public.negocios:', insertNegocioError);
    const { error: rollbackUserErr } = await supabaseAdmin.auth.admin.deleteUser(ownerId);
    if (rollbackUserErr) {
      console.error('Error revirtiendo usuario Auth tras fallo en negocios:', rollbackUserErr);
    }

    const esDuplicado = insertNegocioError?.code === '23505';
    return jsonResponse(
      req,
      {
        error: esDuplicado
          ? `El slug "${slug}" ya fue ocupado. Intenta con otro identificador.`
          : 'No se pudo registrar el negocio en la base de datos. Se revirtió la cuenta creada.',
      },
      esDuplicado ? 400 : 500
    );
  }

  // 8. Insertar fila comercial en public.negocios_gobierno con rollback total si falla
  const { data: gobiernoCreado, error: insertGobiernoError } = await supabaseAdmin
    .from('negocios_gobierno')
    .insert({
      negocio_id: negocioCreado.id,
      plan: rawPlan,
      fecha_vencimiento_plan: fechaVenc.valor,
    })
    .select()
    .single();

  if (insertGobiernoError || !gobiernoCreado) {
    console.error('Error insertando en public.negocios_gobierno:', insertGobiernoError);
    const { error: rollbackNegErr } = await supabaseAdmin
      .from('negocios')
      .delete()
      .eq('id', negocioCreado.id);
    if (rollbackNegErr) {
      console.error('Error revirtiendo negocio tras fallo en negocios_gobierno:', rollbackNegErr);
    }
    const { error: rollbackUserErr } = await supabaseAdmin.auth.admin.deleteUser(ownerId);
    if (rollbackUserErr) {
      console.error('Error revirtiendo usuario Auth tras fallo en negocios_gobierno:', rollbackUserErr);
    }

    return jsonResponse(
      req,
      { error: 'No se pudo registrar la configuración comercial del negocio. Se revirtió la operación.' },
      500
    );
  }

  // 9. Registrar evento CREAR_NEGOCIO en logs_auditoria (sin abortar el alta si falla el log)
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
        plan: gobiernoCreado.plan,
        fecha_vencimiento_plan: gobiernoCreado.fecha_vencimiento_plan,
        owner_id: ownerId,
        owner_email: emailDueno,
      },
    });

  if (auditError) {
    console.error('Error registrando auditoría CREAR_NEGOCIO:', auditError);
  }

  // 10. Éxito (201 Created)
  return jsonResponse(
    req,
    {
      negocio: negocioCreado,
      gobierno: gobiernoCreado,
      owner: {
        id: ownerId,
        email: userData.user.email,
      },
    },
    201
  );
});
