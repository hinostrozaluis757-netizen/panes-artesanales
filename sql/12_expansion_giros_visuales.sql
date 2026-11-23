-- ARCHIVO: sql/12_expansion_giros_visuales.sql
-- =============================================================================
-- PASO 5: PORTADA EDITABLE DESDE EL ADMIN, COLUMNAS VISUALES Y STORAGE SEGURO
-- =============================================================================
-- INSTRUCCIONES OPERATIVAS:
-- 1. Este script se ejecuta manualmente en el SQL Editor de Supabase (NO automático).
-- 2. Hacer respaldo previo desde el dashboard de Supabase antes de ejecutar.
-- 3. Es idempotente y transaccional.
-- 4. Verificación contra esquema real (PASO 0):
--    - Ya existen en public.negocios (sql/08 y sql/10):
--      hero_imagen_url, hero_titulo_custom, color_primario, color_secundario, logo_url.
--    - Se agregan aquí (si no existen):
--      hero_subtitulo_custom, hero_foco, hero_overlay.
--    - Se configura el bucket público 'negocios-media' (máx. 5 MB, JPG/PNG/WebP)
--      con políticas RLS Zero-Trust por carpeta <negocio_id>/portada-<timestamp>.<ext>.
--    - Se refuerza trg_proteger_negocios (public.proteger_columnas_negocios) para
--      bloquear id, owner_id, created_at, activo, slug y plan (si existiera en
--      public.negocios por sql/09), permitiendo al dueño editar todas las columnas
--      de diseño (hero_imagen_url, hero_titulo_custom, hero_subtitulo_custom,
--      hero_foco, hero_overlay, color_primario, color_secundario, logo_url).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. COLUMNAS DE DISEÑO EN public.negocios (SOLO SI NO EXISTEN)
-- =============================================================================
-- Asegurar columnas previas de sql/08 por idempotencia
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS hero_imagen_url text NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS hero_titulo_custom text NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS color_primario text NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS color_secundario text NULL;

-- Nuevas columnas del PASO 5
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS hero_subtitulo_custom text NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS hero_foco text NOT NULL DEFAULT 'center';

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS hero_overlay smallint NOT NULL DEFAULT 40;

-- Normalizar posibles nulos si las columnas hubieran sido creadas sin NOT NULL
UPDATE public.negocios
SET hero_foco = 'center'
WHERE hero_foco IS NULL
   OR hero_foco NOT IN (
     'center', 'top', 'bottom', 'left', 'right',
     'left top', 'right top', 'left bottom', 'right bottom'
   );

UPDATE public.negocios
SET hero_overlay = 40
WHERE hero_overlay IS NULL
   OR hero_overlay < 0
   OR hero_overlay > 80;

COMMENT ON COLUMN public.negocios.hero_subtitulo_custom IS
  'Subtítulo personalizado opcional para la portada (máx. 160 caracteres); NULL usa el del giro.';

COMMENT ON COLUMN public.negocios.hero_foco IS
  'Punto de enfoque (object-position) de la imagen de portada (9 posiciones permitidas).';

COMMENT ON COLUMN public.negocios.hero_overlay IS
  'Intensidad de la capa oscura sobre la portada (0 a 80 %, por defecto 40).';

-- =============================================================================
-- 2. DIAGNÓSTICO PREVIO Y RESTRICCIONES CHECK SOBRE LAS COLUMNAS DE DISEÑO
-- =============================================================================
-- Consulta diagnóstica previa a ADD CONSTRAINT: lista cualquier fila existente
-- que incumpliría alguna de las restricciones de diseño.
SELECT
  id,
  slug,
  color_primario,
  color_secundario,
  hero_titulo_custom,
  hero_subtitulo_custom,
  hero_imagen_url,
  hero_foco,
  hero_overlay
