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

async function ejecutarRollbackCrearNegocio(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  ids: { negocioId: string | null; ownerId: string | null }
): Promise<{ rollback_executed: boolean; rollback_ok: boolean; rollback_errors: string[] }> {
  const errores: string[] = [];
  let executed = false;

  if (!supabaseAdmin) {
    return { rollback_executed: false, rollback_ok: true, rollback_errors: [] };
  }

  if (ids.negocioId) {
    executed = true;
    try {
      const { error: delNegErr } = await supabaseAdmin
        .from('negocios')
        .delete()
        .eq('id', ids.negocioId);
      if (delNegErr) {
        errores.push(`negocios: ${delNegErr.message}`);
        console.error('Error revirtiendo fila en public.negocios:', delNegErr);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push(`negocios: ${msg}`);
      console.error('Excepción revirtiendo fila en public.negocios:', e);
    }
  }

  if (ids.ownerId) {
    executed = true;
    try {
      const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(ids.ownerId);
      if (delUserErr) {
        errores.push(`auth.users: ${delUserErr.message}`);
        console.error('Error revirtiendo usuario Auth:', delUserErr);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push(`auth.users: ${msg}`);
      console.error('Excepción revirtiendo usuario Auth:', e);
    }
  }

  return {
    rollback_executed: executed,
    rollback_ok: errores.length === 0,
    rollback_errors: errores,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // deno-lint-ignore no-explicit-any
  let supabaseAdmin: any = null;
  let ownerIdCreado: string | null = null;
  let negocioIdCreado: string | null = null;

  try {
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
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
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
      return jsonResponse(
        req,
        {
          error: `No se pudo validar la disponibilidad del slug: ${slugCheckError.message}`,
          postgres_error: slugCheckError.message,
          code: slugCheckError.code ?? null,
        },
        500
      );
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
      const authErrMsg = String(createUserError?.message || 'Error desconocido al crear usuario en Auth.');
      const msgLower = authErrMsg.toLowerCase();
      const yaExiste = msgLower.includes('already') || msgLower.includes('registered') || msgLower.includes('exists');
      return jsonResponse(
        req,
        {
          error: yaExiste
            ? `Ya existe una cuenta registrada con ese correo electrónico (${authErrMsg}).`
            : `No se pudo crear la cuenta del dueño en Auth: ${authErrMsg}`,
          detail: authErrMsg,
        },
        400
      );
    }

    const ownerId = userData.user.id;
    ownerIdCreado = ownerId;

    // 7. Insertar en public.negocios con rollback obligatorio si falla
    let negocioCreado: Record<string, unknown> | null = null;
    let insertNegocioError: { message?: string; code?: string; details?: string; hint?: string } | null = null;

    try {
      const resNeg = await supabaseAdmin
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
      negocioCreado = resNeg.data;
      insertNegocioError = resNeg.error;
    } catch (insertNegThrown) {
      insertNegocioError = {
        message: insertNegThrown instanceof Error ? insertNegThrown.message : String(insertNegThrown),
      };
    }

    if (insertNegocioError || !negocioCreado) {
      console.error('Error insertando en public.negocios:', insertNegocioError);
      const rb = await ejecutarRollbackCrearNegocio(supabaseAdmin, {
        negocioId: null,
        ownerId: userData.user.id,
      });
      ownerIdCreado = null;

      const pgMessage = String(insertNegocioError?.message || 'Error desconocido al insertar en public.negocios.');
      const pgCode = insertNegocioError?.code ?? null;
      const esDuplicado = pgCode === '23505';
      return jsonResponse(
        req,
        {
          error: esDuplicado
            ? `El slug "${slug}" ya fue ocupado (${pgMessage}).`
            : `Error al registrar el negocio en PostgreSQL: ${pgMessage}`,
          postgres_error: pgMessage,
          detail: pgMessage,
          code: pgCode,
          details: insertNegocioError?.details ?? null,
          hint: insertNegocioError?.hint ?? null,
          rollback_executed: rb.rollback_executed,
          rollback_ok: rb.rollback_ok,
          rollback_errors: rb.rollback_errors,
        },
        esDuplicado ? 400 : 500
      );
    }

    negocioIdCreado = String(negocioCreado.id);

    // 8. Insertar fila comercial en public.negocios_gobierno con rollback total si falla
    let gobiernoCreado: Record<string, unknown> | null = null;
    let insertGobiernoError: { message?: string; code?: string; details?: string; hint?: string } | null = null;

    try {
      const resGob = await supabaseAdmin
        .from('negocios_gobierno')
        .insert({
          negocio_id: negocioCreado.id,
          plan: rawPlan,
          fecha_vencimiento_plan: fechaVenc.valor,
        })
        .select()
        .single();
      gobiernoCreado = resGob.data;
      insertGobiernoError = resGob.error;
    } catch (insertGobThrown) {
      insertGobiernoError = {
        message: insertGobThrown instanceof Error ? insertGobThrown.message : String(insertGobThrown),
      };
    }

    if (insertGobiernoError || !gobiernoCreado) {
      console.error('Error insertando en public.negocios_gobierno:', insertGobiernoError);
      const rb = await ejecutarRollbackCrearNegocio(supabaseAdmin, {
        negocioId: negocioIdCreado,
        ownerId: userData.user.id,
      });
      negocioIdCreado = null;
      ownerIdCreado = null;

      const pgMessage = String(insertGobiernoError?.message || 'Error desconocido al insertar en public.negocios_gobierno.');
      return jsonResponse(
        req,
        {
          error: `Error al registrar configuración comercial en PostgreSQL: ${pgMessage}`,
          postgres_error: pgMessage,
          detail: pgMessage,
          code: insertGobiernoError?.code ?? null,
          details: insertGobiernoError?.details ?? null,
          hint: insertGobiernoError?.hint ?? null,
          rollback_executed: rb.rollback_executed,
          rollback_ok: rb.rollback_ok,
          rollback_errors: rb.rollback_errors,
        },
        500
      );
    }

    // Alta confirmada: desactivar limpieza pendiente
    negocioIdCreado = null;
    ownerIdCreado = null;

    // 9. Registrar evento CREAR_NEGOCIO en logs_auditoria (sin abortar el alta si falla el log)
    try {
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
    } catch (auditThrown) {
      console.error('Excepción registrando auditoría CREAR_NEGOCIO:', auditThrown);
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
  } catch (err) {
    console.error('Excepción no controlada en crear-negocio:', err);
    const rb = await ejecutarRollbackCrearNegocio(supabaseAdmin, {
      negocioId: negocioIdCreado,
      ownerId: ownerIdCreado,
    });
    const errMsg = err instanceof Error && err.message ? err.message : String(err || 'Error interno inesperado.');
    return jsonResponse(
      req,
      {
        error: `Error inesperado al crear el negocio: ${errMsg}`,
        detail: errMsg,
        rollback_executed: rb.rollback_executed,
        rollback_ok: rb.rollback_ok,
        rollback_errors: rb.rollback_errors,
      },
      500
    );
  }
});
