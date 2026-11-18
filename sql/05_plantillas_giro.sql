-- ARCHIVO: sql/05_plantillas_giro.sql
-- =============================================================================
-- PLANTILLAS DE GIRO MULTI-RUBRO (THEMING DINÁMICO)
-- =============================================================================
-- Script idempotente para ejecutar en el SQL Editor de Supabase.
-- 1. Agrega 'tipo_negocio' (DEFAULT 'general') a la tabla 'negocios'.
-- 2. Aplica restricción CHECK para los 5 rubros válidos.
-- 3. Migra los negocios existentes (como 'don-roberto') a 'panaderia'
--    en la primera ejecución para conservar su identidad visual actual.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_columna_existia boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'negocios'
      AND column_name = 'tipo_negocio'
  ) INTO v_columna_existia;

  IF NOT v_columna_existia THEN
    ALTER TABLE public.negocios
      ADD COLUMN tipo_negocio text NOT NULL DEFAULT 'general';

    -- Retrocompatibilidad obligatoria: negocios previos conservan plantilla 'panaderia'
    UPDATE public.negocios
    SET tipo_negocio = 'panaderia';
  ELSE
    -- Re-ejecución idempotente: normaliza nulos y asegura el giro original de 'don-roberto'
    UPDATE public.negocios
    SET tipo_negocio = 'general'
    WHERE tipo_negocio IS NULL
       OR tipo_negocio NOT IN ('panaderia', 'botica', 'restaurante', 'ferreteria', 'general');

    UPDATE public.negocios
    SET tipo_negocio = 'panaderia'
    WHERE slug = 'don-roberto';
  END IF;
END $$;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_tipo_negocio_check;

ALTER TABLE public.negocios
  ADD CONSTRAINT negocios_tipo_negocio_check
  CHECK (tipo_negocio IN ('panaderia', 'botica', 'restaurante', 'ferreteria', 'general'));

CREATE INDEX IF NOT EXISTS idx_negocios_tipo_negocio
  ON public.negocios (tipo_negocio);

COMMIT;