FROM public.negocios
WHERE (color_primario IS NOT NULL AND color_primario !~ '^#[0-9a-fA-F]{6}$')
   OR (color_secundario IS NOT NULL AND color_secundario !~ '^#[0-9a-fA-F]{6}$')
   OR (hero_titulo_custom IS NOT NULL AND length(hero_titulo_custom) > 140)
   OR (hero_subtitulo_custom IS NOT NULL AND length(hero_subtitulo_custom) > 160)
   OR (
     hero_imagen_url IS NOT NULL
     AND hero_imagen_url !~ '^https://cqoqabnuzjxozxmcvjnl\.supabase\.co/storage/v1/object/public/negocios-media/[0-9a-fA-F-]{36}/portada-[0-9]+\.(webp|jpg|jpeg|png)$'
   )
   OR (
     hero_foco IS NULL
     OR hero_foco NOT IN (
       'center', 'top', 'bottom', 'left', 'right',
       'left top', 'right top', 'left bottom', 'right bottom'
     )
   )
   OR (hero_overlay IS NULL OR hero_overlay < 0 OR hero_overlay > 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_color_primario_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_color_primario_chk
      CHECK (color_primario IS NULL OR color_primario ~ '^#[0-9a-fA-F]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_color_secundario_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_color_secundario_chk
      CHECK (color_secundario IS NULL OR color_secundario ~ '^#[0-9a-fA-F]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_hero_titulo_custom_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_hero_titulo_custom_chk
      CHECK (hero_titulo_custom IS NULL OR length(hero_titulo_custom) <= 140);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_hero_imagen_url_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_hero_imagen_url_chk
      CHECK (
        hero_imagen_url IS NULL
        OR hero_imagen_url ~ '^https://cqoqabnuzjxozxmcvjnl\.supabase\.co/storage/v1/object/public/negocios-media/[0-9a-fA-F-]{36}/portada-[0-9]+\.(webp|jpg|jpeg|png)$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_hero_subtitulo_custom_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_hero_subtitulo_custom_chk
      CHECK (hero_subtitulo_custom IS NULL OR length(hero_subtitulo_custom) <= 160);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_hero_foco_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_hero_foco_chk
      CHECK (
        hero_foco IN (
          'center',
          'top',
          'bottom',
          'left',
          'right',
          'left top',
          'right top',
          'left bottom',
          'right bottom'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_hero_overlay_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_hero_overlay_chk
      CHECK (hero_overlay >= 0 AND hero_overlay <= 80);
  END IF;
END $$;

-- =============================================================================
-- 3. AJUSTE DEL TRIGGER trg_proteger_negocios Y AUDITORÍA DE DISEÑO
-- =============================================================================
CREATE OR REPLACE FUNCTION public.proteger_columnas_negocios()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_new_json jsonb;
  v_old_json jsonb;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'No está permitido modificar id en negocios.';
    END IF;

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

      -- Protección compatible si las columnas legadas de sql/09 existen en public.negocios
      v_new_json := to_jsonb(NEW);
      v_old_json := to_jsonb(OLD);

      IF (v_new_json ->> 'plan') IS DISTINCT FROM (v_old_json ->> 'plan') THEN
        RAISE EXCEPTION 'Solo el Súper Admin puede modificar el plan del negocio.';
      END IF;

      IF (v_new_json ->> 'fecha_vencimiento_plan') IS DISTINCT FROM (v_old_json ->> 'fecha_vencimiento_plan') THEN
        RAISE EXCEPTION 'Solo el Súper Admin puede modificar la fecha de vencimiento del plan.';
      END IF;

      IF (v_new_json ->> 'motivo_suspension') IS DISTINCT FROM (v_old_json ->> 'motivo_suspension') THEN
        RAISE EXCEPTION 'Solo el Súper Admin puede modificar el motivo de suspensión.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_negocios ON public.negocios;
CREATE TRIGGER trg_proteger_negocios
  BEFORE UPDATE
  ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_columnas_negocios();

-- Extender auditoría de public.negocios (si logs_auditoria de sql/10 existe)
DO $$
BEGIN
  IF to_regclass('public.logs_auditoria') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.fn_auditoria_update_negocios()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_antes jsonb := '{}'::jsonb;
        v_despues jsonb := '{}'::jsonb;
        v_accion text;
      BEGIN
        IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
          v_antes := v_antes || jsonb_build_object('nombre', OLD.nombre);
          v_despues := v_despues || jsonb_build_object('nombre', NEW.nombre);
        END IF;

        IF NEW.slug IS DISTINCT FROM OLD.slug THEN
          v_antes := v_antes || jsonb_build_object('slug', OLD.slug);
          v_despues := v_despues || jsonb_build_object('slug', NEW.slug);
        END IF;

        IF NEW.whatsapp IS DISTINCT FROM OLD.whatsapp THEN
          v_antes := v_antes || jsonb_build_object('whatsapp', OLD.whatsapp);
          v_despues := v_despues || jsonb_build_object('whatsapp', NEW.whatsapp);
        END IF;

        IF NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
          v_antes := v_antes || jsonb_build_object('logo_url', OLD.logo_url);
          v_despues := v_despues || jsonb_build_object('logo_url', NEW.logo_url);
        END IF;

        IF NEW.tipo_negocio IS DISTINCT FROM OLD.tipo_negocio THEN
          v_antes := v_antes || jsonb_build_object('tipo_negocio', OLD.tipo_negocio);
          v_despues := v_despues || jsonb_build_object('tipo_negocio', NEW.tipo_negocio);
        END IF;

        IF NEW.direccion IS DISTINCT FROM OLD.direccion THEN
          v_antes := v_antes || jsonb_build_object('direccion', OLD.direccion);
          v_despues := v_despues || jsonb_build_object('direccion', NEW.direccion);
        END IF;

        IF NEW.google_maps_url IS DISTINCT FROM OLD.google_maps_url THEN
          v_antes := v_antes || jsonb_build_object('google_maps_url', OLD.google_maps_url);
          v_despues := v_despues || jsonb_build_object('google_maps_url', NEW.google_maps_url);
        END IF;

        IF NEW.hero_imagen_url IS DISTINCT FROM OLD.hero_imagen_url THEN
          v_antes := v_antes || jsonb_build_object('hero_imagen_url', OLD.hero_imagen_url);
          v_despues := v_despues || jsonb_build_object('hero_imagen_url', NEW.hero_imagen_url);
        END IF;

        IF NEW.hero_titulo_custom IS DISTINCT FROM OLD.hero_titulo_custom THEN
          v_antes := v_antes || jsonb_build_object('hero_titulo_custom', OLD.hero_titulo_custom);
          v_despues := v_despues || jsonb_build_object('hero_titulo_custom', NEW.hero_titulo_custom);
        END IF;

        IF NEW.hero_subtitulo_custom IS DISTINCT FROM OLD.hero_subtitulo_custom THEN
          v_antes := v_antes || jsonb_build_object('hero_subtitulo_custom', OLD.hero_subtitulo_custom);
          v_despues := v_despues || jsonb_build_object('hero_subtitulo_custom', NEW.hero_subtitulo_custom);
        END IF;

        IF NEW.hero_foco IS DISTINCT FROM OLD.hero_foco THEN
          v_antes := v_antes || jsonb_build_object('hero_foco', OLD.hero_foco);
          v_despues := v_despues || jsonb_build_object('hero_foco', NEW.hero_foco);
        END IF;

        IF NEW.hero_overlay IS DISTINCT FROM OLD.hero_overlay THEN
          v_antes := v_antes || jsonb_build_object('hero_overlay', OLD.hero_overlay);
          v_despues := v_despues || jsonb_build_object('hero_overlay', NEW.hero_overlay);
        END IF;

        IF NEW.color_primario IS DISTINCT FROM OLD.color_primario THEN
          v_antes := v_antes || jsonb_build_object('color_primario', OLD.color_primario);
          v_despues := v_despues || jsonb_build_object('color_primario', NEW.color_primario);
        END IF;

        IF NEW.color_secundario IS DISTINCT FROM OLD.color_secundario THEN
          v_antes := v_antes || jsonb_build_object('color_secundario', OLD.color_secundario);
          v_despues := v_despues || jsonb_build_object('color_secundario', NEW.color_secundario);
        END IF;

        IF NEW.activo IS DISTINCT FROM OLD.activo THEN
          v_antes := v_antes || jsonb_build_object('activo', OLD.activo);
          v_despues := v_despues || jsonb_build_object('activo', NEW.activo);
        END IF;

        IF v_antes = '{}'::jsonb AND v_despues = '{}'::jsonb THEN
          RETURN NEW;
        END IF;

        IF NEW.activo IS DISTINCT FROM OLD.activo THEN
          v_accion := CASE WHEN NEW.activo THEN 'ACTIVAR_NEGOCIO' ELSE 'SUSPENDER_NEGOCIO' END;
        ELSE
          v_accion := 'EDITAR_NEGOCIO';
        END IF;

        INSERT INTO public.logs_auditoria (
          actor_id, actor_email, accion, entidad, entidad_id, detalles
        )
        VALUES (
          auth.uid(),
          auth.jwt() ->> 'email',
          v_accion,
          'negocios',
          NEW.id::text,
          jsonb_build_object(
            'nombre', NEW.nombre,
            'slug', NEW.slug,
            'antes', v_antes,
            'despues', v_despues
          )
        );

        RETURN NEW;
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- =============================================================================
-- 4. BUCKET storage.buckets ('negocios-media') Y POLÍTICAS RLS EN storage.objects
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'negocios-media',
  'negocios-media',
  true,
  5242880, -- 5 MB exactos (5 * 1024 * 1024 bytes)
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "negocios_media_public_select" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_superadmin_all" ON storage.objects;

-- 4.1. Lectura pública de portadas en negocios-media
CREATE POLICY "negocios_media_public_select"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'negocios-media'
  );

-- 4.2. Dueño autenticado: solo puede subir en <su_negocio_id>/portada-<timestamp>.<ext>
CREATE POLICY "negocios_media_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'negocios-media'
    AND position('..' in name) = 0
    AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/portada-[0-9]+\.(webp|jpg|jpeg|png)$'
    AND EXISTS (
      SELECT 1
      FROM public.negocios n
      WHERE n.id::text = (storage.foldername(name))[1]
        AND n.owner_id = auth.uid()
        AND n.activo = true
    )
  );

-- 4.3. Dueño autenticado: solo puede actualizar archivos dentro de la carpeta de su negocio activo
CREATE POLICY "negocios_media_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'negocios-media'
    AND position('..' in name) = 0
    AND EXISTS (
      SELECT 1
      FROM public.negocios n
      WHERE n.id::text = (storage.foldername(name))[1]
        AND n.owner_id = auth.uid()
        AND n.activo = true
    )
  )
  WITH CHECK (
    bucket_id = 'negocios-media'
    AND position('..' in name) = 0
    AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/portada-[0-9]+\.(webp|jpg|jpeg|png)$'
    AND EXISTS (
      SELECT 1
      FROM public.negocios n
      WHERE n.id::text = (storage.foldername(name))[1]
        AND n.owner_id = auth.uid()
        AND n.activo = true
    )
  );

-- 4.4. Dueño autenticado: solo puede borrar archivos dentro de la carpeta de su negocio activo
CREATE POLICY "negocios_media_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'negocios-media'
    AND position('..' in name) = 0
    AND EXISTS (
      SELECT 1
      FROM public.negocios n
      WHERE n.id::text = (storage.foldername(name))[1]
        AND n.owner_id = auth.uid()
        AND n.activo = true
    )
  );

-- 4.5. Súper Admin: control total en negocios-media
CREATE POLICY "negocios_media_superadmin_all"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'negocios-media'
    AND public.es_superadmin()
  )
  WITH CHECK (
    bucket_id = 'negocios-media'
    AND public.es_superadmin()
  );

COMMIT;
