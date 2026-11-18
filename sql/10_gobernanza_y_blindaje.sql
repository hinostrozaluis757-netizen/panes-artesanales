-- ARCHIVO: sql/10_gobernanza_y_blindaje.sql
-- =============================================================================
-- GOBERNANZA EMPRESARIAL Y BLINDAJE ZERO-TRUST (FASE 1)
-- =============================================================================
-- Este script reemplaza al 09. NO ejecutar el 09. NO ejecutar después sql/04, 06 ni 08.
--
-- INSTRUCCIONES OPERATIVAS:
-- 1. Se ejecuta manualmente en el SQL Editor de Supabase.
-- 2. Realizar respaldo completo desde el dashboard de Supabase ANTES de ejecutar.
-- 3. Este script es idempotente, transaccional y compatible si algún objeto del
--    sql/09 ya existiera previamente (no borra tablas con datos).
--
-- RECUPERACIÓN DE EMERGENCIA (si algún día pierdes acceso al Súper Admin):
-- Ejecuta esto desde el SQL Editor de Supabase (como rol postgres):
--   INSERT INTO public.superadmins (user_id, rol, activo)
--   SELECT id, 'master', true
--   FROM auth.users
--   WHERE lower(email) = 'hinostrozaluis757@gmail.com'
--   ON CONFLICT (user_id) DO UPDATE SET activo = true, rol = 'master';
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1.1. TABLA public.superadmins Y FUNCIÓN public.es_superadmin()
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.superadmins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL DEFAULT 'master',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Poblar Súper Admin maestro abortando toda la transacción si no existe en auth.users
DO $$
DECLARE
  v_superadmin_uid uuid;
BEGIN
  SELECT id
  INTO v_superadmin_uid
  FROM auth.users
  WHERE lower(email) = 'hinostrozaluis757@gmail.com'
  LIMIT 1;

  IF v_superadmin_uid IS NULL THEN
    RAISE EXCEPTION 'No se encontró en auth.users el usuario maestro hinostrozaluis757@gmail.com. Se aborta la transacción para no dejar bloqueado el panel.';
  END IF;

  INSERT INTO public.superadmins (user_id, rol, activo)
  VALUES (v_superadmin_uid, 'master', true)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

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

DROP POLICY IF EXISTS "superadmin_select_self" ON public.superadmins;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.superadmins FROM anon, authenticated;
GRANT SELECT ON TABLE public.superadmins TO authenticated;

CREATE POLICY "superadmin_select_self"
  ON public.superadmins
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND activo = true
  );

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


-- =============================================================================
-- 1.2. CASCADAS DE BORRADO EN CLAVES FORÁNEAS DE LA CADENA MULTI-TENANT
-- =============================================================================
DO $$
DECLARE
  r_target record;
  v_conname text;
  v_deltype "char";
  v_deltype_despues "char";
