-- ARCHIVO: sql/01_migracion_multitenant_qr.sql
-- =============================================================================
-- MIGRACIÓN MULTI-TENANT Y ESCÁNER QR (SaaS)
-- =============================================================================
-- Descripción:
-- 1. Crea la tabla 'negocios' vinculada a usuarios de Supabase Auth (auth.users).
-- 2. Adapta las tablas 'productos' y 'pedidos' incorporando 'negocio_id'.
-- 3. Agrega 'codigo_qr' en 'productos' con índice único por negocio.
-- 4. Establece políticas de seguridad Row Level Security (RLS) diferenciadas:
--    - 'anon': Lectura pública de negocios y productos activos; creación de pedidos.
--    - 'authenticated': Control total (CRUD) únicamente sobre registros propios.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABLA: negocios
-- =============================================================================
CREATE TABLE IF NOT EXISTS negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  slug text NOT NULL UNIQUE,
  whatsapp text,
  logo_url text,
  activo boolean NOT NULL DEFAULT true,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para búsquedas optimizadas por slug y consultas por dueño
CREATE INDEX IF NOT EXISTS idx_negocios_slug ON negocios(slug);
CREATE INDEX IF NOT EXISTS idx_negocios_owner ON negocios(owner_id);
CREATE INDEX IF NOT EXISTS idx_negocios_activo ON negocios(activo);


-- =============================================================================
-- 2. ADAPTACIÓN DE TABLAS EXISTENTES: productos y pedidos
-- =============================================================================

-- Si la tabla productos no estuviera creada previamente en el esquema base
CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  categoria text NOT NULL,
  imagen_url text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Agregar columna 'negocio_id' a 'productos'
ALTER TABLE productos 
  ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id) ON DELETE CASCADE;

-- Agregar columna 'codigo_qr' a 'productos'
ALTER TABLE productos 
  ADD COLUMN IF NOT EXISTS codigo_qr text;

-- Agregar columna 'negocio_id' a 'pedidos'
ALTER TABLE pedidos 
  ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id) ON DELETE CASCADE;

