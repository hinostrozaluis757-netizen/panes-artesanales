-- ARCHIVO: sql/03_modulo_lotes.sql
-- =============================================================================
-- MÓDULO ERP: CONTROL DE LOTES, COSTOS Y VENCIMIENTOS (FEFO / FIFO)
-- =============================================================================
-- Script idempotente para ejecutar en el SQL Editor de Supabase.
-- 1. Crea la tabla 'lotes' y su índice compuesto FEFO/FIFO.
-- 2. Migra el stock actual de 'productos' hacia 'lotes' (antes de activar trigger).
-- 3. Crea el trigger de sincronización automática hacia 'productos.stock'.
-- 4. Actualiza la RPC 'descontar_stock_pos' con algoritmo FEFO + FIFO multi-lote
--    y bloqueo transaccional FOR UPDATE (+ fallback si el producto no usa lotes).
-- 5. Habilita RLS en 'lotes' restringido al dueño del negocio (owner_id = auth.uid()).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABLA: lotes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  codigo_lote text,
  cantidad_inicial integer NOT NULL CHECK (cantidad_inicial > 0),
  cantidad_actual integer NOT NULL CHECK (cantidad_actual >= 0),
  costo_unitario numeric(10,2) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  precio_venta numeric(10,2) CHECK (precio_venta IS NULL OR precio_venta >= 0),
  fecha_vencimiento date NULL,
  fecha_ingreso timestamptz NOT NULL DEFAULT now()
);

-- Índice compuesto para acelerar descuento FEFO/FIFO y consultas por producto
CREATE INDEX IF NOT EXISTS idx_lotes_fefo
  ON public.lotes (negocio_id, producto_id, fecha_vencimiento ASC NULLS LAST, fecha_ingreso ASC);

-- Índice parcial para panel de alertas de vencimiento en el Dashboard
CREATE INDEX IF NOT EXISTS idx_lotes_alertas_vencimiento
  ON public.lotes (negocio_id, fecha_vencimiento)
  WHERE cantidad_actual > 0 AND fecha_vencimiento IS NOT NULL;


-- =============================================================================
-- 2. MIGRACIÓN AUTOMÁTICA DE STOCK EXISTENTE (ANTES DE ACTIVAR EL TRIGGER)
-- =============================================================================
-- En ejecuciones repetidas, desactivar temporalmente el trigger antes de migrar
DROP TRIGGER IF EXISTS trg_sincronizar_stock_producto ON public.lotes;

INSERT INTO public.lotes (
  negocio_id,
  producto_id,
  codigo_lote,
  cantidad_inicial,
  cantidad_actual,
  costo_unitario,
  precio_venta,
  fecha_vencimiento
)
SELECT
  p.negocio_id,
  p.id,
  'Lote Inicial (Migración)',
  p.stock,
  p.stock,
  0,
  p.precio,
  NULL
FROM public.productos p
WHERE p.stock > 0
  AND p.negocio_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.lotes l
    WHERE l.producto_id = p.id
  );


-- =============================================================================
-- 3. TRIGGER DE SINCRONIZACIÓN AUTOMÁTICA: productos.stock
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_sincronizar_stock_producto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_producto_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_producto_id := OLD.producto_id;
  ELSE
    v_producto_id := NEW.producto_id;
  END IF;

  -- Si un UPDATE reasignara producto_id, resincronizar también el producto anterior
  IF TG_OP = 'UPDATE' AND OLD.producto_id IS DISTINCT FROM NEW.producto_id THEN
    UPDATE public.productos
    SET stock = COALESCE((
      SELECT SUM(l.cantidad_actual)::integer
      FROM public.lotes l
      WHERE l.producto_id = OLD.producto_id
    ), 0)
    WHERE id = OLD.producto_id;
  END IF;

  UPDATE public.productos
  SET stock = COALESCE((
    SELECT SUM(l.cantidad_actual)::integer
    FROM public.lotes l
    WHERE l.producto_id = v_producto_id
  ), 0)
  WHERE id = v_producto_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sincronizar_stock_producto
  AFTER INSERT OR UPDATE OF cantidad_actual OR DELETE
  ON public.lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sincronizar_stock_producto();


