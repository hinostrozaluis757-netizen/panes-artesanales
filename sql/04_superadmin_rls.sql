-- ARCHIVO: sql/04_superadmin_rls.sql
-- =============================================================================
-- PANEL DE SÚPER ADMIN: POLÍTICAS RLS EN TABLA 'negocios'
-- =============================================================================
-- Script idempotente para ejecutar en el SQL Editor de Supabase.
-- Permite únicamente a 'hinostrozaluis757@gmail.com' consultar (SELECT) y
-- activar/suspender (UPDATE) todos los registros de 'negocios' (incluyendo los
-- inactivos), manteniendo intacto el aislamiento multi-tenant del resto de dueños.
-- =============================================================================

BEGIN;

ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

-- Limpieza preventiva para garantizar idempotencia en re-ejecuciones
DROP POLICY IF EXISTS "superadmin_select_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_update_all_negocios" ON public.negocios;

-- 1. Lectura total de negocios (activos e inactivos) para el Súper Admin
CREATE POLICY "superadmin_select_all_negocios"
  ON public.negocios
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'hinostrozaluis757@gmail.com'
  );

-- 2. Actualización global de negocios (ej. activar/suspender inquilinos) para el Súper Admin
CREATE POLICY "superadmin_update_all_negocios"
  ON public.negocios
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'hinostrozaluis757@gmail.com'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'hinostrozaluis757@gmail.com'
  );

COMMIT;
