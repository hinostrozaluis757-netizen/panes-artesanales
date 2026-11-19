-- ARCHIVO: sql/11_metodos_pago_negocios.sql
-- =============================================================================
-- MÉTODOS DE PAGO DINÁMICOS POR NEGOCIO (MULTI-TENANT)
-- =============================================================================
-- INSTRUCCIONES OPERATIVAS:
-- 1. Este script se ejecuta a mano en el SQL Editor de Supabase.
-- 2. Hacer respaldo completo desde el dashboard de Supabase ANTES de ejecutar.
-- 3. Es idempotente y transaccional.
-- 4. Decision de diseño: los datos de pago viven en public.negocios_pagos
--    (NO en public.negocios) para no exponerlos en consultas anónimas masivas.
--    La tienda pública lee solo los de UN negocio activo vía RPC.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABLA public.negocios_pagos Y CONSTRAINTS DE FORMATO
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.negocios_pagos (
  negocio_id uuid PRIMARY KEY REFERENCES public.negocios(id) ON DELETE CASCADE,
  pago_yape_numero text NULL,
  pago_yape_qr_url text NULL,
  pago_plin_numero text NULL,
  pago_banco_bcp_cuenta text NULL,
  pago_banco_bcp_cci text NULL,
  pago_banco_bbva_cuenta text NULL,
  pago_banco_bbva_cci text NULL,
  pago_titular_nombre text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_yape_fmt CHECK (pago_yape_numero IS NULL OR pago_yape_numero ~ '^9[0-9]{8}$'),
  CONSTRAINT pagos_plin_fmt CHECK (pago_plin_numero IS NULL OR pago_plin_numero ~ '^9[0-9]{8}$'),
  CONSTRAINT pagos_qr_fmt CHECK (pago_yape_qr_url IS NULL OR (pago_yape_qr_url ~* '^https://[^[:space:]]+$' AND length(pago_yape_qr_url) <= 500)),
  CONSTRAINT pagos_bcp_cta_fmt CHECK (pago_banco_bcp_cuenta IS NULL OR pago_banco_bcp_cuenta ~ '^[0-9-]{8,20}$'),
  CONSTRAINT pagos_bcp_cci_fmt CHECK (pago_banco_bcp_cci IS NULL OR pago_banco_bcp_cci ~ '^[0-9]{20}$'),
  CONSTRAINT pagos_bbva_cta_fmt CHECK (pago_banco_bbva_cuenta IS NULL OR pago_banco_bbva_cuenta ~ '^[0-9-]{8,20}$'),
  CONSTRAINT pagos_bbva_cci_fmt CHECK (pago_banco_bbva_cci IS NULL OR pago_banco_bbva_cci ~ '^[0-9]{20}$'),
  CONSTRAINT pagos_titular_len CHECK (pago_titular_nombre IS NULL OR length(pago_titular_nombre) BETWEEN 2 AND 100)
);

-- =============================================================================
-- 2. TRIGGER BEFORE UPDATE PARA ACTUALIZAR updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS trg_negocios_pagos_updated_at ON public.negocios_pagos;
DROP FUNCTION IF EXISTS public.fn_negocios_pagos_updated_at();

CREATE OR REPLACE FUNCTION public.fn_negocios_pagos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_negocios_pagos_updated_at
  BEFORE UPDATE
  ON public.negocios_pagos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_negocios_pagos_updated_at();

-- =============================================================================
-- 3. RLS ZERO-TRUST Y PERMISOS SOBRE public.negocios_pagos
-- =============================================================================
ALTER TABLE public.negocios_pagos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.negocios_pagos FROM PUBLIC, anon, authenticated;
-- Sin DELETE para clientes: la limpieza ocurre por ON DELETE CASCADE al borrar el negocio
GRANT SELECT, INSERT, UPDATE ON TABLE public.negocios_pagos TO authenticated;

DROP POLICY IF EXISTS "owner_select_pagos" ON public.negocios_pagos;
DROP POLICY IF EXISTS "owner_insert_pagos" ON public.negocios_pagos;
DROP POLICY IF EXISTS "owner_update_pagos" ON public.negocios_pagos;
DROP POLICY IF EXISTS "superadmin_select_pagos" ON public.negocios_pagos;