-- Índices de llaves foráneas para rendimiento
CREATE INDEX IF NOT EXISTS idx_productos_negocio ON productos(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_negocio ON pedidos(negocio_id);

-- Índice único compuesto para 'codigo_qr' por negocio:
-- Permite que múltiples productos no tengan QR (NULL), pero asegura que ningún código
-- QR se repita dentro del mismo negocio, sin bloquear que otros negocios usen códigos idénticos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_negocio_codigo_qr 
  ON productos (negocio_id, codigo_qr) 
  WHERE codigo_qr IS NOT NULL;


-- =============================================================================
-- 3. MIGRACIÓN DE DATOS PREVIOS (BLOQUE SEGURO / COMENTADO)
-- =============================================================================
-- Si ya tienes registros en 'productos' o 'pedidos' pertenecientes a tu único
-- negocio original (ej. Don Roberto), ejecuta este bloque reemplazando
-- '<TU_AUTH_USER_UUID>' con el UID de tu cuenta administradora registrada
-- en Supabase (Auth -> Users), antes de forzar la restricción NOT NULL.
/*
-- A. Registrar el negocio inicial:
INSERT INTO negocios (nombre, slug, whatsapp, logo_url, activo, owner_id)
VALUES (
  'Don Roberto',
  'don-roberto',
  '51926549398',
  NULL,
  true,
  '<TU_AUTH_USER_UUID>'
)
ON CONFLICT (slug) DO NOTHING;

-- B. Asociar productos huérfanos al negocio 'don-roberto':
UPDATE productos 
SET negocio_id = (SELECT id FROM negocios WHERE slug = 'don-roberto' LIMIT 1)
WHERE negocio_id IS NULL;

-- C. Asociar pedidos huérfanos al negocio 'don-roberto':
UPDATE pedidos 
SET negocio_id = (SELECT id FROM negocios WHERE slug = 'don-roberto' LIMIT 1)
WHERE negocio_id IS NULL;

-- D. Una vez que no queden registros nulos, activar restricción NOT NULL:
ALTER TABLE productos ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE pedidos ALTER COLUMN negocio_id SET NOT NULL;
*/


-- =============================================================================
-- 4. SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilitar RLS en todas las entidades
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

-- Limpieza preventiva de políticas anteriores para garantizar idempotencia
DROP POLICY IF EXISTS "anon_select_negocios_activos" ON negocios;
DROP POLICY IF EXISTS "owner_manage_negocios" ON negocios;

DROP POLICY IF EXISTS "anon_select_productos_activos" ON productos;
DROP POLICY IF EXISTS "owner_manage_productos" ON productos;

DROP POLICY IF EXISTS "anon_insert_pedidos" ON pedidos;
DROP POLICY IF EXISTS "auth_select_pedidos" ON pedidos;
DROP POLICY IF EXISTS "auth_update_pedidos" ON pedidos;
DROP POLICY IF EXISTS "owner_manage_pedidos" ON pedidos;

DROP POLICY IF EXISTS "anon_insert_items" ON pedido_items;
DROP POLICY IF EXISTS "auth_select_items" ON pedido_items;
DROP POLICY IF EXISTS "anon_insert_pedido_items" ON pedido_items;
DROP POLICY IF EXISTS "owner_manage_pedido_items" ON pedido_items;


-- -----------------------------------------------------------------------------
-- 4.1. POLÍTICAS PARA: negocios
-- -----------------------------------------------------------------------------
-- Lectura pública: Clientes (anon y auth) pueden consultar negocios activos para cargar el frontend
CREATE POLICY "anon_select_negocios_activos"
  ON negocios FOR SELECT
  TO anon, authenticated
  USING (activo = true);

-- Control total del dueño: El usuario autenticado administra únicamente sus propios negocios
CREATE POLICY "owner_manage_negocios"
  ON negocios FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 4.2. POLÍTICAS PARA: productos
-- -----------------------------------------------------------------------------
-- Lectura pública: Clientes pueden ver productos activos pertenecientes a un negocio activo
CREATE POLICY "anon_select_productos_activos"
  ON productos FOR SELECT
  TO anon, authenticated
  USING (
    activo = true 
    AND negocio_id IN (
      SELECT id FROM negocios WHERE activo = true
    )
  );

-- Control total del dueño: CRUD completo solo sobre productos de sus propios negocios
CREATE POLICY "owner_manage_productos"
  ON productos FOR ALL
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM negocios WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    negocio_id IN (
      SELECT id FROM negocios WHERE owner_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 4.3. POLÍTICAS PARA: pedidos
-- -----------------------------------------------------------------------------
-- Inserción pública: Clientes anónimos y autenticados pueden crear pedidos dirigidos a un negocio activo
CREATE POLICY "anon_insert_pedidos"
  ON pedidos FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    negocio_id IN (
      SELECT id FROM negocios WHERE activo = true
    )
  );

-- Control total del dueño: Visualizar, actualizar estados o gestionar pedidos de sus propios negocios
CREATE POLICY "owner_manage_pedidos"
  ON pedidos FOR ALL
  TO authenticated
  USING (
    negocio_id IN (
      SELECT id FROM negocios WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    negocio_id IN (
      SELECT id FROM negocios WHERE owner_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 4.4. POLÍTICAS PARA: pedido_items
-- -----------------------------------------------------------------------------
-- Inserción pública: Permitir que los items del carrito se inserten vinculados a un pedido
CREATE POLICY "anon_insert_pedido_items"
  ON pedido_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    pedido_id IN (
      SELECT id FROM pedidos
    )
  );

-- Control total del dueño: Consultar y gestionar los items de pedidos de su propio negocio
CREATE POLICY "owner_manage_pedido_items"
  ON pedido_items FOR ALL
  TO authenticated
  USING (
    pedido_id IN (
      SELECT p.id FROM pedidos p
      JOIN negocios n ON n.id = p.negocio_id
      WHERE n.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    pedido_id IN (
      SELECT p.id FROM pedidos p
      JOIN negocios n ON n.id = p.negocio_id
      WHERE n.owner_id = auth.uid()
    )
  );

COMMIT;
