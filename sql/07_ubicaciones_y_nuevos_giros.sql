-- ARCHIVO: sql/07_ubicaciones_y_nuevos_giros.sql
-- =============================================================================
-- EXPANSIÓN A 13 GIROS COMERCIALES Y UBICACIONES DINÁMICAS POR INQUILINO
-- =============================================================================
-- Script idempotente y transaccional para ejecutar en el SQL Editor de Supabase.
-- 1. Agrega columnas direccion y google_maps_url a public.negocios.
-- 2. Reemplaza de forma segura el CHECK de tipo_negocio para soportar 13 giros.
-- 3. Verifica que el dueño autenticado pueda actualizar su propio negocio (RLS).
-- =============================================================================

BEGIN;

-- 1. Columnas dinámicas de ubicación física y mapa por negocio
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS direccion text;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS google_maps_url text;

COMMENT ON COLUMN public.negocios.direccion IS
  'Dirección física visible en la tienda pública (?tienda=slug) y footer del negocio.';

COMMENT ON COLUMN public.negocios.google_maps_url IS
  'Enlace de Google Maps o URL de embed (https://.../maps/embed...) del local.';

-- 2. Eliminar restricciones CHECK previas sobre tipo_negocio (nombre fijo o generado)
DO $$
DECLARE
  r_con record;
BEGIN
  FOR r_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_negocio%'
  LOOP
    EXECUTE format('ALTER TABLE public.negocios DROP CONSTRAINT IF EXISTS %I', r_con.conname);
  END LOOP;
END $$;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_tipo_negocio_check;

-- 3. Normalizar valores existentes antes de aplicar el nuevo CHECK de 13 giros
UPDATE public.negocios
SET tipo_negocio = 'panaderia'
WHERE slug = 'don-roberto'
  AND (tipo_negocio IS NULL OR btrim(tipo_negocio) = '' OR lower(btrim(tipo_negocio)) = 'general');

UPDATE public.negocios
SET tipo_negocio = CASE
  WHEN lower(btrim(COALESCE(tipo_negocio, ''))) IN (
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
    'taller'
  ) THEN lower(btrim(tipo_negocio))
  ELSE 'general'
END;

ALTER TABLE public.negocios
  ALTER COLUMN tipo_negocio SET DEFAULT 'general';

ALTER TABLE public.negocios
  ALTER COLUMN tipo_negocio SET NOT NULL;

ALTER TABLE public.negocios
  ADD CONSTRAINT negocios_tipo_negocio_check CHECK (
    tipo_negocio IN (
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
      'taller'
    )
  );

COMMENT ON COLUMN public.negocios.tipo_negocio IS
  'Giro comercial del inquilino (13 rubros soportados para theming dinámico).';

-- 4. Verificación Zero-Trust de RLS: el dueño autenticado puede actualizar su propio negocio
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_negocios" ON public.negocios;
DROP POLICY IF EXISTS "owner_update_negocios" ON public.negocios;

CREATE POLICY "owner_manage_negocios"
  ON public.negocios
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

COMMIT;