CREATE POLICY "owner_select_pagos"
  ON public.negocios_pagos
  FOR SELECT
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_insert_pagos"
  ON public.negocios_pagos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "owner_update_pagos"
  ON public.negocios_pagos
  FOR UPDATE
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid() AND activo = true
    )
  )
  WITH CHECK (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid() AND activo = true
    )
  );

-- Política opcional de solo lectura para Súper Admin si public.es_superadmin() existe (sql/10)
DO $$
BEGIN
  IF to_regprocedure('public.es_superadmin()') IS NOT NULL THEN
    EXECUTE $pol$
      CREATE POLICY "superadmin_select_pagos"
        ON public.negocios_pagos
        FOR SELECT
        TO authenticated
        USING (public.es_superadmin())
    $pol$;
  ELSE
    -- Omitida superadmin_select_pagos: public.es_superadmin() no existe aún (ejecutar sql/10 primero si aplica).
    RAISE NOTICE 'public.es_superadmin() no existe; se omite política superadmin_select_pagos.';
  END IF;
END $$;

-- =============================================================================
-- 4. RPC PÚBLICA DE LECTURA PARA UN SOLO NEGOCIO ACTIVO
-- =============================================================================
CREATE OR REPLACE FUNCTION public.obtener_metodos_pago(p_negocio_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'negocio', n.nombre,
    'titular', p.pago_titular_nombre,
    'yape_numero', p.pago_yape_numero,
    'yape_qr_url', p.pago_yape_qr_url,
    'plin_numero', p.pago_plin_numero,
    'bcp_cuenta', p.pago_banco_bcp_cuenta,
    'bcp_cci', p.pago_banco_bcp_cci,
    'bbva_cuenta', p.pago_banco_bbva_cuenta,
    'bbva_cci', p.pago_banco_bbva_cci
  ))
  FROM public.negocios n
  LEFT JOIN public.negocios_pagos p ON p.negocio_id = n.id
  WHERE n.id = p_negocio_id
    AND n.activo = true;
$$;