BEGIN
  FOR r_target IN
    SELECT *
    FROM (
      VALUES
        ('productos', 'negocio_id', 'negocios', 'id'),
        ('pedidos', 'negocio_id', 'negocios', 'id'),
        ('lotes', 'negocio_id', 'negocios', 'id'),
        ('pedido_items', 'pedido_id', 'pedidos', 'id'),
        ('lotes', 'producto_id', 'productos', 'id')
    ) AS t(tbl, col, ref_tbl, ref_col)
  LOOP
    IF to_regclass(format('public.%I', r_target.tbl)) IS NULL
       OR to_regclass(format('public.%I', r_target.ref_tbl)) IS NULL THEN
      RAISE NOTICE 'Tabla ausente para FK %.% -> %.%, se omite.',
        r_target.tbl, r_target.col, r_target.ref_tbl, r_target.ref_col;
      CONTINUE;
    END IF;

    SELECT c.conname, c.confdeltype
    INTO v_conname, v_deltype
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN pg_attribute att ON att.attrelid = cl.oid AND att.attnum = c.conkey[1]
    WHERE ns.nspname = 'public'
      AND cl.relname = r_target.tbl
      AND c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND att.attname = r_target.col
      AND c.confrelid = to_regclass(format('public.%I', r_target.ref_tbl))
    LIMIT 1;

    IF v_conname IS NULL THEN
      RAISE NOTICE 'FK no encontrada para %.% -> %.%; se omite.',
        r_target.tbl, r_target.col, r_target.ref_tbl, r_target.ref_col;
      CONTINUE;
    END IF;

    RAISE NOTICE 'FK % (%.% -> %.%) estado antes: confdeltype = %',
      v_conname, r_target.tbl, r_target.col, r_target.ref_tbl, r_target.ref_col, v_deltype;

    IF v_deltype <> 'c' THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r_target.tbl, v_conname);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE CASCADE',
        r_target.tbl, v_conname, r_target.col, r_target.ref_tbl, r_target.ref_col
      );
    END IF;

    SELECT c.confdeltype
    INTO v_deltype_despues
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE ns.nspname = 'public'
      AND cl.relname = r_target.tbl
      AND c.conname = v_conname
    LIMIT 1;

    RAISE NOTICE 'FK % (%.% -> %.%) estado después: confdeltype = %',
      v_conname, r_target.tbl, r_target.col, r_target.ref_tbl, r_target.ref_col, v_deltype_despues;
  END LOOP;
END $$;


-- =============================================================================
-- 1.3. BLINDAJE DE public.negocios (POLÍTICAS, TRIGGER Y CONSTRAINTS)
-- =============================================================================
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_negocios" ON public.negocios;
DROP POLICY IF EXISTS "owner_select_negocios" ON public.negocios;
DROP POLICY IF EXISTS "owner_update_negocios" ON public.negocios;
DROP POLICY IF EXISTS "owner_insert_negocios" ON public.negocios;
DROP POLICY IF EXISTS "owner_delete_negocios" ON public.negocios;
DROP POLICY IF EXISTS "anon_select_negocios_activos" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_select_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_update_all_negocios" ON public.negocios;
DROP POLICY IF EXISTS "superadmin_delete_all_negocios" ON public.negocios;

-- Tienda pública: solo lectura de negocios activos
CREATE POLICY "anon_select_negocios_activos"
  ON public.negocios
  FOR SELECT
  TO anon, authenticated
  USING (activo = true);

-- Dueño: puede leer su propio negocio aunque esté suspendido (para UX de bloqueo)
CREATE POLICY "owner_select_negocios"
  ON public.negocios
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Dueño: solo puede actualizar su negocio si está activo (sin INSERT ni DELETE)
CREATE POLICY "owner_update_negocios"
  ON public.negocios
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND activo = true)
  WITH CHECK (owner_id = auth.uid());

-- Súper Admin: consulta y actualización global por UUID (sin DELETE; borrado solo vía Edge Function)
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

-- Trigger BEFORE UPDATE para proteger columnas sensibles frente a peticiones authenticated
DROP TRIGGER IF EXISTS trg_proteger_negocios ON public.negocios;
DROP TRIGGER IF EXISTS trg_proteger_columnas_negocios ON public.negocios;
DROP FUNCTION IF EXISTS public.proteger_columnas_negocios();

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

CREATE TRIGGER trg_proteger_negocios
  BEFORE UPDATE
  ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_columnas_negocios();

-- Constraints NOT VALID sobre public.negocios (creadas solo si no existen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_slug_formato_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_slug_formato_chk
      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 40)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_color_primario_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_color_primario_chk
      CHECK (color_primario IS NULL OR color_primario ~ '^#[0-9a-fA-F]{6}$')
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_color_secundario_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_color_secundario_chk
      CHECK (color_secundario IS NULL OR color_secundario ~ '^#[0-9a-fA-F]{6}$')
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_logo_url_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_logo_url_chk
      CHECK (logo_url IS NULL OR (logo_url ~* '^https://' AND length(logo_url) <= 500))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_hero_imagen_url_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_hero_imagen_url_chk
      CHECK (hero_imagen_url IS NULL OR (hero_imagen_url ~* '^https://' AND length(hero_imagen_url) <= 500))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.negocios'::regclass
      AND conname = 'negocios_hero_titulo_custom_chk'
  ) THEN
    ALTER TABLE public.negocios
      ADD CONSTRAINT negocios_hero_titulo_custom_chk
      CHECK (hero_titulo_custom IS NULL OR length(hero_titulo_custom) <= 140)
      NOT VALID;
  END IF;
