-- ARCHIVO: sql/08_custom_branding_y_borrado.sql
-- =============================================================================
-- BRANDING PERSONALIZADO POR INQUILINO Y ELIMINACIÓN SEGURA (SÚPER ADMIN)
-- =============================================================================
-- Script idempotente y transaccional para ejecutar en el SQL Editor de Supabase.
-- 1. Agrega columnas de personalización visual (hero_imagen_url, hero_titulo_custom,
--    color_primario, color_secundario, logo_url) a public.negocios.
-- 2. Verifica/asegura que las políticas RLS de public.negocios permitan al Súper
--    Admin (hinostrozaluis757@gmail.com) ejecutar SELECT, UPDATE y DELETE globales,
--    preservando intacto el aislamiento Zero-Trust del resto de dueños y anónimos.
-- =============================================================================

BEGIN;

-- 1. Columnas opcionales de branding personalizado en public.negocios (NULL = usa plantilla)
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS hero_imagen_url text NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS hero_titulo_custom text NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS color_primario text NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS color_secundario text NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS logo_url text NULL;

COMMENT ON COLUMN public.negocios.hero_imagen_url IS
  'URL HTTPS opcional para sobrescribir la imagen de portada de la plantilla del giro.';

COMMENT ON COLUMN public.negocios.hero_titulo_custom IS
  'Título personalizado opcional para el Hero; NULL o vacío usa el título de PLANTILLAS_GIRO.';

COMMENT ON COLUMN public.negocios.color_primario IS
  'Color hexadecimal personalizado para marca/estructura (--color-primario / --verde-bosque); NULL usa plantilla.';

COMMENT ON COLUMN public.negocios.color_secundario IS
  'Color hexadecimal personalizado para acentos, botones y badges (--color-secundario / --dorado-pan); NULL usa plantilla.';

-- 2. Verificación RLS idempotente en public.negocios para Súper Admin (UPDATE y DELETE)
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_select_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_update_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_delete_all_negocios" ON public.negocios;

-- Lectura global del Súper Admin (activos e inactivos)
CREATE POLICY "superadmin_select_all_negocios"
  ON public.negocios
  FOR SELECT
  TO authenticated
  USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'hinostrozaluis757@gmail.com'
  );

-- Actualización global del Súper Admin (estado, giro, branding custom)
CREATE POLICY "superadmin_update_all_negocios"
  ON public.negocios
  FOR UPDATE
  TO authenticated
  USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'hinostrozaluis757@gmail.com'
  )
  WITH CHECK (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'hinostrozaluis757@gmail.com'
  );

-- Eliminación global del Súper Admin (limpieza segura de cuentas de prueba / cascada)
CREATE POLICY "superadmin_delete_all_negocios"
  ON public.negocios
  FOR DELETE
  TO authenticated
  USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'hinostrozaluis757@gmail.com'
  );

COMMIT;
