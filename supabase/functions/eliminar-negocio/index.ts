// ARCHIVO: supabase/functions/eliminar-negocio/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Soporte CORS completo (preflight OPTIONS)
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

  // 2. Autenticación Zero-Trust: verificar JWT del llamador
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

  // 4. Validación de entrada
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'El cuerpo de la petición debe ser JSON válido.' }, 400);
  }

  const negocioId = String(body?.negocio_id ?? '').trim();
  const bodyOwnerId = body?.owner_id ? String(body.owner_id).trim() : null;

  if (!negocioId) {
    return jsonResponse({ error: 'El campo negocio_id es obligatorio.' }, 400);
  }

  // 5. Consultar negocio completo objetivo en DB
  const { data: negocio, error: findError } = await supabaseAdmin
    .from('negocios')
    .select('*')
    .eq('id', negocioId)
    .maybeSingle();

  if (findError) {
    return jsonResponse(
      { error: `Error al consultar el negocio: ${findError.message}` },
      500
    );
  }

  if (!negocio) {
    return jsonResponse({ error: 'Negocio no encontrado.' }, 404);
  }

  // 6. Bloqueo crítico Anti-Suicidio
  if (
    (negocio.owner_id && String(negocio.owner_id) === String(caller.id)) ||
    (bodyOwnerId && String(bodyOwnerId) === String(caller.id))
  ) {
    return jsonResponse(
      { error: 'No puedes eliminar tu propia cuenta de Súper Admin' },
      400
    );
  }

  // 7. Recolectar snapshot completo del inquilino ANTES de suspender o borrar
  const [
    { data: productos, error: prodError },
    { data: lotes, error: lotesError },
    { data: pedidos, error: pedidosError },
  ] = await Promise.all([
    supabaseAdmin.from('productos').select('*').eq('negocio_id', negocio.id),
    supabaseAdmin.from('lotes').select('*').eq('negocio_id', negocio.id),
    supabaseAdmin.from('pedidos').select('*').eq('negocio_id', negocio.id),
  ]);

  if (prodError || lotesError || pedidosError) {
    const detalle = prodError?.message || lotesError?.message || pedidosError?.message || 'Error desconocido';
    return jsonResponse(
      { error: `No se pudo generar el respaldo previo del inquilino: ${detalle}` },
      500
    );
  }

  const pedidoIds = (pedidos ?? []).map((p: Record<string, unknown>) => String(p.id)).filter(Boolean);
  const pedidoItems: Record<string, unknown>[] = [];

  for (let i = 0; i < pedidoIds.length; i += 250) {
    const loteIds = pedidoIds.slice(i, i + 250);
    const { data: itemsChunk, error: itemsError } = await supabaseAdmin
      .from('pedido_items')
      .select('*')
      .in('pedido_id', loteIds);

    if (itemsError) {
      return jsonResponse(
        { error: `No se pudo respaldar el detalle de pedidos: ${itemsError.message}` },
        500
      );
    }

    if (itemsChunk && itemsChunk.length > 0) {
      pedidoItems.push(...itemsChunk);
    }
  }

  const snapshot = {
    meta: {
      generado_en: new Date().toISOString(),
      generado_por: caller.email ?? caller.id,
      negocio_id: negocio.id,
      slug: negocio.slug,
    },
    negocio,
    productos: productos ?? [],
    lotes: lotes ?? [],
    pedidos: pedidos ?? [],
    pedido_items: pedidoItems,
  };

  // 8. Suspender inmediatamente el negocio antes del borrado físico
  const { error: suspendError } = await supabaseAdmin
    .from('negocios')
    .update({
      activo: false,
      motivo_suspension: 'Eliminación definitiva ejecutada por Súper Admin',
    })
    .eq('id', negocio.id);

  if (suspendError) {
    return jsonResponse(
      { error: `No se pudo suspender el negocio antes de eliminar: ${suspendError.message}` },
      500
    );
  }

  // 9. Eliminar fila de public.negocios (dispara ON DELETE CASCADE en productos, lotes y pedidos)
  const { error: deleteNegocioError } = await supabaseAdmin
    .from('negocios')
    .delete()
    .eq('id', negocio.id);

  if (deleteNegocioError) {
    return jsonResponse(
      { error: `Error al eliminar el negocio en PostgreSQL: ${deleteNegocioError.message}` },
      500
    );
  }

  // 10. Solo tras confirmar el borrado en PostgreSQL, eliminar cuenta del dueño en Auth
  const ownerIdToDelete = negocio.owner_id ? String(negocio.owner_id) : null;
  let ownerAuthDeleted = false;
  let ownerAuthError: string | null = null;

  if (ownerIdToDelete) {
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(ownerIdToDelete);
    if (deleteUserError && !esUsuarioNoEncontrado(deleteUserError)) {
      ownerAuthError = deleteUserError.message;
      console.error('Advertencia al eliminar usuario en Auth tras borrado de negocio:', deleteUserError);
    } else {
      ownerAuthDeleted = true;
    }
  }

  // 11. Registrar evento inmutable en logs_auditoria con resumen cuantitativo
  const { error: auditError } = await supabaseAdmin
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
        plan: negocio.plan ?? null,
        owner_id: ownerIdToDelete,
        owner_auth_deleted: ownerAuthDeleted,
        owner_auth_error: ownerAuthError,
        resumen_respaldo: {
          productos: snapshot.productos.length,
          lotes: snapshot.lotes.length,
          pedidos: snapshot.pedidos.length,
          pedido_items: snapshot.pedido_items.length,
        },
      },
    });

  if (auditError) {
    console.error('Advertencia registrando auditoría ELIMINAR_NEGOCIO:', auditError);
  }

  return jsonResponse(
    {
      deleted: true,
      negocio_id: negocio.id,
      nombre: negocio.nombre,
      slug: negocio.slug,
      owner_id: ownerIdToDelete,
      owner_auth_deleted: ownerAuthDeleted,
      owner_auth_error: ownerAuthError,
      snapshot,
    },
    200
  );
});