END $$;

-- Validación de slugs duplicados e índice único
DO $$
DECLARE
  v_duplicados text;
BEGIN
  SELECT string_agg(format('%s (%s)', slug, cnt), ', ')
  INTO v_duplicados
  FROM (
    SELECT slug, count(*) AS cnt
    FROM public.negocios
    GROUP BY slug
    HAVING count(*) > 1
  ) dup;

  IF v_duplicados IS NOT NULL THEN
    RAISE EXCEPTION 'Existen slugs duplicados en public.negocios: %', v_duplicados;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_negocios_slug_unique
  ON public.negocios (slug);


-- =============================================================================
-- 1.4. TABLA public.negocios_gobierno (DATOS COMERCIALES AISLADOS DE anon)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.negocios_gobierno (
  negocio_id uuid PRIMARY KEY REFERENCES public.negocios(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'basico' CHECK (plan IN ('basico', 'pro', 'enterprise')),
  fecha_vencimiento_plan date NULL,
  motivo_suspension text NULL CHECK (motivo_suspension IS NULL OR length(motivo_suspension) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negocios_gobierno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_select_negocios_gobierno" ON public.negocios_gobierno;
DROP POLICY IF EXISTS "superadmin_select_negocios_gobierno" ON public.negocios_gobierno;
DROP POLICY IF EXISTS "superadmin_insert_negocios_gobierno" ON public.negocios_gobierno;
DROP POLICY IF EXISTS "superadmin_update_negocios_gobierno" ON public.negocios_gobierno;
DROP POLICY IF EXISTS "superadmin_delete_negocios_gobierno" ON public.negocios_gobierno;

REVOKE ALL ON TABLE public.negocios_gobierno FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.negocios_gobierno TO authenticated;

CREATE POLICY "owner_select_negocios_gobierno"
  ON public.negocios_gobierno
  FOR SELECT
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "superadmin_select_negocios_gobierno"
  ON public.negocios_gobierno
  FOR SELECT
  TO authenticated
  USING (public.es_superadmin());

CREATE POLICY "superadmin_insert_negocios_gobierno"
  ON public.negocios_gobierno
  FOR INSERT
  TO authenticated
  WITH CHECK (public.es_superadmin());

CREATE POLICY "superadmin_update_negocios_gobierno"
  ON public.negocios_gobierno
  FOR UPDATE
  TO authenticated
  USING (public.es_superadmin())
  WITH CHECK (public.es_superadmin());

CREATE POLICY "superadmin_delete_negocios_gobierno"
  ON public.negocios_gobierno
  FOR DELETE
  TO authenticated
  USING (public.es_superadmin());

-- Poblar una fila por cada negocio existente (conservando datos si el 09 se hubiera ejecutado)
DO $$
DECLARE
  v_tiene_plan_en_negocios boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'negocios'
      AND column_name = 'plan'
  ) INTO v_tiene_plan_en_negocios;

  IF v_tiene_plan_en_negocios THEN
    EXECUTE $ins$
      INSERT INTO public.negocios_gobierno (negocio_id, plan, fecha_vencimiento_plan, motivo_suspension)
      SELECT
        id,
        CASE
          WHEN lower(coalesce(plan, '')) IN ('basico', 'pro', 'enterprise') THEN lower(plan)
          ELSE 'basico'
        END,
        fecha_vencimiento_plan,
        CASE
          WHEN motivo_suspension IS NOT NULL AND length(motivo_suspension) > 300 THEN left(motivo_suspension, 300)
          ELSE motivo_suspension
        END
      FROM public.negocios
      ON CONFLICT (negocio_id) DO NOTHING
    $ins$;
  ELSE
    INSERT INTO public.negocios_gobierno (negocio_id)
    SELECT id
    FROM public.negocios
    ON CONFLICT (negocio_id) DO NOTHING;
  END IF;
END $$;


-- =============================================================================
-- 1.5. SUSPENSIÓN EFECTIVA EN POLÍTICAS DE DUEÑOS (productos, pedidos, items, lotes)
-- =============================================================================
-- productos
DROP POLICY IF EXISTS "owner_manage_productos" ON public.productos;
CREATE POLICY "owner_manage_productos"
  ON public.productos
  FOR ALL
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

-- pedidos
DROP POLICY IF EXISTS "owner_manage_pedidos" ON public.pedidos;
CREATE POLICY "owner_manage_pedidos"
  ON public.pedidos
  FOR ALL
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

-- pedido_items
DROP POLICY IF EXISTS "owner_manage_pedido_items" ON public.pedido_items;
CREATE POLICY "owner_manage_pedido_items"
  ON public.pedido_items
  FOR ALL
  TO authenticated
  USING (
    pedido_id IN (
      SELECT p.id
      FROM public.pedidos p
      JOIN public.negocios n ON n.id = p.negocio_id
      WHERE n.owner_id = auth.uid()
        AND n.activo = true
    )
  )
  WITH CHECK (
    pedido_id IN (
      SELECT p.id
      FROM public.pedidos p
      JOIN public.negocios n ON n.id = p.negocio_id
      WHERE n.owner_id = auth.uid()
        AND n.activo = true
    )
  );

-- lotes
DROP POLICY IF EXISTS "owner_select_lotes" ON public.lotes;
CREATE POLICY "owner_select_lotes"
  ON public.lotes
  FOR SELECT
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "owner_insert_lotes" ON public.lotes;
CREATE POLICY "owner_insert_lotes"
  ON public.lotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid() AND activo = true
    )
  );

