-- ARCHIVO: sql/10_gobernanza_y_blindaje_ROLLBACK.sql
-- =============================================================================
-- ROLLBACK DE GOBERNANZA Y BLINDAJE (FASE 1)
-- =============================================================================
-- Elimina únicamente los objetos nuevos introducidos por sql/10_gobernanza_y_blindaje.sql
-- (triggers, funciones, tablas negocios_gobierno, logs_auditoria y superadmins,
-- constraints e índice único adicional).
--
-- IMPORTANTE:
-- 1. Las políticas RLS anteriores de negocios, productos, pedidos, pedido_items
--    y lotes (así como la definición previa de registrar_pedido_seguro) NO se
--    restauran aquí automáticamente: después de ejecutar este rollback debes
--    re-ejecutar sql/06_blindaje_multitenant_rls.sql y
--    sql/08_custom_branding_y_borrado.sql en el SQL Editor de Supabase.
-- 2. Si ya existían filas en logs_auditoria o negocios_gobierno, este script
--    las eliminará al hacer DROP TABLE. Haz respaldo antes si necesitas conservarlas.
-- =============================================================================

BEGIN;

-- 1. Triggers y funciones de auditoría / protección / vencimiento
DROP TRIGGER IF EXISTS trg_auditoria_update_negocios_gobierno ON public.negocios_gobierno;
DROP FUNCTION IF EXISTS public.fn_auditoria_update_negocios_gobierno();

DROP TRIGGER IF EXISTS trg_auditoria_update_negocios ON public.negocios;
DROP FUNCTION IF EXISTS public.fn_auditoria_update_negocios();

DROP TRIGGER IF EXISTS trg_inmutabilidad_logs_auditoria_row ON public.logs_auditoria;
DROP TRIGGER IF EXISTS trg_inmutabilidad_logs_auditoria_stmt ON public.logs_auditoria;
DROP FUNCTION IF EXISTS public.fn_inmutabilidad_logs_auditoria();

DROP TRIGGER IF EXISTS trg_proteger_negocios ON public.negocios;
DROP FUNCTION IF EXISTS public.proteger_columnas_negocios();

DROP FUNCTION IF EXISTS public.suspender_planes_vencidos();

-- 2. Constraints e índice único agregados sobre public.negocios
ALTER TABLE public.negocios DROP CONSTRAINT IF EXISTS negocios_slug_formato_chk;
ALTER TABLE public.negocios DROP CONSTRAINT IF EXISTS negocios_color_primario_chk;
ALTER TABLE public.negocios DROP CONSTRAINT IF EXISTS negocios_color_secundario_chk;
ALTER TABLE public.negocios DROP CONSTRAINT IF EXISTS negocios_logo_url_chk;
ALTER TABLE public.negocios DROP CONSTRAINT IF EXISTS negocios_hero_imagen_url_chk;
ALTER TABLE public.negocios DROP CONSTRAINT IF EXISTS negocios_hero_titulo_custom_chk;
DROP INDEX IF EXISTS public.idx_negocios_slug_unique;

-- 3. Quitar políticas nuevas en public.negocios que dependen de public.es_superadmin()
DROP POLICY IF EXISTS "superadmin_select_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_update_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "owner_select_negocios" ON public.negocios;
DROP POLICY IF EXISTS "owner_update_negocios" ON public.negocios;

-- 4. Tablas nuevas
DROP TABLE IF EXISTS public.negocios_gobierno CASCADE;
DROP TABLE IF EXISTS public.logs_auditoria CASCADE;

-- 5. Función auxiliar y tabla superadmins
DROP FUNCTION IF EXISTS public.es_superadmin();
DROP TABLE IF EXISTS public.superadmins CASCADE;

COMMIT;
