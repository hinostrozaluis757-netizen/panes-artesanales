-- ARCHIVO: sql/02_pos_y_stock.sql
-- =============================================================================
-- PASO 3: INVENTARIO CON STOCK, ESCÁNER QR Y PUNTO DE VENTA FÍSICO (POS)
-- =============================================================================
-- Script idempotente para ejecutar en el SQL Editor de Supabase.
-- 1. Agrega columna 'stock' a 'productos' con validación CHECK (stock >= 0).
-- 2. Garantiza columna 'codigo_qr' e índice único compuesto por negocio.
-- 3. Actualiza el CHECK de 'pedidos.tipo_entrega' para aceptar 'Presencial' (POS).
-- 4. Crea la función RPC atómica 'descontar_stock_pos' para ventas concurrentes.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. STOCK E IDENTIFICADOR QR EN TABLA: productos
-- =============================================================================
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 10 CHECK (stock >= 0);

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS codigo_qr text;

-- Índice único compuesto por negocio (permite múltiples productos sin QR / NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_negocio_codigo_qr
  ON public.productos (negocio_id, codigo_qr)
  WHERE codigo_qr IS NOT NULL;


-- =============================================================================
-- 2. SOPORTE DE ENTREGA 'Presencial' PARA VENTAS POS EN TABLA: pedidos
-- =============================================================================
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.pedidos'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo_entrega%'
  LOOP
    EXECUTE format('ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_tipo_entrega_check
  CHECK (tipo_entrega IN ('Delivery', 'Recojo en local', 'Consumo en local', 'Presencial'));


-- =============================================================================
-- 3. FUNCIÓN RPC ATÓMICA: descontar_stock_pos
-- =============================================================================
-- Evita condiciones de carrera y stock negativo si se cobra desde dos cajas
-- simultáneamente. Devuelve el nuevo stock restante.
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
  v_nuevo_stock integer;
  v_stock_actual integer;
  v_nombre text;
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

  -- Descuento atómico en una sola instrucción UPDATE con guarda stock >= p_cantidad
  UPDATE public.productos
  SET stock = stock - p_cantidad
  WHERE id = p_producto_id
    AND negocio_id = p_negocio_id
    AND stock >= p_cantidad
  RETURNING stock INTO v_nuevo_stock;

  IF FOUND THEN
    RETURN v_nuevo_stock;
  END IF;

  -- Determinar el motivo exacto del fallo
  SELECT nombre, stock
  INTO v_nombre, v_stock_actual
  FROM public.productos
  WHERE id = p_producto_id
    AND negocio_id = p_negocio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado en el negocio activo.';
  END IF;

  RAISE EXCEPTION 'Stock insuficiente para "%" (disponible: %, solicitado: %).',
    v_nombre, v_stock_actual, p_cantidad;
END;
$$;

REVOKE ALL ON FUNCTION public.descontar_stock_pos(uuid, uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.descontar_stock_pos(uuid, uuid, int) TO authenticated;

COMMIT;
