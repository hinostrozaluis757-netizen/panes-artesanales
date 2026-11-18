// ARCHIVO: supabase/functions/eliminar-negocio/index.ts
// TODO: fijar versión exacta @supabase/supabase-js@2.x.y verificada contra esm.sh antes del despliegue
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://hinostrozaluis757-netizen.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024;
const PAGE_SIZE = 1000;
const SNAPSHOT_TTL_MS = 15 * 60 * 1000;

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

function esUsuarioNoEncontrado(err: { status?: number; message?: string } | null): boolean {
  if (!err) return false;
  if (err.status === 404) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('user not found') ||
    msg.includes('no existe')
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function calcularSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

function generarTokenAleatorio(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

async function fetchAllByEqPaginated(
  supabaseAdmin: SupabaseClient,
  table: string,
  filterCol: string,
  filterVal: string,
  orderCol = 'id'
): Promise<Record<string, unknown>[]> {
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq(filterCol, filterVal)
      .order(orderCol, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Error paginando ${table}: ${error.message}`);
    }

    const chunk = (data as Record<string, unknown>[] | null) ?? [];
    allRows.push(...chunk);

    if (chunk.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return allRows;
}

async function fetchPedidoItemsPaginated(
  supabaseAdmin: SupabaseClient,
  pedidoIds: string[]
): Promise<Record<string, unknown>[]> {
  const allItems: Record<string, unknown>[] = [];
  const ID_BATCH_SIZE = 200;

  for (let i = 0; i < pedidoIds.length; i += ID_BATCH_SIZE) {
    const batchIds = pedidoIds.slice(i, i + ID_BATCH_SIZE);
    let offset = 0;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('pedido_items')
        .select('*')
        .in('pedido_id', batchIds)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Error paginando pedido_items: ${error.message}`);
      }

      const chunk = (data as Record<string, unknown>[] | null) ?? [];
      allItems.push(...chunk);

      if (chunk.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }
  }

  return allItems;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Soporte CORS completo (preflight OPTIONS)
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
    console.error('Faltan variables de entorno requeridas en eliminar-negocio.');
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
    if (callerError) console.error('Error validando JWT en eliminar-negocio:', callerError);
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
    if (superadminError) console.error('Error verificando superadmins en eliminar-negocio:', superadminError);
    return jsonResponse(req, { error: 'No autorizado.' }, 403);
  }

  // 4. Parseo de entrada (se ignora cualquier owner_id del body; se usa solo el de la DB)
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'El cuerpo de la petición debe ser JSON válido.' }, 400);
  }

  const negocioId = String(body?.negocio_id ?? '').trim();
  const accion = String(body?.accion ?? '').trim().toLowerCase();

  if (!negocioId) {
    return jsonResponse(req, { error: 'El campo negocio_id es obligatorio.' }, 400);
  }

  if (accion !== 'snapshot' && accion !== 'eliminar') {
    return jsonResponse(
      req,
      { error: 'Acción inválida. Valores permitidos: "snapshot" o "eliminar".' },
      400
    );
  }

  // 5. Consultar negocio objetivo desde la base de datos
  const { data: negocio, error: findError } = await supabaseAdmin
    .from('negocios')
    .select('*')
    .eq('id', negocioId)
    .maybeSingle();

  if (findError) {
    console.error('Error consultando negocio en eliminar-negocio:', findError);
    return jsonResponse(req, { error: 'No se pudo consultar el negocio solicitado.' }, 500);
  }

  if (!negocio) {
    return jsonResponse(req, { error: 'Negocio no encontrado.' }, 404);
  }

  // ===========================================================================
  // PASO A: SNAPSHOT (SOLO LECTURA + REGISTRO EN AUDITORÍA + TOKEN TEMPORAL)
  // ===========================================================================
  if (accion === 'snapshot') {
    try {
      const [
        { data: gobierno, error: gobError },
        productos,
        lotes,
        pedidos,
      ] = await Promise.all([
        supabaseAdmin
          .from('negocios_gobierno')
          .select('*')
          .eq('negocio_id', negocio.id)
          .maybeSingle(),
        fetchAllByEqPaginated(supabaseAdmin, 'productos', 'negocio_id', String(negocio.id)),
        fetchAllByEqPaginated(supabaseAdmin, 'lotes', 'negocio_id', String(negocio.id)),
        fetchAllByEqPaginated(supabaseAdmin, 'pedidos', 'negocio_id', String(negocio.id)),
      ]);

      if (gobError) {
        throw new Error(`Error consultando negocios_gobierno: ${gobError.message}`);
      }

      const pedidoIds = pedidos
        .map((p) => String(p.id ?? ''))
        .filter(Boolean);
      const pedidoItems = await fetchPedidoItemsPaginated(supabaseAdmin, pedidoIds);

      const snapshot = {
        meta: {
          generado_en: new Date().toISOString(),
          generado_por: caller.email ?? caller.id,
          negocio_id: negocio.id,
          slug: negocio.slug,
        },
        negocio,
        negocios_gobierno: gobierno ?? null,
        productos,
        lotes,
        pedidos,
        pedido_items: pedidoItems,
      };

      const snapshotJson = JSON.stringify(snapshot);
      const snapshotBytes = new TextEncoder().encode(snapshotJson);

      if (snapshotBytes.length > MAX_SNAPSHOT_BYTES) {
        return jsonResponse(
          req,
          {
            error: 'El respaldo del negocio supera el límite de 20 MB. El borrado deberá realizarse manualmente.',
          },
          413
        );
      }

      const sha256 = await calcularSha256Hex(snapshotBytes);
      const snapshotToken = generarTokenAleatorio();

      const { error: auditSnapError } = await supabaseAdmin
        .from('logs_auditoria')
        .insert({
          actor_id: caller.id,
          actor_email: caller.email ?? null,
          accion: 'SNAPSHOT_NEGOCIO',
          entidad: 'negocios',
          entidad_id: String(negocio.id),
          detalles: {
            nombre: negocio.nombre,
            slug: negocio.slug,
            sha256,
            snapshot_token: snapshotToken,
            bytes: snapshotBytes.length,
            conteos: {
              productos: productos.length,
              lotes: lotes.length,
              pedidos: pedidos.length,
              pedido_items: pedidoItems.length,
            },
          },
        });

      if (auditSnapError) {
        console.error('Error registrando SNAPSHOT_NEGOCIO en logs_auditoria:', auditSnapError);
        return jsonResponse(
          req,
          { error: 'No se pudo registrar el respaldo en la bitácora de auditoría.' },
          500
        );
      }

      return jsonResponse(
        req,
        {
          snapshot,
          sha256,
          snapshot_token: snapshotToken,
        },
        200
      );
    } catch (err) {
      console.error('Error generando snapshot en eliminar-negocio:', err);
      return jsonResponse(
        req,
        { error: 'No se pudo generar el respaldo completo del negocio.' },
        500
      );
    }
  }

  // ===========================================================================
  // PASO B: ELIMINACIÓN VERIFICADA (SLUG + TOKEN VIGENTE + ANTI AUTO-BORRADO)
  // ===========================================================================
  const confirmarSlug = String(body?.confirmar_slug ?? '').trim();
  const snapshotToken = String(body?.snapshot_token ?? '').trim();

  if (!confirmarSlug || confirmarSlug !== String(negocio.slug ?? '')) {
    return jsonResponse(
      req,
      { error: 'El slug de confirmación no coincide exactamente con el negocio.' },
      400
    );
  }

  if (!snapshotToken) {
    return jsonResponse(
      req,
      { error: 'Debes generar y descargar el respaldo antes de eliminar el negocio.' },
      400
    );
  }

  // Bloqueo crítico Anti-Suicidio usando exclusivamente negocio.owner_id de la base
  if (negocio.owner_id && String(negocio.owner_id) === String(caller.id)) {
    return jsonResponse(
      req,
      { error: 'No puedes eliminar tu propia cuenta de Súper Admin.' },
      400
    );
  }

  // Verificar snapshot_token emitido para este mismo negocio hace menos de 15 minutos
  const limiteIso = new Date(Date.now() - SNAPSHOT_TTL_MS).toISOString();
  const { data: snapLogs, error: snapFindError } = await supabaseAdmin
    .from('logs_auditoria')
    .select('id, detalles, created_at')
    .eq('accion', 'SNAPSHOT_NEGOCIO')
    .eq('entidad', 'negocios')
    .eq('entidad_id', String(negocio.id))
    .gte('created_at', limiteIso)
    .order('created_at', { ascending: false })
    .limit(20);

  if (snapFindError) {
    console.error('Error validando snapshot_token en logs_auditoria:', snapFindError);
    return jsonResponse(req, { error: 'No se pudo validar el token de respaldo.' }, 500);
  }

  const snapValido = (snapLogs || []).find((row) => {
    const det = row?.detalles as Record<string, unknown> | undefined;
    return det && String(det.snapshot_token ?? '') === snapshotToken;
  });

  if (!snapValido) {
    return jsonResponse(
      req,
      { error: 'El token de respaldo es inválido o expiró (máximo 15 minutos). Genera un nuevo respaldo.' },
      400
    );
  }

  const snapDetalles = (snapValido.detalles ?? {}) as Record<string, unknown>;
  const conteosSnapshot = snapDetalles.conteos ?? {};
  const sha256Snapshot = snapDetalles.sha256 ?? null;

  // 1. Borrar primero el negocio (la cascada limpia negocios_gobierno, productos, lotes, pedidos y pedido_items)
  const { error: deleteNegocioError } = await supabaseAdmin
    .from('negocios')
    .delete()
    .eq('id', negocio.id);

  if (deleteNegocioError) {
    console.error('Error eliminando negocio en PostgreSQL:', deleteNegocioError);
    return jsonResponse(
      req,
      { error: 'No se pudo eliminar el negocio de la base de datos.' },
      500
    );
  }

  // 2. Solo después del borrado en DB, eliminar el usuario de Auth si no administra otros negocios
  const ownerIdToDelete = negocio.owner_id ? String(negocio.owner_id) : null;
  let ownerAuthDeleted = false;
  let warning: string | null = null;

  if (ownerIdToDelete) {
    const { count: otrosNegociosCount, error: countErr } = await supabaseAdmin
      .from('negocios')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerIdToDelete);

    if (countErr) {
      console.error('Error comprobando otros negocios del dueño:', countErr);
      warning = 'El negocio fue eliminado, pero no se pudo verificar si el dueño tiene otros negocios para borrar su usuario en Auth.';
    } else if ((otrosNegociosCount ?? 0) > 0) {
      warning = 'El negocio fue eliminado; el usuario dueño conserva su cuenta en Auth porque administra otros negocios.';
    } else {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(ownerIdToDelete);
      if (deleteUserError && !esUsuarioNoEncontrado(deleteUserError)) {
        console.error('Error eliminando usuario en Auth tras borrar negocio:', deleteUserError);
        warning = 'El negocio fue eliminado, pero ocurrió un problema al borrar el usuario dueño en Auth. Revísalo manualmente.';
      } else {
        ownerAuthDeleted = true;
      }
    }
  }

  // 3. Registrar ELIMINAR_NEGOCIO en logs_auditoria (sin abortar el 200 si falla el log)
  const { error: auditDeleteError } = await supabaseAdmin
    .from('logs_auditoria')
    .insert({
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      accion: 'ELIMINAR_NEGOCIO',
      entidad: 'negocios',
      entidad_id: String(negocio.id),
      detalles: {
        nombre: negocio.nombre,
        slug: negocio.slug,
        owner_id: ownerIdToDelete,
        owner_auth_deleted: ownerAuthDeleted,
        warning,
        sha256_snapshot: sha256Snapshot,
        conteos: conteosSnapshot,
      },
    });

  if (auditDeleteError) {
    console.error('Error registrando ELIMINAR_NEGOCIO en logs_auditoria:', auditDeleteError);
  }

  return jsonResponse(
    req,
    {
      deleted: true,
      negocio_id: negocio.id,
      nombre: negocio.nombre,
      slug: negocio.slug,
      owner_auth_deleted: ownerAuthDeleted,
      warning,
    },
    200
  );
});
