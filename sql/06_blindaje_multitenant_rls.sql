-- ARCHIVO: sql/06_blindaje_multitenant_rls.sql
-- =============================================================================
-- AUDITORÍA Y BLINDAJE ZERO-TRUST RLS MULTI-TENANT
-- =============================================================================
-- Script idempotente para ejecutar en el SQL Editor de Supabase.
-- 1. Limpia CUALQUIER política RLS previa (incluyendo políticas permisivas heredadas
--    de shema.sql o creadas manualmente desde el dashboard) en negocios, productos,
--    pedidos, pedido_items y lotes.
-- 2. Restaura políticas estrictas por owner_id = auth.uid() para paneles admin,
--    conservando lectura pública limitada de catálogos activos (index.html) y el
--    acceso del Súper Admin (hinostrozaluis757@gmail.com) sobre negocios.
-- 3. Asegura que vistas heredadas respeten security_invoker = true y que
--    registrar_pedido_seguro exista si aún no fue creada para checkout anónimo.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. LIMPIEZA TOTAL DE POLÍTICAS PREVIAS EN TABLAS MULTI-TENANT
-- =============================================================================
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_tabla text;
  r_pol record;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY['negocios', 'productos', 'pedidos', 'pedido_items', 'lotes']
  LOOP
    FOR r_pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_tabla
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r_pol.policyname, v_tabla);
    END LOOP;
  END LOOP;
END $$;


-- =============================================================================
-- 2. POLÍTICAS ZERO-TRUST POR TABLA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1. negocios
-- -----------------------------------------------------------------------------
-- Tienda pública (index.html): solo lectura de negocios activos
CREATE POLICY "anon_select_negocios_activos"
  ON public.negocios
  FOR SELECT
  TO anon, authenticated
  USING (activo = true);

-- Dueño autenticado: control exclusivo sobre sus propios negocios
CREATE POLICY "owner_manage_negocios"
  ON public.negocios
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Súper Admin: consulta y activación/suspensión global
CREATE POLICY "superadmin_select_all_negocios"
  ON public.negocios
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'hinostrozaluis757@gmail.com');

CREATE POLICY "superadmin_update_all_negocios"
  ON public.negocios
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'hinostrozaluis757@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'hinostrozaluis757@gmail.com');


-- -----------------------------------------------------------------------------
-- 2.2. productos
-- -----------------------------------------------------------------------------
-- Tienda pública (index.html): solo lectura de productos activos de negocios activos
CREATE POLICY "anon_select_productos_activos"
  ON public.productos
  FOR SELECT
  TO anon, authenticated
  USING (
    activo = true
    AND negocio_id IN (SELECT id FROM public.negocios WHERE activo = true)
  );

-- Dueño autenticado: CRUD aislado por negocio_id propio
CREATE POLICY "owner_manage_productos"
  ON public.productos
  FOR ALL
  TO authenticated
  USING (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  );


-- -----------------------------------------------------------------------------
-- 2.3. pedidos (SIN lectura pública ni entre inquilinos)
-- -----------------------------------------------------------------------------
CREATE POLICY "anon_insert_pedidos"
  ON public.pedidos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    negocio_id IN (SELECT id FROM public.negocios WHERE activo = true)
  );

CREATE POLICY "owner_manage_pedidos"
  ON public.pedidos
  FOR ALL
  TO authenticated
  USING (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  );


-- -----------------------------------------------------------------------------
-- 2.4. pedido_items (SIN lectura pública ni entre inquilinos)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pedido_es_de_negocio_activo(p_pedido_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pedidos p
    JOIN public.negocios n ON n.id = p.negocio_id
    WHERE p.id = p_pedido_id
      AND n.activo = true
  );
$$;

REVOKE ALL ON FUNCTION public.fn_pedido_es_de_negocio_activo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_pedido_es_de_negocio_activo(uuid) TO anon, authenticated;

CREATE POLICY "anon_insert_pedido_items"
  ON public.pedido_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.fn_pedido_es_de_negocio_activo(pedido_id));

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
    )
  )
  WITH CHECK (
    pedido_id IN (
      SELECT p.id
      FROM public.pedidos p
      JOIN public.negocios n ON n.id = p.negocio_id
      WHERE n.owner_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 2.5. lotes (Estrictamente privado del dueño del negocio)
-- -----------------------------------------------------------------------------
CREATE POLICY "owner_select_lotes"
  ON public.lotes
  FOR SELECT
  TO authenticated
  USING (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_insert_lotes"
  ON public.lotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_update_lotes"
  ON public.lotes
  FOR UPDATE
  TO authenticated
  USING (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_delete_lotes"
  ON public.lotes
  FOR DELETE
  TO authenticated
  USING (
    negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
  );


-- =============================================================================
-- 3. ENDURECER VISTAS LEGADAS Y GARANTIZAR RPC DE CHECKOUT PÚBLICO
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_ventas_diarias'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_ventas_diarias SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_top_productos'
  ) THEN
    EXECUTE 'ALTER VIEW public.v_top_productos SET (security_invoker = true)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo aplicar security_invoker a vistas legadas: %', SQLERRM;
END $$;

-- Crear registrar_pedido_seguro solo si no existe previamente en la base de datos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'registrar_pedido_seguro'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.registrar_pedido_seguro(
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
      AS $body$
      DECLARE
        v_pedido_id uuid;
        v_numero_pedido bigint;
        v_total numeric(10,2) := 0;
        v_item jsonb;
        v_prod record;
        v_qty integer;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.negocios WHERE id = p_negocio_id AND activo = true
        ) THEN
          RAISE EXCEPTION 'La tienda seleccionada no existe o se encuentra inactiva.';
        END IF;

        IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
          RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
        END IF;

        INSERT INTO public.pedidos (
          negocio_id, cliente_nombre, cliente_telefono, tipo_entrega,
          direccion, metodo_pago, total, estado, comprobante_url
        )
        VALUES (
          p_negocio_id, trim(p_nombre), trim(p_telefono), p_tipo_entrega,
          NULLIF(trim(COALESCE(p_direccion, '')), ''), p_metodo_pago, 0, 'pendiente', p_comprobante_url
        )
        RETURNING id, numero_pedido INTO v_pedido_id, v_numero_pedido;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
          v_qty := COALESCE((v_item ->> 'cantidad')::integer, 0);
          IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida en el pedido.';
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
      $body$;
    $fn$;

    REVOKE ALL ON FUNCTION public.registrar_pedido_seguro(uuid, text, text, text, text, text, text, jsonb) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.registrar_pedido_seguro(uuid, text, text, text, text, text, text, jsonb) TO anon, authenticated;
  END IF;
END $$;

COMMIT;