-- =============================================================================
-- 4. RPC TRANSACCIONAL FEFO + FIFO MULTI-LOTE: descontar_stock_pos
-- =============================================================================
-- Mantiene la firma exacta (p_producto_id uuid, p_negocio_id uuid, p_cantidad int)
-- compatible con js/admin.js.
CREATE OR REPLACE FUNCTION public.descontar_stock_pos(
  p_producto_id uuid,
  p_negocio_id uuid,
  p_cantidad int
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_stock_actual integer;
  v_nuevo_stock integer;
  v_tiene_lotes boolean;
  v_restante integer;
  v_descontar integer;
  v_lote record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para descontar stock.';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a descontar debe ser mayor a 0.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.negocios
    WHERE id = p_negocio_id
      AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes permisos sobre el inventario de este negocio.';
  END IF;

  -- Bloqueo exclusivo de la fila de producto para serializar ventas concurrentes
  SELECT nombre, stock
  INTO v_nombre, v_stock_actual
  FROM public.productos
  WHERE id = p_producto_id
    AND negocio_id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado en el negocio activo.';
  END IF;

  -- Verificar si el producto opera con tabla 'lotes'
  SELECT EXISTS (
    SELECT 1
    FROM public.lotes
    WHERE producto_id = p_producto_id
      AND negocio_id = p_negocio_id
  ) INTO v_tiene_lotes;

  IF v_tiene_lotes THEN
    v_restante := p_cantidad;

    -- Algoritmo FEFO + FIFO: primero lo que vence antes, luego lo que ingresó antes
    FOR v_lote IN
      SELECT id, cantidad_actual
      FROM public.lotes
      WHERE producto_id = p_producto_id
        AND negocio_id = p_negocio_id
        AND cantidad_actual > 0
      ORDER BY fecha_vencimiento ASC NULLS LAST, fecha_ingreso ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_restante <= 0;

      v_descontar := LEAST(v_lote.cantidad_actual, v_restante);

      UPDATE public.lotes
      SET cantidad_actual = cantidad_actual - v_descontar
      WHERE id = v_lote.id;

      v_restante := v_restante - v_descontar;
    END LOOP;

    IF v_restante > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente en lotes para "%" (disponible: %, solicitado: %).',
        v_nombre, (p_cantidad - v_restante), p_cantidad;
    END IF;

    -- Leer stock recalculado automáticamente por trg_sincronizar_stock_producto
    SELECT stock
    INTO v_nuevo_stock
    FROM public.productos
    WHERE id = p_producto_id;

    RETURN v_nuevo_stock;
  END IF;

  -- Fallback seguro: producto sin registros en 'lotes' (ej. servicio o producto sin lote)
  IF v_stock_actual < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para "%" (disponible: %, solicitado: %).',
      v_nombre, v_stock_actual, p_cantidad;
  END IF;

  UPDATE public.productos
  SET stock = stock - p_cantidad
  WHERE id = p_producto_id
    AND negocio_id = p_negocio_id
  RETURNING stock INTO v_nuevo_stock;

  RETURN v_nuevo_stock;
END;
$$;

REVOKE ALL ON FUNCTION public.descontar_stock_pos(uuid, uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.descontar_stock_pos(uuid, uuid, int) TO authenticated;


-- =============================================================================
-- 5. SEGURIDAD RLS PARA TABLA: lotes
-- =============================================================================
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_lotes" ON public.lotes;
DROP POLICY IF EXISTS "owner_select_lotes" ON public.lotes;
DROP POLICY IF EXISTS "owner_insert_lotes" ON public.lotes;
DROP POLICY IF EXISTS "owner_update_lotes" ON public.lotes;
DROP POLICY IF EXISTS "owner_delete_lotes" ON public.lotes;

CREATE POLICY "owner_select_lotes"
  ON public.lotes FOR SELECT
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_insert_lotes"
  ON public.lotes FOR INSERT
  TO authenticated
  WITH CHECK (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_update_lotes"
  ON public.lotes FOR UPDATE
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_delete_lotes"
  ON public.lotes FOR DELETE
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM public.negocios WHERE owner_id = auth.uid()
    )
  );

COMMIT;
