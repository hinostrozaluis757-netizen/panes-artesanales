-- ARCHIVO: sql/12_expansion_giros_visuales_ROLLBACK.sql
-- Este rollback borra los valores guardados de hero_foco, hero_overlay y hero_subtitulo_custom.
-- =============================================================================
-- ROLLBACK DE PASO 5: PORTADA EDITABLE, COLUMNAS VISUALES Y STORAGE SEGURO
-- =============================================================================
-- Orden estricto de reversión:
--   (a) Restaurar public.fn_auditoria_update_negocios() a la definición original de producción.
--   (b) Restaurar public.proteger_columnas_negocios() al estado de sql/10.
--   (c) Borrar políticas de Storage sobre storage.objects ('negocios-media').
--   (d) Borrar constraints de diseño (incluidas las 4 nuevas).
--   (e) Borrar las columnas nuevas (hero_subtitulo_custom, hero_foco, hero_overlay).
-- =============================================================================

BEGIN;

-- (a) Restaurar public.fn_auditoria_update_negocios() a su versión original de producción
CREATE OR REPLACE FUNCTION public.fn_auditoria_update_negocios()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  INSERT INTO public.logs_auditoria (actor_id, actor_email, accion, entidad, entidad_id, detalles)
  VALUES (auth.uid(), auth.jwt() ->> 'email', v_accion, 'negocios', NEW.id::text,
    jsonb_build_object('nombre', NEW.nombre, 'slug', NEW.slug, 'antes', v_antes, 'despues', v_despues));
  RETURN NEW;
END;
$function$;

-- (b) Restaurar función public.proteger_columnas_negocios() al estado de sql/10
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

-- (c) Borrar políticas de Storage del bucket 'negocios-media'
DROP POLICY IF EXISTS "negocios_media_public_select" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "negocios_media_superadmin_all" ON storage.objects;

-- (d) Borrar constraints (incluidas las 4 nuevas) en public.negocios
ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_color_primario_chk;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_color_secundario_chk;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_hero_titulo_custom_chk;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_hero_imagen_url_chk;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_hero_subtitulo_custom_chk;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_hero_foco_chk;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_hero_overlay_chk;

-- (e) Borrar las columnas nuevas de public.negocios
ALTER TABLE public.negocios
  DROP COLUMN IF EXISTS hero_subtitulo_custom;

ALTER TABLE public.negocios
  DROP COLUMN IF EXISTS hero_foco;

ALTER TABLE public.negocios
  DROP COLUMN IF EXISTS hero_overlay;

COMMIT;