REVOKE ALL ON FUNCTION public.obtener_metodos_pago(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_metodos_pago(uuid) TO anon, authenticated;

-- =============================================================================
-- 5. AUDITORÍA CONDICIONAL EN public.logs_auditoria (SOLO NOMBRES DE CAMPOS)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_auditoria_negocios_pagos ON public.negocios_pagos;
DROP FUNCTION IF EXISTS public.fn_auditoria_negocios_pagos();

DO $$
BEGIN
  IF to_regclass('public.logs_auditoria') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.fn_auditoria_negocios_pagos()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_campos text[] := ARRAY[]::text[];
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW.pago_yape_numero IS NOT NULL THEN v_campos := array_append(v_campos, 'pago_yape_numero'); END IF;
          IF NEW.pago_yape_qr_url IS NOT NULL THEN v_campos := array_append(v_campos, 'pago_yape_qr_url'); END IF;
          IF NEW.pago_plin_numero IS NOT NULL THEN v_campos := array_append(v_campos, 'pago_plin_numero'); END IF;
          IF NEW.pago_banco_bcp_cuenta IS NOT NULL THEN v_campos := array_append(v_campos, 'pago_banco_bcp_cuenta'); END IF;
          IF NEW.pago_banco_bcp_cci IS NOT NULL THEN v_campos := array_append(v_campos, 'pago_banco_bcp_cci'); END IF;
          IF NEW.pago_banco_bbva_cuenta IS NOT NULL THEN v_campos := array_append(v_campos, 'pago_banco_bbva_cuenta'); END IF;
          IF NEW.pago_banco_bbva_cci IS NOT NULL THEN v_campos := array_append(v_campos, 'pago_banco_bbva_cci'); END IF;
          IF NEW.pago_titular_nombre IS NOT NULL THEN v_campos := array_append(v_campos, 'pago_titular_nombre'); END IF;
        ELSE
          IF NEW.pago_yape_numero IS DISTINCT FROM OLD.pago_yape_numero THEN v_campos := array_append(v_campos, 'pago_yape_numero'); END IF;
          IF NEW.pago_yape_qr_url IS DISTINCT FROM OLD.pago_yape_qr_url THEN v_campos := array_append(v_campos, 'pago_yape_qr_url'); END IF;
          IF NEW.pago_plin_numero IS DISTINCT FROM OLD.pago_plin_numero THEN v_campos := array_append(v_campos, 'pago_plin_numero'); END IF;
          IF NEW.pago_banco_bcp_cuenta IS DISTINCT FROM OLD.pago_banco_bcp_cuenta THEN v_campos := array_append(v_campos, 'pago_banco_bcp_cuenta'); END IF;
          IF NEW.pago_banco_bcp_cci IS DISTINCT FROM OLD.pago_banco_bcp_cci THEN v_campos := array_append(v_campos, 'pago_banco_bcp_cci'); END IF;
          IF NEW.pago_banco_bbva_cuenta IS DISTINCT FROM OLD.pago_banco_bbva_cuenta THEN v_campos := array_append(v_campos, 'pago_banco_bbva_cuenta'); END IF;
          IF NEW.pago_banco_bbva_cci IS DISTINCT FROM OLD.pago_banco_bbva_cci THEN v_campos := array_append(v_campos, 'pago_banco_bbva_cci'); END IF;
          IF NEW.pago_titular_nombre IS DISTINCT FROM OLD.pago_titular_nombre THEN v_campos := array_append(v_campos, 'pago_titular_nombre'); END IF;
        END IF;

        IF array_length(v_campos, 1) IS NULL THEN
          RETURN NEW;
        END IF;

        -- Registrar únicamente nombres de campos modificados (nunca valores de cuentas/celulares)
        INSERT INTO public.logs_auditoria (
          actor_id, actor_email, accion, entidad, entidad_id, detalles
        )
        VALUES (
          auth.uid(),
          auth.jwt() ->> 'email',
          'EDITAR_PAGOS',
          'negocios_pagos',
          NEW.negocio_id::text,
          jsonb_build_object(
            'operacion', TG_OP,
            'campos_cambiados', to_jsonb(v_campos)
          )
        );

        RETURN NEW;
      END;
      $body$;
    $fn$;

    EXECUTE $trg$
      CREATE TRIGGER trg_auditoria_negocios_pagos
        AFTER INSERT OR UPDATE
        ON public.negocios_pagos
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_auditoria_negocios_pagos();
    $trg$;
  ELSE
    -- Omitida auditoría de pagos: public.logs_auditoria no existe aún (requiere sql/10).
    RAISE NOTICE 'public.logs_auditoria no existe; se omite trigger trg_auditoria_negocios_pagos.';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- 6. VERIFICACIONES POST-EJECUCIÓN Y PLANTILLA DE CARGA (COMENTADAS)
-- =============================================================================
-- select * from pg_policies where tablename = 'negocios_pagos';
-- select relrowsecurity from pg_class where oid = 'public.negocios_pagos'::regclass;
--
-- Plantilla de ejemplo para cargar los datos de Don Roberto SIN valores reales.
-- Mejor cárgalos desde la pestaña Métodos de Pago del admin:
--
-- INSERT INTO public.negocios_pagos (
--   negocio_id,
--   pago_titular_nombre,
--   pago_yape_numero,
--   pago_yape_qr_url,
--   pago_plin_numero,
--   pago_banco_bcp_cuenta,
--   pago_banco_bcp_cci,
--   pago_banco_bbva_cuenta,
--   pago_banco_bbva_cci
-- )
-- SELECT
--   id,
--   '<NOMBRE_TITULAR>',
--   '<CELULAR_YAPE>',
--   '<URL_QR_YAPE_HTTPS>',
--   '<CELULAR_PLIN>',
--   '<CUENTA_BCP>',
--   '<CCI_BCP_20_DIGITOS>',
--   '<CUENTA_BBVA>',
--   '<CCI_BBVA_20_DIGITOS>'
-- FROM public.negocios
-- WHERE slug = 'don-roberto'
-- ON CONFLICT (negocio_id) DO UPDATE SET
--   pago_titular_nombre = EXCLUDED.pago_titular_nombre,
--   pago_yape_numero = EXCLUDED.pago_yape_numero,
--   pago_yape_qr_url = EXCLUDED.pago_yape_qr_url,
--   pago_plin_numero = EXCLUDED.pago_plin_numero,
--   pago_banco_bcp_cuenta = EXCLUDED.pago_banco_bcp_cuenta,
--   pago_banco_bcp_cci = EXCLUDED.pago_banco_bcp_cci,
--   pago_banco_bbva_cuenta = EXCLUDED.pago_banco_bbva_cuenta,
--   pago_banco_bbva_cci = EXCLUDED.pago_banco_bbva_cci;