DROP POLICY IF EXISTS "owner_update_lotes" ON public.lotes;
CREATE POLICY "owner_update_lotes"
  ON public.lotes
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

DROP POLICY IF EXISTS "owner_delete_lotes" ON public.lotes;
CREATE POLICY "owner_delete_lotes"
  ON public.lotes
  FOR DELETE
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid() AND activo = true
    )
  );


-- =============================================================================
-- 1.6. PEDIDOS FALSOS: ENDURECIMIENTO DE registrar_pedido_seguro
-- =============================================================================
-- NOTA (Fase 0c): Se dejan COMENTADOS los DROP de anon_insert_pedidos y
-- anon_insert_pedido_items porque js/script.js (líneas 1292-1337) inserta
-- primero directo en pedidos/pedido_items y solo usa registrar_pedido_seguro
-- como fallback. Cuando migres js/script.js para llamar siempre a la RPC,
-- descomenta las dos líneas siguientes:
-- DROP POLICY IF EXISTS "anon_insert_pedidos" ON public.pedidos;
-- DROP POLICY IF EXISTS "anon_insert_pedido_items" ON public.pedido_items;

CREATE OR REPLACE FUNCTION public.registrar_pedido_seguro(
  p_negocio_id uuid,
  p_nombre text,
  p_telefono text,
  p_tipo_entrega text,
  p_direccion text,
  p_metodo_pago text,
  p_comprobante_url text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id uuid;
  v_numero_pedido bigint;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_prod record;
  v_qty integer;
  v_nombre text;
  v_telefono text;
  v_direccion text;
  v_metodo_pago text;
  v_comp text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.negocios WHERE id = p_negocio_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'La tienda seleccionada no existe o se encuentra inactiva.';
  END IF;

  v_nombre := trim(COALESCE(p_nombre, ''));
  IF v_nombre = '' OR length(v_nombre) > 100 THEN
    RAISE EXCEPTION 'El nombre del cliente es obligatorio (máx. 100 caracteres).';
  END IF;

  v_telefono := trim(COALESCE(p_telefono, ''));
  IF v_telefono = '' OR length(v_telefono) > 30 THEN
    RAISE EXCEPTION 'El teléfono del cliente es obligatorio (máx. 30 caracteres).';
  END IF;

  IF p_tipo_entrega IS NULL OR p_tipo_entrega NOT IN ('Delivery', 'Recojo en local', 'Consumo en local') THEN
    RAISE EXCEPTION 'Tipo de entrega no permitido.';
  END IF;

  v_direccion := NULLIF(trim(COALESCE(p_direccion, '')), '');
  IF v_direccion IS NOT NULL AND length(v_direccion) > 300 THEN
    RAISE EXCEPTION 'La dirección supera el máximo permitido (300 caracteres).';
  END IF;

  v_metodo_pago := trim(COALESCE(p_metodo_pago, ''));
  IF v_metodo_pago = '' OR length(v_metodo_pago) > 60 THEN
    RAISE EXCEPTION 'El método de pago es obligatorio (máx. 60 caracteres).';
  END IF;

  -- Validación de comprobante_url según js/script.js (ruta relativa pedidos/...) o URL Storage del proyecto
  v_comp := NULLIF(trim(COALESCE(p_comprobante_url, '')), '');
  IF v_comp IS NOT NULL THEN
    IF position('..' in v_comp) > 0 OR v_comp LIKE '%..%' THEN
      RAISE EXCEPTION 'Comprobante inválido: ruta no permitida.';
    END IF;

    IF NOT (
      (v_comp ~ '^pedidos/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$')
      OR (
        v_comp LIKE 'https://cqoqabnuzjxozxmcvjnl.supabase.co/storage/v1/%'
        AND v_comp !~ '\s'
        AND length(v_comp) <= 500
      )
    ) THEN
      RAISE EXCEPTION 'Comprobante inválido: debe ser una ruta de Storage válida o URL HTTPS del proyecto.';
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'El pedido debe contener una lista válida de productos.';
  END IF;

  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'El pedido debe contener entre 1 y 50 ítems.';
  END IF;

  INSERT INTO public.pedidos (
    negocio_id, cliente_nombre, cliente_telefono, tipo_entrega,
    direccion, metodo_pago, total, estado, comprobante_url
  )
  VALUES (
    p_negocio_id, v_nombre, v_telefono, p_tipo_entrega,
    v_direccion, v_metodo_pago, 0, 'pendiente', v_comp
  )
  RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item ->> 'cantidad')::integer, 0);
    IF v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'La cantidad por producto debe estar entre 1 y 100.';
    END IF;

    SELECT id, nombre, precio
    INTO v_prod
    FROM public.productos
    WHERE id = (v_item ->> 'producto_id')::uuid
      AND negocio_id = p_negocio_id
      AND activo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto inválido o no perteneciente a esta tienda.';
    END IF;

    INSERT INTO public.pedido_items (
      pedido_id, producto_id, producto_nombre, precio_unitario, cantidad, subtotal
    )
    VALUES (
      v_pedido_id, v_prod.id::text, v_prod.nombre, v_prod.precio, v_qty, v_prod.precio * v_qty
    );

    v_total := v_total + (v_prod.precio * v_qty);
  END LOOP;

  UPDATE public.pedidos SET total = v_total WHERE id = v_pedido_id;

  RETURN jsonb_build_object('id', v_pedido_id, 'numero_pedido', v_numero_pedido);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pedido_seguro(uuid, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_pedido_seguro(uuid, text, text, text, text, text, text, jsonb) TO anon, authenticated;

-- Consulta sugerida para comparar con la definición desplegada en producción:
-- SELECT pg_get_functiondef('public.registrar_pedido_seguro(uuid,text,text,text,text,text,text,jsonb)'::regprocedure);


-- =============================================================================
-- 1.7. BITÁCORA INMUTABLE public.logs_auditoria Y TRIGGERS DE AUDITORÍA
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL,
  actor_email text,
  accion text NOT NULL,
  entidad text NOT NULL DEFAULT 'negocios',
  entidad_id text,
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Compatibilidad si sql/09 existiera con actor_id NOT NULL
ALTER TABLE public.logs_auditoria
  ALTER COLUMN actor_id DROP NOT NULL;

ALTER TABLE public.logs_auditoria
  ALTER COLUMN actor_id DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created_at
  ON public.logs_auditoria (created_at DESC);

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

DROP POLICY IF EXISTS "superadmin_select_logs_auditoria" ON public.logs_auditoria;
DROP POLICY IF EXISTS "superadmin_insert_logs_auditoria" ON public.logs_auditoria;

-- El navegador nunca inserta logs directamente: solo lectura para Súper Admin
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.logs_auditoria FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.logs_auditoria TO authenticated;

CREATE POLICY "superadmin_select_logs_auditoria"
  ON public.logs_auditoria
  FOR SELECT
  TO authenticated
  USING (public.es_superadmin());

-- Inmutabilidad frente a la API y al cliente (no impide que un administrador de la BD altere triggers)
DROP TRIGGER IF EXISTS trg_inmutabilidad_logs_auditoria_row ON public.logs_auditoria;
DROP TRIGGER IF EXISTS trg_inmutabilidad_logs_auditoria_stmt ON public.logs_auditoria;
DROP FUNCTION IF EXISTS public.fn_inmutabilidad_logs_auditoria();

CREATE OR REPLACE FUNCTION public.fn_inmutabilidad_logs_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'logs_auditoria es inmutable: operación % no permitida.', TG_OP;
END;
$$;

CREATE TRIGGER trg_inmutabilidad_logs_auditoria_row
  BEFORE UPDATE OR DELETE
  ON public.logs_auditoria
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inmutabilidad_logs_auditoria();

CREATE TRIGGER trg_inmutabilidad_logs_auditoria_stmt
  BEFORE TRUNCATE
  ON public.logs_auditoria
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.fn_inmutabilidad_logs_auditoria();

-- Trigger AFTER UPDATE en public.negocios (solo registra campos modificados)
DROP TRIGGER IF EXISTS trg_auditoria_update_negocios ON public.negocios;
DROP FUNCTION IF EXISTS public.fn_auditoria_update_negocios();

CREATE OR REPLACE FUNCTION public.fn_auditoria_update_negocios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER trg_auditoria_update_negocios
  AFTER UPDATE
  ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auditoria_update_negocios();

-- Trigger AFTER UPDATE en public.negocios_gobierno
DROP TRIGGER IF EXISTS trg_auditoria_update_negocios_gobierno ON public.negocios_gobierno;
DROP FUNCTION IF EXISTS public.fn_auditoria_update_negocios_gobierno();

CREATE OR REPLACE FUNCTION public.fn_auditoria_update_negocios_gobierno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes jsonb := '{}'::jsonb;
  v_despues jsonb := '{}'::jsonb;
  v_nombre text;
  v_slug text;
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    v_antes := v_antes || jsonb_build_object('plan', OLD.plan);
    v_despues := v_despues || jsonb_build_object('plan', NEW.plan);
  END IF;

  IF NEW.fecha_vencimiento_plan IS DISTINCT FROM OLD.fecha_vencimiento_plan THEN
    v_antes := v_antes || jsonb_build_object('fecha_vencimiento_plan', OLD.fecha_vencimiento_plan);
    v_despues := v_despues || jsonb_build_object('fecha_vencimiento_plan', NEW.fecha_vencimiento_plan);
  END IF;

  IF NEW.motivo_suspension IS DISTINCT FROM OLD.motivo_suspension THEN
    v_antes := v_antes || jsonb_build_object('motivo_suspension', OLD.motivo_suspension);
    v_despues := v_despues || jsonb_build_object('motivo_suspension', NEW.motivo_suspension);
  END IF;

  IF v_antes = '{}'::jsonb AND v_despues = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  SELECT nombre, slug
  INTO v_nombre, v_slug
  FROM public.negocios
  WHERE id = NEW.negocio_id;

  INSERT INTO public.logs_auditoria (
    actor_id, actor_email, accion, entidad, entidad_id, detalles
  )
  VALUES (
    auth.uid(),
    auth.jwt() ->> 'email',
    'EDITAR_PLAN',
    'negocios_gobierno',
    NEW.negocio_id::text,
    jsonb_build_object(
      'nombre', v_nombre,
      'slug', v_slug,
      'antes', v_antes,
      'despues', v_despues
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auditoria_update_negocios_gobierno
  AFTER UPDATE
  ON public.negocios_gobierno
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auditoria_update_negocios_gobierno();


-- =============================================================================
-- 1.8. VENCIMIENTO AUTOMÁTICO DE PLANES (SOLO FUNCIÓN; SIN PROGRAMAR)
-- =============================================================================
DROP FUNCTION IF EXISTS public.suspender_planes_vencidos();

CREATE OR REPLACE FUNCTION public.suspender_planes_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy_lima date := (now() AT TIME ZONE 'America/Lima')::date;
  v_afectados integer := 0;
BEGIN
  WITH vencidos AS (
    SELECT n.id
    FROM public.negocios n
    JOIN public.negocios_gobierno g ON g.negocio_id = n.id
    WHERE n.activo = true
      AND g.fecha_vencimiento_plan IS NOT NULL
      AND g.fecha_vencimiento_plan < v_hoy_lima
  ),
  upd_negocios AS (
    UPDATE public.negocios n
    SET activo = false
    FROM vencidos v
    WHERE n.id = v.id
    RETURNING n.id
  ),
  upd_gobierno AS (
    UPDATE public.negocios_gobierno g
    SET motivo_suspension = 'Plan vencido',
        updated_at = now()
    FROM upd_negocios u
    WHERE g.negocio_id = u.id
    RETURNING g.negocio_id
  )
  SELECT count(*) INTO v_afectados FROM upd_gobierno;

  RETURN v_afectados;
END;
$$;

REVOKE ALL ON FUNCTION public.suspender_planes_vencidos() FROM PUBLIC, anon, authenticated;

-- Para programarlo diariamente (00:05 UTC / 19:05 Lima o 05:05 UTC / 00:05 Lima),
-- habilita la extensión pg_cron en Supabase y ejecuta manualmente:
-- SELECT cron.schedule(
--   'suspender-planes-vencidos-diario',
--   '5 5 * * *',
--   $$SELECT public.suspender_planes_vencidos();$$
-- );

COMMIT;


-- =============================================================================
-- 1.9. CONSULTAS DE VERIFICACIÓN POST-EJECUCIÓN (COMENTADAS)
-- =============================================================================
-- 1) Verificar políticas en negocios, tablas nuevas y tablas protegidas:
-- SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('negocios', 'superadmins', 'negocios_gobierno', 'logs_auditoria', 'productos', 'pedidos', 'pedido_items', 'lotes')
-- ORDER BY tablename, policyname;
--
-- 2) Verificar rowsecurity habilitado en todas las tablas multi-tenant:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('negocios', 'superadmins', 'negocios_gobierno', 'logs_auditoria', 'productos', 'pedidos', 'pedido_items', 'lotes')
-- ORDER BY tablename;
--
-- 3) Verificar ON DELETE CASCADE (confdeltype = 'c') en claves foráneas:
-- SELECT cl.relname AS tabla, c.conname, c.confdeltype
-- FROM pg_constraint c
-- JOIN pg_class cl ON cl.oid = c.conrelid
-- JOIN pg_namespace ns ON ns.oid = cl.relnamespace
-- WHERE ns.nspname = 'public'
--   AND c.contype = 'f'
--   AND cl.relname IN ('productos', 'pedidos', 'lotes', 'pedido_items', 'negocios_gobierno', 'superadmins')
-- ORDER BY cl.relname, c.conname;
--
-- 4) Verificar que UPDATE y DELETE sobre logs_auditoria fallen por inmutabilidad:
-- UPDATE public.logs_auditoria SET accion = 'TEST' WHERE id = (SELECT id FROM public.logs_auditoria LIMIT 1);
-- DELETE FROM public.logs_auditoria WHERE id = (SELECT id FROM public.logs_auditoria LIMIT 1);
