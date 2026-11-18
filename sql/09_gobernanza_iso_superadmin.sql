-- ARCHIVO: sql/09_gobernanza_iso_superadmin.sql
-- =============================================================================
-- GOBERNANZA ISO SÚPER ADMIN: ZERO-TRUST, AUDITORÍA INMUTABLE Y PLANES
-- =============================================================================
-- Script idempotente y transaccional para ejecutar en el SQL Editor de Supabase.
-- Estándares de referencia: ISO/IEC 27001 (control de acceso y mínimo privilegio),
-- ISO 9001 / ISO 19011 (bitácora inmutable de auditoría) e ISO/IEC 25010.
--
-- 1. Crea tabla public.superadmins y la puebla desde auth.users (cero correos
--    quemados en el frontend o Edge Functions).
-- 2. Crea función SECURITY DEFINER public.es_superadmin() y actualiza las
--    políticas superadmin_* de public.negocios para usarla.
-- 3. Crea tabla inmutable public.logs_auditoria (RLS solo SELECT e INSERT;
--    prohibido UPDATE y DELETE).
-- 4. Agrega columnas de gobernanza comercial a public.negocios:
--    plan, fecha_vencimiento_plan y motivo_suspension.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABLA: public.superadmins (ISO/IEC 27001)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.superadmins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL DEFAULT 'master',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Poblar automáticamente el Súper Admin maestro desde auth.users
INSERT INTO public.superadmins (user_id, rol, activo)
SELECT id, 'master', true
FROM auth.users
WHERE lower(email) = 'hinostrozaluis757@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- RLS estricta en public.superadmins: solo lectura del propio registro activo
ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r_pol record;
BEGIN
  FOR r_pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'superadmins'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.superadmins', r_pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.superadmins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.superadmins TO authenticated;

CREATE POLICY "superadmin_select_self"
  ON public.superadmins
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND activo = true
  );


-- =============================================================================
-- 2. FUNCIÓN AUXILIAR Y POLÍTICAS EN public.negocios
-- =============================================================================
CREATE OR REPLACE FUNCTION public.es_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.superadmins
    WHERE user_id = auth.uid()
      AND activo = true
  );
$$;

REVOKE ALL ON FUNCTION public.es_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_superadmin() TO authenticated;

ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_select_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_update_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_delete_all_negocios" ON public.negocios;

CREATE POLICY "superadmin_select_all_negocios"
  ON public.negocios
  FOR SELECT
  TO authenticated
  USING (public.es_superadmin());

CREATE POLICY "superadmin_update_all_negocios"
  ON public.negocios
  FOR UPDATE
  TO authenticated
  USING (public.es_superadmin())
  WITH CHECK (public.es_superadmin());

CREATE POLICY "superadmin_delete_all_negocios"
  ON public.negocios
  FOR DELETE
  TO authenticated
  USING (public.es_superadmin());


-- =============================================================================
-- 3. BITÁCORA INMUTABLE: public.logs_auditoria (ISO 9001 / ISO 19011)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  actor_email text,
  accion text NOT NULL,
  entidad text NOT NULL DEFAULT 'negocios',
  entidad_id text,
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created_at
  ON public.logs_auditoria (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_accion
  ON public.logs_auditoria (accion);

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r_pol record;
BEGIN
  FOR r_pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'logs_auditoria'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.logs_auditoria', r_pol.policyname);
  END LOOP;
END $$;

-- Inmutabilidad estricta: sin privilegios ni políticas UPDATE o DELETE
REVOKE ALL ON TABLE public.logs_auditoria FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.logs_auditoria TO authenticated;

CREATE POLICY "superadmin_select_logs_auditoria"
  ON public.logs_auditoria
  FOR SELECT
  TO authenticated
  USING (public.es_superadmin());

CREATE POLICY "superadmin_insert_logs_auditoria"
  ON public.logs_auditoria
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.es_superadmin()
    AND actor_id = auth.uid()
  );


-- =============================================================================
-- 4. GOBERNANZA COMERCIAL EN public.negocios
-- =============================================================================
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basico';

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_plan date NULL;

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS motivo_suspension text NULL;

-- Normalizar valores heredados antes de aplicar la restricción CHECK
UPDATE public.negocios
SET plan = lower(btrim(plan))
WHERE plan IS NOT NULL;

UPDATE public.negocios
SET plan = 'basico'
WHERE plan IS NULL
   OR plan NOT IN ('basico', 'pro', 'enterprise');

DO $$
DECLARE
  r_con record;
BEGIN
  FOR r_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ '\mplan\M'
  LOOP
    EXECUTE format('ALTER TABLE public.negocios DROP CONSTRAINT IF EXISTS %I', r_con.conname);
  END LOOP;
END $$;

ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_plan_check;

ALTER TABLE public.negocios
  ADD CONSTRAINT negocios_plan_check
  CHECK (plan IN ('basico', 'pro', 'enterprise'));

CREATE INDEX IF NOT EXISTS idx_negocios_plan_vencimiento
  ON public.negocios (plan, fecha_vencimiento_plan);

COMMENT ON COLUMN public.negocios.plan IS
  'Plan comercial contratado por el inquilino: basico, pro o enterprise.';

COMMENT ON COLUMN public.negocios.fecha_vencimiento_plan IS
  'Fecha límite de vigencia de la suscripción del negocio (NULL = sin vencimiento).';

COMMENT ON COLUMN public.negocios.motivo_suspension IS
  'Motivo administrativo documentado cuando el negocio es suspendido.';

COMMIT;
