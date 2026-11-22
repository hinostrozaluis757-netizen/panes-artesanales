-- ARCHIVO: sql/12_expansion_giros_visuales_ROLLBACK.sql
-- =============================================================================
-- ROLLBACK DE PASO 5: PORTADA EDITABLE, COLUMNAS VISUALES Y STORAGE SEGURO
-- =============================================================================
-- Revertir únicamente los cambios introducidos por sql/12_expansion_giros_visuales.sql:
-- 1. Elimina las políticas RLS de storage.objects sobre el bucket 'negocios-media'.
-- 2. Elimina las restricciones CHECK y las columnas nuevas (hero_subtitulo_custom,
--    hero_foco, hero_overlay) de public.negocios.
-- 3. Conserva intactas las columnas previas de sql/08 (hero_imagen_url,
--    hero_titulo_custom, color_primario, color_secundario, logo_url).
-- 4. Restaura la definición de public.proteger_columnas_negocios() de sql/10.
-- =============================================================================

BEGIN;

-- 1. Eliminar políticas de Storage del bucket 'negocios-media'
DROP POLICY IF EXISTS "negocios_media_public_select" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_superadmin_all" ON storage.objects;

-- Nota: No se borra el bucket 'negocios-media' ni sus objetos físicos automáticamente
-- para evitar pérdida accidental de archivos si hubiera imágenes en uso.
-- Si deseas vaciarlo y borrarlo manualmente en Supabase:
-- DELETE FROM storage.objects WHERE bucket_id = 'negocios-media';
-- DELETE FROM storage.buckets WHERE id = 'negocios-media';

-- 2. Eliminar constraints y columnas nuevas en public.negocios
ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_hero_subtitulo_custom_chk;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_hero_foco_chk;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_hero_overlay_chk;

ALTER TABLE public.negocios
  DROP COLUMN IF EXISTS hero_subtitulo_custom;

ALTER TABLE public.negocios
  DROP COLUMN IF EXISTS hero_foco;

ALTER TABLE public.negocios
  DROP COLUMN IF EXISTS hero_overlay;

-- 3. Restaurar función public.proteger_columnas_negocios() al estado de sql/10
CREATE OR REPLACE FUNCTION public.proteger_columnas_negocios()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'authenticated' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'No está permitido modificar owner_id en negocios.';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'No está permitido modificar created_at en negocios.';
    END IF;

    IF NOT public.es_superadmin() THEN
      IF NEW.activo IS DISTINCT FROM OLD.activo THEN
        RAISE EXCEPTION 'Solo el Súper Admin puede modificar el estado activo del negocio.';
      END IF;

      IF NEW.slug IS DISTINCT FROM OLD.slug THEN
        RAISE EXCEPTION 'Solo el Súper Admin puede modificar el slug del negocio.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
